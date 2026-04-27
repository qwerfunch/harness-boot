"""Tests for scripts/ui/dashboard.py + scripts/work.py dashboard wiring (v0.9.2).

Two layers:

1. Pure ``dashboard.render`` tests against in-memory state/spec dicts.
2. CQS integration tests against ``work.py`` invoked with no feature id —
   verifies stdout output, no file mutation, and idempotent behavior.
"""

from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from core.state import State  # noqa: E402
from ui import dashboard  # noqa: E402
from ui.intent_planner import Suggestion, suggest  # noqa: E402
import work  # noqa: E402


def _state(*, active: str | None = None, features: list | None = None) -> dict:
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


class RenderEmptyTests(unittest.TestCase):
    def test_empty_state_shows_hint(self):
        out = dashboard.render(_state(), None, [], lang="ko")
        self.assertIn("📊 harness-boot", out)
        self.assertIn("아직 피처가 없습니다", out)

    def test_empty_state_with_suggestions(self):
        out = dashboard.render(
            _state(), None, suggest(_state(), None), lang="ko")
        self.assertIn("다음 할 일", out)
        self.assertIn("새 피처 등록", out)

    def test_only_done_features_shows_all_complete_note(self):
        st = _state(features=[_feature("F-1", status="done")])
        out = dashboard.render(st, None, [], lang="ko")
        self.assertIn("모든 피처 완료", out)


class RenderActiveBlockTests(unittest.TestCase):
    def test_active_feature_title_from_spec(self):
        spec = _spec(("F-1", "로그인 흐름"))
        st = _state(
            active="F-1",
            features=[_feature(
                "F-1",
                status="in_progress",
                gates={"gate_0": {"last_result": "pass"}},
            )],
        )
        out = dashboard.render(st, spec, [], lang="ko")
        self.assertIn('작업 중: "로그인 흐름"', out)
        self.assertIn("검증 1/6 통과", out)
        self.assertIn("근거 0 개", out)

    def test_blocker_note_rendered(self):
        st = _state(
            active="F-1",
            features=[_feature(
                "F-1",
                status="blocked",
                evidence=[{"kind": "blocker", "summary": "API 미배포"}],
            )],
        )
        out = dashboard.render(st, None, [], lang="ko")
        self.assertIn("차단: API 미배포", out)

    def test_old_blocker_suppressed_when_newer_evidence_follows(self):
        st = _state(
            active="F-1",
            features=[_feature(
                "F-1",
                status="in_progress",
                evidence=[
                    {"kind": "blocker", "summary": "과거 문제"},
                    {"kind": "test", "summary": "재검증 green"},
                ],
            )],
        )
        out = dashboard.render(st, None, [], lang="ko")
        self.assertNotIn("차단", out)

    def test_title_falls_back_to_id(self):
        st = _state(
            active="F-7",
            features=[_feature("F-7", status="in_progress")],
        )
        out = dashboard.render(st, None, [], lang="ko")
        self.assertIn('작업 중: "F-7"', out)


class RenderOtherAndPendingTests(unittest.TestCase):
    def test_other_in_progress_listed(self):
        spec = _spec(("F-1", "로그인"), ("F-2", "대시보드"))
        st = _state(
            active="F-1",
            features=[
                _feature("F-1", status="in_progress"),
                _feature("F-2", status="in_progress"),
            ],
        )
        out = dashboard.render(st, spec, [], lang="ko")
        self.assertIn("진행 중 (다른)", out)
        self.assertIn('"대시보드"', out)

    def test_pending_listed(self):
        spec = _spec(
            ("F-1", "로그인"), ("F-2", "로그아웃"), ("F-3", "설정"),
        )
        st = _state(
            active="F-1",
            features=[
                _feature("F-1", status="in_progress"),
                _feature("F-2", status="planned"),
                _feature("F-3", status="planned"),
            ],
        )
        out = dashboard.render(st, spec, [], lang="ko")
        self.assertIn("대기: ", out)
        self.assertIn('"로그아웃"', out)
        self.assertIn('"설정"', out)

    def test_active_not_in_other_list(self):
        spec = _spec(("F-1", "로그인"))
        st = _state(
            active="F-1",
            features=[_feature("F-1", status="in_progress")],
        )
        out = dashboard.render(st, spec, [], lang="ko")
        self.assertNotIn("진행 중 (다른)", out)

    def test_blocked_features_listed_separately(self):
        spec = _spec(("F-1", "로그인"), ("F-2", "결제"))
        st = _state(
            active="F-1",
            features=[
                _feature("F-1", status="in_progress"),
                _feature("F-2", status="blocked"),
            ],
        )
        out = dashboard.render(st, spec, [], lang="ko")
        self.assertIn("보류: ", out)
        self.assertIn('"결제"', out)

    def test_active_blocked_feature_not_in_blocked_list(self):
        spec = _spec(("F-1", "로그인"))
        st = _state(
            active="F-1",
            features=[_feature("F-1", status="blocked")],
        )
        out = dashboard.render(st, spec, [], lang="ko")
        self.assertNotIn("보류: ", out)


class RenderUnregisteredTests(unittest.TestCase):
    """v0.10.2 — spec 의 미등록 피처가 빈 호출 대시보드에 노출 (cosmic-suika I-002)."""

    def test_unregistered_spec_features_listed(self):
        spec = _spec(("F-1", "로그인"), ("F-2", "로그아웃"), ("F-3", "설정"))
        st = _state(features=[_feature("F-1", status="in_progress")])
        out = dashboard.render(st, spec, [], lang="ko")
        self.assertIn("다음 후보", out)
        self.assertIn("미시작", out)
        self.assertIn('"로그아웃"', out)
        self.assertIn('"설정"', out)
        self.assertIn("2 개", out)

    def test_no_unregistered_when_all_in_state(self):
        spec = _spec(("F-1", "로그인"))
        st = _state(features=[_feature("F-1", status="in_progress")])
        out = dashboard.render(st, spec, [], lang="ko")
        self.assertNotIn("다음 후보", out)

    def test_no_spec_silent(self):
        st = _state(features=[_feature("F-1", status="in_progress")])
        out = dashboard.render(st, None, [], lang="ko")
        self.assertNotIn("다음 후보", out)

    def test_archived_excluded(self):
        spec = {
            "features": [
                {"id": "F-1", "name": "로그인"},
                {"id": "F-2", "name": "옛 결제", "status": "archived"},
                {"id": "F-3", "name": "신 결제"},
            ]
        }
        st = _state(features=[_feature("F-1", status="in_progress")])
        out = dashboard.render(st, spec, [], lang="ko")
        self.assertIn('"신 결제"', out)
        self.assertNotIn('"옛 결제"', out)

    def test_superseded_by_excluded(self):
        spec = {
            "features": [
                {"id": "F-1", "name": "로그인"},
                {"id": "F-2", "name": "구버전", "superseded_by": "F-3"},
                {"id": "F-3", "name": "신버전"},
            ]
        }
        st = _state(features=[_feature("F-1", status="in_progress")])
        out = dashboard.render(st, spec, [], lang="ko")
        self.assertIn('"신버전"', out)
        self.assertNotIn('"구버전"', out)

    def test_truncates_with_hint(self):
        pairs = tuple((f"F-{i}", f"피처{i}") for i in range(1, 9))  # 8 features
        spec = _spec(*pairs)
        st = _state(features=[])
        out = dashboard.render(st, spec, [], lang="ko")
        self.assertIn("8 개", out)  # total
        self.assertIn("외 3 개", out)  # truncated count (8 - 5 cap)

    def test_unregistered_suppresses_empty_hint(self):
        """state 가 비었어도 spec 후보가 있으면 '아직 피처가 없습니다' 안 나옴."""
        spec = _spec(("F-1", "로그인"))
        st = _state(features=[])
        out = dashboard.render(st, spec, [], lang="ko")
        self.assertIn('"로그인"', out)
        self.assertNotIn("아직 피처가 없습니다", out)
        self.assertNotIn("진행 중 · 대기 피처 없음", out)


class RenderSuggestionTests(unittest.TestCase):
    def test_suggestions_numbered_with_recommended_marker(self):
        suggestions = [
            Suggestion(label="검증 실행: gate_0", action="run_gate", feature_id="F-1", gate="gate_0"),
            Suggestion(label="다른 작업으로 전환", action="deactivate"),
        ]
        out = dashboard.render(_state(), None, suggestions, lang="ko")
        self.assertIn("(1) 검증 실행: gate_0 (추천)", out)
        self.assertIn("(2) 다른 작업으로 전환", out)
        self.assertIn("Enter = 1 (추천)", out)

    def test_no_suggestions_omits_block(self):
        out = dashboard.render(_state(), None, [], lang="ko")
        self.assertNotIn("다음 할 일", out)


class RenderOutputShapeTests(unittest.TestCase):
    def test_output_ends_with_newline(self):
        out = dashboard.render(_state(), None, [], lang="ko")
        self.assertTrue(out.endswith("\n"))

    def test_first_line_is_title(self):
        out = dashboard.render(_state(), None, [], lang="ko")
        self.assertTrue(out.startswith("📊 harness-boot"))


class WorkDashboardCliTests(unittest.TestCase):
    """End-to-end CLI behavior: ``python3 scripts/work.py`` with no args."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.harness = self.tmp / ".harness"
        self.harness.mkdir()
        # F-040 — these CLI tests assert Korean strings, pin lang explicitly.
        import os
        self._lang_prev = os.environ.get("HARNESS_LANG")
        os.environ["HARNESS_LANG"] = "ko"

    def tearDown(self) -> None:
        self._tmp.cleanup()
        import os
        if self._lang_prev is None:
            os.environ.pop("HARNESS_LANG", None)
        else:
            os.environ["HARNESS_LANG"] = self._lang_prev

    def _run(self, *, json_out: bool = False) -> tuple[int, str]:
        argv = ["--harness-dir", str(self.harness)]
        if json_out:
            argv.append("--json")
        buf = io.StringIO()
        old = sys.stdout
        sys.stdout = buf
        try:
            code = work.main(argv)
        finally:
            sys.stdout = old
        return code, buf.getvalue()

    def test_no_args_emits_dashboard(self):
        code, out = self._run()
        self.assertEqual(code, 0)
        self.assertIn("📊 harness-boot", out)
        self.assertIn("다음 할 일", out)

    def test_no_args_json_emits_snapshot(self):
        code, out = self._run(json_out=True)
        self.assertEqual(code, 0)
        data = json.loads(out)
        self.assertIn("suggestions", data)
        self.assertIn("counts", data)
        self.assertIn("active_feature_id", data)

    def test_dashboard_renders_active_and_pending(self):
        st = State.load(self.harness)
        st.set_status("F-1", "in_progress")
        st.set_active("F-1")
        st.set_status("F-2", "planned")
        st.save()
        spec = {
            "features": [
                {"id": "F-1", "name": "로그인 흐름"},
                {"id": "F-2", "name": "로그아웃"},
            ]
        }
        (self.harness / "spec.yaml").write_text(
            yaml.safe_dump(spec, allow_unicode=True), encoding="utf-8"
        )
        _, out = self._run()
        self.assertIn("로그인 흐름", out)
        self.assertIn("로그아웃", out)

    def test_dashboard_cqs_no_file_mutation(self):
        st = State.load(self.harness)
        st.ensure_feature("F-1")
        st.save()
        (self.harness / "events.log").write_text(
            json.dumps({"ts": "x", "type": "sync_completed"}) + "\n",
            encoding="utf-8",
        )
        before_state = (self.harness / "state.yaml").stat().st_mtime_ns
        before_events = (self.harness / "events.log").stat().st_mtime_ns
        before_files = set(self.harness.iterdir())

        self._run()
        self._run(json_out=True)

        self.assertEqual(
            (self.harness / "state.yaml").stat().st_mtime_ns, before_state
        )
        self.assertEqual(
            (self.harness / "events.log").stat().st_mtime_ns, before_events
        )
        self.assertEqual(set(self.harness.iterdir()), before_files)

    def test_missing_harness_dir_errors(self):
        buf = io.StringIO()
        old_err, sys.stderr = sys.stderr, buf
        try:
            code = work.main(["--harness-dir", str(self.tmp / "missing")])
        finally:
            sys.stderr = old_err
        self.assertEqual(code, 2)


if __name__ == "__main__":
    unittest.main()
