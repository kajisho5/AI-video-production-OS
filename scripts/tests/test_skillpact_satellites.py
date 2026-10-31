"""scripts/skillpact-satellites.py finds the repositories with a SkillPact contract and summarises their
conformance runs (ADR-014). Offline: the raw.githubusercontent.com lookup is faked.

    python3 -m unittest discover -s scripts/tests -v
"""
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

spec = importlib.util.spec_from_file_location("skillpact_satellites", ROOT / "scripts" / "skillpact-satellites.py")
sat = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sat)

MANIFEST = {
    "org": "kajisho5",
    "components": [
        {"repo": "imagemagick-skill", "status": "active"},
        {"repo": "qc-skill", "status": "active"},
        {"repo": "nle-bridge-skill", "status": "planned"},
        {"repo": "broken-skill", "status": "scaffold"},
    ],
}
IM_CONTRACT = {"requirements": {"binaries": [{"name": "magick", "alternatives": ["convert", "sips"]},
                                             {"name": "unknown-tool"}]}}


def fake_get(seen):
    def get(url):
        seen.append(url)
        if url.endswith("/imagemagick-skill/HEAD/skill.contract.json"):
            return json.dumps(IM_CONTRACT)
        if url.endswith("/broken-skill/HEAD/skill.contract.json"):
            return "{not json"
        return None
    return get


class SatellitesTests(unittest.TestCase):
    def test_lists_repos_with_a_contract_and_skips_planned(self):
        seen = []
        found = sat.satellites(MANIFEST, fake_get(seen))
        self.assertEqual(found, [{"repo": "imagemagick-skill", "apt": "imagemagick"},
                                 {"repo": "broken-skill", "apt": ""}])
        self.assertFalse(any("nle-bridge-skill" in u for u in seen), "planned repositories are not looked up")
        self.assertIn("https://raw.githubusercontent.com/kajisho5/qc-skill/HEAD/skill.contract.json", seen)

    def test_apt_packages_follow_alternatives_and_skip_unknown(self):
        self.assertEqual(sat.apt_packages({"requirements": {"binaries": [{"name": "sips", "alternatives": ["ffprobe"]}]}}),
                         ["ffmpeg"])
        self.assertEqual(sat.apt_packages({}), [])

    def test_lookup_failure_other_than_404_is_not_swallowed(self):
        def boom(url):
            raise OSError("network down")
        with self.assertRaises(OSError):
            sat.satellites(MANIFEST, boom)

    def test_main_list_prints_a_matrix(self):
        with tempfile.TemporaryDirectory() as d:
            m = Path(d) / "ecosystem.json"
            m.write_text(json.dumps(MANIFEST), encoding="utf-8")
            import contextlib, io
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                self.assertEqual(sat.main(["list", "--manifest", str(m)], get=fake_get([])), 0)
            self.assertEqual(json.loads(buf.getvalue())["include"][0]["repo"], "imagemagick-skill")

    def test_summary_table(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p / "a").mkdir()
            (p / "a" / "result-imagemagick-skill.json").write_text(
                json.dumps({"repo": "imagemagick-skill", "level": "L2-tested", "outcome": "success"}))
            (p / "result-broken-skill.json").write_text(
                json.dumps({"repo": "broken-skill", "level": "none", "outcome": "failure"}))
            out = sat.summary(p)
        self.assertIn("| `imagemagick-skill` | `L2-tested` | pass (L1 or better) |", out)
        self.assertIn("| `broken-skill` | `none` | below L1 or failed |", out)

    def test_summary_with_no_results(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertIn("No repository", sat.summary(Path(d)))


if __name__ == "__main__":
    unittest.main()
