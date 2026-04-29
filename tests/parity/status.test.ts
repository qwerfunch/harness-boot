/**
 * Parity test for `src/status.ts` (F-094).
 *
 * Coverage:
 *
 *   - buildReport composes State + harness.yaml + events.log into a
 *     StatusReport with the expected shape.
 *   - drift_status pulled from `generation.drift_status`.
 *   - last_sync from the most recent `sync_completed` event with
 *     spec_hash truncated to 12 chars.
 *   - feature_filter narrows features_summary.
 *   - active_feature populated only when state.session.active_feature_id
 *     points to a real feature.
 *   - formatHuman emits the canonical Python header lines.
 *
 * Run via `npm run test:parity`.
 */

import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {State} from '../../src/core/state.js';
import {buildReport, formatHuman} from '../../src/status.js';

interface HarnessFixture {
  dir: string;
  state: State;
}

function makeHarness(): HarnessFixture {
  const dir = mkdtempSync(join(tmpdir(), 'status-'));
  const state = State.load(dir);
  state.setStatus('F-001', 'in_progress');
  state.recordGateResult('F-001', 'gate_0', 'pass', {note: 'green'});
  state.recordGateResult('F-001', 'gate_1', 'fail', {note: 'red'});
  state.addEvidence('F-001', 'manual_check', 'reviewer eyeball');
  state.setActive('F-001');
  state.setLastCommand('/harness:work F-001');
  state.setStatus('F-002', 'done');
  state.setStatus('F-003', 'planned');
  state.save();
  return {dir, state};
}

function writeHarnessYaml(dir: string, content: string): void {
  writeFileSync(join(dir, 'harness.yaml'), content, 'utf-8');
}

function appendEventsLog(dir: string, lines: string[]): void {
  writeFileSync(join(dir, 'events.log'), lines.map((l) => `${l}\n`).join(''), 'utf-8');
}

describe('status.buildReport — composition + summary', () => {
  let fx: HarnessFixture;

  beforeEach(() => {
    fx = makeHarness();
  });
  afterEach(() => {
    rmSync(fx.dir, {recursive: true, force: true});
  });

  it('returns counts grouped by status', () => {
    const r = buildReport(fx.dir);
    expect(r.counts['in_progress']).toBe(1);
    expect(r.counts['done']).toBe(1);
    expect(r.counts['planned']).toBe(1);
    expect(r.counts['blocked']).toBe(0);
    expect(r.counts['archived']).toBe(0);
  });

  it('exposes session block verbatim', () => {
    const r = buildReport(fx.dir);
    expect(r.session.active_feature_id).toBe('F-001');
    expect(r.session.last_command).toBe('/harness:work F-001');
    expect(r.session.last_gate_passed).toBe('gate_0');
  });

  it('feature summary tags passed + failed gates per feature', () => {
    const r = buildReport(fx.dir);
    const f1 = r.features_summary.find((f) => f.id === 'F-001')!;
    expect(f1.gates_passed).toEqual(['gate_0']);
    expect(f1.gates_failed).toEqual(['gate_1']);
    expect(f1.evidence_count).toBe(1);
  });

  it('active_feature points at the in_progress entry', () => {
    const r = buildReport(fx.dir);
    expect(r.active_feature).not.toBeNull();
    expect(r.active_feature!.id).toBe('F-001');
  });

  it('drift_status falls back to "unknown" when harness.yaml is absent', () => {
    const r = buildReport(fx.dir);
    expect(r.drift_status).toBe('unknown');
  });

  it('drift_status pulled from generation.drift_status', () => {
    writeHarnessYaml(fx.dir, 'generation:\n  drift_status: clean\n');
    const r = buildReport(fx.dir);
    expect(r.drift_status).toBe('clean');
  });

  it('last_sync extracted from sync_completed event with spec_hash truncated', () => {
    const sync = {
      ts: '2026-04-29T08:00:00Z',
      type: 'sync_completed',
      spec_hash: 'abcdef0123456789aabbccdd',
      plugin_version: '0.12.2',
    };
    appendEventsLog(fx.dir, [JSON.stringify(sync)]);
    const r = buildReport(fx.dir);
    expect(r.last_sync).not.toBeNull();
    expect(r.last_sync!.ts).toBe('2026-04-29T08:00:00Z');
    expect(r.last_sync!.spec_hash).toBe('abcdef012345');
    expect(r.last_sync!.plugin_version).toBe('0.12.2');
  });

  it('feature filter restricts the summary to one feature', () => {
    const r = buildReport(fx.dir, {featureFilter: 'F-002'});
    expect(r.features_summary).toHaveLength(1);
    expect(r.features_summary[0]!.id).toBe('F-002');
  });
});

describe('status.formatHuman — output shape', () => {
  let fx: HarnessFixture;

  beforeEach(() => {
    fx = makeHarness();
  });
  afterEach(() => {
    rmSync(fx.dir, {recursive: true, force: true});
  });

  it('emits the canonical header line', () => {
    const out = formatHuman(buildReport(fx.dir));
    expect(out.startsWith('📋 /harness:status\n')).toBe(true);
  });

  it('renders Session + Features + Drift sections in order', () => {
    const out = formatHuman(buildReport(fx.dir));
    const sessionPos = out.indexOf('Session');
    const featuresPos = out.indexOf('Features (');
    const driftPos = out.indexOf('Drift status:');
    expect(sessionPos).toBeLessThan(featuresPos);
    expect(featuresPos).toBeLessThan(driftPos);
  });

  it('renders Active feature block when one is set', () => {
    const out = formatHuman(buildReport(fx.dir));
    expect(out).toContain('Active feature: F-001 [in_progress]');
    expect(out).toContain('gates passed: gate_0');
    expect(out).toContain('gates failed: gate_1');
    expect(out).toContain('evidence: 1 entries');
  });

  it('skips Active feature block when none is set', () => {
    const dir = mkdtempSync(join(tmpdir(), 'status-empty-'));
    try {
      mkdirSync(dir, {recursive: true});
      const out = formatHuman(buildReport(dir));
      expect(out).not.toContain('Active feature:');
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });

  it('ends with exactly one trailing newline', () => {
    const out = formatHuman(buildReport(fx.dir));
    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
  });
});
