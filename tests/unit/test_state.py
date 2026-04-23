"""Tests for scripts/state.py."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from state import State  # noqa: E402


class ScratchHarnessMixin:
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.harness = self.tmp / ".harness"
        self.harness.mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()


class LoadSaveTests(ScratchHarnessMixin, unittest.TestCase):
    def test_load_creates_default_when_missing(self):
        st = State.load(self.harness)
        self.assertEqual(st.data["version"], "2.3")
        self.assertEqual(st.data["features"], [])
        self.assertIsNone(st.data["session"]["started_at"])

    def test_save_then_load_preserves(self):
        st = State.load(self.harness)
        st.ensure_feature("F-001")
        st.set_status("F-001", "in_progress")
        st.save()

        st2 = State.load(self.harness)
        f = st2.get_feature("F-001")
        self.assertEqual(f["status"], "in_progress")
        self.assertIsNotNone(f["started_at"])

    def test_corrupt_yaml_falls_back_to_default(self):
        (self.harness / "state.yaml").write_text("- just\n- a list", encoding="utf-8")
        st = State.load(self.harness)
        # top-level 이 list 면 default 로 fall back
        self.assertEqual(st.data["features"], [])


class FeatureLifecycleTests(ScratchHarnessMixin, unittest.TestCase):
    def test_ensure_feature_idempotent(self):
        st = State.load(self.harness)
        f1 = st.ensure_feature("F-001")
        f2 = st.ensure_feature("F-001")
        self.assertIs(f1, f2)
        self.assertEqual(len(st.data["features"]), 1)

    def test_set_status_in_progress_sets_started_at(self):
        st = State.load(self.harness)
        st.set_status("F-002", "in_progress")
        f = st.get_feature("F-002")
        self.assertIsNotNone(f["started_at"])
        self.assertIsNone(f["completed_at"])

    def test_set_status_done_sets_completed_at(self):
        st = State.load(self.harness)
        st.set_status("F-002", "in_progress")
        st.set_status("F-002", "done")
        f = st.get_feature("F-002")
        self.assertIsNotNone(f["completed_at"])

    def test_invalid_status_raises(self):
        st = State.load(self.harness)
        with self.assertRaises(ValueError):
            st.set_status("F-1", "nonsense")


class GateTests(ScratchHarnessMixin, unittest.TestCase):
    def test_record_gate_stores_fields(self):
        st = State.load(self.harness)
        st.record_gate_result("F-003", "gate_0", "pass", note="unit tests 104/104")
        g = st.get_feature("F-003")["gates"]["gate_0"]
        self.assertEqual(g["last_result"], "pass")
        self.assertEqual(g["note"], "unit tests 104/104")
        self.assertIsNotNone(g["ts"])

    def test_pass_updates_session_last_gate(self):
        st = State.load(self.harness)
        st.record_gate_result("F-003", "gate_5", "pass")
        self.assertEqual(st.data["session"]["last_gate_passed"], "gate_5")

    def test_fail_does_not_update_session(self):
        st = State.load(self.harness)
        st.data["session"]["last_gate_passed"] = "gate_2"
        st.record_gate_result("F-003", "gate_3", "fail")
        self.assertEqual(st.data["session"]["last_gate_passed"], "gate_2")

    def test_invalid_gate_result_raises(self):
        st = State.load(self.harness)
        with self.assertRaises(ValueError):
            st.record_gate_result("F-1", "gate_0", "weird")


class EvidenceTests(ScratchHarnessMixin, unittest.TestCase):
    def test_evidence_append(self):
        st = State.load(self.harness)
        st.add_evidence("F-010", "test", "19 canonical_hash tests pass")
        ev = st.get_feature("F-010")["evidence"]
        self.assertEqual(len(ev), 1)
        self.assertEqual(ev[0]["kind"], "test")


class SessionTests(ScratchHarnessMixin, unittest.TestCase):
    def test_set_active_auto_registers(self):
        st = State.load(self.harness)
        st.set_active("F-099")
        self.assertIsNotNone(st.get_feature("F-099"))
        self.assertEqual(st.data["session"]["active_feature_id"], "F-099")

    def test_set_active_none_clears(self):
        st = State.load(self.harness)
        st.set_active("F-001")
        st.set_active(None)
        self.assertIsNone(st.data["session"]["active_feature_id"])

    def test_set_last_command_initializes_started_at(self):
        st = State.load(self.harness)
        st.set_last_command("/harness:sync")
        self.assertIsNotNone(st.data["session"]["started_at"])
        self.assertEqual(st.data["session"]["last_command"], "/harness:sync")


class CountsTests(ScratchHarnessMixin, unittest.TestCase):
    def test_feature_counts(self):
        st = State.load(self.harness)
        st.set_status("F-001", "done")
        st.set_status("F-002", "in_progress")
        st.ensure_feature("F-003")  # planned default
        st.ensure_feature("F-004")
        c = st.feature_counts()
        self.assertEqual(c["done"], 1)
        self.assertEqual(c["in_progress"], 1)
        self.assertEqual(c["planned"], 2)
        self.assertEqual(c["blocked"], 0)


class SnapshotTests(ScratchHarnessMixin, unittest.TestCase):
    def test_snapshot_is_deep_copy(self):
        st = State.load(self.harness)
        st.ensure_feature("F-1")
        snap = st.snapshot()
        snap["features"][0]["tampered"] = True
        self.assertNotIn("tampered", st.data["features"][0])


if __name__ == "__main__":
    unittest.main()
