"""commands/spec.md prose contract — F-002 Modes A/R/B-2 LLM-driven flow validation (v0.4+)."""

from __future__ import annotations

import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SPEC_MD = REPO_ROOT / "commands" / "spec.md"


def _load() -> str:
    return SPEC_MD.read_text(encoding="utf-8")


class SpecModeContractTests(unittest.TestCase):
    """F-002 AC-3: 각 mode 가 결정론적 분기 + Approval checkpoint 명시."""

    @classmethod
    def setUpClass(cls):
        cls.body = _load()

    def test_all_four_modes_documented(self):
        """Modes B · A · R · E 각각 전용 섹션 존재."""
        for mode_header in (
            "## Mode B — Baseline",
            "## Mode A — Addition",
            "## Mode R — Refine",
            "## Mode E — Explain",
        ):
            self.assertIn(mode_header, self.body, f"missing section: {mode_header}")

    def test_each_mutating_mode_has_activation_trigger(self):
        """Mode A · R · B-2 각각 'Activation trigger' 명시 (F-002 AC: 결정론 분기)."""
        # Split by mode headers
        for anchor in ("## Mode A", "## Mode R", "### B-2:"):
            idx = self.body.find(anchor)
            self.assertGreater(idx, 0, f"missing anchor: {anchor}")
            # Within 1500 chars after anchor, Activation trigger must appear
            slice_ = self.body[idx : idx + 1500]
            self.assertIn(
                "Activation trigger",
                slice_,
                f"{anchor}: Activation trigger absent in section",
            )

    def test_each_mutating_mode_has_approval_checkpoint(self):
        """Mode A · R · B-2 모두 Approval checkpoint 섹션 존재 (Edit 전 사용자 승인 강제)."""
        for anchor in ("## Mode A", "## Mode R", "### B-2:"):
            idx = self.body.find(anchor)
            slice_ = self.body[idx : idx + 3000]
            self.assertIn(
                "Approval checkpoint",
                slice_,
                f"{anchor}: Approval checkpoint absent",
            )

    def test_mode_e_has_cqs_enforcement(self):
        """Mode E 섹션에 CQS 엄수 · mtime 불변 문구."""
        idx = self.body.find("## Mode E")
        self.assertGreater(idx, 0)
        slice_ = self.body[idx : idx + 2000]
        # 필수 문구 3 종
        self.assertIn("CQS", slice_)
        self.assertIn("mtime", slice_.lower())
        self.assertRegex(slice_, r"Edit.*금지|금지.*Edit|Edit.*호출.*금지")

    def test_dry_run_semantics_defined(self):
        """--dry-run 이 Approval checkpoint 를 자동 '3 · 취소' 로 처리."""
        self.assertIn("--dry-run", self.body)
        # dry-run 과 취소 관련 설명이 같은 문장 근처에 있어야
        dry_run_idx = self.body.find("--dry-run")
        while dry_run_idx != -1:
            nearby = self.body[max(0, dry_run_idx - 100) : dry_run_idx + 200]
            if "취소" in nearby or "cancel" in nearby.lower() or "생략" in nearby:
                return
            dry_run_idx = self.body.find("--dry-run", dry_run_idx + 1)
        self.fail("--dry-run semantics (취소/생략) 명시 부재")

    def test_mode_classifier_invocation_documented(self):
        """Python 스크립트 spec_mode_classifier.py 가 분기 도구로 명시."""
        self.assertIn("spec_mode_classifier.py", self.body)

    def test_mode_e_script_invocation_documented(self):
        """scripts/explain_spec.py 호출 경로 명시."""
        self.assertIn("explain_spec.py", self.body)

    def test_mode_ar_diff_script_documented(self):
        """Mode A/R 이 spec_diff.py 로 diff 렌더."""
        self.assertIn("spec_diff.py", self.body)


class PreambleContractTests(unittest.TestCase):
    """BR-014: Preamble 3 줄 + Anti-rationalization 2 행."""

    @classmethod
    def setUpClass(cls):
        cls.body = _load()

    def test_preamble_section_exists(self):
        self.assertIn("## Preamble", self.body)

    def test_preamble_anti_rationalization_lines(self):
        """'NO skip:' 과 'NO shortcut:' 둘 다 Preamble 안에 존재."""
        preamble_idx = self.body.find("## Preamble")
        next_section = self.body.find("\n## ", preamble_idx + 10)
        preamble = self.body[preamble_idx:next_section]
        self.assertIn("NO skip:", preamble)
        self.assertIn("NO shortcut:", preamble)


class ShippedStatusTests(unittest.TestCase):
    """v0.4 구현 상태 섹션이 정직하게 구성."""

    @classmethod
    def setUpClass(cls):
        cls.body = _load()

    def test_shipped_section_header_current(self):
        """'v0.2 구현 상태' 가 아니라 'v0.4 구현 상태' 로 최신 반영."""
        self.assertIn("v0.4 구현 상태", self.body)
        self.assertNotIn("## v0.2 구현 상태", self.body)

    def test_shipped_section_lists_prose_contract(self):
        """prose contract 라는 개념이 명시됨 (LLM 흐름의 신뢰 근거)."""
        self.assertIn("prose contract", self.body)


if __name__ == "__main__":
    unittest.main()
