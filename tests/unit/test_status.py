"""Tests for scripts/status.py (F-005) — read-only CQS."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import status  # noqa: E402
from state import State  # noqa: E402


class HarnessScratch:
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.harness = self.tmp / ".harness"
        self.harness.mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()


class EmptyHarnessTests(HarnessScratch, unittest.TestCase):
    def test_empty_dir_produces_default_report(self):
        report = status.build_report(self.harness)
        self.assertEqual(report.counts["planned"], 0)
        self.assertEqual(report.drift_status, "unknown")
        self.assertIsNone(report.last_sync)
        self.assertIsNone(report.active_feature)


class CountsTests(HarnessScratch, unittest.TestCase):
    def test_counts_reflect_state_yaml(self):
        st = State.load(self.harness)
        st.set_status("F-001", "done")
        st.set_status("F-002", "in_progress")
        st.ensure_feature("F-003")
        st.save()

        report = status.build_report(self.harness)
        self.assertEqual(report.counts["done"], 1)
        self.assertEqual(report.counts["in_progress"], 1)
        self.assertEqual(report.counts["planned"], 1)


class DriftStatusTests(HarnessScratch, unittest.TestCase):
    def test_drift_read_from_harness_yaml(self):
        (self.harness / "harness.yaml").write_text(
            yaml.safe_dump({"generation": {"drift_status": "derived_edited"}}),
            encoding="utf-8",
        )
        report = status.build_report(self.harness)
        self.assertEqual(report.drift_status, "derived_edited")

    def test_missing_harness_yaml_is_unknown(self):
        report = status.build_report(self.harness)
        self.assertEqual(report.drift_status, "unknown")


class LastSyncTests(HarnessScratch, unittest.TestCase):
    def test_last_sync_event_decoded(self):
        log = self.harness / "events.log"
        log.write_text(
            json.dumps({"ts": "2026-04-23T07:00:00Z", "type": "sync_completed", "spec_hash": "abc" * 20, "plugin_version": "0.2.1"}) + "\n",
            encoding="utf-8",
        )
        report = status.build_report(self.harness)
        self.assertIsNotNone(report.last_sync)
        self.assertEqual(report.last_sync["plugin_version"], "0.2.1")
        # spec_hash 는 12자로 truncated
        self.assertEqual(len(report.last_sync["spec_hash"]), 12)

    def test_non_sync_events_ignored(self):
        log = self.harness / "events.log"
        log.write_text(
            json.dumps({"ts": "2026-04-23T07:00:00Z", "type": "harness_initialized"}) + "\n",
            encoding="utf-8",
        )
        report = status.build_report(self.harness)
        self.assertIsNone(report.last_sync)


class ActiveFeatureTests(HarnessScratch, unittest.TestCase):
    def test_active_feature_exposed(self):
        st = State.load(self.harness)
        st.set_status("F-004", "in_progress")
        st.set_active("F-004")
        st.record_gate_result("F-004", "gate_0", "pass")
        st.save()

        report = status.build_report(self.harness)
        self.assertIsNotNone(report.active_feature)
        self.assertEqual(report.active_feature["id"], "F-004")
        self.assertIn("gate_0", report.active_feature["gates_passed"])


class FeatureFilterTests(HarnessScratch, unittest.TestCase):
    def test_filter_to_single_feature(self):
        st = State.load(self.harness)
        st.ensure_feature("F-001")
        st.ensure_feature("F-002")
        st.save()

        report = status.build_report(self.harness, feature_filter="F-001")
        self.assertEqual(len(report.features_summary), 1)
        self.assertEqual(report.features_summary[0]["id"], "F-001")


class HumanFormatTests(HarnessScratch, unittest.TestCase):
    def test_preamble_present(self):
        report = status.build_report(self.harness)
        out = status.format_human(report)
        self.assertIn("📋 /harness:status", out)
        self.assertIn("Session", out)
        self.assertIn("Features", out)
        self.assertIn("Drift status", out)


class CQSTests(HarnessScratch, unittest.TestCase):
    """Mode E / status 핵심 불변조건 — 읽기만."""

    def test_build_report_does_not_modify_files(self):
        st = State.load(self.harness)
        st.ensure_feature("F-1")
        st.save()
        (self.harness / "harness.yaml").write_text("generation:\n  drift_status: clean\n", encoding="utf-8")
        (self.harness / "events.log").write_text(
            json.dumps({"ts": "x", "type": "sync_completed"}) + "\n", encoding="utf-8"
        )

        before_state = (self.harness / "state.yaml").stat().st_mtime_ns
        before_harness = (self.harness / "harness.yaml").stat().st_mtime_ns
        before_events = (self.harness / "events.log").stat().st_mtime_ns

        status.build_report(self.harness)
        status.build_report(self.harness, feature_filter="F-1")
        report = status.build_report(self.harness)
        status.format_human(report)

        self.assertEqual((self.harness / "state.yaml").stat().st_mtime_ns, before_state)
        self.assertEqual((self.harness / "harness.yaml").stat().st_mtime_ns, before_harness)
        self.assertEqual((self.harness / "events.log").stat().st_mtime_ns, before_events)

    def test_no_files_created(self):
        before = set(self.harness.iterdir())
        status.build_report(self.harness)
        after = set(self.harness.iterdir())
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
