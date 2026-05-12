/**
 * Plan-doc auto-detection for scenario-2 (F-162).
 *
 * Strategy: list `*.md` files in the project root, drop the
 * conventional non-plan documents (README · CHANGELOG · LICENSE
 * · CONTRIBUTING · CODE_OF_CONDUCT), and return the surviving file
 * **only when there is exactly one**. Zero or two-plus candidates
 * return `null` — the CLI then asks for an explicit `--plan` path
 * so we never silently pick the wrong file.
 *
 * @module init/codebase/mdDetect
 */
/**
 * Filenames that are never treated as plan docs even when they
 * happen to be the only `*.md` file in the root. Matched case-
 * insensitively against the basename.
 */
export declare const NON_PLAN_MARKDOWN: ReadonlyArray<string>;
/**
 * Return the single non-README markdown filename in `root`, or
 * `null` when there are zero or two-plus candidates.
 */
export declare function detectPlanDocCandidate(root: string): string | null;
/**
 * Convenience: return the absolute path of the detected candidate
 * relative to `root`, or `null`.
 */
export declare function detectPlanDocCandidatePath(root: string): string | null;
//# sourceMappingURL=mdDetect.d.ts.map