/**
 * Parity test for `src/spec/archive.ts` (F-132).
 *
 * Covers:
 *
 *   - `moveToArchive()` extracts `description` + `acceptance_criteria`
 *     from the live spec.yaml entry, appends them to
 *     `<harnessDir>/spec.archive.yaml` under the same id, and rewrites
 *     the live spec with those two keys removed (only those two —
 *     other keys preserved verbatim).
 *   - Idempotent on a second call (no body to move; archive entry
 *     unchanged; live spec byte-equal).
 *   - Creates `spec.archive.yaml` when absent; appends when present.
 *
 * Run via `npm run test:parity`.
 */

import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {parse as yamlParse, stringify as yamlStringify} from 'yaml';

import {
  autoArchiveOpenQuestions,
  bulkMigrate,
  moveToArchive,
} from '../../src/spec/archive.js';

interface Workspace {
  dir: string;
  harness: string;
}

function makeSpecFixture(): Record<string, unknown> {
  return {
    version: '2.3',
    schema_version: '2.3',
    project: {name: 'archive-test', summary: 'fixture', mode: 'prototype'},
    domain: {one_liner: 'fixture'},
    features: [
      {
        id: 'F-001',
        name: 'walking skeleton',
        type: 'skeleton',
        area: 'core',
        description: 'Boot the system end-to-end.\nSecond paragraph.',
        acceptance_criteria: ['AC-1: hello-world endpoint returns 200.'],
      },
      {
        id: 'F-002',
        name: 'archived candidate',
        type: 'feature',
        ui_surface: {present: false},
        digest: 'one-liner about F-002',
        description: 'F-002 description body.',
        acceptance_criteria: ['AC-1: alpha.', 'AC-2: beta.'],
      },
    ],
  };
}

function makeWorkspace(): Workspace {
  const dir = mkdtempSync(join(tmpdir(), 'archive-'));
  const harness = join(dir, '.harness');
  mkdirSync(harness, {recursive: true});
  writeFileSync(join(harness, 'spec.yaml'), yamlStringify(makeSpecFixture()), 'utf-8');
  return {dir, harness};
}

function readLiveFeature(harness: string, fid: string): Record<string, unknown> {
  const spec = yamlParse(readFileSync(join(harness, 'spec.yaml'), 'utf-8')) as {
    features: Array<Record<string, unknown>>;
  };
  return spec.features.find((f) => f['id'] === fid)!;
}

function readArchive(harness: string): Record<string, unknown> | null {
  const path = join(harness, 'spec.archive.yaml');
  if (!existsSync(path)) {
    return null;
  }
  return yamlParse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
}

describe('moveToArchive — body extraction', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('removes description + acceptance_criteria from the live entry', () => {
    moveToArchive(ws.harness, 'F-002');
    const live = readLiveFeature(ws.harness, 'F-002');
    expect(live['description']).toBeUndefined();
    expect(live['acceptance_criteria']).toBeUndefined();
  });

  it('preserves every other meta key verbatim', () => {
    moveToArchive(ws.harness, 'F-002');
    const live = readLiveFeature(ws.harness, 'F-002');
    expect(live['id']).toBe('F-002');
    expect(live['name']).toBe('archived candidate');
    expect(live['type']).toBe('feature');
    expect(live['digest']).toBe('one-liner about F-002');
    expect(live['ui_surface']).toEqual({present: false});
  });

  it('does not touch other features', () => {
    moveToArchive(ws.harness, 'F-002');
    const f001 = readLiveFeature(ws.harness, 'F-001');
    expect(f001['description']).toBe('Boot the system end-to-end.\nSecond paragraph.');
    expect(f001['acceptance_criteria']).toEqual(['AC-1: hello-world endpoint returns 200.']);
  });
});

describe('moveToArchive — archive file shape', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('creates spec.archive.yaml when absent and writes top-level shape', () => {
    expect(existsSync(join(ws.harness, 'spec.archive.yaml'))).toBe(false);
    moveToArchive(ws.harness, 'F-002');
    const archive = readArchive(ws.harness);
    expect(archive).not.toBeNull();
    expect(archive!['version']).toBeDefined();
    expect(archive!['schema_version']).toBeDefined();
    expect(Array.isArray(archive!['features'])).toBe(true);
  });

  it('writes the moved feature with id + body keys only', () => {
    moveToArchive(ws.harness, 'F-002');
    const archive = readArchive(ws.harness);
    const features = archive!['features'] as Array<Record<string, unknown>>;
    expect(features.length).toBe(1);
    const f002 = features.find((f) => f['id'] === 'F-002')!;
    expect(f002['id']).toBe('F-002');
    expect(f002['description']).toBe('F-002 description body.');
    expect(f002['acceptance_criteria']).toEqual(['AC-1: alpha.', 'AC-2: beta.']);
  });

  it('appends a second feature without losing the first', () => {
    moveToArchive(ws.harness, 'F-002');
    moveToArchive(ws.harness, 'F-001');
    const archive = readArchive(ws.harness);
    const features = archive!['features'] as Array<Record<string, unknown>>;
    expect(features.length).toBe(2);
    expect(features.map((f) => f['id'])).toEqual(['F-002', 'F-001']);
  });
});

describe('moveToArchive — idempotent', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('second call leaves live spec.yaml byte-identical', () => {
    moveToArchive(ws.harness, 'F-002');
    const after1 = readFileSync(join(ws.harness, 'spec.yaml'), 'utf-8');
    moveToArchive(ws.harness, 'F-002');
    const after2 = readFileSync(join(ws.harness, 'spec.yaml'), 'utf-8');
    expect(after2).toBe(after1);
  });

  it('second call leaves the archive entry unchanged when body has not changed', () => {
    moveToArchive(ws.harness, 'F-002');
    const archive1 = JSON.stringify(readArchive(ws.harness));
    moveToArchive(ws.harness, 'F-002');
    const archive2 = JSON.stringify(readArchive(ws.harness));
    expect(archive2).toBe(archive1);
  });

  it('rewrites archive entry when the live body has changed before re-archiving', () => {
    moveToArchive(ws.harness, 'F-002');
    // Caller mutates the live spec entry to put new body back, then re-archives.
    const spec = yamlParse(readFileSync(join(ws.harness, 'spec.yaml'), 'utf-8')) as {
      features: Array<Record<string, unknown>>;
    };
    const f002 = spec.features.find((f) => f['id'] === 'F-002')!;
    f002['description'] = 'updated body';
    f002['acceptance_criteria'] = ['AC-1: new criterion.'];
    writeFileSync(join(ws.harness, 'spec.yaml'), yamlStringify(spec), 'utf-8');
    moveToArchive(ws.harness, 'F-002');
    const archive = readArchive(ws.harness);
    const archived = (archive!['features'] as Array<Record<string, unknown>>).find(
      (f) => f['id'] === 'F-002',
    )!;
    expect(archived['description']).toBe('updated body');
    expect(archived['acceptance_criteria']).toEqual(['AC-1: new criterion.']);
  });
});

describe('moveToArchive — no-op safety', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('returns silently when the feature id is absent from the live spec', () => {
    expect(() => moveToArchive(ws.harness, 'F-999')).not.toThrow();
    expect(existsSync(join(ws.harness, 'spec.archive.yaml'))).toBe(false);
  });

  it('returns silently when the live spec has neither description nor acceptance_criteria', () => {
    const spec = yamlParse(readFileSync(join(ws.harness, 'spec.yaml'), 'utf-8')) as {
      features: Array<Record<string, unknown>>;
    };
    const f002 = spec.features.find((f) => f['id'] === 'F-002')!;
    delete f002['description'];
    delete f002['acceptance_criteria'];
    writeFileSync(join(ws.harness, 'spec.yaml'), yamlStringify(spec), 'utf-8');
    expect(() => moveToArchive(ws.harness, 'F-002')).not.toThrow();
    // Archive should not be created when there is nothing to move.
    expect(existsSync(join(ws.harness, 'spec.archive.yaml'))).toBe(false);
  });
});

describe('bulkMigrate (F-137)', () => {
  let ws: Workspace;

  function writeStateWithDoneIds(harness: string, doneIds: string[]): void {
    const state = {
      version: '2.3',
      schema_version: '2.3',
      features: doneIds.map((id) => ({id, status: 'done', evidence: [], gates: {}})),
      session: {
        started_at: null,
        last_command: '',
        last_gate_passed: null,
        active_feature_id: null,
      },
    };
    writeFileSync(join(harness, 'state.yaml'), yamlStringify(state), 'utf-8');
  }

  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('relocates every done feature body in one pass and returns the count', () => {
    writeStateWithDoneIds(ws.harness, ['F-001', 'F-002']);
    const moved = bulkMigrate(ws.harness);
    expect(moved).toBe(2);
    const liveF001 = readLiveFeature(ws.harness, 'F-001');
    expect(liveF001['description']).toBeUndefined();
    expect(liveF001['acceptance_criteria']).toBeUndefined();
    const liveF002 = readLiveFeature(ws.harness, 'F-002');
    expect(liveF002['description']).toBeUndefined();
    expect(liveF002['acceptance_criteria']).toBeUndefined();
    const archive = readArchive(ws.harness);
    const archiveIds = (archive!['features'] as Array<Record<string, unknown>>).map(
      (f) => f['id'],
    );
    expect(archiveIds.sort()).toEqual(['F-001', 'F-002']);
  });

  it('skips features whose state status is in_progress (only done ids count)', () => {
    // F-001 done, F-002 in_progress.
    const state = {
      version: '2.3',
      schema_version: '2.3',
      features: [
        {id: 'F-001', status: 'done', evidence: [], gates: {}},
        {id: 'F-002', status: 'in_progress', evidence: [], gates: {}},
      ],
      session: {
        started_at: null,
        last_command: '',
        last_gate_passed: null,
        active_feature_id: 'F-002',
      },
    };
    writeFileSync(join(ws.harness, 'state.yaml'), yamlStringify(state), 'utf-8');
    const moved = bulkMigrate(ws.harness);
    expect(moved).toBe(1);
    const liveF002 = readLiveFeature(ws.harness, 'F-002');
    // F-002 still has its body intact (active feature, no migration).
    expect(liveF002['description']).toBe('F-002 description body.');
  });

  it('idempotent — second call moves nothing and leaves spec.yaml byte-identical', () => {
    writeStateWithDoneIds(ws.harness, ['F-001', 'F-002']);
    bulkMigrate(ws.harness);
    const after1 = readFileSync(join(ws.harness, 'spec.yaml'), 'utf-8');
    const moved2 = bulkMigrate(ws.harness);
    expect(moved2).toBe(0);
    const after2 = readFileSync(join(ws.harness, 'spec.yaml'), 'utf-8');
    expect(after2).toBe(after1);
  });

  it('returns 0 when state.yaml is missing', () => {
    // No state.yaml in the workspace at all.
    expect(bulkMigrate(ws.harness)).toBe(0);
    expect(existsSync(join(ws.harness, 'spec.archive.yaml'))).toBe(false);
  });

  it('returns 0 when state.yaml has no done features', () => {
    writeStateWithDoneIds(ws.harness, []);
    expect(bulkMigrate(ws.harness)).toBe(0);
  });
});

/**
 * F-145 — auto-digest backfill on `moveToArchive`.
 *
 * The live entry should grow a `digest` derived from `description`
 * before the body moves out, but only when the entry has no `digest`
 * already (user-authored values win).
 */
describe('moveToArchive — F-145 auto-digest', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('backfills `digest` from description when none is present', () => {
    moveToArchive(ws.harness, 'F-001');
    const spec = yamlParse(
      readFileSync(join(ws.harness, 'spec.yaml'), 'utf-8'),
    ) as Record<string, unknown>;
    const live = (spec['features'] as Array<Record<string, unknown>>).find(
      (f) => f['id'] === 'F-001',
    )!;
    expect(typeof live['digest']).toBe('string');
    // Description had a newline; whitespace must be condensed.
    expect(live['digest']).toBe('Boot the system end-to-end. Second paragraph.');
    // And the body keys are gone.
    expect(live['description']).toBeUndefined();
    expect(live['acceptance_criteria']).toBeUndefined();
  });

  it('respects an existing digest (does not overwrite)', () => {
    moveToArchive(ws.harness, 'F-002');
    const spec = yamlParse(
      readFileSync(join(ws.harness, 'spec.yaml'), 'utf-8'),
    ) as Record<string, unknown>;
    const live = (spec['features'] as Array<Record<string, unknown>>).find(
      (f) => f['id'] === 'F-002',
    )!;
    // F-002 fixture already had digest = 'one-liner about F-002'.
    expect(live['digest']).toBe('one-liner about F-002');
  });

  it('caps digest at 120 chars with an ellipsis when description is longer', () => {
    // Augment fixture with a long-description feature.
    const spec = yamlParse(readFileSync(join(ws.harness, 'spec.yaml'), 'utf-8')) as Record<
      string,
      unknown
    >;
    const features = spec['features'] as Array<Record<string, unknown>>;
    const longText = 'a'.repeat(200);
    features.push({
      id: 'F-099',
      name: 'long',
      type: 'feature',
      description: longText,
    });
    writeFileSync(join(ws.harness, 'spec.yaml'), yamlStringify(spec), 'utf-8');

    moveToArchive(ws.harness, 'F-099');
    const after = yamlParse(readFileSync(join(ws.harness, 'spec.yaml'), 'utf-8')) as Record<
      string,
      unknown
    >;
    const live = (after['features'] as Array<Record<string, unknown>>).find(
      (f) => f['id'] === 'F-099',
    )!;
    const digest = live['digest'] as string;
    expect(digest.length).toBe(120);
    expect(digest.endsWith('...')).toBe(true);
  });

  it('leaves digest absent when the entry has no description and no AC', () => {
    // Insert an empty-body entry; moveToArchive should be a no-op.
    const spec = yamlParse(readFileSync(join(ws.harness, 'spec.yaml'), 'utf-8')) as Record<
      string,
      unknown
    >;
    const features = spec['features'] as Array<Record<string, unknown>>;
    features.push({id: 'F-088', name: 'empty', type: 'feature'});
    writeFileSync(join(ws.harness, 'spec.yaml'), yamlStringify(spec), 'utf-8');

    moveToArchive(ws.harness, 'F-088');
    const after = yamlParse(readFileSync(join(ws.harness, 'spec.yaml'), 'utf-8')) as Record<
      string,
      unknown
    >;
    const live = (after['features'] as Array<Record<string, unknown>>).find(
      (f) => f['id'] === 'F-088',
    )!;
    expect(live['digest']).toBeUndefined();
  });
});

/**
 * F-147 — auto-archive of resolved open_questions older than the cool-down
 * window (default 30 days).
 */
describe('autoArchiveOpenQuestions — F-147', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  function seedOpenQuestions(entries: Array<Record<string, unknown>>): void {
    const spec = yamlParse(readFileSync(join(ws.harness, 'spec.yaml'), 'utf-8')) as Record<
      string,
      unknown
    >;
    spec['open_questions'] = entries;
    writeFileSync(join(ws.harness, 'spec.yaml'), yamlStringify(spec), 'utf-8');
  }

  it('moves entries with answered_at older than 30 days into the archive', () => {
    const old = '2026-01-01T00:00:00Z';
    const recent = '2026-05-10T00:00:00Z';
    seedOpenQuestions([
      {id: 'OQ-1', title: 'old answered', status: 'answered', answered_at: old},
      {id: 'OQ-2', title: 'recent answered', status: 'answered', answered_at: recent},
      {id: 'OQ-3', title: 'still open'},
    ]);

    const moved = autoArchiveOpenQuestions(ws.harness, {
      now: new Date('2026-05-12T00:00:00Z'),
    });
    expect(moved).toBe(1);

    const spec = yamlParse(
      readFileSync(join(ws.harness, 'spec.yaml'), 'utf-8'),
    ) as Record<string, unknown>;
    const liveIds = (spec['open_questions'] as Array<Record<string, unknown>>).map(
      (q) => q['id'],
    );
    expect(liveIds).toEqual(['OQ-2', 'OQ-3']);

    const archive = yamlParse(
      readFileSync(join(ws.harness, 'spec.archive.yaml'), 'utf-8'),
    ) as Record<string, unknown>;
    const archivedIds = (archive['open_questions'] as Array<Record<string, unknown>>).map(
      (q) => q['id'],
    );
    expect(archivedIds).toEqual(['OQ-1']);
  });

  it('returns 0 when no entry is eligible (idempotent on a clean spec)', () => {
    seedOpenQuestions([{id: 'OQ-1', title: 'still open'}]);
    expect(autoArchiveOpenQuestions(ws.harness)).toBe(0);
    expect(existsSync(join(ws.harness, 'spec.archive.yaml'))).toBe(false);
  });

  it('upserts on the archive — second relocation of the same id replaces in place', () => {
    seedOpenQuestions([
      {
        id: 'OQ-1',
        title: 'first',
        status: 'answered',
        answered_at: '2026-01-01T00:00:00Z',
      },
    ]);
    autoArchiveOpenQuestions(ws.harness, {now: new Date('2026-05-12T00:00:00Z')});

    // Resurface the same id with a newer body, then re-archive.
    seedOpenQuestions([
      {
        id: 'OQ-1',
        title: 'second',
        status: 'answered',
        answered_at: '2026-01-01T00:00:00Z',
      },
    ]);
    autoArchiveOpenQuestions(ws.harness, {now: new Date('2026-05-12T00:00:00Z')});

    const archive = yamlParse(
      readFileSync(join(ws.harness, 'spec.archive.yaml'), 'utf-8'),
    ) as Record<string, unknown>;
    const oqs = archive['open_questions'] as Array<Record<string, unknown>>;
    expect(oqs.length).toBe(1);
    expect(oqs[0]['title']).toBe('second');
  });

  it('accepts resolved_at and closed_at as fallback timestamps', () => {
    seedOpenQuestions([
      {id: 'OQ-1', title: 'a', resolved_at: '2026-01-01T00:00:00Z'},
      {id: 'OQ-2', title: 'b', closed_at: '2026-01-01T00:00:00Z'},
      {id: 'OQ-3', title: 'c'},
    ]);
    const moved = autoArchiveOpenQuestions(ws.harness, {
      now: new Date('2026-05-12T00:00:00Z'),
    });
    expect(moved).toBe(2);
  });

  it('respects the ageDays cap — recent entries stay live', () => {
    seedOpenQuestions([
      {id: 'OQ-1', title: 'two days ago', answered_at: '2026-05-10T00:00:00Z'},
    ]);
    const moved = autoArchiveOpenQuestions(ws.harness, {
      now: new Date('2026-05-12T00:00:00Z'),
      ageDays: 30,
    });
    expect(moved).toBe(0);
  });

  it('returns 0 when spec.yaml is missing', () => {
    rmSync(join(ws.harness, 'spec.yaml'));
    expect(autoArchiveOpenQuestions(ws.harness)).toBe(0);
  });
});
