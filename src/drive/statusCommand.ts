/**
 * statusCommand — handler for `harness drive --status` (v0.14.0 /
 * F-118 — Stage 1).
 *
 * Read-only — never writes to state.yaml, events.log, or spec.yaml.
 * The CQS contract (BR-012) is enforced by tests verifying the file
 * mtimes are unchanged after a `--status` invocation.
 *
 * Stage 2 (F-119) will add `--resume` and free-text-goal forms; this
 * stage's `runDriveStatus` ignores them with a clear "not yet wired"
 * message so users know to upgrade.
 *
 * @module drive/statusCommand
 */

import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {parse as yamlParse} from 'yaml';
import {State, type Feature, type GoalRuntimeState} from '../core/state.js';
import {readGoals} from './goalStore.js';
import {renderProgress, renderProgressJson, type RenderJsonShape} from './progressRenderer.js';
import type {GoalSpec} from './types.js';

/** Options accepted by {@link runDriveStatus}. */
export interface DriveStatusOptions {
  /** Path to the project's `.harness/` directory. */
  harnessDir: string;
  /** Optional explicit goal id. Defaults to `session.active_goal_id`. */
  goalId?: string | null;
  /** Render every goal in the spec. Overrides `goalId`. */
  all?: boolean;
  /** Emit JSON instead of formatted text. */
  json?: boolean;
  /**
   * Re-render every `intervalSec` seconds until the process exits.
   * Stage 1 ships a simple loop; stage 2 swaps it for a watchful
   * fs-event driver.
   */
  watch?: boolean;
  /** Watch interval (seconds). Defaults to 2. */
  intervalSec?: number;
  /** Test seam — override stdout writer. */
  out?: (chunk: string) => void;
}

/** Type guard — narrows an unknown value to a plain object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Reads `<harnessDir>/spec.yaml` and returns its `features[]`.
 *
 * Stage 1 does not depend on `loadSpec` from `src/spec/validate.ts`
 * because that helper performs schema validation (we don't want to
 * fail status when a user temporarily edits spec.yaml). Plain
 * `yamlParse` keeps `--status` resilient.
 *
 * Returns an empty array when the file is absent or malformed.
 */
function readSpecFeatures(harnessDir: string): Array<Record<string, unknown>> {
  const path = join(harnessDir, 'spec.yaml');
  if (!existsSync(path)) {
    return [];
  }
  const raw = readFileSync(path, 'utf-8');
  const doc: unknown = yamlParse(raw);
  if (!isPlainObject(doc)) {
    return [];
  }
  if (!Array.isArray(doc.features)) {
    return [];
  }
  return doc.features.filter(isPlainObject) as Array<Record<string, unknown>>;
}

/**
 * Joins a runtime feature record with its spec-level `name`.
 *
 * The renderer wants `feature.name` for display, but `state.yaml`
 * only carries the runtime fields (status, gates, evidence). This
 * helper copies `name` from `spec.yaml.features[]` onto each runtime
 * record without mutating the original.
 */
function enrichFeatures(
  runtimeFeatures: readonly Feature[],
  specFeatures: ReadonlyArray<Record<string, unknown>>,
): Feature[] {
  const nameById = new Map<string, string>();
  for (const f of specFeatures) {
    if (typeof f.id === 'string' && typeof f.name === 'string') {
      nameById.set(f.id, f.name);
    }
  }
  return runtimeFeatures.map((f) => {
    const name = nameById.get(f.id);
    return name === undefined ? f : ({...f, name} as Feature);
  });
}

/**
 * Resolves the runtime feature records that compose a goal.
 *
 * Falls back to a `planned` placeholder for any feature_id that the
 * goal references but has not yet been activated (drive's plan
 * phase scaffolds spec entries before any work cycle starts, so
 * the runtime view is empty until activate).
 */
function resolveGoalFeatures(
  state: State,
  goalSpec: GoalSpec,
  specFeatures: ReadonlyArray<Record<string, unknown>>,
): Feature[] {
  const runtimeById = new Map<string, Feature>();
  for (const f of state.data.features ?? []) {
    if (isPlainObject(f) && typeof f.id === 'string') {
      runtimeById.set(f.id, f as Feature);
    }
  }
  const out: Feature[] = [];
  for (const fid of goalSpec.feature_ids) {
    const existing = runtimeById.get(fid);
    if (existing !== undefined) {
      out.push(existing);
      continue;
    }
    out.push({
      id: fid,
      status: 'planned',
      gates: {},
      evidence: [],
      started_at: null,
      completed_at: null,
    });
  }
  return enrichFeatures(out, specFeatures);
}

/**
 * Selects which goal(s) to render.
 *
 * Priority: `--all` (every goal in spec) > explicit `goalId` >
 * `state.session.active_goal_id` > the most recently created goal
 * (last in spec.yaml goals[]) > none.
 */
function selectGoals(
  goals: readonly GoalSpec[],
  state: State,
  options: DriveStatusOptions,
): GoalSpec[] {
  if (options.all === true) {
    return [...goals];
  }
  if (typeof options.goalId === 'string' && options.goalId.length > 0) {
    const found = goals.find((g) => g.id === options.goalId);
    return found === undefined ? [] : [found];
  }
  const active = state.activeGoalId();
  if (active !== null) {
    const found = goals.find((g) => g.id === active);
    if (found !== undefined) {
      return [found];
    }
  }
  if (goals.length > 0) {
    return [goals[goals.length - 1]!];
  }
  return [];
}

/**
 * Composes the full text output for one render pass.
 *
 * @internal — exported for unit tests; CLI code should use
 *   {@link runDriveStatus}.
 */
export function composeStatusText(
  goals: readonly GoalSpec[],
  state: State,
  specFeatures: ReadonlyArray<Record<string, unknown>>,
  options: DriveStatusOptions,
): string {
  const selected = selectGoals(goals, state, options);
  if (selected.length === 0) {
    return 'no goals registered yet — drive --plan or /harness-boot:drive "<goal>" (stage 2 / F-119)';
  }
  const blocks: string[] = [];
  for (const goalSpec of selected) {
    const goalRuntime: GoalRuntimeState | null = state.getGoal(goalSpec.id);
    const features = resolveGoalFeatures(state, goalSpec, specFeatures);
    blocks.push(renderProgress({goalSpec, goalRuntime, features}));
  }
  return blocks.join('\n\n');
}

/**
 * Composes the JSON output for one render pass.
 *
 * @internal — exported for unit tests.
 */
export function composeStatusJson(
  goals: readonly GoalSpec[],
  state: State,
  specFeatures: ReadonlyArray<Record<string, unknown>>,
  options: DriveStatusOptions,
): {goals: RenderJsonShape[]} {
  const selected = selectGoals(goals, state, options);
  const out: RenderJsonShape[] = [];
  for (const goalSpec of selected) {
    const goalRuntime: GoalRuntimeState | null = state.getGoal(goalSpec.id);
    const features = resolveGoalFeatures(state, goalSpec, specFeatures);
    out.push(renderProgressJson({goalSpec, goalRuntime, features}));
  }
  return {goals: out};
}

/** Sleep helper for the `--watch` loop. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Entry point for `harness drive --status`.
 *
 * Read-only — only loads `spec.yaml`, `state.yaml` (and any
 * referenced `events.log` lines for status counts in stage 2).
 * Mtimes on every read file are preserved by virtue of using
 * `readFileSync` only.
 *
 * @param options - Resolved CLI options.
 * @returns The exit code (0 on success, non-zero on hard failure).
 */
export async function runDriveStatus(options: DriveStatusOptions): Promise<number> {
  const out = options.out ?? ((s: string) => process.stdout.write(s));
  const harnessDir = options.harnessDir;

  if (!existsSync(harnessDir)) {
    out(`drive --status: harness dir not found: ${harnessDir}\n`);
    return 2;
  }

  const intervalSec = options.intervalSec ?? 2;
  const watch = options.watch ?? false;

  const renderOnce = (): void => {
    const specPath = join(harnessDir, 'spec.yaml');
    const goals = existsSync(specPath) ? readGoals(specPath) : [];
    const specFeatures = readSpecFeatures(harnessDir);
    const state = State.load(harnessDir);
    if (options.json === true) {
      const payload = composeStatusJson(goals, state, specFeatures, options);
      out(JSON.stringify(payload, null, 2) + '\n');
    } else {
      const text = composeStatusText(goals, state, specFeatures, options);
      out(text + '\n');
    }
  };

  if (!watch) {
    renderOnce();
    return 0;
  }

  // watch loop — render, then sleep, then re-render. Ctrl-C exits.
  // Stage 2 may swap this for an fs-event-driven invalidation.
  while (true) {
    if (options.json !== true) {
      // Clear screen on each re-render in text mode for readability.
      out('\x1b[2J\x1b[H');
    }
    renderOnce();
    await sleep(intervalSec * 1000);
  }
}
