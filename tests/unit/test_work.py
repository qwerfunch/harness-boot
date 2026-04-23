"""Tests for scripts/work.py (F-004)."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import work  # noqa: E402
from state import State  # noqa: E402


class HarnessScratch:
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.harness = self.tmp / ".harness"
        self.harness.mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def read_events(self) -> list[dict]:
        log = self.harness / "events.log"
        if not log.is_file():
            return []
        return [json.loads(l) for l in log.read_text(encoding="utf-8").splitlines() if l.strip()]


class ActivateTests(HarnessScratch, unittest.TestCase):
    def test_activate_new_feature(self):
        res = work.activate(self.harness, "F-004")
        self.assertEqual(res.action, "activated")
        self.assertEqual(res.current_status, "in_progress")

        # state 반영
        st = State.load(self.harness)
        self.assertEqual(st.data["session"]["active_feature_id"], "F-004")
        f = st.get_feature("F-004")
        self.assertEqual(f["status"], "in_progress")
        self.assertIsNotNone(f["started_at"])

    def test_activate_emits_event(self):
        work.activate(self.harness, "F-004")
        events = self.read_events()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["type"], "feature_activated")

    def test_activate_done_feature_no_reactivate(self):
        st = State.load(self.harness)
        st.set_status("F-001", "done")
        st.save()
        res = work.activate(self.harness, "F-001")
        self.assertEqual(res.action, "queried")
        self.assertEqual(res.current_status, "done")
        self.assertIn("already done", res.message)


class GateTests(HarnessScratch, unittest.TestCase):
    def test_record_pass(self):
        res = work.record_gate(self.harness, "F-004", "gate_0", "pass", note="19 tests")
        self.assertEqual(res.action, "gate_recorded")
        self.assertIn("gate_0", res.gates_passed)

    def test_record_fail(self):
        res = work.record_gate(self.harness, "F-004", "gate_3", "fail")
        self.assertIn("gate_3", res.gates_failed)

    def test_invalid_result_raises(self):
        with self.assertRaises(ValueError):
            work.record_gate(self.harness, "F-004", "gate_0", "bogus")

    def test_event_written(self):
        work.record_gate(self.harness, "F-004", "gate_0", "pass")
        events = self.read_events()
        self.assertEqual(events[-1]["type"], "gate_recorded")


class EvidenceTests(HarnessScratch, unittest.TestCase):
    def test_evidence_counter(self):
        work.add_evidence(self.harness, "F-004", "test", "19 pass")
        work.add_evidence(self.harness, "F-004", "test", "23 pass")
        res = work.add_evidence(self.harness, "F-004", "doc", "wrote spec")
        self.assertEqual(res.evidence_count, 3)


class BlockTests(HarnessScratch, unittest.TestCase):
    def test_block_sets_status_and_evidence(self):
        res = work.block(self.harness, "F-004", "waiting for Postgres access")
        self.assertEqual(res.action, "blocked")
        self.assertEqual(res.current_status, "blocked")
        self.assertEqual(res.evidence_count, 1)


class CompleteTests(HarnessScratch, unittest.TestCase):
    def test_cannot_complete_without_gate5(self):
        work.activate(self.harness, "F-004")
        work.record_gate(self.harness, "F-004", "gate_0", "pass")
        res = work.complete(self.harness, "F-004")
        self.assertEqual(res.action, "queried")
        self.assertIn("gate_5", res.message)

    def test_cannot_complete_without_evidence(self):
        work.activate(self.harness, "F-004")
        work.record_gate(self.harness, "F-004", "gate_5", "pass")
        # evidence 없음
        res = work.complete(self.harness, "F-004")
        self.assertIn("evidence", res.message)

    def test_complete_transitions_to_done(self):
        work.activate(self.harness, "F-004")
        work.record_gate(self.harness, "F-004", "gate_5", "pass")
        work.add_evidence(self.harness, "F-004", "test", "all gates green")
        res = work.complete(self.harness, "F-004")
        self.assertEqual(res.action, "completed")
        self.assertEqual(res.current_status, "done")

    def test_complete_clears_active_feature(self):
        work.activate(self.harness, "F-004")
        work.record_gate(self.harness, "F-004", "gate_5", "pass")
        work.add_evidence(self.harness, "F-004", "test", "ok")
        work.complete(self.harness, "F-004")
        st = State.load(self.harness)
        self.assertIsNone(st.data["session"]["active_feature_id"])

    def test_complete_writes_feature_done_event(self):
        work.activate(self.harness, "F-004")
        work.record_gate(self.harness, "F-004", "gate_5", "pass")
        work.add_evidence(self.harness, "F-004", "test", "ok")
        work.complete(self.harness, "F-004")
        events = self.read_events()
        types = [e["type"] for e in events]
        self.assertIn("feature_done", types)


class CurrentTests(HarnessScratch, unittest.TestCase):
    def test_no_active_returns_none(self):
        self.assertIsNone(work.current(self.harness))

    def test_active_returns_summary(self):
        work.activate(self.harness, "F-004")
        res = work.current(self.harness)
        self.assertIsNotNone(res)
        self.assertEqual(res.feature_id, "F-004")


class FullCycleTests(HarnessScratch, unittest.TestCase):
    """실제 F-004 개발 사이클 end-to-end 시뮬레이션."""

    def test_plan_to_done(self):
        work.activate(self.harness, "F-xyz")
        for gate in ("gate_0", "gate_1", "gate_2", "gate_3", "gate_4", "gate_5"):
            work.record_gate(self.harness, "F-xyz", gate, "pass", note=f"{gate} green")
        work.add_evidence(self.harness, "F-xyz", "test", "full test suite 220/220")
        res = work.complete(self.harness, "F-xyz")

        self.assertEqual(res.action, "completed")
        self.assertEqual(res.current_status, "done")
        self.assertEqual(len(res.gates_passed), 6)

        # events: activated + 6 gates + evidence + done = 9
        events = self.read_events()
        types = [e["type"] for e in events]
        self.assertEqual(types.count("feature_activated"), 1)
        self.assertEqual(types.count("gate_recorded"), 6)
        self.assertEqual(types.count("evidence_added"), 1)
        self.assertEqual(types.count("feature_done"), 1)


if __name__ == "__main__":
    unittest.main()
