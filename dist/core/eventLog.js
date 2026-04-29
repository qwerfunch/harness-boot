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
import { appendFileSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const ROTATED_FILENAME_RE = /^events\.log\.(\d{6})$/;
const ROTATABLE_TS_RE = /^(\d{4})-(\d{2})/;
/**
 * Serializes a value the way Python's `json.dumps(ev, ensure_ascii=False)`
 * does — comma and colon separators carry a trailing space.
 *
 * Native `JSON.stringify` defaults to compact form (no whitespace),
 * which produces `{"a":1}` instead of Python's `{"a": 1}`. The events
 * log format is part of harness-boot's wire contract, so we mirror
 * Python byte-for-byte to keep cross-runtime tooling agreement.
 *
 * Constraints:
 *
 *   - Object keys preserve insertion order (matches Python's dict
 *     iteration order, which preserves insertion order since 3.7).
 *   - Strings are escaped via native `JSON.stringify`, which gives
 *     identical output to Python's `ensure_ascii=False` mode for the
 *     character sets harness-boot emits (ASCII + Korean + emoji).
 *   - NaN / Infinity are not allowed (Python with default settings
 *     would emit `NaN` / `Infinity` as non-strict JSON; we treat the
 *     same way as `canonicalHash` for safety).
 */
function pythonStyleJsonStringify(value) {
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new TypeError(`eventLog: non-finite number cannot be serialized (${String(value)}).`);
        }
        return JSON.stringify(value);
    }
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        const items = value.map((v) => pythonStyleJsonStringify(v));
        return `[${items.join(', ')}]`;
    }
    if (typeof value === 'object') {
        const pairs = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${pythonStyleJsonStringify(v)}`);
        return `{${pairs.join(', ')}}`;
    }
    throw new TypeError(`eventLog: unsupported value type ${typeof value}.`);
}
/**
 * Sentinel sort key for events whose `ts` is unparseable.
 *
 * Mirrors the Python implementation's use of `'￿'`: events with
 * a malformed timestamp sort after every well-formed ISO 8601 string
 * (which start with digits 0-9). Using the same sentinel keeps cross-
 * runtime ordering identical.
 */
const UNPARSEABLE_TS_SENTINEL = '￿';
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
export function parseYyyymmFromTs(ts) {
    if (typeof ts !== 'string') {
        return null;
    }
    const match = ROTATABLE_TS_RE.exec(ts);
    if (!match) {
        return null;
    }
    return `${match[1]}${match[2]}`;
}
/**
 * Reads a JSON-lines file and returns parsed records, skipping blank
 * lines and unparseable rows.
 *
 * Returns an empty array when the file does not exist — never throws
 * on missing path so callers can compose freely.
 */
function readJsonLines(path) {
    let raw;
    try {
        raw = readFileSync(path, 'utf-8');
    }
    catch (err) {
        // Missing file is the canonical "no events yet" state.
        if (err.code === 'ENOENT') {
            return [];
        }
        throw err;
    }
    const out = [];
    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.length === 0) {
            continue;
        }
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
                out.push(parsed);
            }
        }
        catch {
            // Match Python: skip the broken line silently. Append-only
            // log corruption should never crash readers.
            continue;
        }
    }
    return out;
}
/**
 * Lists every rotated `events.log.YYYYMM` file under the harness dir,
 * sorted by month ascending.
 *
 * Returns an empty array when the harness dir does not exist or when
 * no rotated buckets are present yet.
 */
function rotatedPaths(harnessDir) {
    let entries;
    try {
        entries = readdirSync(harnessDir);
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            return [];
        }
        throw err;
    }
    const matched = [];
    for (const name of entries) {
        const m = ROTATED_FILENAME_RE.exec(name);
        if (!m) {
            continue;
        }
        const fullPath = join(harnessDir, name);
        try {
            if (!statSync(fullPath).isFile()) {
                continue;
            }
        }
        catch {
            continue;
        }
        matched.push([m[1], fullPath]);
    }
    matched.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return matched.map(([, path]) => path);
}
/**
 * Stable sort key for a single event.
 *
 * Pairs the (possibly-malformed) `ts` with a tie-breaker integer so
 * sorts using this key are deterministic across runtimes. Unparseable
 * ts events get the sentinel string and therefore sort last while
 * preserving relative order.
 */
function eventSortKey(ev) {
    const ts = ev.ts;
    if (typeof ts === 'string' && ROTATABLE_TS_RE.test(ts)) {
        return [ts, 0];
    }
    return [UNPARSEABLE_TS_SENTINEL, 0];
}
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
export function* readEvents(harnessDir) {
    const buffer = [];
    for (const path of rotatedPaths(harnessDir)) {
        buffer.push(...readJsonLines(path));
    }
    buffer.push(...readJsonLines(join(harnessDir, 'events.log')));
    buffer.sort((a, b) => {
        const [ka, ta] = eventSortKey(a);
        const [kb, tb] = eventSortKey(b);
        if (ka < kb) {
            return -1;
        }
        if (ka > kb) {
            return 1;
        }
        return ta - tb;
    });
    yield* buffer;
}
/**
 * Returns the current UTC month as a `YYYYMM` string.
 *
 * Used as the default split boundary in {@link rotate}. Public visibility
 * keeps the parity test deterministic — tests inject a frozen value via
 * `RotateOptions.nowYyyymm` to avoid relying on the system clock.
 */
export function currentYyyymm() {
    const now = new Date();
    const yyyy = now.getUTCFullYear().toString().padStart(4, '0');
    const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${yyyy}${mm}`;
}
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
export function rotate(harnessDir, options = {}) {
    const nowYyyymm = options.nowYyyymm ?? currentYyyymm();
    const dryRun = options.dryRun ?? false;
    const logPath = join(harnessDir, 'events.log');
    let exists = true;
    try {
        statSync(logPath);
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            exists = false;
        }
        else {
            throw err;
        }
    }
    if (!exists) {
        return {};
    }
    const keep = [];
    const buckets = {};
    for (const ev of readJsonLines(logPath)) {
        const ts = typeof ev.ts === 'string' ? ev.ts : '';
        const evYyyymm = parseYyyymmFromTs(ts);
        if (evYyyymm === null) {
            keep.push(ev);
            continue;
        }
        if (evYyyymm >= nowYyyymm) {
            keep.push(ev);
            continue;
        }
        if (!Object.prototype.hasOwnProperty.call(buckets, evYyyymm)) {
            buckets[evYyyymm] = [];
        }
        buckets[evYyyymm].push(ev);
    }
    const moved = {};
    for (const [yyyymm, events] of Object.entries(buckets)) {
        moved[yyyymm] = events.length;
    }
    if (dryRun || Object.keys(moved).length === 0) {
        return moved;
    }
    // Append to existing rotated files (preserves prior history).
    for (const [yyyymm, events] of Object.entries(buckets)) {
        const target = join(harnessDir, `events.log.${yyyymm}`);
        const lines = events.map((ev) => `${pythonStyleJsonStringify(ev)}\n`).join('');
        appendFileSync(target, lines, 'utf-8');
    }
    // Rewrite events.log with only the keep set.
    const keepLines = keep.map((ev) => `${pythonStyleJsonStringify(ev)}\n`).join('');
    writeFileSync(logPath, keepLines, 'utf-8');
    return moved;
}
//# sourceMappingURL=eventLog.js.map