"""Tests for scripts/spec_mode_classifier.py (F-002 core)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from spec import mode_classifier as smc  # noqa: E402


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


class VagueBaselineTests(unittest.TestCase):
    """v0.5 — 한 줄 아이디어(40 words 미만) + spec 부재 → baseline-empty-vague.

    Why: researcher 에이전트가 이 분기에서 자동 소환되어야.
    """

    def test_one_sentence_idea_routes_vague(self):
        r = smc.classify(
            args=[],
            spec_exists=False,
            intent_text="Pomodoro timer app for musicians",
        )
        self.assertEqual(r.mode, smc.Mode.BASELINE)
        self.assertEqual(r.subtype, "baseline-empty-vague")

    def test_short_paragraph_still_vague(self):
        short = "Pomodoro timer for musicians. Solo practice. 25 min cycles."
        r = smc.classify(args=[], spec_exists=False, intent_text=short)
        self.assertEqual(r.subtype, "baseline-empty-vague")

    def test_empty_intent_keeps_empty_subtype(self):
        r = smc.classify(args=[], spec_exists=False, intent_text="")
        self.assertEqual(r.subtype, "baseline-empty")

    def test_long_intent_uses_empty_not_vague(self):
        long_intent = "word " * 45
        r = smc.classify(args=[], spec_exists=False, intent_text=long_intent)
        self.assertEqual(r.subtype, "baseline-empty")

    def test_plan_md_wins_over_vague(self):
        r = smc.classify(
            args=["plan.md"], spec_exists=False, intent_text="short idea"
        )
        self.assertEqual(r.subtype, "baseline-from-plan")


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
