/**
 * Parity test for `src/drive/replan.ts` (F-138 / drive Cycle A1).
 *
 * Covers:
 *   - Deterministic deferral: blocked / superseded ids move to the
 *     end of the goal's feature_progress order.
 *   - File-drop manifest: written when the just-completed retro
 *     contains a pivot keyword.
 *   - Idempotent re-call: a second invocation on the same fid is a
 *     silent no-op (no duplicate event, no further mutation).
 *   - Opt-out via `harness.yaml drive.replan.enabled: false`.
 *
 * Run via `npm run test:parity`.
 */

import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {stringify as yamlStringify} from 'yaml';

import {State} from '../../src/core/state.js';
import {replanAfterCompletion} from '../../src/drive/replan.js';

interface Workspace {
  dir: string;
  harness: string;
}

const SPEC_BASE = {
  version: '2.3',
  schema_version: '2.3',
  project: {name: 'replan-test', mode: 'prototype'},
  features: [
    {id: 'F-001', name: 'one', type: 'skeleton'},
    {id: 'F-002', name: 'two', type: 'feature'},
    {id: 'F-003', name: 'three', type: 'feature'},
    {id: 'F-004', name: 'four', type: 'feature'},
  ],
};

function makeWorkspace(): Workspace {
  const dir = mkdtempSync(join(tmpdir(), 'replan-'));
  const harness = join(dir, '.harness');
  mkdirSync(harness, {recursive: true});
  writeFileSync(join(harness, 'spec.yaml'), yamlStringify(SPEC_BASE), 'utf-8');
  return {dir, harness};
}

function seedGoalAndState(harness: string, opts: {
  doneIds?: string[];
  blockedIds?: string[];
  goalOrder?: string[];
}): void {
  const state = State.load(harness);
  state.ensureGoal('G-001');
  state.setGoalStatus('G-001', 'executing');
  state.setActiveGoal('G-001');
  const order = opts.goalOrder ?? ['F-001', 'F-002', 'F-003', 'F-004'];
  for (const fid of order) {
    state.ensureFeature(fid);
    state.setGoalFeatureProgress('G-001', fid, 'planned');
  }
  for (const fid of opts.doneIds ?? []) {
    state.setStatus(fid, 'done');
    state.setGoalFeatureProgress('G-001', fid, 'done');
  }
  for (const fid of opts.blockedIds ?? []) {
    state.setStatus(fid, 'blocked');
    state.setGoalFeatureProgress('G-001', fid, 'blocked');
  }
  state.save();
}

function readEvents(harness: string): Array<Record<string, unknown>> {
  const path = join(harness, 'events.log');
  if (!existsSync(path)) {
    return [];
  }
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe('replanAfterCompletion — deterministic deferral', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('defers blocked features to the end of feature_progress', () => {
    seedGoalAndState(ws.harness, {
      doneIds: ['F-001'],
      blockedIds: ['F-002'],
    });
    const result = replanAfterCompletion(ws.harness, 'F-001', 'G-001');
    expect(result.evaluated).toBe(true);
    expect(result.deltas.deferred).toContain('F-002');

    const state = State.load(ws.harness);
    const goal = state.getGoal('G-001')!;
    const order = Object.keys(goal.feature_progress);
    // F-002 (blocked) should be moved to the end.
    const f002Index = order.indexOf('F-002');
    expect(f002Index).toBe(order.length - 1);
  });

  it('defers superseded features to the end', () => {
    // Add superseded_by chain: F-002 superseded by F-003.
    const spec = {
      ...SPEC_BASE,
      features: SPEC_BASE.features.map((f) =>
        f.id === 'F-002' ? {...f, superseded_by: 'F-003'} : f,
      ),
    };
    writeFileSync(join(ws.harness, 'spec.yaml'), yamlStringify(spec), 'utf-8');
    seedGoalAndState(ws.harness, {doneIds: ['F-001']});

    const result = replanAfterCompletion(ws.harness, 'F-001', 'G-001');
    expect(result.evaluated).toBe(true);
    expect(result.deltas.deferred).toContain('F-002');
  });

  it('emits one replan_evaluated event with deltas', () => {
    seedGoalAndState(ws.harness, {
      doneIds: ['F-001'],
      blockedIds: ['F-002'],
    });
    replanAfterCompletion(ws.harness, 'F-001', 'G-001');
    const events = readEvents(ws.harness);
    const replan = events.find((e) => e['type'] === 'replan_evaluated');
    expect(replan).toBeDefined();
    expect(replan!['feature']).toBe('F-001');
    expect(replan!['goal']).toBe('G-001');
    expect(Array.isArray(replan!['deferred'])).toBe(true);
  });
});

describe('replanAfterCompletion — file-drop manifest', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('writes a manifest when the retro mentions pivot keywords', () => {
    seedGoalAndState(ws.harness, {doneIds: ['F-001']});
    // Seed a retro with a pivot keyword.
    const retroDir = join(ws.harness, '_workspace', 'retro');
    mkdirSync(retroDir, {recursive: true});
    writeFileSync(
      join(retroDir, 'F-001.md'),
      '# Retro F-001\n\nThis cycle suggests we should pivot the next feature direction.\n',
      'utf-8',
    );

    const result = replanAfterCompletion(ws.harness, 'F-001', 'G-001');
    expect(result.manifest_path).not.toBeNull();
    expect(existsSync(result.manifest_path!)).toBe(true);
    const manifest = readFileSync(result.manifest_path!, 'utf-8');
    expect(manifest).toContain('Replan request');
    expect(manifest).toContain('F-001');
    expect(manifest).toContain('G-001');
  });

  it('does not write a manifest when retro has no pivot keywords', () => {
    seedGoalAndState(ws.harness, {doneIds: ['F-001']});
    const retroDir = join(ws.harness, '_workspace', 'retro');
    mkdirSync(retroDir, {recursive: true});
    writeFileSync(join(retroDir, 'F-001.md'), '# Retro F-001\n\nNothing notable.\n', 'utf-8');

    const result = replanAfterCompletion(ws.harness, 'F-001', 'G-001');
    expect(result.manifest_path).toBeNull();
  });
});

describe('replanAfterCompletion — idempotent + opt-out', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('second call on the same fid is a silent no-op (no duplicate event)', () => {
    seedGoalAndState(ws.harness, {doneIds: ['F-001'], blockedIds: ['F-002']});
    replanAfterCompletion(ws.harness, 'F-001', 'G-001');
    const eventsBefore = readEvents(ws.harness).length;

    const result2 = replanAfterCompletion(ws.harness, 'F-001', 'G-001');
    expect(result2.evaluated).toBe(false);
    expect(result2.skip_reason).toBe('already_evaluated');
    expect(readEvents(ws.harness).length).toBe(eventsBefore);
  });

  it('opt-out via harness.yaml writes one replan_disabled event then stays silent', () => {
    writeFileSync(
      join(ws.harness, 'harness.yaml'),
      'drive:\n  replan:\n    enabled: false\n',
      'utf-8',
    );
    seedGoalAndState(ws.harness, {doneIds: ['F-001'], blockedIds: ['F-002']});

    const r1 = replanAfterCompletion(ws.harness, 'F-001', 'G-001');
    expect(r1.evaluated).toBe(false);
    expect(r1.skip_reason).toBe('opt_out');
    const events1 = readEvents(ws.harness);
    expect(events1.filter((e) => e['type'] === 'replan_disabled').length).toBe(1);

    // Second call → still opt-out, no further event.
    const r2 = replanAfterCompletion(ws.harness, 'F-002', 'G-001');
    expect(r2.evaluated).toBe(false);
    const events2 = readEvents(ws.harness);
    expect(events2.filter((e) => e['type'] === 'replan_disabled').length).toBe(1);
  });
});
