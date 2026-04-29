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
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { State } from './core/state.js';
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function loadHarnessYaml(harnessDir) {
    const path = join(harnessDir, 'harness.yaml');
    try {
        if (!statSync(path).isFile()) {
            return {};
        }
    }
    catch {
        return {};
    }
    const raw = readFileSync(path, 'utf-8');
    const parsed = yamlParse(raw);
    return isPlainObject(parsed) ? parsed : {};
}
/** Reads the last n JSON-line entries from `events.log`. */
function tailEvents(harnessDir, n = 1) {
    const path = join(harnessDir, 'events.log');
    try {
        if (!statSync(path).isFile()) {
            return [];
        }
    }
    catch {
        return [];
    }
    const raw = readFileSync(path, 'utf-8');
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    const tail = lines.slice(-n);
    const out = [];
    for (const line of tail) {
        try {
            const parsed = JSON.parse(line);
            if (isPlainObject(parsed)) {
                out.push(parsed);
            }
        }
        catch {
            continue;
        }
    }
    return out;
}
/** Builds a {@link StatusReport} for the given harness directory. */
export function buildReport(harnessDir, options = {}) {
    const featureFilter = options.featureFilter ?? null;
    const state = State.load(harnessDir);
    const harnessYaml = loadHarnessYaml(harnessDir);
    const generation = isPlainObject(harnessYaml['generation'])
        ? harnessYaml['generation']
        : {};
    const driftStatus = typeof generation['drift_status'] === 'string'
        ? generation['drift_status']
        : 'unknown';
    const recentEvents = tailEvents(harnessDir, 5);
    let lastSync = null;
    for (let i = recentEvents.length - 1; i >= 0; i--) {
        const ev = recentEvents[i];
        if (ev['type'] === 'sync_completed') {
            const ts = typeof ev['ts'] === 'string' ? ev['ts'] : null;
            const specHash = typeof ev['spec_hash'] === 'string' ? ev['spec_hash'].slice(0, 12) : '';
            const pluginVersion = typeof ev['plugin_version'] === 'string' ? ev['plugin_version'] : null;
            lastSync = { ts, spec_hash: specHash, plugin_version: pluginVersion };
            break;
        }
    }
    const counts = state.featureCounts();
    const featuresSummary = [];
    for (const f of state.data.features) {
        if (!isPlainObject(f)) {
            continue;
        }
        const fid = typeof f['id'] === 'string' ? f['id'] : '?';
        if (featureFilter !== null && fid !== featureFilter) {
            continue;
        }
        const gates = isPlainObject(f['gates']) ? f['gates'] : {};
        const passed = [];
        const failed = [];
        for (const [g, v] of Object.entries(gates)) {
            if (!isPlainObject(v)) {
                continue;
            }
            const result = v['last_result'];
            if (result === 'pass') {
                passed.push(g);
            }
            else if (result === 'fail') {
                failed.push(g);
            }
        }
        featuresSummary.push({
            id: fid,
            status: typeof f['status'] === 'string' ? f['status'] : 'planned',
            started_at: typeof f['started_at'] === 'string' ? f['started_at'] : null,
            completed_at: typeof f['completed_at'] === 'string' ? f['completed_at'] : null,
            gates_passed: passed,
            gates_failed: failed,
            evidence_count: Array.isArray(f['evidence']) ? f['evidence'].length : 0,
        });
    }
    const activeFid = state.data.session.active_feature_id;
    const activeFeature = typeof activeFid === 'string'
        ? featuresSummary.find((f) => f.id === activeFid) ?? null
        : null;
    return {
        session: { ...state.data.session },
        counts,
        drift_status: driftStatus,
        last_sync: lastSync,
        features_summary: featuresSummary,
        active_feature: activeFeature,
    };
}
/** Trims trailing whitespace, mirroring Python's `str.rstrip()`. */
function rstrip(s) {
    return s.replace(/\s+$/, '');
}
function pad(s, width) {
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}
/**
 * Renders a {@link StatusReport} as the human view (matching Python
 * `format_human`).
 */
export function formatHuman(report) {
    const lines = ['📋 /harness:status', ''];
    const s = report.session;
    lines.push('Session');
    lines.push(`  started_at         ${s.started_at ?? '—'}`);
    lines.push(`  last_command       ${s.last_command || '—'}`);
    lines.push(`  last_gate_passed   ${s.last_gate_passed ?? '—'}`);
    lines.push(`  active_feature_id  ${s.active_feature_id ?? '—'}`);
    lines.push('');
    const c = report.counts;
    const total = Object.values(c).reduce((acc, n) => acc + n, 0);
    lines.push(`Features (${total})`);
    for (const [st, n] of Object.entries(c)) {
        if (n > 0) {
            lines.push(`  ${pad(st, 12)} ${n}`);
        }
    }
    lines.push('');
    lines.push(`Drift status: ${report.drift_status}`);
    lines.push('');
    if (report.last_sync !== null) {
        const ls = report.last_sync;
        lines.push(`Last sync: ${ls.ts ?? ''} · spec_hash=${ls.spec_hash} · plugin=${ls.plugin_version ?? ''}`);
        lines.push('');
    }
    if (report.active_feature !== null) {
        const af = report.active_feature;
        lines.push(`Active feature: ${af.id} [${af.status}]`);
        if (af.gates_passed.length > 0) {
            lines.push(`  gates passed: ${af.gates_passed.join(', ')}`);
        }
        if (af.gates_failed.length > 0) {
            lines.push(`  gates failed: ${af.gates_failed.join(', ')}`);
        }
        lines.push(`  evidence: ${af.evidence_count} entries`);
        lines.push('');
    }
    return `${rstrip(lines.join('\n'))}\n`;
}
//# sourceMappingURL=status.js.map