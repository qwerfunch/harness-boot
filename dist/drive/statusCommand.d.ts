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
import { State } from '../core/state.js';
import { type RenderJsonShape } from './progressRenderer.js';
import type { GoalSpec } from './types.js';
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
/**
 * Composes the full text output for one render pass.
 *
 * @internal — exported for unit tests; CLI code should use
 *   {@link runDriveStatus}.
 */
export declare function composeStatusText(goals: readonly GoalSpec[], state: State, specFeatures: ReadonlyArray<Record<string, unknown>>, options: DriveStatusOptions): string;
/**
 * Composes the JSON output for one render pass.
 *
 * @internal — exported for unit tests.
 */
export declare function composeStatusJson(goals: readonly GoalSpec[], state: State, specFeatures: ReadonlyArray<Record<string, unknown>>, options: DriveStatusOptions): {
    goals: RenderJsonShape[];
};
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
export declare function runDriveStatus(options: DriveStatusOptions): Promise<number>;
//# sourceMappingURL=statusCommand.d.ts.map