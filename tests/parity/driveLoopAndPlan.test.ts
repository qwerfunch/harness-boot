/**
 * Unit tests for `src/drive/loop.ts` + `src/drive/planPhase.ts` (F-119).
 *
 * Coverage:
 *   - Loop halts on STOP file (halt #9)
 *   - Loop halts on iteration cap (halt #7)
 *   - Loop halts on wall-clock cap (halt #6)
 *   - Loop halts on blocked feature (halt #5)
 *   - Loop halts on consecutive run_gate fails (halt #3)
 *   - Loop emits goal_retro_written + clears phase to "done" when
 *     every feature transitions to done (AC-6 happy path)
 *   - planPhase startPhaseA initialises checkpoint + halts #1
 *   - planPhase advancePhaseA progresses through brief / plan /
 *     scaffolded transitions
 *
 * Run via `npm run test:parity`.
 */

import {existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {beforeEach, describe, expect, it} from 'vitest';
import {stringify as yamlStringify} from 'yaml';

import {
  defaultCheckpoint,
  loadCheckpoint,
  saveCheckpoint,
  stopFilePath,
} from '../../src/drive/checkpoint.js';
import {runDriveStep} from '../../src/drive/loop.js';
import {advancePhaseA, briefPathFor, planPathFor, startPhaseA} from '../../src/drive/planPhase.js';

function seedSpec(harnessDir: string, opts: {goalId?: string; features?: string[]} = {}): void {
  const goalId = opts.goalId ?? 'G-001';
  const features = opts.features ?? ['F-118', 'F-119'];
  writeFileSync(
    join(harnessDir, 'spec.yaml'),
    yamlStringify({
      version: '2.3.9',
      features: [
        ...features.map((id) => ({id, name: `feature ${id}`, goal_id: goalId})),
      ],
      goals: [{id: goalId, slug: 'g', title: 'goal', feature_ids: features}],
    }),
  );
}

function seedState(
  harnessDir: string,
  opts: {features: Array<{id: string; status: string; gates?: Record<string, unknown>; evidence?: unknown[]}>; goalId?: string} = {features: []},
): void {
  const goalId = opts.goalId ?? 'G-001';
  writeFileSync(
    join(harnessDir, 'state.yaml'),
    yamlStringify({
      version: '2.3',
      schema_version: '2.3',
      features: opts.features.map((f) => ({
        id: f.id,
        status: f.status,
        gates: f.gates ?? {},
        evidence: f.evidence ?? [],
        started_at: null,
        completed_at: f.status === 'done' ? '2026-05-04T11:00:00Z' : null,
      })),
      session: {
        started_at: null,
        last_command: '',
        last_gate_passed: null,
        active_feature_id: opts.features.find((f) => f.status === 'in_progress')?.id ?? null,
        active_goal_id: goalId,
      },
      goals: [
        {
          id: goalId,
          status: 'executing',
          started_at: '2026-05-04T10:00:00Z',
          completed_at: null,
          iteration: 0,
          elapsed_sec: 0,
          feature_progress: {},
          last_halt_reason: null,
        },
      ],
    }),
  );
}

function seedCheckpoint(harnessDir: string, opts: {features: string[]; ck?: Partial<ReturnType<typeof defaultCheckpoint>>} = {features: []}): void {
  const ck = defaultCheckpoint('G-001', new Date('2026-05-04T10:00:00Z'));
  ck.phase = 'executing';
  ck.plan.scaffolded_features = opts.features;
  ck.execute.started_at = '2026-05-04T10:00:00Z';
  if (opts.ck !== undefined) {
    Object.assign(ck, opts.ck);
  }
  saveCheckpoint(harnessDir, ck);
}

describe('drive/loop — runDriveStep halt detection', () => {
  let tmp: string;
  let harnessDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'drive-loop-'));
    harnessDir = join(tmp, '.harness');
    mkdirSync(harnessDir, {recursive: true});
    seedSpec(harnessDir);
    seedState(harnessDir, {
      features: [
        {id: 'F-118', status: 'in_progress', gates: {gate_0: {last_result: 'pass'}}},
        {id: 'F-119', status: 'planned'},
      ],
    });
    seedCheckpoint(harnessDir, {features: ['F-118', 'F-119']});
  });

  it('halt #9 — STOP file present', () => {
    mkdirSync(join(harnessDir, '_workspace', 'drive'), {recursive: true});
    writeFileSync(stopFilePath(harnessDir), '');
    const r = runDriveStep(harnessDir, {harnessDir});
    expect(r.proceed).toBe(false);
    expect(r.halt?.reason).toBe('stop_file');
  });

  it('halt #7 — iteration cap reached', () => {
    const ck = loadCheckpoint(harnessDir)!;
    ck.execute.iteration = ck.execute.max_iterations;
    saveCheckpoint(harnessDir, ck);
    const r = runDriveStep(harnessDir, {harnessDir});
    expect(r.proceed).toBe(false);
    expect(r.halt?.reason).toBe('iteration_cap');
  });

  it('halt #6 — wall-clock cap reached', () => {
    const ck = loadCheckpoint(harnessDir)!;
    ck.execute.started_at = '2026-05-04T08:00:00Z';
    ck.execute.max_seconds = 60; // 1 minute
    saveCheckpoint(harnessDir, ck);
    const r = runDriveStep(harnessDir, {harnessDir, now: () => new Date('2026-05-04T10:00:00Z')});
    expect(r.proceed).toBe(false);
    expect(r.halt?.reason).toBe('wall_clock');
  });

  it('halt #5 — every remaining feature is blocked', () => {
    seedState(harnessDir, {
      features: [
        {id: 'F-118', status: 'blocked'},
        {id: 'F-119', status: 'blocked'},
      ],
    });
    const r = runDriveStep(harnessDir, {harnessDir});
    expect(r.proceed).toBe(false);
    expect(r.halt?.reason).toBe('feature_blocked');
  });

  it('halt #3 — consecutive run_gate fails reach the threshold', () => {
    let runGateCalls = 0;
    const r = runDriveStep(harnessDir, {
      harnessDir,
      maxRetries: 2,
      executorHooks: {
        runGate: ((_h: string, fid: string, gate: string) => {
          runGateCalls += 1;
          return {
            feature_id: fid,
            action: 'gate_run',
            current_status: 'in_progress',
            gates_passed: [],
            gates_failed: [gate],
            evidence_count: 0,
            message: '',
            routed_agents: [],
            parallel_groups: [],
          };
        }) as never,
      },
    });
    void runGateCalls;
    // First call increments retry to 1 — below threshold; loop proceeds.
    expect(r.proceed).toBe(true);
    // Second call increments to 2 — equals threshold; loop halts.
    const r2 = runDriveStep(harnessDir, {
      harnessDir,
      maxRetries: 2,
      executorHooks: {
        runGate: ((_h: string, fid: string, gate: string) => ({
          feature_id: fid,
          action: 'gate_run',
          current_status: 'in_progress',
          gates_passed: [],
          gates_failed: [gate],
          evidence_count: 0,
          message: '',
          routed_agents: [],
          parallel_groups: [],
        })) as never,
      },
    });
    expect(r2.proceed).toBe(false);
    expect(r2.halt?.reason).toBe('retry_threshold');
  });

  // F-121 / L-002 — same (gate, result) repeated N times with no
  // progress is its own halt (#10), distinct from retry_threshold (#3)
  // which only counts FAIL. Without this, a Rust project hitting
  // gate_0=skipped (pre-L-003) burned all 50 iterations until #7.
  it('halt #10 (gate_no_progress) — two consecutive skipped results halts the loop', () => {
    const skipResult = (fid: string) => ({
      feature_id: fid,
      action: 'gate_run' as const,
      current_status: 'in_progress',
      gates_passed: [] as string[],
      gates_failed: [] as string[], // skipped = neither passed nor failed
      evidence_count: 0,
      message: '',
      routed_agents: [] as string[],
      parallel_groups: [] as string[][],
    });
    const hooks = {
      runGate: ((_h: string, fid: string, _g: string) => skipResult(fid)) as never,
    };
    // First skipped — window length 1, no halt yet.
    const r1 = runDriveStep(harnessDir, {harnessDir, executorHooks: hooks});
    expect(r1.proceed).toBe(true);
    expect(r1.halt).toBeUndefined();
    // Second skipped — window [skipped, skipped], stagnated → halt #10.
    const r2 = runDriveStep(harnessDir, {harnessDir, executorHooks: hooks});
    expect(r2.proceed).toBe(false);
    expect(r2.halt?.reason).toBe('gate_no_progress');
    // Iteration count is far below the cap (50) — the point is we
    // halted early, not after burning the iteration budget.
    const ck = loadCheckpoint(harnessDir)!;
    expect(ck.execute.iteration).toBeLessThan(10);
  });

  it('halt #10 — pass between two skipped resets the stagnation window', () => {
    let call = 0;
    // Sequence: skip → pass → skip → skip
    // Stagnation only fires on the second pair of skips (after pass reset).
    const sequence: Array<'skip' | 'pass'> = ['skip', 'pass', 'skip', 'skip'];
    const hooks = {
      runGate: ((_h: string, fid: string, gate: string) => {
        const kind = sequence[call] ?? 'skip';
        call += 1;
        return {
          feature_id: fid,
          action: 'gate_run' as const,
          current_status: 'in_progress',
          gates_passed: kind === 'pass' ? [gate] : [],
          gates_failed: [] as string[],
          evidence_count: 0,
          message: '',
          routed_agents: [] as string[],
          parallel_groups: [] as string[][],
        };
      }) as never,
    };
    expect(runDriveStep(harnessDir, {harnessDir, executorHooks: hooks}).proceed).toBe(true); // skip
    expect(runDriveStep(harnessDir, {harnessDir, executorHooks: hooks}).proceed).toBe(true); // pass — resets
    expect(runDriveStep(harnessDir, {harnessDir, executorHooks: hooks}).proceed).toBe(true); // skip again
    const r4 = runDriveStep(harnessDir, {harnessDir, executorHooks: hooks}); // skip → halt
    expect(r4.proceed).toBe(false);
    expect(r4.halt?.reason).toBe('gate_no_progress');
  });

  it('halt #3 (retry_threshold) keeps priority over halt #10 on consecutive fails', () => {
    // Two FAIL with maxRetries=2 → retry_threshold fires first, not
    // gate_no_progress. The two halts are distinct reasons; #3 is
    // dedicated to fail counting and #10 catches everything else.
    const hooks = {
      runGate: ((_h: string, fid: string, gate: string) => ({
        feature_id: fid,
        action: 'gate_run' as const,
        current_status: 'in_progress',
        gates_passed: [] as string[],
        gates_failed: [gate],
        evidence_count: 0,
        message: '',
        routed_agents: [] as string[],
        parallel_groups: [] as string[][],
      })) as never,
    };
    expect(
      runDriveStep(harnessDir, {harnessDir, executorHooks: hooks, maxRetries: 2}).proceed,
    ).toBe(true);
    const r2 = runDriveStep(harnessDir, {harnessDir, executorHooks: hooks, maxRetries: 2});
    expect(r2.proceed).toBe(false);
    expect(r2.halt?.reason).toBe('retry_threshold');
  });

  it('goal completion — every feature done → goal_done:true + retro generated', () => {
    seedState(harnessDir, {
      features: [
        {id: 'F-118', status: 'done', gates: {gate_5: {last_result: 'pass'}}},
        {id: 'F-119', status: 'done', gates: {gate_5: {last_result: 'pass'}}},
      ],
    });
    const r = runDriveStep(harnessDir, {harnessDir});
    expect(r.goal_done).toBe(true);
    expect(r.proceed).toBe(false);
    // Retro file should have been written.
    const retroPath = join(harnessDir, '_workspace', 'drive', 'goals', 'G-001', 'retro.md');
    expect(existsSync(retroPath)).toBe(true);
  });

  it('halts with manual when no checkpoint exists', () => {
    const tmp2 = mkdtempSync(join(tmpdir(), 'drive-no-ck-'));
    const h2 = join(tmp2, '.harness');
    mkdirSync(h2);
    const r = runDriveStep(h2, {harnessDir: h2});
    expect(r.proceed).toBe(false);
    expect(r.halt?.reason).toBe('manual');
  });
});

describe('drive/planPhase — Phase A state machine', () => {
  let tmp: string;
  let harnessDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'drive-plan-'));
    harnessDir = join(tmp, '.harness');
    mkdirSync(harnessDir, {recursive: true});
    // Empty state.yaml — startPhaseA seeds it.
    writeFileSync(
      join(harnessDir, 'state.yaml'),
      yamlStringify({
        version: '2.3',
        schema_version: '2.3',
        features: [],
        session: {
          started_at: null,
          last_command: '',
          last_gate_passed: null,
          active_feature_id: null,
        },
      }),
    );
    // Empty spec.yaml.
    writeFileSync(
      join(harnessDir, 'spec.yaml'),
      yamlStringify({version: '2.3.9', features: [], goals: []}),
    );
  });

  it('startPhaseA allocates G-001, writes checkpoint, halts #1', () => {
    const r = startPhaseA({harnessDir, title: 'memo sync engine'});
    expect(r.goalId).toBe('G-001');
    expect(r.briefPath).toBe(briefPathFor(harnessDir, 'G-001'));
    expect(r.halt.reason).toBe('plan_phase_approval');
    const ck = loadCheckpoint(harnessDir);
    expect(ck?.goal_id).toBe('G-001');
    expect(ck?.phase).toBe('planning');
  });

  it('advancePhaseA halts when brief.md is missing', () => {
    startPhaseA({harnessDir, title: 'memo sync'});
    const r = advancePhaseA(harnessDir);
    expect(r.kind).toBe('halt');
    if (r.kind === 'halt') {
      expect(r.halt.message).toContain('brief is missing');
    }
  });

  it('advancePhaseA → halts after brief approval requesting plan', () => {
    startPhaseA({harnessDir, title: 'memo sync'});
    // Write a fake brief.md.
    const ck = loadCheckpoint(harnessDir)!;
    mkdirSync(join(harnessDir, '_workspace', 'drive', 'goals', 'G-001'), {recursive: true});
    writeFileSync(ck.plan.brief_path, '# brief\n');
    // First call: implicit approval, halts asking the user to review.
    const r1 = advancePhaseA(harnessDir);
    expect(r1.kind).toBe('halt');
    // Second call: brief now flagged approved internally; halts because plan.md is missing.
    const r2 = advancePhaseA(harnessDir);
    expect(r2.kind).toBe('halt');
    if (r2.kind === 'halt') {
      expect(r2.halt.message).toMatch(/plan|product-planner/);
    }
  });

  it('advancePhaseA with --auto-approve-all → halts asking for feature-author', () => {
    startPhaseA({harnessDir, title: 'memo sync'});
    const ck = loadCheckpoint(harnessDir)!;
    mkdirSync(join(harnessDir, '_workspace', 'drive', 'goals', 'G-001'), {recursive: true});
    writeFileSync(ck.plan.brief_path, '# brief\n');
    writeFileSync(planPathFor(harnessDir, 'G-001'), '# plan\n');
    const r = advancePhaseA(harnessDir, {autoApproveAll: true});
    expect(r.kind).toBe('halt');
    if (r.kind === 'halt') {
      expect(r.halt.message).toMatch(/feature-author/);
    }
  });

  it('advancePhaseA returns phase_b_ready once feature-author has scaffolded the goal', () => {
    startPhaseA({harnessDir, title: 'memo sync'});
    const ck = loadCheckpoint(harnessDir)!;
    mkdirSync(join(harnessDir, '_workspace', 'drive', 'goals', 'G-001'), {recursive: true});
    writeFileSync(ck.plan.brief_path, '# brief\n');
    writeFileSync(planPathFor(harnessDir, 'G-001'), '# plan\n');
    // feature-author writes the Goal + features into spec.yaml.
    writeFileSync(
      join(harnessDir, 'spec.yaml'),
      yamlStringify({
        version: '2.3.9',
        features: [
          {id: 'F-200', name: 'one', goal_id: 'G-001'},
          {id: 'F-201', name: 'two', goal_id: 'G-001'},
        ],
        goals: [{id: 'G-001', slug: 'memo-sync', title: 'memo sync', feature_ids: ['F-200', 'F-201']}],
      }),
    );
    const r = advancePhaseA(harnessDir, {autoApproveAll: true});
    expect(r.kind).toBe('phase_b_ready');
    if (r.kind === 'phase_b_ready') {
      expect(r.goalId).toBe('G-001');
      expect(r.featureIds).toEqual(['F-200', 'F-201']);
    }
    // Checkpoint should have advanced to "scaffolded".
    expect(loadCheckpoint(harnessDir)?.phase).toBe('scaffolded');
  });

  it('startPhaseA refuses an empty title', () => {
    expect(() => startPhaseA({harnessDir, title: ''})).toThrow();
  });

  it('readFileSync placeholder — tmpdir is reachable', () => {
    // Sanity: tmp dirs the test seeds are valid.
    expect(existsSync(harnessDir)).toBe(true);
    expect(readFileSync(join(harnessDir, 'spec.yaml'), 'utf-8')).toContain('version');
  });
});
