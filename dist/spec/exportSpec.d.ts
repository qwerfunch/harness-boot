/**
 * Spec exporter — emits a compacted copy of `spec.yaml` for context-
 * conscious LLM imports (F-131, logcat-on ISSUES-LOG return).
 *
 * Why this module exists:
 *
 * Projects that have accumulated 200+ done features now spend tens of
 * thousands of tokens on every Claude conversation just on the
 * `acceptance_criteria` and `description` bodies of features that have
 * already shipped — `@.harness/spec.yaml` is a whole-file import.
 * This module produces a derived view where done / archived features
 * are summarised down to one placeholder line per AC array and a
 * truncated description, while active features (planned, in_progress,
 * blocked, or absent from state.yaml entirely) are emitted byte-
 * identical to the input.
 *
 * Boundaries:
 *
 *   - **Read-only.** Never mutates `spec.yaml` or `state.yaml`; CQS
 *     (BR-012) is enforced by the CLI integration test.
 *   - **Schema-preserving.** The placeholder is still a string inside
 *     `acceptance_criteria: string[]`, so the output passes
 *     `spec.schema.json` (verified by AC-7).
 *   - **Lite scope.** Compaction logic for the two heaviest free-text
 *     fields only. Structured fields (modules, ui_surface,
 *     performance_budget, etc.) pass through unchanged.
 *
 * @module spec/exportSpec
 */
/** Maximum length of the compacted `description` first line. */
export declare const DESCRIPTION_TRUNCATE_AT = 120;
/** Optional input for {@link exportSpec}. */
export interface ExportSpecOptions {
    /** Compact features whose state.yaml status is `done` or `archived`. */
    activeOnly?: boolean;
}
/**
 * Reads `<harnessDir>/spec.yaml` (and `<harnessDir>/state.yaml` when
 * `activeOnly` is true) and returns the resulting yaml document as a
 * string. The default behaviour (no flags) is an idempotent yaml
 * round-trip — useful for normalisation, no-op for the caller. With
 * `activeOnly`, every feature in a shipped state has its
 * `acceptance_criteria` and `description` compacted.
 *
 * @param harnessDir absolute or relative path to the `.harness/` dir
 * @param options    see {@link ExportSpecOptions}
 * @returns the stringified yaml document, ending with a newline
 * @throws Error when spec.yaml is missing or malformed
 */
export declare function exportSpec(harnessDir: string, options?: ExportSpecOptions): string;
/**
 * Picks the first non-blank line of a multi-line description and
 * hard-truncates it. Trailing punctuation is preserved up to the cap;
 * if truncation occurs the result ends with `…`. Empty input returns
 * the empty string so the caller can choose whether to keep the field.
 */
export declare function compactDescription(text: string): string;
//# sourceMappingURL=exportSpec.d.ts.map