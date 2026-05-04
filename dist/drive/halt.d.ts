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
import type { HaltReason } from './types.js';
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
export declare const HALT_REASON_INDEX: Readonly<Record<HaltReason, {
    n: number;
    tag: string;
}>>;
/** Result of an `emitHalt()` call, returned to the caller for logging. */
export interface HaltEmission {
    reason: HaltReason;
    message: string;
    ts: string;
    /** Tag and #N for prose rendering. */
    index: {
        n: number;
        tag: string;
    };
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
export declare function emitHalt(harnessDir: string, reason: HaltReason, message: string, context?: HaltContext): HaltEmission;
/**
 * Renders a one-paragraph user-facing message for a halt.
 *
 * The text is meant for the slash command's stdout — explicit about
 * what happened, what the user must do, and how to resume. Keeps the
 * BR-015 "escalate, never bypass" tone audible.
 */
export declare function renderHaltMessage(emission: HaltEmission): string;
//# sourceMappingURL=halt.d.ts.map