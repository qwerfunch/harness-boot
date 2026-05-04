/**
 * Drive Phase A — natural-language goal → researcher → planner →
 * feature-author scaffolding (v0.14.0 / F-119 — Stage 2).
 *
 * Phase A is the *plan* half of drive. It owns the Goal-creation
 * checkpoint state machine and the file-based handoff with the LLM
 * agents (researcher / product-planner) and the `feature-author`
 * skill. The slash command (`commands/drive.md`) is the orchestration
 * layer that actually invokes those agents — Phase A only manages the
 * state, file paths, and approval transitions.
 *
 * State machine (driven by `_workspace/drive/run.yaml.phase` +
 * `plan` sub-fields):
 *
 *   start             → checkpoint.phase = "planning"
 *                       brief_path is set, brief.md does not exist yet
 *                       halt #1 (researcher must run)
 *
 *   advance (1)       → brief.md exists → brief_approved = true
 *                       plan_path is set, plan.md does not exist yet
 *                       halt #1 (planner must run)
 *
 *   advance (2)       → plan.md exists → plan_approved = true
 *                       halt #1 (feature-author must run; user must edit
 *                       spec.yaml + state.yaml goals[] + features[])
 *
 *   advance (3)       → spec.yaml.goals[goal_id].feature_ids has at
 *                       least one entry → checkpoint.phase = "scaffolded"
 *                       returns PhaseBReady so the caller can pivot
 *                       into the execute loop.
 *
 * `--auto-approve-brief` collapses the (1) halt; `--auto-approve-all`
 * collapses (1) and (2). The (3) halt is structural — feature-author
 * has to actually write to spec.yaml — so no flag bypasses it.
 *
 * @module drive/planPhase
 */
import { type DriveCheckpoint } from './checkpoint.js';
import { type HaltEmission } from './halt.js';
/** Approval modes set by drive's CLI flags. */
export interface ApprovalFlags {
    autoApproveBrief?: boolean;
    autoApproveAll?: boolean;
}
/** Input shape of {@link startPhaseA}. */
export interface StartPhaseAInput {
    /** Path to the project's `.harness/` directory. */
    harnessDir: string;
    /** User-supplied natural-language goal text (verbatim). */
    title: string;
    /** Optional approval-flag overrides. */
    approvals?: ApprovalFlags;
    /** Override clock for tests. */
    now?: Date;
}
/** Result returned by {@link startPhaseA}. */
export interface StartPhaseAResult {
    goalId: string;
    briefPath: string;
    checkpoint: DriveCheckpoint;
    halt: HaltEmission;
}
/** Outcome variant types of {@link advancePhaseA}. */
export type PhaseAAdvanceResult = {
    kind: 'halt';
    halt: HaltEmission;
    briefPath?: string;
    planPath?: string;
} | {
    kind: 'phase_b_ready';
    goalId: string;
    featureIds: readonly string[];
};
/**
 * Returns the canonical brief path for a Goal under
 * `_workspace/drive/goals/<G-NNN>/brief.md`.
 *
 * researcher writes to this path; drive reads it on `--resume` to
 * decide whether (1) is satisfied. Stage-1's Goal-store / status
 * surface uses the same `goalArtifactDir` helper.
 */
export declare function briefPathFor(harnessDir: string, goalId: string): string;
/** Returns the canonical plan path under `_workspace/drive/goals/<G-NNN>/plan.md`. */
export declare function planPathFor(harnessDir: string, goalId: string): string;
/**
 * Begins Phase A for a new natural-language goal.
 *
 * Side effects:
 *   - allocates a fresh `G-NNN` id
 *   - creates `_workspace/drive/goals/<G-NNN>/` (lazy)
 *   - writes the initial drive checkpoint with `phase: 'planning'`
 *   - marks the goal as `active_goal_id` in state.yaml + creates a
 *     `planning`-status runtime mirror in `state.goals[]`
 *   - emits a `plan_phase_approval` halt so the slash command knows
 *     to call the researcher agent next
 *
 * Does **not** invoke researcher / planner / feature-author — those
 * are LLM agents the slash command orchestrates outside the CLI.
 *
 * @returns The new G-NNN, brief.md path, checkpoint, and halt record.
 */
export declare function startPhaseA(input: StartPhaseAInput): StartPhaseAResult;
/**
 * Advances Phase A by one transition.
 *
 * Reads the existing checkpoint and the on-disk artefacts (brief.md /
 * plan.md / spec.yaml.goals[goal_id].feature_ids), then transitions
 * the state machine to the next halt or to `phase_b_ready`. The
 * caller (CLI / slash command) decides what to do next based on the
 * returned variant.
 *
 * @param harnessDir - Project's `.harness/` directory.
 * @param approvals - User-supplied auto-approval flags.
 * @param now - Override clock for tests.
 */
export declare function advancePhaseA(harnessDir: string, approvals?: ApprovalFlags, now?: Date): PhaseAAdvanceResult;
/**
 * Reads the spec-side description of a Goal — convenience for the
 * slash-command orchestration prose, which inlines the goal title +
 * description into researcher's brief.
 */
export declare function readGoalContext(harnessDir: string, goalId: string): {
    title: string;
    description?: string;
} | null;
//# sourceMappingURL=planPhase.d.ts.map