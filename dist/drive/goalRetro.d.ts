/**
 * Drive Phase C — Goal-level retrospective generator (v0.14.0 / F-119
 * — Stage 2).
 *
 * Fired once when the last feature in a Goal transitions to `done`.
 * Produces `_workspace/drive/goals/<G-NNN>/retro.md` with three
 * machine-filled sections (Goal summary · Feature breakdown · Halt
 * log) and two LLM-filled section stubs (Reviewer Reflection · Copy
 * Polish), mirroring the per-feature retro convention from
 * `src/ceremonies/retro.ts`.
 *
 * Idempotent — if `retro.md` already exists, the call is a no-op
 * (returns the path with `created: false`). Force regeneration is
 * not yet wired at the CLI layer; if needed, the caller can pass
 * `force: true`.
 *
 * Records a `goal_retro_written` event on `events.log` so metrics +
 * cross-goal learning have a per-goal anchor.
 *
 * @module drive/goalRetro
 */
/** Returns the canonical retro path for a Goal. */
export declare function goalRetroPath(harnessDir: string, goalId: string): string;
/** Options for {@link generateGoalRetro}. */
export interface GenerateGoalRetroOptions {
    /** When `true`, overwrites an existing retro.md. */
    force?: boolean;
    /** Override clock for tests. */
    now?: Date;
}
/** Result of {@link generateGoalRetro}. */
export interface GenerateGoalRetroResult {
    path: string;
    /** `true` when this call wrote (or rewrote) the file. */
    created: boolean;
    /** Number of features in the Goal aggregated into the retro. */
    feature_count: number;
    /** Number of halt entries summarised from progress.log. */
    halt_count: number;
}
/**
 * Generates `_workspace/drive/goals/<G-NNN>/retro.md` for the
 * supplied Goal.
 *
 * Idempotent — if the file already exists and `force` is `false`, the
 * call returns the existing path with `created: false`. The
 * `goal_retro_written` event is only appended on a fresh write.
 *
 * @returns A {@link GenerateGoalRetroResult} describing the outcome.
 */
export declare function generateGoalRetro(harnessDir: string, goalId: string, options?: GenerateGoalRetroOptions): GenerateGoalRetroResult;
//# sourceMappingURL=goalRetro.d.ts.map