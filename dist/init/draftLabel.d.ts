/**
 * Draft-label + content-hash helpers for auto-generated `spec.yaml`
 * files (F-159).
 *
 * The label answers the spec-as-constitution objection from the
 * pre-implementation review rounds: an auto-generated spec is
 * shipped as a "current-state snapshot," not a constitutional
 * declaration. Three fields under `metadata` carry that contract:
 *
 *   - `metadata.source.origin` — `idea` · `plan_doc` · `existing_code`
 *   - `metadata.source.confidence` — `low` · `medium` · `high`
 *   - `metadata.draft` — `true` until the user edits, then `false`
 *   - `metadata.content_hash` — SHA-256 of the spec body excluding
 *     the `content_hash` field itself (so the hash stays stable on
 *     verbatim reads). Used by `src/work.ts` to detect user edits
 *     on activate and flip `draft` to `false` (the auto-promotion
 *     hook lives in F-159 AC-3).
 *
 * @module init/draftLabel
 */
/** Allowed values for `metadata.source.origin`. */
export type SpecOrigin = 'idea' | 'plan_doc' | 'existing_code';
/** Allowed values for `metadata.source.confidence`. */
export type SpecConfidence = 'low' | 'medium' | 'high';
/** Input for {@link stampDraftLabel}. */
export interface DraftLabelInput {
    /** The spec.yaml body (string), parsed by yaml.parse. */
    readonly specYaml: string;
    /** Where the spec came from. */
    readonly origin: SpecOrigin;
    /** Heuristic confidence in the auto-generation. */
    readonly confidence: SpecConfidence;
}
/** Result of {@link stampDraftLabel}. */
export interface DraftLabelResult {
    /** The spec.yaml body with the four metadata fields stamped. */
    readonly specYaml: string;
    /** SHA-256 of the spec body excluding the content_hash field itself. */
    readonly contentHash: string;
}
/**
 * Compute the canonical content hash for a spec body. The
 * `content_hash` field (if present) is removed before hashing so
 * that a verbatim re-serialization always yields the same digest.
 */
export declare function computeContentHash(specYaml: string): string;
/**
 * Stamp the four metadata fields onto a spec body. Returns the
 * rewritten YAML plus the canonical content hash.
 *
 * Existing values under `metadata.*` (e.g. user-authored fields)
 * are preserved — only `metadata.source.*`, `metadata.draft`, and
 * `metadata.content_hash` are overwritten.
 */
export declare function stampDraftLabel(input: DraftLabelInput): DraftLabelResult;
/**
 * Check whether a spec body's current content matches its recorded
 * `metadata.content_hash`. Returns `null` when the hash is missing
 * (treat as "no draft to track"); returns `true` when they match
 * and `false` when the user has edited.
 */
export declare function specMatchesRecordedHash(specYaml: string): boolean | null;
/** Whether a parsed spec carries `metadata.draft: true`. */
export declare function isDraft(specYaml: string): boolean;
//# sourceMappingURL=draftLabel.d.ts.map