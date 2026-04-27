"""F-028 — UserPromptSubmit hook (hooks/prompt-log.sh) behavior contract.

Hook is silent when .harness/ doesn't exist (most workspaces). When
.harness/ exists, it appends a JSONL entry to
.harness/_workspace/prompts/YYYY-MM.jsonl. fail-open: any error path
exits 0 with no stdout (the hook must never block the user prompt).
"""

from __future__ import annotations

import json
import os
import stat
import subprocess
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS_DIR = REPO_ROOT / "hooks"
HOOK = HOOKS_DIR / "prompt-log.sh"
HOOKS_JSON = HOOKS_DIR / "hooks.json"


class PromptLogHookExistsTests(unittest.TestCase):
    """AC-1 + AC-2: file + executable + hooks.json wiring."""

    def test_script_exists(self):
        self.assertTrue(HOOK.is_file(), f"missing: {HOOK}")

    def test_script_executable(self):
        mode = HOOK.stat().st_mode
        self.assertTrue(
            mode & stat.S_IXUSR,
            "prompt-log.sh must be user-executable (chmod +x)",
        )

    def test_hooks_json_registers_user_prompt_submit(self):
        data = json.loads(HOOKS_JSON.read_text(encoding="utf-8"))
        hooks = data.get("hooks", {})
        self.assertIn(
            "UserPromptSubmit",
            hooks,
            "hooks.json must declare UserPromptSubmit hook",
        )
        cmds = []
        for entry in hooks["UserPromptSubmit"]:
            for h in entry.get("hooks", []):
                cmds.append(h.get("command", ""))
        self.assertTrue(
            any("prompt-log.sh" in c for c in cmds),
            f"prompt-log.sh not wired in UserPromptSubmit hook: {cmds}",
        )


class PromptLogHookBehaviorTests(unittest.TestCase):
    """AC-3 + AC-1 fail-open: silent without .harness/, JSONL with .harness/."""

    def _run(self, payload: str | None, cwd: Path) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["bash", str(HOOK)],
            input=payload if payload is not None else "",
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=10,
        )

    def test_no_harness_dir_silent_exit_zero(self):
        """대부분의 워크스페이스 — .harness/ 없으면 무음 exit 0."""
        with tempfile.TemporaryDirectory() as tmp:
            r = self._run('{"user_prompt": "hello"}', Path(tmp))
            self.assertEqual(r.returncode, 0)
            self.assertEqual(r.stdout, "")

    def test_empty_stdin_silent_exit_zero(self):
        """빈 stdin 도 fail-open."""
        with tempfile.TemporaryDirectory() as tmp:
            r = self._run("", Path(tmp))
            self.assertEqual(r.returncode, 0)
            self.assertEqual(r.stdout, "")

    def test_with_harness_writes_jsonl(self):
        """`.harness/` 있을 때 JSONL append."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / ".harness").mkdir()
            payload = json.dumps(
                {
                    "session_id": "sess_test",
                    "cwd": str(tmp_path),
                    "user_prompt": "안녕 한글 테스트 /harness-boot:work F-028",
                }
            )
            r = self._run(payload, tmp_path)
            self.assertEqual(r.returncode, 0, f"stderr: {r.stderr}")
            self.assertEqual(r.stdout, "", "hook must not write to stdout")

            prompts_dir = tmp_path / ".harness" / "_workspace" / "prompts"
            self.assertTrue(prompts_dir.is_dir(), "prompts dir not created")

            month = datetime.now(timezone.utc).strftime("%Y-%m")
            jsonl = prompts_dir / f"{month}.jsonl"
            self.assertTrue(jsonl.is_file(), f"missing: {jsonl}")

            lines = jsonl.read_text(encoding="utf-8").strip().splitlines()
            self.assertEqual(len(lines), 1, "exactly one JSONL entry expected")
            entry = json.loads(lines[0])
            self.assertEqual(entry["session_id"], "sess_test")
            self.assertIn("F-028", entry["prompt"])
            self.assertIn("한글", entry["prompt"], "UTF-8 must round-trip")
            self.assertIn("ts", entry)

    def test_prompt_key_fallback(self):
        """`prompt` 키 fallback (Claude Code 버전 호환)."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / ".harness").mkdir()
            payload = json.dumps(
                {"session_id": "s2", "cwd": str(tmp_path), "prompt": "fallback test"}
            )
            r = self._run(payload, tmp_path)
            self.assertEqual(r.returncode, 0)
            month = datetime.now(timezone.utc).strftime("%Y-%m")
            jsonl = tmp_path / ".harness" / "_workspace" / "prompts" / f"{month}.jsonl"
            entry = json.loads(jsonl.read_text(encoding="utf-8").strip().splitlines()[0])
            self.assertEqual(entry["prompt"], "fallback test")


if __name__ == "__main__":
    unittest.main()
