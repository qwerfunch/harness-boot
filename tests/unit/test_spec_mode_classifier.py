"""Tests for scripts/spec_mode_classifier.py (F-002 core)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import spec_mode_classifier as smc  # noqa: E402


class ExplainModeTests(unittest.TestCase):
    def test_explicit_flag(self):
        r = smc.classify(args=["--explain"], spec_exists=True)
        self.assertEqual(r.mode, smc.Mode.EXPLAIN)

    def test_intent_text_explain(self):
        r = smc.classify(args=[], spec_exists=True, intent_text="F-003 설명해줘")
        self.assertEqual(r.mode, smc.Mode.EXPLAIN)

    def test_explain_wins_even_without_spec(self):
        """spec 없어도 설명 요청이면 E (단, 빈 spec 은 실제 실행 시 에러 — 분류만)."""
        r = smc.classify(args=["--explain"], spec_exists=False)
        self.assertEqual(r.mode, smc.Mode.EXPLAIN)


class BaselineModeTests(unittest.TestCase):
    def test_empty_baseline(self):
        r = smc.classify(args=[], spec_exists=False)
        self.assertEqual(r.mode, smc.Mode.BASELINE)
        self.assertEqual(r.subtype, "baseline-empty")

    def test_plan_md_baseline(self):
        r = smc.classify(args=["plan.md"], spec_exists=False)
        self.assertEqual(r.mode, smc.Mode.BASELINE)
        self.assertEqual(r.subtype, "baseline-from-plan")

    def test_markdown_extension_also(self):
        r = smc.classify(args=["my-plan.markdown"], spec_exists=False)
        self.assertEqual(r.mode, smc.Mode.BASELINE)
        self.assertEqual(r.subtype, "baseline-from-plan")


class AdditionModeTests(unittest.TestCase):
    def test_add_intent(self):
        r = smc.classify(
            args=[], spec_exists=True, intent_text="새 피처 F-022 추가하고 싶어"
        )
        self.assertEqual(r.mode, smc.Mode.ADDITION)

    def test_add_english(self):
        r = smc.classify(args=[], spec_exists=True, intent_text="add a new entity")
        self.assertEqual(r.mode, smc.Mode.ADDITION)


class RefineModeTests(unittest.TestCase):
    def test_default_with_spec(self):
        """spec 있는데 명확한 의도 없으면 refine 기본값."""
        r = smc.classify(args=[], spec_exists=True)
        self.assertEqual(r.mode, smc.Mode.REFINE)

    def test_refine_generic_text(self):
        r = smc.classify(args=[], spec_exists=True, intent_text="F-003 의 AC 를 더 자세히")
        # add/explain 키워드 없음 → refine
        self.assertEqual(r.mode, smc.Mode.REFINE)


class ExplicitModeFlagTests(unittest.TestCase):
    def test_force_mode_A(self):
        r = smc.classify(args=["--mode", "A"], spec_exists=False)
        self.assertEqual(r.mode, smc.Mode.ADDITION)

    def test_force_mode_R(self):
        r = smc.classify(args=["--mode", "R"], spec_exists=False)
        self.assertEqual(r.mode, smc.Mode.REFINE)

    def test_unknown_mode_raises(self):
        with self.assertRaises(ValueError):
            smc.classify(args=["--mode", "Z"], spec_exists=True)

    def test_force_overrides_explain(self):
        r = smc.classify(args=["--mode", "R", "--explain"], spec_exists=True)
        self.assertEqual(r.mode, smc.Mode.REFINE)


class DeterminismTests(unittest.TestCase):
    """같은 입력 → 같은 결과 (F-002 AC)."""

    def test_idempotent_overview_input(self):
        r1 = smc.classify(args=["plan.md"], spec_exists=False)
        r2 = smc.classify(args=["plan.md"], spec_exists=False)
        self.assertEqual(r1.mode, r2.mode)
        self.assertEqual(r1.subtype, r2.subtype)

    def test_idempotent_with_intent(self):
        kwargs = {"args": [], "spec_exists": True, "intent_text": "F-001 설명해줘"}
        r1 = smc.classify(**kwargs)
        r2 = smc.classify(**kwargs)
        self.assertEqual(r1.mode, r2.mode)


if __name__ == "__main__":
    unittest.main()
