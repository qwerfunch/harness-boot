#!/usr/bin/env python3
"""
events.py — /harness:events (F-007) 구현. Read-only, CQS.

사용:
  python3 scripts/events.py                                   # 최근 50 이벤트
  python3 scripts/events.py --all                             # 전체
  python3 scripts/events.py --kind sync_completed             # 타입 필터
  python3 scripts/events.py --feature F-003                   # 피처 필터
  python3 scripts/events.py --since 2026-04-23T05:00:00Z      # 시간 필터
  python3 scripts/events.py --json                            # JSON 배열

CQS: events.log 파일은 **읽기만**. mtime 불변.

기본 50 라인; --all 로 전체. 필터 조합 가능 (kind · feature · since).
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Iterable, Iterator

_THIS = Path(__file__).resolve().parent
if str(_THIS) not in sys.path:
    sys.path.insert(0, str(_THIS))

from core.event_log import read_events  # noqa: E402


def parse_events(path: Path) -> Iterator[dict]:
    """Backward-compat shim — reads a single events.log file.

    New callers should use ``core.event_log.read_events(harness_dir)`` which
    unifies rotated files (v0.8.6). This helper is preserved for any
    downstream consumer that still passes a path directly.
    """
    if not path.is_file():
        return iter([])
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def _parse_ts(ts: str) -> datetime | None:
    if not ts:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%fZ"):
        try:
            return datetime.strptime(ts, fmt)
        except ValueError:
            continue
    return None


def filter_events(
    events: Iterable[dict],
    *,
    kind: str | None = None,
    feature: str | None = None,
    since: str | None = None,
) -> list[dict]:
    since_dt = _parse_ts(since) if since else None
    result: list[dict] = []
    for ev in events:
        if kind and ev.get("type") != kind:
            continue
        if feature:
            # 피처 참조 여러 위치 가능 — feature / feature_id / payload.feature
            fid = ev.get("feature") or ev.get("feature_id")
            if not fid and isinstance(ev.get("payload"), dict):
                fid = ev["payload"].get("feature")
            if fid != feature:
                continue
        if since_dt:
            ev_dt = _parse_ts(ev.get("ts", ""))
            if ev_dt is None or ev_dt < since_dt:
                continue
        result.append(ev)
    return result


def format_human(events: list[dict]) -> str:
    if not events:
        return "(no matching events)\n"
    lines = [f"📜 /harness:events ({len(events)} events)", ""]
    for ev in events:
        ts = ev.get("ts", "?")
        typ = ev.get("type", "?")
        extras = []
        for key in ("feature", "feature_id", "spec_hash", "phase", "reason"):
            if key in ev:
                val = ev[key]
                if key == "spec_hash" and isinstance(val, str):
                    val = val[:12]
                extras.append(f"{key}={val}")
        extras_str = " · ".join(extras) if extras else ""
        lines.append(f"  {ts}  {typ}" + (f"  ({extras_str})" if extras_str else ""))
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="/harness:events (F-007) — read events.log")
    parser.add_argument(
        "--harness-dir",
        type=Path,
        default=Path.cwd() / ".harness",
    )
    parser.add_argument("--kind", default=None, help="filter by event.type")
    parser.add_argument("--feature", default=None, help="filter by feature id")
    parser.add_argument("--since", default=None, help="filter ts >= this ISO8601")
    parser.add_argument("--all", action="store_true", help="show all (no limit)")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    if not args.harness_dir.is_dir():
        print(f"error: {args.harness_dir} not found", file=sys.stderr)
        return 2

    # v0.8.6: use unified reader so rotated events.log.YYYYMM siblings
    # are surfaced alongside the current-month log.
    all_events = list(read_events(args.harness_dir))
    filtered = filter_events(
        all_events, kind=args.kind, feature=args.feature, since=args.since
    )

    if not args.all:
        filtered = filtered[-args.limit :]

    if args.json:
        json.dump(filtered, sys.stdout, indent=2, ensure_ascii=False)
        print()
    else:
        sys.stdout.write(format_human(filtered))

    return 0


if __name__ == "__main__":
    sys.exit(main())
