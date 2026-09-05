"""Tests for the reference Capability registry (docs/ROADMAP.md Phase 1), against real
captured `provides` data - not synthetic examples. Fixtures in tests/fixtures/ are
`{skill_id/skill.id, provides}` excerpts of the real `contract`/`skill --json` output of
five Skills after their `provides` field was added (docs/ECOSYSTEM_CHANGELOG.md), trimmed
for size but otherwise byte-identical to what each Skill actually prints.

    python3 -m unittest discover -s registry/tests -v
"""
from __future__ import annotations

import json
import unittest
from pathlib import Path

from registry import CapabilityRegistry, CollisionError, ContractError, skill_identity
from registry.conformance import run_static_checks

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class SkillIdentityTests(unittest.TestCase):
    def test_flat_skill_id(self):
        self.assertEqual(skill_identity(load("qc-skill.provides.json")), "qc")
        self.assertEqual(skill_identity(load("video-editing-skill.provides.json")), "video-editing")

    def test_flat_id_only(self):
        # the real transcription-skill outlier: no skill_id field at all (POC Finding 5/9)
        self.assertEqual(skill_identity(load("transcription-skill.provides.json")), "transcription-skill")

    def test_nested_skill_id(self):
        # the real ffmpeg-skill shape: skill.id, not a flat top-level field (POC Finding 7)
        self.assertEqual(skill_identity(load("ffmpeg-skill.provides.json")), "ffmpeg-skill")

    def test_raises_when_none_present(self):
        with self.assertRaises(ContractError):
            skill_identity({"provides": []})


class RegisterRealContractsTests(unittest.TestCase):
    def setUp(self):
        self.registry = CapabilityRegistry()

    def test_register_all_five_real_fixtures(self):
        added = []
        for name in FIXTURES.glob("*.provides.json"):
            added.extend(self.registry.register_contract(load(name.name)))
        # 10 (qc) + 5 (media-analysis) + 1 (transcription) + 8 (video-editing) + 21 (ffmpeg) = 45
        self.assertEqual(len(added), 45)

    def test_register_rejects_a_malformed_entry(self):
        with self.assertRaises(ContractError):
            self.registry.register_contract({"skill_id": "broken", "provides": [{"id": "x.y", "lifecycle": "EXPERIMENTAL"}]})  # missing tool_id

    def test_a_skill_with_no_provides_registers_nothing_and_does_not_error(self):
        added = self.registry.register_contract({"skill_id": "not-yet-adopted"})
        self.assertEqual(added, [])


class CollisionDetectionTests(unittest.TestCase):
    """The ecosystem's one real, documented Capability collision
    (docs/CAPABILITY_MATRIX.md section 8a): qc-skill and media-analysis-skill both
    register measure.audio.loudness / measure.audio.silence / measure.audio.integrity."""

    def setUp(self):
        self.registry = CapabilityRegistry()
        self.registry.register_contract(load("qc-skill.provides.json"))
        self.registry.register_contract(load("media-analysis-skill.provides.json"))
        self.registry.register_contract(load("video-editing-skill.provides.json"))

    def test_the_three_documented_collisions_are_detected(self):
        for cap in ("measure.audio.loudness", "measure.audio.silence", "measure.audio.integrity"):
            self.assertTrue(self.registry.is_collision(cap), cap)
            providers = {p.skill_id for p in self.registry.providers_of(cap)}
            self.assertEqual(providers, {"qc", "media-analysis"}, cap)

    def test_qc_only_capabilities_are_not_collisions(self):
        for cap in ("measure.video.freeze", "measure.video.black_frame", "measure.subtitle.timing"):
            self.assertFalse(self.registry.is_collision(cap), cap)

    def test_media_analysis_only_capabilities_are_not_collisions(self):
        self.assertFalse(self.registry.is_collision("measure.video.scene_detection"))
        self.assertFalse(self.registry.is_collision("measure.video.timing"))

    def test_unrelated_skill_capabilities_are_not_collisions(self):
        self.assertFalse(self.registry.is_collision("video.trim"))

    def test_collisions_summary_lists_exactly_the_three(self):
        self.assertEqual(set(self.registry.collisions()), {"measure.audio.loudness", "measure.audio.silence", "measure.audio.integrity"})


class ResolvePolicyTests(unittest.TestCase):
    """docs/CAPABILITY_MODEL.md's 3-tier collision policy: explicit > default > refusal."""

    def setUp(self):
        self.registry = CapabilityRegistry()
        self.registry.register_contract(load("qc-skill.provides.json"))
        self.registry.register_contract(load("media-analysis-skill.provides.json"))

    def test_no_choice_on_a_real_collision_refuses(self):
        with self.assertRaises(CollisionError) as cm:
            self.registry.resolve("measure.audio.loudness")
        self.assertEqual(cm.exception.capability_id, "measure.audio.loudness")
        self.assertEqual({p.skill_id for p in cm.exception.providers}, {"qc", "media-analysis"})

    def test_explicit_choice_wins(self):
        reg = self.registry.resolve("measure.audio.loudness", explicit_skill_id="media-analysis")
        self.assertEqual(reg.skill_id, "media-analysis")
        self.assertEqual(reg.tool_id, "media-analysis/loudness")

    def test_default_provider_applies_only_without_an_explicit_choice(self):
        reg = self.registry.resolve("measure.audio.loudness", default_skill_id="qc")
        self.assertEqual(reg.skill_id, "qc")
        # explicit still overrides a default given at the same time
        reg2 = self.registry.resolve("measure.audio.loudness", explicit_skill_id="media-analysis", default_skill_id="qc")
        self.assertEqual(reg2.skill_id, "media-analysis")

    def test_non_colliding_capability_resolves_with_no_choice_needed(self):
        reg = self.registry.resolve("measure.video.freeze")
        self.assertEqual(reg.skill_id, "qc")

    def test_unknown_capability_raises_key_error(self):
        with self.assertRaises(KeyError):
            self.registry.resolve("no.such.capability")

    def test_a_choice_that_does_not_provide_the_capability_raises_key_error(self):
        with self.assertRaises(KeyError):
            self.registry.resolve("measure.audio.loudness", explicit_skill_id="video-editing")


class ConformanceStaticChecksTests(unittest.TestCase):
    def test_real_fixtures_pass_the_static_checks(self):
        for name in FIXTURES.glob("*.provides.json"):
            with self.subTest(fixture=name.name):
                results = run_static_checks(load(name.name))
                by_check = {r.check: r for r in results}
                self.assertEqual(by_check["publishes_contract"].status, "PASS")
                self.assertEqual(by_check["lifecycle_declared"].status, "PASS")

    def test_a_missing_tool_id_fails_publishes_contract(self):
        doc = {"skill_id": "broken", "provides": [{"id": "x.y", "lifecycle": "EXPERIMENTAL", "tool_id": ""}]}
        results = run_static_checks(doc)
        by_check = {r.check: r for r in results}
        self.assertEqual(by_check["publishes_contract"].status, "FAIL")

    def test_no_provides_is_not_implemented_not_a_failure(self):
        results = run_static_checks({"skill_id": "not-yet-adopted"})
        by_check = {r.check: r for r in results}
        self.assertEqual(by_check["lifecycle_declared"].status, "NOT_IMPLEMENTED")


if __name__ == "__main__":
    unittest.main(verbosity=2)
