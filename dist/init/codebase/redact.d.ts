/**
 * Secret-redaction pass for scenario-3 codebase scans (F-161).
 *
 * Two layers of defense:
 *
 *   1. {@link redactSecrets} — a regex pass that turns api-key-,
 *      token-, password-shaped strings into `[REDACTED: <kind>]`
 *      placeholders. Applied to every text fact that flows into
 *      `conventions.md`, `spec.yaml`, and the analysis report.
 *   2. {@link FORBIDDEN_FILES} — a path list signals.ts must
 *      refuse to read entirely. Even an empty `.env` is denied so
 *      we never accidentally surface its filename to the LLM.
 *
 * Fail-closed: if the regex misses, the consumer should still
 * treat the file with suspicion. The slash-command prompt carries
 * an additional "if you see anything resembling a credential, write
 * <REDACTED> instead" sentence per plan §scenario-3.
 *
 * @module init/codebase/redact
 */
/** Files signals.ts must never read. */
export declare const FORBIDDEN_FILES: ReadonlyArray<string>;
/** One redaction event surfaced by {@link redactSecrets}. */
export interface RedactionMatch {
    /** Short label for the kind of secret detected. */
    readonly kind: string;
    /** Byte offset of the match start in the original text. */
    readonly start: number;
    /** Byte offset of the match end. */
    readonly end: number;
}
/** Result of {@link redactSecrets}. */
export interface RedactionResult {
    /** Input text with every match replaced by `[REDACTED: <kind>]`. */
    readonly text: string;
    /** Details of each match (for the analysis report). */
    readonly matches: ReadonlyArray<RedactionMatch>;
}
/**
 * Run the regex pass over `text` and return both the redacted body
 * and the list of matches. Idempotent — running it twice yields the
 * same text because `[REDACTED: ...]` doesn't match any pattern.
 */
export declare function redactSecrets(text: string): RedactionResult;
/**
 * Returns true when the given relative path matches a forbidden
 * file. Used by signals.ts to short-circuit reads.
 */
export declare function isForbiddenFile(relativePath: string): boolean;
//# sourceMappingURL=redact.d.ts.map