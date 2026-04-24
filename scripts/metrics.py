#!/usr/bin/env python3
"""
metrics.py — /harness:metrics (F-008) 구현. events.log 집계, Read-only (CQS).

사용:
  python3 scripts/metrics.py                          # 전체 기간 요약 (human)
  python3 scripts/metrics.py --period 7d              # 최근 7 일
  python3 scripts/metrics.py --period 24h             # 최근 24 시간
  python3 scripts/metrics.py --since 2026-04-20T00:00:00Z
  python3 scripts/metrics.py --format json
  python3 scripts/metrics.py --format csv

CQS: events.log 는 **읽기만**. 상태/파일 수정 없음.

집계 지표:
  - Event volume — 총 이벤트 수 + type 별 분포
  - Feature throughput — feature_done · feature_activated · feature_blocked 카운트
  - Feature lead time — (activated → done) 분포 (min/median/mean/max, 초 단위)
  - Gate stats — gate_0..5 각각의 pass/fail/skipped + pass_rate
  - Drift incidents — sync_failed 이벤트 수
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import median

_THIS = Path(__file__).resolve().parent
if str(_THIS) not in sys.path:
    sys.path.insert(0, str(_THIS))

import events as events_mod  # noqa: E402
from core.event_log import read_events  # noqa: E402


_PERIOD_PATTERN = re.compile(r"^\s*(\d+)\s*([smhdw])\s*$", re.IGNORECASE)
_PERIOD_UNIT = {
    "s": 1,
    "m": 60,
    "h": 3600,
    "d": 86400,
    "w": 604800,
}


def parse_period(text: str) -> timedelta:
    """'7d', '24h', '30m' → timedelta. 대소문자 무관. 단위 {s,m,h,d,w}."""
    m = _PERIOD_PATTERN.match(text)
    if not m:
        raise ValueError(f"invalid period: {text!r} (expected e.g. 7d, 24h, 30m)")
    n = int(m.group(1))
    unit = m.group(2).lower()
    return timedelta(seconds=n * _PERIOD_UNIT[unit])


def _parse_ts(ts: str) -> datetime | None:
    """events 모듈의 parser 재사용. tz-naive UTC 로 간주."""
    dt = events_mod._parse_ts(ts or "")
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc)


@dataclass
class MetricsReport:
    window_start: str | None = None        # ISO8601 또는 None (all time)
    window_end: str | None = None
    period: str | None = None              # "7d" 등 사용자 입력 그대로
    total_events: int = 0
    event_types: dict[str, int] = field(default_factory=dict)

    features_activated: int = 0
    features_done: int = 0
    features_blocked: int = 0

    lead_time_count: int = 0
    lead_time_min_sec: float | None = None
    lead_time_median_sec: float | None = None
    lead_time_mean_sec: float | None = None
    lead_time_max_sec: float | None = None

    gate_stats: dict[str, dict[str, int | float]] = field(default_factory=dict)
    drift_incidents: int = 0

    def as_dict(self) -> dict:
        return {
            "window": {
                "start": self.window_start,
                "end": self.window_end,
                "period": self.period,
            },
            "total_events": self.total_events,
            "event_types": dict(sorted(self.event_types.items())),
            "features": {
                "activated": self.features_activated,
                "done": self.features_done,
                "blocked": self.features_blocked,
            },
            "lead_time_sec": {
                "count": self.lead_time_count,
                "min": self.lead_time_min_sec,
                "median": self.lead_time_median_sec,
                "mean": self.lead_time_mean_sec,
                "max": self.lead_time_max_sec,
            },
            "gate_stats": {k: dict(v) for k, v in sorted(self.gate_stats.items())},
            "drift_incidents": self.drift_incidents,
        }


def _feature_id(ev: dict) -> str | None:
    fid = ev.get("feature") or ev.get("feature_id")
    if not fid and isinstance(ev.get("payload"), dict):
        fid = ev["payload"].get("feature")
    return fid if isinstance(fid, str) else None


def aggregate(
    events: list[dict],
    *,
    window_start: datetime | None = None,
    window_end: datetime | None = None,
    period_label: str | None = None,
) -> MetricsReport:
    """events 리스트를 집계. window_* 는 이미 필터 끝난 입력 기준의 표시용.

    lead time 은 '마지막 feature_activated' → '첫 feature_done' 쌍으로 계산 (피처별 최대 1 쌍).
    여러 사이클 (활성화→블록→재활성화→완료) 은 가장 가까운 activated 를 사용.
    """
    report = MetricsReport(
        window_start=window_start.isoformat().replace("+00:00", "Z") if window_start else None,
        window_end=window_end.isoformat().replace("+00:00", "Z") if window_end else None,
        period=period_label,
    )

    # 1) type 카운트 + 피처 전이 이벤트
    activated_last: dict[str, datetime] = {}
    done_first: dict[str, datetime] = {}
    for ev in events:
        report.total_events += 1
        typ = ev.get("type", "?")
        report.event_types[typ] = report.event_types.get(typ, 0) + 1

        if typ == "sync_failed":
            report.drift_incidents += 1
        elif typ == "feature_activated":
            report.features_activated += 1
            fid = _feature_id(ev)
            dt = _parse_ts(ev.get("ts", ""))
            if fid and dt:
                activated_last[fid] = dt
        elif typ == "feature_blocked":
            report.features_blocked += 1
        elif typ == "feature_done":
            report.features_done += 1
            fid = _feature_id(ev)
            dt = _parse_ts(ev.get("ts", ""))
            if fid and dt and fid not in done_first:
                done_first[fid] = dt
        elif typ in ("gate_recorded", "gate_auto_run"):
            gate = ev.get("gate")
            if not isinstance(gate, str):
                continue
            res = ev.get("result", "?")
            bucket = report.gate_stats.setdefault(
                gate, {"pass": 0, "fail": 0, "skipped": 0, "other": 0, "pass_rate": 0.0}
            )
            if res in ("pass", "fail", "skipped"):
                bucket[res] = int(bucket[res]) + 1
            else:
                bucket["other"] = int(bucket["other"]) + 1

    # 2) lead time 계산
    deltas: list[float] = []
    for fid, done_dt in done_first.items():
        act_dt = activated_last.get(fid)
        if act_dt and done_dt >= act_dt:
            deltas.append((done_dt - act_dt).total_seconds())

    if deltas:
        report.lead_time_count = len(deltas)
        report.lead_time_min_sec = round(min(deltas), 3)
        report.lead_time_max_sec = round(max(deltas), 3)
        report.lead_time_median_sec = round(median(deltas), 3)
        report.lead_time_mean_sec = round(sum(deltas) / len(deltas), 3)

    # 3) pass_rate 계산
    for gate, bucket in report.gate_stats.items():
        p = int(bucket["pass"])
        f = int(bucket["fail"])
        denom = p + f  # skipped 은 분모 제외 — 실제 판정된 비율
        bucket["pass_rate"] = round(p / denom, 3) if denom else 0.0

    return report


def compute(
    log_path: Path,
    *,
    period: timedelta | None = None,
    period_label: str | None = None,
    since: str | None = None,
    now: datetime | None = None,
) -> MetricsReport:
    """events.log 읽고 period/since 필터 적용 후 aggregate.

    우선순위: `since` > `period`. 둘 다 없으면 전체 기간.
    `period_label` — 사용자 입력 원문 (예: "7d"). 생략 시 period 에서 복구.
    `now` 는 테스트용 — 기본 UTC now.

    v0.8.6: ``log_path`` 의 파일명이 ``events.log`` 일 때 ``log_path.parent``
    를 harness_dir 로 간주하고 ``core.event_log.read_events`` 로 rotated
    ``events.log.YYYYMM`` siblings 까지 합산. 다른 이름/경로는 기존 단일 파일
    파서 사용 (backward compat — 테스트에서 가끔 직접 지정).
    """
    if log_path.name == "events.log":
        all_events = list(read_events(log_path.parent))
    else:
        all_events = list(events_mod.parse_events(log_path))

    window_end: datetime | None = None
    window_start: datetime | None = None

    if since:
        dt = _parse_ts(since)
        if dt is None:
            raise ValueError(f"invalid --since timestamp: {since!r}")
        window_start = dt
    elif period is not None:
        base = now or datetime.now(timezone.utc)
        if base.tzinfo is None:
            base = base.replace(tzinfo=timezone.utc)
        window_end = base
        window_start = base - period

    if window_start is not None:
        filtered: list[dict] = []
        for ev in all_events:
            ev_dt = _parse_ts(ev.get("ts", ""))
            if ev_dt is None:
                continue
            if ev_dt < window_start:
                continue
            if window_end is not None and ev_dt > window_end:
                continue
            filtered.append(ev)
    else:
        filtered = all_events

    if period is not None and since is None and period_label is None:
        total = int(period.total_seconds())
        # 가장 작은 단위부터 체크하여 사용자 입력 단위를 추정 (7d 를 1w 로 바꾸지 않음)
        if total < 60 or total % 60 != 0:
            period_label = f"{total}s"
        elif total < 3600 or total % 3600 != 0:
            period_label = f"{total // 60}m"
        elif total < 86400 or total % 86400 != 0:
            period_label = f"{total // 3600}h"
        else:
            period_label = f"{total // 86400}d"

    return aggregate(
        filtered,
        window_start=window_start,
        window_end=window_end,
        period_label=period_label,
    )


def _fmt_sec(v: float | None) -> str:
    if v is None:
        return "—"
    if v >= 86400:
        return f"{v / 86400:.2f}d"
    if v >= 3600:
        return f"{v / 3600:.2f}h"
    if v >= 60:
        return f"{v / 60:.2f}m"
    return f"{v:.1f}s"


def format_human(report: MetricsReport) -> str:
    d = report.as_dict()
    lines = ["📊 /harness:metrics", ""]
    win = d["window"]
    if win["period"]:
        lines.append(f"Window: last {win['period']} ({win['start']} → now)")
    elif win["start"]:
        lines.append(f"Window: since {win['start']}")
    else:
        lines.append("Window: all time")
    lines.append("")
    lines.append(f"Total events: {d['total_events']}")
    if d["event_types"]:
        lines.append("  by type:")
        for t, n in d["event_types"].items():
            lines.append(f"    {t:<20} {n}")
    lines.append("")
    f = d["features"]
    lines.append(f"Features: {f['done']} done · {f['activated']} activated · {f['blocked']} blocked")
    lt = d["lead_time_sec"]
    if lt["count"]:
        lines.append(
            f"Lead time (n={lt['count']}): min {_fmt_sec(lt['min'])} · "
            f"median {_fmt_sec(lt['median'])} · mean {_fmt_sec(lt['mean'])} · "
            f"max {_fmt_sec(lt['max'])}"
        )
    else:
        lines.append("Lead time: (no completed feature cycles in window)")
    lines.append("")
    if d["gate_stats"]:
        lines.append("Gate stats:")
        lines.append(f"  {'gate':<8} {'pass':>5} {'fail':>5} {'skip':>5}   rate")
        for gate, b in d["gate_stats"].items():
            rate = f"{b['pass_rate'] * 100:.1f}%" if (b["pass"] + b["fail"]) else "—"
            lines.append(
                f"  {gate:<8} {b['pass']:>5} {b['fail']:>5} {b['skipped']:>5}   {rate}"
            )
    else:
        lines.append("Gate stats: (no gate events in window)")
    lines.append("")
    lines.append(f"Drift incidents (sync_failed): {d['drift_incidents']}")
    return "\n".join(lines) + "\n"


def format_csv(report: MetricsReport) -> str:
    d = report.as_dict()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["metric", "key", "value"])
    w.writerow(["window", "start", d["window"]["start"] or ""])
    w.writerow(["window", "end", d["window"]["end"] or ""])
    w.writerow(["window", "period", d["window"]["period"] or ""])
    w.writerow(["events", "total", d["total_events"]])
    for t, n in d["event_types"].items():
        w.writerow(["events", f"type:{t}", n])
    for k, n in d["features"].items():
        w.writerow(["features", k, n])
    for k, v in d["lead_time_sec"].items():
        w.writerow(["lead_time_sec", k, v if v is not None else ""])
    for gate, b in d["gate_stats"].items():
        for k, v in b.items():
            w.writerow([f"gate:{gate}", k, v])
    w.writerow(["drift", "sync_failed", d["drift_incidents"]])
    return buf.getvalue()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="/harness:metrics (F-008) — aggregate events.log (read-only)"
    )
    parser.add_argument("--harness-dir", type=Path, default=Path.cwd() / ".harness")
    parser.add_argument("--period", default=None, help="e.g. 7d, 24h, 30m (ignored if --since given)")
    parser.add_argument("--since", default=None, help="ISO8601 timestamp lower bound")
    parser.add_argument("--format", choices=["human", "json", "csv"], default="human")
    args = parser.parse_args(argv)

    if not args.harness_dir.is_dir():
        print(f"error: {args.harness_dir} not found", file=sys.stderr)
        return 2

    period_td = None
    if args.period:
        try:
            period_td = parse_period(args.period)
        except ValueError as e:
            print(f"error: {e}", file=sys.stderr)
            return 2

    log_path = args.harness_dir / "events.log"
    try:
        report = compute(
            log_path,
            period=period_td,
            period_label=args.period if period_td else None,
            since=args.since,
        )
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    if args.format == "json":
        json.dump(report.as_dict(), sys.stdout, indent=2, ensure_ascii=False)
        print()
    elif args.format == "csv":
        sys.stdout.write(format_csv(report))
    else:
        sys.stdout.write(format_human(report))

    return 0


if __name__ == "__main__":
    sys.exit(main())
