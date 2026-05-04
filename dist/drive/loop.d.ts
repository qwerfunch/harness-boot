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
import { type HaltEmission } from './halt.js';
import { type ExecutorAction, type ExecutorHooks, type ExecutorResult } from './executor.js';
/** Per-iteration result returned by {@link runDriveStep}. */
export interface StepResult {
    /** Whether the surrounding loop should advance one more step. */
    proceed: boolean;
    /** Halt info when `proceed === false`. */
    halt?: HaltEmission;
    /** Mapped action that drove this step (`null` on pre-planner halts). */
    action?: ExecutorAction | null;
    /** Underlying executor result for tests + progress logging. */
    executor?: ExecutorResult;
    /** Feature id this step touched (when known). */
    feature_id?: string | null;
    /** Whether the goal just transitioned to done. */
    goal_done?: boolean;
}
/** Options accepted by {@link runDriveLoop}. */
export interface RunDriveLoopOptions {
    /** Path to the project's `.harness/` directory. */
    harnessDir: string;
    /** Maximum consecutive failures of the same gate before halt #3. */
    maxRetries?: number;
    /** Override clock for tests. */
    now?: () => Date;
    /** Test-isolation hooks for the executor (run-gate / complete / activate). */
    executorHooks?: ExecutorHooks;
    /** Hard cap — drive will never exceed this many iterations per call. */
    hardIterationLimit?: number;
}
/** Default consecutive-fail threshold for halt #3 (gate retry). */
export declare const DEFAULT_MAX_RETRIES = 3;
/**
 * F-121 / L-002 — sliding-window cap for the per-(feature, gate) recent
 * results array on the checkpoint. Three entries is enough to spot
 * stuck loops without bloating the YAML.
 */
export declare const RECENT_GATE_RESULTS_WINDOW = 3;
/**
 * F-121 / L-002 — number of consecutive identical non-pass gate results
 * that fires halt #10 (`gate_no_progress`). Two is the smallest value
 * that still distinguishes "first miss" from "stuck on the same point";
 * tests assert the value to keep the contract explicit.
 */
export declare const GATE_STAGNATION_THRESHOLD = 2;
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
export declare function runDriveStep(harnessDir: string, options: RunDriveLoopOptions): StepResult;
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
export declare function runDriveLoop(options: RunDriveLoopOptions): StepResult;
//# sourceMappingURL=loop.d.ts.map