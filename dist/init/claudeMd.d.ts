/**
 * F-171 — CLAUDE.md auto-copy helper.
 *
 * Used by every init scenario (skeleton-only · idea · existing_code ·
 * plan_doc) to land `CLAUDE.md` at the project root from
 * `docs/templates/starter/CLAUDE.md.template`. Strict skip-if-exists
 * semantics — once the user has a CLAUDE.md (custom edits or older
 * project context) the helper never overwrites it.
 *
 * The user motive captured in F-171:
 *
 *   > 모든 것은 사용자가 요청하는 것이 아니라, 내부적으로 적시에
 *   > 자동 수행되어야 함.
 *
 * Before F-171 the bare-skeleton path wrote three `.harness/` files
 * and no CLAUDE.md; users running the CLI directly got no Claude
 * Code context. Now every path installs the context file as a side
 * effect, so opening the project in Claude Code immediately picks
 * up `@.harness/spec.yaml` etc.
 *
 * @module init/claudeMd
 */
/** Outcome of {@link copyClaudeMdIfAbsent}. */
export interface ClaudeMdCopyResult {
    /** Absolute path of the target file (whether or not we touched it). */
    readonly targetPath: string;
    /** True when this call actually wrote the file. */
    readonly wrote: boolean;
    /**
     * Reason the helper skipped — `null` when it wrote, otherwise a
     * short tag (`'already_exists' | 'template_missing'`).
     */
    readonly skippedReason: 'already_exists' | 'template_missing' | null;
}
/**
 * Copies the starter `CLAUDE.md.template` to `<targetDir>/CLAUDE.md`
 * **only when the target does not already exist**.
 *
 * Always returns; never throws. Callers that want to surface the
 * skip to the user can read `skippedReason` and emit a stderr line
 * (the helper itself stays quiet so it composes cleanly).
 */
export declare function copyClaudeMdIfAbsent(targetDir: string, pluginRoot: string): ClaudeMdCopyResult;
//# sourceMappingURL=claudeMd.d.ts.map