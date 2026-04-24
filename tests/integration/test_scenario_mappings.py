"""Scenario mapping integration tests (v0.9.4).

Validates the ``scripts/ui/scenarios.py::SCENARIOS`` table against three
contracts:

1. **Structural** — every mapping has the expected shape, action is a known
   literal, no empty phrase tuple, categories are consistent.
2. **Dispatchable** — every ``action`` resolves to an existing callable on
   ``scripts/work.py``. If scenarios.py grows a new action without a
   corresponding work.py entry point, this fails loudly.
3. **End-to-end smoke** — spin up a temp harness, invoke each action against
   it with minimal fixtures, assert the expected state mutation or event.
   Catches the case where an action's signature drifts from the dispatch map.

The README scenario section is derived from ``as_readme_rows`` — this test
suite is the contract that keeps README in sync with runtime behavior.
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import work  # noqa: E402
from core.state import State  # noqa: E402
from ui.scenarios import (  # noqa: E402
    SCENARIOS,
    Action,
    ScenarioMapping,
    as_readme_rows,
    dispatch_action_name,
)


_VALID_ACTIONS: frozenset[str] = frozenset({
    "dashboard", "activate", "run_gates", "complete", "block",
    "deactivate", "add_evidence", "remove", "switch",
})


class StructuralTests(unittest.TestCase):
    def test_scenarios_non_empty(self):
        self.assertGreater(len(SCENARIOS), 0)

    def test_every_mapping_is_frozen_dataclass(self):
        for s in SCENARIOS:
            with self.assertRaises(Exception):
                s.category = "x"  # type: ignore[misc]  # frozen

    def test_every_action_is_known(self):
        for s in SCENARIOS:
            self.assertIn(s.action, _VALID_ACTIONS, f"unknown action: {s.action}")

    def test_every_mapping_has_phrases(self):
        for s in SCENARIOS:
            self.assertGreater(len(s.phrases), 0, f"empty phrases: {s}")

    def test_every_mapping_has_description(self):
        for s in SCENARIOS:
            self.assertTrue(s.description.strip(), f"empty description: {s}")

    def test_dashboard_is_read_only(self):
        dash = [s for s in SCENARIOS if s.action == "dashboard"]
        self.assertTrue(dash, "must have a dashboard scenario")
        for s in dash:
            self.assertTrue(
                s.read_only, "dashboard scenarios must be flagged read_only",
            )

    def test_categories_are_coherent(self):
        """Categories should be a small finite set so README sections stay tidy."""
        categories = {s.category for s in SCENARIOS}
        # Not enforcing an exact set — this keeps future additions cheap —
        # but cap at 6 so the table never sprawls.
        self.assertLessEqual(len(categories), 6)


class DispatchTests(unittest.TestCase):
    def test_every_action_has_dispatch_name(self):
        for s in SCENARIOS:
            name = dispatch_action_name(s.action)
            self.assertIsInstance(name, str)
            self.assertTrue(name)

    def test_dispatch_names_resolve_on_work_module(self):
        for s in SCENARIOS:
            name = dispatch_action_name(s.action)
            self.assertTrue(
                hasattr(work, name),
                f"scripts/work.py missing attribute {name!r} for action {s.action!r}",
            )
            self.assertTrue(callable(getattr(work, name)))


class ReadmeRenderingTests(unittest.TestCase):
    def test_rows_match_scenario_count(self):
        rows = as_readme_rows()
        self.assertEqual(len(rows), len(SCENARIOS))

    def test_rendered_phrases_quoted_or_empty_placeholder(self):
        rows = as_readme_rows()
        for _category, phrases, _desc in rows:
            # Each phrase entry either starts with a quote or is the special
            # empty-call placeholder.
            parts = phrases.split(" · ")
            for p in parts:
                self.assertTrue(
                    p.startswith('"') or p == "(빈 호출)",
                    f"unexpected phrase rendering: {p!r}",
                )


class HarnessFixture:
    """Shared per-test temp harness with a minimal seeded feature."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.harness = Path(self._tmp.name) / ".harness"
        self.harness.mkdir()
        (self.harness / "spec.yaml").write_text(
            yaml.safe_dump({
                "version": "2.3.8",
                "project": {"name": "fx", "mode": "prototype"},
                "features": [
                    {"id": "F-1", "name": "seed"},
                    {"id": "F-2", "name": "second"},
                ],
            }, allow_unicode=True),
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def events(self) -> list[dict]:
        log = self.harness / "events.log"
        if not log.is_file():
            return []
        return [
            json.loads(l)
            for l in log.read_text(encoding="utf-8").splitlines() if l.strip()
        ]


class EndToEndSmokeTests(HarnessFixture, unittest.TestCase):
    """Each action actually runs against a scratch harness."""

    def test_dashboard_action_produces_snapshot(self):
        snap = work.dashboard_snapshot(self.harness)
        self.assertIn("suggestions", snap)
        self.assertIn("counts", snap)

    def test_activate_action_marks_in_progress(self):
        work.activate(self.harness, "F-1")
        st = State.load(self.harness)
        self.assertEqual(st.get_feature("F-1")["status"], "in_progress")
        types = [e["type"] for e in self.events()]
        self.assertIn("feature_activated", types)

    def test_block_action_transitions_and_records(self):
        work.activate(self.harness, "F-1")
        work.block(self.harness, "F-1", "외부 API 미배포")
        st = State.load(self.harness)
        self.assertEqual(st.get_feature("F-1")["status"], "blocked")
        types = [e["type"] for e in self.events()]
        self.assertIn("feature_blocked", types)

    def test_deactivate_action_clears_session_pointer(self):
        work.activate(self.harness, "F-1")
        work.deactivate(self.harness)
        st = State.load(self.harness)
        self.assertIsNone(st.data["session"]["active_feature_id"])

    def test_add_evidence_action_counts_declared(self):
        work.activate(self.harness, "F-1")
        work.add_evidence(self.harness, "F-1", "manual_check", "AC-1 재현")
        st = State.load(self.harness)
        self.assertEqual(len(st.get_feature("F-1")["evidence"]), 1)

    def test_complete_action_enforces_iron_law_d(self):
        """Prototype mode — 1 declared suffices, gate_5 required."""
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        work.add_evidence(self.harness, "F-1", "manual_check", "smoke ok")
        res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "completed")

    def test_remove_action_drops_planned_feature(self):
        # remove_feature requires the feature to be in state.yaml — ensure
        # it's registered as a planned entry (mimics a spec-registered feature
        # the user decides to scrap before activating).
        st = State.load(self.harness)
        st.ensure_feature("F-2")
        st.save()

        res = work.remove_feature(self.harness, "F-2")
        self.assertEqual(res.action, "removed")
        st = State.load(self.harness)
        self.assertIsNone(st.get_feature("F-2"))

    def test_run_gates_action_invokes_runner(self):
        """Smoke: run_and_record_gate wires through even for a missing runner.

        In a fresh scratch harness with no project root, gate_0 auto-detect
        lands on a skipped result — that is still a successful dispatch. The
        test only asserts the action runs without raising.
        """
        work.activate(self.harness, "F-1")
        res = work.run_and_record_gate(
            self.harness, "F-1", "gate_0", project_root=self.harness.parent,
        )
        self.assertIn(res.message.split(" ")[1].lower(), {"pass", "fail", "skipped"})


class ScenarioCoverageTests(unittest.TestCase):
    """Guard: every ``Action`` literal value must appear at least once."""

    def test_every_action_literal_has_scenario(self):
        used = {s.action for s in SCENARIOS}
        # ``switch`` is an alias currently subsumed by ``deactivate``; allow
        # it to be absent since deactivate covers the case. Everything else
        # must show up.
        required = _VALID_ACTIONS - {"switch"}
        missing = required - used
        self.assertFalse(
            missing,
            f"SCENARIOS table is missing actions: {sorted(missing)}",
        )


if __name__ == "__main__":
    unittest.main()
