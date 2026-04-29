/**
 * Canonical hashing for harness-boot specs (F-010, ported in F-084).
 *
 * This module is the single most critical port of the Python → TypeScript
 * migration: every drift detector and every `harness.yaml.spec_hash`
 * record depends on the hash being identical across runtimes. A
 * one-byte deviation breaks the entire drift system.
 *
 * Mirrors `scripts/core/canonical_hash.py` byte-for-byte:
 *
 *   1. Parse YAML to a plain object (comments / anchors / order
 *      stripped). Performed by the caller; this module accepts a
 *      pre-parsed value.
 *   2. Serialize via canonical JSON — keys sorted recursively, no
 *      whitespace separators, Unicode preserved, NaN / Infinity
 *      rejected.
 *   3. UTF-8 encode and SHA-256 → 64-char lowercase hex.
 *
 * Equivalent Python invocation:
 *
 *   json.dumps(obj, sort_keys=True, ensure_ascii=False,
 *              separators=(",", ":"), allow_nan=False)
 *
 * Native `JSON.stringify` does not sort keys and does not raise on
 * NaN / Infinity (it converts to `null`), so this module canonicalizes
 * the input first and validates non-finite numbers explicitly before
 * passing the result to `JSON.stringify`.
 *
 * @module canonicalHash
 */
/**
 * Subtree keys hashed independently for the spec's Merkle tree.
 *
 * Mirrors `scripts/core/canonical_hash.py:SUBTREE_KEYS`. Order is
 * informational only — the Merkle root sorts entries by key when
 * combining hashes.
 */
export declare const SUBTREE_KEYS: readonly ["project", "domain", "constraints", "deliverable", "features", "metadata"];
export type SubtreeKey = (typeof SUBTREE_KEYS)[number];
/**
 * Bundle of every hash the harness-boot spec needs.
 *
 * Mirrors the dict returned by
 * `scripts/core/canonical_hash.py:compute_all`:
 *
 *   - `specHash`: hash of the entire parsed spec, top-level keys sorted.
 *   - `subtrees`: per-subtree hash, only keys that are present in the
 *     input appear (e.g. `metadata` is omitted when the spec has none).
 *   - `merkleRoot`: hash of `[{key, hash}, ...]` sorted by `key`. Order-
 *     independent so reordering subtree keys in the input does not
 *     change the root.
 */
export interface HashBundle {
    specHash: string;
    subtrees: Partial<Record<SubtreeKey, string>>;
    merkleRoot: string;
}
/**
 * Serializes a value to canonical JSON bytes (UTF-8).
 *
 * Mirrors `scripts/core/canonical_hash.py:canonical_bytes`. The output
 * matches Python's
 * `json.dumps(obj, sort_keys=True, ensure_ascii=False,
 * separators=(",", ":"), allow_nan=False).encode("utf-8")` byte-for-byte.
 *
 * @param value - Pre-parsed YAML / JSON value.
 * @returns UTF-8 encoded canonical JSON.
 * @throws {TypeError} When the value contains non-finite numbers or
 *   non-JSON-compatible types.
 */
export declare function canonicalBytes(value: unknown): Buffer;
/**
 * Computes the canonical SHA-256 hash of a parsed YAML / JSON value.
 *
 * Mirrors `scripts/core/canonical_hash.py:canonical_hash`. The output
 * is a 64-character lowercase hex string — the same format
 * `harness.yaml.generation.generated_from.spec_hash` expects.
 *
 * @param value - Pre-parsed value (typically from `yaml.parse`).
 * @returns 64-character lowercase hex SHA-256 digest.
 * @throws {TypeError} When the value contains non-finite numbers or
 *   non-JSON-compatible types.
 */
export declare function canonicalHash(value: unknown): string;
/**
 * Computes the per-subtree hash map for a spec.
 *
 * Mirrors `scripts/core/canonical_hash.py:subtree_hashes`. Only keys
 * present in `spec` produce an entry; missing keys are omitted (they
 * are not hashed as `null`).
 *
 * @param spec - Top-level parsed spec object.
 * @returns Map from subtree key to canonical SHA-256 hex.
 */
export declare function subtreeHashes(spec: Record<string, unknown>): Partial<Record<SubtreeKey, string>>;
/**
 * Computes the Merkle root that combines every subtree hash.
 *
 * Mirrors `scripts/core/canonical_hash.py:merkle_root`. Builds an array
 * of `{key, hash}` records sorted by `key`, then canonical-hashes the
 * array. Adding a new top-level field (e.g. injected `garbage` key)
 * shifts the root, which is how harness-boot detects unexpected spec
 * structure changes.
 *
 * @param subtrees - Per-subtree hash map (output of
 *   {@link subtreeHashes}).
 * @returns 64-character lowercase hex SHA-256 of the combined record.
 */
export declare function merkleRoot(subtrees: Partial<Record<SubtreeKey, string>>): string;
/**
 * Computes the full hash bundle for a spec.
 *
 * Mirrors `scripts/core/canonical_hash.py:compute_all`. Returned shape
 * matches `harness.yaml.generation.generated_from` — `spec_hash`
 * becomes the entire-spec digest, `subtrees` carries per-section
 * digests, and `merkle_root` carries the order-independent combined
 * digest.
 *
 * @param spec - Top-level parsed spec object.
 * @returns {@link HashBundle} with every hash needed by harness.yaml.
 */
export declare function computeAll(spec: Record<string, unknown>): HashBundle;
//# sourceMappingURL=canonicalHash.d.ts.map