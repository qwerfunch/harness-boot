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
/** Parses a timestamp the way Python's `_parse_ts` does. */
export function parseTs(ts) {
    if (typeof ts !== 'string' || ts.length === 0) {
        return null;
    }
    const ms = Date.parse(ts);
    if (Number.isNaN(ms)) {
        return null;
    }
    return new Date(ms);
}
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/**
 * Returns the events matching the supplied filter combination.
 *
 * Empty / undefined filter slots are no-ops. Multi-slot filters AND
 * together (kind && feature && since).
 */
export function filterEvents(events, options = {}) {
    const sinceDt = options.since ? parseTs(options.since) : null;
    const out = [];
    for (const ev of events) {
        if (options.kind && ev['type'] !== options.kind) {
            continue;
        }
        if (options.feature) {
            let fid = ev['feature'] ?? ev['feature_id'];
            if ((fid === undefined || fid === null) && isPlainObject(ev['payload'])) {
                fid = ev['payload']['feature'];
            }
            if (fid !== options.feature) {
                continue;
            }
        }
        if (sinceDt !== null) {
            const evDt = parseTs(ev['ts']);
            if (evDt === null || evDt.getTime() < sinceDt.getTime()) {
                continue;
            }
        }
        out.push(ev);
    }
    return out;
}
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
export function formatHuman(events) {
    if (events.length === 0) {
        return '(no matching events)\n';
    }
    const lines = [`📜 /harness:events (${events.length} events)`, ''];
    for (const ev of events) {
        const ts = typeof ev['ts'] === 'string' ? ev['ts'] : '?';
        const typ = typeof ev['type'] === 'string' ? ev['type'] : '?';
        const extras = [];
        for (const key of ['feature', 'feature_id', 'spec_hash', 'phase', 'reason']) {
            if (key in ev) {
                let val = ev[key];
                if (key === 'spec_hash' && typeof val === 'string') {
                    val = val.slice(0, 12);
                }
                extras.push(`${key}=${val}`);
            }
        }
        const extrasStr = extras.join(' · ');
        lines.push(`  ${ts}  ${typ}${extrasStr ? `  (${extrasStr})` : ''}`);
    }
    return `${lines.join('\n')}\n`;
}
//# sourceMappingURL=events.js.map