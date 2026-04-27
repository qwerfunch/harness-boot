"""Iron Law D — cumulative declared evidence tests (v0.9.3).

Covers ``scripts/core/state.py`` helpers (``is_declared_evidence``,
``count_declared_evidence``) and ``scripts/work.py::complete`` enforcement:

- kind taxonomy (automatic vs declared)
- trailing 7-day window
- product mode default (N=3) vs prototype mode (N=1)
- ``--hotfix-reason`` override (collapses to 1, records kind=hotfix evidence)
- rejection leaves state.yaml clean
"""

from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import work  # noqa: E402
from core.state import (  # noqa: E402
    State,
    count_declared_evidence,
    is_declared_evidence,
)


class HarnessScratch:
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.harness = self.tmp / ".harness"
        self.harness.mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def write_spec(self, mode: str | None = None) -> None:
        spec: dict = {"version": "2.3.8", "features": [{"id": "F-1", "name": "test"}]}
        if mode:
            spec["project"] = {"name": "sample", "mode": mode}
        (self.harness / "spec.yaml").write_text(
            yaml.safe_dump(spec, allow_unicode=True), encoding="utf-8"
        )

    def read_events(self) -> list[dict]:
        log = self.harness / "events.log"
        if not log.is_file():
            return []
        return [
            json.loads(l)
            for l in log.read_text(encoding="utf-8").splitlines() if l.strip()
        ]


class KindTaxonomyTests(unittest.TestCase):
    def test_gate_run_is_automatic(self):
        self.assertFalse(is_declared_evidence({"kind": "gate_run", "summary": "x"}))

    def test_gate_auto_run_is_automatic(self):
        self.assertFalse(is_declared_evidence({"kind": "gate_auto_run", "summary": "x"}))

    def test_test_kind_is_declared(self):
        self.assertTrue(is_declared_evidence({"kind": "test", "summary": "x"}))

    def test_manual_check_is_declared(self):
        self.assertTrue(is_declared_evidence({"kind": "manual_check", "summary": "x"}))

    def test_user_feedback_is_declared(self):
        self.assertTrue(is_declared_evidence({"kind": "user_feedback", "summary": "x"}))

    def test_reviewer_check_is_declared(self):
        self.assertTrue(is_declared_evidence({"kind": "reviewer_check", "summary": "x"}))

    def test_blocker_is_declared(self):
        self.assertTrue(is_declared_evidence({"kind": "blocker", "summary": "x"}))

    def test_hotfix_is_declared(self):
        self.assertTrue(is_declared_evidence({"kind": "hotfix", "summary": "x"}))

    def test_missing_kind_is_declared(self):
        """Conservative — no classification means we assume intent."""
        self.assertTrue(is_declared_evidence({"summary": "x"}))

    def test_non_dict_is_not_declared(self):
        self.assertFalse(is_declared_evidence("string"))
        self.assertFalse(is_declared_evidence(None))


class CountWindowTests(unittest.TestCase):
    def _mk(self, *evidence: dict) -> dict:
        return {"evidence": list(evidence)}

    def test_counts_only_declared(self):
        now = datetime(2026, 4, 25, tzinfo=timezone.utc)
        f = self._mk(
            {"kind": "test", "ts": now.isoformat()},
            {"kind": "gate_run", "ts": now.isoformat()},
            {"kind": "gate_auto_run", "ts": now.isoformat()},
            {"kind": "manual_check", "ts": now.isoformat()},
        )
        self.assertEqual(count_declared_evidence(f, now=now), 2)

    def test_excludes_entries_older_than_window(self):
        now = datetime(2026, 4, 25, tzinfo=timezone.utc)
        old = (now - timedelta(days=10)).isoformat()
        recent = (now - timedelta(days=1)).isoformat()
        f = self._mk(
            {"kind": "test", "ts": old},
            {"kind": "test", "ts": recent},
        )
        self.assertEqual(count_declared_evidence(f, window_days=7, now=now), 1)

    def test_missing_ts_counts_as_recent(self):
        now = datetime(2026, 4, 25, tzinfo=timezone.utc)
        f = self._mk({"kind": "test", "summary": "no timestamp"})
        self.assertEqual(count_declared_evidence(f, now=now), 1)

    def test_unparseable_ts_counts_as_recent(self):
        now = datetime(2026, 4, 25, tzinfo=timezone.utc)
        f = self._mk({"kind": "test", "ts": "not-a-date", "summary": "x"})
        self.assertEqual(count_declared_evidence(f, now=now), 1)

    def test_zero_day_window_only_counts_undated(self):
        now = datetime(2026, 4, 25, tzinfo=timezone.utc)
        f = self._mk(
            {"kind": "test", "ts": now.isoformat()},
            {"kind": "test", "summary": "no ts"},
        )
        self.assertEqual(count_declared_evidence(f, window_days=0, now=now), 2)

    def test_empty_feature(self):
        self.assertEqual(count_declared_evidence({}), 0)
        self.assertEqual(count_declared_evidence({"evidence": []}), 0)

    def test_non_dict_feature(self):
        self.assertEqual(count_declared_evidence(None), 0)  # type: ignore[arg-type]


class ProductModeCompleteTests(HarnessScratch, unittest.TestCase):
    """Default mode = product → need 3 declared evidence."""

    def test_0_declared_rejects(self):
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "queried")
        self.assertIn("Iron Law D", res.message)
        self.assertIn("0/3", res.message)
        self.assertIn("product", res.message)

    def test_2_declared_rejects(self):
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        work.add_evidence(self.harness, "F-1", "test", "a")
        work.add_evidence(self.harness, "F-1", "manual_check", "b")
        res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "queried")
        self.assertIn("2/3", res.message)

    def test_3_declared_completes(self):
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        work.add_evidence(self.harness, "F-1", "test", "a")
        work.add_evidence(self.harness, "F-1", "manual_check", "b")
        work.add_evidence(self.harness, "F-1", "reviewer_check", "c")
        res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "completed")

    def test_automatic_gate_run_does_not_count(self):
        """2 manual + 5 auto gate_run entries still rejected under product."""
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        for _ in range(5):
            work.add_evidence(self.harness, "F-1", "gate_run", "auto")
        work.add_evidence(self.harness, "F-1", "test", "declared 1")
        work.add_evidence(self.harness, "F-1", "manual_check", "declared 2")
        res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "queried")
        self.assertIn("2/3", res.message)


class ProductModeFailedGateTests(HarnessScratch, unittest.TestCase):
    """v0.10.3 — product mode strict: 어떤 declared gate 라도 fail 이면 complete 거부.

    cosmic-suika I-008 환원: 이전엔 gate_5 pass + declared evidence 만 검증해
    gate_2 (lint) fail 이 있어도 complete 가 통과되었다. product 모드는 이제
    record 된 모든 gate 의 last_result 가 fail 이 아닐 때만 통과. prototype
    모드는 lighter contract 유지 (현행).

    면제: hotfix_reason — emergency override 는 hotfix evidence audit trail.
    skipped 또는 unrecorded gate 는 사용자 의도 (특정 gate 안 돌림) 로 보고
    검증 대상 아님.
    """

    def _setup_3_declared_with_gate5_pass(self) -> None:
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        work.add_evidence(self.harness, "F-1", "test", "a")
        work.add_evidence(self.harness, "F-1", "manual_check", "b")
        work.add_evidence(self.harness, "F-1", "reviewer_check", "c")

    def test_failed_gate_rejects_in_product_mode(self):
        self._setup_3_declared_with_gate5_pass()
        work.record_gate(self.harness, "F-1", "gate_2", "fail")
        res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "queried")
        self.assertIn("product mode strict", res.message)
        self.assertIn("gate_2", res.message)

    def test_failed_gate_does_not_block_in_prototype_mode(self):
        self.write_spec(mode="prototype")
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        work.record_gate(self.harness, "F-1", "gate_2", "fail")
        work.add_evidence(self.harness, "F-1", "test", "a")
        res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "completed")

    def test_multiple_failed_gates_listed_in_message(self):
        self._setup_3_declared_with_gate5_pass()
        work.record_gate(self.harness, "F-1", "gate_1", "fail")
        work.record_gate(self.harness, "F-1", "gate_2", "fail")
        res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "queried")
        self.assertIn("gate_1", res.message)
        self.assertIn("gate_2", res.message)

    def test_skipped_gate_does_not_block(self):
        """skipped 는 사용자 의도 (도구 미설치 등) — fail 과 다르게 면제."""
        self._setup_3_declared_with_gate5_pass()
        work.record_gate(self.harness, "F-1", "gate_2", "skipped")
        res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "completed")

    def test_unrecorded_gate_does_not_block(self):
        """gate_0~4 record 안 한 채 gate_5 만 돌렸어도 complete 가능 (record-based)."""
        self._setup_3_declared_with_gate5_pass()
        res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "completed")

    def test_hotfix_bypasses_product_strict(self):
        """hotfix_reason 은 strict 검증을 우회. audit trail 은 hotfix evidence 로 남음."""
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        work.record_gate(self.harness, "F-1", "gate_2", "fail")
        res = work.complete(self.harness, "F-1", hotfix_reason="prod outage — fix asap")
        self.assertEqual(res.action, "completed")

    def test_rerun_pass_after_fail_completes(self):
        """fail 으로 reject 됐다 동일 gate 를 pass 로 재기록하면 complete 통과."""
        self._setup_3_declared_with_gate5_pass()
        work.record_gate(self.harness, "F-1", "gate_2", "fail")
        rejected = work.complete(self.harness, "F-1")
        self.assertEqual(rejected.action, "queried")
        work.record_gate(self.harness, "F-1", "gate_2", "pass")
        res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "completed")

    def test_state_unchanged_when_strict_rejects(self):
        """reject 시 state.yaml 수정 없음 (idempotent)."""
        self._setup_3_declared_with_gate5_pass()
        work.record_gate(self.harness, "F-1", "gate_2", "fail")
        before = (self.harness / "state.yaml").read_text(encoding="utf-8")
        work.complete(self.harness, "F-1")
        after = (self.harness / "state.yaml").read_text(encoding="utf-8")
        self.assertEqual(before, after)


class PrototypeModeCompleteTests(HarnessScratch, unittest.TestCase):
    """Mode=prototype → need 1 declared evidence."""

    def test_1_declared_completes(self):
        self.write_spec(mode="prototype")
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        work.add_evidence(self.harness, "F-1", "test", "a")
        res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "completed")

    def test_0_declared_rejects_with_1_target(self):
        self.write_spec(mode="prototype")
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "queried")
        self.assertIn("0/1", res.message)
        self.assertIn("prototype", res.message)


class ModeResolutionTests(HarnessScratch, unittest.TestCase):
    def test_unknown_mode_falls_back_to_product(self):
        self.write_spec(mode="experimental")  # not a recognized value
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        work.add_evidence(self.harness, "F-1", "test", "a")
        res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "queried")
        self.assertIn("1/3", res.message)  # product required

    def test_spec_missing_defaults_to_product(self):
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        work.add_evidence(self.harness, "F-1", "test", "a")
        res = work.complete(self.harness, "F-1")
        self.assertIn("product", res.message)

    def test_project_key_missing_defaults_to_product(self):
        (self.harness / "spec.yaml").write_text(
            yaml.safe_dump({"version": "2.3.8", "features": [{"id": "F-1", "name": "x"}]}),
            encoding="utf-8",
        )
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        res = work.complete(self.harness, "F-1")
        self.assertIn("product", res.message)


class HotfixOverrideTests(HarnessScratch, unittest.TestCase):
    def test_hotfix_allows_product_with_1_entry(self):
        """Hotfix collapses product N=3 to N=1, and the hotfix reason itself counts."""
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        res = work.complete(
            self.harness, "F-1", hotfix_reason="prod down — redis race",
        )
        self.assertEqual(res.action, "completed")
        st = State.load(self.harness)
        f = st.get_feature("F-1")
        kinds = [e.get("kind") for e in f.get("evidence") or []]
        self.assertIn("hotfix", kinds)

    def test_hotfix_reason_recorded_in_event(self):
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        work.complete(self.harness, "F-1", hotfix_reason="db rollover incident")
        done = next(e for e in self.read_events() if e["type"] == "feature_done")
        self.assertEqual(done["hotfix_reason"], "db rollover incident")
        self.assertEqual(done["required"], 1)

    def test_empty_hotfix_reason_rejected(self):
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        work.add_evidence(self.harness, "F-1", "test", "a")
        res = work.complete(self.harness, "F-1", hotfix_reason="   ")
        self.assertEqual(res.action, "queried")
        self.assertIn("hotfix", res.message.lower())

    def test_hotfix_without_gate5_still_rejected(self):
        work.activate(self.harness, "F-1")
        res = work.complete(self.harness, "F-1", hotfix_reason="oops")
        self.assertEqual(res.action, "queried")
        self.assertIn("gate_5", res.message)

    def test_hotfix_rejection_does_not_leak_evidence_noise(self):
        """If hotfix still under-satisfies (window 0 + required 1) the added
        entry must not persist. Window 0 is unreachable in prod but tests the
        rollback path."""
        # Impossible to fail hotfix when reason adds exactly 1 declared, but we
        # simulate by seeding a feature where reason is whitespace → rejected
        # path validates no evidence was persisted.
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        before = len(State.load(self.harness).get_feature("F-1").get("evidence") or [])
        work.complete(self.harness, "F-1", hotfix_reason="")
        after = len(State.load(self.harness).get_feature("F-1").get("evidence") or [])
        self.assertEqual(before, after)


class CompleteEventMetadataTests(HarnessScratch, unittest.TestCase):
    def test_feature_done_event_includes_mode_and_counts(self):
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        for kind in ("test", "manual_check", "reviewer_check"):
            work.add_evidence(self.harness, "F-1", kind, "x")
        work.complete(self.harness, "F-1")
        done = next(e for e in self.read_events() if e["type"] == "feature_done")
        self.assertEqual(done["iron_law_mode"], "product")
        self.assertEqual(done["required"], 3)
        self.assertGreaterEqual(done["declared_count"], 3)


class HotfixCliTests(HarnessScratch, unittest.TestCase):
    def test_hotfix_flag_wires_through_main(self):
        work.activate(self.harness, "F-1")
        work.record_gate(self.harness, "F-1", "gate_5", "pass")
        buf = io.StringIO()
        old = sys.stdout
        sys.stdout = buf
        try:
            rc = work.main([
                "F-1",
                "--harness-dir", str(self.harness),
                "--complete",
                "--hotfix-reason", "db rollover",
                "--json",
            ])
        finally:
            sys.stdout = old
        self.assertEqual(rc, 0)
        data = json.loads(buf.getvalue())
        self.assertEqual(data["action"], "completed")


if __name__ == "__main__":
    unittest.main()
