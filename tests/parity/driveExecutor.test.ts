/**
 * Unit tests for `src/drive/executor.ts` (F-119).
 *
 * Coverage:
 *   - mapSuggestion routes each Action variant correctly
 *   - **BR-015 (a)** — `complete` mapping never carries hotfixReason
 *   - **BR-015 (a)** — executeAction's complete branch passes
 *     hotfixReason: null to the underlying work.complete
 *   - executeAction proceeds for run_gate / activate; halts for
 *     llm_required and explicit halt actions
 *   - missing feature_id / gate on a deterministic Action is
 *     converted to a halt, not a crash
 *
 * Run via `npm run test:parity`.
 */

import {describe, expect, it} from 'vitest';

import {executeAction, mapSuggestion} from '../../src/drive/executor.js';
import type {Suggestion} from '../../src/ui/intentPlanner.js';
import type {WorkResult} from '../../src/work.js';

const baseWork: WorkResult = {
  feature_id: 'F-118',
  action: 'completed',
  current_status: 'done',
  gates_passed: ['gate_5'],
  gates_failed: [],
  evidence_count: 1,
  message: '',
  routed_agents: [],
  parallel_groups: [],
};

describe('drive/executor — mapSuggestion', () => {
  it('routes run_gate → kind: run_gate with feature_id + gate', () => {
    const m = mapSuggestion({
      label: 'run gate_3',
      action: 'run_gate',
      feature_id: 'F-118',
      gate: 'gate_3',
    });
    expect(m.kind).toBe('run_gate');
    if (m.kind === 'run_gate') {
      expect(m.feature_id).toBe('F-118');
      expect(m.gate).toBe('gate_3');
    }
  });

  it('routes complete → kind: complete with feature_id', () => {
    const m = mapSuggestion({label: 'complete', action: 'complete', feature_id: 'F-118'});
    expect(m.kind).toBe('complete');
  });

  it('routes start_feature → kind: activate', () => {
    const m = mapSuggestion({label: 'start', action: 'start_feature', feature_id: 'F-118'});
    expect(m.kind).toBe('activate');
  });

  it('routes add_evidence → halt (BR-015 (a) — drive cannot self-issue)', () => {
    const m = mapSuggestion({label: 'add 1', action: 'add_evidence', feature_id: 'F-118'});
    expect(m.kind).toBe('halt');
    if (m.kind === 'halt') {
      expect(m.reason).toBe('manual');
      expect(m.message).toMatch(/BR-015/);
    }
  });

  it('routes analyze_fail / resolve_block → llm_required', () => {
    expect(mapSuggestion({label: 'a', action: 'analyze_fail', feature_id: 'F-1'}).kind).toBe(
      'llm_required',
    );
    expect(mapSuggestion({label: 'r', action: 'resolve_block', feature_id: 'F-1'}).kind).toBe(
      'llm_required',
    );
  });

  it('routes init_feature / review_carry_forward / resume / deactivate → halt', () => {
    expect(mapSuggestion({label: 'i', action: 'init_feature'}).kind).toBe('halt');
    expect(mapSuggestion({label: 'rc', action: 'review_carry_forward'}).kind).toBe('halt');
    expect(mapSuggestion({label: 'r', action: 'resume'}).kind).toBe('halt');
    expect(mapSuggestion({label: 'd', action: 'deactivate'}).kind).toBe('halt');
  });

  it('halts when run_gate suggestion lacks feature_id or gate', () => {
    const m = mapSuggestion({label: 'bad', action: 'run_gate'} as Suggestion);
    expect(m.kind).toBe('halt');
  });

  it('halts when complete suggestion lacks feature_id', () => {
    const m = mapSuggestion({label: 'bad', action: 'complete'} as Suggestion);
    expect(m.kind).toBe('halt');
  });
});

describe('drive/executor — executeAction', () => {
  it('proceeds on run_gate; surfaces failed gate via work.gates_failed', () => {
    const calls: string[] = [];
    const r = executeAction(
      '/tmp/h',
      {kind: 'run_gate', feature_id: 'F-118', gate: 'gate_3', label: 'x'},
      {
        runGate: ((_h: string, fid: string, g: string) => {
          calls.push(`${fid}:${g}`);
          return {...baseWork, gates_failed: [g], gates_passed: []};
        }) as never,
      },
    );
    expect(r.proceed).toBe(true);
    expect(r.work?.gates_failed).toEqual(['gate_3']);
    expect(calls).toEqual(['F-118:gate_3']);
  });

  it('BR-015 (a) — complete branch passes hotfixReason: null', () => {
    let captured: unknown = undefined;
    executeAction(
      '/tmp/h',
      {kind: 'complete', feature_id: 'F-118', label: 'x'},
      {
        complete: ((_h: string, _fid: string, opts: {hotfixReason: string | null}) => {
          captured = opts.hotfixReason;
          return {...baseWork};
        }) as never,
      },
    );
    expect(captured).toBeNull();
  });

  it('complete halts when work.action is not "completed" (Iron Law not met)', () => {
    const r = executeAction(
      '/tmp/h',
      {kind: 'complete', feature_id: 'F-118', label: 'x'},
      {
        complete: ((_h: string, _fid: string) => ({
          ...baseWork,
          action: 'queried',
          message: 'Iron Law floor not met',
        })) as never,
      },
    );
    expect(r.proceed).toBe(false);
    expect(r.halt?.reason).toBe('manual');
    expect(r.halt?.message).toContain('Iron Law');
  });

  it('halt action returns proceed:false and surfaces reason', () => {
    const r = executeAction('/tmp/h', {
      kind: 'halt',
      reason: 'commit_boundary',
      message: 'commit needed',
    });
    expect(r.proceed).toBe(false);
    expect(r.halt?.reason).toBe('commit_boundary');
  });

  it('llm_required halts with manual reason + planner suggestion label', () => {
    const r = executeAction('/tmp/h', {
      kind: 'llm_required',
      suggestion: {label: 'analyze gate_3 fail', action: 'analyze_fail', feature_id: 'F-118'},
    });
    expect(r.proceed).toBe(false);
    expect(r.halt?.reason).toBe('manual');
    expect(r.halt?.message).toContain('analyze_fail');
  });

  it('activate proceeds via work.activate', () => {
    let called = false;
    const r = executeAction(
      '/tmp/h',
      {kind: 'activate', feature_id: 'F-119', label: 'start'},
      {
        activate: ((_h: string, _fid: string) => {
          called = true;
          return {...baseWork, action: 'activated'};
        }) as never,
      },
    );
    expect(called).toBe(true);
    expect(r.proceed).toBe(true);
  });
});
