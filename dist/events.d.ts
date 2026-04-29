/**
 * `/harness:events` filter helpers — read-only / CQS (F-093 port of
 * `scripts/events.py`).
 *
 * Wraps {@link import('./core/eventLog.ts').readEvents} with kind /
 * feature / since filters and a human-readable formatter so the
 * `events` slash command can be reproduced in TS.
 *
 * @module events
 */
import type { HarnessEvent } from './core/eventLog.js';
/** Optional input for {@link filterEvents}. */
export interface FilterOptions {
    /** Match `event.type` exactly. */
    kind?: string | null;
    /** Match the feature id at any of `feature` / `feature_id` / `payload.feature`. */
    feature?: string | null;
    /** Drop events strictly older than this ISO 8601 cutoff. */
    since?: string | null;
}
/** Parses a timestamp the way Python's `_parse_ts` does. */
export declare function parseTs(ts: unknown): Date | null;
/**
 * Returns the events matching the supplied filter combination.
 *
 * Empty / undefined filter slots are no-ops. Multi-slot filters AND
 * together (kind && feature && since).
 */
export declare function filterEvents(events: Iterable<HarnessEvent>, options?: FilterOptions): HarnessEvent[];
/**
 * Renders a list of events as the Python `format_human` output.
 *
 * Output shape:
 *
 *     📜 /harness:events (N events)
 *
 *       <ts>  <type>  (k1=v1 · k2=v2)
 *       ...
 *
 * The trailing newline matches Python's `"\n".join(...) + "\n"`.
 */
export declare function formatHuman(events: ReadonlyArray<HarnessEvent>): string;
//# sourceMappingURL=events.d.ts.map