/**
 * Retrospective ceremony template generator (F-097 port of
 * `scripts/ceremonies/retro.py`).
 *
 * Fires after `/harness:work F-N --complete` succeeds. Reads
 * `events.log`, fills the machine-extractable sections (What
 * Shipped, First Gate to Fail, Ceremonies summary), and leaves the
 * LLM-driven sections as `_(pending)_` for orchestrator's reviewer →
 * tech-writer chain.
 *
 * Idempotency contract (v0.8.7): existing retro files are not
 * overwritten unless `force=true`.
 *
 * @module ceremonies/retro
 */
/** One row from events.log after parsing. */
type EventRecord = Record<string, unknown>;
/** Machine-extractable retro analysis. */
export interface RetroAnalysis {
    completed: boolean;
    first_gate_fail: EventRecord | null;
    kickoff_opened: boolean;
    design_review_opened: boolean;
    questions_opened: number;
    questions_answered: number;
    gate_events_total: number;
    all_events_total: number;
    archived: boolean;
    archived_event: EventRecord | null;
}
/**
 * Extracts machine-readable retro data from a list of events for a
 * single feature.
 *
 * Event-key contract (matches `scripts/work.py`):
 *   - feature id key is `feature` (not `feature_id`)
 *   - completion type is `feature_done` (not `feature_completed`)
 *   - archive type is `feature_archived`
 */
export declare function analyze(events: ReadonlyArray<EventRecord>, featureId: string): RetroAnalysis;
/** Optional input for {@link generateRetro}. */
export interface GenerateRetroOptions {
    timestamp?: string;
    force?: boolean;
    mode?: 'product' | 'prototype';
}
/**
 * Generates `.harness/_workspace/retro/F-N.md` plus a
 * `feature_retro_written` event. Idempotent — existing retro files
 * are preserved unless `force=true`.
 */
export declare function generateRetro(harnessDir: string, featureId: string, options?: GenerateRetroOptions): string;
export {};
//# sourceMappingURL=retro.d.ts.map