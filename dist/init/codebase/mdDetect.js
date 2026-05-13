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
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
/**
 * Filenames that are never treated as plan docs even when they
 * happen to be the only `*.md` file in the root. Matched case-
 * insensitively against the basename.
 */
export const NON_PLAN_MARKDOWN = [
    'readme.md',
    'changelog.md',
    'license.md',
    'contributing.md',
    'code_of_conduct.md',
    'code-of-conduct.md',
    'security.md',
    'authors.md',
    'maintainers.md',
    'support.md',
    'governance.md',
    'release_notes.md',
    'release-notes.md',
    // F-171 — never treat CLAUDE.md as a plan doc candidate. It's the
    // Claude Code context file the harness itself installs; mistaking
    // it for an intent doc would make `harness init` auto-route to
    // plan_doc scenario on any project that already has the context.
    'claude.md',
];
/**
 * Return the single non-README markdown filename in `root`, or
 * `null` when there are zero or two-plus candidates.
 */
export function detectPlanDocCandidate(root) {
    let entries;
    try {
        entries = readdirSync(root);
    }
    catch {
        return null;
    }
    const candidates = entries.filter((entry) => {
        if (!entry.toLowerCase().endsWith('.md'))
            return false;
        if (NON_PLAN_MARKDOWN.includes(entry.toLowerCase()))
            return false;
        return true;
    });
    if (candidates.length !== 1)
        return null;
    return candidates[0];
}
/**
 * Convenience: return the absolute path of the detected candidate
 * relative to `root`, or `null`.
 */
export function detectPlanDocCandidatePath(root) {
    const name = detectPlanDocCandidate(root);
    return name === null ? null : join(root, name);
}
//# sourceMappingURL=mdDetect.js.map