"""F-038 — work agent routing transparency.

Asserts that ``WorkResult.routed_agents`` is populated on activate, surfaced
through ``format_human()``, and emitted in the JSON dict — while non-activate
actions continue to produce zero diff (regression guard).
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import yaml

from legacy.scripts.work import (
    WorkResult,
    _result_to_dict,
    activate,
    format_human,
)


def _make_project(tmp: Path, *, ui_present: bool = False) -> Path:
    project = tmp / "demo"
    project.mkdir()
    harness = project / ".harness"
    harness.mkdir()

    spec = {
        "version": "2.3",
        "project": {"name": "demo", "summary": "routed agents fixture", "vision": ""},
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
                "title": "demo feature",
                "priority": "P1",
                "test_strategy": "tdd",
                "acceptance_criteria": ["AC-1: dummy"],
                "modules": [],
                "ui_surface": {"present": ui_present},
            },
        ],
    }
    (harness / "spec.yaml").write_text(yaml.safe_dump(spec, sort_keys=False), encoding="utf-8")
    (harness / "state.yaml").write_text(
        yaml.safe_dump({"session": {"active_feature_id": None, "last_command": None}, "features": []}),
        encoding="utf-8",
    )
    return project


class TestActivatePopulatesRoutedAgents(unittest.TestCase):
    def test_activate_returns_routed_agents_for_pure_domain(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project = _make_project(Path(tmp))
            result = activate(project / ".harness", "F-300", disable_fog=True)
            self.assertGreater(len(result.routed_agents), 0)
            self.assertIn("software-engineer", result.routed_agents)

    def test_activate_returns_ui_chain_when_ui_surface_present(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project = _make_project(Path(tmp), ui_present=True)
            result = activate(project / ".harness", "F-300", disable_fog=True)
            ui_agents = {"ux-architect", "visual-designer", "frontend-engineer", "a11y-auditor"}
            self.assertTrue(
                ui_agents & set(result.routed_agents),
                msg=f"expected UI agents in routed_agents, got {result.routed_agents}",
            )


class TestFormatHumanLine(unittest.TestCase):
    def test_routed_agents_line_emitted(self) -> None:
        result = WorkResult(
            feature_id="F-300",
            action="activated",
            current_status="in_progress",
            gates_passed=[],
            gates_failed=[],
            evidence_count=0,
            routed_agents=["backend-engineer", "software-engineer", "qa-engineer"],
        )
        text = format_human(result)
        self.assertIn("routed agents:", text)
        self.assertIn("backend-engineer", text)
        self.assertIn("qa-engineer", text)

    def test_routed_agents_line_omitted_when_empty(self) -> None:
        result = WorkResult(
            feature_id="F-300",
            action="activated",
            current_status="in_progress",
            gates_passed=[],
            gates_failed=[],
            evidence_count=0,
            routed_agents=[],
        )
        text = format_human(result)
        self.assertNotIn("routed agents:", text)

    def test_non_activate_action_omits_routed_agents_even_if_present(self) -> None:
        # Defensive: a stray routed_agents list on a gate_recorded result must not
        # leak into the format_human output. Activate is the only owner of that line.
        result = WorkResult(
            feature_id="F-300",
            action="gate_recorded",
            current_status="in_progress",
            gates_passed=["gate_0"],
            gates_failed=[],
            evidence_count=1,
            routed_agents=["software-engineer"],
        )
        text = format_human(result)
        self.assertNotIn("routed agents:", text)


class TestResultToDict(unittest.TestCase):
    def test_routed_agents_in_dict(self) -> None:
        result = WorkResult(
            feature_id="F-300",
            action="activated",
            current_status="in_progress",
            gates_passed=[],
            gates_failed=[],
            evidence_count=0,
            routed_agents=["software-engineer"],
        )
        out = _result_to_dict(result)
        self.assertEqual(out["routed_agents"], ["software-engineer"])

    def test_default_empty_list_in_dict(self) -> None:
        result = WorkResult(
            feature_id="F-300",
            action="queried",
            current_status="planned",
            gates_passed=[],
            gates_failed=[],
            evidence_count=0,
        )
        out = _result_to_dict(result)
        self.assertEqual(out["routed_agents"], [])


if __name__ == "__main__":
    unittest.main()
