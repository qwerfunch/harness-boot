"""F-034 — pre-commit-phase2.sh + install_pre_commit.py contract tests.

5 hook 분기 + installer safety. Uses tempdir + git init for realistic
staged-file scenarios.
"""

from __future__ import annotations

import os
import shutil
import stat
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[2]
HOOK = REPO_ROOT / "hooks" / "pre-commit-phase2.sh"
INSTALLER = REPO_ROOT / "legacy" / "scripts" / "install_pre_commit.py"


def _git(args: list[str], cwd: Path) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    env.update(
        {
            "GIT_AUTHOR_NAME": "test",
            "GIT_AUTHOR_EMAIL": "t@example.com",
            "GIT_COMMITTER_NAME": "test",
            "GIT_COMMITTER_EMAIL": "t@example.com",
        }
    )
    return subprocess.run(
        ["git"] + args, cwd=cwd, capture_output=True, text=True, timeout=15, env=env
    )


def _setup_repo_with_state(tmp: Path, *, active: str | None = None) -> None:
    """Initialize a git repo + .harness/state.yaml (active feature optional)."""
    _git(["init", "-b", "main"], tmp)
    (tmp / ".harness").mkdir()
    state = {
        "version": "2.3",
        "schema_version": "2.3",
        "session": {"active_feature_id": active},
        "features": [],
    }
    (tmp / ".harness" / "state.yaml").write_text(
        yaml.dump(state, allow_unicode=True, sort_keys=False), encoding="utf-8"
    )


def _run_hook(tmp: Path, env_extra: dict[str, str] | None = None) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    if env_extra:
        env.update(env_extra)
    return subprocess.run(
        ["bash", str(HOOK)], cwd=tmp, capture_output=True, text=True, timeout=10, env=env
    )


class HookExistsTests(unittest.TestCase):
    def test_script_exists(self):
        self.assertTrue(HOOK.is_file())

    def test_script_executable(self):
        self.assertTrue(HOOK.stat().st_mode & stat.S_IXUSR)


class HookBranchTests(unittest.TestCase):
    """5 분기 contract."""

    def test_no_harness_dir_silent_pass(self):
        """분기 1: .harness/state.yaml 부재 → exit 0 silent."""
        with tempfile.TemporaryDirectory() as tmp:
            tp = Path(tmp)
            _git(["init", "-b", "main"], tp)
            r = _run_hook(tp)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertEqual(r.stdout, "")

    def test_env_bypass(self):
        """분기 2: HARNESS_BYPASS_PRE_COMMIT=1 → exit 0."""
        with tempfile.TemporaryDirectory() as tmp:
            tp = Path(tmp)
            _setup_repo_with_state(tp, active=None)
            (tp / "src.py").write_text("x = 1\n", encoding="utf-8")
            _git(["add", "src.py"], tp)
            r = _run_hook(tp, env_extra={"HARNESS_BYPASS_PRE_COMMIT": "1"})
            self.assertEqual(r.returncode, 0, r.stderr)

    def test_whitelist_only_passes(self):
        """분기 3: state.yaml + CHANGELOG.md + _workspace/ 만 staged → exit 0."""
        with tempfile.TemporaryDirectory() as tmp:
            tp = Path(tmp)
            _setup_repo_with_state(tp, active=None)
            (tp / "CHANGELOG.md").write_text("## changes\n", encoding="utf-8")
            (tp / ".harness" / "_workspace").mkdir(parents=True, exist_ok=True)
            (tp / ".harness" / "_workspace" / "issues-log.md").write_text("# log\n", encoding="utf-8")
            _git(["add", ".harness/state.yaml", "CHANGELOG.md", ".harness/_workspace/issues-log.md"], tp)
            r = _run_hook(tp)
            self.assertEqual(r.returncode, 0, r.stderr)

    def test_non_whitelisted_no_active_rejects(self):
        """분기 4: 코드 staged + active 없음 → exit 1 + 안내."""
        with tempfile.TemporaryDirectory() as tmp:
            tp = Path(tmp)
            _setup_repo_with_state(tp, active=None)
            (tp / "src.py").write_text("y = 2\n", encoding="utf-8")
            _git(["add", "src.py"], tp)
            r = _run_hook(tp)
            self.assertEqual(r.returncode, 1)
            self.assertIn("no active feature", r.stderr)
            self.assertIn("HARNESS_BYPASS_PRE_COMMIT", r.stderr)
            self.assertIn("--no-verify", r.stderr)

    def test_non_whitelisted_with_active_passes(self):
        """분기 5: 코드 staged + active 있음 → exit 0."""
        with tempfile.TemporaryDirectory() as tmp:
            tp = Path(tmp)
            _setup_repo_with_state(tp, active="F-034")
            (tp / "src.py").write_text("z = 3\n", encoding="utf-8")
            _git(["add", "src.py"], tp)
            r = _run_hook(tp)
            self.assertEqual(r.returncode, 0, r.stderr)


class InstallerTests(unittest.TestCase):
    """installer CLI: install / uninstall / status + safety."""

    def _run(self, args: list[str], cwd: Path) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(INSTALLER)] + args + ["--repo-root", str(cwd)],
            capture_output=True,
            text=True,
            timeout=10,
        )

    def test_status_when_not_installed(self):
        with tempfile.TemporaryDirectory() as tmp:
            tp = Path(tmp)
            _git(["init", "-b", "main"], tp)
            r = self._run(["--status"], tp)
            self.assertEqual(r.returncode, 0)
            self.assertIn("not installed", r.stdout)

    def test_install_creates_hook(self):
        with tempfile.TemporaryDirectory() as tmp:
            tp = Path(tmp)
            _git(["init", "-b", "main"], tp)
            r = self._run(["--install"], tp)
            self.assertEqual(r.returncode, 0, r.stderr)
            hook = tp / ".git" / "hooks" / "pre-commit"
            self.assertTrue(hook.is_file())
            self.assertTrue(hook.stat().st_mode & stat.S_IXUSR)
            self.assertIn("F-034", hook.read_text(encoding="utf-8"))

    def test_install_preserves_existing_non_harness_hook(self):
        with tempfile.TemporaryDirectory() as tmp:
            tp = Path(tmp)
            _git(["init", "-b", "main"], tp)
            existing = tp / ".git" / "hooks" / "pre-commit"
            existing.parent.mkdir(parents=True, exist_ok=True)
            existing.write_text("#!/bin/sh\necho 'user hook'\n", encoding="utf-8")
            r = self._run(["--install"], tp)
            self.assertEqual(r.returncode, 1, "should refuse to overwrite")
            self.assertIn("--force", r.stderr)
            # Existing hook untouched.
            self.assertIn("user hook", existing.read_text(encoding="utf-8"))

    def test_install_force_overwrites(self):
        with tempfile.TemporaryDirectory() as tmp:
            tp = Path(tmp)
            _git(["init", "-b", "main"], tp)
            existing = tp / ".git" / "hooks" / "pre-commit"
            existing.parent.mkdir(parents=True, exist_ok=True)
            existing.write_text("#!/bin/sh\necho old\n", encoding="utf-8")
            r = self._run(["--install", "--force"], tp)
            self.assertEqual(r.returncode, 0)
            self.assertIn("F-034", existing.read_text(encoding="utf-8"))

    def test_uninstall_only_removes_harness_hook(self):
        with tempfile.TemporaryDirectory() as tmp:
            tp = Path(tmp)
            _git(["init", "-b", "main"], tp)
            # Install, then uninstall should remove cleanly.
            self._run(["--install"], tp)
            r = self._run(["--uninstall"], tp)
            self.assertEqual(r.returncode, 0)
            self.assertFalse((tp / ".git" / "hooks" / "pre-commit").exists())

    def test_uninstall_refuses_non_harness_hook(self):
        with tempfile.TemporaryDirectory() as tmp:
            tp = Path(tmp)
            _git(["init", "-b", "main"], tp)
            hook = tp / ".git" / "hooks" / "pre-commit"
            hook.parent.mkdir(parents=True, exist_ok=True)
            hook.write_text("#!/bin/sh\necho user\n", encoding="utf-8")
            r = self._run(["--uninstall"], tp)
            self.assertEqual(r.returncode, 1)
            self.assertIn("not harness-boot", r.stderr)
            self.assertTrue(hook.exists(), "must not delete user hook")


if __name__ == "__main__":
    unittest.main()
