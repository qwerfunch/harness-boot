/**
 * Unit tests for `src/drive/goalStore.ts` (F-118).
 *
 * Coverage:
 *
 *   - nextGoalId pure-function semantics + collision avoidance.
 *   - normalizeSlug ASCII / mixed / Korean / collision-fallback paths.
 *   - readGoals on legacy specs (no `goals:` key) and v2.3.9 specs.
 *   - createGoal output shape + clock injection.
 *   - appendGoal round-trip + collision rejection.
 *   - archiveGoal sets timestamps + reason; rejects empty reason.
 *
 * Run via `npm run test:parity`.
 */

import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {beforeEach, describe, expect, it} from 'vitest';
import {parse as yamlParse, stringify as yamlStringify} from 'yaml';

import {
  appendGoal,
  archiveGoal,
  createGoal,
  nextGoalId,
  normalizeSlug,
  readGoals,
} from '../../src/drive/goalStore.js';

describe('drive/goalStore — nextGoalId', () => {
  it('returns G-001 on an empty list', () => {
    expect(nextGoalId([])).toBe('G-001');
  });

  it('skips non-G entries', () => {
    expect(nextGoalId(['F-001', 'BR-014', 'whatever'])).toBe('G-001');
  });

  it('zero-pads to three digits', () => {
    expect(nextGoalId(['G-001', 'G-002'])).toBe('G-003');
  });

  it('ignores allocation gaps — monotonic', () => {
    expect(nextGoalId(['G-001', 'G-005'])).toBe('G-006');
  });

  it('handles four-digit ids correctly', () => {
    expect(nextGoalId(['G-099', 'G-100'])).toBe('G-101');
  });

  it('is order-independent', () => {
    expect(nextGoalId(['G-005', 'G-001', 'G-003'])).toBe('G-006');
  });
});

describe('drive/goalStore — normalizeSlug', () => {
  it('lowercases and hyphenates plain ASCII', () => {
    expect(normalizeSlug('Memo Sync Engine')).toBe('memo-sync-engine');
  });

  it('strips disallowed characters', () => {
    expect(normalizeSlug('Sync, with backups!')).toBe('sync-with-backups');
  });

  it('collapses runs of hyphens', () => {
    expect(normalizeSlug('a   b   c')).toBe('a-b-c');
  });

  it('truncates over-long slugs to 60 chars', () => {
    const out = normalizeSlug('x'.repeat(80));
    expect(out.length).toBe(60);
    expect(out).toBe('x'.repeat(60));
  });

  it('falls back to goal-<hash> when title is fully non-ASCII', () => {
    const out = normalizeSlug('메모 동기화 기능');
    expect(out).toMatch(/^goal-[0-9a-f]{8}$/);
  });

  it('falls back deterministically — same title yields the same hash', () => {
    expect(normalizeSlug('한글만')).toBe(normalizeSlug('한글만'));
  });

  it('uses ASCII path when title is ASCII even if mixed with whitespace edge cases', () => {
    expect(normalizeSlug('  hello-world  ')).toBe('hello-world');
  });

  it('gracefully handles empty strings (falls back to a hash)', () => {
    expect(normalizeSlug('')).toMatch(/^goal-[0-9a-f]{8}$/);
  });
});

describe('drive/goalStore — readGoals', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'drive-goalstore-'));
  });

  it('returns [] when goals key is absent (legacy spec)', () => {
    const path = join(tmp, 'spec.yaml');
    writeFileSync(path, 'version: "2.3.8"\nfeatures: []\n');
    expect(readGoals(path)).toEqual([]);
  });

  it('returns [] on malformed yaml root', () => {
    const path = join(tmp, 'spec.yaml');
    writeFileSync(path, '- not\n- a\n- mapping\n');
    expect(readGoals(path)).toEqual([]);
  });

  it('parses a v2.3.9 goals[] block', () => {
    const path = join(tmp, 'spec.yaml');
    writeFileSync(
      path,
      yamlStringify({
        version: '2.3.9',
        features: [],
        goals: [
          {id: 'G-001', slug: 'memo-sync', title: 'Memo Sync', feature_ids: ['F-118']},
          {id: 'G-002', slug: 'auth', title: 'Auth', feature_ids: []},
        ],
      }),
    );
    const goals = readGoals(path);
    expect(goals).toHaveLength(2);
    expect(goals[0]).toMatchObject({id: 'G-001', slug: 'memo-sync', title: 'Memo Sync'});
    expect(goals[0]?.feature_ids).toEqual(['F-118']);
  });

  it('drops malformed entries (missing id) instead of throwing', () => {
    const path = join(tmp, 'spec.yaml');
    writeFileSync(
      path,
      yamlStringify({
        goals: [
          {id: 'G-001', title: 'good', feature_ids: []},
          {title: 'no id', feature_ids: []},
          'not even a mapping',
        ],
      }),
    );
    const goals = readGoals(path);
    expect(goals).toHaveLength(1);
    expect(goals[0]?.id).toBe('G-001');
  });

  it('synthesizes slug when missing on disk', () => {
    const path = join(tmp, 'spec.yaml');
    writeFileSync(
      path,
      yamlStringify({goals: [{id: 'G-001', title: 'Hello World', feature_ids: []}]}),
    );
    expect(readGoals(path)[0]?.slug).toBe('hello-world');
  });
});

describe('drive/goalStore — createGoal / appendGoal / archiveGoal', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'drive-goalstore-mut-'));
  });

  it('createGoal allocates the next id and stamps created_at', () => {
    const goal = createGoal(
      {title: 'Memo Sync', description: 'sync notes across devices', now: new Date('2026-05-04T10:00:00Z')},
      ['G-001'],
    );
    expect(goal.id).toBe('G-002');
    expect(goal.slug).toBe('memo-sync');
    expect(goal.title).toBe('Memo Sync');
    expect(goal.description).toBe('sync notes across devices');
    expect(goal.feature_ids).toEqual([]);
    expect(goal.created_at).toBe('2026-05-04T10:00:00Z');
    expect(goal.archived_at).toBeNull();
  });

  it('createGoal omits description when input.description is empty', () => {
    const goal = createGoal({title: 'X'}, []);
    expect('description' in goal).toBe(false);
  });

  it('appendGoal round-trips into the spec', () => {
    const path = join(tmp, 'spec.yaml');
    writeFileSync(path, yamlStringify({version: '2.3.9', features: [], goals: []}));
    const goal = createGoal({title: 'Memo Sync'}, []);
    appendGoal(path, goal);
    const reload = readGoals(path);
    expect(reload).toHaveLength(1);
    expect(reload[0]?.id).toBe(goal.id);
    expect(reload[0]?.title).toBe('Memo Sync');
  });

  it('appendGoal rejects id collisions', () => {
    const path = join(tmp, 'spec.yaml');
    writeFileSync(path, yamlStringify({goals: [{id: 'G-001', title: 'X', feature_ids: []}]}));
    expect(() => appendGoal(path, {id: 'G-001', slug: 'x', title: 'X', feature_ids: []})).toThrow(
      /collision/,
    );
  });

  it('archiveGoal stamps archived_at + archive_reason', () => {
    const path = join(tmp, 'spec.yaml');
    writeFileSync(
      path,
      yamlStringify({
        goals: [{id: 'G-001', slug: 'x', title: 'X', feature_ids: []}],
      }),
    );
    archiveGoal(path, 'G-001', 'replaced by G-002', new Date('2026-06-01T00:00:00Z'));
    const out = yamlParse(readFileSync(path, 'utf-8')) as {goals: Array<Record<string, unknown>>};
    expect(out.goals[0]?.['archived_at']).toBe('2026-06-01T00:00:00Z');
    expect(out.goals[0]?.['archive_reason']).toBe('replaced by G-002');
  });

  it('archiveGoal rejects empty reasons', () => {
    const path = join(tmp, 'spec.yaml');
    writeFileSync(path, yamlStringify({goals: [{id: 'G-001', title: 'X', feature_ids: []}]}));
    expect(() => archiveGoal(path, 'G-001', '   ')).toThrow(/reason/);
  });

  it('archiveGoal rejects unknown goal ids', () => {
    const path = join(tmp, 'spec.yaml');
    writeFileSync(path, yamlStringify({goals: []}));
    expect(() => archiveGoal(path, 'G-999', 'whatever')).toThrow(/not found/);
  });

  it('appendGoal preserves features[] and other top-level keys', () => {
    const path = join(tmp, 'spec.yaml');
    writeFileSync(
      path,
      yamlStringify({
        version: '2.3.9',
        project: {name: 'p'},
        features: [{id: 'F-001'}],
      }),
    );
    appendGoal(path, {id: 'G-001', slug: 'x', title: 'X', feature_ids: []});
    const out = yamlParse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
    expect((out['features'] as Array<{id: string}>)[0]?.id).toBe('F-001');
    expect(out['project']).toEqual({name: 'p'});
  });
});
