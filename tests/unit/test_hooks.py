"""Plugin-shipped hook + opt-in templates — structure, fail-open, pipe-test (F-024 + F-014)."""

from __future__ import annotations

import json
import os
import stat
import subprocess
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_DIR = REPO_ROOT / "hooks"
TEMPLATES_DIR = REPO_ROOT / "docs" / "templates" / "hooks"

_TEMPLATE_HOOKS = {
    "security-gate.sh",
    "format.sh",
    "doc-sync-check.sh",
    "test-runner.sh",
    "coverage-gate.sh",
}


class HooksInfraTests(unittest.TestCase):
    """F-024: hooks/ at plugin root with hooks.json."""

    def test_hooks_dir_exists(self):
        self.assertTrue(HOOKS_DIR.is_dir())

    def test_hooks_json_valid_and_has_session_start(self):
        path = HOOKS_DIR / "hooks.json"
        self.assertTrue(path.is_file())
        data = json.loads(path.read_text(encoding="utf-8"))
        self.assertIn("hooks", data)
        self.assertIn("SessionStart", data["hooks"])

    def test_session_bootstrap_script_exists_and_executable(self):
        path = HOOKS_DIR / "session-bootstrap.sh"
        self.assertTrue(path.is_file())
        self.assertTrue(path.stat().st_mode & stat.S_IXUSR, "session-bootstrap.sh not executable")

    def test_session_bootstrap_first_line_is_shebang(self):
        path = HOOKS_DIR / "session-bootstrap.sh"
        first = path.read_text(encoding="utf-8").splitlines()[0]
        self.assertTrue(first.startswith("#!"), f"missing shebang: {first}")

    def test_session_bootstrap_exits_zero_outside_harness(self):
        """F-014 AC-2: fail-open. Even without .harness/, hook must exit 0."""
        result = subprocess.run(
            ["bash", str(HOOKS_DIR / "session-bootstrap.sh")],
            cwd="/tmp",  # no .harness/ here
            capture_output=True,
            text=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 0, f"stderr: {result.stderr}")


class HooksTemplatesTests(unittest.TestCase):
    """F-014: docs/templates/hooks/ contains 5 opt-in templates."""

    def test_templates_dir_with_readme(self):
        self.assertTrue(TEMPLATES_DIR.is_dir())
        self.assertTrue((TEMPLATES_DIR / "README.md").is_file())

    def test_all_5_templates_shipped(self):
        shipped = {p.name for p in TEMPLATES_DIR.glob("*.sh")}
        missing = _TEMPLATE_HOOKS - shipped
        self.assertFalse(missing, f"missing templates: {missing}")

    def test_each_template_executable(self):
        for name in _TEMPLATE_HOOKS:
            path = TEMPLATES_DIR / name
            self.assertTrue(
                path.stat().st_mode & stat.S_IXUSR,
                f"{name} not executable",
            )

    def test_each_template_has_shebang(self):
        for name in _TEMPLATE_HOOKS:
            path = TEMPLATES_DIR / name
            first = path.read_text(encoding="utf-8").splitlines()[0]
            self.assertTrue(first.startswith("#!"), f"{name} missing shebang")

    def test_each_template_ends_with_exit_zero(self):
        """F-014 AC-2 fail-open: templates must end with `exit 0`."""
        for name in _TEMPLATE_HOOKS:
            path = TEMPLATES_DIR / name
            lines = [l.strip() for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
            self.assertEqual(lines[-1], "exit 0", f"{name} doesn't end with 'exit 0'")


class PipeTestTests(unittest.TestCase):
    """Live pipe-test: send JSON stdin, verify exit 0 (fail-open)."""

    def _run(self, template: str, payload: dict) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["bash", str(TEMPLATES_DIR / template)],
            input=json.dumps(payload),
            cwd="/tmp",  # neutral cwd
            capture_output=True,
            text=True,
            timeout=10,
        )

    def test_security_gate_safe_command_no_warn(self):
        result = self._run("security-gate.sh", {"tool_name": "Bash", "tool_input": {"command": "ls /tmp"}})
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stderr, "")

    def test_security_gate_rm_rf_tmp_is_safe(self):
        """rm -rf /tmp/foo is safe (bounded path). Must NOT warn."""
        result = self._run("security-gate.sh", {"tool_name": "Bash", "tool_input": {"command": "rm -rf /tmp/foo"}})
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stderr, "", "false positive on /tmp/foo")

    def test_security_gate_rm_rf_root_warns(self):
        result = self._run("security-gate.sh", {"tool_name": "Bash", "tool_input": {"command": "rm -rf /"}})
        self.assertEqual(result.returncode, 0, "must fail-open even on dangerous")
        self.assertIn("rm -rf at filesystem root", result.stderr)

    def test_security_gate_rm_rf_home_warns(self):
        result = self._run("security-gate.sh", {"tool_name": "Bash", "tool_input": {"command": "rm -rf /home/user"}})
        self.assertEqual(result.returncode, 0)
        self.assertIn("system directory", result.stderr)

    def test_security_gate_chmod_777_warns(self):
        result = self._run("security-gate.sh", {"tool_name": "Bash", "tool_input": {"command": "chmod 777 /tmp/x"}})
        self.assertEqual(result.returncode, 0)
        self.assertIn("chmod 777", result.stderr)

    def test_format_missing_file_no_op(self):
        result = self._run("format.sh", {"tool_name": "Write", "tool_input": {"file_path": "/tmp/definitely-not-here-xyz.py"}})
        self.assertEqual(result.returncode, 0)

    def test_doc_sync_check_no_claude_md_exits_zero(self):
        result = self._run("doc-sync-check.sh", {})
        self.assertEqual(result.returncode, 0)

    def test_test_runner_missing_file_no_op(self):
        result = self._run("test-runner.sh", {"tool_name": "Edit", "tool_input": {"file_path": "/tmp/nope.py"}})
        self.assertEqual(result.returncode, 0)

    def test_coverage_gate_benign_no_warn(self):
        result = self._run("coverage-gate.sh", {"tool_name": "Bash", "tool_input": {"command": "ls"}})
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stderr, "")

    def test_coverage_gate_rm_rf_warns_but_fail_open(self):
        result = self._run("coverage-gate.sh", {"tool_name": "Bash", "tool_input": {"command": "rm -rf /foo"}})
        self.assertEqual(result.returncode, 0, "fail-open violated")
        self.assertIn("rm -rf", result.stderr)

    def test_coverage_gate_force_push_warns(self):
        result = self._run("coverage-gate.sh", {"tool_name": "Bash", "tool_input": {"command": "git push --force origin main"}})
        self.assertEqual(result.returncode, 0)
        self.assertIn("force push", result.stderr)


if __name__ == "__main__":
    unittest.main()
