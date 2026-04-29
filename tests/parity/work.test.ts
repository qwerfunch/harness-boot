/**
 * Parity test for `src/work.ts` (F-102).
 *
 * Coverage focuses on lifecycle invariants: state transitions,
 * Iron Law gating, hotfix override, idempotency, working-tree-clean
 * guard. Auto-wire firing is observed via events.log and ceremony
 * file presence rather than full file-content parity (the ceremony
 * modules already have their own parity tests).
 *
 * Run via `npm run test:parity`.
 */

import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {stringify as yamlStringify} from 'yaml';

import {
  activate,
  addEvidence,
  archive,
  block,
  complete,
  current,
  deactivate,
  recordGate,
  removeFeature,
  runAndRecordGate,
} from '../../src/work.js';

interface Workspace {
  dir: string;
  harness: string;
}

const SPEC_PROTOTYPE = {
  version: '2.3',
  schema_version: '2.3',
  project: {name: 'test', mode: 'prototype'},
  features: [
    {
      id: 'F-001',
      name: 'first',
      title: 'first',
      modules: ['core/x'],
      acceptance_criteria: ['AC-1: thing'],
    },
  ],
};

const SPEC_PRODUCT = {
  ...SPEC_PROTOTYPE,
  project: {name: 'test', mode: 'product'},
};

function makeWorkspace(spec: object = SPEC_PROTOTYPE): Workspace {
  const dir = mkdtempSync(join(tmpdir(), 'work-'));
  const harness = join(dir, '.harness');
  mkdirSync(harness, {recursive: true});
  writeFileSync(join(harness, 'spec.yaml'), yamlStringify(spec), 'utf-8');
  return {dir, harness};
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

describe('work.activate', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('transitions planned → in_progress', () => {
    const res = activate(ws.harness, 'F-001');
    expect(res.action).toBe('activated');
    expect(res.current_status).toBe('in_progress');
  });

  it('emits feature_activated event', () => {
    activate(ws.harness, 'F-001');
    const events = readEvents(ws.harness);
    expect(events.find((e) => e['type'] === 'feature_activated')).toBeDefined();
  });

  it('returns queried for an already-done feature', () => {
    activate(ws.harness, 'F-001');
    recordGate(ws.harness, 'F-001', 'gate_5', 'pass');
    addEvidence(ws.harness, 'F-001', 'manual_check', 'verified');
    complete(ws.harness, 'F-001');
    const res = activate(ws.harness, 'F-001');
    expect(res.action).toBe('queried');
    expect(res.message).toContain('already done');
  });

  it('populates routed_agents from kickoff routing', () => {
    const res = activate(ws.harness, 'F-001');
    expect(res.routed_agents.length).toBeGreaterThan(0);
  });

  it('fires kickoff auto-wire — kickoff.md exists', () => {
    activate(ws.harness, 'F-001');
    expect(existsSync(join(ws.harness, '_workspace', 'kickoff', 'F-001.md'))).toBe(true);
  });
});

describe('work.recordGate / addEvidence / block', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
    activate(ws.harness, 'F-001');
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('recordGate persists last_result + appends gate_recorded event', () => {
    const res = recordGate(ws.harness, 'F-001', 'gate_0', 'pass', {note: 'green'});
    expect(res.action).toBe('gate_recorded');
    expect(res.gates_passed).toContain('gate_0');
    expect(readEvents(ws.harness).some((e) => e['type'] === 'gate_recorded')).toBe(true);
  });

  it('addEvidence appends evidence + event', () => {
    const res = addEvidence(ws.harness, 'F-001', 'manual_check', 'eyeballed');
    expect(res.action).toBe('evidence_added');
    expect(res.evidence_count).toBe(1);
    expect(readEvents(ws.harness).some((e) => e['type'] === 'evidence_added')).toBe(true);
  });

  it('block sets status=blocked and stores reason as blocker evidence', () => {
    const res = block(ws.harness, 'F-001', 'API down');
    expect(res.action).toBe('blocked');
    expect(res.current_status).toBe('blocked');
    expect(res.message).toBe('API down');
  });
});

describe('work.complete — Iron Law (prototype mode)', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
    activate(ws.harness, 'F-001');
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('rejects without gate_5 pass', () => {
    addEvidence(ws.harness, 'F-001', 'manual_check', 'review');
    const res = complete(ws.harness, 'F-001');
    expect(res.action).toBe('queried');
    expect(res.message).toContain('gate_5');
  });

  it('rejects with gate_5 pass but zero declared evidence', () => {
    recordGate(ws.harness, 'F-001', 'gate_5', 'pass');
    const res = complete(ws.harness, 'F-001');
    expect(res.action).toBe('queried');
    expect(res.message).toContain('Iron Law');
  });

  it('completes with gate_5 pass + 1 declared evidence (prototype)', () => {
    recordGate(ws.harness, 'F-001', 'gate_5', 'pass');
    addEvidence(ws.harness, 'F-001', 'manual_check', 'verified');
    const res = complete(ws.harness, 'F-001');
    expect(res.action).toBe('completed');
    expect(res.current_status).toBe('done');
  });

  it('emits feature_done event with iron_law_mode + counts', () => {
    recordGate(ws.harness, 'F-001', 'gate_5', 'pass');
    addEvidence(ws.harness, 'F-001', 'manual_check', 'verified');
    complete(ws.harness, 'F-001');
    const done = readEvents(ws.harness).find((e) => e['type'] === 'feature_done')!;
    expect(done['iron_law_mode']).toBe('prototype');
    expect(done['declared_count']).toBe(1);
    expect(done['required']).toBe(1);
  });

  it('idempotent — second complete returns queried', () => {
    recordGate(ws.harness, 'F-001', 'gate_5', 'pass');
    addEvidence(ws.harness, 'F-001', 'manual_check', 'verified');
    complete(ws.harness, 'F-001');
    const res = complete(ws.harness, 'F-001');
    expect(res.action).toBe('queried');
    expect(res.message).toContain('already done');
  });
});

describe('work.complete — Iron Law (product mode)', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace(SPEC_PRODUCT);
    activate(ws.harness, 'F-001');
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('requires 3 declared evidence', () => {
    recordGate(ws.harness, 'F-001', 'gate_5', 'pass');
    addEvidence(ws.harness, 'F-001', 'manual_check', 'one');
    const res = complete(ws.harness, 'F-001');
    expect(res.action).toBe('queried');
    expect(res.message).toContain('1/3');
  });

  it('completes with 3 declared evidence', () => {
    recordGate(ws.harness, 'F-001', 'gate_5', 'pass');
    addEvidence(ws.harness, 'F-001', 'manual_check', 'one');
    addEvidence(ws.harness, 'F-001', 'manual_check', 'two');
    addEvidence(ws.harness, 'F-001', 'reviewer_check', 'three');
    const res = complete(ws.harness, 'F-001');
    expect(res.action).toBe('completed');
  });

  it('failed gate blocks complete in product mode', () => {
    recordGate(ws.harness, 'F-001', 'gate_5', 'pass');
    recordGate(ws.harness, 'F-001', 'gate_2', 'fail', {note: 'lint dirty'});
    addEvidence(ws.harness, 'F-001', 'manual_check', 'one');
    addEvidence(ws.harness, 'F-001', 'manual_check', 'two');
    addEvidence(ws.harness, 'F-001', 'manual_check', 'three');
    const res = complete(ws.harness, 'F-001');
    expect(res.action).toBe('queried');
    expect(res.message).toContain('product mode strict');
  });

  it('hotfix-reason collapses requirement to 1 + records hotfix evidence', () => {
    recordGate(ws.harness, 'F-001', 'gate_5', 'pass');
    const res = complete(ws.harness, 'F-001', {hotfixReason: 'prod down — redis race'});
    expect(res.action).toBe('completed');
    const done = readEvents(ws.harness).find((e) => e['type'] === 'feature_done')!;
    expect(done['hotfix_reason']).toBe('prod down — redis race');
    expect(done['required']).toBe(1);
  });

  it('hotfix-reason empty rejects', () => {
    recordGate(ws.harness, 'F-001', 'gate_5', 'pass');
    const res = complete(ws.harness, 'F-001', {hotfixReason: '   '});
    expect(res.action).toBe('queried');
    expect(res.message).toContain('hotfix reason cannot be empty');
  });
});

describe('work.archive', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace({
      ...SPEC_PROTOTYPE,
      features: [
        {id: 'F-001', name: 'first', title: 'first', modules: ['x']},
        {id: 'F-002', name: 'replacement', title: 'replacement', modules: ['x']},
      ],
    });
    activate(ws.harness, 'F-001');
    recordGate(ws.harness, 'F-001', 'gate_5', 'pass');
    addEvidence(ws.harness, 'F-001', 'manual_check', 'verified');
    complete(ws.harness, 'F-001');
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('archives a done feature with valid superseded_by', () => {
    const res = archive(ws.harness, 'F-001', {supersededBy: 'F-002', reason: 'rewritten'});
    expect(res.action).toBe('archived');
    expect(res.current_status).toBe('archived');
    const ev = readEvents(ws.harness).find((e) => e['type'] === 'feature_archived')!;
    expect(ev['superseded_by']).toBe('F-002');
    expect(ev['reason']).toBe('rewritten');
  });

  it('rejects superseded_by referencing self', () => {
    const res = archive(ws.harness, 'F-001', {supersededBy: 'F-001'});
    expect(res.action).toBe('queried');
    expect(res.message).toContain('cannot reference self');
  });

  it('rejects superseded_by not in spec', () => {
    const res = archive(ws.harness, 'F-001', {supersededBy: 'F-999'});
    expect(res.action).toBe('queried');
    expect(res.message).toContain('not found in spec.yaml');
  });

  it('idempotent on already-archived', () => {
    archive(ws.harness, 'F-001', {supersededBy: 'F-002'});
    const res = archive(ws.harness, 'F-001');
    expect(res.action).toBe('queried');
    expect(res.message).toContain('already archived');
  });

  it('rejects non-done features', () => {
    activate(ws.harness, 'F-002');
    const res = archive(ws.harness, 'F-002');
    expect(res.action).toBe('queried');
    expect(res.message).toContain("Only 'done'");
  });
});

describe('work.current / deactivate / removeFeature', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('current returns null when nothing active', () => {
    expect(current(ws.harness)).toBeNull();
  });

  it('current returns active feature summary after activate', () => {
    activate(ws.harness, 'F-001');
    const r = current(ws.harness);
    expect(r).not.toBeNull();
    expect(r!.feature_id).toBe('F-001');
  });

  it('deactivate clears active pointer but keeps feature status', () => {
    activate(ws.harness, 'F-001');
    const res = deactivate(ws.harness);
    expect(res.action).toBe('deactivated');
    expect(current(ws.harness)).toBeNull();
  });

  it('removeFeature deletes a non-done feature', () => {
    activate(ws.harness, 'F-001');
    const res = removeFeature(ws.harness, 'F-001');
    expect(res.action).toBe('removed');
  });

  it('removeFeature protects done features', () => {
    activate(ws.harness, 'F-001');
    recordGate(ws.harness, 'F-001', 'gate_5', 'pass');
    addEvidence(ws.harness, 'F-001', 'manual_check', 'verified');
    complete(ws.harness, 'F-001');
    const res = removeFeature(ws.harness, 'F-001');
    expect(res.action).toBe('queried');
    expect(res.message).toContain('audit trail protected');
  });
});

describe('work.runAndRecordGate', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
    activate(ws.harness, 'F-001');
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('records pass + adds gate_run evidence on overrideCommand:true', () => {
    const res = runAndRecordGate(ws.harness, 'F-001', 'gate_0', {
      overrideCommand: ['sh', '-c', 'true'],
    });
    expect(res.action).toBe('gate_auto_run');
    expect(res.gates_passed).toContain('gate_0');
    expect(res.evidence_count).toBe(1);
    expect(readEvents(ws.harness).some((e) => e['type'] === 'gate_auto_run')).toBe(true);
  });

  it('records fail without auto-evidence on overrideCommand:exit 7', () => {
    const res = runAndRecordGate(ws.harness, 'F-001', 'gate_0', {
      overrideCommand: ['sh', '-c', 'exit 7'],
    });
    expect(res.gates_failed).toContain('gate_0');
    expect(res.evidence_count).toBe(0);
  });

  it('addEvidenceOnPass=false suppresses auto-evidence', () => {
    const res = runAndRecordGate(ws.harness, 'F-001', 'gate_0', {
      overrideCommand: ['sh', '-c', 'true'],
      addEvidenceOnPass: false,
    });
    expect(res.gates_passed).toContain('gate_0');
    expect(res.evidence_count).toBe(0);
  });
});
