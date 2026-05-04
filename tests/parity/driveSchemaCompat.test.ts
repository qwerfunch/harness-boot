/**
 * Schema backward-compatibility tests for v2.3.9 (F-118).
 *
 * The drive feature lands on top of v2.3.8 by adding two optional
 * fields: top-level `goals[]` and `features[].goal_id`. This test
 * suite asserts that:
 *
 *   - The canonical sample (`docs/samples/harness-boot-self/spec.yaml`)
 *     validates against the new v2.3.9 schema.
 *   - A synthetic v2.3.8 spec (no `goals` key) still validates as a
 *     no-op — backward compat is preserved.
 *   - A spec with an empty `goals: []` validates.
 *   - A spec with a populated `goals` block (id, slug, title,
 *     feature_ids) validates.
 *   - A spec with a malformed goal id (`X-001` instead of `G-NNN`)
 *     fails validation — the new field is enforced.
 *
 * Run via `npm run test:parity`.
 */

import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {parse as yamlParse} from 'yaml';
import {SpecValidationError, validate} from '../../src/spec/validate.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

function tryValidate(spec: unknown): {ok: boolean; error?: SpecValidationError} {
  try {
    validate(spec);
    return {ok: true};
  } catch (err) {
    if (err instanceof SpecValidationError) {
      return {ok: false, error: err};
    }
    throw err;
  }
}

describe('spec.schema.json v2.3.9 — backward compat (F-118)', () => {
  it('validates the canonical harness-boot-self sample', () => {
    const path = join(repoRoot, 'docs', 'samples', 'harness-boot-self', 'spec.yaml');
    const doc = yamlParse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
    const r = tryValidate(doc);
    if (!r.ok) {
      throw new Error(`canonical spec failed: ${r.error?.message} at ${r.error?.path?.join('.')}`);
    }
  });

  it('validates a synthetic legacy v2.3.8 spec without goals key', () => {
    const r = tryValidate({
      version: '2.3.8',
      project: {name: 'p', summary: 's'},
      domain: {entities: [], events: []},
      features: [{id: 'F-001', type: 'skeleton'}],
    });
    expect(r.ok).toBe(true);
  });

  it('validates a v2.3.9 spec with empty goals: []', () => {
    const r = tryValidate({
      version: '2.3.9',
      project: {name: 'p', summary: 's'},
      domain: {entities: [], events: []},
      features: [{id: 'F-001', type: 'skeleton'}],
      goals: [],
    });
    expect(r.ok).toBe(true);
  });

  it('validates a v2.3.9 spec with a populated goal', () => {
    const r = tryValidate({
      version: '2.3.9',
      project: {name: 'p', summary: 's'},
      domain: {entities: [], events: []},
      features: [
        {id: 'F-001', type: 'skeleton'},
        {id: 'F-118', type: 'feature', goal_id: 'G-001'},
      ],
      goals: [
        {
          id: 'G-001',
          slug: 'memo-sync',
          title: 'Memo Sync',
          feature_ids: ['F-118'],
          created_at: '2026-05-04T10:00:00Z',
        },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('rejects a goal id that does not match G-NNN', () => {
    const r = tryValidate({
      version: '2.3.9',
      project: {name: 'p', summary: 's'},
      domain: {entities: [], events: []},
      features: [{id: 'F-001', type: 'skeleton'}],
      goals: [
        {id: 'X-001', slug: 'memo', title: 'Memo', feature_ids: []},
      ],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects a goal slug with uppercase letters', () => {
    const r = tryValidate({
      version: '2.3.9',
      project: {name: 'p', summary: 's'},
      domain: {entities: [], events: []},
      features: [{id: 'F-001', type: 'skeleton'}],
      goals: [
        {id: 'G-001', slug: 'Memo-Sync', title: 'Memo', feature_ids: []},
      ],
    });
    expect(r.ok).toBe(false);
  });

  it('accepts a feature without goal_id (optional back-reference)', () => {
    const r = tryValidate({
      version: '2.3.9',
      project: {name: 'p', summary: 's'},
      domain: {entities: [], events: []},
      features: [
        {id: 'F-001', type: 'skeleton'},
        {id: 'F-002', type: 'feature'},
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('rejects a feature with malformed goal_id', () => {
    const r = tryValidate({
      version: '2.3.9',
      project: {name: 'p', summary: 's'},
      domain: {entities: [], events: []},
      features: [
        {id: 'F-001', type: 'skeleton'},
        {id: 'F-002', type: 'feature', goal_id: 'wrong-format'},
      ],
    });
    expect(r.ok).toBe(false);
  });
});
