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
from core.state import State  # noqa: E402


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
    """Iron Law (v0.9.3): default product mode requires 3 declared evidence."""

    def _seed_evidence(self, fid: str, n: int = 3) -> None:
        for i in range(n):
            work.add_evidence(self.harness, fid, "test", f"declared {i+1}")

    def test_cannot_complete_without_gate5(self):
        work.activate(self.harness, "F-004")
        work.record_gate(self.harness, "F-004", "gate_0", "pass")
        res = work.complete(self.harness, "F-004")
        self.assertEqual(res.action, "queried")
        self.assertIn("gate_5", res.message)

    def test_cannot_complete_without_evidence(self):
        work.activate(self.harness, "F-004")
        work.record_gate(self.harness, "F-004", "gate_5", "pass")
        res = work.complete(self.harness, "F-004")
        self.assertIn("Iron Law", res.message)
        self.assertIn("0/3", res.message)

    def test_complete_transitions_to_done(self):
        work.activate(self.harness, "F-004")
        work.record_gate(self.harness, "F-004", "gate_5", "pass")
        self._seed_evidence("F-004", 3)
        res = work.complete(self.harness, "F-004")
        self.assertEqual(res.action, "completed")
        self.assertEqual(res.current_status, "done")

    def test_complete_clears_active_feature(self):
        work.activate(self.harness, "F-004")
        work.record_gate(self.harness, "F-004", "gate_5", "pass")
        self._seed_evidence("F-004", 3)
        work.complete(self.harness, "F-004")
        st = State.load(self.harness)
        self.assertIsNone(st.data["session"]["active_feature_id"])

    def test_complete_writes_feature_done_event(self):
        work.activate(self.harness, "F-004")
        work.record_gate(self.harness, "F-004", "gate_5", "pass")
        self._seed_evidence("F-004", 3)
        work.complete(self.harness, "F-004")
        events = self.read_events()
        types = [e["type"] for e in events]
        self.assertIn("feature_done", types)


class ArchiveTests(HarnessScratch, unittest.TestCase):
    """v0.10 — done → archived 전이 (two-layer model lifecycle)."""

    def _set_done(self, fid: str) -> None:
        st = State.load(self.harness)
        st.set_status(fid, "done")
        st.save()

    def _write_spec(self, feature_ids: list[str]) -> None:
        import yaml as _yaml
        features = [{"id": "F-001", "type": "skeleton"}] + [
            {"id": fid} for fid in feature_ids if fid != "F-001"
        ]
        (self.harness / "spec.yaml").write_text(
            _yaml.safe_dump({"features": features}, sort_keys=False),
            encoding="utf-8",
        )

    def test_archive_transitions_done_to_archived(self):
        self._set_done("F-004")
        res = work.archive(self.harness, "F-004")
        self.assertEqual(res.action, "archived")
        self.assertEqual(res.current_status, "archived")

    def test_archive_writes_feature_archived_event(self):
        self._set_done("F-004")
        work.archive(self.harness, "F-004", reason="pivot")
        events = self.read_events()
        archived = [e for e in events if e["type"] == "feature_archived"]
        self.assertEqual(len(archived), 1)
        self.assertEqual(archived[0]["feature"], "F-004")
        self.assertEqual(archived[0]["reason"], "pivot")

    def test_archive_with_superseded_by_records_field(self):
        self._write_spec(["F-004", "F-005"])
        self._set_done("F-004")
        work.archive(
            self.harness, "F-004", superseded_by="F-005", reason="replaced"
        )
        events = self.read_events()
        archived = next(e for e in events if e["type"] == "feature_archived")
        self.assertEqual(archived["superseded_by"], "F-005")
        self.assertEqual(archived["reason"], "replaced")

    def test_cannot_archive_non_done_feature(self):
        # status defaults to planned for newly ensured features
        res = work.archive(self.harness, "F-004")
        self.assertEqual(res.action, "queried")
        self.assertIn("Only 'done'", res.message)

    def test_idempotent_when_already_archived(self):
        self._set_done("F-004")
        work.archive(self.harness, "F-004")
        res = work.archive(self.harness, "F-004")
        self.assertEqual(res.action, "queried")
        self.assertIn("already archived", res.message)
        events = self.read_events()
        self.assertEqual(
            sum(1 for e in events if e["type"] == "feature_archived"), 1
        )

    def test_archive_clears_active_feature(self):
        work.activate(self.harness, "F-004")
        st = State.load(self.harness)
        st.set_status("F-004", "done")
        st.save()
        work.archive(self.harness, "F-004")
        st = State.load(self.harness)
        self.assertIsNone(st.data["session"]["active_feature_id"])

    def test_superseded_by_self_rejected(self):
        self._set_done("F-004")
        res = work.archive(self.harness, "F-004", superseded_by="F-004")
        self.assertEqual(res.action, "queried")
        self.assertIn("cannot reference self", res.message)

    def test_superseded_by_must_exist_in_spec(self):
        self._write_spec(["F-004"])  # F-005 not in spec
        self._set_done("F-004")
        res = work.archive(self.harness, "F-004", superseded_by="F-005")
        self.assertEqual(res.action, "queried")
        self.assertIn("not found in spec.yaml", res.message)

    def test_empty_superseded_by_rejected(self):
        self._set_done("F-004")
        res = work.archive(self.harness, "F-004", superseded_by="   ")
        self.assertEqual(res.action, "queried")
        self.assertIn("cannot be empty", res.message)


class CurrentTests(HarnessScratch, unittest.TestCase):
    def test_no_active_returns_none(self):
        self.assertIsNone(work.current(self.harness))

    def test_active_returns_summary(self):
        work.activate(self.harness, "F-004")
        res = work.current(self.harness)
        self.assertIsNotNone(res)
        self.assertEqual(res.feature_id, "F-004")


class RunAndRecordGateTests(HarnessScratch, unittest.TestCase):
    """--run-gate flow: gate_runner 실행 + state 자동 기록 + evidence 자동 추가."""

    def test_pass_records_and_adds_evidence(self):
        res = work.run_and_record_gate(
            self.harness, "F-010", "gate_0", override_command=["true"]
        )
        self.assertEqual(res.action, "gate_auto_run")
        self.assertIn("gate_0", res.gates_passed)
        self.assertEqual(res.evidence_count, 1)  # pass 시 자동 evidence
        self.assertIn("PASS", res.message)

    def test_fail_records_but_no_evidence(self):
        res = work.run_and_record_gate(
            self.harness, "F-010", "gate_0", override_command=["false"]
        )
        self.assertIn("gate_0", res.gates_failed)
        self.assertEqual(res.evidence_count, 0)

    def test_skipped_records(self):
        res = work.run_and_record_gate(
            self.harness, "F-010", "gate_0", override_command=["__no_such_bin__"]
        )
        # skipped 도 gate 기록
        self.assertEqual(res.evidence_count, 0)
        # state 에 skipped 결과 기록됨
        from core.state import State
        st = State.load(self.harness)
        gates = st.get_feature("F-010")["gates"]
        self.assertEqual(gates["gate_0"]["last_result"], "skipped")

    def test_emits_gate_auto_run_event(self):
        work.run_and_record_gate(
            self.harness, "F-010", "gate_0", override_command=["true"]
        )
        events = self.read_events()
        self.assertTrue(any(e["type"] == "gate_auto_run" for e in events))

    def test_unsupported_gate_skipped(self):
        """gate_1 등은 v0.3.1 에선 skipped."""
        res = work.run_and_record_gate(
            self.harness, "F-010", "gate_1"
        )
        self.assertEqual(res.current_status, "planned")  # activate 호출 안 했으니
        # state 에 skipped 결과
        from core.state import State
        st = State.load(self.harness)
        g1 = st.get_feature("F-010")["gates"].get("gate_1")
        self.assertEqual(g1["last_result"], "skipped")


class FullCycleTests(HarnessScratch, unittest.TestCase):
    """실제 F-004 개발 사이클 end-to-end 시뮬레이션."""

    def test_plan_to_done(self):
        work.activate(self.harness, "F-xyz")
        for gate in ("gate_0", "gate_1", "gate_2", "gate_3", "gate_4", "gate_5"):
            work.record_gate(self.harness, "F-xyz", gate, "pass", note=f"{gate} green")
        work.add_evidence(self.harness, "F-xyz", "test", "full test suite 220/220")
        work.add_evidence(self.harness, "F-xyz", "manual_check", "UI smoke OK")
        work.add_evidence(self.harness, "F-xyz", "reviewer_check", "peer review clean")
        res = work.complete(self.harness, "F-xyz")

        self.assertEqual(res.action, "completed")
        self.assertEqual(res.current_status, "done")
        self.assertEqual(len(res.gates_passed), 6)

        events = self.read_events()
        types = [e["type"] for e in events]
        self.assertEqual(types.count("feature_activated"), 1)
        self.assertEqual(types.count("gate_recorded"), 6)
        self.assertEqual(types.count("evidence_added"), 3)
        self.assertEqual(types.count("feature_done"), 1)


if __name__ == "__main__":
    unittest.main()
