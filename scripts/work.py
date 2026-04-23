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

from state import State, _FEATURE_STATUSES, _GATE_RESULTS  # noqa: E402


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


def activate(harness_dir: Path, fid: str) -> WorkResult:
    """피처를 active 로 설정 + planned → in_progress 전이."""
    state = State.load(harness_dir)
    f = state.ensure_feature(fid)
    if f.get("status") == "done":
        res = _summarize(state, fid)
        res.action = "queried"
        res.message = f"{fid} is already done — no re-activation"
        return res
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
    res = _summarize(state, fid)
    res.action = "activated"
    return res


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
    """done 전이. Gate 5 가 pass 인지 사전 체크 — BR-004 (Iron Law) 준수."""
    state = State.load(harness_dir)
    f = state.ensure_feature(fid)
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
        elif args.gate:
            if not args.feature:
                print("error: feature id required with --gate", file=sys.stderr)
                return 2
            res = record_gate(
                args.harness_dir, args.feature, args.gate[0], args.gate[1], note=args.note
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
                print("error: feature id required (or use --current)", file=sys.stderr)
                return 2
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
