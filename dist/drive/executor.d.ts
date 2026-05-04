/**
 * Drive executor — `Suggestion → ExecutorAction` typed-union dispatch
 * (v0.14.0 / F-119 — Stage 2).
 *
 * The intentPlanner returns one {@link Suggestion} per call. Drive's
 * job is to either:
 *   - **execute the action** when it's deterministic (`run_gate`,
 *     `complete`, `start_feature`), or
 *   - **halt back to the user** when it requires LLM judgment
 *     (`analyze_fail`, `resolve_block`) or human decision
 *     (`add_evidence`, `init_feature`, `review_carry_forward`,
 *     `resume`, `deactivate`).
 *
 * The split honours BR-015:
 *   - (a) drive cannot self-issue `--hotfix-reason` — `complete()`
 *     calls never pass one; if the Iron Law fails, drive halts.
 *   - (b) drive cannot call `git commit/push/tag`, `gh release`, or
 *     marketplace operations — none of the deterministic branches
 *     reach those helpers.
 *
 * @module drive/executor
 */
import { activate as workActivate, complete as workComplete, runAndRecordGate as workRunGate, type WorkResult } from '../work.js';
import type { Suggestion } from '../ui/intentPlanner.js';
import type { HaltReason } from './types.js';
/** Discriminated union of what the executor can do with a Suggestion. */
export type ExecutorAction = {
    kind: 'run_gate';
    feature_id: string;
    gate: string;
    label: string;
} | {
    kind: 'complete';
    feature_id: string;
    label: string;
} | {
    kind: 'activate';
    feature_id: string;
    label: string;
} | {
    kind: 'halt';
    reason: HaltReason;
    message: string;
    feature_id?: string | null;
} | {
    kind: 'llm_required';
    suggestion: Suggestion;
};
/** Outcome returned by {@link executeAction}. */
export interface ExecutorResult {
    /** What we tried to do. */
    action: ExecutorAction;
    /** Whether the loop should advance to the next iteration. */
    proceed: boolean;
    /** Optional underlying work-cycle result for logs / progress. */
    work?: WorkResult;
    /** Optional halt reason when `proceed === false`. */
    halt?: {
        reason: HaltReason;
        message: string;
    };
}
/**
 * Maps one {@link Suggestion} to an {@link ExecutorAction}.
 *
 * Pure — no I/O. Used by the loop to decide which branch to take and
 * by tests to assert the BR-015 self-hotfix guard (no path returns a
 * `complete` action with a hotfix reason).
 *
 * @param suggestion - The intent-planner output.
 * @returns The executor action discriminated by `kind`.
 */
export declare function mapSuggestion(suggestion: Suggestion): ExecutorAction;
/**
 * Hooks injectable for test isolation. Default values delegate to the
 * production helpers in `src/work.ts`. Tests override these to assert
 * call sites without spawning subprocesses.
 */
export interface ExecutorHooks {
    runGate?: typeof workRunGate;
    complete?: typeof workComplete;
    activate?: typeof workActivate;
}
/**
 * Executes one {@link ExecutorAction}.
 *
 * Deterministic branches call into `src/work.ts` and return
 * `proceed: true` so the loop body advances. `halt` and `llm_required`
 * return `proceed: false` so the caller yields back to the user (or to
 * the slash-command orchestrator that handles LLM-required steps).
 *
 * **BR-015 (a) guard**: the `complete` branch never passes
 * `--hotfix-reason`. If `complete()` rejects (Iron Law violation), the
 * rejection is caught and converted into a halt — the user must
 * decide whether to issue a hotfix manually.
 *
 * @param harnessDir - Path to the project's `.harness/` directory.
 * @param action - The mapped action.
 * @param hooks - Optional injection points for testing.
 * @returns The {@link ExecutorResult} describing what happened.
 */
export declare function executeAction(harnessDir: string, action: ExecutorAction, hooks?: ExecutorHooks): ExecutorResult;
//# sourceMappingURL=executor.d.ts.map