/**
 * Parity test for `src/cli/harness.ts` (F-104).
 *
 * Coverage focuses on parsing surface and exit-code semantics —
 * actual subsystem behaviour is exercised by the per-module parity
 * tests, so this file checks that subcommands wire up correctly,
 * options are parsed, and errors propagate to the right exit code.
 *
 * We invoke the CLI as a function (not a child process) so we can
 * intercept stdout/stderr without spawning Node.
 *
 * Run via `npm run test:parity`.
 */

import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {stringify as yamlStringify} from 'yaml';

import {main as cliMain} from '../../src/cli/harness.js';

interface CliRun {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function captureRun(argv: ReadonlyArray<string>): CliRun {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  let exitCode = 0;

  const stdoutSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array): boolean => {
      stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
      return true;
    });
  const stderrSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((chunk: string | Uint8Array): boolean => {
      stderrChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
      return true;
    });
  const exitSpy = vi
    .spyOn(process, 'exit')
    .mockImplementation((code?: string | number | null): never => {
      exitCode = typeof code === 'number' ? code : 0;
      throw new Error('__exit__');
    });

  try {
    cliMain(['node', 'harness', ...argv]);
  } catch (err) {
    if ((err as Error).message !== '__exit__') {
      throw err;
    }
  } finally {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  }

  return {
    stdout: stdoutChunks.join(''),
    stderr: stderrChunks.join(''),
    exitCode,
  };
}

interface Workspace {
  dir: string;
  harness: string;
}

const SAMPLE_SPEC = {
  version: '2.3',
  schema_version: '2.3',
  project: {name: 'cli-test', mode: 'prototype'},
  features: [
    {
      id: 'F-001',
      name: 'first',
      title: 'first',
      modules: ['core/x'],
    },
  ],
};

function makeWorkspace(): Workspace {
  const dir = mkdtempSync(join(tmpdir(), 'cli-'));
  const harness = join(dir, '.harness');
  mkdirSync(harness, {recursive: true});
  writeFileSync(join(harness, 'spec.yaml'), yamlStringify(SAMPLE_SPEC), 'utf-8');
  return {dir, harness};
}

describe('cli — work subcommand', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('no args + no harness dir → exit 2', () => {
    const r = captureRun(['work', '--harness-dir', '/nonexistent']);
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toContain('not found');
  });

  it('no feature arg → dashboard renders', () => {
    const r = captureRun(['work', '--harness-dir', ws.harness]);
    expect(r.stdout).toContain('📊');
  });

  it('feature id activates and prints summary', () => {
    const r = captureRun(['work', 'F-001', '--harness-dir', ws.harness]);
    expect(r.stdout).toContain('activated');
    expect(r.stdout).toContain('F-001');
  });

  it('--current returns no active when nothing activated', () => {
    const r = captureRun(['work', '--current', '--harness-dir', ws.harness]);
    expect(r.stdout).toContain('no active feature');
  });

  it('--evidence appends evidence row', () => {
    captureRun(['work', 'F-001', '--harness-dir', ws.harness]);
    const r = captureRun([
      'work',
      'F-001',
      '--harness-dir',
      ws.harness,
      '--evidence',
      'reviewer eyeball',
      '--kind',
      'manual_check',
    ]);
    expect(r.stdout).toContain('evidence_added');
  });

  it('--block transitions to blocked', () => {
    captureRun(['work', 'F-001', '--harness-dir', ws.harness]);
    const r = captureRun(['work', 'F-001', '--harness-dir', ws.harness, '--block', 'API down']);
    expect(r.stdout).toContain('blocked');
  });

  it('--complete without gate_5 returns queried', () => {
    captureRun(['work', 'F-001', '--harness-dir', ws.harness]);
    const r = captureRun(['work', 'F-001', '--harness-dir', ws.harness, '--complete']);
    expect(r.stdout).toContain('gate_5');
  });

  it('F-120 — --gate <name> <result> records the gate (commander variadic fix)', () => {
    captureRun(['work', 'F-001', '--harness-dir', ws.harness]);
    const r = captureRun([
      'work',
      'F-001',
      '--harness-dir',
      ws.harness,
      '--gate',
      'gate_5',
      'pass',
      '--note',
      'smoke OK',
    ]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('gate_5');
    expect(r.stdout).toContain('passed: gate_5');
  });

  it('F-120 — --gate with one value fails the cardinality guard', () => {
    captureRun(['work', 'F-001', '--harness-dir', ws.harness]);
    const r = captureRun(['work', 'F-001', '--harness-dir', ws.harness, '--gate', 'gate_5']);
    expect(r.exitCode).toBe(3);
    expect(r.stderr).toContain('--gate takes two values');
  });

  it('--run-gate with override exit-zero passes', () => {
    captureRun(['work', 'F-001', '--harness-dir', ws.harness]);
    const r = captureRun([
      'work',
      'F-001',
      '--harness-dir',
      ws.harness,
      '--run-gate',
      'gate_0',
      '--override-command',
      'sh -c true',
    ]);
    expect(r.stdout).toContain('PASS');
    expect(r.exitCode).toBe(0);
  });

  it('--json emits machine-readable summary', () => {
    captureRun(['work', 'F-001', '--harness-dir', ws.harness]);
    const r = captureRun(['work', 'F-001', '--current', '--harness-dir', ws.harness, '--json']);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.feature_id).toBe('F-001');
  });
});

describe('cli — status subcommand', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
    captureRun(['work', 'F-001', '--harness-dir', ws.harness]);
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('emits human-readable summary', () => {
    const r = captureRun(['status', '--harness-dir', ws.harness]);
    expect(r.stdout).toContain('📋');
  });

  it('--json emits structured payload', () => {
    const r = captureRun(['status', '--harness-dir', ws.harness, '--json']);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.session.active_feature_id).toBe('F-001');
  });
});

describe('cli — events subcommand', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
    captureRun(['work', 'F-001', '--harness-dir', ws.harness]);
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('lists events.log entries', () => {
    const r = captureRun(['events', '--harness-dir', ws.harness]);
    expect(r.stdout).toContain('feature_activated');
  });

  it('--kind filter narrows output', () => {
    const r = captureRun([
      'events',
      '--harness-dir',
      ws.harness,
      '--kind',
      'feature_activated',
      '--json',
    ]);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.length).toBeGreaterThan(0);
    for (const ev of parsed) {
      expect(ev.type).toBe('feature_activated');
    }
  });
});

describe('cli — metrics subcommand', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
    captureRun(['work', 'F-001', '--harness-dir', ws.harness]);
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('emits the metrics header in human mode', () => {
    const r = captureRun(['metrics', '--harness-dir', ws.harness]);
    expect(r.stdout).toContain('📊 /harness:metrics');
  });

  it('--json emits structured report', () => {
    const r = captureRun(['metrics', '--harness-dir', ws.harness, '--json']);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.total_events).toBeGreaterThan(0);
  });
});

describe('cli — check subcommand', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('exits 6 when drift findings exist', () => {
    const r = captureRun(['check', '--harness-dir', ws.harness]);
    // empty harness has at least Generated drift (missing harness.yaml)
    expect(r.exitCode).toBe(6);
  });

  it('--json emits structured drift report', () => {
    const r = captureRun(['check', '--harness-dir', ws.harness, '--json']);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.findings).toBeInstanceOf(Array);
    expect(parsed.checked).toContain('Generated');
  });
});

describe('cli — sync subcommand', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('--soft never exits non-zero even on missing harness', () => {
    const r = captureRun(['sync', '--soft', '--harness-dir', '/nonexistent']);
    expect(r.exitCode).toBe(0);
  });

  it('--soft on populated harness reports skipped/synced', () => {
    const r = captureRun([
      'sync',
      '--soft',
      '--harness-dir',
      ws.harness,
    ]);
    expect(r.stdout).toContain('sync (initial)');
    expect(r.exitCode).toBe(0);
  });
});

describe('cli — validate subcommand', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('exits 5 on schema-violating spec', () => {
    const bad = join(ws.dir, 'bad.yaml');
    writeFileSync(bad, 'project: not-a-mapping\n', 'utf-8');
    const r = captureRun(['validate', bad]);
    expect(r.exitCode).toBe(5);
  });
});
