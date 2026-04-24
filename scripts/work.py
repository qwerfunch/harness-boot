#!/usr/bin/env python3
"""
work.py — /harness:work (F-004) 피처 개발 사이클. v0.3 핵심.

사용:
  python3 scripts/work.py F-004                       # F-004 활성화 + Gate 실행 준비
  python3 scripts/work.py F-004 --gate gate_0 pass    # 특정 Gate 결과 기록
  python3 scripts/work.py F-004 --complete            # 모든 Gate 통과 후 done 전이
  python3 scripts/work.py --current                   # active_feature 상태 조회
  python3 scripts/work.py F-004 --evidence "test: 19 pass" --kind test
  python3 scripts/work.py F-004 --block "missing DB" --kind blocker

역할 (v0.3 범위):
  - 피처 선택 / 활성화 (state.yaml.session.active_feature_id 설정)
  - Gate 결과 기록 (state.yaml.features[*].gates)
  - Evidence 수집 (state.yaml.features[*].evidence)
  - 상태 전이: planned → in_progress → (blocked|done)

**v0.3 경계**:
  - 실제 TDD 실행 (pytest 구동, 커버리지 계산 등) 은 사용자/CI 가 담당.
    이 명령은 결과를 **기록·전이** 에 집중.
  - Gate 5 (runtime smoke) 자동 감지도 범위 밖 — 사용자가 명시적으로 통과 선언.
  - v0.4 에서 test runner · gate runner 자동화 검토.

CQS 원칙:
  - read-only 옵션 (--current) 은 파일 수정 없음.
  - 전이/기록 옵션 (--gate, --evidence, --complete) 은 events.log 에 추적 append.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:
    print("pyyaml is required", file=sys.stderr)
    sys.exit(1)

_THIS = Path(__file__).resolve().parent
if str(_THIS) not in sys.path:
    sys.path.insert(0, str(_THIS))

from ceremonies import design_review as _design_review  # noqa: E402
from ceremonies import kickoff as _kickoff  # noqa: E402
from ceremonies import retro as _retro  # noqa: E402
from core.state import State, _FEATURE_STATUSES, _GATE_RESULTS  # noqa: E402
from gate import runner as gate_runner  # noqa: E402
from ui import dashboard as _dashboard  # noqa: E402
from ui import intent_planner as _intent_planner  # noqa: E402


_STANDARD_GATES = ("gate_0", "gate_1", "gate_2", "gate_3", "gate_4", "gate_5")


@dataclass
class WorkResult:
    feature_id: str
    action: str            # activated / gate_recorded / evidence_added / completed / blocked / queried
    current_status: str
    gates_passed: list[str]
    gates_failed: list[str]
    evidence_count: int
    message: str = ""


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _append_event(harness_dir: Path, event: dict) -> None:
    log = harness_dir / "events.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")


def _load_spec(harness_dir: Path) -> dict | None:
    """Return parsed spec.yaml or None when missing/unparseable. Silent — autowire relies on absence to no-op."""
    spec_path = harness_dir / "spec.yaml"
    if not spec_path.is_file():
        return None
    try:
        data = yaml.safe_load(spec_path.read_text(encoding="utf-8"))
    except yaml.YAMLError:
        return None
    return data if isinstance(data, dict) else None


def _find_feature(spec: dict, fid: str) -> dict | None:
    for f in spec.get("features") or []:
        if isinstance(f, dict) and f.get("id") == fid:
            return f
    return None


def _autowire_kickoff(harness_dir: Path, fid: str, *, force: bool = False) -> None:
    """Fire kickoff ceremony when spec.yaml + feature resolve. Never raises — activate must not fail on ceremony errors.

    Idempotency (v0.8.2): ``kickoff.generate_kickoff`` returns without
    rewriting when the kickoff.md file already exists. Pass ``force=True``
    (via ``--kickoff`` CLI flag) to explicitly re-generate and overwrite
    any user curation.
    """
    spec = _load_spec(harness_dir)
    if spec is None:
        return
    feature = _find_feature(spec, fid)
    if feature is None:
        return
    try:
        shapes = _kickoff.detect_shapes(feature, spec=spec)
        if not shapes:
            return
        _kickoff.generate_kickoff(
            harness_dir,
            feature_id=fid,
            shapes=shapes,
            has_audio=_kickoff.has_audio(feature),
            force=force,
        )
    except Exception:
        return


def _autowire_retro(harness_dir: Path, fid: str, *, force: bool = False) -> None:
    """Fire retro ceremony after complete. Silent skip when spec.yaml missing (symmetry with kickoff).

    Idempotency (v0.8.7): ``retro.generate_retro`` is idempotent via file-exists
    check. Pass ``force=True`` (via ``--retro`` CLI flag) to explicitly
    re-generate and overwrite any user curation of the retro prose.
    """
    spec = _load_spec(harness_dir)
    if spec is None:
        return
    try:
        _retro.generate_retro(harness_dir, feature_id=fid, force=force)
    except Exception:
        return


def _autowire_design_review(
    harness_dir: Path,
    fid: str,
    *,
    force: bool = False,
) -> None:
    """Fire design-review ceremony when ux-architect has delivered flows.md (v0.8).

    Three AND conditions for auto-fire:
      1. features[F-N].ui_surface.present == true (design-review has meaning only for UI features).
      2. .harness/_workspace/design/flows.md exists (ux-architect delivered upstream).
      3. .harness/_workspace/design-review/F-N.md does NOT exist (idempotent — once per feature).

    `force=True` overrides condition (3) for explicit `--design-review` flag retries. All other
    checks still apply; no amount of forcing will emit a design-review for a feature without UI.

    Silent-swallows exceptions like kickoff/retro autowires — a ceremony glitch must not fail
    activate/record_gate/add_evidence.
    """
    spec = _load_spec(harness_dir)
    if spec is None:
        return
    feature = _find_feature(spec, fid)
    if feature is None:
        return
    ui = feature.get("ui_surface") or {}
    if ui.get("present") is not True:
        return
    flows_path = harness_dir / "_workspace" / "design" / "flows.md"
    if not flows_path.is_file():
        return
    review_path = harness_dir / "_workspace" / "design-review" / f"{fid}.md"
    if review_path.is_file() and not force:
        return
    try:
        _design_review.generate_design_review(
            harness_dir,
            feature_id=fid,
            has_audio=_kickoff.has_audio(feature),
        )
    except Exception:
        return


def _format_performance_budget(budget: dict) -> str:
    """Performance budget dict → compact one-line summary for evidence entries (v0.7.3)."""
    if not isinstance(budget, dict) or not budget:
        return ""
    parts: list[str] = []
    standard = ("lcp_ms", "inp_ms", "cls", "bundle_kb", "latency_p95_ms", "memory_rss_mb")
    for key in standard:
        if key in budget:
            parts.append(f"{key}={budget[key]}")
    custom = budget.get("custom") or []
    if isinstance(custom, list):
        for entry in custom:
            if isinstance(entry, dict) and "metric" in entry and "budget" in entry:
                parts.append(f"{entry['metric']}={entry['budget']}")
    return " · ".join(parts)


def _summarize(state: State, fid: str) -> WorkResult:
    f = state.get_feature(fid) or {}
    gates = f.get("gates", {}) or {}
    passed = [g for g, v in gates.items() if isinstance(v, dict) and v.get("last_result") == "pass"]
    failed = [g for g, v in gates.items() if isinstance(v, dict) and v.get("last_result") == "fail"]
    return WorkResult(
        feature_id=fid,
        action="queried",
        current_status=f.get("status", "planned"),
        gates_passed=passed,
        gates_failed=failed,
        evidence_count=len(f.get("evidence", []) or []),
    )


def _warn_if_ghost(harness_dir: Path, fid: str) -> None:
    """spec.yaml 은 있으나 fid 가 그 안에 없으면 stderr 경고 — v0.7.1 UX gap #1."""
    spec = _load_spec(harness_dir)
    if spec is None:
        return
    if _find_feature(spec, fid) is None:
        print(
            f"warn: {fid} not defined in spec.yaml — proceeding as ghost feature. "
            f"Use /harness:spec to register it or `--remove {fid}` to undo.",
            file=sys.stderr,
        )


def _warn_if_concurrent(state: State, fid: str) -> None:
    """다른 피처가 in_progress 인 채로 새 피처 activate 시 경고 — v0.7.1 UX gap #2."""
    others = [f for f in state.features_in_progress() if f != fid]
    if others:
        print(
            f"warn: other feature(s) still in_progress: {', '.join(others)}. "
            f"Finish or block before switching, or ignore to work in parallel.",
            file=sys.stderr,
        )


def activate(harness_dir: Path, fid: str) -> WorkResult:
    """피처를 active 로 설정 + planned → in_progress 전이."""
    state = State.load(harness_dir)
    f = state.ensure_feature(fid)
    if f.get("status") == "done":
        res = _summarize(state, fid)
        res.action = "queried"
        res.message = f"{fid} is already done — no re-activation"
        return res

    _warn_if_ghost(harness_dir, fid)
    _warn_if_concurrent(state, fid)

    state.set_active(fid)
    if f.get("status") in (None, "planned"):
        state.set_status(fid, "in_progress")
    state.set_last_command(f"/harness:work {fid}")
    state.save()

    _append_event(
        harness_dir,
        {
            "ts": _now_iso(),
            "type": "feature_activated",
            "feature": fid,
            "status": state.get_feature(fid)["status"],
        },
    )
    _autowire_kickoff(harness_dir, fid)
    _autowire_design_review(harness_dir, fid)
    res = _summarize(state, fid)
    res.action = "activated"
    return res


def deactivate(harness_dir: Path) -> WorkResult:
    """session.active_feature_id 만 None 으로. 피처 status 는 유지 — v0.7.1."""
    state = State.load(harness_dir)
    fid = state.data["session"].get("active_feature_id")
    if not fid:
        return WorkResult(
            feature_id="",
            action="queried",
            current_status="",
            gates_passed=[],
            gates_failed=[],
            evidence_count=0,
            message="no active feature to deactivate",
        )
    state.set_active(None)
    state.save()
    _append_event(
        harness_dir,
        {
            "ts": _now_iso(),
            "type": "feature_deactivated",
            "feature": fid,
        },
    )
    res = _summarize(state, fid)
    res.action = "deactivated"
    return res


def remove_feature(harness_dir: Path, fid: str) -> WorkResult:
    """state.yaml features[] 에서 항목 삭제. done 피처는 보호 — v0.7.1."""
    state = State.load(harness_dir)
    f = state.get_feature(fid)
    if f is None:
        return WorkResult(
            feature_id=fid,
            action="queried",
            current_status="",
            gates_passed=[],
            gates_failed=[],
            evidence_count=0,
            message=f"{fid} not in state — nothing to remove",
        )
    if f.get("status") == "done":
        res = _summarize(state, fid)
        res.action = "queried"
        res.message = f"cannot remove {fid} — feature is done (audit trail protected)"
        return res
    state.remove_feature(fid)
    state.save()
    _append_event(
        harness_dir,
        {
            "ts": _now_iso(),
            "type": "feature_removed",
            "feature": fid,
            "prior_status": f.get("status"),
        },
    )
    return WorkResult(
        feature_id=fid,
        action="removed",
        current_status="",
        gates_passed=[],
        gates_failed=[],
        evidence_count=0,
        message=f"{fid} removed from state",
    )


def record_gate(
    harness_dir: Path,
    fid: str,
    gate_name: str,
    result: str,
    *,
    note: str = "",
) -> WorkResult:
    if result not in _GATE_RESULTS:
        raise ValueError(f"invalid gate result {result!r}")
    state = State.load(harness_dir)
    state.ensure_feature(fid)
    state.record_gate_result(fid, gate_name, result, note=note)
    state.save()

    _append_event(
        harness_dir,
        {
            "ts": _now_iso(),
            "type": "gate_recorded",
            "feature": fid,
            "gate": gate_name,
            "result": result,
            "note": note,
        },
    )
    _autowire_design_review(harness_dir, fid)
    res = _summarize(state, fid)
    res.action = "gate_recorded"
    return res


def add_evidence(harness_dir: Path, fid: str, kind: str, summary: str) -> WorkResult:
    state = State.load(harness_dir)
    state.add_evidence(fid, kind=kind, summary=summary)
    state.save()

    _append_event(
        harness_dir,
        {
            "ts": _now_iso(),
            "type": "evidence_added",
            "feature": fid,
            "kind": kind,
            "summary": summary,
        },
    )
    _autowire_design_review(harness_dir, fid)
    res = _summarize(state, fid)
    res.action = "evidence_added"
    return res


def block(harness_dir: Path, fid: str, reason: str, *, kind: str = "blocker") -> WorkResult:
    state = State.load(harness_dir)
    state.ensure_feature(fid)
    state.set_status(fid, "blocked")
    state.add_evidence(fid, kind=kind, summary=reason)
    state.save()

    _append_event(
        harness_dir,
        {
            "ts": _now_iso(),
            "type": "feature_blocked",
            "feature": fid,
            "reason": reason,
        },
    )
    res = _summarize(state, fid)
    res.action = "blocked"
    res.message = reason
    return res


def complete(harness_dir: Path, fid: str) -> WorkResult:
    """done 전이. Gate 5 가 pass 인지 사전 체크 — BR-004 (Iron Law) 준수.

    Idempotency (v0.8.7): 이미 ``status=done`` 인 피처에 재호출하면 no-op +
    ``queried`` 반환. feature_done event 중복 발화 없음 · retro autowire
    재실행 없음. (e2e 실증에서 이 gap 이 드러남 — v0.8.2 의 kickoff 패턴과 동일.)
    """
    state = State.load(harness_dir)
    f = state.ensure_feature(fid)
    if f.get("status") == "done":
        res = _summarize(state, fid)
        res.action = "queried"
        res.message = f"{fid} is already done — no re-completion"
        return res
    gates = f.get("gates", {}) or {}
    gate5 = gates.get("gate_5", {})
    if not (isinstance(gate5, dict) and gate5.get("last_result") == "pass"):
        res = _summarize(state, fid)
        res.action = "queried"
        res.message = "cannot complete — gate_5 (runtime_smoke) not pass"
        return res
    evidence = f.get("evidence", []) or []
    if not evidence:
        res = _summarize(state, fid)
        res.action = "queried"
        res.message = "cannot complete — at least one evidence required (BR-004)"
        return res

    state.set_status(fid, "done")
    # active 해제
    if state.data["session"].get("active_feature_id") == fid:
        state.set_active(None)
    state.save()

    _append_event(
        harness_dir,
        {
            "ts": _now_iso(),
            "type": "feature_done",
            "feature": fid,
        },
    )
    _autowire_retro(harness_dir, fid)
    res = _summarize(state, fid)
    res.action = "completed"
    return res


def current(harness_dir: Path) -> WorkResult | None:
    """현재 active feature 조회. active 없으면 None."""
    state = State.load(harness_dir)
    fid = state.data["session"].get("active_feature_id")
    if not fid:
        return None
    res = _summarize(state, fid)
    res.action = "queried"
    return res


def dashboard_snapshot(harness_dir: Path) -> dict:
    """Build the no-args dashboard snapshot (CQS — read-only).

    v0.9.2 — Returns a dict consumable by ``ui.dashboard.render`` as well as
    JSON callers. Does not touch any file on disk. Used by ``main()`` when
    ``scripts/work.py`` is invoked without a feature id.
    """
    state = State.load(harness_dir)
    spec = _load_spec(harness_dir)
    suggestions = _intent_planner.suggest(state.data, spec)
    return {
        "state": state.data,
        "spec": spec,
        "suggestions": suggestions,
        "counts": state.feature_counts(),
        "active_feature_id": state.data["session"].get("active_feature_id"),
    }


def run_and_record_gate(
    harness_dir: Path,
    fid: str,
    gate_name: str,
    *,
    project_root: Path | None = None,
    override_command: list[str] | None = None,
    timeout_sec: int = 300,
    add_evidence_on_pass: bool = True,
) -> WorkResult:
    """gate_runner 로 Gate 실행 → 결과 + 요약을 state 에 기록 + events.log append.

    project_root: 테스트 러너가 돌 디렉터리. 기본은 harness_dir 의 부모.
    """
    if project_root is None:
        project_root = harness_dir.parent

    run_result = gate_runner.run_gate(
        gate_name,
        project_root,
        override_command=override_command,
        harness_dir=harness_dir,
        timeout_sec=timeout_sec,
    )

    # skipped 도 state 에 기록 — 진행 중 흔적 남기기
    state = State.load(harness_dir)
    state.ensure_feature(fid)
    note = run_result.reason or ("cmd: " + " ".join(run_result.command) if run_result.command else "")
    # 'skipped' 는 state 의 GateResult 값 중 하나 — 그대로 pass 가능
    state.record_gate_result(fid, gate_name, run_result.result, note=note)

    if run_result.result == "pass" and add_evidence_on_pass:
        summary = f"Gate {gate_name} pass ({run_result.duration_sec:.1f}s)"
        if run_result.command:
            summary += " · cmd: " + " ".join(run_result.command)
        if gate_name == "gate_perf":
            spec = _load_spec(harness_dir)
            feature = _find_feature(spec, fid) if spec else None
            budget_summary = _format_performance_budget(
                (feature or {}).get("performance_budget") or {}
            )
            if budget_summary:
                summary += f" · budget: {budget_summary}"
        state.add_evidence(fid, kind="gate_run", summary=summary)

    state.save()

    _append_event(
        harness_dir,
        {
            "ts": _now_iso(),
            "type": "gate_auto_run",
            "feature": fid,
            "gate": gate_name,
            "result": run_result.result,
            "exit_code": run_result.exit_code,
            "duration_sec": round(run_result.duration_sec, 3),
            "reason": run_result.reason,
        },
    )
    _autowire_design_review(harness_dir, fid)

    res = _summarize(state, fid)
    res.action = "gate_auto_run"
    res.message = (
        f"{gate_name} {run_result.result.upper()}"
        + (f" — {run_result.reason}" if run_result.reason else "")
    )
    return res


def _result_to_dict(r: WorkResult) -> dict:
    return {
        "feature_id": r.feature_id,
        "action": r.action,
        "current_status": r.current_status,
        "gates_passed": r.gates_passed,
        "gates_failed": r.gates_failed,
        "evidence_count": r.evidence_count,
        "message": r.message,
    }


def format_human(r: WorkResult) -> str:
    lines = [f"🛠  /harness:work · {r.action} · {r.feature_id}", ""]
    lines.append(f"status: {r.current_status}")
    if r.gates_passed:
        lines.append(f"passed: {', '.join(r.gates_passed)}")
    if r.gates_failed:
        lines.append(f"failed: {', '.join(r.gates_failed)}")
    lines.append(f"evidence: {r.evidence_count} entries")
    if r.message:
        lines.append("")
        lines.append(r.message)
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="/harness:work (F-004) — feature cycle")
    parser.add_argument("feature", nargs="?", help="feature id (e.g. F-004)")
    parser.add_argument("--harness-dir", type=Path, default=Path.cwd() / ".harness")
    parser.add_argument("--current", action="store_true", help="show active feature")
    parser.add_argument(
        "--gate", nargs=2, metavar=("NAME", "RESULT"), help="record gate result (pass/fail/skipped)"
    )
    parser.add_argument(
        "--run-gate",
        metavar="NAME",
        default=None,
        help="auto-run gate (v0.3.1: gate_0) and record result + evidence",
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=None,
        help="cwd for --run-gate (default: harness-dir parent)",
    )
    parser.add_argument(
        "--override-command",
        default=None,
        help="override gate command (space-separated)",
    )
    parser.add_argument("--timeout", type=int, default=300, help="timeout for --run-gate")
    parser.add_argument("--note", default="", help="note for --gate")
    parser.add_argument(
        "--evidence", default=None, help="add evidence with this summary"
    )
    parser.add_argument("--kind", default="generic", help="kind for --evidence or --block")
    parser.add_argument(
        "--block", default=None, help="block feature with this reason"
    )
    parser.add_argument(
        "--complete", action="store_true", help="transition to done (requires gate_5 pass + evidence)"
    )
    parser.add_argument(
        "--deactivate",
        action="store_true",
        help="clear session.active_feature_id without changing feature status (v0.7.1)",
    )
    parser.add_argument(
        "--design-review",
        action="store_true",
        help="force re-generate .harness/_workspace/design-review/F-N.md (v0.8 — overrides idempotent skip)",
    )
    parser.add_argument(
        "--kickoff",
        action="store_true",
        help="force re-generate .harness/_workspace/kickoff/F-N.md (v0.8.2 — overrides idempotent skip)",
    )
    parser.add_argument(
        "--retro",
        action="store_true",
        help="force re-generate .harness/_workspace/retro/F-N.md (v0.8.7 — overrides idempotent skip)",
    )
    parser.add_argument(
        "--remove",
        metavar="FID",
        default=None,
        help="delete feature entry from state.yaml (ghost cleanup). done features protected. (v0.7.1)",
    )
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    if not args.harness_dir.is_dir():
        print(f"error: {args.harness_dir} not found", file=sys.stderr)
        return 2

    try:
        if args.current:
            res = current(args.harness_dir)
            if res is None:
                out = {"message": "no active feature"}
                if args.json:
                    json.dump(out, sys.stdout, indent=2)
                    print()
                else:
                    print("no active feature")
                return 0
        elif args.deactivate:
            res = deactivate(args.harness_dir)
        elif args.remove:
            res = remove_feature(args.harness_dir, args.remove)
        elif args.design_review:
            if not args.feature:
                print("error: feature id required with --design-review", file=sys.stderr)
                return 2
            _autowire_design_review(args.harness_dir, args.feature, force=True)
            res = _summarize(State.load(args.harness_dir), args.feature)
            res.action = "design_review_refreshed"
        elif args.kickoff:
            if not args.feature:
                print("error: feature id required with --kickoff", file=sys.stderr)
                return 2
            _autowire_kickoff(args.harness_dir, args.feature, force=True)
            res = _summarize(State.load(args.harness_dir), args.feature)
            res.action = "kickoff_refreshed"
        elif args.retro:
            if not args.feature:
                print("error: feature id required with --retro", file=sys.stderr)
                return 2
            _autowire_retro(args.harness_dir, args.feature, force=True)
            res = _summarize(State.load(args.harness_dir), args.feature)
            res.action = "retro_refreshed"
        elif args.gate:
            if not args.feature:
                print("error: feature id required with --gate", file=sys.stderr)
                return 2
            res = record_gate(
                args.harness_dir, args.feature, args.gate[0], args.gate[1], note=args.note
            )
        elif args.run_gate:
            if not args.feature:
                print("error: feature id required with --run-gate", file=sys.stderr)
                return 2
            override = args.override_command.split() if args.override_command else None
            res = run_and_record_gate(
                args.harness_dir,
                args.feature,
                args.run_gate,
                project_root=args.project_root,
                override_command=override,
                timeout_sec=args.timeout,
            )
        elif args.evidence:
            if not args.feature:
                print("error: feature id required with --evidence", file=sys.stderr)
                return 2
            res = add_evidence(args.harness_dir, args.feature, args.kind, args.evidence)
        elif args.block:
            if not args.feature:
                print("error: feature id required with --block", file=sys.stderr)
                return 2
            res = block(args.harness_dir, args.feature, args.block, kind=args.kind)
        elif args.complete:
            if not args.feature:
                print("error: feature id required with --complete", file=sys.stderr)
                return 2
            res = complete(args.harness_dir, args.feature)
        else:
            if not args.feature:
                # v0.9.2 — no-args 진입점 = 대시보드 (CQS · 읽기 전용).
                snap = dashboard_snapshot(args.harness_dir)
                if args.json:
                    out = {
                        "active_feature_id": snap["active_feature_id"],
                        "counts": snap["counts"],
                        "suggestions": [
                            {
                                "label": s.label,
                                "action": s.action,
                                "feature_id": s.feature_id,
                                "gate": s.gate,
                            }
                            for s in snap["suggestions"]
                        ],
                    }
                    json.dump(out, sys.stdout, indent=2, ensure_ascii=False)
                    print()
                else:
                    sys.stdout.write(
                        _dashboard.render(
                            snap["state"], snap["spec"], snap["suggestions"]
                        )
                    )
                return 0
            res = activate(args.harness_dir, args.feature)
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 3

    if args.json:
        json.dump(_result_to_dict(res), sys.stdout, indent=2, ensure_ascii=False)
        print()
    else:
        sys.stdout.write(format_human(res))

    return 0


if __name__ == "__main__":
    sys.exit(main())
