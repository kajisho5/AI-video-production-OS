"""Live conformance tests: the two process-based checks in registry.conformance, wired
against a real Skill (qc-skill, already locally cloned and pip-installed for this
project's own `provides` rollout work). Skipped when the `qc` console script is not on
PATH - this is deliberately not run against a synthetic fake, since the whole point of
these two checks is to prove they work against a real, unmodified Skill process.

    python3 -m unittest discover -s registry/tests -t . -p "test_conformance_live.py" -v
"""
from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path

from registry.conformance import check_doctor_status, check_forbidden_keys_rejected, make_stdin_json_runner

QC_FORBIDDEN_KEYS = ("command", "commands", "argv", "args", "shell", "cmd", "cmdline", "exec", "executable", "filter", "filter_complex", "env", "environment")


@unittest.skipUnless(shutil.which("qc"), "qc-skill's `qc` console script is not on PATH")
class QcSkillLiveConformanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="registry_conformance_")
        cls.srt = Path(cls.tmp) / "test.srt"
        cls.srt.write_text("1\n00:00:00,000 --> 00:00:02,000\nHello\n", encoding="utf-8")
        cls.base_request = {"schema": "qc/request@1", "operation": "validate", "kind": "subtitle", "input": str(cls.srt)}

    def test_forbidden_keys_are_rejected_top_level_and_nested(self):
        runner = make_stdin_json_runner(["qc", "run", "-", "--json"])
        result = check_forbidden_keys_rejected(runner=runner, forbidden_keys=QC_FORBIDDEN_KEYS, base_request=self.base_request)
        self.assertEqual(result.status, "PASS", result.detail)

    def test_a_forbidden_key_that_is_not_actually_rejected_fails_the_check(self):
        """Sanity check on the check itself: a runner that always claims success must fail,
        never silently pass, proving this isn't a check that always says PASS."""
        def always_succeeds(_doc):
            return {"status": "ok"}
        result = check_forbidden_keys_rejected(runner=always_succeeds, forbidden_keys=["command"], base_request=self.base_request)
        self.assertEqual(result.status, "FAIL")

    def test_missing_arguments_raise_not_implemented(self):
        with self.assertRaises(NotImplementedError):
            check_forbidden_keys_rejected()

    def test_doctor_status_is_real(self):
        runner = make_stdin_json_runner(["qc", "doctor", "--json"])
        result = check_doctor_status(runner=lambda: runner({}))
        self.assertEqual(result.status, "PASS", result.detail)

    def test_doctor_status_missing_runner_raises_not_implemented(self):
        with self.assertRaises(NotImplementedError):
            check_doctor_status()


if __name__ == "__main__":
    unittest.main(verbosity=2)
