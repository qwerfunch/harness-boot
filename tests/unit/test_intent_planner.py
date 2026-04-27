"""Tests for scripts/ui/intent_planner.py (v0.9.2).

Deterministic rule coverage + dataclass shape. No I/O — all fixtures are
in-memory dicts mimicking ``state.yaml`` / ``spec.yaml``.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from ui.intent_planner import Suggestion, suggest  # noqa: E402


def _state(
    *,
    active: str | None = None,
    features: list | None = None,
) -> dict:
    return {
        "session": {"active_feature_id": active},
        "features": list(features or []),
    }


def _feature(
    fid: str,
    *,
    status: str = "planned",
    gates: dict | None = None,
    evidence: list | None = None,
) -> dict:
    return {
        "id": fid,
        "status": status,
        "gates": dict(gates or {}),
        "evidence": list(evidence or []),
    }


def _spec(*pairs: tuple[str, str]) -> dict:
    return {"features": [{"id": fid, "name": name} for fid, name in pairs]}


class SuggestionShapeTests(unittest.TestCase):
    def test_suggestion_is_frozen_dataclass(self):
        s = Suggestion(label="x", action="complete", feature_id="F-1")
        with self.assertRaises(Exception):
            s.label = "y"  # frozen

    def test_default_fields(self):
        s = Suggestion(label="x", action="init_feature")
        self.assertIsNone(s.feature_id)
        self.assertIsNone(s.gate)


class IdleTests(unittest.TestCase):
    def test_no_features_at_all(self):
        out = suggest(_state())
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0].action, "init_feature")

    def test_only_planned_features(self):
        spec = _spec(("F-1", "로그인 흐름"))
        st = _state(features=[_feature("F-1", status="planned")])
        out = suggest(st, spec)
        self.assertEqual(out[0].action, "start_feature")
        self.assertEqual(out[0].feature_id, "F-1")
        self.assertIn("로그인 흐름", out[0].label)

    def test_in_progress_no_active_pointer_resumes(self):
        """state.session.active_feature_id=None but an in_progress feature exists."""
        spec = _spec(("F-2", "대시보드"))
        st = _state(features=[_feature("F-2", status="in_progress")])
        out = suggest(st, spec)
        self.assertEqual(out[0].action, "resume")
        self.assertEqual(out[0].feature_id, "F-2")

    def test_resume_precedes_start(self):
        spec = _spec(("F-2", "대시보드"), ("F-3", "로그아웃"))
        st = _state(features=[
            _feature("F-2", status="in_progress"),
            _feature("F-3", status="planned"),
        ])
        out = suggest(st, spec)
        self.assertEqual([s.action for s in out[:2]], ["resume", "start_feature"])

    def test_fallback_when_active_id_dangling(self):
        """active_feature_id references a feature not in features[]."""
        st = _state(active="F-999", features=[_feature("F-1", status="planned")])
        out = suggest(st)
        self.assertEqual(out[0].action, "start_feature")


class IdleUnregisteredTests(unittest.TestCase):
    """v0.10.2 — state 에 in_progress · planned 가 모두 없을 때 spec 의 첫 미등록 피처 추천."""

    def test_empty_state_with_spec_features_proposes_start(self):
        spec = _spec(("F-1", "첫 피처"), ("F-2", "둘째"))
        st = _state(features=[])
        out = suggest(st, spec)
        self.assertEqual(out[0].action, "start_feature")
        self.assertEqual(out[0].feature_id, "F-1")
        self.assertIn("첫 피처", out[0].label)

    def test_planned_in_state_takes_precedence_over_spec_unregistered(self):
        spec = _spec(("F-1", "첫째"), ("F-2", "둘째"))
        st = _state(features=[_feature("F-1", status="planned")])
        out = suggest(st, spec)
        self.assertEqual(out[0].action, "start_feature")
        self.assertEqual(out[0].feature_id, "F-1")
        self.assertEqual(len(out), 1)

    def test_archived_spec_feature_skipped(self):
        spec = {
            "features": [
                {"id": "F-1", "name": "옛것", "status": "archived"},
                {"id": "F-2", "name": "현재"},
            ]
        }
        st = _state(features=[])
        out = suggest(st, spec)
        self.assertEqual(out[0].feature_id, "F-2")

    def test_superseded_by_spec_feature_skipped(self):
        spec = {
            "features": [
                {"id": "F-1", "name": "구버전", "superseded_by": "F-2"},
                {"id": "F-2", "name": "신버전"},
            ]
        }
        st = _state(features=[])
        out = suggest(st, spec)
        self.assertEqual(out[0].feature_id, "F-2")

    def test_all_spec_features_already_in_state_falls_back_to_init(self):
        spec = _spec(("F-1", "유일"))
        st = _state(features=[_feature("F-1", status="done")])
        out = suggest(st, spec)
        self.assertEqual(out[0].action, "init_feature")

    def test_resume_with_spec_unregistered_keeps_resume_first(self):
        """in_progress 가 있으면 resume 이 #1, unregistered 가 #2 로 따라옴."""
        spec = _spec(("F-1", "진행중"), ("F-9", "후보"))
        st = _state(features=[_feature("F-1", status="in_progress")])
        out = suggest(st, spec)
        self.assertEqual(out[0].action, "resume")
        self.assertEqual(out[0].feature_id, "F-1")
        self.assertEqual(out[1].action, "start_feature")
        self.assertEqual(out[1].feature_id, "F-9")


class ActiveGateProgressTests(unittest.TestCase):
    def test_no_gates_run_proposes_gate_0(self):
        st = _state(
            active="F-1",
            features=[_feature("F-1", status="in_progress")],
        )
        out = suggest(st)
        self.assertEqual(out[0].action, "run_gate")
        self.assertEqual(out[0].gate, "gate_0")

    def test_gate0_pass_proposes_gate_1(self):
        st = _state(
            active="F-1",
            features=[_feature(
                "F-1",
                status="in_progress",
                gates={"gate_0": {"last_result": "pass"}},
            )],
        )
        out = suggest(st)
        self.assertEqual(out[0].action, "run_gate")
        self.assertEqual(out[0].gate, "gate_1")

    def test_all_early_gates_pass_proposes_gate_5(self):
        passes = {f"gate_{i}": {"last_result": "pass"} for i in range(5)}
        st = _state(
            active="F-1",
            features=[_feature("F-1", status="in_progress", gates=passes)],
        )
        out = suggest(st)
        self.assertEqual(out[0].action, "run_gate")
        self.assertEqual(out[0].gate, "gate_5")


class ActiveCompletionPathTests(unittest.TestCase):
    def test_all_gates_pass_no_evidence_proposes_add_evidence(self):
        passes = {f"gate_{i}": {"last_result": "pass"} for i in range(6)}
        st = _state(
            active="F-1",
            features=[_feature("F-1", status="in_progress", gates=passes)],
        )
        out = suggest(st)
        self.assertEqual(out[0].action, "add_evidence")
        self.assertEqual(out[0].feature_id, "F-1")

    def test_all_gates_pass_with_evidence_proposes_complete(self):
        passes = {f"gate_{i}": {"last_result": "pass"} for i in range(6)}
        st = _state(
            active="F-1",
            features=[_feature(
                "F-1",
                status="in_progress",
                gates=passes,
                evidence=[{"kind": "test", "summary": "18/18 green"}],
            )],
        )
        out = suggest(st)
        self.assertEqual(out[0].action, "complete")


class ActiveFailureAndBlockTests(unittest.TestCase):
    def test_gate_fail_proposes_analyze_then_rerun(self):
        st = _state(
            active="F-1",
            features=[_feature(
                "F-1",
                status="in_progress",
                gates={
                    "gate_0": {"last_result": "pass"},
                    "gate_1": {"last_result": "fail"},
                },
            )],
        )
        out = suggest(st)
        self.assertEqual(out[0].action, "analyze_fail")
        self.assertEqual(out[0].gate, "gate_1")
        self.assertEqual(out[1].action, "run_gate")
        self.assertEqual(out[1].gate, "gate_1")

    def test_blocked_status_overrides_gate_progress(self):
        st = _state(
            active="F-1",
            features=[_feature(
                "F-1",
                status="blocked",
                gates={"gate_0": {"last_result": "pass"}},
            )],
        )
        out = suggest(st)
        self.assertEqual(out[0].action, "resolve_block")

    def test_recent_blocker_evidence_overrides(self):
        st = _state(
            active="F-1",
            features=[_feature(
                "F-1",
                status="in_progress",
                gates={"gate_0": {"last_result": "pass"}},
                evidence=[
                    {"kind": "test", "summary": "old"},
                    {"kind": "blocker", "summary": "DB down"},
                ],
            )],
        )
        out = suggest(st)
        self.assertEqual(out[0].action, "resolve_block")
        self.assertIn("F-1", out[0].feature_id)

    def test_blocker_resolved_by_later_evidence(self):
        """Once non-blocker evidence follows a blocker, we return to the flow."""
        st = _state(
            active="F-1",
            features=[_feature(
                "F-1",
                status="in_progress",
                gates={"gate_0": {"last_result": "pass"}},
                evidence=[
                    {"kind": "blocker", "summary": "DB down"},
                    {"kind": "test", "summary": "resolved — suite green"},
                ],
            )],
        )
        out = suggest(st)
        self.assertEqual(out[0].action, "run_gate")


class LimitTests(unittest.TestCase):
    def test_returns_at_most_three(self):
        passes = {f"gate_{i}": {"last_result": "pass"} for i in range(6)}
        st = _state(
            active="F-1",
            features=[_feature(
                "F-1",
                status="in_progress",
                gates=passes,
                evidence=[{"kind": "test", "summary": "x"}],
            )],
        )
        out = suggest(st)
        self.assertLessEqual(len(out), 3)


class MalformedInputTests(unittest.TestCase):
    def test_none_state(self):
        self.assertEqual(suggest(None), [])  # type: ignore[arg-type]

    def test_missing_session_treated_as_idle(self):
        out = suggest({"features": [_feature("F-1", status="planned")]})
        self.assertEqual(out[0].action, "start_feature")

    def test_features_missing_id_skipped(self):
        st = {
            "session": {"active_feature_id": None},
            "features": [{"status": "planned"}, _feature("F-1", status="planned")],
        }
        out = suggest(st)
        self.assertEqual(out[0].feature_id, "F-1")


class TitleLookupTests(unittest.TestCase):
    def test_spec_title_appears_in_active_label(self):
        spec = _spec(("F-1", "로그인 흐름"))
        st = _state(
            active="F-1",
            features=[_feature("F-1", status="in_progress")],
        )
        out = suggest(st, spec)
        # first suggestion at no-gates state is run_gate: no title in label.
        # Blocker / add_evidence / complete paths embed the title — test those.
        passes = {f"gate_{i}": {"last_result": "pass"} for i in range(6)}
        st2 = _state(
            active="F-1",
            features=[_feature(
                "F-1", status="in_progress", gates=passes,
                evidence=[{"kind": "test", "summary": "x"}],
            )],
        )
        out2 = suggest(st2, spec)
        self.assertIn("로그인 흐름", out2[0].label)

    def test_falls_back_to_fid_when_spec_missing(self):
        passes = {f"gate_{i}": {"last_result": "pass"} for i in range(6)}
        st = _state(
            active="F-42",
            features=[_feature(
                "F-42", status="in_progress", gates=passes,
                evidence=[{"kind": "test", "summary": "x"}],
            )],
        )
        out = suggest(st, None)
        self.assertIn("F-42", out[0].label)


if __name__ == "__main__":
    unittest.main()
