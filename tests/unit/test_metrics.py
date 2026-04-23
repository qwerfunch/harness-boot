"""Tests for scripts/metrics.py (F-008) — events.log aggregation, read-only."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import metrics  # noqa: E402


def _ev(ts: str, typ: str, **kw) -> dict:
    d = {"ts": ts, "type": typ}
    d.update(kw)
    return d


class PeriodParserTests(unittest.TestCase):
    def test_days(self):
        self.assertEqual(metrics.parse_period("7d"), timedelta(days=7))

    def test_hours(self):
        self.assertEqual(metrics.parse_period("24h"), timedelta(hours=24))

    def test_minutes(self):
        self.assertEqual(metrics.parse_period("30m"), timedelta(minutes=30))

    def test_seconds(self):
        self.assertEqual(metrics.parse_period("90s"), timedelta(seconds=90))

    def test_weeks(self):
        self.assertEqual(metrics.parse_period("2w"), timedelta(weeks=2))

    def test_case_insensitive(self):
        self.assertEqual(metrics.parse_period("5D"), timedelta(days=5))

    def test_whitespace_tolerated(self):
        self.assertEqual(metrics.parse_period(" 3h "), timedelta(hours=3))

    def test_invalid_raises(self):
        with self.assertRaises(ValueError):
            metrics.parse_period("7days")
        with self.assertRaises(ValueError):
            metrics.parse_period("-7d")


class AggregateTests(unittest.TestCase):
    def test_empty_input(self):
        r = metrics.aggregate([])
        self.assertEqual(r.total_events, 0)
        self.assertEqual(r.event_types, {})
        self.assertEqual(r.lead_time_count, 0)
        self.assertEqual(r.drift_incidents, 0)

    def test_event_type_counts(self):
        evs = [
            _ev("2026-04-23T00:00:00Z", "sync_completed"),
            _ev("2026-04-23T00:01:00Z", "sync_completed"),
            _ev("2026-04-23T00:02:00Z", "sync_failed"),
        ]
        r = metrics.aggregate(evs)
        self.assertEqual(r.total_events, 3)
        self.assertEqual(r.event_types["sync_completed"], 2)
        self.assertEqual(r.event_types["sync_failed"], 1)
        self.assertEqual(r.drift_incidents, 1)

    def test_feature_counts(self):
        evs = [
            _ev("2026-04-23T00:00:00Z", "feature_activated", feature="F-001"),
            _ev("2026-04-23T00:01:00Z", "feature_activated", feature="F-002"),
            _ev("2026-04-23T00:02:00Z", "feature_done", feature="F-001"),
            _ev("2026-04-23T00:03:00Z", "feature_blocked", feature="F-002"),
        ]
        r = metrics.aggregate(evs)
        self.assertEqual(r.features_activated, 2)
        self.assertEqual(r.features_done, 1)
        self.assertEqual(r.features_blocked, 1)

    def test_lead_time_simple(self):
        evs = [
            _ev("2026-04-23T00:00:00Z", "feature_activated", feature="F-001"),
            _ev("2026-04-23T01:00:00Z", "feature_done", feature="F-001"),
        ]
        r = metrics.aggregate(evs)
        self.assertEqual(r.lead_time_count, 1)
        self.assertEqual(r.lead_time_min_sec, 3600.0)
        self.assertEqual(r.lead_time_max_sec, 3600.0)
        self.assertEqual(r.lead_time_median_sec, 3600.0)
        self.assertEqual(r.lead_time_mean_sec, 3600.0)

    def test_lead_time_multiple_features(self):
        evs = [
            _ev("2026-04-23T00:00:00Z", "feature_activated", feature="F-001"),
            _ev("2026-04-23T00:00:10Z", "feature_done", feature="F-001"),
            _ev("2026-04-23T00:01:00Z", "feature_activated", feature="F-002"),
            _ev("2026-04-23T00:03:00Z", "feature_done", feature="F-002"),
        ]
        r = metrics.aggregate(evs)
        self.assertEqual(r.lead_time_count, 2)
        self.assertEqual(r.lead_time_min_sec, 10.0)
        self.assertEqual(r.lead_time_max_sec, 120.0)

    def test_lead_time_uses_last_activated(self):
        """reactivation 시 가장 가까운 activated 사용."""
        evs = [
            _ev("2026-04-23T00:00:00Z", "feature_activated", feature="F-1"),
            _ev("2026-04-23T00:30:00Z", "feature_blocked", feature="F-1"),
            _ev("2026-04-23T01:00:00Z", "feature_activated", feature="F-1"),
            _ev("2026-04-23T01:10:00Z", "feature_done", feature="F-1"),
        ]
        r = metrics.aggregate(evs)
        self.assertEqual(r.lead_time_count, 1)
        self.assertEqual(r.lead_time_min_sec, 600.0)  # 10 min, not 70 min

    def test_lead_time_ignores_orphan_done(self):
        evs = [_ev("2026-04-23T00:00:00Z", "feature_done", feature="F-1")]
        r = metrics.aggregate(evs)
        self.assertEqual(r.lead_time_count, 0)

    def test_gate_stats_pass_rate(self):
        evs = [
            _ev("2026-04-23T00:00:00Z", "gate_recorded", gate="gate_0", result="pass"),
            _ev("2026-04-23T00:01:00Z", "gate_recorded", gate="gate_0", result="pass"),
            _ev("2026-04-23T00:02:00Z", "gate_recorded", gate="gate_0", result="fail"),
            _ev("2026-04-23T00:03:00Z", "gate_auto_run", gate="gate_5", result="skipped"),
        ]
        r = metrics.aggregate(evs)
        self.assertEqual(r.gate_stats["gate_0"]["pass"], 2)
        self.assertEqual(r.gate_stats["gate_0"]["fail"], 1)
        self.assertAlmostEqual(r.gate_stats["gate_0"]["pass_rate"], 2 / 3, places=2)
        self.assertEqual(r.gate_stats["gate_5"]["skipped"], 1)
        # skipped 만 있으면 pass+fail=0 → pass_rate=0.0
        self.assertEqual(r.gate_stats["gate_5"]["pass_rate"], 0.0)

    def test_gate_recorded_and_auto_run_combined(self):
        evs = [
            _ev("2026-04-23T00:00:00Z", "gate_recorded", gate="gate_1", result="pass"),
            _ev("2026-04-23T00:01:00Z", "gate_auto_run", gate="gate_1", result="pass"),
        ]
        r = metrics.aggregate(evs)
        self.assertEqual(r.gate_stats["gate_1"]["pass"], 2)


class ComputeTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.harness = self.root / ".harness"
        self.harness.mkdir()
        self.log = self.harness / "events.log"

    def tearDown(self):
        self._tmp.cleanup()

    def _write(self, events: list[dict]) -> None:
        with self.log.open("w", encoding="utf-8") as f:
            for ev in events:
                f.write(json.dumps(ev) + "\n")

    def test_no_log_file(self):
        r = metrics.compute(self.log)
        self.assertEqual(r.total_events, 0)

    def test_all_time_default(self):
        self._write(
            [
                _ev("2026-04-20T00:00:00Z", "sync_completed"),
                _ev("2026-04-23T00:00:00Z", "sync_completed"),
            ]
        )
        r = metrics.compute(self.log)
        self.assertEqual(r.total_events, 2)
        self.assertIsNone(r.window_start)

    def test_period_filter(self):
        self._write(
            [
                _ev("2026-04-10T00:00:00Z", "sync_completed"),
                _ev("2026-04-20T00:00:00Z", "sync_completed"),
            ]
        )
        now = datetime(2026, 4, 23, 0, 0, 0, tzinfo=timezone.utc)
        r = metrics.compute(self.log, period=timedelta(days=7), now=now)
        self.assertEqual(r.total_events, 1)
        self.assertEqual(r.period, "7d")
        self.assertIsNotNone(r.window_start)
        self.assertIsNotNone(r.window_end)

    def test_since_filter(self):
        self._write(
            [
                _ev("2026-04-10T00:00:00Z", "sync_completed"),
                _ev("2026-04-22T00:00:00Z", "sync_completed"),
            ]
        )
        r = metrics.compute(self.log, since="2026-04-15T00:00:00Z")
        self.assertEqual(r.total_events, 1)

    def test_since_invalid_raises(self):
        with self.assertRaises(ValueError):
            metrics.compute(self.log, since="not a date")

    def test_cqs_log_mtime_unchanged(self):
        self._write(
            [_ev("2026-04-23T00:00:00Z", "sync_completed")]
        )
        before = self.log.stat().st_mtime_ns
        metrics.compute(self.log)
        metrics.compute(self.log, period=timedelta(days=1), now=datetime(2026, 4, 23, 0, 0, 0, tzinfo=timezone.utc))
        self.assertEqual(self.log.stat().st_mtime_ns, before)

    def test_since_overrides_period(self):
        """since 가 있으면 period 무시."""
        self._write(
            [
                _ev("2026-04-10T00:00:00Z", "sync_completed"),
                _ev("2026-04-20T00:00:00Z", "sync_completed"),
            ]
        )
        now = datetime(2026, 4, 23, 0, 0, 0, tzinfo=timezone.utc)
        r = metrics.compute(
            self.log,
            period=timedelta(days=1),
            since="2026-04-09T00:00:00Z",
            now=now,
        )
        self.assertEqual(r.total_events, 2)


class FormatTests(unittest.TestCase):
    def test_human_all_time_window(self):
        r = metrics.MetricsReport(total_events=5)
        out = metrics.format_human(r)
        self.assertIn("all time", out)
        self.assertIn("Total events: 5", out)

    def test_human_period_window(self):
        r = metrics.MetricsReport(period="7d", window_start="2026-04-16T00:00:00Z")
        out = metrics.format_human(r)
        self.assertIn("last 7d", out)

    def test_human_shows_lead_time(self):
        r = metrics.MetricsReport(
            lead_time_count=2,
            lead_time_min_sec=30.0,
            lead_time_max_sec=3600.0,
            lead_time_median_sec=1815.0,
            lead_time_mean_sec=1815.0,
        )
        out = metrics.format_human(r)
        self.assertIn("Lead time", out)
        self.assertIn("n=2", out)

    def test_human_gate_stats(self):
        r = metrics.MetricsReport(
            gate_stats={"gate_0": {"pass": 10, "fail": 2, "skipped": 0, "other": 0, "pass_rate": 0.833}}
        )
        out = metrics.format_human(r)
        self.assertIn("gate_0", out)
        self.assertIn("83.3%", out)

    def test_json_round_trip(self):
        r = metrics.MetricsReport(total_events=3, drift_incidents=1)
        d = r.as_dict()
        # round-trip via JSON
        out = json.loads(json.dumps(d))
        self.assertEqual(out["total_events"], 3)
        self.assertEqual(out["drift_incidents"], 1)

    def test_csv_rows(self):
        r = metrics.MetricsReport(
            total_events=2,
            event_types={"sync_completed": 2},
            gate_stats={"gate_0": {"pass": 1, "fail": 0, "skipped": 0, "other": 0, "pass_rate": 1.0}},
        )
        out = metrics.format_csv(r)
        self.assertIn("metric,key,value", out)
        self.assertIn("events,total,2", out)
        self.assertIn("gate:gate_0,pass,1", out)


class MainCLITests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.harness = self.root / ".harness"
        self.harness.mkdir()

    def tearDown(self):
        self._tmp.cleanup()

    def test_missing_harness_dir_returns_2(self):
        rc = metrics.main(["--harness-dir", str(self.root / "nonexistent")])
        self.assertEqual(rc, 2)

    def test_invalid_period_returns_2(self):
        rc = metrics.main(["--harness-dir", str(self.harness), "--period", "7xyz"])
        self.assertEqual(rc, 2)

    def test_empty_log_runs_cleanly(self):
        rc = metrics.main(["--harness-dir", str(self.harness), "--format", "json"])
        self.assertEqual(rc, 0)


if __name__ == "__main__":
    unittest.main()
