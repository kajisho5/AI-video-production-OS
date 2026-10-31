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
PLANNED = [c["repo"] for c in MANIFEST["components"] if c.get("status") == "planned"]
REPOS = [c["repo"] for c in MANIFEST["components"] if c["repo"] not in PLANNED]
DEFAULT = [c["repo"] for c in MANIFEST["components"] if not c.get("optional") and c["repo"] not in PLANNED]
OPTIONAL = [c["repo"] for c in MANIFEST["components"] if c.get("optional")]
BOOTSTRAP = ROOT / "scripts" / "bootstrap.sh"
INSTALL = ROOT / "install.sh"
BASH = os.environ.get("AVOS_TEST_BASH", "bash")  # CI sets /bin/bash on macOS: bash 3.2


class ManifestTests(unittest.TestCase):
    def test_repos_are_unique(self):
        names = [c["repo"] for c in MANIFEST["components"]] + [h["repo"] for h in MANIFEST.get("on_hold", [])]
        self.assertEqual(len(names), len(set(names)))

    def test_fields(self):
        departments = {d["id"] for d in MANIFEST["departments"]}
        for c in MANIFEST["components"]:
            with self.subTest(repo=c["repo"]):
                self.assertIn(c["install"], {"pip", "npm", "checkout"})
                self.assertIn(c["department"], departments)
                self.assertIn(c["status"], {"active", "scaffold", "planned"})
                self.assertTrue(c["role"].strip())
                self.assertTrue(c["owns"])
                self.assertIsInstance(c.get("extras", []), list)
                self.assertIsInstance(c.get("optional", False), bool)
                for e in c.get("engines", []):
                    self.assertTrue(e["name"].strip())

    def test_every_department_is_staffed(self):
        staffed = {c["department"] for c in MANIFEST["components"]}
        self.assertEqual(staffed, {d["id"] for d in MANIFEST["departments"]})

    def test_nothing_is_owned_twice(self):
        owners: dict = {}
        for c in MANIFEST["components"]:
            for thing in c["owns"]:
                with self.subTest(thing=thing):
                    self.assertNotIn(thing, owners, f"{thing}: {owners.get(thing)} and {c['repo']}")
                owners[thing] = c["repo"]

    def test_exactly_one_command(self):
        command = [c["repo"] for c in MANIFEST["components"] if c["department"] == "command"]
        self.assertEqual(command, ["video-production-agent"])

    def test_dashboard_roster_names_the_same_repositories(self):
        registry = json.loads((ROOT / "docs" / "ecosystem" / "registry.json").read_text(encoding="utf-8"))
        roster = {r["name"] for r in registry["repos"]} - {"Velisa"}
        self.assertEqual(roster, set(REPOS))

    def test_capability_status_covers_the_roster(self):
        # docs/ecosystem/MATURITY_MODEL.md: a repo with no entry renders every documented level as UNKNOWN, so a new
        # component must get an entry (fields it has no evidence for stay absent, never guessed) in the same change.
        registry = json.loads((ROOT / "docs" / "ecosystem" / "registry.json").read_text(encoding="utf-8"))
        status = json.loads((ROOT / "docs" / "ecosystem" / "capability-status.json").read_text(encoding="utf-8"))
        self.assertEqual(set(status["repos"]), {r["slug"] for r in registry["repos"]})
        for slug, entry in status["repos"].items():
            with self.subTest(repo=slug):
                self.assertRegex(entry.get("as_of", ""), r"^\d{4}-\d{2}-\d{2}$")
                for field in ("provides", "os_integration", "verified_e2e"):
                    if field + ("_published" if field == "provides" else "") in entry:
                        self.assertTrue(entry.get(field + "_evidence"), f"{slug}: {field} is set without {field}_evidence")


def _env(home: Path) -> dict:
    env = {k: v for k, v in os.environ.items() if k != "VIRTUAL_ENV"}
    env.update(HOME=str(home), CLAUDE_SKILLS_DIR=str(home / ".claude" / "skills"), CODEX_SKILLS_DIR=str(home / ".agents" / "skills"),
               PIP_NO_INDEX="1", PIP_DISABLE_PIP_VERSION_CHECK="1", GIT_TERMINAL_PROMPT="0")
    env.pop("AVOS_HOME", None)
    env.pop("VELISA_HOME", None)
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
        for repo in PLANNED:
            self.assertNotIn(f"{repo}: cloning", out)
            self.assertIn(f"{repo}: planned, repository not created yet", out)
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
            (ws / "stepcap" / "skills" / "stepcap").mkdir(parents=True)   # plugin layout: skills/<name>/SKILL.md
            (ws / "stepcap" / "skills" / "stepcap" / "SKILL.md").write_text("---\nname: stepcap\n---\n", encoding="utf-8")
            skills = home / ".claude" / "skills"
            (skills / "ffmpeg-skill").mkdir(parents=True)  # the user's own copy

            out = subprocess.run([BASH, str(BOOTSTRAP), "--dir", str(ws), "--no-update"],
                                 env=_env(home), capture_output=True, text=True, timeout=300)

            self.assertEqual(out.returncode, 0, out.stdout + out.stderr)
            self.assertEqual(os.readlink(skills / "qc-skill"), str(ws / "qc-skill"))
            self.assertEqual(os.readlink(skills / "imagemagick-skill"), str(ws / "imagemagick-skill"))
            self.assertEqual(os.readlink(skills / "stepcap"), str(ws / "stepcap" / "skills" / "stepcap"))
            self.assertFalse((skills / "ffmpeg-skill").is_symlink())
            codex = home / ".agents" / "skills"   # Codex reads the same skills from here
            self.assertEqual(os.readlink(codex / "qc-skill"), str(ws / "qc-skill"))
            self.assertEqual(os.readlink(codex / "ffmpeg-skill"), str(ws / "ffmpeg-skill"), "a foreign entry in one target does not stop the other")
            self.assertIn("dubbing-skill: no package yet", out.stdout)
            self.assertIn("ffmpeg-skill: ~/.claude/skills entry not replaced", out.stdout)

            again = subprocess.run([BASH, str(BOOTSTRAP), "--dir", str(ws), "--no-update"],
                                   env=_env(home), capture_output=True, text=True, timeout=300)
            self.assertEqual(again.returncode, 0)
            self.assertIn(f"qc-skill: linked ({skills})\n", again.stdout)


class WorkspaceDefaultTests(unittest.TestCase):
    """Which workspace install.sh / bootstrap.sh pick with no --dir (docs/RENAMING.md, ADR-015): $VELISA_HOME, then
    the pre-rename $AVOS_HOME, then ~/velisa-workspace -- or ~/ai-video-os when only that pre-rename workspace exists."""

    def _workspace(self, script: Path, home: Path, **env_vars) -> str:
        env = _env(home)
        env.update(env_vars)
        out = subprocess.run([BASH, str(script), "--dry-run", "--no-claude-skills", "--no-codex-skills"],
                             env=env, capture_output=True, text=True, timeout=60)
        self.assertEqual(out.returncode, 0, out.stderr)
        line = next(l for l in out.stdout.splitlines() if l.startswith("==> Workspace: "))
        return line[len("==> Workspace: "):]

    def _both(self, home: Path, **env_vars) -> str:
        via_bootstrap = self._workspace(BOOTSTRAP, home, **env_vars)
        via_install = self._workspace(INSTALL, home, **env_vars)  # from a checkout: execs bootstrap.sh, clones nothing
        self.assertEqual(via_bootstrap, via_install)
        return via_bootstrap

    def test_velisa_home_wins_over_avos_home(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            self.assertEqual(self._both(home, VELISA_HOME=str(home / "new"), AVOS_HOME=str(home / "old")), str(home / "new"))

    def test_avos_home_is_read_when_velisa_home_is_unset_or_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            self.assertEqual(self._both(home, AVOS_HOME=str(home / "old")), str(home / "old"))
            self.assertEqual(self._both(home, VELISA_HOME="", AVOS_HOME=str(home / "old")), str(home / "old"))

    def test_new_default_when_no_workspace_exists(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            self.assertEqual(self._both(home), str(home / "velisa-workspace"))
            self.assertEqual(sorted(p.name for p in home.iterdir()), [], "a dry run creates nothing")

    def test_pre_rename_workspace_is_kept_when_it_is_the_only_one(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            (home / "ai-video-os").mkdir()
            self.assertEqual(self._both(home), str(home / "ai-video-os"))

    def test_new_default_wins_once_it_exists(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            (home / "ai-video-os").mkdir()
            (home / "velisa-workspace").mkdir()
            self.assertEqual(self._both(home), str(home / "velisa-workspace"))

    def test_dir_flag_still_wins(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            env = _env(home)
            env.update(VELISA_HOME=str(home / "new"))
            out = subprocess.run([BASH, str(BOOTSTRAP), "--dir", str(home / "flag"), "--dry-run"],
                                 env=env, capture_output=True, text=True, timeout=60)
            self.assertEqual(out.returncode, 0, out.stderr)
            self.assertIn(f"==> Workspace: {home / 'flag'}\n", out.stdout)


if __name__ == "__main__":
    unittest.main()
