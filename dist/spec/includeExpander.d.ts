/**
 * `$include` expansion engine — depth-1 with locked-field guard
 * (F-090 port of `scripts/spec/include_expander.py`, F-009 in spec).
 *
 * Spec extract:
 *
 *     project:
 *       description:
 *         $include: "chapters/project-description.md"
 *
 *     ↓ expand
 *
 *     project:
 *       description: "<chapters/project-description.md text>"
 *
 * Rules:
 *
 *   1. `$include` is detected only on a single-key mapping
 *      (`{$include: "..."}`). Any other key in the same map disables
 *      detection.
 *   2. Value must be a relative path inside the chapters directory.
 *      Absolute paths and `..` escapes are rejected.
 *   3. Depth-1 enforcement — included content is treated as a literal
 *      string. Nested `$include` strings inside a chapter file remain
 *      verbatim text.
 *   4. Locked fields ({@link LOCKED_FIELD_NAMES}) reject `$include`
 *      so identifier-bearing nodes cannot be hot-swapped.
 *   5. Missing files / read errors fail fast.
 *
 * @module spec/includeExpander
 */
/**
 * Field names whose immediate value MUST not be a `$include` node.
 *
 * Identifiers must be inline in the spec — substituting them via an
 * include opens manipulation of the canonical hash and the audit
 * trail without leaving a textual trace in the file the user
 * reviews.
 */
export declare const LOCKED_FIELD_NAMES: ReadonlySet<string>;
/** Thrown when $include expansion runs into a violation. */
export declare class IncludeError extends Error {
    constructor(message: string);
}
/** One discovered `$include` node — its tree path, target, and parent key. */
export interface IncludeFinding {
    path: ReadonlyArray<string | number>;
    target: string;
    parentKey: string | null;
}
/**
 * Walks a tree and collects every `$include` node it sees.
 *
 * Once the function descends into an include node it stops — the
 * value is a path string, not further traversable.
 */
export declare function findIncludes(obj: unknown): IncludeFinding[];
/** Optional input for {@link expand}. */
export interface ExpandOptions {
    strictLockedFields?: boolean;
}
/**
 * Expands every `$include` in a parsed spec object (depth-1).
 *
 * @param spec - Parsed `spec.yaml` mapping.
 * @param chaptersDir - Base directory used for `$include` lookups.
 * @returns A new spec object with includes inlined; the original is
 *   not mutated. When the spec contains no includes, the same object
 *   is returned unchanged.
 * @throws {@link IncludeError} on locked-field violation, traversal
 *   escape, missing target, or read failure.
 */
export declare function expand(spec: Record<string, unknown>, chaptersDir: string, options?: ExpandOptions): Record<string, unknown>;
/**
 * Picks the chapters directory for a given spec file path.
 *
 * Priority:
 *   1. Explicit override.
 *   2. `<spec-parent>/.harness/chapters/` if it exists.
 *   3. `<spec-parent>/chapters/` if it exists.
 *   4. The first candidate as a default — even when missing — so the
 *      error surfaces as "$include 대상 파일 없음" rather than a
 *      generic ENOENT on the directory itself.
 */
export declare function resolveChaptersDir(specPath: string, explicit?: string | null): string;
//# sourceMappingURL=includeExpander.d.ts.map