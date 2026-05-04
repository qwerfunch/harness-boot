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

import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {State} from '../core/state.js';
import {
  createGoal,
  nextGoalId,
  readGoals,
} from './goalStore.js';
import {
  defaultCheckpoint,
  goalArtifactDir,
  loadCheckpoint,
  saveCheckpoint,
  type DriveCheckpoint,
} from './checkpoint.js';
import {emitHalt, type HaltEmission} from './halt.js';
import type {GoalSpec} from './types.js';

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
export type PhaseAAdvanceResult =
  | {kind: 'halt'; halt: HaltEmission; briefPath?: string; planPath?: string}
  | {kind: 'phase_b_ready'; goalId: string; featureIds: readonly string[]};

/**
 * Returns the canonical brief path for a Goal under
 * `_workspace/drive/goals/<G-NNN>/brief.md`.
 *
 * researcher writes to this path; drive reads it on `--resume` to
 * decide whether (1) is satisfied. Stage-1's Goal-store / status
 * surface uses the same `goalArtifactDir` helper.
 */
export function briefPathFor(harnessDir: string, goalId: string): string {
  return join(goalArtifactDir(harnessDir, goalId), 'brief.md');
}

/** Returns the canonical plan path under `_workspace/drive/goals/<G-NNN>/plan.md`. */
export function planPathFor(harnessDir: string, goalId: string): string {
  return join(goalArtifactDir(harnessDir, goalId), 'plan.md');
}

/**
 * Reads spec.yaml and returns the Goal definition for `goalId`.
 *
 * Returns `null` when the Goal isn't registered yet (Phase A's third
 * advance creates it via feature-author).
 */
function readGoalFromSpec(harnessDir: string, goalId: string): GoalSpec | null {
  const specPath = join(harnessDir, 'spec.yaml');
  if (!existsSync(specPath)) {
    return null;
  }
  const goals = readGoals(specPath);
  return goals.find((g) => g.id === goalId) ?? null;
}

/**
 * Allocates the next G-NNN id by union of spec + state goals.
 *
 * Phase A starts before feature-author has written to spec.yaml, so
 * the ids in `state.goals[]` (drive's runtime mirror) are the
 * authoritative source for already-allocated values. `goals(spec)` is
 * checked too for safety.
 */
function allocateGoalId(harnessDir: string): string {
  const specPath = join(harnessDir, 'spec.yaml');
  const specIds = existsSync(specPath) ? readGoals(specPath).map((g) => g.id) : [];
  const state = State.load(harnessDir);
  const stateIds = state.goals().map((g) => g.id);
  const union = Array.from(new Set([...specIds, ...stateIds]));
  return nextGoalId(union);
}

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
export function startPhaseA(input: StartPhaseAInput): StartPhaseAResult {
  const {harnessDir, title, now} = input;
  if (!title || title.trim().length === 0) {
    throw new Error('drive plan: goal title is required');
  }

  const goalId = allocateGoalId(harnessDir);

  // Seed the runtime Goal mirror in state.yaml. spec.yaml.goals[]
  // entry is added by feature-author later (Phase A advance step 3).
  const state = State.load(harnessDir);
  state.ensureGoal(goalId);
  state.setGoalStatus(goalId, 'planning');
  state.setActiveGoal(goalId);
  state.save();

  // Compose and persist the goal-spec pure record so Phase A can
  // reference the title even before feature-author has written to
  // spec.yaml. The pure form is also handed to the slash command so
  // researcher gets a stable Goal id + slug to work against.
  const goalSpec = createGoal({title, now}, [goalId]);
  // (override the auto-allocated id with the one we just chose above)
  goalSpec.id = goalId;

  // Build the initial checkpoint.
  const ck = defaultCheckpoint(goalId, now);
  ck.plan.brief_path = briefPathFor(harnessDir, goalId);
  ck.plan.plan_path = planPathFor(harnessDir, goalId);
  saveCheckpoint(harnessDir, ck, now);

  // Lay out the goal's artefact directory eagerly so researcher's
  // file-write doesn't race with mkdir.
  mkdirSync(goalArtifactDir(harnessDir, goalId), {recursive: true});

  const halt = emitHalt(
    harnessDir,
    'plan_phase_approval',
    `researcher must compose ${ck.plan.brief_path} for goal "${goalSpec.title}". ` +
      'After approval, run `harness drive --resume`.',
    {goal_id: goalId, now},
  );

  return {goalId, briefPath: ck.plan.brief_path, checkpoint: ck, halt};
}

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
export function advancePhaseA(
  harnessDir: string,
  approvals: ApprovalFlags = {},
  now: Date = new Date(),
): PhaseAAdvanceResult {
  const ck = loadCheckpoint(harnessDir);
  if (ck === null) {
    return {
      kind: 'halt',
      halt: emitHalt(
        harnessDir,
        'manual',
        'no drive checkpoint found — run `harness drive "<goal>"` first.',
        {now},
      ),
    };
  }
  if (ck.phase !== 'planning') {
    return {
      kind: 'halt',
      halt: emitHalt(
        harnessDir,
        'manual',
        `phase ${ck.phase} is past Phase A — use --resume for the execute loop.`,
        {goal_id: ck.goal_id, now},
      ),
    };
  }

  // Step (1) — brief.md must exist.
  if (!existsSync(ck.plan.brief_path)) {
    return {
      kind: 'halt',
      briefPath: ck.plan.brief_path,
      halt: emitHalt(
        harnessDir,
        'plan_phase_approval',
        `researcher's brief is missing at ${ck.plan.brief_path}. Have the researcher agent write it, then resume.`,
        {goal_id: ck.goal_id, now},
      ),
    };
  }

  // Step (1) → approve brief, request planner.
  if (!ck.plan.brief_approved) {
    if (!approvals.autoApproveBrief && !approvals.autoApproveAll) {
      // First time we see brief.md exists — record approval-pending
      // and surface a halt so the user can review explicitly.
      ck.plan.brief_approved = true; // implicit — file existence == author chose to commit it
      saveCheckpoint(harnessDir, ck, now);
      return {
        kind: 'halt',
        briefPath: ck.plan.brief_path,
        halt: emitHalt(
          harnessDir,
          'plan_phase_approval',
          `brief.md is present at ${ck.plan.brief_path}. Review, then resume to dispatch product-planner.`,
          {goal_id: ck.goal_id, now},
        ),
      };
    }
    ck.plan.brief_approved = true;
    saveCheckpoint(harnessDir, ck, now);
  }

  // Step (2) — plan.md must exist.
  if (!existsSync(ck.plan.plan_path)) {
    return {
      kind: 'halt',
      briefPath: ck.plan.brief_path,
      planPath: ck.plan.plan_path,
      halt: emitHalt(
        harnessDir,
        'plan_phase_approval',
        `product-planner's plan is missing at ${ck.plan.plan_path}. Have the planner agent write it, then resume.`,
        {goal_id: ck.goal_id, now},
      ),
    };
  }

  // Step (2) → approve plan, request feature-author.
  if (!ck.plan.plan_approved) {
    if (!approvals.autoApproveAll) {
      ck.plan.plan_approved = true;
      saveCheckpoint(harnessDir, ck, now);
      return {
        kind: 'halt',
        briefPath: ck.plan.brief_path,
        planPath: ck.plan.plan_path,
        halt: emitHalt(
          harnessDir,
          'plan_phase_approval',
          `plan.md is present at ${ck.plan.plan_path}. Review, then resume to dispatch feature-author for the scaffolding.`,
          {goal_id: ck.goal_id, now},
        ),
      };
    }
    ck.plan.plan_approved = true;
    saveCheckpoint(harnessDir, ck, now);
  }

  // Step (3) — feature-author must have written features into spec.yaml,
  // and goals[<goal_id>].feature_ids must list them.
  const goal = readGoalFromSpec(harnessDir, ck.goal_id);
  const scaffolded = goal !== null ? [...goal.feature_ids] : [];
  if (scaffolded.length === 0) {
    return {
      kind: 'halt',
      briefPath: ck.plan.brief_path,
      planPath: ck.plan.plan_path,
      halt: emitHalt(
        harnessDir,
        'plan_phase_approval',
        `feature-author has not scaffolded any features for ${ck.goal_id} yet. ` +
          'Author the features into both spec.yaml mirrors with feature-author, then resume.',
        {goal_id: ck.goal_id, now},
      ),
    };
  }

  // Phase B is ready — promote checkpoint and mirror state.
  ck.plan.scaffolded_features = scaffolded;
  ck.phase = 'scaffolded';
  saveCheckpoint(harnessDir, ck, now);

  const state = State.load(harnessDir);
  state.setGoalStatus(ck.goal_id, 'scaffolded');
  for (const fid of scaffolded) {
    state.setGoalFeatureProgress(ck.goal_id, fid, 'planned');
  }
  state.save();

  return {kind: 'phase_b_ready', goalId: ck.goal_id, featureIds: scaffolded};
}

/**
 * Reads the spec-side description of a Goal — convenience for the
 * slash-command orchestration prose, which inlines the goal title +
 * description into researcher's brief.
 */
export function readGoalContext(harnessDir: string, goalId: string): {title: string; description?: string} | null {
  const goal = readGoalFromSpec(harnessDir, goalId);
  if (goal !== null) {
    const out: {title: string; description?: string} = {title: goal.title};
    if (typeof goal.description === 'string' && goal.description.length > 0) {
      out.description = goal.description;
    }
    return out;
  }
  // Fall back to brief.md's first heading line.
  const ck = loadCheckpoint(harnessDir);
  if (ck === null || ck.goal_id !== goalId) {
    return null;
  }
  if (existsSync(ck.plan.brief_path)) {
    const text = readFileSync(ck.plan.brief_path, 'utf-8');
    const heading = /^#\s+(.+)$/m.exec(text);
    if (heading !== null) {
      return {title: heading[1] ?? goalId};
    }
  }
  return null;
}
