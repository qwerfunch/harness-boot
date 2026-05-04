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

import {
  activate as workActivate,
  complete as workComplete,
  runAndRecordGate as workRunGate,
  type WorkResult,
} from '../work.js';
import type {Suggestion} from '../ui/intentPlanner.js';
import type {HaltReason} from './types.js';

/** Discriminated union of what the executor can do with a Suggestion. */
export type ExecutorAction =
  | {kind: 'run_gate'; feature_id: string; gate: string; label: string}
  | {kind: 'complete'; feature_id: string; label: string}
  | {kind: 'activate'; feature_id: string; label: string}
  | {kind: 'halt'; reason: HaltReason; message: string; feature_id?: string | null}
  | {kind: 'llm_required'; suggestion: Suggestion};

/** Outcome returned by {@link executeAction}. */
export interface ExecutorResult {
  /** What we tried to do. */
  action: ExecutorAction;
  /** Whether the loop should advance to the next iteration. */
  proceed: boolean;
  /** Optional underlying work-cycle result for logs / progress. */
  work?: WorkResult;
  /** Optional halt reason when `proceed === false`. */
  halt?: {reason: HaltReason; message: string};
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
export function mapSuggestion(suggestion: Suggestion): ExecutorAction {
  const action = suggestion.action;
  const label = suggestion.label;

  switch (action) {
    case 'run_gate': {
      const fid = suggestion.feature_id ?? null;
      const gate = suggestion.gate ?? null;
      if (typeof fid !== 'string' || typeof gate !== 'string') {
        return {
          kind: 'halt',
          reason: 'manual',
          message: `intentPlanner returned run_gate without feature_id or gate (label: ${label})`,
        };
      }
      return {kind: 'run_gate', feature_id: fid, gate, label};
    }

    case 'complete': {
      const fid = suggestion.feature_id ?? null;
      if (typeof fid !== 'string') {
        return {
          kind: 'halt',
          reason: 'manual',
          message: `intentPlanner returned complete without feature_id (label: ${label})`,
        };
      }
      return {kind: 'complete', feature_id: fid, label};
    }

    case 'start_feature': {
      const fid = suggestion.feature_id ?? null;
      if (typeof fid !== 'string') {
        return {
          kind: 'halt',
          reason: 'manual',
          message: `intentPlanner returned start_feature without feature_id (label: ${label})`,
        };
      }
      return {kind: 'activate', feature_id: fid, label};
    }

    // BR-015 (a) — drive cannot manufacture declared evidence on the
    // user's behalf. add_evidence is a *signal* from the planner that
    // the Iron Law floor isn't met yet; the loop must yield.
    case 'add_evidence':
      return {
        kind: 'halt',
        reason: 'manual',
        message:
          'declared evidence required (BR-015 — drive does not self-issue evidence). ' +
          'add an evidence row with `harness work F-N --evidence "..."` then resume.',
        feature_id: suggestion.feature_id ?? null,
      };

    // Coverage carry-forward — surface a human review halt.
    case 'review_carry_forward':
      return {
        kind: 'halt',
        reason: 'manual',
        message: 'coverage threshold not met — review and acknowledge before continuing.',
        feature_id: suggestion.feature_id ?? null,
      };

    // Block resolution and failure analysis are LLM-or-human territory.
    case 'analyze_fail':
    case 'resolve_block':
      return {kind: 'llm_required', suggestion};

    // Spec changes (init_feature) live in Phase A, not Phase B.
    case 'init_feature':
      return {
        kind: 'halt',
        reason: 'manual',
        message:
          'spec.yaml change required — return to Phase A (drive --plan-only) ' +
          'or use feature-author to register the new feature.',
      };

    // No-op signals from the planner.
    case 'resume':
    case 'deactivate':
      return {
        kind: 'halt',
        reason: 'manual',
        message: `planner suggested ${action}; drive yields to the user.`,
      };

    default:
      return {
        kind: 'halt',
        reason: 'manual',
        message: `unknown planner action: ${String(action)}`,
      };
  }
}

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
export function executeAction(
  harnessDir: string,
  action: ExecutorAction,
  hooks: ExecutorHooks = {},
): ExecutorResult {
  const runGateImpl = hooks.runGate ?? workRunGate;
  const completeImpl = hooks.complete ?? workComplete;
  const activateImpl = hooks.activate ?? workActivate;

  switch (action.kind) {
    case 'run_gate': {
      const work = runGateImpl(harnessDir, action.feature_id, action.gate);
      const failed = Array.isArray(work.gates_failed) && work.gates_failed.includes(action.gate);
      if (failed) {
        return {
          action,
          proceed: true, // surface the fail to the loop, retry-counter increments
          work,
        };
      }
      return {action, proceed: true, work};
    }

    case 'complete': {
      // BR-015 (a) — never pass hotfixReason from drive.
      const work = completeImpl(harnessDir, action.feature_id, {hotfixReason: null});
      if (work.action === 'completed') {
        return {action, proceed: true, work};
      }
      // Iron Law not yet satisfied — yield as a halt (the user inspects
      // the message and either adds evidence or issues a hotfix).
      return {
        action,
        proceed: false,
        work,
        halt: {
          reason: 'manual',
          message:
            work.message ||
            'Iron Law not satisfied — drive cannot self-issue --hotfix-reason (BR-015).',
        },
      };
    }

    case 'activate': {
      const work = activateImpl(harnessDir, action.feature_id);
      return {action, proceed: true, work};
    }

    case 'halt':
      return {
        action,
        proceed: false,
        halt: {reason: action.reason, message: action.message},
      };

    case 'llm_required':
      return {
        action,
        proceed: false,
        halt: {
          reason: 'manual',
          message: `${action.suggestion.action} requires user/LLM judgment — yielding (label: ${action.suggestion.label}).`,
        },
      };

    default: {
      // Exhaustiveness check — TS will flag any new union member.
      const _exhaustive: never = action;
      void _exhaustive;
      return {
        action: {kind: 'halt', reason: 'manual', message: 'unreachable executor branch'},
        proceed: false,
      };
    }
  }
}
