/**
 * Parity test for `src/core/{projectMode,gates,routing}.ts` (F-088).
 *
 * These three modules are pure constant-and-helper exports — there is
 * no Python-side runtime state to snapshot. We therefore compare the
 * TS exports against inlined fixtures whose values mirror the Python
 * source files. Any drift (gate added in Python but not TS, agent
 * reordered in one map only) fails fast.
 *
 * Coverage:
 *
 *   - resolveMode truth table including all fallback paths.
 *   - STANDARD_GATES tuple shape + ordering + GATE_PERF identifier.
 *   - ROUTING_SHAPES key set + per-shape agent ordering.
 *   - PARALLEL_GROUPS key set + tuple ordering.
 *
 * Run via `npm run test:parity`.
 */

import {describe, expect, it} from 'vitest';

import {DEFAULT_MODE, VALID_MODES, resolveMode} from '../../src/core/projectMode.js';
import {GATE_PERF, STANDARD_GATES} from '../../src/core/gates.js';
import {PARALLEL_GROUPS, ROUTING_SHAPES} from '../../src/core/routing.js';

describe('projectMode parity', () => {
  it('DEFAULT_MODE is product (strict default)', () => {
    expect(DEFAULT_MODE).toBe('product');
  });

  it('VALID_MODES contains exactly prototype + product', () => {
    expect([...VALID_MODES].sort()).toEqual(['product', 'prototype']);
  });

  it('resolveMode returns prototype only when spec.project.mode === prototype', () => {
    expect(resolveMode({project: {mode: 'prototype'}})).toBe('prototype');
  });

  it('resolveMode returns product when explicit', () => {
    expect(resolveMode({project: {mode: 'product'}})).toBe('product');
  });

  it('resolveMode falls back to product on null / non-object', () => {
    expect(resolveMode(null)).toBe('product');
    expect(resolveMode(undefined)).toBe('product');
    expect(resolveMode('string')).toBe('product');
    expect(resolveMode([])).toBe('product');
    expect(resolveMode(42)).toBe('product');
  });

  it('resolveMode falls back to product on missing project block', () => {
    expect(resolveMode({})).toBe('product');
    expect(resolveMode({project: null})).toBe('product');
    expect(resolveMode({project: 'oops'})).toBe('product');
  });

  it('resolveMode falls back to product on missing or unknown mode', () => {
    expect(resolveMode({project: {}})).toBe('product');
    expect(resolveMode({project: {mode: null}})).toBe('product');
    expect(resolveMode({project: {mode: 'staging'}})).toBe('product');
    expect(resolveMode({project: {mode: 42}})).toBe('product');
    expect(resolveMode({project: {mode: 'PROTOTYPE'}})).toBe('product');
  });
});

describe('gates parity', () => {
  it('STANDARD_GATES matches the Python 6-tuple ordering', () => {
    expect([...STANDARD_GATES]).toEqual([
      'gate_0',
      'gate_1',
      'gate_2',
      'gate_3',
      'gate_4',
      'gate_5',
    ]);
  });

  it('GATE_PERF identifier matches Python', () => {
    expect(GATE_PERF).toBe('gate_perf');
  });
});

describe('routing parity', () => {
  it('ROUTING_SHAPES has the same six keys', () => {
    expect(Object.keys(ROUTING_SHAPES).sort()).toEqual(
      [
        'baseline-empty-vague',
        'feature_completion',
        'performance_budget',
        'pure_domain_logic',
        'sensitive_or_auth',
        'ui_surface.present',
      ].sort(),
    );
  });

  it('baseline-empty-vague routes to researcher → product-planner', () => {
    expect([...ROUTING_SHAPES['baseline-empty-vague']!]).toEqual([
      'researcher',
      'product-planner',
    ]);
  });

  it('ui_surface.present routes to the design+frontend chain', () => {
    expect([...ROUTING_SHAPES['ui_surface.present']!]).toEqual([
      'ux-architect',
      'visual-designer',
      'a11y-auditor',
      'frontend-engineer',
      'software-engineer',
    ]);
  });

  it('sensitive_or_auth routes to security-engineer ∥ reviewer', () => {
    expect([...ROUTING_SHAPES['sensitive_or_auth']!]).toEqual([
      'security-engineer',
      'reviewer',
    ]);
  });

  it('performance_budget routes to performance-engineer alone', () => {
    expect([...ROUTING_SHAPES['performance_budget']!]).toEqual(['performance-engineer']);
  });

  it('pure_domain_logic routes to backend-engineer + software-engineer', () => {
    expect([...ROUTING_SHAPES['pure_domain_logic']!]).toEqual([
      'backend-engineer',
      'software-engineer',
    ]);
  });

  it('feature_completion routes through qa → integrator → tech-writer → reviewer', () => {
    expect([...ROUTING_SHAPES['feature_completion']!]).toEqual([
      'qa-engineer',
      'integrator',
      'tech-writer',
      'reviewer',
    ]);
  });

  it('PARALLEL_GROUPS has only the two parallel-capable shapes', () => {
    expect(Object.keys(PARALLEL_GROUPS).sort()).toEqual(
      ['sensitive_or_auth', 'ui_surface.present'].sort(),
    );
  });

  it('sensitive_or_auth parallel group is [security-engineer, reviewer]', () => {
    const groups = PARALLEL_GROUPS['sensitive_or_auth']!;
    expect(groups).toHaveLength(1);
    expect([...groups[0]!]).toEqual(['security-engineer', 'reviewer']);
  });

  it('ui_surface.present parallel group is [visual-designer, audio-designer]', () => {
    const groups = PARALLEL_GROUPS['ui_surface.present']!;
    expect(groups).toHaveLength(1);
    expect([...groups[0]!]).toEqual(['visual-designer', 'audio-designer']);
  });
});
