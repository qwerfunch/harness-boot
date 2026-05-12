/**
 * Replace the `[pending: LLM hook stub]` placeholders in
 * `.harness/conventions.md` with text the slash command's
 * codebase-archaeologist produced from sampling source files
 * (F-163).
 *
 * The CLI side stays deterministic — no model call from the
 * binary. The slash command samples 5–10 source files for the
 * Comments section and 1–2 test files for the Tests section,
 * runs a single LLM turn, and pipes the result back through
 * `harness conventions fill`. This module owns the in-place
 * replacement.
 *
 * @module init/codebase/conventionsFill
 */
/** Allowed sections that carry an LLM-hook placeholder. */
export type FillSection = 'comments' | 'tests';
/** Outcome of {@link fillConventionsSection}. */
export interface FillResult {
    /** Path that was rewritten. */
    readonly path: string;
    /** Section that was filled. */
    readonly section: FillSection;
}
/** Thrown when the requested section is already filled (idempotency guard). */
export declare class SectionAlreadyFilledError extends Error {
    constructor(section: FillSection, path: string);
}
/**
 * Replace the `[pending: LLM hook stub]` placeholder for `section`
 * with `text`. The replacement preserves indentation and the
 * surrounding blank lines so the markdown stays readable.
 *
 * Refuses to run when the placeholder is missing — that signals
 * the section is already filled (idempotency contract).
 */
export declare function fillConventionsSection(path: string, section: FillSection, text: string): FillResult;
/** Returns true when the section still carries an LLM hook placeholder. */
export declare function hasPendingPlaceholder(body: string, section: FillSection): boolean;
//# sourceMappingURL=conventionsFill.d.ts.map