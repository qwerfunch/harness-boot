/**
 * Convention-document conflict resolver for scenario-3 (F-161).
 *
 * Many real projects already ship a `CLAUDE.md`, `.cursorrules`, or
 * `AGENTS.md`. Silently dropping a competing `.harness/conventions.md`
 * would force the LLM agents to choose between two sources of truth.
 * The resolver makes the policy explicit:
 *
 *   - `merge` — append a user-edit-bounded block to the existing
 *     CLAUDE.md (or the first detected convention doc) with the
 *     auto-extracted conventions. Skip writing the standalone
 *     `.harness/conventions.md`.
 *   - `coexist` (default) — write both. agent context picks both
 *     up because the harness session loads `.harness/conventions.md`
 *     independently of CLAUDE.md.
 *   - `skip` — write neither the standalone conventions.md nor any
 *     change to CLAUDE.md. The user keeps the existing doc as-is.
 *
 * The merge block carries
 * `<!-- harness:user-edit-begin -->...<!-- harness:user-edit-end -->`
 * guards so future reseeds preserve user edits inside the section.
 *
 * @module init/codebase/conflictResolver
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
/** Candidate convention documents detected in the project root. */
export const CONVENTION_DOC_CANDIDATES = [
    'CLAUDE.md',
    '.cursorrules',
    'AGENTS.md',
];
const MERGE_HEADER = '## Conventions (auto-extracted, harness-boot)';
/** Detect candidate docs in the project root. */
export function detectConventionDocs(projectRoot) {
    return CONVENTION_DOC_CANDIDATES.filter((name) => existsSync(join(projectRoot, name)));
}
/**
 * Apply the conflict policy. When `policy === 'merge'`, write the
 * merge block into the first detected doc. When `policy === 'skip'`,
 * suppress both the standalone file and the merge. Coexist is a
 * no-op — the caller is responsible for writing the standalone
 * conventions.md.
 */
export function resolveConventionConflict(projectRoot, policy, conventionsBody) {
    const detected = detectConventionDocs(projectRoot);
    if (detected.length === 0 || policy === 'coexist') {
        return { detected, writeStandalone: true, mergedInto: null };
    }
    if (policy === 'skip') {
        return { detected, writeStandalone: false, mergedInto: null };
    }
    // merge
    const target = detected[0];
    appendConventionsBlock(join(projectRoot, target), conventionsBody);
    return { detected, writeStandalone: false, mergedInto: target };
}
function appendConventionsBlock(targetPath, conventionsBody) {
    const guarded = '\n\n<!-- harness:user-edit-begin -->\n' +
        MERGE_HEADER +
        '\n\n' +
        conventionsBody.trim() +
        '\n<!-- harness:user-edit-end -->\n';
    if (!existsSync(targetPath)) {
        writeFileSync(targetPath, guarded.trimStart(), 'utf8');
        return;
    }
    const existing = readFileSync(targetPath, 'utf8');
    // Replace the existing block if one is already present, otherwise append.
    const blockRegex = /\n*<!-- harness:user-edit-begin -->[\s\S]*?<!-- harness:user-edit-end -->\n*/m;
    if (blockRegex.test(existing)) {
        const rewritten = existing.replace(blockRegex, '\n' + guarded);
        writeFileSync(targetPath, rewritten, 'utf8');
        return;
    }
    appendFileSync(targetPath, guarded, 'utf8');
}
//# sourceMappingURL=conflictResolver.js.map