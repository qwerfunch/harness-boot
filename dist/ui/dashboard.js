/**
 * `/harness-boot:work` no-args dashboard renderer (F-103 port of
 * `scripts/ui/dashboard.py`, v0.9.2).
 *
 * Pure renderer — takes parsed `state.yaml` + optional `spec.yaml` +
 * pre-computed suggestions, returns a multi-line Korean (default)
 * dashboard string. Performs no disk writes; reads coverage
 * fingerprints from `_workspace/coverage/F-N.yaml` only when a
 * `harnessDir` override is supplied.
 *
 * @module ui/dashboard
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { STANDARD_GATES } from '../core/gates.js';
import { agentsForShapes, detectShapes, hasAudioFlag, parallelGroupsForShapes, } from '../ceremonies/kickoff.js';
import { maxOtherList, maxPendingList, maxUnregisteredList, } from './dashboardConfig.js';
import { resolveLang } from './lang.js';
import { t } from './messages.js';
import { renderAgentChain } from './render.js';
/** F-079 default coverage threshold; mirrors checkSpecCoverage. */
const DEFAULT_COVERAGE_THRESHOLD = 0.8;
/** Below-threshold count that triggers the red-alert line. */
const DEBT_ALERT_THRESHOLD = 5;
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function isFile(path) {
    try {
        return statSync(path).isFile();
    }
    catch {
        return false;
    }
}
/**
 * Reads F-077 fingerprint and computes coverage ratio.
 *
 * Returns `[coverage, mismatches]` where coverage is the arithmetic
 * mean of `ac_value / description_value` across mismatches (`1.0`
 * when the mismatches list is empty), or `null` when the fingerprint
 * file is missing / unparseable.
 */
export function loadCoverage(harnessDir, fid) {
    if (harnessDir === null) {
        return [null, []];
    }
    const fpPath = join(harnessDir, '_workspace', 'coverage', `${fid}.yaml`);
    if (!isFile(fpPath)) {
        return [null, []];
    }
    let fp;
    try {
        fp = yamlParse(readFileSync(fpPath, 'utf-8'));
    }
    catch {
        return [null, []];
    }
    if (!isPlainObject(fp)) {
        return [null, []];
    }
    const mismatches = asArray(fp['mismatches']);
    if (mismatches.length === 0) {
        return [1.0, []];
    }
    const ratios = [];
    const detailed = [];
    for (const m of mismatches) {
        if (!isPlainObject(m)) {
            continue;
        }
        const desc = Number(m['description_value'] ?? 0);
        const ac = Number(m['ac_value'] ?? 0);
        if (Number.isNaN(desc) || Number.isNaN(ac) || desc <= 0) {
            continue;
        }
        ratios.push(ac / desc);
        detailed.push({ metric: typeof m['metric'] === 'string' ? m['metric'] : '', ac, desc });
    }
    if (ratios.length === 0) {
        return [null, []];
    }
    const mean = ratios.reduce((acc, r) => acc + r, 0) / ratios.length;
    return [mean, detailed];
}
function formatCoverageLine(coverage, detailed) {
    const pct = Math.round(coverage * 100);
    const parts = detailed.map((d) => `${d.ac}/${d.desc} ${d.metric}`);
    const detail = parts.join(', ');
    return detail.length > 0 ? `  coverage: ${pct}% (${detail})` : `  coverage: ${pct}%`;
}
function featureTitle(fid, spec) {
    if (!isPlainObject(spec)) {
        return fid;
    }
    for (const f of asArray(spec['features'])) {
        if (isPlainObject(f) && f['id'] === fid) {
            const title = f['name'] ?? f['title'];
            if (typeof title === 'string' && title.trim().length > 0) {
                return title.trim();
            }
        }
    }
    return fid;
}
function countGatesPassed(gates) {
    let count = 0;
    for (const g of STANDARD_GATES) {
        const entry = gates[g];
        if (isPlainObject(entry) && entry['last_result'] === 'pass') {
            count++;
        }
    }
    return count;
}
/**
 * Returns the most-recent blocker evidence summary, but only when
 * the very last evidence entry is a blocker — once the user adds
 * post-block evidence the suggestion flips to normal flow.
 */
function latestBlockerNote(feature) {
    const evidence = asArray(feature['evidence']);
    for (let i = evidence.length - 1; i >= 0; i--) {
        const ev = evidence[i];
        if (!isPlainObject(ev)) {
            continue;
        }
        if (ev['kind'] === 'blocker') {
            const summary = ev['summary'];
            return typeof summary === 'string' && summary.trim().length > 0 ? summary.trim() : null;
        }
        return null;
    }
    return null;
}
function resolveAgentChain(fid, spec) {
    if (!isPlainObject(spec)) {
        return { agents: [], groups: [] };
    }
    const features = asArray(spec['features']);
    const feature = features.find((f) => isPlainObject(f) && f['id'] === fid);
    if (!isPlainObject(feature)) {
        return { agents: [], groups: [] };
    }
    try {
        const shapes = detectShapes(feature, spec);
        if (shapes.length === 0) {
            return { agents: [], groups: [] };
        }
        const audio = hasAudioFlag(feature);
        return {
            agents: agentsForShapes(shapes, audio),
            groups: parallelGroupsForShapes(shapes, audio),
        };
    }
    catch {
        return { agents: [], groups: [] };
    }
}
function renderActiveBlock(feature, spec, lang, harnessDir) {
    const fid = typeof feature['id'] === 'string' ? feature['id'] : '?';
    const title = featureTitle(fid, spec);
    const gates = isPlainObject(feature['gates']) ? feature['gates'] : {};
    const passed = countGatesPassed(gates);
    const evidenceCount = asArray(feature['evidence']).length;
    const lines = [t('active_feature', lang, { title })];
    lines.push(t('progress_line', lang, {
        passed,
        total: STANDARD_GATES.length,
        evidence: evidenceCount,
    }));
    const [coverage, detailed] = loadCoverage(harnessDir, fid);
    if (coverage !== null && coverage < 1.0) {
        lines.push(formatCoverageLine(coverage, detailed));
    }
    const blocker = latestBlockerNote(feature);
    if (blocker !== null) {
        lines.push(t('blocker_line', lang, { note: blocker }));
    }
    const { agents, groups } = resolveAgentChain(fid, spec);
    if (agents.length > 0) {
        lines.push(`  ${t('agent_chain', lang)}: ${renderAgentChain(agents, groups)}`);
    }
    return lines;
}
function renderCoverageDebt(features, harnessDir, threshold, _lang) {
    if (harnessDir === null) {
        return [];
    }
    const withMismatches = [];
    const belowThreshold = [];
    for (const f of features) {
        if (!isPlainObject(f)) {
            continue;
        }
        const fid = f['id'];
        if (typeof fid !== 'string') {
            continue;
        }
        const [coverage] = loadCoverage(harnessDir, fid);
        if (coverage === null || coverage >= 1.0) {
            continue;
        }
        withMismatches.push(fid);
        if (coverage < threshold) {
            belowThreshold.push(fid);
        }
    }
    if (withMismatches.length === 0) {
        return [];
    }
    const block = [];
    if (belowThreshold.length > DEBT_ALERT_THRESHOLD) {
        block.push('⚠ Coverage debt high — review carry-forward before next feature');
    }
    block.push(`Coverage debt: ${withMismatches.length} features with mismatches ` +
        `(${belowThreshold.length} below threshold ${threshold.toFixed(2)})`);
    return block;
}
function renderOtherInProgress(features, activeId, spec, lang) {
    const others = [];
    for (const f of features) {
        if (isPlainObject(f) &&
            f['status'] === 'in_progress' &&
            f['id'] !== activeId) {
            others.push(f);
        }
    }
    if (others.length === 0) {
        return [];
    }
    const lines = [t('in_progress_others', lang)];
    for (const f of others.slice(0, maxOtherList())) {
        const fid = typeof f['id'] === 'string' ? f['id'] : '?';
        lines.push(`  "${featureTitle(fid, spec)}"`);
    }
    return lines;
}
function renderPending(features, spec, lang) {
    const pending = [];
    for (const f of features) {
        if (isPlainObject(f) && f['status'] === 'planned') {
            pending.push(f);
        }
    }
    if (pending.length === 0) {
        return [];
    }
    const titles = pending.slice(0, maxPendingList()).map((f) => {
        const fid = typeof f['id'] === 'string' ? f['id'] : '?';
        return `"${featureTitle(fid, spec)}"`;
    });
    return [`${t('pending_label', lang)} ${titles.join(' · ')}`];
}
function renderUnregistered(stateFeatures, spec, lang) {
    if (!isPlainObject(spec)) {
        return { lines: [], total: 0 };
    }
    const specFeatures = asArray(spec['features']);
    if (specFeatures.length === 0) {
        return { lines: [], total: 0 };
    }
    const registered = new Set();
    for (const f of stateFeatures) {
        if (isPlainObject(f) && typeof f['id'] === 'string') {
            registered.add(f['id']);
        }
    }
    const candidates = [];
    for (const f of specFeatures) {
        if (!isPlainObject(f)) {
            continue;
        }
        const fid = f['id'];
        if (typeof fid !== 'string' || fid.length === 0) {
            continue;
        }
        if (registered.has(fid)) {
            continue;
        }
        if (f['status'] === 'archived') {
            continue;
        }
        if (f['superseded_by']) {
            continue;
        }
        if (f['archived_at']) {
            continue;
        }
        candidates.push(f);
    }
    if (candidates.length === 0) {
        return { lines: [], total: 0 };
    }
    const max = maxUnregisteredList();
    const titles = candidates.slice(0, max).map((f) => {
        const fid = typeof f['id'] === 'string' ? f['id'] : '?';
        return `"${featureTitle(fid, spec)}"`;
    });
    const header = t('next_candidates', lang, { n: candidates.length });
    const lines = [header, `  ${titles.join(' · ')}`];
    if (candidates.length > max) {
        lines.push(t('more_after_truncate', lang, { n: candidates.length - max }));
    }
    return { lines, total: candidates.length };
}
function renderBlocked(features, activeId, spec, lang) {
    const blocked = [];
    for (const f of features) {
        if (isPlainObject(f) &&
            f['status'] === 'blocked' &&
            f['id'] !== activeId) {
            blocked.push(f);
        }
    }
    if (blocked.length === 0) {
        return [];
    }
    const titles = blocked.slice(0, maxOtherList()).map((f) => {
        const fid = typeof f['id'] === 'string' ? f['id'] : '?';
        return `"${featureTitle(fid, spec)}"`;
    });
    return [`${t('on_hold_label', lang)} ${titles.join(' · ')}`];
}
function renderSuggestions(suggestions, lang) {
    if (suggestions.length === 0) {
        return [];
    }
    const lines = [t('next_actions', lang)];
    const markerText = t('recommended_marker', lang);
    suggestions.forEach((s, i) => {
        const idx = i + 1;
        const marker = idx === 1 ? ` ${markerText}` : '';
        lines.push(`  (${idx}) ${s.label}${marker}`);
    });
    lines.push('');
    lines.push(t('enter_hint', lang, { n: 1 }));
    return lines;
}
/**
 * Renders the dashboard as a single string ending with a newline.
 *
 * F-040 — labels and headers honor the resolved language. Pass
 * `options.lang` explicitly for tests; production callers omit it
 * so the resolver picks up `HARNESS_LANG` / spec / system locale.
 */
export function render(stateData, spec, suggestions, options = {}) {
    const lang = options.lang ?? resolveLang(spec);
    const harnessDir = options.harnessDir ?? null;
    const sections = [];
    sections.push([`📊 ${t('dashboard_title', lang)}`]);
    const features = isPlainObject(stateData) ? asArray(stateData['features']) : [];
    const session = isPlainObject(stateData) && isPlainObject(stateData['session']) ? stateData['session'] : null;
    const activeId = session !== null && typeof session['active_feature_id'] === 'string'
        ? session['active_feature_id']
        : null;
    const byId = new Map();
    for (const f of features) {
        if (isPlainObject(f) && typeof f['id'] === 'string') {
            byId.set(f['id'], f);
        }
    }
    if (activeId !== null && byId.has(activeId)) {
        sections.push(renderActiveBlock(byId.get(activeId), spec, lang, harnessDir));
    }
    const otherBlock = renderOtherInProgress(features, activeId, spec, lang);
    if (otherBlock.length > 0) {
        sections.push(otherBlock);
    }
    const blockedBlock = renderBlocked(features, activeId, spec, lang);
    if (blockedBlock.length > 0) {
        sections.push(blockedBlock);
    }
    const pendingBlock = renderPending(features, spec, lang);
    if (pendingBlock.length > 0) {
        sections.push(pendingBlock);
    }
    const { lines: unregisteredBlock, total: unregisteredCount } = renderUnregistered(features, spec, lang);
    if (unregisteredBlock.length > 0) {
        sections.push(unregisteredBlock);
    }
    const debtBlock = renderCoverageDebt(features, harnessDir, DEFAULT_COVERAGE_THRESHOLD, lang);
    if (debtBlock.length > 0) {
        sections.push(debtBlock);
    }
    if (byId.size === 0 && features.length === 0 && unregisteredCount === 0) {
        sections.push([t('no_features', lang)]);
    }
    else if ((activeId === null || !byId.has(activeId)) &&
        otherBlock.length === 0 &&
        blockedBlock.length === 0 &&
        pendingBlock.length === 0 &&
        unregisteredBlock.length === 0) {
        let doneCount = 0;
        for (const f of features) {
            if (isPlainObject(f) && f['status'] === 'done') {
                doneCount++;
            }
        }
        if (doneCount > 0) {
            sections.push([t('all_done', lang, { n: doneCount })]);
        }
        else {
            sections.push([t('no_active_no_pending', lang)]);
        }
    }
    const suggestionBlock = renderSuggestions(suggestions, lang);
    if (suggestionBlock.length > 0) {
        sections.push(suggestionBlock);
    }
    const joined = sections.map((b) => b.join('\n')).join('\n\n');
    return `${joined.replace(/\s+$/, '')}\n`;
}
//# sourceMappingURL=dashboard.js.map