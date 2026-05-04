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
import type { Feature, GoalRuntimeState, FeatureStatus } from '../core/state.js';
import type { GoalSpec } from './types.js';
/** Inputs needed to render one goal's progress block. */
export interface RenderInput {
    /** Goal definition from spec.yaml. */
    goalSpec: GoalSpec;
    /** Goal runtime mirror from state.yaml; `null` when never executed. */
    goalRuntime: GoalRuntimeState | null;
    /** Feature records from state.yaml.features[] for the goal's feature_ids. */
    features: Feature[];
}
/** Render options — primarily for tests that pin "now". */
export interface RenderOptions {
    /** Override clock for elapsed-time computation. */
    now?: Date;
    /** Render emojis vs ASCII fallback. Default `true` (emoji). */
    emoji?: boolean;
}
/** JSON shape returned by the `--json` mode. */
export interface RenderJsonShape {
    goal_id: string;
    title: string;
    status: string;
    percent_done: number;
    features: ReadonlyArray<{
        id: string;
        status: FeatureStatus;
        gates_passed: number;
        evidence_count: number;
        elapsed_min: number | null;
    }>;
    iteration: number;
    elapsed_min: number | null;
    last_halt_reason: string | null;
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
export declare function renderProgress(input: RenderInput, options?: RenderOptions): string;
/**
 * Returns a JSON-friendly snapshot of one goal's progress.
 *
 * Used by `drive --status --json` for machine consumption (CI
 * pipelines, dashboard scripts). Schema is stable across renderer
 * versions — adding fields is OK, renaming is breaking.
 */
export declare function renderProgressJson(input: RenderInput, options?: RenderOptions): RenderJsonShape;
//# sourceMappingURL=progressRenderer.d.ts.map