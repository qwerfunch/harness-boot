/**
 * Drive checkpoint — `_workspace/drive/run.yaml` resume state machine
 * (v0.14.0 / F-119 — Stage 2).
 *
 * The checkpoint records:
 *   - which Goal is being driven (`goal_id`)
 *   - which phase is in flight (`planning` / `scaffolded` / `executing`)
 *   - what triggered the most recent halt (`last_halt`)
 *   - Phase A artefact paths (brief.md / plan.md) and their approval state
 *   - Phase B counters (iteration · elapsed_sec · active_feature ·
 *     per-feature gate retry counts) and caps (max_iterations / max_hours)
 *
 * `_workspace/drive/run.yaml` is gitignored under the project's
 * `.harness/_workspace/*` rule (cf. `.gitignore` of harness-boot itself
 * and the templates copied by `/harness-boot:init`). The checkpoint is
 * therefore developer-local; pull-request review of a drive run goes
 * through `progress.log` (also gitignored) and `events.log` events.
 *
 * @module drive/checkpoint
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
/** Default Phase B caps. */
export const DEFAULT_MAX_ITERATIONS = 50;
export const DEFAULT_MAX_SECONDS = 7200; // 2 hours
/** Type guard — narrows an unknown value to a plain object. */
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Returns the current UTC timestamp formatted as `YYYY-MM-DDTHH:MM:SSZ`. */
function nowIso(now = new Date()) {
    const yyyy = now.getUTCFullYear().toString().padStart(4, '0');
    const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = now.getUTCDate().toString().padStart(2, '0');
    const hh = now.getUTCHours().toString().padStart(2, '0');
    const mi = now.getUTCMinutes().toString().padStart(2, '0');
    const ss = now.getUTCSeconds().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
/**
 * Returns the absolute path to `<harnessDir>/_workspace/drive/run.yaml`.
 *
 * Pure — does not touch disk. The drive workspace lives under
 * `_workspace/drive/` (gitignored together with the rest of
 * `_workspace/*`).
 */
export function checkpointPath(harnessDir) {
    return join(harnessDir, '_workspace', 'drive', 'run.yaml');
}
/** Returns `<harnessDir>/_workspace/drive/progress.log`. */
export function progressLogPath(harnessDir) {
    return join(harnessDir, '_workspace', 'drive', 'progress.log');
}
/** Returns `<harnessDir>/_workspace/drive/STOP` (the emergency-pedal sigil). */
export function stopFilePath(harnessDir) {
    return join(harnessDir, '_workspace', 'drive', 'STOP');
}
/**
 * Returns the per-Goal artefact directory used for brief / plan /
 * progress / retro files.
 *
 * Layout: `_workspace/drive/goals/<G-NNN>/`. Created on demand.
 */
export function goalArtifactDir(harnessDir, goalId) {
    return join(harnessDir, '_workspace', 'drive', 'goals', goalId);
}
/**
 * Default-shape factory — used by {@link loadCheckpoint} when no file
 * exists, and by tests that need a fresh shape for the configured
 * `goal_id`.
 */
export function defaultCheckpoint(goalId, now = new Date()) {
    const ts = nowIso(now);
    return {
        goal_id: goalId,
        phase: 'planning',
        plan: {
            brief_path: '',
            brief_approved: false,
            plan_path: '',
            plan_approved: false,
            scaffolded_features: [],
        },
        execute: {
            started_at: null,
            iteration: 0,
            elapsed_sec: 0,
            active_feature: null,
            retry_counts: {},
            max_iterations: DEFAULT_MAX_ITERATIONS,
            max_seconds: DEFAULT_MAX_SECONDS,
        },
        last_halt: null,
        created_at: ts,
        updated_at: ts,
    };
}
/**
 * Reads `_workspace/drive/run.yaml` and returns the parsed checkpoint.
 *
 * Returns `null` when the file is absent — drive's first invocation
 * for a project. Returns a best-effort partial when the file is
 * malformed (defensive default-fill so a single hand edit doesn't
 * break `--resume`).
 *
 * @param harnessDir - Path to the project's `.harness/` directory.
 * @returns The current checkpoint or `null` when none exists.
 */
export function loadCheckpoint(harnessDir) {
    const path = checkpointPath(harnessDir);
    if (!existsSync(path)) {
        return null;
    }
    let raw;
    try {
        raw = readFileSync(path, 'utf-8');
    }
    catch {
        return null;
    }
    const parsed = yamlParse(raw);
    if (!isPlainObject(parsed)) {
        return null;
    }
    if (typeof parsed.goal_id !== 'string' || parsed.goal_id.length === 0) {
        return null;
    }
    // Defensive fills — required nested objects are restored when missing
    // so the rest of drive doesn't have to null-check on every access.
    const seed = defaultCheckpoint(parsed.goal_id);
    const merged = {
        ...seed,
        ...parsed,
    };
    if (!isPlainObject(merged.plan)) {
        merged.plan = seed.plan;
    }
    else {
        merged.plan = { ...seed.plan, ...merged.plan };
    }
    if (!isPlainObject(merged.execute)) {
        merged.execute = seed.execute;
    }
    else {
        merged.execute = { ...seed.execute, ...merged.execute };
    }
    if (!isPlainObject(merged.last_halt) && merged.last_halt !== null) {
        merged.last_halt = null;
    }
    return merged;
}
/**
 * Persists the checkpoint to `_workspace/drive/run.yaml`.
 *
 * Stamps `updated_at` to "now" before writing. The directory tree is
 * created lazily — drive's first call to {@link saveCheckpoint} also
 * scaffolds `_workspace/drive/`.
 *
 * @param harnessDir - Path to the project's `.harness/` directory.
 * @param checkpoint - The complete checkpoint shape to write.
 * @param now - Override clock for tests.
 */
export function saveCheckpoint(harnessDir, checkpoint, now = new Date()) {
    const path = checkpointPath(harnessDir);
    mkdirSync(dirname(path), { recursive: true });
    const out = { ...checkpoint, updated_at: nowIso(now) };
    const text = yamlStringify(out, {
        sortMapEntries: false,
        indentSeq: false,
        lineWidth: 0,
    });
    writeFileSync(path, text, 'utf-8');
}
/**
 * Removes the checkpoint file when present.
 *
 * Used by `drive --abort` (user-initiated cancel) and after a Goal's
 * Phase C retro completes successfully — the run is over, the
 * checkpoint is no longer needed.
 *
 * Idempotent — calling on a missing file is a no-op (returns `false`).
 *
 * @returns `true` when a file was actually removed.
 */
export function clearCheckpoint(harnessDir) {
    const path = checkpointPath(harnessDir);
    if (!existsSync(path)) {
        return false;
    }
    try {
        // Use writeFileSync to truncate-and-remove via fs.rmSync at the
        // node level, but stay sync for parity with the rest of drive.
        statSync(path);
    }
    catch {
        return false;
    }
    // Lazy-load fs.rmSync (node 14.14+).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { rmSync } = require('node:fs');
    rmSync(path, { force: true });
    return true;
}
/**
 * Appends one line to `_workspace/drive/progress.log`.
 *
 * Append-only. Caller is responsible for line formatting; drive's
 * convention is `<ISO-ts> <event>: <details>`. The file is created
 * on first write.
 *
 * @param harnessDir - Path to the project's `.harness/` directory.
 * @param line - One log line. A trailing newline is added if missing.
 */
export function appendProgress(harnessDir, line) {
    const path = progressLogPath(harnessDir);
    mkdirSync(dirname(path), { recursive: true });
    const ending = line.endsWith('\n') ? '' : '\n';
    appendFileSync(path, line + ending, 'utf-8');
}
/**
 * Returns `true` when the user has dropped a STOP file at
 * `_workspace/drive/STOP`. Drive checks this between iterations
 * (halt #9 — emergency pedal).
 */
export function stopFileExists(harnessDir) {
    return existsSync(stopFilePath(harnessDir));
}
//# sourceMappingURL=checkpoint.js.map