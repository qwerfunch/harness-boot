/**
 * Bare-skeleton init path — copies the three starter templates and
 * writes a one-line `events.log` so the harness directory boots with
 * zero LLM calls and sub-500 ms wall time (F-158).
 *
 * This is the "safety net" surface invoked by `harness init
 * --skeleton-only` and consumed by the perf bench under
 * `tests/perf/`. The full UX (scenario 1 / 2 / 3 routing, agent
 * collaboration, conventions extraction) lives in the slash command
 * `/harness-boot:init`; this module is intentionally minimal so the
 * regression gate stays cheap to evaluate.
 *
 * The contract — given a target directory and a plugin root, return
 * a list of files written plus a `harness_initialized` event line —
 * is byte-stable across runs so bench fixtures can assert exact
 * equality.
 *
 * @module init/skeleton
 */
/** Required input for {@link runSkeletonInit}. */
export interface SkeletonInitInput {
    /** Target project directory; `.harness/` is created beneath it. */
    readonly targetDir: string;
    /** Plugin root (the harness-boot checkout that owns `docs/templates/starter/`). */
    readonly pluginRoot: string;
    /** Optional ISO-8601 timestamp; defaults to `new Date().toISOString()` (without ms). */
    readonly now?: string;
    /** Optional plugin version string written to `events.log`; defaults to `0.0.0` when unread. */
    readonly pluginVersion?: string;
    /** When `team`, append `.harness/state.yaml` to `.gitignore` (matches slash-command parity). */
    readonly mode?: 'solo' | 'team';
}
/** Result of {@link runSkeletonInit}. */
export interface SkeletonInitResult {
    /** Absolute path to the created `.harness/` directory. */
    readonly harnessDir: string;
    /** Absolute paths of every file written, in deterministic order. */
    readonly filesWritten: ReadonlyArray<string>;
    /** Wall time spent inside the call, in milliseconds. */
    readonly wallTimeMs: number;
    /** Always `0` — the skeleton path makes no LLM calls (F-158 invariant). */
    readonly llmCallCount: 0;
}
/**
 * Copy starter templates plus events.log into `<targetDir>/.harness/`.
 *
 * Refuses to overwrite an existing `.harness/spec.yaml` (mirrors the
 * §0 pre-flight guard in `commands/init.md`). All file writes are
 * deterministic given the same `now` / `pluginVersion` inputs, which
 * lets the perf bench commit golden fixtures without flakes.
 */
export declare function runSkeletonInit(input: SkeletonInitInput): SkeletonInitResult;
//# sourceMappingURL=skeleton.d.ts.map