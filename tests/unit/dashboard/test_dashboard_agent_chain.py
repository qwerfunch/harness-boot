"""F-038 — dashboard surfaces routed agent chain for the active feature."""

from __future__ import annotations

import unittest

from legacy.scripts.ui.dashboard import render


def _spec(*, ui_present: bool = False) -> dict:
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
                "id": "F-300",
                "type": "feature",
                "name": "demo feature",
                "priority": "P1",
                "test_strategy": "tdd",
                "acceptance_criteria": ["AC-1: x"],
                "modules": [],
                "ui_surface": {"present": ui_present},
            },
        ],
    }


def _state_with_active(fid: str) -> dict:
    return {
        "session": {"active_feature_id": fid, "last_command": None},
        "features": [
            {
                "id": fid,
                "status": "in_progress",
                "gates": {},
                "evidence": [],
                "started_at": None,
                "completed_at": None,
            }
        ],
    }


class TestDashboardAgentChain(unittest.TestCase):
    def test_section_emitted_when_active_feature_resolves_to_agents(self) -> None:
        spec = _spec()
        state = _state_with_active("F-300")
        text = render(state, spec=spec, suggestions=[])
        self.assertIn("agent chain:", text)
        self.assertIn("software-engineer", text)

    def test_section_omitted_when_no_active_feature(self) -> None:
        spec = _spec()
        state = {"session": {"active_feature_id": None}, "features": []}
        text = render(state, spec=spec, suggestions=[])
        self.assertNotIn("agent chain:", text)

    def test_ui_chain_when_ui_surface_present(self) -> None:
        spec = _spec(ui_present=True)
        state = _state_with_active("F-300")
        text = render(state, spec=spec, suggestions=[])
        self.assertIn("agent chain:", text)
        self.assertTrue(
            any(name in text for name in ("ux-architect", "frontend-engineer", "visual-designer")),
            msg=f"expected UI agents in dashboard text, got:\n{text}",
        )


if __name__ == "__main__":
    unittest.main()
