/**
 * Drive mid-cycle real test (F-139 / Cycle B).
 *
 * Runs a user-defined "real test" command at periodic intervals
 * during a drive goal — every N feature completions by default. The
 * point: per-feature `gate_5` covers unit-level smoke; this catches
 * cross-feature regressions that only surface when the parts come
 * together (e.g. an end-to-end browser flow, a curl smoke against
 * a running dev server, a small integration script).
 *
 * Configuration in `harness.yaml`:
 *
 *     drive:
 *       real_test:
 *         command: "npm run e2e"
 *         every_n_features: 3   # default
 *
 * When unset (the common case), the hook is a silent no-op so
 * existing projects see no behaviour change.
 *
 * Boundaries:
 *
 *   - **Trigger** — `loop.ts` calls this after the F-138 replan hook
 *     at the same point (start of an iteration whose previous
 *     active feature has just transitioned to `done`).
 *   - **Pass** — exit code 0; writes `real_test_passed` event and
 *     the loop continues.
 *   - **Fail** — non-zero exit; writes `real_test_failed` event
 *     (with stderr tail) and the caller halts the loop with
 *     `reason: 'real_test_failed'`.
 *
 * @module drive/realTest
 */
/** Default cadence — run every 3 done features when unset by the user. */
export declare const DEFAULT_EVERY_N_FEATURES = 3;
/** F-140 — default cap on automatic retries before yielding to the user. */
export declare const DEFAULT_MAX_TRANSIENT_RETRIES = 1;
/**
 * F-140 — read the `drive.real_test.transient_retry` and
 * `drive.real_test.max_transient_retries` config fields.
 *
 * Returns `{enabled, cap}`. When the user has disabled the toggle
 * (`transient_retry: false`) the loop should never auto-retry, even
 * on the first fail. `cap` is bounded ≥ 0; `0` means "no auto-retry".
 */
export interface TransientRetryConfig {
    enabled: boolean;
    cap: number;
}
export declare function readTransientRetryConfig(harnessDir: string): TransientRetryConfig;
/** Result of one real-test evaluation. */
export interface RealTestResult {
    /** True when the command actually ran (false on opt-out / not-due). */
    ran: boolean;
    /** Pass/fail when ran; null when skipped. */
    passed: boolean | null;
    /** The command string when ran; null when skipped. */
    command: string | null;
    /** Exit code when ran; null when skipped. */
    exit_code: number | null;
    /** Stderr tail (last 10 lines) when ran; null when skipped. */
    stderr_tail?: string | null;
    /** When `ran === false`, why. */
    skip_reason?: 'unconfigured' | 'not_due' | 'no_goal';
}
/**
 * F-139 — runs the configured real-test command when due and
 * records the outcome.
 *
 * @param harnessDir   absolute or relative path to `.harness/`
 * @param goalId       active drive goal id (`null` skips with
 *                     `skip_reason: 'no_goal'`)
 * @param _completedFid feature id that just transitioned to done.
 *                      Reserved for future per-feature gating; not
 *                      used by the cadence calculation today.
 */
export declare function runRealTestIfDue(harnessDir: string, goalId: string | null, _completedFid: string): RealTestResult;
//# sourceMappingURL=realTest.d.ts.map