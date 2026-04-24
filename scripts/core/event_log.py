#!/usr/bin/env python3
"""events.log rotation + unified read helpers (v0.8.6).

Rotation contract — Phase 2 scale readiness:

- **Write path unchanged.** Every emitter (``scripts.work``, ``ceremonies.*``,
  ``sync.py``, ``render.*``) still appends to ``.harness/events.log``.
  Rotation is opt-in maintenance.
- **Read path unifies.** ``read_events(harness_dir)`` merges
  ``events.log`` + every ``events.log.YYYYMM`` sibling and yields them in
  timestamp order. Consumers (``events.py``, ``metrics.py``) use this helper
  instead of scanning a single file.
- **Rotation policy.** ``rotate(harness_dir)`` moves events whose ts is
  strictly older than the current month into ``events.log.YYYYMM`` buckets
  (one file per month). Current-month events and events with unparseable
  ts stay in ``events.log`` — never dropped.
- **Idempotent.** Running rotate twice in a row yields the identical file set.

Usage (CLI):
    python3 scripts/core/event_log.py rotate --harness-dir .harness
    python3 scripts/core/event_log.py rotate --harness-dir .harness --dry-run

Usage (library):
    from core.event_log import read_events, rotate
    for ev in read_events(Path(".harness")):
        ...
    moved = rotate(Path(".harness"))  # returns {"202602": 12, "202603": 9}
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator


_ROTATED_FILENAME_RE = re.compile(r"^events\.log\.(\d{6})$")
_ROTATABLE_TS_RE = re.compile(r"^(\d{4})-(\d{2})")


def _parse_yyyymm_from_ts(ts: str) -> str | None:
    """Extract YYYYMM from an ISO 8601 ts. Returns None when unparseable."""
    if not isinstance(ts, str):
        return None
    m = _ROTATABLE_TS_RE.match(ts)
    if not m:
        return None
    return f"{m.group(1)}{m.group(2)}"


def _read_json_lines(path: Path) -> Iterator[dict]:
    if not path.is_file():
        return
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def _rotated_paths(harness_dir: Path) -> list[Path]:
    """All `events.log.YYYYMM` files under harness_dir, sorted by month asc."""
    if not harness_dir.is_dir():
        return []
    rotated: list[tuple[str, Path]] = []
    for p in harness_dir.iterdir():
        if not p.is_file():
            continue
        m = _ROTATED_FILENAME_RE.match(p.name)
        if m:
            rotated.append((m.group(1), p))
    rotated.sort(key=lambda pair: pair[0])
    return [p for _, p in rotated]


def _event_sort_key(ev: dict) -> tuple[str, int]:
    """Sort by ts ISO string (lexicographic works for ISO 8601). Unparseable
    ts events sort last — stable preservation of emission order."""
    ts = ev.get("ts")
    if isinstance(ts, str) and _ROTATABLE_TS_RE.match(ts):
        return (ts, 0)
    return ("￿", 0)


def read_events(harness_dir: Path) -> Iterator[dict]:
    """Unified event stream across events.log + all rotated events.log.YYYYMM.

    Returns events in timestamp-ascending order. Unparseable ts events sort
    last but are never dropped. Rotated files are read in filename order
    (which is already YYYYMM ascending), then events.log last.
    """
    buffer: list[dict] = []
    for p in _rotated_paths(harness_dir):
        buffer.extend(_read_json_lines(p))
    buffer.extend(_read_json_lines(harness_dir / "events.log"))
    buffer.sort(key=_event_sort_key)
    yield from buffer


def _current_yyyymm() -> str:
    now = datetime.now(timezone.utc)
    return f"{now.year:04d}{now.month:02d}"


def rotate(
    harness_dir: Path,
    *,
    now_yyyymm: str | None = None,
    dry_run: bool = False,
) -> dict[str, int]:
    """Split events.log by month: events older than current month → events.log.YYYYMM.

    Returns a ``{yyyymm: count}`` map of events moved. Empty dict means no
    rotation needed. Current-month events and unparseable-ts events stay in
    events.log.

    ``now_yyyymm`` defaults to current UTC month (YYYYMM). Injected for tests.
    ``dry_run=True`` computes the move map without touching any file.
    """
    if now_yyyymm is None:
        now_yyyymm = _current_yyyymm()

    log_path = harness_dir / "events.log"
    if not log_path.is_file():
        return {}

    keep: list[dict] = []
    buckets: dict[str, list[dict]] = {}

    for ev in _read_json_lines(log_path):
        ev_yyyymm = _parse_yyyymm_from_ts(ev.get("ts", ""))
        if ev_yyyymm is None:
            keep.append(ev)
            continue
        if ev_yyyymm >= now_yyyymm:
            keep.append(ev)
            continue
        buckets.setdefault(ev_yyyymm, []).append(ev)

    moved = {k: len(v) for k, v in buckets.items()}
    if dry_run or not moved:
        return moved

    # Append to existing rotated files (preserves pre-existing history).
    for yyyymm, events in buckets.items():
        target = harness_dir / f"events.log.{yyyymm}"
        with target.open("a", encoding="utf-8") as f:
            for ev in events:
                f.write(json.dumps(ev, ensure_ascii=False) + "\n")

    # Rewrite events.log with only the keep set.
    with log_path.open("w", encoding="utf-8") as f:
        for ev in keep:
            f.write(json.dumps(ev, ensure_ascii=False) + "\n")

    return moved


def _cmd_rotate(args: argparse.Namespace) -> int:
    moved = rotate(args.harness_dir, dry_run=args.dry_run)
    if not moved:
        print("(no events older than current month — nothing to rotate)")
        return 0
    verb = "would move" if args.dry_run else "moved"
    total = sum(moved.values())
    print(f"{verb} {total} event(s) across {len(moved)} month(s):")
    for yyyymm in sorted(moved):
        print(f"  events.log.{yyyymm}: {moved[yyyymm]}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="events.log rotation + unified read (v0.8.6)",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_rot = sub.add_parser("rotate", help="Split old months out of events.log")
    p_rot.add_argument("--harness-dir", type=Path, default=Path.cwd() / ".harness")
    p_rot.add_argument("--dry-run", action="store_true", help="preview only")
    p_rot.set_defaults(func=_cmd_rotate)

    args = parser.parse_args(argv)
    if not args.harness_dir.is_dir():
        print(f"error: {args.harness_dir} not found", file=sys.stderr)
        return 2
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
