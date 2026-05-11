/**
 * Parity test for `src/drive/realTest.ts` (F-139 / drive Cycle B).
 *
 * Covers:
 *   - Unconfigured skip (default behaviour for projects with no
 *     `harness.yaml drive.real_test.command`).
 *   - Not-due skip when the done counter does not divide N.
 *   - Due + pass: writes `real_test_passed` event.
 *   - Due + fail: writes `real_test_failed` event with stderr tail,
 *     returns `passed: false`.
 *   - Custom `every_n_features`.
 *
 * Run via `npm run test:parity`.
 */

import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {stringify as yamlStringify} from 'yaml';

import {State} from '../../src/core/state.js';
import {runRealTestIfDue} from '../../src/drive/realTest.js';

interface Workspace {
  dir: string;
  harness: string;
}

function makeWorkspace(): Workspace {
  const dir = mkdtempSync(join(tmpdir(), 'realtest-'));
  const harness = join(dir, '.harness');
  mkdirSync(harness, {recursive: true});
  // Minimal spec.yaml so State.load() works.
  writeFileSync(
    join(harness, 'spec.yaml'),
    yamlStringify({
      version: '2.3',
      schema_version: '2.3',
      project: {name: 'realtest', mode: 'prototype'},
      features: [
        {id: 'F-001', name: 'one', type: 'skeleton'},
        {id: 'F-002', name: 'two', type: 'feature'},
        {id: 'F-003', name: 'three', type: 'feature'},
        {id: 'F-004', name: 'four', type: 'feature'},
      ],
    }),
    'utf-8',
  );
  return {dir, harness};
}

function seedGoal(harness: string, doneIds: string[]): void {
  const state = State.load(harness);
  state.ensureGoal('G-001');
  state.setActiveGoal('G-001');
  for (const fid of ['F-001', 'F-002', 'F-003', 'F-004']) {
    state.ensureFeature(fid);
    state.setGoalFeatureProgress('G-001', fid, 'planned');
  }
  for (const fid of doneIds) {
    state.setStatus(fid, 'done');
    state.setGoalFeatureProgress('G-001', fid, 'done');
  }
  state.save();
}

function writeHarnessConfig(harness: string, command: string, everyN?: number): void {
  const lines = ['drive:', '  real_test:', `    command: "${command}"`];
  if (typeof everyN === 'number') {
    lines.push(`    every_n_features: ${everyN}`);
  }
  writeFileSync(join(harness, 'harness.yaml'), `${lines.join('\n')}\n`, 'utf-8');
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

describe('runRealTestIfDue — opt-out + not-due', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('skips silently when no harness.yaml command is configured', () => {
    seedGoal(ws.harness, ['F-001', 'F-002', 'F-003']);
    const r = runRealTestIfDue(ws.harness, 'G-001', 'F-003');
    expect(r.ran).toBe(false);
    expect(r.skip_reason).toBe('unconfigured');
    expect(readEvents(ws.harness).length).toBe(0);
  });

  it('skips with not_due when done count does not divide N', () => {
    writeHarnessConfig(ws.harness, 'true', 3);
    seedGoal(ws.harness, ['F-001', 'F-002']); // done=2, N=3 → not due
    const r = runRealTestIfDue(ws.harness, 'G-001', 'F-002');
    expect(r.ran).toBe(false);
    expect(r.skip_reason).toBe('not_due');
  });

  it('skips with no_goal when goalId is null', () => {
    writeHarnessConfig(ws.harness, 'true');
    seedGoal(ws.harness, ['F-001']);
    const r = runRealTestIfDue(ws.harness, null, 'F-001');
    expect(r.ran).toBe(false);
    expect(r.skip_reason).toBe('no_goal');
  });
});

describe('runRealTestIfDue — due + pass / fail', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('runs the command when due and writes real_test_passed on exit 0', () => {
    writeHarnessConfig(ws.harness, 'true', 3); // `true` always exits 0
    seedGoal(ws.harness, ['F-001', 'F-002', 'F-003']); // done=3, N=3 → due

    const r = runRealTestIfDue(ws.harness, 'G-001', 'F-003');
    expect(r.ran).toBe(true);
    expect(r.passed).toBe(true);
    expect(r.exit_code).toBe(0);

    const events = readEvents(ws.harness);
    const evt = events.find((e) => e['type'] === 'real_test_passed');
    expect(evt).toBeDefined();
    expect(evt!['command']).toBe('true');
    expect(evt!['done_count']).toBe(3);
  });

  it('writes real_test_failed with stderr_tail on non-zero exit', () => {
    // `false` exits 1; redirect a known stderr line so the tail captures it.
    writeHarnessConfig(ws.harness, 'echo failure-marker >&2; false', 3);
    seedGoal(ws.harness, ['F-001', 'F-002', 'F-003']);

    const r = runRealTestIfDue(ws.harness, 'G-001', 'F-003');
    expect(r.ran).toBe(true);
    expect(r.passed).toBe(false);
    expect(r.exit_code).toBe(1);
    expect(r.stderr_tail).toContain('failure-marker');

    const events = readEvents(ws.harness);
    const evt = events.find((e) => e['type'] === 'real_test_failed');
    expect(evt).toBeDefined();
    expect(evt!['stderr_tail']).toContain('failure-marker');
  });

  it('honours custom every_n_features (N=2)', () => {
    writeHarnessConfig(ws.harness, 'true', 2);
    seedGoal(ws.harness, ['F-001', 'F-002']); // done=2, N=2 → due
    const r = runRealTestIfDue(ws.harness, 'G-001', 'F-002');
    expect(r.ran).toBe(true);
    expect(r.passed).toBe(true);
  });
});
