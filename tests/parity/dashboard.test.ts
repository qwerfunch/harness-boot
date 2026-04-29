/**
 * Parity test for `src/ui/dashboard.ts` (F-103).
 *
 * Coverage:
 *
 *   - render emits sections in canonical order (header → active →
 *     others → on-hold → pending → unregistered → coverage debt →
 *     suggestions).
 *   - i18n labels honor explicit lang.
 *   - Active block surfaces gates passed / total + evidence count +
 *     blocker note + agent chain.
 *   - Empty-state hints fire correctly.
 *   - loadCoverage parses fingerprint and computes mean ratio.
 *
 * Run via `npm run test:parity`.
 */

import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {stringify as yamlStringify} from 'yaml';

import {loadCoverage, render} from '../../src/ui/dashboard.js';

interface Workspace {
  dir: string;
}

function makeWorkspace(): Workspace {
  return {dir: mkdtempSync(join(tmpdir(), 'dash-'))};
}

const SPEC = {
  features: [
    {id: 'F-001', name: 'login flow', title: 'login flow', modules: ['x']},
    {id: 'F-002', name: 'logout', title: 'logout', modules: ['x']},
    {id: 'F-003', name: 'session expiry', title: 'session expiry', modules: ['x']},
  ],
};

describe('dashboard.render — section ordering', () => {
  it('header always appears first', () => {
    const out = render({features: []}, SPEC, [], {lang: 'ko'});
    expect(out.startsWith('📊 ')).toBe(true);
  });

  it('active feature block emits after header', () => {
    const state = {
      session: {active_feature_id: 'F-001'},
      features: [
        {
          id: 'F-001',
          status: 'in_progress',
          gates: {gate_0: {last_result: 'pass'}},
          evidence: [{kind: 'manual_check', summary: 'reviewed'}],
        },
      ],
    };
    const out = render(state, SPEC, [], {lang: 'ko'});
    expect(out).toContain('작업 중: "login flow"');
    expect(out).toContain('진행: 검증 1/6 통과 · 근거 1 개');
  });

  it('blocker line emits when latest evidence is blocker', () => {
    const state = {
      session: {active_feature_id: 'F-001'},
      features: [
        {
          id: 'F-001',
          status: 'in_progress',
          gates: {},
          evidence: [{kind: 'blocker', summary: 'API down'}],
        },
      ],
    };
    const out = render(state, SPEC, [], {lang: 'ko'});
    expect(out).toContain('차단: API down');
  });

  it('blocker line suppressed once user adds non-blocker evidence', () => {
    const state = {
      session: {active_feature_id: 'F-001'},
      features: [
        {
          id: 'F-001',
          status: 'in_progress',
          gates: {},
          evidence: [
            {kind: 'blocker', summary: 'API down'},
            {kind: 'manual_check', summary: 'fixed'},
          ],
        },
      ],
    };
    const out = render(state, SPEC, [], {lang: 'ko'});
    expect(out).not.toContain('차단: API down');
  });

  it('others-in-progress block emits when multiple in_progress', () => {
    const state = {
      session: {active_feature_id: 'F-001'},
      features: [
        {id: 'F-001', status: 'in_progress', gates: {}, evidence: []},
        {id: 'F-002', status: 'in_progress', gates: {}, evidence: []},
      ],
    };
    const out = render(state, SPEC, [], {lang: 'ko'});
    expect(out).toContain('진행 중 (다른):');
    expect(out).toContain('"logout"');
  });

  it('on-hold block emits for blocked features', () => {
    const state = {
      session: {active_feature_id: null},
      features: [{id: 'F-002', status: 'blocked', gates: {}, evidence: []}],
    };
    const out = render(state, SPEC, [], {lang: 'ko'});
    expect(out).toContain('보류:');
    expect(out).toContain('"logout"');
  });

  it('pending block emits for planned features', () => {
    const state = {
      session: {active_feature_id: null},
      features: [{id: 'F-003', status: 'planned', gates: {}, evidence: []}],
    };
    const out = render(state, SPEC, [], {lang: 'ko'});
    expect(out).toContain('대기:');
    expect(out).toContain('"session expiry"');
  });

  it('unregistered block surfaces spec features not in state', () => {
    const state = {
      session: {active_feature_id: null},
      features: [], // no state-tracked features yet
    };
    const out = render(state, SPEC, [], {lang: 'ko'});
    expect(out).toContain('다음 후보 (spec 정의 · 미시작, 3 개):');
    expect(out).toContain('"login flow"');
  });

  it('archived spec features omitted from unregistered', () => {
    const spec = {
      features: [
        {id: 'F-001', name: 'archived', status: 'archived'},
        {id: 'F-002', name: 'active', superseded_by: 'F-001'},
        {id: 'F-003', name: 'real one'},
      ],
    };
    const out = render({session: {active_feature_id: null}, features: []}, spec, [], {lang: 'ko'});
    expect(out).toContain('"real one"');
    expect(out).not.toContain('"archived"');
  });

  it('all-done hint when every feature is done', () => {
    const state = {
      session: {active_feature_id: null},
      features: [{id: 'F-001', status: 'done', gates: {}, evidence: []}],
    };
    const out = render(state, {features: [{id: 'F-001'}]}, [], {lang: 'ko'});
    expect(out).toContain('모든 피처 완료');
  });

  it('no-features hint for empty state and empty spec', () => {
    const out = render({features: []}, {features: []}, [], {lang: 'ko'});
    expect(out).toContain('아직 피처가 없습니다');
  });

  it('suggestions block emits with recommended marker on first item', () => {
    const out = render({features: []}, SPEC, [{label: 'first', action: 'init_feature'}], {
      lang: 'ko',
    });
    expect(out).toContain('다음 할 일:');
    expect(out).toContain('(1) first (추천)');
    expect(out).toContain('Enter = 1 (추천)');
  });
});

describe('dashboard.render — locale switch', () => {
  it('en lang emits English labels', () => {
    const state = {
      session: {active_feature_id: 'F-001'},
      features: [
        {id: 'F-001', status: 'in_progress', gates: {}, evidence: []},
      ],
    };
    const out = render(state, SPEC, [], {lang: 'en'});
    expect(out).toContain('working on:');
    expect(out).toContain('progress:');
  });
});

describe('dashboard.loadCoverage', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
    mkdirSync(join(ws.dir, '_workspace', 'coverage'), {recursive: true});
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('returns null when fingerprint missing', () => {
    expect(loadCoverage(ws.dir, 'F-001')[0]).toBeNull();
  });

  it('returns 1.0 when no mismatches', () => {
    writeFileSync(
      join(ws.dir, '_workspace', 'coverage', 'F-001.yaml'),
      yamlStringify({feature_id: 'F-001', mismatches: []}),
      'utf-8',
    );
    expect(loadCoverage(ws.dir, 'F-001')[0]).toBe(1.0);
  });

  it('computes mean ratio across mismatches', () => {
    writeFileSync(
      join(ws.dir, '_workspace', 'coverage', 'F-001.yaml'),
      yamlStringify({
        feature_id: 'F-001',
        mismatches: [
          {metric: 'a', description_value: 10, ac_value: 5},
          {metric: 'b', description_value: 4, ac_value: 1},
        ],
      }),
      'utf-8',
    );
    const [ratio] = loadCoverage(ws.dir, 'F-001');
    // (5/10 + 1/4) / 2 = (0.5 + 0.25) / 2 = 0.375
    expect(ratio).toBeCloseTo(0.375, 3);
  });

  it('skips entries with desc <= 0', () => {
    writeFileSync(
      join(ws.dir, '_workspace', 'coverage', 'F-001.yaml'),
      yamlStringify({
        feature_id: 'F-001',
        mismatches: [{metric: 'x', description_value: 0, ac_value: 0}],
      }),
      'utf-8',
    );
    expect(loadCoverage(ws.dir, 'F-001')[0]).toBeNull();
  });

  it('null harnessDir returns null', () => {
    expect(loadCoverage(null, 'F-001')[0]).toBeNull();
  });
});

describe('dashboard.render — coverage line + debt section', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
    mkdirSync(join(ws.dir, '_workspace', 'coverage'), {recursive: true});
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('emits coverage line on the active feature when ratio < 1.0', () => {
    writeFileSync(
      join(ws.dir, '_workspace', 'coverage', 'F-001.yaml'),
      yamlStringify({
        feature_id: 'F-001',
        mismatches: [{metric: 'sections', description_value: 10, ac_value: 5}],
      }),
      'utf-8',
    );
    const state = {
      session: {active_feature_id: 'F-001'},
      features: [{id: 'F-001', status: 'in_progress', gates: {}, evidence: []}],
    };
    const out = render(state, SPEC, [], {lang: 'ko', harnessDir: ws.dir});
    expect(out).toContain('coverage: 50%');
    expect(out).toContain('5/10 sections');
  });

  it('coverage debt section emits when threshold exceeded', () => {
    // 6 features below threshold (DEBT_ALERT_THRESHOLD = 5).
    const features: Array<Record<string, unknown>> = [];
    for (let i = 1; i <= 6; i++) {
      const fid = `F-00${i}`;
      writeFileSync(
        join(ws.dir, '_workspace', 'coverage', `${fid}.yaml`),
        yamlStringify({
          feature_id: fid,
          mismatches: [{metric: 'x', description_value: 10, ac_value: 1}],
        }),
        'utf-8',
      );
      features.push({id: fid, status: 'done', gates: {}, evidence: []});
    }
    const out = render(
      {session: {active_feature_id: null}, features},
      {features: features.map((f) => ({id: f['id']}))},
      [],
      {lang: 'ko', harnessDir: ws.dir},
    );
    expect(out).toContain('Coverage debt high');
    expect(out).toContain('Coverage debt: 6 features');
  });
});
