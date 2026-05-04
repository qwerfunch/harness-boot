/**
 * Unit tests for `src/drive/halt.ts` + `src/drive/goalRetro.ts` (F-119).
 *
 * Coverage:
 *   - HALT_REASON_INDEX exhausts the HaltReason union
 *   - emitHalt records to checkpoint + progress.log + events.log
 *   - emitHalt is fail-open when no checkpoint exists
 *   - renderHaltMessage produces a "next step" hint per reason
 *   - generateGoalRetro is **idempotent** (AC-6) — second call without
 *     force returns created:false and does not duplicate the
 *     goal_retro_written event
 *   - generateGoalRetro composes machine sections from spec + state +
 *     progress.log + checkpoint
 *
 * Run via `npm run test:parity`.
 */

import {existsSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {beforeEach, describe, expect, it} from 'vitest';
import {stringify as yamlStringify} from 'yaml';

import {
  appendProgress,
  defaultCheckpoint,
  loadCheckpoint,
  saveCheckpoint,
} from '../../src/drive/checkpoint.js';
import {
  HALT_REASON_INDEX,
  emitHalt,
  renderHaltMessage,
} from '../../src/drive/halt.js';
import {
  generateGoalRetro,
  goalRetroPath,
} from '../../src/drive/goalRetro.js';

describe('drive/halt — HALT_REASON_INDEX', () => {
  it('covers every HaltReason union member', () => {
    const expected = [
      'plan_phase_approval',
      'commit_boundary',
      'retry_threshold',
      'drift_severity_error',
      'feature_blocked',
      'wall_clock',
      'iteration_cap',
      'network_failure',
      'stop_file',
      'manual',
    ];
    for (const reason of expected) {
      expect(HALT_REASON_INDEX[reason as keyof typeof HALT_REASON_INDEX]).toBeDefined();
    }
  });

  it('numbers halts #1..#9 (manual is #0)', () => {
    const ns = [
      HALT_REASON_INDEX.plan_phase_approval.n,
      HALT_REASON_INDEX.commit_boundary.n,
      HALT_REASON_INDEX.retry_threshold.n,
      HALT_REASON_INDEX.drift_severity_error.n,
      HALT_REASON_INDEX.feature_blocked.n,
      HALT_REASON_INDEX.wall_clock.n,
      HALT_REASON_INDEX.iteration_cap.n,
      HALT_REASON_INDEX.network_failure.n,
      HALT_REASON_INDEX.stop_file.n,
    ];
    expect(ns).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(HALT_REASON_INDEX.manual.n).toBe(0);
  });
});

describe('drive/halt — emitHalt', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'drive-halt-'));
  });

  it('records into checkpoint.last_halt + progress.log + events.log when checkpoint exists', () => {
    saveCheckpoint(tmp, defaultCheckpoint('G-001'));
    const e = emitHalt(tmp, 'commit_boundary', 'commit then resume', {
      feature_id: 'F-118',
      iteration: 5,
      now: new Date('2026-05-04T10:00:00Z'),
    });
    expect(e.reason).toBe('commit_boundary');

    const ck = loadCheckpoint(tmp);
    expect(ck?.last_halt).toEqual({
      reason: 'commit_boundary',
      message: 'commit then resume',
      ts: '2026-05-04T10:00:00Z',
    });
    expect(ck?.execute.iteration).toBe(5);
    expect(ck?.execute.active_feature).toBe('F-118');

    const progress = readFileSync(join(tmp, '_workspace', 'drive', 'progress.log'), 'utf-8');
    expect(progress).toContain('HALT #2 gate_4 commit boundary · F-118');

    const eventsLog = readFileSync(join(tmp, 'events.log'), 'utf-8');
    expect(eventsLog).toContain('"type":"drive_halted"');
    expect(eventsLog).toContain('"reason":"commit_boundary"');
    expect(eventsLog).toContain('"halt_n":2');
    expect(eventsLog).toContain('"feature_id":"F-118"');
  });

  it('is fail-open when no checkpoint exists — still writes progress.log + events.log', () => {
    const e = emitHalt(tmp, 'manual', 'no checkpoint scenario', {
      goal_id: 'G-999',
      now: new Date('2026-05-04T11:00:00Z'),
    });
    expect(e.reason).toBe('manual');
    expect(existsSync(join(tmp, '_workspace', 'drive', 'progress.log'))).toBe(true);
    expect(existsSync(join(tmp, 'events.log'))).toBe(true);
  });

  it('renderHaltMessage produces a next-step hint per reason', () => {
    const e1 = emitHalt(tmp, 'commit_boundary', 'm');
    expect(renderHaltMessage(e1)).toMatch(/git commit/);
    const e2 = emitHalt(tmp, 'retry_threshold', 'm');
    expect(renderHaltMessage(e2)).toMatch(/failing gate/);
    const e3 = emitHalt(tmp, 'stop_file', 'm');
    expect(renderHaltMessage(e3)).toMatch(/STOP/);
  });
});

describe('drive/goalRetro — generateGoalRetro', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'drive-retro-'));
    // Seed spec.yaml with a Goal + features.
    writeFileSync(
      join(tmp, 'spec.yaml'),
      yamlStringify({
        version: '2.3.9',
        features: [
          {id: 'F-118', name: 'goal primitives'},
          {id: 'F-119', name: 'drive loop'},
        ],
        goals: [
          {id: 'G-001', slug: 'memo', title: 'Memo Sync', feature_ids: ['F-118', 'F-119']},
        ],
      }),
    );
    // Seed state.yaml with both features done + the Goal completed.
    writeFileSync(
      join(tmp, 'state.yaml'),
      yamlStringify({
        version: '2.3',
        schema_version: '2.3',
        features: [
          {
            id: 'F-118',
            status: 'done',
            gates: {gate_3: {last_result: 'fail'}, gate_5: {last_result: 'pass'}},
            evidence: [],
            started_at: '2026-05-04T10:00:00Z',
            completed_at: '2026-05-04T11:00:00Z',
          },
          {
            id: 'F-119',
            status: 'done',
            gates: {gate_5: {last_result: 'pass'}},
            evidence: [],
            started_at: '2026-05-04T11:00:00Z',
            completed_at: '2026-05-04T12:30:00Z',
          },
        ],
        session: {
          started_at: null,
          last_command: '',
          last_gate_passed: null,
          active_feature_id: null,
          active_goal_id: null,
        },
        goals: [
          {
            id: 'G-001',
            status: 'done',
            started_at: '2026-05-04T10:00:00Z',
            completed_at: '2026-05-04T12:30:00Z',
            iteration: 14,
            elapsed_sec: 9000,
            feature_progress: {'F-118': 'done', 'F-119': 'done'},
            last_halt_reason: null,
          },
        ],
      }),
    );
    // Seed checkpoint + a few halt entries in progress.log.
    const ck = defaultCheckpoint('G-001');
    ck.phase = 'executing';
    ck.execute.iteration = 14;
    ck.execute.elapsed_sec = 9000;
    ck.execute.started_at = '2026-05-04T10:00:00Z';
    ck.plan.scaffolded_features = ['F-118', 'F-119'];
    saveCheckpoint(tmp, ck);
    appendProgress(tmp, '2026-05-04T10:30:00Z HALT #2 gate_4 commit boundary · F-118: commit needed');
    appendProgress(tmp, '2026-05-04T10:50:00Z HALT #3 gate retry threshold · F-118 · gate_3: 3 fails');
    appendProgress(tmp, '2026-05-04T11:20:00Z HALT #2 gate_4 commit boundary · F-119: commit needed');
  });

  it('writes the retro on first call with machine sections', () => {
    const r = generateGoalRetro(tmp, 'G-001');
    expect(r.created).toBe(true);
    expect(r.feature_count).toBe(2);
    expect(r.halt_count).toBe(3);
    expect(existsSync(goalRetroPath(tmp, 'G-001'))).toBe(true);
    const text = readFileSync(goalRetroPath(tmp, 'G-001'), 'utf-8');
    expect(text).toContain('# Goal Retro — G-001 · Memo Sync');
    expect(text).toContain('## Goal summary');
    expect(text).toContain('## Feature breakdown');
    expect(text).toContain('## Halt log');
    expect(text).toContain('Total halts: **3**');
    expect(text).toContain('| F-118 | done | gate_3 ');
    expect(text).toContain('| F-119 | done | — '); // no failed gate
    expect(text).toContain('## Reviewer Reflection');
    expect(text).toContain('## Copy Polish');
    expect(text).toContain('_(pending');
  });

  it('AC-6 — second call without force returns created:false and does not overwrite', () => {
    const first = generateGoalRetro(tmp, 'G-001');
    const before = readFileSync(goalRetroPath(tmp, 'G-001'), 'utf-8');
    const second = generateGoalRetro(tmp, 'G-001');
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    const after = readFileSync(goalRetroPath(tmp, 'G-001'), 'utf-8');
    expect(after).toBe(before);
  });

  it('does not duplicate goal_retro_written events when called twice', () => {
    generateGoalRetro(tmp, 'G-001');
    generateGoalRetro(tmp, 'G-001');
    const events = readFileSync(join(tmp, 'events.log'), 'utf-8');
    const matches = events.match(/"type":"goal_retro_written"/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('force=true regenerates the retro file', () => {
    generateGoalRetro(tmp, 'G-001');
    const second = generateGoalRetro(tmp, 'G-001', {force: true});
    expect(second.created).toBe(true);
  });

  it('throws when the goal is not in spec.yaml', () => {
    expect(() => generateGoalRetro(tmp, 'G-999')).toThrow(/G-999/);
  });
});
