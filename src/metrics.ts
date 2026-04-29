/**
 * `/harness:metrics` event-log aggregator (F-098 port of
 * `scripts/metrics.py`).
 *
 * CQS — events.log is read only; this module never mutates files.
 *
 * Computes:
 *
 *   - Total events + per-type histogram.
 *   - Feature throughput counters (activated / done / blocked).
 *   - Lead time stats (min/median/mean/max) for `activated → done`
 *     pairs (one pair per feature, most-recent activate → first done).
 *   - Gate stats per gate name (pass / fail / skipped / pass_rate).
 *   - Drift incidents from `sync_failed` events.
 *
 * @module metrics
 */

import {readEvents, type HarnessEvent} from './core/eventLog.js';

const PERIOD_RE = /^\s*(\d+)\s*([smhdw])\s*$/i;
const PERIOD_UNIT_SEC: Readonly<Record<string, number>> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
};

/** Outcome of {@link aggregate} — JSON-serialisable summary. */
export interface MetricsReport {
  window: {
    start: string | null;
    end: string | null;
    period: string | null;
  };
  total_events: number;
  event_types: Record<string, number>;
  features: {
    activated: number;
    done: number;
    blocked: number;
  };
  lead_time_sec: {
    count: number;
    min: number | null;
    median: number | null;
    mean: number | null;
    max: number | null;
  };
  gate_stats: Record<
    string,
    {
      pass: number;
      fail: number;
      skipped: number;
      other: number;
      pass_rate: number;
    }
  >;
  drift_incidents: number;
}

/** Optional input for {@link compute}. */
export interface ComputeOptions {
  /** `'7d'` / `'24h'` / `'30m'` etc. — wins over `since` is unset. */
  period?: string | null;
  /** ISO 8601 starting timestamp; trumps `period`. */
  since?: string | null;
  /** Override clock for tests; defaults to `Date.now()`. */
  now?: Date;
}

/** Internal input for {@link aggregate}. */
export interface AggregateOptions {
  windowStart?: Date | null;
  windowEnd?: Date | null;
  periodLabel?: string | null;
}

/** Parses a period string like `'7d'` into milliseconds. */
export function parsePeriod(text: string): number {
  const match = PERIOD_RE.exec(text);
  if (match === null) {
    throw new Error(`invalid period: '${text}' (expected e.g. 7d, 24h, 30m)`);
  }
  const n = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  return n * PERIOD_UNIT_SEC[unit]! * 1000;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseTs(ts: unknown): Date | null {
  if (typeof ts !== 'string' || ts.length === 0) {
    return null;
  }
  const ms = Date.parse(ts);
  if (Number.isNaN(ms)) {
    return null;
  }
  return new Date(ms);
}

function featureId(ev: HarnessEvent): string | null {
  let fid = ev['feature'] ?? ev['feature_id'];
  if ((fid === undefined || fid === null) && isPlainObject(ev['payload'])) {
    fid = (ev['payload'] as Record<string, unknown>)['feature'];
  }
  return typeof fid === 'string' ? fid : null;
}

function median(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isoZ(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Aggregates a list of events into a {@link MetricsReport}.
 *
 * Lead time: pair the most-recent `feature_activated` with the
 * first `feature_done` per feature; total time in seconds.
 */
export function aggregate(
  events: ReadonlyArray<HarnessEvent>,
  options: AggregateOptions = {},
): MetricsReport {
  const report: MetricsReport = {
    window: {
      start: options.windowStart ? isoZ(options.windowStart) : null,
      end: options.windowEnd ? isoZ(options.windowEnd) : null,
      period: options.periodLabel ?? null,
    },
    total_events: 0,
    event_types: {},
    features: {activated: 0, done: 0, blocked: 0},
    lead_time_sec: {count: 0, min: null, median: null, mean: null, max: null},
    gate_stats: {},
    drift_incidents: 0,
  };

  const activatedLast = new Map<string, Date>();
  const doneFirst = new Map<string, Date>();

  for (const ev of events) {
    report.total_events += 1;
    const typ = typeof ev['type'] === 'string' ? ev['type'] : '?';
    report.event_types[typ] = (report.event_types[typ] ?? 0) + 1;

    if (typ === 'sync_failed') {
      report.drift_incidents += 1;
    } else if (typ === 'feature_activated') {
      report.features.activated += 1;
      const fid = featureId(ev);
      const dt = parseTs(ev['ts']);
      if (fid !== null && dt !== null) {
        activatedLast.set(fid, dt);
      }
    } else if (typ === 'feature_blocked') {
      report.features.blocked += 1;
    } else if (typ === 'feature_done') {
      report.features.done += 1;
      const fid = featureId(ev);
      const dt = parseTs(ev['ts']);
      if (fid !== null && dt !== null && !doneFirst.has(fid)) {
        doneFirst.set(fid, dt);
      }
    } else if (typ === 'gate_recorded' || typ === 'gate_auto_run') {
      const gate = ev['gate'];
      if (typeof gate !== 'string') {
        continue;
      }
      const result = ev['result'];
      const bucket =
        report.gate_stats[gate] ??
        (report.gate_stats[gate] = {
          pass: 0,
          fail: 0,
          skipped: 0,
          other: 0,
          pass_rate: 0,
        });
      if (result === 'pass' || result === 'fail' || result === 'skipped') {
        bucket[result] += 1;
      } else {
        bucket.other += 1;
      }
    }
  }

  const deltas: number[] = [];
  for (const [fid, doneDt] of doneFirst.entries()) {
    const actDt = activatedLast.get(fid);
    if (actDt && doneDt.getTime() >= actDt.getTime()) {
      deltas.push((doneDt.getTime() - actDt.getTime()) / 1000);
    }
  }

  if (deltas.length > 0) {
    report.lead_time_sec.count = deltas.length;
    report.lead_time_sec.min = round3(Math.min(...deltas));
    report.lead_time_sec.max = round3(Math.max(...deltas));
    report.lead_time_sec.median = round3(median(deltas));
    report.lead_time_sec.mean = round3(deltas.reduce((acc, d) => acc + d, 0) / deltas.length);
  }

  for (const bucket of Object.values(report.gate_stats)) {
    const denom = bucket.pass + bucket.fail;
    bucket.pass_rate = denom > 0 ? round3(bucket.pass / denom) : 0;
  }

  return report;
}

/**
 * Reads `events.log` (with rotated siblings) under `harnessDir`,
 * applies period/since filtering, and returns the aggregated
 * {@link MetricsReport}.
 *
 * `since` wins over `period`. With neither, every event is included.
 */
export function compute(harnessDir: string, options: ComputeOptions = {}): MetricsReport {
  const allEvents: HarnessEvent[] = [...readEvents(harnessDir)];

  let windowStart: Date | null = null;
  let windowEnd: Date | null = null;
  let periodLabel: string | null = null;

  if (options.since) {
    const dt = parseTs(options.since);
    if (dt === null) {
      throw new Error(`invalid since timestamp: '${options.since}'`);
    }
    windowStart = dt;
  } else if (options.period) {
    const ms = parsePeriod(options.period);
    const base = options.now ?? new Date();
    windowEnd = base;
    windowStart = new Date(base.getTime() - ms);
    periodLabel = options.period;
  }

  let filtered: HarnessEvent[];
  if (windowStart !== null) {
    const startMs = windowStart.getTime();
    const endMs = windowEnd?.getTime() ?? Number.POSITIVE_INFINITY;
    filtered = allEvents.filter((ev) => {
      const dt = parseTs(ev['ts']);
      if (dt === null) {
        return false;
      }
      const t = dt.getTime();
      return t >= startMs && t <= endMs;
    });
  } else {
    filtered = allEvents;
  }

  return aggregate(filtered, {windowStart, windowEnd, periodLabel});
}

function fmtSec(value: number | null): string {
  if (value === null) {
    return '—';
  }
  if (value >= 86400) {
    return `${(value / 86400).toFixed(2)}d`;
  }
  if (value >= 3600) {
    return `${(value / 3600).toFixed(2)}h`;
  }
  if (value >= 60) {
    return `${(value / 60).toFixed(2)}m`;
  }
  return `${value.toFixed(1)}s`;
}

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function padLeft(s: string, width: number): string {
  return s.length >= width ? s : ' '.repeat(width - s.length) + s;
}

/** Renders the report as a human-readable text block. */
export function formatHuman(report: MetricsReport): string {
  const lines: string[] = ['📊 /harness:metrics', ''];
  const win = report.window;
  if (win.period) {
    lines.push(`Window: last ${win.period} (${win.start} → now)`);
  } else if (win.start) {
    lines.push(`Window: since ${win.start}`);
  } else {
    lines.push('Window: all time');
  }
  lines.push('');
  lines.push(`Total events: ${report.total_events}`);
  if (Object.keys(report.event_types).length > 0) {
    lines.push('  by type:');
    for (const [t, n] of Object.entries(report.event_types).sort()) {
      lines.push(`    ${pad(t, 20)} ${n}`);
    }
  }
  lines.push('');
  const f = report.features;
  lines.push(`Features: ${f.done} done · ${f.activated} activated · ${f.blocked} blocked`);
  const lt = report.lead_time_sec;
  if (lt.count > 0) {
    lines.push(
      `Lead time (n=${lt.count}): min ${fmtSec(lt.min)} · median ${fmtSec(lt.median)} · mean ${fmtSec(lt.mean)} · max ${fmtSec(lt.max)}`,
    );
  } else {
    lines.push('Lead time: (no completed feature cycles in window)');
  }
  lines.push('');
  if (Object.keys(report.gate_stats).length > 0) {
    lines.push('Gate stats:');
    lines.push(`  ${pad('gate', 8)} ${padLeft('pass', 5)} ${padLeft('fail', 5)} ${padLeft('skip', 5)}   rate`);
    for (const [gate, b] of Object.entries(report.gate_stats).sort()) {
      const rate = b.pass + b.fail > 0 ? `${(b.pass_rate * 100).toFixed(1)}%` : '—';
      lines.push(
        `  ${pad(gate, 8)} ${padLeft(String(b.pass), 5)} ${padLeft(String(b.fail), 5)} ${padLeft(String(b.skipped), 5)}   ${rate}`,
      );
    }
  } else {
    lines.push('Gate stats: (no gate events in window)');
  }
  lines.push('');
  return `${lines.join('\n').replace(/\s+$/, '')}\n`;
}
