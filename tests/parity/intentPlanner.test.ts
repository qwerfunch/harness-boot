/**
 * Parity test for `src/ui/intentPlanner.ts` (F-099).
 *
 * Coverage:
 *
 *   - Active-feature priority order (blocked → fail → next-gate →
 *     evidence → complete).
 *   - Idle path (resume → start → spec-unregistered → init).
 *   - Coverage carry-forward suggestion prepended below threshold.
 *
 * Run via `npm run test:parity`.
 */

import {describe, expect, it} from 'vitest';

import {suggest} from '../../src/ui/intentPlanner.js';

function makeState(active: Record<string, unknown> | null, others: Array<Record<string, unknown>> = []) {
  const features: Array<Record<string, unknown>> = [];
  if (active !== null) {
    features.push(active);
  }
  features.push(...others);
  return {
    session: {active_feature_id: active?.['id'] ?? null},
    features,
  };
}

describe('intentPlanner — active feature', () => {
  it('blocked status → resolve_block first', () => {
    const state = makeState({id: 'F-1', status: 'blocked', gates: {}, evidence: []});
    const out = suggest(state);
    expect(out[0]!.action).toBe('resolve_block');
    expect(out[1]!.action).toBe('deactivate');
  });

  it('recent blocker evidence → resolve_block first', () => {
    const state = makeState({
      id: 'F-1',
      status: 'in_progress',
      gates: {},
      evidence: [{kind: 'blocker', summary: 'API down'}],
    });
    const out = suggest(state);
    expect(out[0]!.action).toBe('resolve_block');
  });

  it('gate fail → analyze + run_gate', () => {
    const state = makeState({
      id: 'F-1',
      status: 'in_progress',
      gates: {gate_0: {last_result: 'pass'}, gate_1: {last_result: 'fail'}},
      evidence: [],
    });
    const out = suggest(state);
    expect(out[0]!.action).toBe('analyze_fail');
    expect(out[0]!.gate).toBe('gate_1');
    expect(out[1]!.action).toBe('run_gate');
  });

  it('earliest missing gate → run_gate', () => {
    const state = makeState({
      id: 'F-1',
      status: 'in_progress',
      gates: {gate_0: {last_result: 'pass'}},
      evidence: [],
    });
    const out = suggest(state);
    expect(out[0]!.action).toBe('run_gate');
    expect(out[0]!.gate).toBe('gate_1');
  });

  it('all gates pass + zero evidence → add_evidence', () => {
    const allPass = Object.fromEntries(
      ['gate_0', 'gate_1', 'gate_2', 'gate_3', 'gate_4', 'gate_5'].map((g) => [g, {last_result: 'pass'}]),
    );
    const state = makeState({id: 'F-1', status: 'in_progress', gates: allPass, evidence: []});
    const out = suggest(state);
    expect(out[0]!.action).toBe('add_evidence');
  });

  it('all gates pass + ≥1 evidence → complete', () => {
    const allPass = Object.fromEntries(
      ['gate_0', 'gate_1', 'gate_2', 'gate_3', 'gate_4', 'gate_5'].map((g) => [g, {last_result: 'pass'}]),
    );
    const state = makeState({
      id: 'F-1',
      status: 'in_progress',
      gates: allPass,
      evidence: [{kind: 'manual_check', summary: 'reviewed'}],
    });
    const out = suggest(state);
    expect(out[0]!.action).toBe('complete');
  });

  it('uses feature title from spec when available', () => {
    const state = makeState({id: 'F-7', status: 'blocked', gates: {}, evidence: []});
    const spec = {features: [{id: 'F-7', name: 'login flow'}]};
    const out = suggest(state, spec);
    expect(out[0]!.label).toContain('login flow');
  });
});

describe('intentPlanner — idle path', () => {
  it('in_progress feature → resume', () => {
    const state = {
      session: {active_feature_id: null},
      features: [{id: 'F-1', status: 'in_progress'}],
    };
    const out = suggest(state);
    expect(out[0]!.action).toBe('resume');
    expect(out[0]!.feature_id).toBe('F-1');
  });

  it('planned feature only → start_feature', () => {
    const state = {
      session: {active_feature_id: null},
      features: [{id: 'F-1', status: 'planned'}],
    };
    const out = suggest(state);
    expect(out[0]!.action).toBe('start_feature');
  });

  it('spec unregistered fallback → start_feature', () => {
    const state = {session: {active_feature_id: null}, features: []};
    const spec = {features: [{id: 'F-99', name: 'pending'}]};
    const out = suggest(state, spec);
    expect(out[0]!.action).toBe('start_feature');
    expect(out[0]!.feature_id).toBe('F-99');
  });

  it('archived/superseded spec features are skipped', () => {
    const state = {session: {active_feature_id: null}, features: []};
    const spec = {
      features: [
        {id: 'F-1', status: 'archived'},
        {id: 'F-2', superseded_by: 'F-3'},
        {id: 'F-3', name: 'real feature'},
      ],
    };
    const out = suggest(state, spec);
    expect(out[0]!.feature_id).toBe('F-3');
  });

  it('nothing to suggest → init_feature', () => {
    const state = {session: {active_feature_id: null}, features: []};
    const out = suggest(state);
    expect(out[0]!.action).toBe('init_feature');
  });
});

describe('intentPlanner — coverage carry-forward', () => {
  it('coverage < 0.80 prepends review_carry_forward', () => {
    const state = makeState({id: 'F-1', status: 'blocked', gates: {}, evidence: []});
    const out = suggest(state, null, {coverage: 0.5});
    expect(out[0]!.action).toBe('review_carry_forward');
    expect(out[0]!.label).toContain('50%');
    expect(out[0]!.label).toContain('80%');
  });

  it('coverage ≥ 0.80 does not prepend', () => {
    const state = makeState({id: 'F-1', status: 'blocked', gates: {}, evidence: []});
    const out = suggest(state, null, {coverage: 0.85});
    expect(out[0]!.action).toBe('resolve_block');
  });

  it('null coverage does not prepend', () => {
    const state = makeState({id: 'F-1', status: 'blocked', gates: {}, evidence: []});
    const out = suggest(state, null);
    expect(out[0]!.action).toBe('resolve_block');
  });
});

describe('intentPlanner — defensive cases', () => {
  it('non-object state returns empty', () => {
    expect(suggest(null)).toEqual([]);
    expect(suggest('not state')).toEqual([]);
  });

  it('caps result at 3 suggestions', () => {
    const state = makeState({id: 'F-1', status: 'blocked', gates: {}, evidence: []});
    const out = suggest(state, null, {coverage: 0.3});
    expect(out.length).toBeLessThanOrEqual(3);
  });
});
