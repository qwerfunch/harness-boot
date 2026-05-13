#!/usr/bin/env python3
"""SWE-bench Verified A/B result aggregator + REPORT.md rewriter.

F-173: reads per-task JSON files from `results/vanilla/` and
`results/harness/`, then rewrites §2 / §3 tables in REPORT.md
deterministically — humans don't touch the result tables (BR-014).

Usage:
    python aggregate.py --results-dir <path> --tasks <path/tasks.json> \\
        --report <path/REPORT.md>

    python aggregate.py --help

The script updates four blocks:
- §2.1 Per-task (20 rows × 11 columns)
- §2.2 Aggregate (resolve rate · token mean · ...)
- §2.3 Harness-only signals (drift catches etc.)
- §3 By harness-fit slice (multi-step / medium-step / single-fix groups)

§4 qualitative observations and §5 conclusion are human-authored;
this script never touches them.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    """Parse CLI args; `--help` exits 0."""
    p = argparse.ArgumentParser(
        description="Aggregate SWE-bench Verified A/B results and rewrite REPORT.md",
    )
    p.add_argument(
        "--results-dir",
        required=False,
        type=Path,
        help="results/ directory (must contain vanilla/ and harness/ subdirs)",
    )
    p.add_argument(
        "--tasks",
        required=False,
        type=Path,
        help="path to tasks.json (the 20-task selection)",
    )
    p.add_argument(
        "--report",
        required=False,
        type=Path,
        help="path to REPORT.md (the rewrite target)",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="print the generated tables to stdout instead of writing REPORT.md",
    )
    return p.parse_args()


def load_results(results_dir: Path, approach: str) -> dict[str, dict[str, Any]]:
    """Load `results/<approach>/*.json` into a {task_id: payload} dict."""
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
    """Render a single table cell — None becomes '—'."""
    if value is None:
        return "—"
    if isinstance(value, bool):
        return "✓" if value else "✗"
    if isinstance(value, float):
        return f"{value:.1f}"
    return str(value)


def fmt_delta(harness: float | int | None, vanilla: float | int | None) -> str:
    """Render `harness − vanilla` with an explicit sign."""
    if harness is None or vanilla is None:
        return "—"
    delta = harness - vanilla
    sign = "+" if delta > 0 else ""
    return f"{sign}{delta:.0f}"


def aggregate_metric(rows: dict[str, dict[str, Any]], field: str) -> dict[str, Any]:
    """Compute mean / median / count for `field` across `rows`."""
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
    """Render the §2.1 per-task markdown table."""
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
    """Render the §2.2 aggregate-metrics markdown table."""

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
    """Render the §2.3 harness-only signals markdown table."""
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
            "| Metric | Total | Per resolved task | Notes |",
            "|---|---|---|---|",
            f"| Drift catches | {drift_total} | {drift_per_resolved:.1f} | issues caught by the 15-detector |",
            f"| Evidence kinds used | {sum(kinds_total.values())} | — | distribution: {kinds_str} |",
            "| Iron Law blocks | — | — | auto-captured after the F-172 / F-174 hook automation lands |",
        ]
    )


def main() -> int:
    args = parse_args()

    # `--help` already exited 0 via argparse. We reach this point with
    # real args, but the three path args are still optional at parse
    # time so we can validate here together.
    if not args.results_dir or not args.tasks or not args.report:
        print(
            "error: --results-dir, --tasks, and --report are all required (or pass --help)",
            file=sys.stderr,
        )
        return 3

    tasks_data = json.loads(args.tasks.read_text())
    tasks = tasks_data.get("tasks", [])
    if not tasks:
        print("error: tasks.json has no tasks[] entries", file=sys.stderr)
        return 3

    vanilla = load_results(args.results_dir, "vanilla")
    harness = load_results(args.results_dir, "harness")

    # Precompute `tokens_total` so the mean aggregator can reuse it.
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

    # Substitute the §2.1 / §2.2 / §2.3 blocks in REPORT.md between
    # matching sentinel comments. F-177 wired this up; before then the
    # script only printed warnings and never wrote anything.
    report_path = args.report
    if not report_path.exists():
        print(f"error: REPORT.md not found at {report_path}", file=sys.stderr)
        return 3
    report = report_path.read_text()
    blocks = {
        "per-task": per_task,
        "aggregate": agg,
        "harness-signals": signals,
    }
    missing = []
    for key, body in blocks.items():
        start = f"<!-- aggregate:{key}:start -->"
        end = f"<!-- aggregate:{key}:end -->"
        if start not in report or end not in report:
            missing.append(key)
            continue
        head, _, rest = report.partition(start)
        _, _, tail = rest.partition(end)
        report = f"{head}{start}\n{body}\n{end}{tail}"
    if missing:
        print(
            f"error: REPORT.md missing sentinel block(s) for: {', '.join(missing)}",
            file=sys.stderr,
        )
        print(
            "[hint] add `<!-- aggregate:<key>:start -->` / `:end` around each table.",
            file=sys.stderr,
        )
        return 3
    report_path.write_text(report)
    print(f"updated {report_path} — {len(blocks)} sentinel blocks rewritten")
    return 0


if __name__ == "__main__":
    sys.exit(main())
