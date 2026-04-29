/**
 * Parity test for `src/core/canonicalHash.ts` (F-084).
 *
 * Loads Python-generated fixtures from
 * `tests/parity/fixtures/canonical_hash/` and verifies that the TS
 * implementation produces byte-identical output. Every fixture pair
 * is `<name>.json` (input) plus `<name>.expected.txt` (Python-computed
 * SHA-256 hex). When applicable, `<name>.bundle.json` carries the full
 * `compute_all` bundle so we can check `subtreeHashes` and
 * `merkleRoot` together.
 *
 * To regenerate fixtures after changing the Python implementation:
 *
 *   python3 tests/parity/fixtures/canonical_hash/generate_fixtures.py
 *
 * Run via:
 *
 *   npm run test:parity
 *
 * Behaviour preservation is the prime directive — a single failing
 * assertion here means the TS port has drifted from Python and every
 * `harness.yaml.spec_hash` recorded by either runtime would no longer
 * agree.
 */

import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {describe, expect, it} from 'vitest';

import {
  canonicalBytes,
  canonicalHash,
  computeAll,
  merkleRoot,
  subtreeHashes,
} from '../../src/core/canonicalHash.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures', 'canonical_hash');

/**
 * Returns the sorted list of fixture base names present on disk.
 *
 * Each base name corresponds to a `<name>.json` + `<name>.expected.txt`
 * pair. Sorting keeps test output stable across machines.
 */
function fixtureNames(): string[] {
  return readdirSync(FIXTURES_DIR)
    .filter((file) => file.endsWith('.json') && !file.endsWith('.bundle.json'))
    .map((file) => file.replace(/\.json$/, ''))
    .sort();
}

interface BundleFixture {
  spec_hash: string;
  subtrees: Record<string, string>;
  merkle_root: string;
}

describe('canonicalHash parity (Python ↔ TypeScript)', () => {
  const names = fixtureNames();

  it('discovers fixtures', () => {
    // Sanity check — keep the suite from silently passing on an empty dir.
    expect(names.length).toBeGreaterThanOrEqual(5);
  });

  for (const name of names) {
    it(`matches Python output for fixture: ${name}`, () => {
      const inputPath = join(FIXTURES_DIR, `${name}.json`);
      const expectedPath = join(FIXTURES_DIR, `${name}.expected.txt`);

      const input: unknown = JSON.parse(readFileSync(inputPath, 'utf-8'));
      const expected = readFileSync(expectedPath, 'utf-8').trim();

      const actual = canonicalHash(input);
      expect(actual).toBe(expected);
    });
  }

  /**
   * For dict-shaped fixtures only, the Python script emits a full
   * `compute_all` bundle. Verify TS produces the same `specHash`,
   * `subtrees` map, and `merkleRoot`. Non-dict fixtures (arrays /
   * primitives) are excluded — `compute_all` is dict-only.
   */
  for (const name of names) {
    const bundlePath = join(FIXTURES_DIR, `${name}.bundle.json`);
    let bundleFixture: BundleFixture | null = null;
    try {
      bundleFixture = JSON.parse(readFileSync(bundlePath, 'utf-8')) as BundleFixture;
    } catch {
      // No bundle for this fixture — skip silently (non-dict input).
      continue;
    }

    it(`computeAll matches Python bundle for fixture: ${name}`, () => {
      const inputPath = join(FIXTURES_DIR, `${name}.json`);
      const input = JSON.parse(readFileSync(inputPath, 'utf-8')) as Record<string, unknown>;

      const result = computeAll(input);
      const fixture = bundleFixture!;

      expect(result.specHash).toBe(fixture.spec_hash);
      expect(result.merkleRoot).toBe(fixture.merkle_root);

      // Subtree map: every key Python emitted must match TS.
      for (const [key, hash] of Object.entries(fixture.subtrees)) {
        expect(result.subtrees[key as keyof typeof result.subtrees]).toBe(hash);
      }
      // No extra keys on the TS side either.
      expect(Object.keys(result.subtrees).sort()).toEqual(
        Object.keys(fixture.subtrees).sort(),
      );
    });
  }

  /**
   * Cross-checks the helper components used by computeAll. The whole-
   * bundle test above already covers the integrated path; these
   * confirm that subtreeHashes and merkleRoot work standalone too.
   */
  it('subtreeHashes only emits keys present in input', () => {
    const partial = {project: {name: 'x'}, features: []};
    const subs = subtreeHashes(partial);
    expect(Object.keys(subs).sort()).toEqual(['features', 'project']);
    expect(subs.project).toBe(canonicalHash({name: 'x'}));
    expect(subs.features).toBe(canonicalHash([]));
  });

  it('merkleRoot is order-independent', () => {
    const a = {project: 'h1', domain: 'h2', features: 'h3'};
    const b = {features: 'h3', project: 'h1', domain: 'h2'};
    expect(merkleRoot(a)).toBe(merkleRoot(b));
  });
});

describe('canonicalHash error handling', () => {
  it('rejects NaN', () => {
    expect(() => canonicalHash(Number.NaN)).toThrow(TypeError);
  });

  it('rejects Infinity', () => {
    expect(() => canonicalHash(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });

  it('rejects -Infinity', () => {
    expect(() => canonicalHash(Number.NEGATIVE_INFINITY)).toThrow(TypeError);
  });

  it('rejects undefined', () => {
    expect(() => canonicalHash(undefined)).toThrow(TypeError);
  });

  it('rejects functions', () => {
    expect(() => canonicalHash(() => 0)).toThrow(TypeError);
  });

  it('rejects class instances', () => {
    class Custom {
      constructor(public value: number) {}
    }
    expect(() => canonicalHash(new Custom(1))).toThrow(TypeError);
  });
});

describe('canonicalBytes', () => {
  it('produces UTF-8 bytes that round-trip', () => {
    const value = {a: 1, b: '한국어'};
    const bytes = canonicalBytes(value);
    expect(bytes).toBeInstanceOf(Buffer);
    expect(bytes.toString('utf-8')).toBe('{"a":1,"b":"한국어"}');
  });
});
