/**
 * `/harness:work` lifecycle orchestrator (F-102 port of
 * `scripts/work.py`).
 *
 * Largest single port — wires together state mutation, gate runner,
 * drift detection, and ceremony auto-wires. Implements the four-verb
 * cycle: activate → record_gate → add_evidence → complete.
 *
 * Iron Law (BR-004) — `complete()` requires:
 *   1. `gate_5.last_result === 'pass'`
 *   2. Trailing-window declared evidence ≥ mode threshold
 *      (prototype=1, product=3; `--hotfix-reason` collapses both
 *      to 1 and records the reason as a hotfix evidence entry).
 *   3. Working tree clean (whitelist:
 *      .harness/state.yaml, .harness/_workspace/*, CHANGELOG.md).
 *   4. No blocking drift findings (Code · Stale ·
 *      AnchorIntegration · Coverage with severity='error').
 *
 * Auto-wires fired from activate / recordGate / addEvidence /
 * runAndRecordGate / complete:
 *   - kickoff (on activate)
 *   - design-review (3-condition AND on every state mutation)
 *   - retro (on complete success)
 *
 * @module work
 */
import { STANDARD_GATES } from './core/gates.js';
import { type GateResult } from './gate/runner.js';
/** Outcome of a single work-verb call. */
export interface WorkResult {
    feature_id: string;
    action: string;
    current_status: string;
    gates_passed: string[];
    gates_failed: string[];
    evidence_count: number;
    message: string;
    routed_agents: string[];
    parallel_groups: string[][];
}
/** Optional input for {@link activate}. */
export interface ActivateOptions {
    disableFog?: boolean;
}
/** Optional input for {@link recordGate}. */
export interface RecordGateOptions {
    note?: string;
}
/** Optional input for {@link block}. */
export interface BlockOptions {
    kind?: string;
}
/** Optional input for {@link complete}. */
export interface CompleteOptions {
    hotfixReason?: string | null;
}
/** Optional input for {@link archive}. */
export interface ArchiveOptions {
    supersededBy?: string | null;
    reason?: string | null;
}
/** Optional input for {@link runAndRecordGate}. */
export interface RunAndRecordGateOptions {
    projectRoot?: string;
    overrideCommand?: ReadonlyArray<string> | null;
    timeoutSec?: number;
    addEvidenceOnPass?: boolean;
}
/** Activates a feature — planned → in_progress + auto-wires. */
export declare function activate(harnessDir: string, fid: string, options?: ActivateOptions): WorkResult;
/** Records a gate result on a feature. */
export declare function recordGate(harnessDir: string, fid: string, gateName: string, result: GateResult, options?: RecordGateOptions): WorkResult;
/** Appends an evidence entry. */
export declare function addEvidence(harnessDir: string, fid: string, kind: string, summary: string): WorkResult;
/** Marks a feature as blocked + records the reason. */
export declare function block(harnessDir: string, fid: string, reason: string, options?: BlockOptions): WorkResult;
/**
 * Transitions a feature to `done`, enforcing the BR-004 Iron Law.
 *
 * Rejection paths return `action: 'queried'` with a human-readable
 * `message`. Successful completion emits a `feature_done` event and
 * fires the retro auto-wire.
 */
export declare function complete(harnessDir: string, fid: string, options?: CompleteOptions): WorkResult;
/** Transitions a done feature to archived (with optional supersedes). */
export declare function archive(harnessDir: string, fid: string, options?: ArchiveOptions): WorkResult;
/** Read-only — returns the current active feature, or null. */
export declare function current(harnessDir: string): WorkResult | null;
/** Clears `session.active_feature_id` without changing feature status. */
export declare function deactivate(harnessDir: string): WorkResult;
/** Removes a feature entry from state.yaml. Done features are protected. */
export declare function removeFeature(harnessDir: string, fid: string): WorkResult;
/**
 * Runs a gate via the gate runner, records the result, and (on
 * pass) appends an automatic evidence entry. `gate_perf` pass also
 * embeds the feature's performance_budget into the evidence summary.
 */
export declare function runAndRecordGate(harnessDir: string, fid: string, gateName: string, options?: RunAndRecordGateOptions): WorkResult;
export { STANDARD_GATES };
//# sourceMappingURL=work.d.ts.map