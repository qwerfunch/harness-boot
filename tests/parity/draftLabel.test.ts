/**
 * Unit tests for `src/init/draftLabel.ts` (F-159).
 *
 * Covers:
 *
 *   - `stampDraftLabel()` stamps origin · confidence · draft · hash.
 *   - `computeContentHash()` is stable under verbatim re-read.
 *   - `specMatchesRecordedHash()` detects user edits.
 *   - `isDraft()` reflects the metadata flag.
 *
 * Run via `npm test`.
 */

import {describe, expect, it} from 'vitest';
import {parse as yamlParse} from 'yaml';

import {
  computeContentHash,
  isDraft,
  specMatchesRecordedHash,
  stampDraftLabel,
} from '../../src/init/draftLabel.js';

const SAMPLE = `version: "2.3"
project:
  name: pomodoro-musicians
  summary: 25/5 timer for solo practice
domain:
  entities: []
features:
  - id: F-0
    type: skeleton
`;

describe('stampDraftLabel', () => {
  it('stamps origin · confidence · draft · content_hash under metadata', () => {
    const result = stampDraftLabel({
      specYaml: SAMPLE,
      origin: 'idea',
      confidence: 'medium',
    });
    const parsed = yamlParse(result.specYaml) as Record<string, unknown>;
    const metadata = parsed['metadata'] as Record<string, unknown>;
    const source = metadata['source'] as Record<string, unknown>;
    expect(source['origin']).toBe('idea');
    expect(source['confidence']).toBe('medium');
    expect(metadata['draft']).toBe(true);
    expect(typeof metadata['content_hash']).toBe('string');
    expect((metadata['content_hash'] as string).startsWith('sha256:')).toBe(true);
    expect(result.contentHash).toBe(metadata['content_hash']);
  });

  it('preserves untouched fields elsewhere in the spec', () => {
    const result = stampDraftLabel({
      specYaml: SAMPLE,
      origin: 'idea',
      confidence: 'low',
    });
    const parsed = yamlParse(result.specYaml) as Record<string, unknown>;
    const project = parsed['project'] as Record<string, unknown>;
    expect(project['name']).toBe('pomodoro-musicians');
    expect(project['summary']).toBe('25/5 timer for solo practice');
  });

  it('produces a hash stable under verbatim re-read', () => {
    const stamped = stampDraftLabel({
      specYaml: SAMPLE,
      origin: 'idea',
      confidence: 'medium',
    });
    expect(computeContentHash(stamped.specYaml)).toBe(stamped.contentHash);
  });

  it('rejects no-op modifications via specMatchesRecordedHash', () => {
    const stamped = stampDraftLabel({
      specYaml: SAMPLE,
      origin: 'plan_doc',
      confidence: 'high',
    });
    expect(specMatchesRecordedHash(stamped.specYaml)).toBe(true);
  });

  it('detects user edits via specMatchesRecordedHash', () => {
    const stamped = stampDraftLabel({
      specYaml: SAMPLE,
      origin: 'idea',
      confidence: 'medium',
    });
    // Mutate one field, leaving the hash field intact.
    const tampered = stamped.specYaml.replace(
      'pomodoro-musicians',
      'pomodoro-renamed',
    );
    expect(specMatchesRecordedHash(tampered)).toBe(false);
  });
});

describe('isDraft', () => {
  it('returns true after stamping', () => {
    const stamped = stampDraftLabel({
      specYaml: SAMPLE,
      origin: 'idea',
      confidence: 'low',
    });
    expect(isDraft(stamped.specYaml)).toBe(true);
  });

  it('returns false on a hand-authored spec with no metadata.draft', () => {
    expect(isDraft(SAMPLE)).toBe(false);
  });
});

describe('computeContentHash', () => {
  it('returns null-safe behavior on empty input', () => {
    expect(specMatchesRecordedHash('')).toBe(null);
  });

  it('returns null when content_hash is absent', () => {
    expect(specMatchesRecordedHash(SAMPLE)).toBe(null);
  });
});
