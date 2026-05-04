/**
 * Unit tests for `src/drive/{progressRenderer,statusCommand}.ts` (F-118).
 *
 * Coverage:
 *
 *   - renderProgress emoji / ASCII output stability across statuses.
 *   - renderProgressJson schema fields + percent_done math.
 *   - composeStatusText / composeStatusJson goal selection (active /
 *     explicit / --all / fallback / none-registered).
 *   - runDriveStatus CQS — state.yaml mtime invariant after a status
 *     read (BR-012).
 *   - State helpers — ensureGoal / setGoalStatus / setActiveGoal
 *     defaults plus legacy state.yaml backward compat (no `goals`
 *     key still loads).
 *
 * Run via `npm run test:parity`.
 */

import {existsSync, mkdirSync, mkdtempSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {beforeEach, describe, expect, it} from 'vitest';
import {stringify as yamlStringify} from 'yaml';

import {State} from '../../src/core/state.js';
import {
  renderProgress,
  renderProgressJson,
  type RenderInput,
} from '../../src/drive/progressRenderer.js';
import {
  composeStatusJson,
  composeStatusText,
  runDriveStatus,
} from '../../src/drive/statusCommand.js';
import type {GoalSpec} from '../../src/drive/types.js';

const goalSpec: GoalSpec = {
  id: 'G-001',
  slug: 'memo-sync',
  title: '메모 동기화',
  feature_ids: ['F-118', 'F-119'],
};

function makeFeature(
  id: string,
  status: 'planned' | 'in_progress' | 'done' | 'blocked',
  extras: Record<string, unknown> = {},
) {
  return {
    id,
    status,
    gates: {},
    evidence: [],
    started_at: null,
    completed_at: null,
    ...extras,
  } as unknown as Parameters<typeof renderProgress>[0]['features'][number];
}

describe('drive/progressRenderer — renderProgress', () => {
  it('renders an all-planned goal at 0%', () => {
    const out = renderProgress({
      goalSpec,
      goalRuntime: null,
      features: [makeFeature('F-118', 'planned'), makeFeature('F-119', 'planned')],
    });
    expect(out).toContain('Goal G-001: 메모 동기화 (0%)');
    expect(out).toContain('⚪ F-118');
    expect(out).toContain('⚪ F-119');
    expect(out).toContain('▶ now: idle');
  });

  it('renders one done + one in_progress at 50% with running gate', () => {
    const inflightFeature = makeFeature('F-119', 'in_progress', {
      gates: {
        gate_0: {last_result: 'pass', ts: '2026-05-04T10:00:00Z', note: ''},
        gate_1: {last_result: 'pass', ts: '2026-05-04T10:01:00Z', note: ''},
        gate_2: {last_result: 'pass', ts: '2026-05-04T10:02:00Z', note: ''},
      },
      started_at: '2026-05-04T10:00:00Z',
    });
    const out = renderProgress(
      {
        goalSpec,
        goalRuntime: {
          id: 'G-001',
          status: 'executing',
          started_at: '2026-05-04T10:00:00Z',
          completed_at: null,
          iteration: 12,
          elapsed_sec: 1923,
          feature_progress: {},
          last_halt_reason: null,
        },
        features: [makeFeature('F-118', 'done'), inflightFeature],
      },
      {now: new Date('2026-05-04T10:30:00Z')},
    );
    expect(out).toContain('(50%)');
    expect(out).toContain('✅ F-118');
    expect(out).toContain('🔵 F-119');
    expect(out).toContain('gate_3 running');
    expect(out).toContain('iteration 12');
    expect(out).toMatch(/elapsed/);
  });

  it('renders blocked features with the warning icon', () => {
    const out = renderProgress({
      goalSpec,
      goalRuntime: null,
      features: [makeFeature('F-118', 'blocked')],
    });
    expect(out).toContain('⚠ F-118');
  });

  it('uses ASCII fallback when emoji=false', () => {
    const out = renderProgress(
      {goalSpec, goalRuntime: null, features: [makeFeature('F-118', 'done')]},
      {emoji: false},
    );
    expect(out).toContain('[x] F-118');
    expect(out).toContain('## Goal G-001');
    expect(out).toContain('> now:');
  });

  it('is byte-stable across calls with identical input', () => {
    const input: RenderInput = {
      goalSpec,
      goalRuntime: null,
      features: [makeFeature('F-118', 'done'), makeFeature('F-119', 'planned')],
    };
    const opts = {now: new Date('2026-05-04T10:00:00Z')};
    expect(renderProgress(input, opts)).toBe(renderProgress(input, opts));
  });

  it('shows last halt reason in the footer when present', () => {
    const out = renderProgress({
      goalSpec,
      goalRuntime: {
        id: 'G-001',
        status: 'paused',
        started_at: null,
        completed_at: null,
        iteration: 7,
        elapsed_sec: 0,
        feature_progress: {},
        last_halt_reason: 'commit_boundary',
      },
      features: [makeFeature('F-118', 'in_progress')],
    });
    expect(out).toContain('last halt: commit_boundary');
  });
});

describe('drive/progressRenderer — renderProgressJson', () => {
  it('returns the documented schema fields', () => {
    const out = renderProgressJson({
      goalSpec,
      goalRuntime: null,
      features: [makeFeature('F-118', 'done'), makeFeature('F-119', 'planned')],
    });
    expect(out.goal_id).toBe('G-001');
    expect(out.title).toBe('메모 동기화');
    expect(out.percent_done).toBe(50);
    expect(out.iteration).toBe(0);
    expect(out.features).toHaveLength(2);
    expect(out.features[0]?.id).toBe('F-118');
    expect(out.features[0]?.status).toBe('done');
  });

  it('reports declared evidence count without counting gate_run kinds', () => {
    const f = makeFeature('F-118', 'done', {
      evidence: [
        {ts: '2026-05-04T10:00:00Z', kind: 'test', summary: 'unit'},
        {ts: '2026-05-04T10:01:00Z', kind: 'gate_run', summary: 'auto'},
        {ts: '2026-05-04T10:02:00Z', kind: 'gate_auto_run', summary: 'auto'},
        {ts: '2026-05-04T10:03:00Z', kind: 'manual_check', summary: 'reviewed'},
      ],
    });
    const out = renderProgressJson({goalSpec, goalRuntime: null, features: [f]});
    // 4 entries total, 2 declared (test + manual_check).
    expect(out.features[0]?.evidence_count).toBe(2);
  });
});

describe('drive/statusCommand — composeStatusText / composeStatusJson selection', () => {
  let tmp: string;
  let harnessDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'drive-status-'));
    harnessDir = join(tmp, '.harness');
    mkdirSync(harnessDir, {recursive: true});
    writeFileSync(
      join(harnessDir, 'spec.yaml'),
      yamlStringify({
        version: '2.3.9',
        features: [
          {id: 'F-118', name: 'goal primitives'},
          {id: 'F-200', name: 'unrelated'},
        ],
        goals: [
          {id: 'G-001', slug: 'memo', title: 'Memo Sync', feature_ids: ['F-118']},
          {id: 'G-002', slug: 'auth', title: 'Auth Flow', feature_ids: []},
        ],
      }),
    );
  });

  it('renders a clear empty-state message when no goals are registered', () => {
    writeFileSync(
      join(harnessDir, 'spec.yaml'),
      yamlStringify({version: '2.3.9', features: []}),
    );
    const state = State.load(harnessDir);
    const text = composeStatusText([], state, [], {harnessDir});
    expect(text).toContain('no goals registered yet');
  });

  it('falls back to the most recent goal when no active id is set', () => {
    const state = State.load(harnessDir);
    const text = composeStatusText(
      [
        {id: 'G-001', slug: 'memo', title: 'Memo Sync', feature_ids: ['F-118']},
        {id: 'G-002', slug: 'auth', title: 'Auth Flow', feature_ids: []},
      ],
      state,
      [],
      {harnessDir},
    );
    expect(text).toContain('G-002');
    expect(text).not.toContain('G-001');
  });

  it('prefers the explicit goalId option', () => {
    const state = State.load(harnessDir);
    state.setActiveGoal('G-002');
    const text = composeStatusText(
      [
        {id: 'G-001', slug: 'memo', title: 'Memo Sync', feature_ids: []},
        {id: 'G-002', slug: 'auth', title: 'Auth Flow', feature_ids: []},
      ],
      state,
      [],
      {harnessDir, goalId: 'G-001'},
    );
    expect(text).toContain('G-001');
    expect(text).not.toContain('G-002');
  });

  it('honors --all by emitting one block per goal', () => {
    const state = State.load(harnessDir);
    const text = composeStatusText(
      [
        {id: 'G-001', slug: 'memo', title: 'Memo', feature_ids: []},
        {id: 'G-002', slug: 'auth', title: 'Auth', feature_ids: []},
      ],
      state,
      [],
      {harnessDir, all: true},
    );
    expect(text).toContain('G-001');
    expect(text).toContain('G-002');
    expect(text.split('Goal G-')).toHaveLength(3);
  });

  it('composeStatusJson returns a stable shape', () => {
    const state = State.load(harnessDir);
    const out = composeStatusJson(
      [{id: 'G-001', slug: 'memo', title: 'Memo', feature_ids: ['F-118']}],
      state,
      [{id: 'F-118', name: 'goal primitives'}],
      {harnessDir, goalId: 'G-001'},
    );
    expect(out.goals).toHaveLength(1);
    expect(out.goals[0]?.goal_id).toBe('G-001');
    expect(out.goals[0]?.features[0]?.id).toBe('F-118');
  });
});

describe('drive/statusCommand — runDriveStatus CQS (BR-012)', () => {
  let tmp: string;
  let harnessDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'drive-cqs-'));
    harnessDir = join(tmp, '.harness');
    mkdirSync(harnessDir, {recursive: true});
    writeFileSync(
      join(harnessDir, 'spec.yaml'),
      yamlStringify({
        version: '2.3.9',
        features: [{id: 'F-118', name: 'goal primitives'}],
        goals: [{id: 'G-001', slug: 'memo', title: 'Memo', feature_ids: ['F-118']}],
      }),
    );
    // Seed state.yaml so the CQS test has a meaningful baseline.
    writeFileSync(
      join(harnessDir, 'state.yaml'),
      yamlStringify({
        version: '2.3',
        schema_version: '2.3',
        features: [
          {id: 'F-118', status: 'in_progress', gates: {}, evidence: [], started_at: '2026-05-04T10:00:00Z', completed_at: null},
        ],
        session: {started_at: null, last_command: '', last_gate_passed: null, active_feature_id: 'F-118', active_goal_id: 'G-001'},
        goals: [
          {id: 'G-001', status: 'executing', started_at: '2026-05-04T10:00:00Z', completed_at: null, iteration: 5, elapsed_sec: 600, feature_progress: {'F-118': 'in_progress'}, last_halt_reason: null},
        ],
      }),
    );
  });

  it('preserves state.yaml mtime after --status', async () => {
    const statePath = join(harnessDir, 'state.yaml');
    const beforeMtime = statSync(statePath).mtimeMs;
    let captured = '';
    await runDriveStatus({harnessDir, json: true, out: (s) => (captured += s)});
    const afterMtime = statSync(statePath).mtimeMs;
    expect(afterMtime).toBe(beforeMtime);
    expect(captured).toContain('"goal_id": "G-001"');
  });

  it('preserves spec.yaml mtime after --status', async () => {
    const specPath = join(harnessDir, 'spec.yaml');
    const beforeMtime = statSync(specPath).mtimeMs;
    await runDriveStatus({harnessDir, out: () => undefined});
    const afterMtime = statSync(specPath).mtimeMs;
    expect(afterMtime).toBe(beforeMtime);
  });

  it('returns 2 when harness dir does not exist', async () => {
    const captured: string[] = [];
    const code = await runDriveStatus({
      harnessDir: join(tmp, 'does-not-exist'),
      out: (s) => captured.push(s),
    });
    expect(code).toBe(2);
    expect(captured.join('')).toContain('harness dir not found');
  });

  it('writes nothing to the harness dir on a missing-goal status call', async () => {
    // Replace the spec with no goals but keep state.yaml untouched.
    writeFileSync(
      join(harnessDir, 'spec.yaml'),
      yamlStringify({version: '2.3.9', features: []}),
    );
    const statePath = join(harnessDir, 'state.yaml');
    const beforeMtime = statSync(statePath).mtimeMs;
    let captured = '';
    await runDriveStatus({harnessDir, out: (s) => (captured += s)});
    expect(captured).toContain('no goals registered yet');
    expect(statSync(statePath).mtimeMs).toBe(beforeMtime);
  });

  it('does not create _workspace/drive on a status call', async () => {
    await runDriveStatus({harnessDir, out: () => undefined});
    expect(existsSync(join(harnessDir, '_workspace', 'drive'))).toBe(false);
  });
});

describe('core/state — Goal helpers (v0.14.0 / F-118)', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'state-goal-'));
  });

  it('loads a legacy state.yaml without a goals key', () => {
    writeFileSync(
      join(tmp, 'state.yaml'),
      yamlStringify({
        version: '2.3',
        schema_version: '2.3',
        features: [],
        session: {started_at: null, last_command: '', last_gate_passed: null, active_feature_id: null},
      }),
    );
    const state = State.load(tmp);
    expect(state.goals()).toEqual([]);
    expect(state.activeGoalId()).toBeNull();
  });

  it('ensureGoal inserts a planning placeholder and is idempotent', () => {
    const state = State.load(tmp);
    const a = state.ensureGoal('G-001');
    const b = state.ensureGoal('G-001');
    expect(a).toBe(b);
    expect(a.status).toBe('planning');
    expect(state.goals()).toHaveLength(1);
  });

  it('setGoalStatus rejects unknown values', () => {
    const state = State.load(tmp);
    expect(() => state.setGoalStatus('G-001', 'bogus' as 'planning')).toThrow();
  });

  it('setGoalStatus stamps started_at on executing and completed_at on done', () => {
    const state = State.load(tmp);
    state.setGoalStatus('G-001', 'executing');
    expect(state.getGoal('G-001')?.started_at).not.toBeNull();
    state.setGoalStatus('G-001', 'done');
    expect(state.getGoal('G-001')?.completed_at).not.toBeNull();
  });

  it('setActiveGoal + activeGoalId round-trip', () => {
    const state = State.load(tmp);
    state.setActiveGoal('G-001');
    expect(state.activeGoalId()).toBe('G-001');
    state.setActiveGoal(null);
    expect(state.activeGoalId()).toBeNull();
  });

  it('removeGoal clears active_goal_id when matching', () => {
    const state = State.load(tmp);
    state.ensureGoal('G-001');
    state.setActiveGoal('G-001');
    expect(state.removeGoal('G-001')).toBe(true);
    expect(state.activeGoalId()).toBeNull();
  });

  it('setGoalFeatureProgress writes into feature_progress', () => {
    const state = State.load(tmp);
    state.setGoalFeatureProgress('G-001', 'F-118', 'in_progress');
    expect(state.getGoal('G-001')?.feature_progress).toEqual({'F-118': 'in_progress'});
  });

  it('save → load round-trips goals[] and active_goal_id', () => {
    const stateA = State.load(tmp);
    stateA.ensureGoal('G-001');
    stateA.setGoalStatus('G-001', 'executing');
    stateA.setActiveGoal('G-001');
    stateA.save();
    const stateB = State.load(tmp);
    expect(stateB.activeGoalId()).toBe('G-001');
    expect(stateB.getGoal('G-001')?.status).toBe('executing');
  });
});
