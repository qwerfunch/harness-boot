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
import { type HarnessEvent } from './core/eventLog.js';
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
    gate_stats: Record<string, {
        pass: number;
        fail: number;
        skipped: number;
        other: number;
        pass_rate: number;
    }>;
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
export declare function parsePeriod(text: string): number;
/**
 * Aggregates a list of events into a {@link MetricsReport}.
 *
 * Lead time: pair the most-recent `feature_activated` with the
 * first `feature_done` per feature; total time in seconds.
 */
export declare function aggregate(events: ReadonlyArray<HarnessEvent>, options?: AggregateOptions): MetricsReport;
/**
 * Reads `events.log` (with rotated siblings) under `harnessDir`,
 * applies period/since filtering, and returns the aggregated
 * {@link MetricsReport}.
 *
 * `since` wins over `period`. With neither, every event is included.
 */
export declare function compute(harnessDir: string, options?: ComputeOptions): MetricsReport;
/** Renders the report as a human-readable text block. */
export declare function formatHuman(report: MetricsReport): string;
//# sourceMappingURL=metrics.d.ts.map