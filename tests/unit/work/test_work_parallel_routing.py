"""F-039 — WorkResult.parallel_groups + format_human ∥ rendering."""

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


def _make_project(tmp: Path, *, ui_present: bool, has_audio: bool = False) -> Path:
    project = tmp / "demo"
    project.mkdir()
    harness = project / ".harness"
    harness.mkdir()

    feature: dict = {
        "id": "F-400",
        "type": "feature",
        "title": "demo",
        "priority": "P1",
        "test_strategy": "tdd",
        "acceptance_criteria": ["AC-1: x"],
        "modules": [],
        "ui_surface": {"present": ui_present, "has_audio": has_audio},
    }

    spec = {
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
            feature,
        ],
    }
    (harness / "spec.yaml").write_text(yaml.safe_dump(spec, sort_keys=False), encoding="utf-8")
    (harness / "state.yaml").write_text(
        yaml.safe_dump({"session": {"active_feature_id": None, "last_command": None}, "features": []}),
        encoding="utf-8",
    )
    return project


class TestActivatePopulatesParallelGroups(unittest.TestCase):
    def test_ui_with_audio_yields_visual_audio_pair(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project = _make_project(Path(tmp), ui_present=True, has_audio=True)
            result = activate(project / ".harness", "F-400", disable_fog=True)
            self.assertIn(["visual-designer", "audio-designer"], result.parallel_groups)

    def test_ui_without_audio_drops_pair(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project = _make_project(Path(tmp), ui_present=True, has_audio=False)
            result = activate(project / ".harness", "F-400", disable_fog=True)
            self.assertEqual(result.parallel_groups, [])

    def test_pure_domain_yields_empty_parallel_groups(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project = _make_project(Path(tmp), ui_present=False)
            result = activate(project / ".harness", "F-400", disable_fog=True)
            self.assertEqual(result.parallel_groups, [])


class TestFormatHumanGroupRendering(unittest.TestCase):
    def test_grouped_chain_uses_parallel_token(self) -> None:
        result = WorkResult(
            feature_id="F-400",
            action="activated",
            current_status="in_progress",
            gates_passed=[],
            gates_failed=[],
            evidence_count=0,
            routed_agents=[
                "ux-architect",
                "visual-designer",
                "audio-designer",
                "a11y-auditor",
                "frontend-engineer",
            ],
            parallel_groups=[["visual-designer", "audio-designer"]],
        )
        text = format_human(result)
        self.assertIn("(visual-designer ∥ audio-designer)", text)
        self.assertIn("ux-architect", text)
        self.assertIn("a11y-auditor", text)
        self.assertNotIn(", visual-designer,", text)

    def test_no_groups_falls_back_to_comma_join(self) -> None:
        result = WorkResult(
            feature_id="F-400",
            action="activated",
            current_status="in_progress",
            gates_passed=[],
            gates_failed=[],
            evidence_count=0,
            routed_agents=["backend-engineer", "software-engineer"],
            parallel_groups=[],
        )
        text = format_human(result)
        self.assertIn("routed agents: backend-engineer, software-engineer", text)
        self.assertNotIn("∥", text)

    def test_non_activate_action_omits_routed_line(self) -> None:
        result = WorkResult(
            feature_id="F-400",
            action="completed",
            current_status="done",
            gates_passed=["gate_0", "gate_5"],
            gates_failed=[],
            evidence_count=3,
            routed_agents=["backend-engineer"],
            parallel_groups=[["security-engineer", "reviewer"]],
        )
        text = format_human(result)
        self.assertNotIn("routed agents:", text)
        self.assertNotIn("∥", text)


class TestResultToDict(unittest.TestCase):
    def test_parallel_groups_in_dict(self) -> None:
        result = WorkResult(
            feature_id="F-400",
            action="activated",
            current_status="in_progress",
            gates_passed=[],
            gates_failed=[],
            evidence_count=0,
            routed_agents=["security-engineer", "reviewer"],
            parallel_groups=[["security-engineer", "reviewer"]],
        )
        out = _result_to_dict(result)
        self.assertEqual(out["parallel_groups"], [["security-engineer", "reviewer"]])

    def test_default_empty_list_in_dict(self) -> None:
        result = WorkResult(
            feature_id="F-400",
            action="queried",
            current_status="planned",
            gates_passed=[],
            gates_failed=[],
            evidence_count=0,
        )
        out = _result_to_dict(result)
        self.assertEqual(out["parallel_groups"], [])


if __name__ == "__main__":
    unittest.main()
