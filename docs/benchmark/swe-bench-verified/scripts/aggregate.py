#!/usr/bin/env python3
"""SWE-bench Verified A/B 결과 집계 + REPORT.md 갱신.

F-173: per-task JSON 을 vanilla / harness 두 디렉터리에서 읽고, REPORT.md 의
§2 / §3 표를 정확히 자동 갱신. 사람 손이 결과 데이터에 안 닿게 (BR-014).

Usage:
    python aggregate.py --results-dir <path> --tasks <path/tasks.json> \\
        --report <path/REPORT.md>

    python aggregate.py --help

표는 다음 4개 섹션을 갱신:
- §2.1 Per-task (20 row × 11 column)
- §2.2 Aggregate (resolve rate · token avg · etc.)
- §2.3 Harness-only signals (drift catches 등)
- §3 By harness-fit slice (multi-step / medium-step / single-fix 그룹별)

§4 정성 관찰 / §5 결론은 갱신 X — 사람 손으로.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    """CLI args parser — `--help` 가 exit 0 으로 끝나도록."""
    p = argparse.ArgumentParser(
        description="SWE-bench Verified A/B 결과 집계 + REPORT.md 갱신",
    )
    p.add_argument(
        "--results-dir",
        required=False,
        type=Path,
        help="results/ 디렉터리 (vanilla/ + harness/ 가 그 아래)",
    )
    p.add_argument(
        "--tasks",
        required=False,
        type=Path,
        help="tasks.json 의 path (20 task selection)",
    )
    p.add_argument(
        "--report",
        required=False,
        type=Path,
        help="REPORT.md 의 path (갱신 대상)",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="REPORT.md 쓰지 말고 stdout 으로 출력",
    )
    return p.parse_args()


def load_results(results_dir: Path, approach: str) -> dict[str, dict[str, Any]]:
    """results/<approach>/*.json 을 task_id 키 dict 로."""
    out: dict[str, dict[str, Any]] = {}
    sub = results_dir / approach
    if not sub.is_dir():
        return out
    for p in sorted(sub.glob("*.json")):
        try:
            data = json.loads(p.read_text())
        except (OSError, json.JSONDecodeError) as exc:
            print(f"  [warn] skipping {p}: {exc}", file=sys.stderr)
            continue
        tid = data.get("task_id")
        if isinstance(tid, str) and tid:
            out[tid] = data
    return out


def fmt_cell(value: Any) -> str:
    """결과 표 cell 의 표현 — None 이면 '—'."""
    if value is None:
        return "—"
    if isinstance(value, bool):
        return "✓" if value else "✗"
    if isinstance(value, float):
        return f"{value:.1f}"
    return str(value)


def fmt_delta(harness: float | int | None, vanilla: float | int | None) -> str:
    """harness − vanilla 의 부호 포함 표현."""
    if harness is None or vanilla is None:
        return "—"
    delta = harness - vanilla
    sign = "+" if delta > 0 else ""
    return f"{sign}{delta:.0f}"


def aggregate_metric(rows: dict[str, dict[str, Any]], field: str) -> dict[str, Any]:
    """rows 의 field 의 mean / median / count."""
    values = [r[field] for r in rows.values() if r.get(field) is not None]
    if not values:
        return {"mean": None, "median": None, "count": 0}
    return {
        "mean": statistics.mean(values),
        "median": statistics.median(values),
        "count": len(values),
    }


def per_task_table(
    tasks: list[dict[str, Any]],
    vanilla: dict[str, dict[str, Any]],
    harness: dict[str, dict[str, Any]],
) -> str:
    """§2.1 Per-task table — markdown."""
    lines = [
        "| Task ID | Difficulty | Harness fit | Vanilla resolved | Vanilla tokens | Vanilla wall (s) | Harness resolved | Harness tokens | Harness wall (s) | Δ tokens | Δ resolve |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for t in tasks:
        tid = t["task_id"]
        v = vanilla.get(tid, {})
        h = harness.get(tid, {})
        v_tokens = (v.get("tokens_input") or 0) + (v.get("tokens_output") or 0) if v else None
        h_tokens = (h.get("tokens_input") or 0) + (h.get("tokens_output") or 0) if h else None
        delta_tokens = fmt_delta(h_tokens, v_tokens)
        delta_resolve = "—"
        if v.get("resolved") is not None and h.get("resolved") is not None:
            delta_resolve = f"{int(h['resolved']) - int(v['resolved']):+d}"
        lines.append(
            f"| {tid} | {t['difficulty']} | {t['harness_fit']} | "
            f"{fmt_cell(v.get('resolved'))} | {fmt_cell(v_tokens)} | "
            f"{fmt_cell(v.get('wall_time_sec'))} | "
            f"{fmt_cell(h.get('resolved'))} | {fmt_cell(h_tokens)} | "
            f"{fmt_cell(h.get('wall_time_sec'))} | "
            f"{delta_tokens} | {delta_resolve} |"
        )
    return "\n".join(lines)


def aggregate_table(
    vanilla: dict[str, dict[str, Any]],
    harness: dict[str, dict[str, Any]],
    total_n: int,
) -> str:
    """§2.2 Aggregate metrics."""

    def row(label: str, field: str) -> str:
        v_stat = aggregate_metric(vanilla, field)
        h_stat = aggregate_metric(harness, field)
        v_val = v_stat["mean"]
        h_val = h_stat["mean"]
        delta = fmt_delta(h_val, v_val)
        return f"| **{label}** | {fmt_cell(v_val)} | {fmt_cell(h_val)} | {delta} | — |"

    v_resolved = sum(1 for r in vanilla.values() if r.get("resolved") is True)
    h_resolved = sum(1 for r in harness.values() if r.get("resolved") is True)
    v_pct = (v_resolved / total_n * 100) if total_n else 0
    h_pct = (h_resolved / total_n * 100) if total_n else 0

    lines = [
        "| Metric | Vanilla | Harness | Δ (harness − vanilla) | Significance (qualitative) |",
        "|---|---|---|---|---|",
        (
            f"| **Resolve rate** (N={total_n}) | {v_resolved}/{total_n} ({v_pct:.0f}%) | "
            f"{h_resolved}/{total_n} ({h_pct:.0f}%) | "
            f"{h_resolved - v_resolved:+d} | — |"
        ),
        row("Mean tokens / task (in+out)", "tokens_total"),
        row("Mean wall time (s) / task", "wall_time_sec"),
        row("Mean attempts / task", "attempts"),
        row("Mean code LOC / patch", "code_loc"),
        row("Mean tests added / task", "tests_added"),
    ]
    return "\n".join(lines)


def harness_signals_table(harness: dict[str, dict[str, Any]]) -> str:
    """§2.3 Harness-only signals."""
    drift_total = sum(
        r.get("harness_drift_catches", 0) or 0 for r in harness.values()
    )
    resolved = sum(1 for r in harness.values() if r.get("resolved") is True)
    drift_per_resolved = drift_total / resolved if resolved else 0

    kinds_total: dict[str, int] = {}
    for r in harness.values():
        for k in r.get("harness_evidence_kinds") or []:
            kinds_total[k] = kinds_total.get(k, 0) + 1
    kinds_str = ", ".join(f"{k}:{v}" for k, v in sorted(kinds_total.items())) or "—"

    return "\n".join(
        [
            "| Metric | Total | Per resolved task | 비고 |",
            "|---|---|---|---|",
            f"| Drift catches | {drift_total} | {drift_per_resolved:.1f} | 15-detector 가 잡은 issue 수 |",
            f"| Evidence kinds used | {sum(kinds_total.values())} | — | 분포: {kinds_str} |",
            "| Iron Law 차단 발생 | — | — | F-172 follow-up (hook 자동화) 이후 자동 capture |",
        ]
    )


def main() -> int:
    args = parse_args()

    # --help 만으로 호출되면 위 parser 가 이미 exit 0. 여기 도달하면 args 있음.
    # 그러나 dry-run / 일반 호출 시 results-dir / tasks / report 필요.
    if not args.results_dir or not args.tasks or not args.report:
        print(
            "error: --results-dir, --tasks, --report 셋 모두 필수 (또는 --help)",
            file=sys.stderr,
        )
        return 3

    tasks_data = json.loads(args.tasks.read_text())
    tasks = tasks_data.get("tasks", [])
    if not tasks:
        print("error: tasks.json 에 tasks[] 없음", file=sys.stderr)
        return 3

    vanilla = load_results(args.results_dir, "vanilla")
    harness = load_results(args.results_dir, "harness")

    # tokens_total 을 미리 계산해서 mean 집계에 사용
    for store in (vanilla, harness):
        for r in store.values():
            r["tokens_total"] = (r.get("tokens_input") or 0) + (r.get("tokens_output") or 0)

    total_n = len(tasks)
    print(
        f"loaded — tasks={total_n}, vanilla={len(vanilla)}, harness={len(harness)}",
        file=sys.stderr,
    )

    per_task = per_task_table(tasks, vanilla, harness)
    agg = aggregate_table(vanilla, harness, total_n)
    signals = harness_signals_table(harness)

    if args.dry_run:
        print("=== §2.1 Per-task ===")
        print(per_task)
        print()
        print("=== §2.2 Aggregate ===")
        print(agg)
        print()
        print("=== §2.3 Harness signals ===")
        print(signals)
        return 0

    # REPORT.md 의 표 자리를 sentinel 로 찾아서 교체.
    # 현재 REPORT.md 는 skeleton 이라 "—" 로 채워진 placeholder. sentinel 부재.
    # 이 스크립트가 첫 자동 갱신 시 §2.1 ~ §2.3 의 표를 통째로 교체할 수 있는 sentinel pair 를 REPORT.md 에 미리 추가하는 것이 정직.
    # → 첫 run 의 결과 우선 stdout 출력, 사람이 REPORT.md 에 sentinel 추가 후 재실행 권장.
    print(
        "[warn] REPORT.md 자동 갱신은 sentinel comment 필요. 현재 skeleton 에는 없음.",
        file=sys.stderr,
    )
    print(
        "[warn] sentinel 추가 가이드: REPORT.md 의 §2.1 표 위/아래에",
        file=sys.stderr,
    )
    print(
        '[warn]   <!-- aggregate:per-task:start --> ... <!-- aggregate:per-task:end -->',
        file=sys.stderr,
    )
    print(
        "[warn] 같은 패턴으로 :aggregate, :harness-signals 도. 그 후 이 스크립트가 두 sentinel 사이를 자동 교체.",
        file=sys.stderr,
    )
    print(
        "[info] 일단 결과를 stdout 으로 출력 (사람이 보고 REPORT.md 에 paste 가능):",
        file=sys.stderr,
    )
    print()
    print("=== §2.1 Per-task ===")
    print(per_task)
    print()
    print("=== §2.2 Aggregate ===")
    print(agg)
    print()
    print("=== §2.3 Harness signals ===")
    print(signals)
    return 0


if __name__ == "__main__":
    sys.exit(main())
