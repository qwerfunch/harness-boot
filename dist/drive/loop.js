/**
 * Drive Phase B — execute loop (v0.14.0 / F-119 — Stage 2).
 *
 * Reads the active drive checkpoint, picks the next-action via
 * `intentPlanner.suggest()`, and executes one Suggestion per
 * iteration. Halt detection runs **before** the planner so the
 * structural guards (STOP file, wall-clock, iteration cap,
 * working-tree commit boundary, blocked feature) can short-circuit a
 * loop that would otherwise spin.
 *
 * @module drive/loop
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { State } from '../core/state.js';
import { suggest } from '../ui/intentPlanner.js';
import { loadCheckpoint, saveCheckpoint, stopFileExists, } from './checkpoint.js';
import { emitHalt } from './halt.js';
import { executeAction, mapSuggestion, } from './executor.js';
import { generateGoalRetro } from './goalRetro.js';
/** Default consecutive-fail threshold for halt #3 (gate retry). */
export const DEFAULT_MAX_RETRIES = 3;
/** Returns the current UTC timestamp formatted as `YYYY-MM-DDTHH:MM:SSZ`. */
function nowIso(now) {
    const yyyy = now.getUTCFullYear().toString().padStart(4, '0');
    const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = now.getUTCDate().toString().padStart(2, '0');
    const hh = now.getUTCHours().toString().padStart(2, '0');
    const mi = now.getUTCMinutes().toString().padStart(2, '0');
    const ss = now.getUTCSeconds().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
/** Type guard — narrows an unknown value to a plain object. */
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/**
 * Returns `true` when the project's working tree (or staged area) is
 * dirty.
 *
 * Drives halt #2 (commit_boundary). Whitelisted paths — `.harness/`
 * runtime + `_workspace/*` ceremony output + `CHANGELOG.md` — are
 * the only changes drive's own iterations should produce, so they
 * don't count as "dirty" for the user-commit halt.
 */
function workingTreeDirty(projectRoot) {
    try {
        // Use `git status --porcelain=v1` rather than `git diff --quiet`
        // so we can filter the whitelisted paths inline.
        const out = execFileSync('git', ['status', '--porcelain=v1'], {
            cwd: projectRoot,
            stdio: ['ignore', 'pipe', 'ignore'],
            encoding: 'utf-8',
        });
        if (out.trim().length === 0) {
            return false;
        }
        const lines = out.split('\n').filter((l) => l.trim().length > 0);
        for (const line of lines) {
            const path = line.slice(3); // strip the two-char status + space
            if (path.startsWith('.harness/state.yaml') ||
                path.startsWith('.harness/_workspace/') ||
                path === 'CHANGELOG.md') {
                continue;
            }
            return true;
        }
        return false;
    }
    catch {
        // No git, or git failed — drive cannot enforce the boundary; treat
        // as not-dirty so the loop proceeds. The working-tree guard inside
        // `complete()` is the second line of defence.
        return false;
    }
}
/**
 * Resolves the next feature drive should work on inside the active
 * Goal.
 *
 * Prefers `in_progress` (continuation), then the first `planned` in
 * `feature_progress` order. Returns `null` when all features are done
 * — the loop interprets that as goal-complete.
 */
function pickActiveFeature(ck, state) {
    // Walk in scaffold order so drive picks the same sequence the
    // planner produced. Priority: in_progress → planned → blocked.
    // Blocked is included so halt #5 can fire when every remaining
    // feature is blocked (otherwise the loop would silently dead-end).
    for (const fid of ck.plan.scaffolded_features) {
        const feature = state.getFeature(fid);
        if (feature === null) {
            continue;
        }
        if (feature.status === 'in_progress') {
            return { fid, status: 'in_progress' };
        }
    }
    for (const fid of ck.plan.scaffolded_features) {
        const feature = state.getFeature(fid);
        if (feature === null) {
            return { fid, status: 'planned' };
        }
        if (feature.status === 'planned') {
            return { fid, status: 'planned' };
        }
    }
    for (const fid of ck.plan.scaffolded_features) {
        const feature = state.getFeature(fid);
        if (feature !== null && feature.status === 'blocked') {
            return { fid, status: 'blocked' };
        }
    }
    return null;
}
/** Returns `true` when every feature in the goal has status `done`. */
function allFeaturesDone(ck, state) {
    if (ck.plan.scaffolded_features.length === 0) {
        return false;
    }
    for (const fid of ck.plan.scaffolded_features) {
        const feature = state.getFeature(fid);
        if (feature === null || feature.status !== 'done') {
            return false;
        }
    }
    return true;
}
/**
 * Returns the spec.yaml object for `intentPlanner.suggest()`. Empty
 * object when missing — `suggest()` tolerates `null` / `{}`.
 */
function loadSpecForPlanner(harnessDir) {
    const path = join(harnessDir, 'spec.yaml');
    if (!existsSync(path)) {
        return null;
    }
    try {
        return yamlParse(readFileSync(path, 'utf-8'));
    }
    catch {
        return null;
    }
}
/**
 * Picks the suggestion drive will consume from the planner output.
 *
 * Drive uses the *first* suggestion only — `intentPlanner.suggest()`
 * already orders them with the recommended action at index 0. The
 * remaining suggestions exist for the dashboard UI; drive does not
 * present them.
 */
function chooseSuggestion(suggestions) {
    return suggestions.length === 0 ? null : (suggestions[0] ?? null);
}
/**
 * Updates per-feature, per-gate consecutive-fail counters in the
 * checkpoint.
 *
 * Resets the counter to 0 when a gate passes; increments on a fail.
 * The retry-threshold halt (#3) is fired by the loop when any value
 * crosses {@link DEFAULT_MAX_RETRIES}.
 */
function bumpRetryCounter(ck, fid, gate, failed) {
    if (!isPlainObject(ck.execute.retry_counts[fid])) {
        ck.execute.retry_counts[fid] = {};
    }
    const map = ck.execute.retry_counts[fid];
    if (!failed) {
        map[gate] = 0;
        return 0;
    }
    const next = (map[gate] ?? 0) + 1;
    map[gate] = next;
    return next;
}
/** Returns `feature.status` from a possibly-missing record. */
function statusOf(feature) {
    return feature === null ? 'planned' : feature.status;
}
/**
 * Executes one drive iteration.
 *
 * Halt order (each is checked before the planner is invoked):
 *
 *   1. STOP file → halt #9
 *   2. iteration cap → halt #7
 *   3. wall-clock cap → halt #6
 *   4. all features done → emit goal-retro, mark phase=done, return
 *      `goal_done: true`
 *   5. active feature == blocked → halt #5
 *   6. working tree dirty → halt #2
 *
 * After those guards pass, the planner runs and the executor
 * dispatches the resulting Suggestion. A failed `run_gate` increments
 * the retry counter and may fire halt #3.
 *
 * @returns Per-iteration {@link StepResult}.
 */
export function runDriveStep(harnessDir, options) {
    const now = options.now ? options.now() : new Date();
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    let ck = loadCheckpoint(harnessDir);
    if (ck === null) {
        return {
            proceed: false,
            halt: emitHalt(harnessDir, 'manual', 'no drive checkpoint — run `harness drive "<goal>"` first.'),
        };
    }
    // (1) STOP file emergency pedal — halt #9.
    if (stopFileExists(harnessDir)) {
        return {
            proceed: false,
            halt: emitHalt(harnessDir, 'stop_file', 'STOP file present — drive halted.', {
                goal_id: ck.goal_id,
                iteration: ck.execute.iteration,
                now,
            }),
        };
    }
    // (2) iteration cap — halt #7.
    if (ck.execute.iteration >= ck.execute.max_iterations) {
        return {
            proceed: false,
            halt: emitHalt(harnessDir, 'iteration_cap', `iteration cap ${ck.execute.max_iterations} reached.`, { goal_id: ck.goal_id, iteration: ck.execute.iteration, now }),
        };
    }
    // (3) wall-clock cap — halt #6.
    const startedAt = ck.execute.started_at;
    if (typeof startedAt === 'string' && startedAt.length > 0) {
        const startMs = Date.parse(startedAt);
        if (!Number.isNaN(startMs)) {
            const elapsed = Math.floor((now.getTime() - startMs) / 1000);
            if (elapsed >= ck.execute.max_seconds) {
                return {
                    proceed: false,
                    halt: emitHalt(harnessDir, 'wall_clock', `wall-clock cap ${ck.execute.max_seconds}s reached (${elapsed}s elapsed).`, { goal_id: ck.goal_id, iteration: ck.execute.iteration, now }),
                };
            }
        }
    }
    else {
        ck.execute.started_at = nowIso(now);
    }
    // (4) goal completion check — emit retro + flip phase.
    const stateGoalCheck = State.load(harnessDir);
    if (allFeaturesDone(ck, stateGoalCheck)) {
        if (ck.phase !== 'done') {
            try {
                generateGoalRetro(harnessDir, ck.goal_id, { now });
            }
            catch {
                // Retro generation is best-effort — never block the goal flip.
            }
            ck.phase = 'done';
            stateGoalCheck.setGoalStatus(ck.goal_id, 'done');
            stateGoalCheck.save();
            saveCheckpoint(harnessDir, ck, now);
        }
        return { proceed: false, goal_done: true };
    }
    // (5) blocked active feature — halt #5.
    const active = pickActiveFeature(ck, stateGoalCheck);
    if (active === null) {
        // Defensive — should have been caught by (4).
        return {
            proceed: false,
            halt: emitHalt(harnessDir, 'manual', 'no active feature in goal — please inspect spec.yaml.'),
        };
    }
    const activeFeature = stateGoalCheck.getFeature(active.fid);
    if (statusOf(activeFeature) === 'blocked') {
        return {
            proceed: false,
            halt: emitHalt(harnessDir, 'feature_blocked', `${active.fid} is blocked — unblock then resume.`, { goal_id: ck.goal_id, feature_id: active.fid, iteration: ck.execute.iteration, now }),
        };
    }
    // (6) commit boundary — halt #2.
    // Only relevant once the active feature has reached the gate-pass
    // floor (Iron Law-eligible). Dirty earlier is fine — drive's own
    // mutations to .harness/state.yaml are whitelisted.
    if (activeFeature !== null && countDeclaredEvidence(activeFeature) >= 1) {
        const gate5 = activeFeature.gates['gate_5'];
        if (isPlainObject(gate5) && gate5.last_result === 'pass') {
            const projectRoot = dirname(harnessDir);
            if (workingTreeDirty(projectRoot)) {
                return {
                    proceed: false,
                    halt: emitHalt(harnessDir, 'commit_boundary', `${active.fid} is ready to complete — review changes and \`git commit\`, then resume.`, {
                        goal_id: ck.goal_id,
                        feature_id: active.fid,
                        iteration: ck.execute.iteration,
                        now,
                    }),
                };
            }
        }
    }
    // ----- planner + executor -----
    const spec = loadSpecForPlanner(harnessDir);
    // Force the planner's `active_feature_id` so it gives suggestions
    // for the goal's current feature, not the project-wide active.
    const stateForPlanner = State.load(harnessDir);
    if (stateForPlanner.data.session.active_feature_id !== active.fid) {
        // Persist the pointer so the planner picks the right feature on
        // the next iteration too. This is the only state-mutation drive
        // makes outside of the work cycle itself.
        stateForPlanner.setActive(active.fid);
        stateForPlanner.save();
    }
    const suggestions = suggest(stateForPlanner.data, spec);
    const chosen = chooseSuggestion(suggestions);
    if (chosen === null) {
        return {
            proceed: false,
            halt: emitHalt(harnessDir, 'manual', `intentPlanner returned no suggestion for ${active.fid} — inspect state.yaml.`, { goal_id: ck.goal_id, feature_id: active.fid, now }),
        };
    }
    const mapped = mapSuggestion(chosen);
    const executed = executeAction(harnessDir, mapped, options.executorHooks);
    // Counter bookkeeping for halt #3.
    if (mapped.kind === 'run_gate' && executed.work !== undefined) {
        const failed = Array.isArray(executed.work.gates_failed) && executed.work.gates_failed.includes(mapped.gate);
        const count = bumpRetryCounter(ck, mapped.feature_id, mapped.gate, failed);
        if (count >= maxRetries) {
            ck.execute.iteration += 1;
            saveCheckpoint(harnessDir, ck, now);
            return {
                proceed: false,
                action: mapped,
                executor: executed,
                feature_id: mapped.feature_id,
                halt: emitHalt(harnessDir, 'retry_threshold', `${mapped.gate} on ${mapped.feature_id} failed ${count} times in a row — yielding.`, {
                    goal_id: ck.goal_id,
                    feature_id: mapped.feature_id,
                    gate: mapped.gate,
                    iteration: ck.execute.iteration,
                    now,
                }),
            };
        }
    }
    // Persist iteration bookkeeping.
    ck.execute.iteration += 1;
    ck.execute.active_feature = active.fid;
    ck = recomputeElapsed(ck, now);
    saveCheckpoint(harnessDir, ck, now);
    // Mirror feature progress on the goal.
    const stateAfter = State.load(harnessDir);
    for (const fid of ck.plan.scaffolded_features) {
        const f = stateAfter.getFeature(fid);
        stateAfter.setGoalFeatureProgress(ck.goal_id, fid, statusOf(f));
    }
    if (ck.phase !== 'executing') {
        ck.phase = 'executing';
        stateAfter.setGoalStatus(ck.goal_id, 'executing');
        saveCheckpoint(harnessDir, ck, now);
    }
    stateAfter.save();
    return {
        proceed: executed.proceed,
        action: mapped,
        executor: executed,
        feature_id: active.fid,
        halt: executed.halt
            ? emitHalt(harnessDir, executed.halt.reason, executed.halt.message, {
                goal_id: ck.goal_id,
                feature_id: active.fid,
                iteration: ck.execute.iteration,
                now,
            })
            : undefined,
    };
}
/**
 * Drives the loop until any halt fires, the goal completes, or the
 * hard iteration limit is hit.
 *
 * `runDriveStep` already enforces the per-Goal iteration / wall-clock
 * caps stored in the checkpoint; `hardIterationLimit` exists as an
 * additional ceiling for the whole `runDriveLoop` invocation (e.g.
 * the dry-run integration test that wants to assert a known number of
 * steps).
 */
export function runDriveLoop(options) {
    const hardLimit = options.hardIterationLimit ?? Number.POSITIVE_INFINITY;
    let last = { proceed: true };
    let count = 0;
    while (last.proceed && count < hardLimit) {
        last = runDriveStep(options.harnessDir, options);
        count += 1;
        if (last.goal_done) {
            return last;
        }
    }
    return last;
}
/** Updates `elapsed_sec` on the checkpoint based on `started_at`. */
function recomputeElapsed(ck, now) {
    if (typeof ck.execute.started_at !== 'string') {
        return ck;
    }
    const startMs = Date.parse(ck.execute.started_at);
    if (Number.isNaN(startMs)) {
        return ck;
    }
    const elapsed = Math.max(0, Math.floor((now.getTime() - startMs) / 1000));
    ck.execute.elapsed_sec = elapsed;
    return ck;
}
/** Mirrors `isDeclaredEvidence` from core/state without importing — leaf module. */
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
//# sourceMappingURL=loop.js.map