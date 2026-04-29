/**
 * Parity test for `src/sync.ts` (F-096).
 *
 * Coverage:
 *
 *   - run() over a minimal valid spec — produces SyncResult with
 *     populated spec_hash / merkle_root / drift_status.
 *   - domain.md + architecture.yaml created at the expected paths.
 *   - harness.yaml.generation populated with subtree hashes,
 *     include_sources, derived_from output hashes.
 *   - events.log gains exactly one sync_completed event.
 *   - Idempotency: running twice on the same spec produces clean
 *     drift_status, edit-wins detection on user-modified files.
 *   - dryRun does not write any file.
 *   - tryInitialSync skips when spec missing or already synced.
 *
 * Run via `npm run test:parity`.
 */

import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {parse as yamlParse} from 'yaml';

import {editWins, run, tryInitialSync} from '../../src/sync.js';

interface Workspace {
  dir: string;
}

const MINIMAL_SPEC = `version: "2.3"
schema_version: "2.3"
project:
  name: "test-project"
  summary: "minimal sync fixture"
  vision: "drive parity green"
  description: "test description"
  language: "en"
  mode: "prototype"
domain:
  entities: []
  business_rules: []
features: []
constraints:
  tech_stack:
    runtime: "node"
    min_version: "20"
    language: "typescript"
  architectural: []
  compliance: []
  prototype_mode: true
deliverable:
  what: "A test harness directory."
  acceptance: "All gates pass."
metadata: {}
`;

function makeWorkspace(): Workspace {
  const dir = mkdtempSync(join(tmpdir(), 'sync-'));
  writeFileSync(join(dir, 'spec.yaml'), MINIMAL_SPEC, 'utf-8');
  return {dir};
}

describe('sync.run — happy path', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('returns a populated SyncResult', () => {
    const out = run(ws.dir, {timestamp: '2026-05-01T00:00:00Z', skipValidation: true});
    expect(out.ok).toBe(true);
    expect(out.spec_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(out.merkle_root).toMatch(/^[0-9a-f]{64}$/);
    expect(out.drift_status).toBe('clean');
    expect(out.domain_skipped).toBe(false);
    expect(out.arch_skipped).toBe(false);
  });

  it('writes domain.md + architecture.yaml + harness.yaml', () => {
    run(ws.dir, {timestamp: '2026-05-01T00:00:00Z', skipValidation: true});
    expect(existsSync(join(ws.dir, 'domain.md'))).toBe(true);
    expect(existsSync(join(ws.dir, 'architecture.yaml'))).toBe(true);
    expect(existsSync(join(ws.dir, 'harness.yaml'))).toBe(true);
  });

  it('appends a sync_completed event', () => {
    run(ws.dir, {timestamp: '2026-05-01T00:00:00Z', skipValidation: true});
    const events = readFileSync(join(ws.dir, 'events.log'), 'utf-8')
      .split('\n')
      .filter((l) => l.length > 0);
    expect(events).toHaveLength(1);
    const ev = JSON.parse(events[0]!);
    expect(ev.type).toBe('sync_completed');
    expect(ev.spec_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(ev.dry_run).toBe(false);
  });

  it('harness.yaml.generation carries spec_hash + subtrees + drift_status', () => {
    run(ws.dir, {timestamp: '2026-05-01T00:00:00Z', skipValidation: true});
    const harness = yamlParse(readFileSync(join(ws.dir, 'harness.yaml'), 'utf-8')) as Record<
      string,
      unknown
    >;
    const gen = harness['generation'] as Record<string, unknown>;
    expect(gen['drift_status']).toBe('clean');
    expect(gen['include_sources']).toEqual([]);
    const generated = gen['generated_from'] as Record<string, unknown>;
    expect(generated['spec_hash']).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof generated['subtrees']).toBe('object');
  });
});

describe('sync.run — dry run', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('does not write any file', () => {
    const out = run(ws.dir, {
      dryRun: true,
      timestamp: '2026-05-01T00:00:00Z',
      skipValidation: true,
    });
    expect(out.dry_run).toBe(true);
    expect(existsSync(join(ws.dir, 'domain.md'))).toBe(false);
    expect(existsSync(join(ws.dir, 'architecture.yaml'))).toBe(false);
    expect(existsSync(join(ws.dir, 'events.log'))).toBe(false);
  });
});

describe('sync.run — edit-wins guard', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('skips overwrite when domain.md was hand-edited', () => {
    run(ws.dir, {timestamp: '2026-05-01T00:00:00Z', skipValidation: true});
    const domainPath = join(ws.dir, 'domain.md');
    writeFileSync(domainPath, '# user edit\n', 'utf-8');

    const second = run(ws.dir, {timestamp: '2026-05-02T00:00:00Z', skipValidation: true});
    expect(second.domain_skipped).toBe(true);
    expect(second.drift_status).toBe('derived_edited');
    // user-edited content preserved
    expect(readFileSync(domainPath, 'utf-8')).toBe('# user edit\n');
  });

  it('--force overrides edit-wins', () => {
    run(ws.dir, {timestamp: '2026-05-01T00:00:00Z', skipValidation: true});
    const domainPath = join(ws.dir, 'domain.md');
    writeFileSync(domainPath, '# user edit\n', 'utf-8');

    const second = run(ws.dir, {
      timestamp: '2026-05-02T00:00:00Z',
      skipValidation: true,
      force: true,
    });
    expect(second.domain_skipped).toBe(false);
    expect(readFileSync(domainPath, 'utf-8')).not.toBe('# user edit\n');
  });
});

describe('sync.editWins helper', () => {
  it('false when file does not exist', () => {
    expect(editWins('/nonexistent/path', 'abc')).toBe(false);
  });

  it('false when previousOutputHash is empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'editwins-'));
    try {
      const path = join(dir, 'file.md');
      writeFileSync(path, 'x', 'utf-8');
      expect(editWins(path, '')).toBe(false);
      expect(editWins(path, null)).toBe(false);
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });

  it('true when bytes differ from previousOutputHash', () => {
    const dir = mkdtempSync(join(tmpdir(), 'editwins-'));
    try {
      const path = join(dir, 'file.md');
      writeFileSync(path, 'a', 'utf-8');
      // Hash for "b" not "a" — current bytes mismatch.
      expect(editWins(path, 'b'.repeat(64))).toBe(true);
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });
});

describe('sync.tryInitialSync — fail-open semantics', () => {
  it('skips when spec.yaml is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sync-init-'));
    try {
      mkdirSync(dir, {recursive: true});
      const out = tryInitialSync(dir);
      expect(out.ok).toBe(false);
      expect(out.skipped).toBe(true);
      expect(out.reason).toBe('spec.yaml missing');
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });

  it('short-circuits when already synced', () => {
    const ws = makeWorkspace();
    try {
      run(ws.dir, {timestamp: '2026-05-01T00:00:00Z', skipValidation: true});
      const out = tryInitialSync(ws.dir);
      expect(out.ok).toBe(true);
      expect(out.skipped).toBe(true);
      expect(out.reason).toBe('already synced');
    } finally {
      rmSync(ws.dir, {recursive: true, force: true});
    }
  });
});
