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
/** Result of one replan evaluation. */
export interface ReplanResult {
    /** True when the hook actually ran (false when opt-out / no-active-goal / idempotent skip). */
    evaluated: boolean;
    /** Feature ids that were deferred (status=blocked or superseded). */
    deltas: {
        deferred: string[];
        reordered: string[];
    };
    /** Path of the file-drop manifest (absolute), or `null` when no LLM-worthy condition. */
    manifest_path: string | null;
    /** When `evaluated === false`, why. */
    skip_reason?: 'opt_out' | 'already_evaluated' | 'no_goal' | 'no_active' | 'no_state';
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
export declare function replanAfterCompletion(harnessDir: string, completedFid: string, goalId: string | null): ReplanResult;
//# sourceMappingURL=replan.d.ts.map