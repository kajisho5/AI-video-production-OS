"""Live conformance tests: the four process-based checks in registry.conformance, wired
against a real Skill (qc-skill, already locally cloned and pip-installed for this
project's own `provides` rollout work). Skipped when the `qc` console script is not on
PATH - this is deliberately not run against a synthetic fake, since the whole point of
these checks is to prove they work against a real, unmodified Skill process.

    python3 -m unittest discover -s registry/tests -t . -p "test_conformance_live.py" -v
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from registry.conformance import (
    check_doctor_status,
    check_forbidden_keys_rejected,
    check_no_clobber_input,
    check_workspace_confinement,
    make_stdin_json_runner,
)

QC_FORBIDDEN_KEYS = ("command", "commands", "argv", "args", "shell", "cmd", "cmdline", "exec", "executable", "filter", "filter_complex", "env", "environment")


@unittest.skipUnless(shutil.which("qc"), "qc-skill's `qc` console script is not on PATH")
class QcSkillLiveConformanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="registry_conformance_")
        cls.srt = Path(cls.tmp) / "test.srt"
        cls.srt.write_text("1\n00:00:00,000 --> 00:00:02,000\nHello\n", encoding="utf-8")
        cls.base_request = {"schema": "qc/request@1", "operation": "validate", "kind": "subtitle", "input": str(cls.srt)}

    def _run_qc(self, request, workspace=None):
        """Run `qc run - --json` synchronously to completion; return value unused, the
        checks care only about filesystem/content side effects observed afterward."""
        cmd = ["qc", "run", "-", "--json"]
        if workspace is not None:
            cmd += ["--workspace", workspace]
        subprocess.run(cmd, input=json.dumps(request), capture_output=True, text=True, timeout=30)

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

    def test_workspace_confinement_against_a_real_run(self):
        # Note: this sandbox has no ffprobe, so the run itself fails with
        # DEPENDENCY_ERROR before qc ever reaches its report-cache write - that's fine,
        # this check only cares whether anything escaped *outside* the workspace, which
        # holds regardless of whether the run succeeded. The "isn't vacuously PASS-ing"
        # proof lives in the synthetic leaky_run test below instead, since it can't
        # depend on an optional system dependency being present.
        workspace = tempfile.mkdtemp(prefix="registry_conformance_ws_")
        outside = tempfile.mkdtemp(prefix="registry_conformance_outside_")
        try:
            result = check_workspace_confinement(
                run_in_workspace=lambda ws: self._run_qc(self.base_request, workspace=ws),
                workspace=workspace,
                watch_dirs=[outside],
            )
            self.assertEqual(result.status, "PASS", result.detail)
        finally:
            shutil.rmtree(workspace, ignore_errors=True)
            shutil.rmtree(outside, ignore_errors=True)

    def test_workspace_confinement_fails_when_a_stray_file_appears(self):
        """Sanity check on the check itself: a run_in_workspace that writes outside the
        workspace must be caught, proving this isn't a check that always says PASS."""
        outside = tempfile.mkdtemp(prefix="registry_conformance_outside_")
        try:
            def leaky_run(_ws):
                (Path(outside) / "stray.txt").write_text("escaped the workspace")
            result = check_workspace_confinement(run_in_workspace=leaky_run, workspace=self.tmp, watch_dirs=[outside])
            self.assertEqual(result.status, "FAIL")
        finally:
            shutil.rmtree(outside, ignore_errors=True)

    def test_workspace_confinement_missing_arguments_raise_not_implemented(self):
        with self.assertRaises(NotImplementedError):
            check_workspace_confinement()

    def test_no_clobber_input_against_a_real_run(self):
        result = check_no_clobber_input(
            run_with_input=lambda path: self._run_qc({**self.base_request, "input": path}),
            input_path=str(self.srt),
        )
        self.assertEqual(result.status, "PASS", result.detail)

    def test_no_clobber_input_fails_when_the_input_is_modified(self):
        """Sanity check on the check itself: a run_with_input that mutates the fixture
        must be caught, proving this isn't a check that always says PASS."""
        fixture = Path(self.tmp) / "mutable.srt"
        fixture.write_text("original", encoding="utf-8")
        def mutating_run(path):
            Path(path).write_text("mutated", encoding="utf-8")
        result = check_no_clobber_input(run_with_input=mutating_run, input_path=str(fixture))
        self.assertEqual(result.status, "FAIL")

    def test_no_clobber_input_missing_arguments_raise_not_implemented(self):
        with self.assertRaises(NotImplementedError):
            check_no_clobber_input()


if __name__ == "__main__":
    unittest.main(verbosity=2)
