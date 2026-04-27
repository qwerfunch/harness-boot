"""F-039 — dashboard `agent chain:` line surfaces ∥ groups."""

from __future__ import annotations

import unittest

from scripts.ui.dashboard import render


def _spec(*, ui_present: bool = False, has_audio: bool = False) -> dict:
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
                "id": "F-400",
                "type": "feature",
                "name": "demo feature",
                "priority": "P1",
                "test_strategy": "tdd",
                "acceptance_criteria": ["AC-1: x"],
                "modules": [],
                "ui_surface": {"present": ui_present, "has_audio": has_audio},
            },
        ],
    }


def _state(active: str = "F-400") -> dict:
    return {
        "session": {"active_feature_id": active, "last_command": None},
        "features": [
            {
                "id": active,
                "status": "in_progress",
                "gates": {},
                "evidence": [],
                "started_at": None,
                "completed_at": None,
            }
        ],
    }


class TestDashboardParallelChain(unittest.TestCase):
    def test_ui_with_audio_renders_parallel_pair(self) -> None:
        text = render(_state(), spec=_spec(ui_present=True, has_audio=True), suggestions=[])
        self.assertIn("agent chain:", text)
        self.assertIn("(visual-designer ∥ audio-designer)", text)

    def test_pure_domain_uses_comma_join_no_parallel_token(self) -> None:
        text = render(_state(), spec=_spec(ui_present=False), suggestions=[])
        self.assertIn("agent chain:", text)
        self.assertNotIn("∥", text)
        self.assertIn("backend-engineer", text)

    def test_ui_without_audio_no_parallel_token(self) -> None:
        text = render(_state(), spec=_spec(ui_present=True, has_audio=False), suggestions=[])
        # Single-member visual-designer group is dropped → plain chain
        self.assertNotIn("∥", text)


if __name__ == "__main__":
    unittest.main()
