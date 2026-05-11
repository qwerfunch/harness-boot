/**
 * Parity test for `src/spec/exportSpec.ts` (F-131).
 *
 * Covers:
 *
 *   - Idempotent passthrough (no `--active-only`) — the yaml round-
 *     trip is byte-equal at the parsed-object level.
 *   - Active-only compaction — done / archived features get the AC
 *     placeholder + truncated description, active features pass
 *     through unchanged.
 *   - CQS — spec.yaml + state.yaml mtime invariance.
 *
 * Run via `npm run test:parity`.
 */

import {mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {parse as yamlParse, stringify as yamlStringify} from 'yaml';

import {DESCRIPTION_TRUNCATE_AT, compactDescription, exportSpec} from '../../src/spec/exportSpec.js';

interface Workspace {
  dir: string;
  harness: string;
}

function makeSpecFixture(): Record<string, unknown> {
  return {
    version: '2.3',
    schema_version: '2.3',
    project: {name: 'export-test', summary: 'fixture', mode: 'prototype'},
    domain: {one_liner: 'fixture'},
    features: [
      {
        id: 'F-001',
        name: 'walking skeleton',
        type: 'skeleton',
        description: 'Boot the system end-to-end. Long body follows.\nSecond line stays out.',
        acceptance_criteria: ['AC-1: gate_5 passes on a hello-world endpoint.'],
      },
      {
        id: 'F-002',
        name: 'shipped feature with three AC',
        type: 'feature',
        description:
          'This shipped feature description is intentionally written to overflow the truncation cap so the test can exercise the ellipsis suffix path. Padding padding padding padding.',
        acceptance_criteria: [
          'AC-1: thing one.',
          'AC-2: thing two.',
          'AC-3: thing three.',
        ],
      },
      {
        id: 'F-003',
        name: 'active feature still in progress',
        type: 'feature',
        description: 'Short description.',
        acceptance_criteria: ['AC-1: still doing the work.', 'AC-2: not yet shipped.'],
      },
    ],
  };
}

function makeStateFixture(): Record<string, unknown> {
  return {
    version: '2.3',
    schema_version: '2.3',
    features: [
      {id: 'F-001', status: 'done', evidence: [], gates: {}},
      {id: 'F-002', status: 'done', evidence: [], gates: {}},
      {id: 'F-003', status: 'in_progress', evidence: [], gates: {}},
    ],
    session: {started_at: null, last_command: '', last_gate_passed: null, active_feature_id: null},
  };
}

function makeWorkspace(spec: object, state: object | null): Workspace {
  const dir = mkdtempSync(join(tmpdir(), 'export-'));
  const harness = join(dir, '.harness');
  mkdirSync(harness, {recursive: true});
  writeFileSync(join(harness, 'spec.yaml'), yamlStringify(spec), 'utf-8');
  if (state !== null) {
    writeFileSync(join(harness, 'state.yaml'), yamlStringify(state), 'utf-8');
  }
  return {dir, harness};
}

describe('exportSpec — passthrough (no --active-only)', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace(makeSpecFixture(), makeStateFixture());
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('round-trips the spec at the parsed-object level', () => {
    const out = exportSpec(ws.harness);
    const parsedOut = yamlParse(out);
    const parsedIn = makeSpecFixture();
    expect(parsedOut).toEqual(parsedIn);
  });

  it('returns the same output for repeated calls', () => {
    expect(exportSpec(ws.harness)).toBe(exportSpec(ws.harness));
  });
});

describe('exportSpec — --active-only compaction', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace(makeSpecFixture(), makeStateFixture());
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('replaces shipped features acceptance_criteria with the placeholder', () => {
    const out = yamlParse(exportSpec(ws.harness, {activeOnly: true})) as {
      features: Array<Record<string, unknown>>;
    };
    const f001 = out.features.find((f) => f['id'] === 'F-001')!;
    expect(f001['acceptance_criteria']).toEqual(['(1 criteria — see spec.yaml history)']);
    const f002 = out.features.find((f) => f['id'] === 'F-002')!;
    expect(f002['acceptance_criteria']).toEqual(['(3 criteria — see spec.yaml history)']);
  });

  it('truncates a long shipped description to the first line + ellipsis', () => {
    const out = yamlParse(exportSpec(ws.harness, {activeOnly: true})) as {
      features: Array<Record<string, unknown>>;
    };
    const f002 = out.features.find((f) => f['id'] === 'F-002')!;
    const desc = f002['description'] as string;
    expect(desc.length).toBe(DESCRIPTION_TRUNCATE_AT + 1);
    expect(desc.endsWith('…')).toBe(true);
  });

  it('preserves a short shipped description without truncation', () => {
    const out = yamlParse(exportSpec(ws.harness, {activeOnly: true})) as {
      features: Array<Record<string, unknown>>;
    };
    const f001 = out.features.find((f) => f['id'] === 'F-001')!;
    expect(f001['description']).toBe('Boot the system end-to-end. Long body follows.');
  });

  it('passes active features through verbatim', () => {
    const out = yamlParse(exportSpec(ws.harness, {activeOnly: true})) as {
      features: Array<Record<string, unknown>>;
    };
    const f003Out = out.features.find((f) => f['id'] === 'F-003')!;
    const features = makeSpecFixture()['features'] as Array<Record<string, unknown>>;
    const f003In = features.find((f) => f['id'] === 'F-003')!;
    expect(f003Out['acceptance_criteria']).toEqual(f003In['acceptance_criteria']);
    expect(f003Out['description']).toEqual(f003In['description']);
  });

  it('treats every feature as active when state.yaml is missing', () => {
    const wsNoState = makeWorkspace(makeSpecFixture(), null);
    try {
      const out = yamlParse(exportSpec(wsNoState.harness, {activeOnly: true})) as {
        features: Array<Record<string, unknown>>;
      };
      const f001 = out.features.find((f) => f['id'] === 'F-001')!;
      expect(Array.isArray(f001['acceptance_criteria'])).toBe(true);
      expect((f001['acceptance_criteria'] as unknown[]).length).toBe(1);
      // Without state.yaml, F-001 stays full-fat: original AC body.
      expect(f001['acceptance_criteria']).toEqual([
        'AC-1: gate_5 passes on a hello-world endpoint.',
      ]);
    } finally {
      rmSync(wsNoState.dir, {recursive: true, force: true});
    }
  });
});

describe('exportSpec — CQS / mtime invariance (BR-012)', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace(makeSpecFixture(), makeStateFixture());
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('does not modify spec.yaml or state.yaml during export', () => {
    const specPath = join(ws.harness, 'spec.yaml');
    const statePath = join(ws.harness, 'state.yaml');
    const specMtime = statSync(specPath).mtimeMs;
    const stateMtime = statSync(statePath).mtimeMs;
    exportSpec(ws.harness, {activeOnly: true});
    expect(statSync(specPath).mtimeMs).toBe(specMtime);
    expect(statSync(statePath).mtimeMs).toBe(stateMtime);
  });
});

describe('compactDescription — boundary cases', () => {
  it('returns the empty string for blank input', () => {
    expect(compactDescription('')).toBe('');
    expect(compactDescription('   \n  ')).toBe('');
  });

  it('returns the line untouched when at the cap', () => {
    const at = 'a'.repeat(DESCRIPTION_TRUNCATE_AT);
    expect(compactDescription(at)).toBe(at);
  });

  it('appends the ellipsis when one character past the cap', () => {
    const over = 'a'.repeat(DESCRIPTION_TRUNCATE_AT + 1);
    expect(compactDescription(over)).toBe('a'.repeat(DESCRIPTION_TRUNCATE_AT) + '…');
  });
});
