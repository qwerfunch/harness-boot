"""Self-dogfood test — ensure scripts/self_check.sh passes on this repo (v0.3.10+).

이 테스트는 harness-boot 자체가 자기 스크립트를 돌려 무결성을 유지하는지 검증.
사용자 환경 안전 방어: self_check.sh 부재 시 skip (플러그인 설치본에서 실행 시 등).
"""

from __future__ import annotations

import shutil
import subprocess
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SELF_CHECK = REPO_ROOT / "scripts" / "self_check.sh"


class SelfCheckTests(unittest.TestCase):
    def test_self_check_passes(self):
        """scripts/self_check.sh exit 0 — 자체 도그푸드 5 단계 전부 green."""
        if not SELF_CHECK.is_file():
            self.skipTest(f"self_check.sh not found at {SELF_CHECK} — 플러그인 설치본일 가능성")
        if shutil.which("bash") is None:
            self.skipTest("bash 바이너리 부재 — self_check 실행 불가")

        result = subprocess.run(
            ["bash", str(SELF_CHECK)],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=120,
        )
        self.assertEqual(
            result.returncode,
            0,
            msg=(
                f"self_check.sh failed (exit {result.returncode}).\n"
                f"--- stdout ---\n{result.stdout}\n"
                f"--- stderr ---\n{result.stderr}"
            ),
        )


if __name__ == "__main__":
    unittest.main()
