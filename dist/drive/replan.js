/**
 * Drive replan hook (F-138 / Cycle A1) — adaptive feature-by-feature
 * replanning after a feature transitions to `done`.
 *
 * Today drive runs the planner's pre-computed feature list in order.
 * `replanAfterCompletion` lets drive **rethink** the remainder of
 * the goal each time a feature ships, using what was just learned.
 *
 * Lite scope (this cycle):
 *
 *   1. **Deterministic replan** — moves any pending feature whose
 *      state.yaml status is `blocked` to the end of the goal's
 *      ordering, and applies `superseded_by` chains to defer
 *      superseded ids. No LLM call, no network.
 *   2. **File-drop manifest** — when the just-completed retro hints
 *      that scope is shifting (keyword scan: `replan`, `pivot`,
 *      `rethink`, `scope`), drive writes a structured request to
 *      `.harness/_workspace/replan/<goal-id>-after-<fid>.md`. The
 *      orchestrator (next Claude turn) reads the file, decides on
 *      the actual mutation, and applies it via the normal spec
 *      authoring flow. This keeps drive within BR-015 (no self-
 *      issued spec mutations of substance).
 *
 * Cycle A2 (queued) will add an automatic LLM call so the file-drop
 * round-trip is collapsed into a single autonomous pass.
 *
 * Boundaries:
 *
 *   - **Idempotent per-fid**: a re-call with the same `completedFid`
 *     finds the prior `replan_evaluated` event in events.log and
 *     short-circuits.
 *   - **Opt-out**: `harness.yaml` `drive.replan.enabled: false`
 *     skips the hook entirely (one `replan_disabled` event the
 *     first time, silent thereafter).
 *
 * @module drive/replan
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { State } from '../core/state.js';
/** Keywords in the just-finished retro that trigger the file-drop manifest. */
const RETRO_PIVOT_KEYWORDS = [
    'replan',
    'pivot',
    'rethink',
    'scope shift',
    'scope change',
];
/** Returns a fresh empty result. */
function emptyResult() {
    return { evaluated: false, deltas: { deferred: [], reordered: [] }, manifest_path: null };
}
/** Returns the current UTC timestamp formatted as `YYYY-MM-DDTHH:MM:SSZ`. */
function nowIso() {
    const d = new Date();
    const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
    const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = d.getUTCDate().toString().padStart(2, '0');
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mi = d.getUTCMinutes().toString().padStart(2, '0');
    const ss = d.getUTCSeconds().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
/** Type guard for plain objects. */
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/**
 * Reads `.harness/harness.yaml` and returns the
 * `drive.replan.enabled` toggle. Defaults to `true`.
 */
function isReplanEnabled(harnessDir) {
    const path = join(harnessDir, 'harness.yaml');
    if (!existsSync(path)) {
        return true;
    }
    try {
        const parsed = yamlParse(readFileSync(path, 'utf-8'));
        if (!isPlainObject(parsed)) {
            return true;
        }
        const drive = parsed['drive'];
        if (!isPlainObject(drive)) {
            return true;
        }
        const replan = drive['replan'];
        if (!isPlainObject(replan)) {
            return true;
        }
        return replan['enabled'] !== false;
    }
    catch {
        return true;
    }
}
/**
 * Returns true when events.log already carries a `replan_evaluated`
 * event with this `feature` id. Used for the idempotent re-call
 * short-circuit.
 */
export function replanAlreadyEvaluated(harnessDir, completedFid) {
    return alreadyEvaluated(harnessDir, completedFid);
}
function alreadyEvaluated(harnessDir, completedFid) {
    const path = join(harnessDir, 'events.log');
    if (!existsSync(path)) {
        return false;
    }
    const text = readFileSync(path, 'utf-8');
    for (const line of text.split('\n')) {
        if (line.length === 0) {
            continue;
        }
        try {
            const parsed = JSON.parse(line);
            if (parsed['type'] === 'replan_evaluated' && parsed['feature'] === completedFid) {
                return true;
            }
        }
        catch {
            // tolerate non-JSON lines
        }
    }
    return false;
}
/** Returns true when events.log already carries a `replan_disabled` event. */
function alreadyDisabledOnce(harnessDir) {
    const path = join(harnessDir, 'events.log');
    if (!existsSync(path)) {
        return false;
    }
    const text = readFileSync(path, 'utf-8');
    return text.includes('"type":"replan_disabled"');
}
/** Appends one event to `.harness/events.log` (creates the file when absent). */
function appendEvent(harnessDir, event) {
    const path = join(harnessDir, 'events.log');
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(event)}\n`, 'utf-8');
}
/**
 * Reads the just-completed retro file (when present) and returns its
 * raw contents. Used by the keyword scan to decide whether to drop a
 * manifest.
 */
function readRetro(harnessDir, completedFid) {
    const path = join(harnessDir, '_workspace', 'retro', `${completedFid}.md`);
    if (!existsSync(path)) {
        return null;
    }
    try {
        return readFileSync(path, 'utf-8');
    }
    catch {
        return null;
    }
}
/**
 * Returns true when the retro text mentions any pivot / replan keyword
 * (case-insensitive).
 */
function retroSuggestsReplan(retroText) {
    const lower = retroText.toLowerCase();
    return RETRO_PIVOT_KEYWORDS.some((kw) => lower.includes(kw));
}
/**
 * Reads spec.yaml for the per-feature `superseded_by` chain. Returns
 * the set of feature ids that have been replaced by another feature.
 */
function readSupersededIds(harnessDir) {
    const path = join(harnessDir, 'spec.yaml');
    if (!existsSync(path)) {
        return new Set();
    }
    let parsed;
    try {
        parsed = yamlParse(readFileSync(path, 'utf-8'));
    }
    catch {
        return new Set();
    }
    if (!isPlainObject(parsed)) {
        return new Set();
    }
    const features = parsed['features'];
    if (!Array.isArray(features)) {
        return new Set();
    }
    const out = new Set();
    for (const f of features) {
        if (!isPlainObject(f))
            continue;
        const id = f['id'];
        const sb = f['superseded_by'];
        if (typeof id === 'string' && typeof sb === 'string' && sb.length > 0) {
            out.add(id);
        }
    }
    return out;
}
/**
 * F-138 — adaptive replan after a feature transitions to `done`.
 *
 * Pipeline:
 *
 *   1. Honour opt-out (`harness.yaml drive.replan.enabled: false`).
 *   2. Short-circuit when a prior `replan_evaluated` event already
 *      exists for this `completedFid` (idempotent re-call guard).
 *   3. Walk the goal's `feature_progress` ordering on state.yaml.
 *      Defer ids whose status is `blocked` or whose spec entry
 *      carries `superseded_by` — push them to the end of the goal's
 *      ordering. Reorder list captures every move.
 *   4. When the just-completed retro contains a pivot keyword, drop
 *      a manifest under `.harness/_workspace/replan/<goal>-after-<fid>.md`
 *      with structured context the orchestrator can act on.
 *   5. Emit one `replan_evaluated` event with the deltas and (when
 *      written) the manifest path.
 *
 * @param harnessDir   absolute or relative path to the `.harness/` dir
 * @param completedFid feature id that just transitioned to `done`
 * @param goalId       goal id this feature belongs to (`null` when no
 *                     active drive goal is set)
 */
export function replanAfterCompletion(harnessDir, completedFid, goalId) {
    if (!isReplanEnabled(harnessDir)) {
        if (!alreadyDisabledOnce(harnessDir)) {
            appendEvent(harnessDir, { ts: nowIso(), type: 'replan_disabled' });
        }
        const r = emptyResult();
        r.skip_reason = 'opt_out';
        return r;
    }
    if (alreadyEvaluated(harnessDir, completedFid)) {
        const r = emptyResult();
        r.skip_reason = 'already_evaluated';
        return r;
    }
    if (goalId === null) {
        const r = emptyResult();
        r.skip_reason = 'no_goal';
        return r;
    }
    const state = State.load(harnessDir);
    const goal = state.getGoal(goalId);
    if (goal === null) {
        const r = emptyResult();
        r.skip_reason = 'no_goal';
        return r;
    }
    const progress = (goal.feature_progress ?? {});
    const supersededIds = readSupersededIds(harnessDir);
    const deferred = [];
    const reordered = [];
    // Walk the ordering; collect ids needing deferral. The actual
    // reorder is applied to the goal's feature_progress map: deferred
    // ids are reinserted at the end (preserving relative order).
    const orderedIds = Object.keys(progress);
    for (const fid of orderedIds) {
        const status = progress[fid];
        const isBlocked = status === 'blocked';
        const isSuperseded = supersededIds.has(fid);
        if ((isBlocked || isSuperseded) && status !== 'done' && status !== 'archived') {
            deferred.push(fid);
        }
    }
    if (deferred.length > 0) {
        // Re-insert deferred ids at the end while preserving order.
        const remaining = orderedIds.filter((fid) => !deferred.includes(fid));
        const newOrder = [...remaining, ...deferred];
        if (newOrder.join(',') !== orderedIds.join(',')) {
            // Apply the new ordering by rewriting feature_progress in
            // insertion order (Object.keys iteration order matches
            // insertion order for string keys).
            const newProgress = {};
            for (const fid of newOrder) {
                newProgress[fid] = progress[fid] ?? 'planned';
            }
            goal.feature_progress = newProgress;
            state.save();
            reordered.push(...newOrder);
        }
    }
    // File-drop manifest when retro hints at pivot.
    const retroText = readRetro(harnessDir, completedFid);
    let manifestPath = null;
    if (retroText !== null && retroSuggestsReplan(retroText)) {
        manifestPath = join(harnessDir, '_workspace', 'replan', `${goalId}-after-${completedFid}.md`);
        mkdirSync(dirname(manifestPath), { recursive: true });
        if (!existsSync(manifestPath)) {
            writeFileSync(manifestPath, renderManifest(goalId, completedFid, retroText), 'utf-8');
        }
    }
    appendEvent(harnessDir, {
        ts: nowIso(),
        type: 'replan_evaluated',
        feature: completedFid,
        goal: goalId,
        deferred,
        reordered,
        manifest_path: manifestPath,
    });
    return {
        evaluated: true,
        deltas: { deferred, reordered },
        manifest_path: manifestPath,
    };
}
/**
 * Renders the file-drop manifest content. The orchestrator reads this
 * file on the next Claude turn and decides whether to mutate spec.yaml.
 */
function renderManifest(goalId, completedFid, retroText) {
    const lines = [];
    lines.push(`# Replan request — goal ${goalId}, after ${completedFid}`);
    lines.push('');
    lines.push(`Drive's replan hook detected pivot keywords in the retro for ${completedFid}. ` +
        'Review the retro context below and decide whether to mutate the goal\'s feature ' +
        'plan (reorder, add new features, drop stale ones). Apply changes via the normal ' +
        'spec authoring flow (`/harness-boot:work` with `feature-author` skill, or direct ' +
        'spec.yaml edit followed by `harness sync`).');
    lines.push('');
    lines.push('## Retro excerpt');
    lines.push('');
    lines.push('```');
    lines.push(retroText.trim());
    lines.push('```');
    lines.push('');
    lines.push('## Suggested next actions');
    lines.push('');
    lines.push('- [ ] Re-read the goal definition in `.harness/spec.yaml` `goals[]`.');
    lines.push('- [ ] List remaining pending features and assess each: still relevant, reprioritise, drop, or replace?');
    lines.push('- [ ] Apply mutations to spec.yaml; mirror to `docs/samples/...` per project policy.');
    lines.push('- [ ] Resume drive (`harness drive --resume`) once the new plan is in place.');
    return `${lines.join('\n')}\n`;
}
//# sourceMappingURL=replan.js.map