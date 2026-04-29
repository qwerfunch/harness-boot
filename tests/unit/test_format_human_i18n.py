"""F-040 — format_human() honors lang resolution."""

from __future__ import annotations

import os
import unittest
from unittest import mock

from legacy.scripts.work import WorkResult, format_human


def _result(action: str = "activated") -> WorkResult:
    return WorkResult(
        feature_id="F-100",
        action=action,
        current_status="in_progress",
        gates_passed=["gate_0"],
        gates_failed=[],
        evidence_count=2,
        routed_agents=["software-engineer", "reviewer"],
    )


class TestFormatHumanEnglishDefault(unittest.TestCase):
    def setUp(self) -> None:
        self._patcher = mock.patch.dict(os.environ, {}, clear=True)
        self._patcher.start()

    def tearDown(self) -> None:
        self._patcher.stop()

    def test_status_label_english(self) -> None:
        text = format_human(_result())
        self.assertIn("status:", text)
        self.assertNotIn("상태:", text)

    def test_evidence_label_english(self) -> None:
        text = format_human(_result())
        self.assertIn("evidence: 2 entries", text)

    def test_routed_agents_label_english(self) -> None:
        text = format_human(_result())
        self.assertIn("routed agents:", text)
        self.assertNotIn("라우팅된 팀:", text)


class TestFormatHumanKorean(unittest.TestCase):
    def setUp(self) -> None:
        self._patcher = mock.patch.dict(os.environ, {"HARNESS_LANG": "ko"}, clear=True)
        self._patcher.start()

    def tearDown(self) -> None:
        self._patcher.stop()

    def test_status_label_korean(self) -> None:
        text = format_human(_result())
        self.assertIn("상태:", text)
        self.assertNotIn("status:", text)

    def test_passed_label_korean(self) -> None:
        text = format_human(_result())
        self.assertIn("통과:", text)

    def test_evidence_label_korean(self) -> None:
        text = format_human(_result())
        self.assertIn("근거: 2 개", text)

    def test_routed_agents_label_korean(self) -> None:
        text = format_human(_result())
        self.assertIn("라우팅된 팀:", text)


class TestFormatHumanRegressionForNonActivate(unittest.TestCase):
    def test_gate_recorded_omits_routed_label_in_both_langs(self) -> None:
        with mock.patch.dict(os.environ, {"HARNESS_LANG": "ko"}, clear=True):
            text_ko = format_human(_result(action="gate_recorded"))
            self.assertNotIn("라우팅된 팀:", text_ko)
        with mock.patch.dict(os.environ, {"HARNESS_LANG": "en"}, clear=True):
            text_en = format_human(_result(action="gate_recorded"))
            self.assertNotIn("routed agents:", text_en)


if __name__ == "__main__":
    unittest.main()
