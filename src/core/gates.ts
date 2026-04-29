/**
 * Standard gate names — single source of truth (F-088 port of
 * `scripts/core/gates.py`, originally introduced in F-043).
 *
 * Both `work.ts` and `dashboard.ts` (and Python equivalents) used to
 * keep their own hardcoded gate tuples; consolidating here means
 * adding or renaming a gate is a one-line change.
 *
 * @module gates
 */

/**
 * Canonical gate ordering — lint → unit → integration → coverage →
 * clean tree → smoke. The BR-004 Iron Law completion contract
 * requires `gate_5` (smoke) to pass before a feature can transition
 * to `done`.
 */
export const STANDARD_GATES: readonly string[] = [
  'gate_0',
  'gate_1',
  'gate_2',
  'gate_3',
  'gate_4',
  'gate_5',
] as const;

/**
 * Optional performance-budget gate (v0.7.3+); not part of the BR-004
 * Iron Law chain — only triggered for features that declare a
 * `performance_budget`.
 */
export const GATE_PERF = 'gate_perf';
