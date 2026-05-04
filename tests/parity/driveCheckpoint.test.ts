/**
 * Unit tests for `src/drive/checkpoint.ts` (F-119).
 *
 * Coverage:
 *   - default shape constants (max_iterations / max_seconds)
 *   - save → load round-trip preserves all fields
 *   - load returns `null` when the file is absent
 *   - load tolerates partial / malformed yaml (defensive defaults)
 *   - clearCheckpoint is idempotent
 *   - appendProgress is append-only (line-by-line)
 *   - stopFileExists detects the emergency-pedal sigil
 *
 * Run via `npm run test:parity`.
 */

import {existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {beforeEach, describe, expect, it} from 'vitest';

import {
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MAX_SECONDS,
  appendProgress,
  checkpointPath,
  clearCheckpoint,
  defaultCheckpoint,
  goalArtifactDir,
  loadCheckpoint,
  progressLogPath,
  saveCheckpoint,
  stopFileExists,
  stopFilePath,
} from '../../src/drive/checkpoint.js';

describe('drive/checkpoint — defaults + paths', () => {
  it('exposes documented Phase B caps', () => {
    expect(DEFAULT_MAX_ITERATIONS).toBe(50);
    expect(DEFAULT_MAX_SECONDS).toBe(7200);
  });

  it('checkpointPath uses _workspace/drive/run.yaml', () => {
    expect(checkpointPath('/h')).toBe('/h/_workspace/drive/run.yaml');
  });

  it('progressLogPath uses _workspace/drive/progress.log', () => {
    expect(progressLogPath('/h')).toBe('/h/_workspace/drive/progress.log');
  });

  it('goalArtifactDir nests under _workspace/drive/goals/<G-NNN>/', () => {
    expect(goalArtifactDir('/h', 'G-001')).toBe('/h/_workspace/drive/goals/G-001');
  });

  it('stopFilePath points at _workspace/drive/STOP', () => {
    expect(stopFilePath('/h')).toBe('/h/_workspace/drive/STOP');
  });
});

describe('drive/checkpoint — defaultCheckpoint factory', () => {
  it('produces a planning-phase shape with empty plan + execute', () => {
    const ck = defaultCheckpoint('G-001', new Date('2026-05-04T10:00:00Z'));
    expect(ck.goal_id).toBe('G-001');
    expect(ck.phase).toBe('planning');
    expect(ck.plan.brief_approved).toBe(false);
    expect(ck.plan.plan_approved).toBe(false);
    expect(ck.plan.scaffolded_features).toEqual([]);
    expect(ck.execute.iteration).toBe(0);
    expect(ck.execute.elapsed_sec).toBe(0);
    expect(ck.execute.active_feature).toBeNull();
    expect(ck.execute.retry_counts).toEqual({});
    expect(ck.execute.max_iterations).toBe(DEFAULT_MAX_ITERATIONS);
    expect(ck.execute.max_seconds).toBe(DEFAULT_MAX_SECONDS);
    expect(ck.last_halt).toBeNull();
    expect(ck.created_at).toBe('2026-05-04T10:00:00Z');
    expect(ck.updated_at).toBe('2026-05-04T10:00:00Z');
  });
});

describe('drive/checkpoint — save / load round-trip', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'drive-ck-'));
  });

  it('returns null when no checkpoint file exists', () => {
    expect(loadCheckpoint(tmp)).toBeNull();
  });

  it('save → load preserves data shape', () => {
    const ck = defaultCheckpoint('G-001', new Date('2026-05-04T10:00:00Z'));
    ck.phase = 'executing';
    ck.execute.iteration = 12;
    ck.execute.active_feature = 'F-118';
    ck.execute.retry_counts = {'F-118': {gate_3: 2}};
    saveCheckpoint(tmp, ck, new Date('2026-05-04T11:00:00Z'));
    const reloaded = loadCheckpoint(tmp);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.goal_id).toBe('G-001');
    expect(reloaded?.phase).toBe('executing');
    expect(reloaded?.execute.iteration).toBe(12);
    expect(reloaded?.execute.active_feature).toBe('F-118');
    expect(reloaded?.execute.retry_counts['F-118']?.gate_3).toBe(2);
    expect(reloaded?.updated_at).toBe('2026-05-04T11:00:00Z'); // saveCheckpoint stamps updated_at
  });

  it('load returns null when goal_id is missing (malformed)', () => {
    const path = checkpointPath(tmp);
    mkdirSync(join(tmp, '_workspace', 'drive'), {recursive: true});
    writeFileSync(path, 'phase: planning\n');
    expect(loadCheckpoint(tmp)).toBeNull();
  });

  it('load tolerates a checkpoint that omits the plan/execute sub-objects', () => {
    const path = checkpointPath(tmp);
    mkdirSync(join(tmp, '_workspace', 'drive'), {recursive: true});
    writeFileSync(path, 'goal_id: G-001\nphase: planning\n');
    const ck = loadCheckpoint(tmp);
    expect(ck).not.toBeNull();
    expect(ck?.plan.brief_approved).toBe(false);
    expect(ck?.execute.iteration).toBe(0);
  });
});

describe('drive/checkpoint — clear + progress + STOP', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'drive-ck-'));
  });

  it('clearCheckpoint returns false when nothing exists', () => {
    expect(clearCheckpoint(tmp)).toBe(false);
  });

  it('clearCheckpoint removes the file when present', () => {
    saveCheckpoint(tmp, defaultCheckpoint('G-001'));
    expect(existsSync(checkpointPath(tmp))).toBe(true);
    expect(clearCheckpoint(tmp)).toBe(true);
    expect(existsSync(checkpointPath(tmp))).toBe(false);
  });

  it('appendProgress appends one line per call', () => {
    appendProgress(tmp, 'first');
    appendProgress(tmp, 'second\n'); // pre-newlined
    appendProgress(tmp, 'third');
    const contents = readFileSync(progressLogPath(tmp), 'utf-8');
    expect(contents.split('\n').filter((l) => l.length > 0)).toEqual(['first', 'second', 'third']);
  });

  it('stopFileExists detects the STOP sigil', () => {
    expect(stopFileExists(tmp)).toBe(false);
    mkdirSync(join(tmp, '_workspace', 'drive'), {recursive: true});
    writeFileSync(stopFilePath(tmp), '');
    expect(stopFileExists(tmp)).toBe(true);
  });

  it('saveCheckpoint creates _workspace/drive/ lazily', () => {
    expect(existsSync(join(tmp, '_workspace', 'drive'))).toBe(false);
    saveCheckpoint(tmp, defaultCheckpoint('G-001'));
    expect(statSync(join(tmp, '_workspace', 'drive')).isDirectory()).toBe(true);
  });
});
