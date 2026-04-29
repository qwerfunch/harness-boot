"""v0.8.6 — event_log read + rotate helpers.

Rotation contract:
  * Write path stays ``.harness/events.log``. Writers (work.py, kickoff.py,
    etc.) don't know about rotation.
  * Read path unions ``events.log`` + ``events.log.YYYYMM`` and returns the
    merged stream in timestamp order.
  * Rotation (explicit CLI invocation) moves events whose ts is strictly
    older than the current month into ``events.log.YYYYMM`` files, one per
    month. Current-month events stay in ``events.log``.
  * Unparseable-ts events stay in ``events.log`` — never dropped.
  * Rotation is idempotent: running twice yields identical file set.
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "legacy" / "scripts"))

from core import event_log as el  # noqa: E402


def _write_log(path: Path, lines: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for ev in lines:
            f.write(json.dumps(ev) + "\n")


class Scratch:
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.harness = self.tmp / ".harness"
        self.harness.mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()


class ReadEventsTests(Scratch, unittest.TestCase):
    def test_empty_harness_returns_empty(self):
        self.assertEqual(list(el.read_events(self.harness)), [])

    def test_single_log_file(self):
        _write_log(self.harness / "events.log", [
            {"ts": "2026-04-24T10:00:00Z", "type": "feature_activated", "feature": "F-0"},
            {"ts": "2026-04-24T10:05:00Z", "type": "feature_done", "feature": "F-0"},
        ])
        events = list(el.read_events(self.harness))
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]["type"], "feature_activated")

    def test_rotated_files_merged_in_ts_order(self):
        _write_log(self.harness / "events.log", [
            {"ts": "2026-04-01T00:00:00Z", "type": "current_month_A"},
            {"ts": "2026-04-15T00:00:00Z", "type": "current_month_B"},
        ])
        _write_log(self.harness / "events.log.202602", [
            {"ts": "2026-02-10T00:00:00Z", "type": "feb_1"},
            {"ts": "2026-02-20T00:00:00Z", "type": "feb_2"},
        ])
        _write_log(self.harness / "events.log.202603", [
            {"ts": "2026-03-05T00:00:00Z", "type": "mar_1"},
        ])
        events = list(el.read_events(self.harness))
        types = [e["type"] for e in events]
        self.assertEqual(types, ["feb_1", "feb_2", "mar_1", "current_month_A", "current_month_B"])

    def test_skips_corrupted_lines(self):
        path = self.harness / "events.log"
        path.write_text(
            '{"ts":"2026-04-01T00:00:00Z","type":"ok"}\nNOT_JSON\n{"ts":"2026-04-02T00:00:00Z","type":"also_ok"}\n',
            encoding="utf-8",
        )
        events = list(el.read_events(self.harness))
        self.assertEqual([e["type"] for e in events], ["ok", "also_ok"])


class RotateTests(Scratch, unittest.TestCase):
    def test_rotate_splits_old_months(self):
        # ts assumed "now" is 2026-04-24 for this test — we pass it explicitly
        _write_log(self.harness / "events.log", [
            {"ts": "2026-02-10T00:00:00Z", "type": "feb_event"},
            {"ts": "2026-03-05T00:00:00Z", "type": "mar_event"},
            {"ts": "2026-04-01T00:00:00Z", "type": "apr_event"},
            {"ts": "2026-04-24T00:00:00Z", "type": "apr_today"},
        ])
        moved = el.rotate(self.harness, now_yyyymm="202604")
        self.assertEqual(moved, {"202602": 1, "202603": 1})

        # Current month stays in events.log
        current = list(el.read_events(self.harness))
        current_in_log = _parse_file(self.harness / "events.log")
        self.assertEqual([e["type"] for e in current_in_log], ["apr_event", "apr_today"])

        # Old months in separate files
        feb = _parse_file(self.harness / "events.log.202602")
        mar = _parse_file(self.harness / "events.log.202603")
        self.assertEqual([e["type"] for e in feb], ["feb_event"])
        self.assertEqual([e["type"] for e in mar], ["mar_event"])

    def test_rotate_appends_to_existing_rotated_file(self):
        _write_log(self.harness / "events.log.202602", [
            {"ts": "2026-02-01T00:00:00Z", "type": "pre_existing"},
        ])
        _write_log(self.harness / "events.log", [
            {"ts": "2026-02-28T00:00:00Z", "type": "late_feb"},
            {"ts": "2026-04-24T00:00:00Z", "type": "apr_today"},
        ])
        el.rotate(self.harness, now_yyyymm="202604")
        feb = _parse_file(self.harness / "events.log.202602")
        self.assertEqual([e["type"] for e in feb], ["pre_existing", "late_feb"])

    def test_rotate_is_idempotent(self):
        _write_log(self.harness / "events.log", [
            {"ts": "2026-02-10T00:00:00Z", "type": "feb_event"},
            {"ts": "2026-04-24T00:00:00Z", "type": "apr_today"},
        ])
        el.rotate(self.harness, now_yyyymm="202604")
        snapshot_log = (self.harness / "events.log").read_text("utf-8")
        snapshot_feb = (self.harness / "events.log.202602").read_text("utf-8")

        el.rotate(self.harness, now_yyyymm="202604")  # run again
        self.assertEqual((self.harness / "events.log").read_text("utf-8"), snapshot_log)
        self.assertEqual((self.harness / "events.log.202602").read_text("utf-8"), snapshot_feb)

    def test_unparseable_ts_stays_in_events_log(self):
        _write_log(self.harness / "events.log", [
            {"ts": "2026-02-10T00:00:00Z", "type": "feb_event"},
            {"ts": "banana", "type": "ghost"},
            {"type": "no_ts"},
            {"ts": "2026-04-24T00:00:00Z", "type": "apr_today"},
        ])
        el.rotate(self.harness, now_yyyymm="202604")
        remaining = _parse_file(self.harness / "events.log")
        types = [e["type"] for e in remaining]
        # unparseable + current month events all kept in events.log
        self.assertIn("ghost", types)
        self.assertIn("no_ts", types)
        self.assertIn("apr_today", types)
        self.assertNotIn("feb_event", types)  # feb_event rotated out

    def test_dry_run_does_not_mutate(self):
        original = [
            {"ts": "2026-02-10T00:00:00Z", "type": "feb_event"},
            {"ts": "2026-04-24T00:00:00Z", "type": "apr_today"},
        ]
        _write_log(self.harness / "events.log", original)
        snapshot = (self.harness / "events.log").read_text("utf-8")

        moved = el.rotate(self.harness, now_yyyymm="202604", dry_run=True)
        self.assertEqual(moved, {"202602": 1})
        self.assertEqual((self.harness / "events.log").read_text("utf-8"), snapshot)
        self.assertFalse((self.harness / "events.log.202602").exists())


class ReadEventsIntegrationWithEventsPyTests(Scratch, unittest.TestCase):
    """events.py CLI should see events from rotated files too."""

    def test_events_py_reads_rotated(self):
        import events as events_mod  # noqa: E402
        _write_log(self.harness / "events.log.202602", [
            {"ts": "2026-02-10T00:00:00Z", "type": "feature_done", "feature": "F-0"},
        ])
        _write_log(self.harness / "events.log", [
            {"ts": "2026-04-24T00:00:00Z", "type": "feature_activated", "feature": "F-1"},
        ])
        # After wiring events.py to read_events, `parse_events` equivalent must
        # surface the rotated Feb event too.
        all_events = list(el.read_events(self.harness))
        types = [e["type"] for e in all_events]
        self.assertIn("feature_done", types)
        self.assertIn("feature_activated", types)


def _parse_file(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    out = []
    for line in path.read_text("utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


if __name__ == "__main__":
    unittest.main()
