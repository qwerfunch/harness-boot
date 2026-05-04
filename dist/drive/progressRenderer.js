/**
 * progressRenderer — two-layer progress block for `drive --status`
 * (v0.14.0 / F-118 — Stage 1).
 *
 * Layer 1 (goal-level):
 *
 *     📊 Goal G-001: 메모 동기화 (50%)
 *
 * Layer 2 (per-feature):
 *
 *     ✅ F-118 sync engine          [done · 47 tests · 5 evidence · 8m]
 *     🔵 F-119 conflict resolver    [in_progress · gate_3 running]
 *     ⚪ F-120 offline queue         [planned]
 *
 * Footer:
 *
 *     ▶ now: F-119 / gate_3 (running) · iteration 12 · 32m elapsed
 *     next halt expected: gate_4 (after evidence on F-119)
 *
 * Pure — no I/O, no LLM call. State is consumed read-only; output
 * is byte-stable for identical input. The CQS contract for
 * `drive --status` (BR-012) depends on this purity.
 *
 * @module drive/progressRenderer
 */
const STANDARD_GATES = ['gate_0', 'gate_1', 'gate_2', 'gate_3', 'gate_5'];
/** Type guard — narrows an unknown value to a plain object. */
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Returns the icon for a feature status (emoji or ASCII fallback). */
function featureIcon(status, emoji) {
    if (!emoji) {
        const map = {
            done: '[x]',
            in_progress: '[>]',
            planned: '[ ]',
            blocked: '[!]',
            archived: '[~]',
        };
        return map[status] ?? '[ ]';
    }
    const map = {
        done: '✅',
        in_progress: '🔵',
        planned: '⚪',
        blocked: '⚠',
        archived: '🗄',
    };
    return map[status] ?? '⚪';
}
/** Counts gates with `last_result === 'pass'` across the standard set. */
function countGatesPassed(feature) {
    if (!isPlainObject(feature.gates)) {
        return 0;
    }
    let count = 0;
    for (const g of STANDARD_GATES) {
        const entry = feature.gates[g];
        if (isPlainObject(entry) && entry.last_result === 'pass') {
            count += 1;
        }
    }
    return count;
}
/**
 * Counts declared evidence entries (`kind` not in
 * {`gate_run`, `gate_auto_run`}). Mirrors `isDeclaredEvidence`
 * in core/state.ts but without the import (renderer stays a leaf
 * module to avoid cycles).
 */
function countDeclaredEvidence(feature) {
    if (!Array.isArray(feature.evidence)) {
        return 0;
    }
    let count = 0;
    for (const ev of feature.evidence) {
        if (!isPlainObject(ev)) {
            continue;
        }
        const kind = ev.kind;
        if (typeof kind === 'string' && (kind === 'gate_run' || kind === 'gate_auto_run')) {
            continue;
        }
        count += 1;
    }
    return count;
}
/** Returns elapsed minutes between started_at and now, or `null` if unknown. */
function elapsedMinutes(startedAt, now) {
    if (typeof startedAt !== 'string' || startedAt.length === 0) {
        return null;
    }
    const ms = Date.parse(startedAt);
    if (Number.isNaN(ms)) {
        return null;
    }
    const diff = now.getTime() - ms;
    if (diff < 0) {
        return 0;
    }
    return Math.round(diff / 60_000);
}
/** Returns elapsed minutes from a numeric seconds value, or `null`. */
function elapsedMinutesFromSec(elapsed_sec) {
    if (typeof elapsed_sec !== 'number' || !Number.isFinite(elapsed_sec) || elapsed_sec < 0) {
        return null;
    }
    return Math.round(elapsed_sec / 60);
}
/**
 * Returns the percent of features in the goal that have transitioned
 * to `done` (rounded to integer).
 *
 * Returns `0` when the goal has no features (drive's plan phase
 * may register a goal with an empty feature list briefly).
 */
function computePercentDone(features) {
    if (features.length === 0) {
        return 0;
    }
    let done = 0;
    for (const f of features) {
        if (f.status === 'done') {
            done += 1;
        }
    }
    return Math.round((done / features.length) * 100);
}
/** Returns the running gate name for an `in_progress` feature, if knowable. */
function inflightGateLabel(feature) {
    if (feature.status !== 'in_progress') {
        return null;
    }
    for (const g of STANDARD_GATES) {
        const entry = feature.gates?.[g];
        if (!isPlainObject(entry)) {
            return g;
        }
        if (entry.last_result !== 'pass') {
            return g;
        }
    }
    return null;
}
/**
 * Renders the progress block as a single multi-line string.
 *
 * Output is byte-stable for identical input — pure function, no
 * timestamps mixed in unless caller pins `options.now`. Existing
 * elapsed-time strings come from `state.yaml` only.
 *
 * @param input - Goal spec, runtime mirror, and matched features.
 * @param options - Optional clock + emoji toggle.
 * @returns Multi-line text suitable for direct stdout printing.
 */
export function renderProgress(input, options = {}) {
    const { goalSpec, goalRuntime, features } = input;
    const emoji = options.emoji ?? true;
    const now = options.now ?? new Date();
    const percentDone = computePercentDone(features);
    const goalIcon = emoji ? '📊' : '##';
    const status = goalRuntime?.status ?? 'planning';
    const lines = [];
    lines.push(`${goalIcon} Goal ${goalSpec.id}: ${goalSpec.title} (${percentDone}%) [${status}]`);
    for (const f of features) {
        const icon = featureIcon(f.status, emoji);
        const passed = countGatesPassed(f);
        const declared = countDeclaredEvidence(f);
        const inflight = inflightGateLabel(f);
        const elapsed = elapsedMinutes(f.started_at, now);
        const parts = [];
        parts.push(`${f.status}`);
        if (inflight !== null) {
            parts.push(`${inflight} running`);
        }
        else if (passed > 0) {
            parts.push(`${passed}/${STANDARD_GATES.length} gates`);
        }
        if (declared > 0) {
            parts.push(`${declared} evidence`);
        }
        if (elapsed !== null && f.status !== 'planned') {
            parts.push(`${elapsed}m`);
        }
        const fname = featureName(f);
        lines.push(`  ${icon} ${f.id} ${fname} [${parts.join(' · ')}]`);
    }
    // footer
    const activeFeature = features.find((f) => f.status === 'in_progress') ?? null;
    const iteration = goalRuntime?.iteration ?? 0;
    const elapsedGoal = elapsedMinutesFromSec(goalRuntime?.elapsed_sec);
    const lastHalt = goalRuntime?.last_halt_reason ?? null;
    if (activeFeature !== null) {
        const inflight = inflightGateLabel(activeFeature);
        const phase = inflight !== null ? `${inflight} (running)` : 'awaiting evidence';
        const arrow = emoji ? '▶' : '>';
        const elapsedSegment = elapsedGoal !== null ? ` · ${elapsedGoal}m elapsed` : '';
        const haltSegment = lastHalt !== null ? ` · last halt: ${lastHalt}` : '';
        lines.push(`${arrow} now: ${activeFeature.id} / ${phase} · iteration ${iteration}${elapsedSegment}${haltSegment}`);
    }
    else {
        const arrow = emoji ? '▶' : '>';
        const elapsedSegment = elapsedGoal !== null ? ` · ${elapsedGoal}m elapsed` : '';
        lines.push(`${arrow} now: idle · iteration ${iteration}${elapsedSegment}`);
    }
    return lines.join('\n');
}
/**
 * Returns a JSON-friendly snapshot of one goal's progress.
 *
 * Used by `drive --status --json` for machine consumption (CI
 * pipelines, dashboard scripts). Schema is stable across renderer
 * versions — adding fields is OK, renaming is breaking.
 */
export function renderProgressJson(input, options = {}) {
    const { goalSpec, goalRuntime, features } = input;
    const now = options.now ?? new Date();
    const featuresJson = features.map((f) => ({
        id: f.id,
        status: f.status,
        gates_passed: countGatesPassed(f),
        evidence_count: countDeclaredEvidence(f),
        elapsed_min: elapsedMinutes(f.started_at, now),
    }));
    return {
        goal_id: goalSpec.id,
        title: goalSpec.title,
        status: goalRuntime?.status ?? 'planning',
        percent_done: computePercentDone(features),
        features: featuresJson,
        iteration: goalRuntime?.iteration ?? 0,
        elapsed_min: elapsedMinutesFromSec(goalRuntime?.elapsed_sec),
        last_halt_reason: goalRuntime?.last_halt_reason ?? null,
    };
}
/**
 * Returns the human-friendly feature display name from the runtime
 * record. Falls back to the id when no name is recorded.
 *
 * In stage 1, state.yaml does not carry `name` (only spec.yaml
 * does). The renderer should be passed enriched features (with
 * the name copied in by the caller) — see
 * {@link enrichFeatures} for the helper.
 */
function featureName(feature) {
    const n = feature.name;
    return typeof n === 'string' && n.length > 0 ? n : '';
}
//# sourceMappingURL=progressRenderer.js.map