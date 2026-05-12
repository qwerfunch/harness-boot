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
import { createHash } from 'node:crypto';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
/**
 * Compute the canonical content hash for a spec body. The
 * `content_hash` field (if present) is removed before hashing so
 * that a verbatim re-serialization always yields the same digest.
 */
export function computeContentHash(specYaml) {
    const parsed = yamlParse(specYaml);
    if (parsed && typeof parsed === 'object') {
        const meta = parsed['metadata'];
        if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
            // Drop the content_hash field for stability.
            delete meta['content_hash'];
        }
    }
    const canonical = yamlStringify(parsed ?? {}, { sortMapEntries: true });
    return 'sha256:' + createHash('sha256').update(canonical, 'utf8').digest('hex');
}
/**
 * Stamp the four metadata fields onto a spec body. Returns the
 * rewritten YAML plus the canonical content hash.
 *
 * Existing values under `metadata.*` (e.g. user-authored fields)
 * are preserved — only `metadata.source.*`, `metadata.draft`, and
 * `metadata.content_hash` are overwritten.
 */
export function stampDraftLabel(input) {
    const parsed = (yamlParse(input.specYaml) ?? {});
    const metadata = parsed['metadata'] ?? {};
    const source = metadata['source'] ?? {};
    source['origin'] = input.origin;
    source['confidence'] = input.confidence;
    metadata['source'] = source;
    metadata['draft'] = true;
    parsed['metadata'] = metadata;
    // Two-pass: serialize once without content_hash, hash that body,
    // then drop the hash back in. This keeps the hash byte-stable on
    // future verbatim reads (the deletion in computeContentHash
    // mirrors this step).
    const withoutHash = yamlStringify(parsed, { sortMapEntries: true });
    const hash = 'sha256:' + createHash('sha256').update(withoutHash, 'utf8').digest('hex');
    metadata['content_hash'] = hash;
    parsed['metadata'] = metadata;
    return {
        specYaml: yamlStringify(parsed, { sortMapEntries: true }),
        contentHash: hash,
    };
}
/**
 * Check whether a spec body's current content matches its recorded
 * `metadata.content_hash`. Returns `null` when the hash is missing
 * (treat as "no draft to track"); returns `true` when they match
 * and `false` when the user has edited.
 */
export function specMatchesRecordedHash(specYaml) {
    const parsed = yamlParse(specYaml);
    if (!parsed)
        return null;
    const metadata = parsed['metadata'];
    const recorded = metadata?.['content_hash'];
    if (typeof recorded !== 'string' || recorded.length === 0)
        return null;
    return computeContentHash(specYaml) === recorded;
}
/** Whether a parsed spec carries `metadata.draft: true`. */
export function isDraft(specYaml) {
    const parsed = yamlParse(specYaml);
    const metadata = parsed?.['metadata'];
    return metadata?.['draft'] === true;
}
//# sourceMappingURL=draftLabel.js.map