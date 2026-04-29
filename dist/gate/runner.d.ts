/**
 * Gate auto-detection + subprocess execution (F-095 port of
 * `scripts/gate/runner.py`).
 *
 * The dispatcher decides what command to run for each of the six
 * standard gates plus the optional `gate_perf`, then spawns it under
 * a timeout and packages the result. work.ts depends on this for
 * `runGate(name, projectRoot, options)` invocations.
 *
 * Override resolution priority — same as Python:
 *
 *   1. `--override-command` (caller-supplied)
 *   2. `harness.yaml.gate_commands.<gate>` (per-project pin)
 *   3. Auto-detect (this module's `detectGate*Command` helpers)
 *
 * @module gate/runner
 */
/** Permitted gate result values. */
export type GateResult = 'pass' | 'fail' | 'skipped';
/** Outcome of a gate run, including subprocess metadata for diagnostics. */
export interface GateRunResult {
    gate: string;
    result: GateResult;
    reason: string;
    command: string[];
    exitCode: number | null;
    stdoutTail: string;
    stderrTail: string;
    durationSec: number;
}
/** Optional input shared by every `runGate*` entry point. */
export interface RunGateOptions {
    overrideCommand?: ReadonlyArray<string> | null;
    harnessDir?: string | null;
    timeoutSec?: number;
}
/** Auto-detection for gate_0 (tests). */
export declare function detectGate0Command(projectRoot: string): string[] | null;
/** Auto-detection for gate_1 (type check). */
export declare function detectGate1Command(projectRoot: string): string[] | null;
/** Auto-detection for gate_2 (lint). */
export declare function detectGate2Command(projectRoot: string): string[] | null;
/** Auto-detection for gate_3 (coverage). */
export declare function detectGate3Command(projectRoot: string): string[] | null;
/** Auto-detection for gate_4 (commit / clean tree). */
export declare function detectGate4Command(projectRoot: string): string[] | null;
/** Auto-detection for gate_5 (runtime smoke). */
export declare function detectGate5Command(projectRoot: string): string[] | null;
/** No auto-detect for gate_perf — performance tooling varies too widely. */
export declare function detectGatePerfCommand(_projectRoot: string): string[] | null;
/** gate_0 (tests). */
export declare function runGate0(projectRoot: string, options?: RunGateOptions): GateRunResult;
/** gate_1 (type check). */
export declare function runGate1(projectRoot: string, options?: RunGateOptions): GateRunResult;
/** gate_2 (lint). */
export declare function runGate2(projectRoot: string, options?: RunGateOptions): GateRunResult;
/** gate_3 (coverage). */
export declare function runGate3(projectRoot: string, options?: RunGateOptions): GateRunResult;
/** gate_4 (working tree clean). */
export declare function runGate4(projectRoot: string, options?: RunGateOptions): GateRunResult;
/** gate_5 (runtime smoke). */
export declare function runGate5(projectRoot: string, options?: RunGateOptions): GateRunResult;
/** gate_perf (performance budget). */
export declare function runGatePerf(projectRoot: string, options?: RunGateOptions): GateRunResult;
/** Dispatcher — maps a gate name to its runner. */
export declare function runGate(gate: string, projectRoot: string, options?: RunGateOptions): GateRunResult;
//# sourceMappingURL=runner.d.ts.map