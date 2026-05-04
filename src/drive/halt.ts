/**
 * Drive halt taxonomy + emitter (v0.14.0 / F-119 — Stage 2).
 *
 * BR-015 (a..g) makes halts a first-class concept: drive **escalates,
 * never bypasses**. The 9 enumerated reasons cover every case where
 * the loop must yield control back to the user (or to a slash-command
 * orchestrator that runs LLM-required steps).
 *
 * Every halt produces three artefacts:
 *   1. `last_halt` field on `_workspace/drive/run.yaml` — drives
 *      `--resume` recovery.
 *   2. One line in `_workspace/drive/progress.log` — append-only
 *      audit trail.
 *   3. One `drive_halted` row on `events.log` — feeds metrics + retro.
 *
 * @module drive/halt
 */

import {appendFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {appendProgress, loadCheckpoint, saveCheckpoint} from './checkpoint.js';
import type {HaltReason} from './types.js';

/** Type guard — narrows an unknown value to a plain object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Returns the current UTC timestamp formatted as `YYYY-MM-DDTHH:MM:SSZ`. */
function nowIso(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear().toString().padStart(4, '0');
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = now.getUTCDate().toString().padStart(2, '0');
  const hh = now.getUTCHours().toString().padStart(2, '0');
  const mi = now.getUTCMinutes().toString().padStart(2, '0');
  const ss = now.getUTCSeconds().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}

/** Bag of optional fields that can ride along with a halt event. */
export interface HaltContext {
  /** Goal id the halt applies to (defaults to checkpoint.goal_id). */
  goal_id?: string;
  /** Feature id, when relevant (commit boundary, retry threshold, etc.). */
  feature_id?: string | null;
  /** Gate name, when relevant (retry threshold). */
  gate?: string | null;
  /** Drift findings, when reason is drift_severity_error. */
  findings?: ReadonlyArray<Record<string, unknown>>;
  /** Iteration counter snapshot. */
  iteration?: number;
  /** Override clock for tests. */
  now?: Date;
  /** Pass-through extras. */
  [key: string]: unknown;
}

/**
 * Maps each {@link HaltReason} to its #N tag and one-line description.
 *
 * The numeric tags match the Test plan + spec.yaml AC-3 of F-119, so
 * "halt #4" is unambiguously identifiable across log + retro + tests.
 */
export const HALT_REASON_INDEX: Readonly<Record<HaltReason, {n: number; tag: string}>> = {
  plan_phase_approval: {n: 1, tag: 'plan-phase approval'},
  commit_boundary: {n: 2, tag: 'gate_4 commit boundary'},
  retry_threshold: {n: 3, tag: 'gate retry threshold'},
  drift_severity_error: {n: 4, tag: 'severity=error drift'},
  feature_blocked: {n: 5, tag: 'feature blocked'},
  wall_clock: {n: 6, tag: 'wall-clock cap'},
  iteration_cap: {n: 7, tag: 'iteration cap'},
  network_failure: {n: 8, tag: 'network failure'},
  stop_file: {n: 9, tag: 'STOP file'},
  gate_no_progress: {n: 10, tag: 'gate no progress'},
  manual: {n: 0, tag: 'manual'},
};

/** Result of an `emitHalt()` call, returned to the caller for logging. */
export interface HaltEmission {
  reason: HaltReason;
  message: string;
  ts: string;
  /** Tag and #N for prose rendering. */
  index: {n: number; tag: string};
}

/**
 * Reads `events.log` directly via `appendFileSync` — drive cannot
 * import `appendEvent` from `src/work.ts` because it is module-private
 * there. We mirror the small wrapper here to avoid coupling.
 */
function appendEvent(harnessDir: string, event: Record<string, unknown>): void {
  const logPath = join(harnessDir, 'events.log');
  mkdirSync(dirname(logPath), {recursive: true});
  // Python-style JSON: separators (',', ': '), unicode-safe.
  const json = JSON.stringify(event);
  appendFileSync(logPath, `${json}\n`, 'utf-8');
}

/**
 * Records a halt across all three artefacts (checkpoint + progress.log
 * + events.log).
 *
 * The checkpoint is loaded, mutated, and saved in one shot. When no
 * checkpoint exists yet (e.g. a halt fires during very early Phase A
 * setup) only progress.log + events.log are written — the checkpoint
 * write is skipped silently.
 *
 * @param harnessDir - Path to the project's `.harness/` directory.
 * @param reason - The {@link HaltReason} enum value.
 * @param message - Human-readable explanation (one line preferred).
 * @param context - Optional structured fields (feature, gate, findings,
 *   iteration count). Pass-through extras are written to events.log.
 * @returns The emission record describing what was logged.
 */
export function emitHalt(
  harnessDir: string,
  reason: HaltReason,
  message: string,
  context: HaltContext = {},
): HaltEmission {
  const ts = nowIso(context.now);
  const index = HALT_REASON_INDEX[reason];

  // 1. checkpoint update
  const ck = loadCheckpoint(harnessDir);
  if (ck !== null) {
    ck.last_halt = {reason, message, ts};
    if (typeof context.iteration === 'number') {
      ck.execute.iteration = context.iteration;
    }
    if (typeof context.feature_id === 'string') {
      ck.execute.active_feature = context.feature_id;
    }
    saveCheckpoint(harnessDir, ck, context.now);
  }

  // 2. progress.log line
  const featureSegment = typeof context.feature_id === 'string' ? ` · ${context.feature_id}` : '';
  const gateSegment = typeof context.gate === 'string' ? ` · ${context.gate}` : '';
  appendProgress(
    harnessDir,
    `${ts} HALT #${index.n} ${index.tag}${featureSegment}${gateSegment}: ${message}`,
  );

  // 3. events.log
  const event: Record<string, unknown> = {
    ts,
    type: 'drive_halted',
    reason,
    halt_n: index.n,
    halt_tag: index.tag,
    message,
  };
  if (ck !== null) {
    event.goal_id = ck.goal_id;
  } else if (typeof context.goal_id === 'string') {
    event.goal_id = context.goal_id;
  }
  if (typeof context.feature_id === 'string') {
    event.feature_id = context.feature_id;
  }
  if (typeof context.gate === 'string') {
    event.gate = context.gate;
  }
  if (Array.isArray(context.findings)) {
    event.findings_count = context.findings.length;
  }
  if (typeof context.iteration === 'number') {
    event.iteration = context.iteration;
  }
  // Pass-through extras (sanitised — only plain values).
  for (const [key, value] of Object.entries(context)) {
    if (key in event || key === 'now' || key === 'findings') {
      continue;
    }
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      event[key] = value;
    } else if (isPlainObject(value) || Array.isArray(value)) {
      try {
        event[key] = JSON.parse(JSON.stringify(value));
      } catch {
        // Skip unrenderable extras silently.
      }
    }
  }
  appendEvent(harnessDir, event);

  return {reason, message, ts, index};
}

/**
 * Renders a one-paragraph user-facing message for a halt.
 *
 * The text is meant for the slash command's stdout — explicit about
 * what happened, what the user must do, and how to resume. Keeps the
 * BR-015 "escalate, never bypass" tone audible.
 */
export function renderHaltMessage(emission: HaltEmission): string {
  const {reason, message, index} = emission;
  const lead = `HALT #${index.n} (${index.tag}) — ${message}`;
  const next = nextStepFor(reason);
  return `${lead}\n${next}`;
}

/** Returns a one-line "what to do next" hint for a given halt reason. */
function nextStepFor(reason: HaltReason): string {
  switch (reason) {
    case 'plan_phase_approval':
      return 'review the brief / plan, then `harness drive --resume`.';
    case 'commit_boundary':
      return 'review changes, `git commit`, then `harness drive --resume`.';
    case 'retry_threshold':
      return 'inspect failing gate, fix the underlying problem, then `harness drive --resume`.';
    case 'drift_severity_error':
      return 'resolve the drift (or `--hotfix-reason` once justified), then `harness drive --resume`.';
    case 'feature_blocked':
      return 'unblock the feature with `harness work F-N --evidence`, then `harness drive --resume`.';
    case 'wall_clock':
    case 'iteration_cap':
      return 'review progress; raise --max-hours / --max-iterations if appropriate, then `harness drive --resume`.';
    case 'network_failure':
      return 'restore network connectivity, then `harness drive --resume`.';
    case 'stop_file':
      return 'remove `_workspace/drive/STOP`, then `harness drive --resume`.';
    case 'gate_no_progress':
      return 'set `harness.yaml.gate_commands.<gate>` (or fix project detection), then `harness drive --resume`.';
    case 'manual':
      return 'use `harness drive --resume` when ready.';
    default:
      return 'use `harness drive --resume` when ready.';
  }
}
