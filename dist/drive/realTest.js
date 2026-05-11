/**
 * Drive mid-cycle real test (F-139 / Cycle B).
 *
 * Runs a user-defined "real test" command at periodic intervals
 * during a drive goal — every N feature completions by default. The
 * point: per-feature `gate_5` covers unit-level smoke; this catches
 * cross-feature regressions that only surface when the parts come
 * together (e.g. an end-to-end browser flow, a curl smoke against
 * a running dev server, a small integration script).
 *
 * Configuration in `harness.yaml`:
 *
 *     drive:
 *       real_test:
 *         command: "npm run e2e"
 *         every_n_features: 3   # default
 *
 * When unset (the common case), the hook is a silent no-op so
 * existing projects see no behaviour change.
 *
 * Boundaries:
 *
 *   - **Trigger** — `loop.ts` calls this after the F-138 replan hook
 *     at the same point (start of an iteration whose previous
 *     active feature has just transitioned to `done`).
 *   - **Pass** — exit code 0; writes `real_test_passed` event and
 *     the loop continues.
 *   - **Fail** — non-zero exit; writes `real_test_failed` event
 *     (with stderr tail) and the caller halts the loop with
 *     `reason: 'real_test_failed'`.
 *
 * @module drive/realTest
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse as yamlParse } from 'yaml';
import { State } from '../core/state.js';
/** Default cadence — run every 3 done features when unset by the user. */
export const DEFAULT_EVERY_N_FEATURES = 3;
/** F-140 — default cap on automatic retries before yielding to the user. */
export const DEFAULT_MAX_TRANSIENT_RETRIES = 1;
export function readTransientRetryConfig(harnessDir) {
    const path = join(harnessDir, 'harness.yaml');
    const fallback = { enabled: true, cap: DEFAULT_MAX_TRANSIENT_RETRIES };
    if (!existsSync(path)) {
        return fallback;
    }
    let parsed;
    try {
        parsed = yamlParse(readFileSync(path, 'utf-8'));
    }
    catch {
        return fallback;
    }
    if (!isPlainObject(parsed)) {
        return fallback;
    }
    const drive = parsed['drive'];
    if (!isPlainObject(drive)) {
        return fallback;
    }
    const realTest = drive['real_test'];
    if (!isPlainObject(realTest)) {
        return fallback;
    }
    const enabled = realTest['transient_retry'] !== false;
    const capRaw = realTest['max_transient_retries'];
    const cap = typeof capRaw === 'number' && capRaw >= 0 ? Math.floor(capRaw) : DEFAULT_MAX_TRANSIENT_RETRIES;
    return { enabled, cap };
}
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
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
/**
 * Reads `.harness/harness.yaml` and returns the real-test config when
 * the user has set a non-empty command. Returns `null` when unset.
 */
function readConfig(harnessDir) {
    const path = join(harnessDir, 'harness.yaml');
    if (!existsSync(path)) {
        return null;
    }
    let parsed;
    try {
        parsed = yamlParse(readFileSync(path, 'utf-8'));
    }
    catch {
        return null;
    }
    if (!isPlainObject(parsed)) {
        return null;
    }
    const drive = parsed['drive'];
    if (!isPlainObject(drive)) {
        return null;
    }
    const realTest = drive['real_test'];
    if (!isPlainObject(realTest)) {
        return null;
    }
    const command = realTest['command'];
    if (typeof command !== 'string' || command.trim().length === 0) {
        return null;
    }
    const everyN = realTest['every_n_features'];
    return {
        command: command.trim(),
        every_n_features: typeof everyN === 'number' && everyN > 0 ? Math.floor(everyN) : DEFAULT_EVERY_N_FEATURES,
    };
}
/**
 * Counts feature ids in the goal whose recorded progress status is
 * `done`. Pulls from `state.yaml`'s goal `feature_progress` map so
 * the cadence tracks the goal-local view (not the project-wide one).
 */
function countDoneInGoal(state, goalId) {
    const goal = state.getGoal(goalId);
    if (goal === null) {
        return 0;
    }
    const progress = goal.feature_progress;
    if (!isPlainObject(progress)) {
        return 0;
    }
    let n = 0;
    for (const status of Object.values(progress)) {
        if (status === 'done') {
            n += 1;
        }
    }
    return n;
}
/** Appends one event to `.harness/events.log`. */
function appendEvent(harnessDir, event) {
    const path = join(harnessDir, 'events.log');
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(event)}\n`, 'utf-8');
}
/** Returns the last `n` lines of a string (for stderr tails). */
function lastLines(text, n) {
    const lines = text.split('\n').filter((l) => l.length > 0);
    return lines.slice(Math.max(0, lines.length - n)).join('\n');
}
/**
 * F-139 — runs the configured real-test command when due and
 * records the outcome.
 *
 * @param harnessDir   absolute or relative path to `.harness/`
 * @param goalId       active drive goal id (`null` skips with
 *                     `skip_reason: 'no_goal'`)
 * @param _completedFid feature id that just transitioned to done.
 *                      Reserved for future per-feature gating; not
 *                      used by the cadence calculation today.
 */
export function runRealTestIfDue(harnessDir, goalId, _completedFid) {
    const cfg = readConfig(harnessDir);
    if (cfg === null) {
        return {
            ran: false,
            passed: null,
            command: null,
            exit_code: null,
            skip_reason: 'unconfigured',
        };
    }
    if (goalId === null) {
        return {
            ran: false,
            passed: null,
            command: cfg.command,
            exit_code: null,
            skip_reason: 'no_goal',
        };
    }
    const state = State.load(harnessDir);
    const doneCount = countDoneInGoal(state, goalId);
    if (doneCount === 0 || doneCount % cfg.every_n_features !== 0) {
        return {
            ran: false,
            passed: null,
            command: cfg.command,
            exit_code: null,
            skip_reason: 'not_due',
        };
    }
    // Execute via the user's shell so commands like `npm run e2e` and
    // `bash -c "..."` both work. cwd is the project root (.harness's
    // parent) so the user's commands resolve relative paths naturally.
    const projectRoot = resolvePath(harnessDir, '..');
    const result = spawnSync(cfg.command, {
        cwd: projectRoot,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf-8',
    });
    const exitCode = result.status ?? -1;
    const passed = exitCode === 0;
    const stderrTail = lastLines(result.stderr ?? '', 10);
    appendEvent(harnessDir, {
        ts: nowIso(),
        type: passed ? 'real_test_passed' : 'real_test_failed',
        goal: goalId,
        command: cfg.command,
        exit_code: exitCode,
        done_count: doneCount,
        stderr_tail: passed ? undefined : stderrTail,
    });
    return {
        ran: true,
        passed,
        command: cfg.command,
        exit_code: exitCode,
        stderr_tail: passed ? null : stderrTail,
    };
}
//# sourceMappingURL=realTest.js.map