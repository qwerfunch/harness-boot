"""F-040 — dashboard render() honors lang resolution."""

from __future__ import annotations

import os
import unittest
from unittest import mock

from scripts.ui.dashboard import render


def _state(active: str = "F-100") -> dict:
    return {
        "session": {"active_feature_id": active, "last_command": None},
        "features": [
            {
                "id": active,
                "status": "in_progress",
                "gates": {},
                "evidence": [{"ts": "x", "kind": "test", "summary": "y"}],
                "started_at": None,
                "completed_at": None,
            }
        ],
    }


def _spec() -> dict:
    return {
        "version": "2.3",
        "project": {"name": "demo", "summary": "x", "vision": ""},
        "domain": {"overview": "", "entities": [], "business_rules": []},
        "constraints": {"tech_stack": {}},
        "deliverable": {"type": "library", "entry_points": [], "smoke_scenarios": []},
        "features": [
            {
                "id": "F-0",
                "type": "skeleton",
                "title": "skel",
                "priority": "P0",
                "test_strategy": "lean-tdd",
                "acceptance_criteria": [],
                "modules": [],
            },
            {
                "id": "F-100",
                "type": "feature",
                "name": "demo feature",
                "priority": "P1",
                "test_strategy": "tdd",
                "acceptance_criteria": ["AC-1: x"],
                "modules": [],
            },
        ],
    }


class TestDashboardEnglish(unittest.TestCase):
    def setUp(self) -> None:
        self._patcher = mock.patch.dict(os.environ, {}, clear=True)
        self._patcher.start()

    def tearDown(self) -> None:
        self._patcher.stop()

    def test_progress_line_in_english(self) -> None:
        text = render(_state(), spec=_spec(), suggestions=[])
        self.assertIn("progress:", text)
        self.assertIn("evidence", text.lower())

    def test_active_label_in_english(self) -> None:
        text = render(_state(), spec=_spec(), suggestions=[])
        self.assertIn("working on:", text)


class TestDashboardKorean(unittest.TestCase):
    def setUp(self) -> None:
        self._patcher = mock.patch.dict(os.environ, {"HARNESS_LANG": "ko"}, clear=True)
        self._patcher.start()

    def tearDown(self) -> None:
        self._patcher.stop()

    def test_progress_line_in_korean(self) -> None:
        text = render(_state(), spec=_spec(), suggestions=[])
        self.assertIn("진행:", text)
        self.assertIn("근거", text)

    def test_active_label_in_korean(self) -> None:
        text = render(_state(), spec=_spec(), suggestions=[])
        self.assertIn("작업 중:", text)


if __name__ == "__main__":
    unittest.main()
