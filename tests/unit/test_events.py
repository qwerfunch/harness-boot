"""Tests for scripts/events.py (F-007) — read-only CQS."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "legacy" / "scripts"))

import events as ev_module  # noqa: E402


class HarnessScratch:
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.harness = self.tmp / ".harness"
        self.harness.mkdir()
        self.log = self.harness / "events.log"

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def write_events(self, events: list[dict]) -> None:
        self.log.write_text(
            "\n".join(json.dumps(e, ensure_ascii=False) for e in events) + "\n",
            encoding="utf-8",
        )


class ParseTests(HarnessScratch, unittest.TestCase):
    def test_empty_log(self):
        self.assertEqual(list(ev_module.parse_events(self.log)), [])

    def test_missing_log(self):
        # log 가 처음부터 없을 때 (setUp 은 harness 디렉터리만 만들고 log 는 생성 안 함)
        self.assertFalse(self.log.exists())
        self.assertEqual(list(ev_module.parse_events(self.log)), [])

    def test_parse_multiple_events(self):
        self.write_events(
            [
                {"ts": "2026-04-23T01:00:00Z", "type": "harness_initialized"},
                {"ts": "2026-04-23T02:00:00Z", "type": "sync_completed"},
            ]
        )
        parsed = list(ev_module.parse_events(self.log))
        self.assertEqual(len(parsed), 2)
        self.assertEqual(parsed[0]["type"], "harness_initialized")

    def test_broken_line_skipped(self):
        self.log.write_text(
            json.dumps({"ts": "t", "type": "ok"}) + "\n{not json}\n" +
            json.dumps({"ts": "t2", "type": "ok2"}) + "\n",
            encoding="utf-8",
        )
        parsed = list(ev_module.parse_events(self.log))
        self.assertEqual(len(parsed), 2)


class FilterTests(unittest.TestCase):
    EVENTS = [
        {"ts": "2026-04-23T01:00:00Z", "type": "harness_initialized"},
        {"ts": "2026-04-23T02:00:00Z", "type": "sync_completed", "feature": "F-003"},
        {"ts": "2026-04-23T03:00:00Z", "type": "sync_completed", "feature": "F-004"},
        {"ts": "2026-04-23T04:00:00Z", "type": "sync_failed", "reason": "schema_validation"},
    ]

    def test_no_filter_returns_all(self):
        out = ev_module.filter_events(self.EVENTS)
        self.assertEqual(len(out), 4)

    def test_kind_filter(self):
        out = ev_module.filter_events(self.EVENTS, kind="sync_completed")
        self.assertEqual(len(out), 2)

    def test_feature_filter(self):
        out = ev_module.filter_events(self.EVENTS, feature="F-003")
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["feature"], "F-003")

    def test_since_filter(self):
        out = ev_module.filter_events(self.EVENTS, since="2026-04-23T02:30:00Z")
        self.assertEqual(len(out), 2)
        self.assertEqual(out[0]["ts"], "2026-04-23T03:00:00Z")

    def test_combined_filters(self):
        out = ev_module.filter_events(
            self.EVENTS, kind="sync_completed", since="2026-04-23T02:30:00Z"
        )
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["feature"], "F-004")


class FormatTests(unittest.TestCase):
    def test_no_matches_message(self):
        out = ev_module.format_human([])
        self.assertIn("no matching", out)

    def test_human_format_contains_fields(self):
        out = ev_module.format_human(
            [{"ts": "2026-04-23T01:00:00Z", "type": "sync_completed", "spec_hash": "a" * 64}]
        )
        self.assertIn("sync_completed", out)
        self.assertIn("spec_hash=aaaaaaaaaaaa", out)  # truncated to 12


class CQSTests(HarnessScratch, unittest.TestCase):
    def test_events_log_mtime_unchanged(self):
        self.write_events([{"ts": "t", "type": "x"}])
        before = self.log.stat().st_mtime_ns

        # 다양한 조합 실행
        list(ev_module.parse_events(self.log))
        ev_module.filter_events(list(ev_module.parse_events(self.log)), kind="x")

        self.assertEqual(self.log.stat().st_mtime_ns, before)


if __name__ == "__main__":
    unittest.main()
