/**
 * Events log rotation and unified read helpers (F-085 port of
 * `scripts/core/event_log.py`, originally introduced in v0.8.6).
 *
 * Rotation contract — Phase 2 scale readiness:
 *
 *   - Write path unchanged. Every emitter (work, ceremonies, sync,
 *     render) still appends to `.harness/events.log`. Rotation is
 *     opt-in maintenance.
 *   - Read path unifies. {@link readEvents} merges `events.log` plus
 *     every `events.log.YYYYMM` sibling and yields entries in
 *     timestamp order. Consumers (status, metrics) call this helper
 *     instead of scanning a single file.
 *   - Rotation policy. {@link rotate} moves events whose ts is
 *     strictly older than the current UTC month into
 *     `events.log.YYYYMM` buckets (one file per month). Current-month
 *     events and events with unparseable ts stay in `events.log` —
 *     never dropped.
 *   - Idempotent. Running rotate twice in a row yields the identical
 *     file set on disk.
 *
 * Behaviour preservation: the JSON line shape and sort order match
 * the Python implementation byte-for-byte so retros, metrics, and
 * cross-runtime tooling agree.
 *
 * @module eventLog
 */
/**
 * One harness event as emitted to events.log.
 *
 * Records carry an ISO 8601 `ts`, a `type` discriminator (e.g.
 * `feature_activated`, `gate_run`, `evidence_added`), and arbitrary
 * additional keys depending on the event kind. We keep the type loose
 * (`Record<string, unknown>`) because event schema evolves per feature
 * and the consumers do not need static type guarantees here.
 */
export type HarnessEvent = Record<string, unknown> & {
    ts?: unknown;
    type?: unknown;
};
/**
 * Map of `YYYYMM` → number of events that landed in that bucket.
 *
 * Returned by {@link rotate} so callers can report progress; an empty
 * map means rotation found nothing to move.
 */
export type RotateMoveMap = Record<string, number>;
/**
 * Optional configuration for {@link rotate}.
 *
 * `nowYyyymm` is injected by tests to pin "current month" without
 * touching the system clock. `dryRun` computes the move map without
 * mutating any file on disk.
 */
export interface RotateOptions {
    nowYyyymm?: string;
    dryRun?: boolean;
}
/**
 * Extracts the `YYYYMM` slice from an ISO 8601 timestamp string.
 *
 * Returns `null` when the input is not a string or when it does not
 * begin with a `YYYY-MM` prefix. Mirrors Python's
 * `_parse_yyyymm_from_ts` so callers (and the parity test) can rely
 * on identical fault tolerance.
 *
 * @param ts - Possibly-string timestamp candidate.
 * @returns Six-digit `YYYYMM`, or `null` when unparseable.
 */
export declare function parseYyyymmFromTs(ts: unknown): string | null;
/**
 * Yields the unified event stream across `events.log` and every
 * rotated `events.log.YYYYMM` file under the harness dir.
 *
 * Events are returned in timestamp-ascending order. Rows whose `ts`
 * is unparseable (missing, non-string, or not ISO 8601 prefixed) are
 * preserved at the end of the stream rather than dropped.
 *
 * @param harnessDir - Path to the project's `.harness/` directory.
 * @returns Iterable iterator of harness events in timestamp order.
 */
export declare function readEvents(harnessDir: string): IterableIterator<HarnessEvent>;
/**
 * Returns the current UTC month as a `YYYYMM` string.
 *
 * Used as the default split boundary in {@link rotate}. Public visibility
 * keeps the parity test deterministic — tests inject a frozen value via
 * `RotateOptions.nowYyyymm` to avoid relying on the system clock.
 */
export declare function currentYyyymm(): string;
/**
 * Splits `events.log` by month — events older than the current UTC
 * month move into `events.log.YYYYMM` buckets, current-month events
 * and unparseable-ts events stay in `events.log`.
 *
 * Returns a `{YYYYMM: count}` map of moved events; an empty map means
 * nothing needed rotation.
 *
 * Append semantics: pre-existing rotated buckets are appended-to, not
 * overwritten, so older history is preserved when rotation runs
 * multiple times. Idempotent — calling twice produces the same disk
 * state because the second call finds nothing to move.
 *
 * @param harnessDir - Path to the project's `.harness/` directory.
 * @param options - Optional injection points (`nowYyyymm`, `dryRun`).
 * @returns Map of `YYYYMM` to move count.
 */
export declare function rotate(harnessDir: string, options?: RotateOptions): RotateMoveMap;
//# sourceMappingURL=eventLog.d.ts.map