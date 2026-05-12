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

import {readFileSync, writeFileSync} from 'node:fs';

/** Allowed sections that carry an LLM-hook placeholder. */
export type FillSection = 'comments' | 'tests';

const PLACEHOLDER_PATTERNS: Record<FillSection, RegExp> = {
  comments: /> _\[pending: LLM hook stub — PR 3b fills sample-driven comment-style detection\]_/,
  tests: /> _\[pending: LLM hook stub — PR 3b fills sample-driven test-pattern detection\]_/,
};

/** Outcome of {@link fillConventionsSection}. */
export interface FillResult {
  /** Path that was rewritten. */
  readonly path: string;
  /** Section that was filled. */
  readonly section: FillSection;
}

/** Thrown when the requested section is already filled (idempotency guard). */
export class SectionAlreadyFilledError extends Error {
  constructor(section: FillSection, path: string) {
    super(
      `conventions ${section} section already filled in ${path} ` +
        `(no LLM hook stub placeholder found)`,
    );
    this.name = 'SectionAlreadyFilledError';
  }
}

/**
 * Replace the `[pending: LLM hook stub]` placeholder for `section`
 * with `text`. The replacement preserves indentation and the
 * surrounding blank lines so the markdown stays readable.
 *
 * Refuses to run when the placeholder is missing — that signals
 * the section is already filled (idempotency contract).
 */
export function fillConventionsSection(
  path: string,
  section: FillSection,
  text: string,
): FillResult {
  const body = readFileSync(path, 'utf8');
  const pattern = PLACEHOLDER_PATTERNS[section];
  if (!pattern.test(body)) {
    throw new SectionAlreadyFilledError(section, path);
  }
  const replacement = text.trim();
  const rewritten = body.replace(pattern, replacement);
  writeFileSync(path, rewritten, 'utf8');
  return {path, section};
}

/** Returns true when the section still carries an LLM hook placeholder. */
export function hasPendingPlaceholder(body: string, section: FillSection): boolean {
  return PLACEHOLDER_PATTERNS[section].test(body);
}
