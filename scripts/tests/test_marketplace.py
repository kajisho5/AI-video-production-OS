"""The Claude Code marketplace is generated from ecosystem.json (scripts/marketplace.py), and update
notices come from scripts/skill-updates.py. Offline: the GitHub API and git ls-remote are faked.

    python3 -m unittest discover -s scripts/tests -v
"""
from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = json.loads((ROOT / "ecosystem.json").read_text(encoding="utf-8"))


def load(name: str, file: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


marketplace = load("marketplace", "marketplace.py")
updates = load("skill_updates", "skill-updates.py")


class MarketplaceTests(unittest.TestCase):
    def test_committed_files_match_ecosystem_json(self):
        self.assertEqual(marketplace.main(["--check"]), 0, "run: python3 scripts/marketplace.py")

    def test_entries(self):
        mk, meta = marketplace.build(MANIFEST)
        names = [e["name"] for e in mk["plugins"]]
        plugins = [c for c in MANIFEST["components"] if c.get("plugin") and c["status"] != "planned"]
        self.assertEqual(names, ["video-production-os"] + [c["repo"] for c in plugins])
        self.assertEqual(len(names), len(set(names)))
        for e in mk["plugins"][1:]:
            self.assertEqual(e["source"], {"source": "github", "repo": f"{MANIFEST['org']}/{e['name']}"})
            self.assertNotIn("version", e, "no version: installs follow each repository's commits")
        self.assertEqual(meta["dependencies"], [c["repo"] for c in plugins if not c.get("optional")])
        self.assertFalse(mk["name"].startswith(("claude", "anthropic")))

    def test_routing_skill_names_every_component(self):
        text = (ROOT / "plugins/video-production-os/skills/video-production-os/SKILL.md").read_text(encoding="utf-8")
        self.assertTrue(text.startswith("---\nname: video-production-os\n"))
        for c in MANIFEST["components"]:
            if c["status"] != "planned":
                self.assertIn(f"`{c['repo']}`", text)


class FakeAPI:
    def __init__(self, compare=None):
        self.calls = []
        self.compare = compare or {}
        self.issue = None
        self.comments = []

    def __call__(self, method, path, body=None):
        self.calls.append((method, path))
        if "/compare/" in path:
            return self.compare
        if path.startswith("/repos/o/os/issues?"):
            return [self.issue] if self.issue else []
        if method == "POST" and path.endswith("/issues"):
            self.issue = {"number": 1, "body": body["body"]}
            return self.issue
        if method == "PATCH":
            self.issue["body"] = body["body"]
            return self.issue
        if method == "POST" and path.endswith("/comments"):
            self.comments.append(body["body"])
            return {}
        raise AssertionError(path)


class SkillUpdatesTests(unittest.TestCase):
    manifest = {"org": "o", "components": [{"repo": "a", "status": "active"}, {"repo": "b", "status": "scaffold"}, {"repo": "p", "status": "planned"}]}

    def setUp(self):
        self.heads = {"a": {"branch": "main", "sha": "1" * 40, "release": "v1.0.0"}, "b": {"branch": "main", "sha": "2" * 40, "release": None}}
        self._orig = updates.ls_remote
        updates.ls_remote = lambda org, repo: dict(self.heads[repo])

    def tearDown(self):
        updates.ls_remote = self._orig

    def test_issue_flow_baseline_then_comment_with_mention(self):
        api = FakeAPI(compare={"total_commits": 2, "commits": [{"commit": {"message": "Fix loudness\n\nbody"}}, {"commit": {"message": "Add LUT"}}]})
        text, rc = updates.run_issue(api, self.manifest, "o/os", "owner")
        self.assertEqual((rc, api.comments), (0, []), "first run: baseline only")
        self.assertIn("skill-updates-state", api.issue["body"])
        self.heads["a"] = {"branch": "main", "sha": "3" * 40, "release": "v1.1.0"}
        text, rc = updates.run_issue(api, self.manifest, "o/os", "owner")
        self.assertEqual(len(api.comments), 1)
        c = api.comments[0]
        self.assertIn("@owner", c)
        self.assertIn("tag **v1.1.0** (was v1.0.0)", c)
        self.assertIn("- Fix loudness", c)
        self.assertNotIn("[b]", c)
        updates.run_issue(api, self.manifest, "o/os", "owner")
        self.assertEqual(len(api.comments), 1, "nothing new: no comment")

    def test_unreadable_repository_keeps_its_last_state(self):
        old = {"a": dict(self.heads["a"]), "b": dict(self.heads["b"])}

        def fail(org, repo):
            if repo == "b":
                raise OSError("network down")
            return dict(self.heads[repo])
        updates.ls_remote = fail
        new, found, errors = updates.collect(FakeAPI(), self.manifest, old)
        self.assertEqual(new["b"], old["b"])
        self.assertEqual(found, [])
        self.assertEqual(errors, ["b: network down"])

    def test_version_tags_sort_numerically(self):
        self.assertEqual(max(["v0.9.0", "v0.10.0", "v0.2.1"], key=updates.version_key), "v0.10.0")


if __name__ == "__main__":
    unittest.main(verbosity=2)
