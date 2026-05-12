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
/** Policy for handling an existing convention doc. */
export type ConflictPolicy = 'merge' | 'coexist' | 'skip';
/** Candidate convention documents detected in the project root. */
export declare const CONVENTION_DOC_CANDIDATES: ReadonlyArray<string>;
/** Outcome of {@link resolveConventionConflict}. */
export interface ConflictResolution {
    /** Which detected files triggered the resolver, if any. */
    readonly detected: ReadonlyArray<string>;
    /** Whether `.harness/conventions.md` should be written. */
    readonly writeStandalone: boolean;
    /** Path the merge appended to (when policy=merge). */
    readonly mergedInto: string | null;
}
/** Detect candidate docs in the project root. */
export declare function detectConventionDocs(projectRoot: string): ReadonlyArray<string>;
/**
 * Apply the conflict policy. When `policy === 'merge'`, write the
 * merge block into the first detected doc. When `policy === 'skip'`,
 * suppress both the standalone file and the merge. Coexist is a
 * no-op — the caller is responsible for writing the standalone
 * conventions.md.
 */
export declare function resolveConventionConflict(projectRoot: string, policy: ConflictPolicy, conventionsBody: string): ConflictResolution;
//# sourceMappingURL=conflictResolver.d.ts.map