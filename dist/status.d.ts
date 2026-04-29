/**
 * `/harness:status` read-only summary (F-094 port of
 * `scripts/status.py`, F-005 in spec).
 *
 * CQS contract — never modifies any file under the harness
 * directory; mtime invariant is enforced by tests.
 *
 * Composes three reads:
 *
 *   - {@link import('./core/state.ts').State} — feature counts,
 *     session block, evidence summary.
 *   - `harness.yaml` — drift_status from `generation.drift_status`.
 *   - `events.log` tail — last `sync_completed` event for the
 *     last_sync block.
 *
 * @module status
 */
import { type StateData } from './core/state.js';
/** Per-feature short summary (cards in the human view). */
export interface FeatureSummary {
    id: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    gates_passed: string[];
    gates_failed: string[];
    evidence_count: number;
}
/** Optional last_sync block when an event has been observed. */
export interface LastSyncSummary {
    ts: string | null;
    spec_hash: string;
    plugin_version: string | null;
}
/** Full status report shape; both `formatHuman` and JSON output share it. */
export interface StatusReport {
    session: StateData['session'];
    counts: Record<string, number>;
    drift_status: string;
    last_sync: LastSyncSummary | null;
    features_summary: FeatureSummary[];
    active_feature: FeatureSummary | null;
}
/** Optional input for {@link buildReport}. */
export interface BuildReportOptions {
    featureFilter?: string | null;
}
/** Builds a {@link StatusReport} for the given harness directory. */
export declare function buildReport(harnessDir: string, options?: BuildReportOptions): StatusReport;
/**
 * Renders a {@link StatusReport} as the human view (matching Python
 * `format_human`).
 */
export declare function formatHuman(report: StatusReport): string;
//# sourceMappingURL=status.d.ts.map