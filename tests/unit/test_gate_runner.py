"""Tests for scripts/gate_runner.py (v0.3.1 Phase 1 Gate 0 runner)."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import gate_runner as gr  # noqa: E402


class TailTests(unittest.TestCase):
    def test_short_text_passthrough(self):
        self.assertEqual(gr._tail("a\nb\n"), "a\nb")

    def test_long_text_truncated(self):
        lines = [f"line{i}" for i in range(100)]
        out = gr._tail("\n".join(lines), n_lines=10)
        self.assertIn("earlier output elided", out)
        self.assertIn("line99", out)
        self.assertNotIn("line0\n", out)

    def test_empty_text(self):
        self.assertEqual(gr._tail(""), "")


class ScratchProjectMixin:
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)

    def tearDown(self) -> None:
        self._tmp.cleanup()


class DetectCommandTests(ScratchProjectMixin, unittest.TestCase):
    def test_no_detectable_command(self):
        self.assertIsNone(gr.detect_gate_0_command(self.root))

    def test_tests_dir_with_unittest_fallback(self):
        (self.root / "tests").mkdir()
        import shutil
        original = shutil.which
        # pytest 없는 척
        shutil.which = lambda cmd: None if cmd == "pytest" else original(cmd)
        try:
            cmd = gr.detect_gate_0_command(self.root)
        finally:
            shutil.which = original
        self.assertIsNotNone(cmd)
        self.assertIn("unittest", cmd)

    def test_npm_test_detected(self):
        (self.root / "package.json").write_text(
            json.dumps({"name": "x", "scripts": {"test": "jest"}}), encoding="utf-8"
        )
        import shutil
        original = shutil.which
        shutil.which = lambda cmd: "/fake/" + cmd if cmd in ("npm",) else None
        try:
            cmd = gr.detect_gate_0_command(self.root)
        finally:
            shutil.which = original
        self.assertEqual(cmd, ["npm", "test"])

    def test_makefile_test_target(self):
        (self.root / "Makefile").write_text("test:\n\t@echo run\n", encoding="utf-8")
        import shutil
        original = shutil.which
        shutil.which = lambda cmd: "/fake/" + cmd if cmd == "make" else None
        try:
            cmd = gr.detect_gate_0_command(self.root)
        finally:
            shutil.which = original
        self.assertEqual(cmd, ["make", "test"])


class OverrideTests(ScratchProjectMixin, unittest.TestCase):
    def test_harness_yaml_override(self):
        harness = self.root / ".harness"
        harness.mkdir()
        (harness / "harness.yaml").write_text(
            "gate_commands:\n  gate_0: echo ok\n", encoding="utf-8"
        )
        cmd = gr._harness_yaml_override(harness, "gate_0")
        self.assertEqual(cmd, ["echo", "ok"])

    def test_override_as_list(self):
        harness = self.root / ".harness"
        harness.mkdir()
        (harness / "harness.yaml").write_text(
            "gate_commands:\n  gate_0:\n    - pytest\n    - tests/unit\n",
            encoding="utf-8",
        )
        cmd = gr._harness_yaml_override(harness, "gate_0")
        self.assertEqual(cmd, ["pytest", "tests/unit"])

    def test_missing_harness_yaml(self):
        self.assertIsNone(gr._harness_yaml_override(self.root, "gate_0"))


class RunGate0Tests(ScratchProjectMixin, unittest.TestCase):
    def test_skipped_when_no_command(self):
        res = gr.run_gate_0(self.root)
        self.assertEqual(res.result, "skipped")
        self.assertIn("no test command detected", res.reason)

    def test_pass_with_override(self):
        res = gr.run_gate_0(self.root, override_command=["true"])
        self.assertEqual(res.result, "pass")
        self.assertEqual(res.exit_code, 0)

    def test_fail_with_override(self):
        res = gr.run_gate_0(self.root, override_command=["false"])
        self.assertEqual(res.result, "fail")
        self.assertEqual(res.exit_code, 1)

    def test_skipped_command_not_found(self):
        res = gr.run_gate_0(self.root, override_command=["__definitely_not_a_binary_99__"])
        self.assertEqual(res.result, "skipped")
        self.assertIn("not found", res.reason)

    def test_timeout(self):
        # `python -c "import time; time.sleep(5)"` 를 1초 timeout 으로
        res = gr.run_gate_0(
            self.root,
            override_command=[sys.executable, "-c", "import time; time.sleep(5)"],
            timeout_sec=1,
        )
        self.assertEqual(res.result, "fail")
        self.assertIn("timeout", res.reason)

    def test_stdout_tail_captured(self):
        res = gr.run_gate_0(
            self.root, override_command=[sys.executable, "-c", "print('hello world')"]
        )
        self.assertIn("hello world", res.stdout_tail)


class DispatchTests(ScratchProjectMixin, unittest.TestCase):
    def test_dispatch_gate_0(self):
        res = gr.run_gate("gate_0", self.root, override_command=["true"])
        self.assertEqual(res.result, "pass")

    def test_dispatch_gate_1(self):
        res = gr.run_gate("gate_1", self.root, override_command=["true"])
        self.assertEqual(res.result, "pass")

    def test_dispatch_gate_2(self):
        res = gr.run_gate("gate_2", self.root, override_command=["true"])
        self.assertEqual(res.result, "pass")

    def test_dispatch_unsupported_gate_skipped(self):
        res = gr.run_gate("gate_3", self.root)
        self.assertEqual(res.result, "skipped")
        self.assertIn("not yet supported", res.reason)


class DetectGate1Tests(ScratchProjectMixin, unittest.TestCase):
    def test_pyproject_with_mypy(self):
        (self.root / "pyproject.toml").write_text("[project]\nname = 'x'\n", encoding="utf-8")
        import shutil
        original = shutil.which
        shutil.which = lambda cmd: "/fake/mypy" if cmd == "mypy" else None
        try:
            cmd = gr.detect_gate_1_command(self.root)
        finally:
            shutil.which = original
        self.assertEqual(cmd, ["mypy", "--no-incremental", "."])

    def test_pyproject_falls_back_to_pyright(self):
        (self.root / "pyproject.toml").write_text("[project]\nname = 'x'\n", encoding="utf-8")
        import shutil
        original = shutil.which
        shutil.which = lambda cmd: "/fake/pyright" if cmd == "pyright" else None
        try:
            cmd = gr.detect_gate_1_command(self.root)
        finally:
            shutil.which = original
        self.assertEqual(cmd, ["pyright"])

    def test_tsconfig_with_tsc(self):
        (self.root / "tsconfig.json").write_text("{}", encoding="utf-8")
        import shutil
        original = shutil.which
        shutil.which = lambda cmd: "/fake/tsc" if cmd == "tsc" else None
        try:
            cmd = gr.detect_gate_1_command(self.root)
        finally:
            shutil.which = original
        self.assertEqual(cmd, ["tsc", "--noEmit"])

    def test_cargo_detected(self):
        (self.root / "Cargo.toml").write_text("[package]\nname = 'x'\n", encoding="utf-8")
        import shutil
        original = shutil.which
        shutil.which = lambda cmd: "/fake/cargo" if cmd == "cargo" else None
        try:
            cmd = gr.detect_gate_1_command(self.root)
        finally:
            shutil.which = original
        self.assertEqual(cmd, ["cargo", "check"])

    def test_gomod_detected(self):
        (self.root / "go.mod").write_text("module x\n", encoding="utf-8")
        import shutil
        original = shutil.which
        shutil.which = lambda cmd: "/fake/go" if cmd == "go" else None
        try:
            cmd = gr.detect_gate_1_command(self.root)
        finally:
            shutil.which = original
        self.assertEqual(cmd, ["go", "vet", "./..."])

    def test_no_language_detected(self):
        # 빈 프로젝트 → None
        self.assertIsNone(gr.detect_gate_1_command(self.root))


class RunGate1Tests(ScratchProjectMixin, unittest.TestCase):
    def test_pass_with_override(self):
        res = gr.run_gate_1(self.root, override_command=["true"])
        self.assertEqual(res.result, "pass")
        self.assertEqual(res.gate, "gate_1")

    def test_fail_with_override(self):
        res = gr.run_gate_1(self.root, override_command=["false"])
        self.assertEqual(res.result, "fail")

    def test_skipped_when_no_detector(self):
        res = gr.run_gate_1(self.root)
        self.assertEqual(res.result, "skipped")
        self.assertIn("no type checker", res.reason)


class DetectGate2Tests(ScratchProjectMixin, unittest.TestCase):
    def _with_which(self, which_map: dict):
        import shutil
        original = shutil.which
        shutil.which = lambda cmd: which_map.get(cmd)
        return original

    def _restore_which(self, original):
        import shutil
        shutil.which = original

    def test_pyproject_with_ruff(self):
        (self.root / "pyproject.toml").write_text("[project]\nname = 'x'\n", encoding="utf-8")
        orig = self._with_which({"ruff": "/fake/ruff"})
        try:
            cmd = gr.detect_gate_2_command(self.root)
        finally:
            self._restore_which(orig)
        self.assertEqual(cmd, ["ruff", "check", "."])

    def test_pyproject_falls_back_to_flake8(self):
        (self.root / "pyproject.toml").write_text("[project]\nname = 'x'\n", encoding="utf-8")
        orig = self._with_which({"flake8": "/fake/flake8"})
        try:
            cmd = gr.detect_gate_2_command(self.root)
        finally:
            self._restore_which(orig)
        self.assertEqual(cmd, ["flake8"])

    def test_package_json_with_eslint(self):
        (self.root / "package.json").write_text("{}", encoding="utf-8")
        orig = self._with_which({"eslint": "/fake/eslint"})
        try:
            cmd = gr.detect_gate_2_command(self.root)
        finally:
            self._restore_which(orig)
        self.assertEqual(cmd, ["eslint", "."])

    def test_eslintrc_json_with_npx(self):
        (self.root / ".eslintrc.json").write_text("{}", encoding="utf-8")
        orig = self._with_which({"npx": "/fake/npx"})
        try:
            cmd = gr.detect_gate_2_command(self.root)
        finally:
            self._restore_which(orig)
        self.assertEqual(cmd, ["npx", "eslint", "."])

    def test_cargo_clippy(self):
        (self.root / "Cargo.toml").write_text("[package]\nname = 'x'\n", encoding="utf-8")
        orig = self._with_which({"cargo": "/fake/cargo"})
        try:
            cmd = gr.detect_gate_2_command(self.root)
        finally:
            self._restore_which(orig)
        self.assertEqual(cmd, ["cargo", "clippy", "--all-targets", "--", "-D", "warnings"])

    def test_golangci_lint(self):
        (self.root / "go.mod").write_text("module x\n", encoding="utf-8")
        orig = self._with_which({"golangci-lint": "/fake/golangci-lint"})
        try:
            cmd = gr.detect_gate_2_command(self.root)
        finally:
            self._restore_which(orig)
        self.assertEqual(cmd, ["golangci-lint", "run"])

    def test_no_linter(self):
        self.assertIsNone(gr.detect_gate_2_command(self.root))


class RunGate2Tests(ScratchProjectMixin, unittest.TestCase):
    def test_pass_with_override(self):
        res = gr.run_gate_2(self.root, override_command=["true"])
        self.assertEqual(res.result, "pass")
        self.assertEqual(res.gate, "gate_2")

    def test_fail_with_override(self):
        res = gr.run_gate_2(self.root, override_command=["false"])
        self.assertEqual(res.result, "fail")

    def test_skipped_when_no_detector(self):
        res = gr.run_gate_2(self.root)
        self.assertEqual(res.result, "skipped")
        self.assertIn("no linter", res.reason)


class AsDictTests(unittest.TestCase):
    def test_as_dict_round_trips(self):
        r = gr.GateRunResult(gate="gate_0", result="pass", duration_sec=1.234567)
        d = r.as_dict()
        self.assertEqual(d["result"], "pass")
        self.assertEqual(d["duration_sec"], 1.235)  # rounded to 3


if __name__ == "__main__":
    unittest.main()
