"""Tests for check_no_unsafe_shell_out (SKILL_SPEC.md #3), the AST-walk half of the
"never shell out unsafely" conformance check.

Deliberately uses synthetic fixture files written to a temp directory rather than the
real cloned Skill repos (those are session-local, not part of this repository, and
would not exist in CI) - the real-ecosystem verification for this check lives in the
commit/PR history's manual run against all 9 real Python Skills, not in an automated
test here. What belongs in this repo's own test suite is proof the check's *logic* is
correct: it must PASS clean code, FAIL each real unsafe pattern, and - the two false
positives an earlier draft actually produced against real ecosystem code - not
false-positive on a comment/docstring merely mentioning "eval"/"exec"/"shell=True", or
on the safe, explicit `shell=False`.
"""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from registry.conformance import check_no_unsafe_shell_out


def _check(**files: str):
    """Each kwarg is a module name (no dots allowed in a Python identifier) written as
    `<name>.py` in a fresh temp dir, e.g. _check(adapter="...") writes `adapter.py`."""
    with tempfile.TemporaryDirectory(prefix="registry_shellout_") as tmp:
        for name, content in files.items():
            (Path(tmp) / f"{name}.py").write_text(content, encoding="utf-8")
        return check_no_unsafe_shell_out(source_dir=tmp)


class NoUnsafeShellOutTests(unittest.TestCase):
    def test_missing_source_dir_raises_not_implemented(self):
        with self.assertRaises(NotImplementedError):
            check_no_unsafe_shell_out()

    def test_no_python_files_fails_with_a_clear_reason(self):
        result = check_no_unsafe_shell_out(source_dir=tempfile.mkdtemp(prefix="registry_shellout_empty_"))
        self.assertEqual(result.status, "FAIL")
        self.assertIn("no .py files", result.detail)

    def test_clean_list_argv_subprocess_call_passes(self):
        result = _check(adapter="""
import subprocess

def run(argv):
    return subprocess.run(argv, capture_output=True, shell=False)
""")
        self.assertEqual(result.status, "PASS", result.detail)

    def test_bare_eval_is_rejected(self):
        result = _check(bad="def f(x):\n    return eval(x)\n")
        self.assertEqual(result.status, "FAIL")
        self.assertIn("eval", result.detail)

    def test_bare_exec_is_rejected(self):
        result = _check(bad="def f(x):\n    exec(x)\n")
        self.assertEqual(result.status, "FAIL")
        self.assertIn("exec", result.detail)

    def test_os_system_is_rejected(self):
        result = _check(bad="import os\ndef f(cmd):\n    os.system(cmd)\n")
        self.assertEqual(result.status, "FAIL")
        self.assertIn("os.system", result.detail)

    def test_os_popen_is_rejected(self):
        result = _check(bad="import os\ndef f(cmd):\n    return os.popen(cmd)\n")
        self.assertEqual(result.status, "FAIL")
        self.assertIn("os.popen", result.detail)

    def test_subprocess_with_string_command_is_rejected(self):
        result = _check(bad="import subprocess\ndef f():\n    subprocess.run('ffmpeg -version', shell=False)\n")
        self.assertEqual(result.status, "FAIL")
        self.assertIn("string/f-string command", result.detail)

    def test_subprocess_with_a_variable_argv_is_not_flagged(self):
        """A bare variable name can't be statically known to be a string vs. a list -
        only an actual string/f-string literal in argv position is flagged, never an
        ordinary argv-list variable (which is exactly how every real Skill calls
        subprocess)."""
        result = _check(good="import subprocess\ndef f(argv):\n    subprocess.run(argv, shell=False)\n")
        self.assertEqual(result.status, "PASS", result.detail)

    def test_subprocess_with_fstring_command_is_rejected(self):
        result = _check(bad="import subprocess\ndef f(cmd):\n    subprocess.run(f'ffmpeg {cmd}', shell=False)\n")
        self.assertEqual(result.status, "FAIL")
        self.assertIn("string/f-string command", result.detail)

    def test_subprocess_shell_true_is_rejected(self):
        result = _check(bad="import subprocess\ndef f(argv):\n    subprocess.run(argv, shell=True)\n")
        self.assertEqual(result.status, "FAIL")
        self.assertIn("shell=True", result.detail)

    def test_subprocess_shell_non_literal_is_rejected(self):
        """A dynamic shell= value can't be statically proven to never be True - flagged
        conservatively rather than assumed safe."""
        result = _check(bad="import subprocess\ndef f(argv, use_shell):\n    subprocess.run(argv, shell=use_shell)\n")
        self.assertEqual(result.status, "FAIL")
        self.assertIn("non-literal", result.detail)

    def test_subprocess_shell_false_is_not_a_violation(self):
        """Regression test: explicit shell=False is the SAFE declaration, not a finding."""
        result = _check(good="import subprocess\ndef f(argv):\n    subprocess.run(argv, shell=False)\n")
        self.assertEqual(result.status, "PASS", result.detail)

    def test_comment_mentioning_eval_and_exec_is_not_a_violation(self):
        """Regression test: this exact false positive occurred on the real qc-skill
        source (rules.py's comment "eval()/exec()/arbitrary expressions/shell" merely
        documents what's forbidden) when an earlier draft of this check used a text/regex
        scan instead of an AST walk."""
        result = _check(good='''
"""Rules must be hard-coded (no eval()/exec()/arbitrary expressions/shell)."""

def apply_rule(x):
    return x * 2
''')
        self.assertEqual(result.status, "PASS", result.detail)

    def test_docstring_mentioning_shell_true_is_not_a_violation(self):
        """Regression test: this exact false positive occurred on the real
        subtitle-skill source (engine.py's module docstring "no shell=True, no
        user-controlled executable" documents the safety property, it doesn't violate
        it) when an earlier draft of this check used a text/regex scan."""
        result = _check(good='''
"""subtitle-skill never builds a shell command line (no shell=True, no
user-controlled executable)."""

def f():
    return 1
''')
        self.assertEqual(result.status, "PASS", result.detail)

    def test_unparseable_file_is_reported_not_crashed_on(self):
        result = _check(broken="def f(:\n    this is not python\n")
        self.assertEqual(result.status, "FAIL")
        self.assertIn("could not parse", result.detail)

    def test_tests_directory_is_excluded_by_default(self):
        with tempfile.TemporaryDirectory(prefix="registry_shellout_") as tmp:
            (Path(tmp) / "good.py").write_text("x = 1\n", encoding="utf-8")
            tests_dir = Path(tmp) / "tests"
            tests_dir.mkdir()
            (tests_dir / "test_security.py").write_text("import os\ndef f(c):\n    os.system(c)\n", encoding="utf-8")
            result = check_no_unsafe_shell_out(source_dir=tmp)
            self.assertEqual(result.status, "PASS", result.detail)

    def test_exclude_dir_names_empty_tuple_checks_everything_including_tests(self):
        with tempfile.TemporaryDirectory(prefix="registry_shellout_") as tmp:
            (Path(tmp) / "good.py").write_text("x = 1\n", encoding="utf-8")
            tests_dir = Path(tmp) / "tests"
            tests_dir.mkdir()
            (tests_dir / "test_security.py").write_text("import os\ndef f(c):\n    os.system(c)\n", encoding="utf-8")
            result = check_no_unsafe_shell_out(source_dir=tmp, exclude_dir_names=())
            self.assertEqual(result.status, "FAIL", result.detail)


if __name__ == "__main__":
    unittest.main(verbosity=2)
