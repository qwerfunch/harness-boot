#!/usr/bin/env python3
"""
status.py — /harness:status (F-005) 구현. Read-only, CQS.

사용:
  python3 scripts/status.py                           # cwd .harness 기준 human 출력
  python3 scripts/status.py --harness-dir DIR
  python3 scripts/status.py --json                    # 기계 파싱용
  python3 scripts/status.py --feature F-003           # 단일 피처 상세

CQS 불변조건: 파일 **수정 없음**. mtime 변경 안 함 (테스트 검증).

출력 섹션:
  1. session — active_feature · last_command · last_gate_passed
  2. feature counts (planned/in_progress/blocked/done/archived)
  3. drift_status (harness.yaml 에서)
  4. recent evidence (feature 별 최근 1~3 개)
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("pyyaml is required", file=sys.stderr)
    sys.exit(1)

_THIS = Path(__file__).resolve().parent
if str(_THIS) not in sys.path:
    sys.path.insert(0, str(_THIS))

from state import State  # noqa: E402


@dataclass
class StatusReport:
    session: dict
    counts: dict
    drift_status: str
    last_sync: dict | None
    features_summary: list[dict]
    active_feature: dict | None


def _load_harness_yaml(harness_dir: Path) -> dict:
    path = harness_dir / "harness.yaml"
    if not path.is_file():
        return {}
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data if isinstance(data, dict) else {}


def _tail_events(harness_dir: Path, n: int = 1) -> list[dict]:
    """events.log 의 마지막 n 개를 JSON 디코드해서 반환. 실패 라인은 skip."""
    path = harness_dir / "events.log"
    if not path.is_file():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()[-n:]
    out = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def build_report(harness_dir: Path, *, feature_filter: str | None = None) -> StatusReport:
    """state.yaml + harness.yaml + events.log 를 읽어 StatusReport 생성."""
    st = State.load(harness_dir)
    harness_yaml = _load_harness_yaml(harness_dir)

    drift_status = harness_yaml.get("generation", {}).get("drift_status", "unknown")

    last_sync_events = _tail_events(harness_dir, n=5)
    last_sync = None
    for ev in reversed(last_sync_events):
        if ev.get("type") == "sync_completed":
            last_sync = {
                "ts": ev.get("ts"),
                "spec_hash": ev.get("spec_hash", "")[:12],
                "plugin_version": ev.get("plugin_version"),
            }
            break

    counts = st.feature_counts()

    # feature 요약 — filter 가 있으면 그 하나만, 없으면 전체 간단히
    features_summary: list[dict] = []
    for f in st.data["features"]:
        if not isinstance(f, dict):
            continue
        fid = f.get("id", "?")
        if feature_filter and fid != feature_filter:
            continue
        gates = f.get("gates", {}) or {}
        passed = [g for g, v in gates.items() if isinstance(v, dict) and v.get("last_result") == "pass"]
        failed = [g for g, v in gates.items() if isinstance(v, dict) and v.get("last_result") == "fail"]
        features_summary.append(
            {
                "id": fid,
                "status": f.get("status", "planned"),
                "started_at": f.get("started_at"),
                "completed_at": f.get("completed_at"),
                "gates_passed": passed,
                "gates_failed": failed,
                "evidence_count": len(f.get("evidence", []) or []),
            }
        )

    active_fid = st.data["session"].get("active_feature_id")
    active_feature = next(
        (f for f in features_summary if f["id"] == active_fid), None
    ) if active_fid else None

    return StatusReport(
        session=dict(st.data["session"]),
        counts=counts,
        drift_status=drift_status,
        last_sync=last_sync,
        features_summary=features_summary,
        active_feature=active_feature,
    )


def format_human(report: StatusReport) -> str:
    lines = ["📋 /harness:status"]
    lines.append("")

    s = report.session
    lines.append(f"Session")
    lines.append(f"  started_at         {s.get('started_at') or '—'}")
    lines.append(f"  last_command       {s.get('last_command') or '—'}")
    lines.append(f"  last_gate_passed   {s.get('last_gate_passed') or '—'}")
    lines.append(f"  active_feature_id  {s.get('active_feature_id') or '—'}")
    lines.append("")

    c = report.counts
    total = sum(c.values())
    lines.append(f"Features ({total})")
    for st, n in c.items():
        if n:
            lines.append(f"  {st:12} {n}")
    lines.append("")

    lines.append(f"Drift status: {report.drift_status}")
    lines.append("")

    if report.last_sync:
        ls = report.last_sync
        lines.append(f"Last sync: {ls['ts']} · spec_hash={ls['spec_hash']} · plugin={ls['plugin_version']}")
        lines.append("")

    if report.active_feature:
        af = report.active_feature
        lines.append(f"Active feature: {af['id']} [{af['status']}]")
        if af.get("gates_passed"):
            lines.append(f"  gates passed: {', '.join(af['gates_passed'])}")
        if af.get("gates_failed"):
            lines.append(f"  gates failed: {', '.join(af['gates_failed'])}")
        lines.append(f"  evidence: {af['evidence_count']} entries")
        lines.append("")

    if not report.active_feature and report.features_summary:
        # filter 가 없을 때는 간단한 표만, 없으면 skip
        pass

    return "\n".join(lines).rstrip() + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="/harness:status (F-005) — read-only state view")
    parser.add_argument(
        "--harness-dir",
        type=Path,
        default=Path.cwd() / ".harness",
    )
    parser.add_argument("--feature", default=None, help="restrict to a single feature id")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    if not args.harness_dir.is_dir():
        print(f"error: {args.harness_dir} not found", file=sys.stderr)
        return 2

    report = build_report(args.harness_dir, feature_filter=args.feature)

    if args.json:
        json.dump(
            {
                "session": report.session,
                "counts": report.counts,
                "drift_status": report.drift_status,
                "last_sync": report.last_sync,
                "features": report.features_summary,
                "active_feature": report.active_feature,
            },
            sys.stdout,
            indent=2,
            ensure_ascii=False,
        )
        print()
    else:
        sys.stdout.write(format_human(report))

    return 0


if __name__ == "__main__":
    sys.exit(main())
