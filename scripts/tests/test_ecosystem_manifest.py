"""ecosystem.json is the one list install.sh installs; these tests keep it, the dashboard roster
and scripts/bootstrap.sh in agreement. Offline: no clone, no pip download.

    python3 -m unittest discover -s scripts/tests -v
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = json.loads((ROOT / "ecosystem.json").read_text(encoding="utf-8"))
REPOS = [c["repo"] for c in MANIFEST["components"]]
DEFAULT = [c["repo"] for c in MANIFEST["components"] if not c.get("optional")]
OPTIONAL = [c["repo"] for c in MANIFEST["components"] if c.get("optional")]
BOOTSTRAP = ROOT / "scripts" / "bootstrap.sh"
BASH = os.environ.get("AVOS_TEST_BASH", "bash")  # CI sets /bin/bash on macOS: bash 3.2


class ManifestTests(unittest.TestCase):
    def test_repos_are_unique(self):
        self.assertEqual(len(REPOS), len(set(REPOS)))

    def test_fields(self):
        for c in MANIFEST["components"]:
            with self.subTest(repo=c["repo"]):
                self.assertIn(c["install"], {"pip", "checkout"})
                self.assertIn(c["layer"], {"agent", "engine", "skill", "verify", "recognize", "utility", "delivery"})
                self.assertTrue(c["role"].strip())
                self.assertIsInstance(c.get("extras", []), list)
                self.assertIsInstance(c.get("optional", False), bool)

    def test_exactly_one_agent(self):
        agents = [c["repo"] for c in MANIFEST["components"] if c["layer"] == "agent"]
        self.assertEqual(agents, ["video-production-agent"])

    def test_dashboard_roster_names_the_same_repositories(self):
        registry = json.loads((ROOT / "docs" / "ecosystem" / "registry.json").read_text(encoding="utf-8"))
        roster = {r["name"] for r in registry["repos"]} - {"AI-video-production-OS"}
        self.assertEqual(roster, set(REPOS))


def _env(home: Path) -> dict:
    env = {k: v for k, v in os.environ.items() if k != "VIRTUAL_ENV"}
    env.update(HOME=str(home), CLAUDE_SKILLS_DIR=str(home / ".claude" / "skills"),
               PIP_NO_INDEX="1", PIP_DISABLE_PIP_VERSION_CHECK="1", GIT_TERMINAL_PROMPT="0")
    env.pop("AVOS_HOME", None)
    return env


class BootstrapTests(unittest.TestCase):
    def _dry_run(self, *flags):
        with tempfile.TemporaryDirectory() as tmp:
            ws = Path(tmp) / "ws"
            out = subprocess.run([BASH, str(BOOTSTRAP), "--dir", str(ws), "--dry-run", *flags],
                                 env=_env(Path(tmp)), capture_output=True, text=True, timeout=60)
            self.assertEqual(out.returncode, 0, out.stderr)
            self.assertFalse(ws.exists())
            return out.stdout

    def test_dry_run_changes_nothing_and_skips_optional_by_default(self):
        out = self._dry_run()
        for repo in DEFAULT:
            self.assertIn(f"{repo}: cloning", out)
        for repo in OPTIONAL:
            self.assertNotIn(f"{repo}: cloning", out)

    def test_with_optional_includes_optional_components(self):
        out = self._dry_run("--with-optional")
        for repo in REPOS:
            self.assertIn(f"{repo}: cloning", out)

    def test_links_skills_and_never_replaces_a_foreign_entry(self):
        with tempfile.TemporaryDirectory() as tmp:
            home, ws = Path(tmp), Path(tmp) / "ws"
            for repo in DEFAULT:  # pre-existing clones, so nothing touches the network
                (ws / repo).mkdir(parents=True)
                subprocess.run(["git", "init", "-q", str(ws / repo)], check=True)
            (ws / "qc-skill" / "SKILL.md").write_text("---\nname: qc-skill\n---\n", encoding="utf-8")
            (ws / "imagemagick-skill" / "SKILL.md").write_text("---\nname: imagemagick-skill\n---\n", encoding="utf-8")
            (ws / "ffmpeg-skill" / "SKILL.md").write_text("---\nname: ffmpeg-skill\n---\n", encoding="utf-8")
            skills = home / ".claude" / "skills"
            (skills / "ffmpeg-skill").mkdir(parents=True)  # the user's own copy

            out = subprocess.run([BASH, str(BOOTSTRAP), "--dir", str(ws), "--no-update"],
                                 env=_env(home), capture_output=True, text=True, timeout=300)

            self.assertEqual(out.returncode, 0, out.stdout + out.stderr)
            self.assertEqual(os.readlink(skills / "qc-skill"), str(ws / "qc-skill"))
            self.assertEqual(os.readlink(skills / "imagemagick-skill"), str(ws / "imagemagick-skill"))
            self.assertFalse((skills / "ffmpeg-skill").is_symlink())
            self.assertIn("dubbing-skill: no package yet", out.stdout)
            self.assertIn("ffmpeg-skill: ~/.claude/skills entry not replaced", out.stdout)

            again = subprocess.run([BASH, str(BOOTSTRAP), "--dir", str(ws), "--no-update"],
                                   env=_env(home), capture_output=True, text=True, timeout=300)
            self.assertEqual(again.returncode, 0)
            self.assertIn("qc-skill: linked\n", again.stdout)


if __name__ == "__main__":
    unittest.main()
