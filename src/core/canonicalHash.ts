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

import {createHash} from 'node:crypto';

/**
 * Subtree keys hashed independently for the spec's Merkle tree.
 *
 * Mirrors `scripts/core/canonical_hash.py:SUBTREE_KEYS`. Order is
 * informational only — the Merkle root sorts entries by key when
 * combining hashes.
 */
export const SUBTREE_KEYS = [
  'project',
  'domain',
  'constraints',
  'deliverable',
  'features',
  'metadata',
] as const;

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
 * Recursively rebuilds the input value with object keys sorted.
 *
 * Arrays preserve order (sequence is part of the canonical form).
 * Plain objects produce a new object whose keys appear in
 * lexicographically sorted order — `JSON.stringify` then walks them in
 * insertion order, matching Python's `sort_keys=True` behaviour.
 *
 * Non-finite numbers (`NaN`, `Infinity`, `-Infinity`) throw because
 * Python's `allow_nan=False` does the same. Functions, symbols, and
 * `undefined` likewise throw — they cannot survive a JSON round-trip.
 *
 * @param value - Any JSON-compatible value; objects must be plain.
 * @returns A structurally equivalent value with keys sorted.
 * @throws {TypeError} On non-finite numbers or non-JSON-compatible types.
 */
function canonicalize(value: unknown): unknown {
  if (value === null) {
    return null;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(
        `canonical_hash: non-finite number encountered (${String(value)}); ` +
          'Python equivalent uses allow_nan=False which raises ValueError.',
      );
    }
    return value;
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (typeof value === 'object') {
    // Plain object — sort keys recursively. Buffers, Dates, Maps, Sets,
    // and class instances are not canonicalizable and would silently
    // round-trip through JSON.stringify with surprising results.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new TypeError(
        'canonical_hash: only plain objects are canonicalizable; ' +
          `received instance of ${value.constructor?.name ?? 'unknown'}.`,
      );
    }
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize(obj[key]);
    }
    return result;
  }
  throw new TypeError(
    `canonical_hash: cannot serialize value of type ${typeof value}.`,
  );
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
export function canonicalBytes(value: unknown): Buffer {
  const sorted = canonicalize(value);
  // JSON.stringify with no spacer argument produces no whitespace
  // between separators, matching Python's `(",", ":")` configuration.
  // It also preserves Unicode characters as-is, matching Python's
  // `ensure_ascii=False`.
  const json = JSON.stringify(sorted);
  return Buffer.from(json, 'utf-8');
}

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
export function canonicalHash(value: unknown): string {
  return createHash('sha256').update(canonicalBytes(value)).digest('hex');
}

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
export function subtreeHashes(
  spec: Record<string, unknown>,
): Partial<Record<SubtreeKey, string>> {
  const result: Partial<Record<SubtreeKey, string>> = {};
  for (const key of SUBTREE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(spec, key)) {
      result[key] = canonicalHash(spec[key]);
    }
  }
  return result;
}

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
export function merkleRoot(
  subtrees: Partial<Record<SubtreeKey, string>>,
): string {
  const entries = Object.entries(subtrees) as Array<[string, string]>;
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const combined = entries.map(([key, hash]) => ({key, hash}));
  return canonicalHash(combined);
}

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
export function computeAll(spec: Record<string, unknown>): HashBundle {
  const subtrees = subtreeHashes(spec);
  return {
    specHash: canonicalHash(spec),
    subtrees,
    merkleRoot: merkleRoot(subtrees),
  };
}
