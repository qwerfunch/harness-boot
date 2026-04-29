/**
 * Deterministic "next actions" recommender (F-099 port of
 * `scripts/ui/intent_planner.py`, v0.9.2).
 *
 * Pure: no I/O, no state mutation, no LLM call. Reads a `state.yaml`
 * object and an optional `spec.yaml`; returns an ordered list of
 * {@link Suggestion} for the dashboard / `/harness-boot:work`
 * router to render.
 *
 * Active-feature priority (first match wins):
 *
 *   1. `blocked` status or recent `blocker` evidence → resolve_block.
 *   2. Any gate with `last_result == 'fail'` → analyze + rerun.
 *   3. Earliest standard gate not yet pass → run that gate.
 *   4. `gate_5` pass + zero evidence → add_evidence.
 *   5. `gate_5` pass + ≥ 1 evidence → complete.
 *   6. Fallback → deactivate.
 *
 * Idle path:
 *
 *   1. Some feature `in_progress` → resume.
 *   2. Some feature `planned` → start_feature.
 *   3. spec-only unregistered → start_feature.
 *   4. Otherwise → init_feature.
 *
 * @module ui/intentPlanner
 */
/** Discrete machine-routable action identifier. */
export type Action = 'resolve_block' | 'analyze_fail' | 'run_gate' | 'add_evidence' | 'complete' | 'deactivate' | 'resume' | 'start_feature' | 'init_feature' | 'review_carry_forward';
/** One proposed next action. */
export interface Suggestion {
    label: string;
    action: Action;
    feature_id?: string | null;
    gate?: string | null;
}
/** Optional input for {@link suggest}. */
export interface SuggestOptions {
    /** F-079 coverage ratio for the active feature, when known. */
    coverage?: number | null;
}
/**
 * Returns up to three suggestions ordered by recommendation strength.
 *
 * The first item is the recommended default — Enter chooses index 1
 * in the dashboard.
 *
 * @param stateData - Parsed `state.yaml` object.
 * @param spec - Optional parsed `spec.yaml` for title lookup.
 * @param options.coverage - F-079 coverage ratio; below 0.80
 *   prepends a `review_carry_forward` suggestion.
 */
export declare function suggest(stateData: unknown, spec?: unknown, options?: SuggestOptions): Suggestion[];
//# sourceMappingURL=intentPlanner.d.ts.map