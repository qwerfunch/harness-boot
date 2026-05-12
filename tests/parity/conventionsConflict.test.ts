/**
 * Unit tests for `src/init/codebase/conflictResolver.ts` (F-161).
 *
 * Run via `npm test`.
 */

import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  CONVENTION_DOC_CANDIDATES,
  detectConventionDocs,
  resolveConventionConflict,
} from '../../src/init/codebase/conflictResolver.js';

describe('detectConventionDocs', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'conflict-'));
  });
  afterEach(() => {
    rmSync(tmp, {recursive: true, force: true});
  });

  it('returns empty when nothing is present', () => {
    expect(detectConventionDocs(tmp)).toEqual([]);
  });

  it('detects CLAUDE.md when present', () => {
    writeFileSync(join(tmp, 'CLAUDE.md'), '# project notes', 'utf8');
    expect(detectConventionDocs(tmp)).toContain('CLAUDE.md');
  });

  it('lists detected docs in candidate order', () => {
    writeFileSync(join(tmp, 'CLAUDE.md'), '', 'utf8');
    writeFileSync(join(tmp, 'AGENTS.md'), '', 'utf8');
    const detected = detectConventionDocs(tmp);
    expect(detected[0]).toBe(CONVENTION_DOC_CANDIDATES[0]);
  });
});

describe('resolveConventionConflict', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'conflict-'));
  });
  afterEach(() => {
    rmSync(tmp, {recursive: true, force: true});
  });

  it('coexist: writeStandalone=true when no docs detected', () => {
    const r = resolveConventionConflict(tmp, 'coexist', '# body');
    expect(r.writeStandalone).toBe(true);
    expect(r.detected).toEqual([]);
    expect(r.mergedInto).toBeNull();
  });

  it('coexist: writeStandalone=true even when docs are present', () => {
    writeFileSync(join(tmp, 'CLAUDE.md'), '# original\n', 'utf8');
    const r = resolveConventionConflict(tmp, 'coexist', '# body');
    expect(r.writeStandalone).toBe(true);
    expect(r.mergedInto).toBeNull();
    // CLAUDE.md left untouched.
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe('# original\n');
  });

  it('skip: writeStandalone=false and CLAUDE.md untouched', () => {
    writeFileSync(join(tmp, 'CLAUDE.md'), '# original\n', 'utf8');
    const r = resolveConventionConflict(tmp, 'skip', '# body');
    expect(r.writeStandalone).toBe(false);
    expect(r.mergedInto).toBeNull();
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe('# original\n');
  });

  it('merge: appends a user-edit-bounded block to CLAUDE.md', () => {
    writeFileSync(join(tmp, 'CLAUDE.md'), '# original notes\n', 'utf8');
    const r = resolveConventionConflict(tmp, 'merge', '## Stack\n- Runtime: node\n');
    expect(r.writeStandalone).toBe(false);
    expect(r.mergedInto).toBe('CLAUDE.md');
    const merged = readFileSync(join(tmp, 'CLAUDE.md'), 'utf8');
    expect(merged).toContain('# original notes');
    expect(merged).toContain('<!-- harness:user-edit-begin -->');
    expect(merged).toContain('## Conventions (auto-extracted, harness-boot)');
    expect(merged).toContain('Runtime: node');
    expect(merged).toContain('<!-- harness:user-edit-end -->');
  });

  it('merge: replaces an existing harness block instead of duplicating', () => {
    writeFileSync(
      join(tmp, 'CLAUDE.md'),
      '# notes\n\n<!-- harness:user-edit-begin -->\nold body\n<!-- harness:user-edit-end -->\n',
      'utf8',
    );
    resolveConventionConflict(tmp, 'merge', '## Stack\n- Runtime: deno\n');
    const merged = readFileSync(join(tmp, 'CLAUDE.md'), 'utf8');
    expect(merged.match(/harness:user-edit-begin/g)).toHaveLength(1);
    expect(merged).toContain('Runtime: deno');
    expect(merged).not.toContain('old body');
  });

  it('merge: falls back to AGENTS.md when CLAUDE.md absent', () => {
    writeFileSync(join(tmp, 'AGENTS.md'), '# agents notes\n', 'utf8');
    const r = resolveConventionConflict(tmp, 'merge', '## Stack\n- Runtime: bun\n');
    expect(r.mergedInto).toBe('AGENTS.md');
    expect(existsSync(join(tmp, 'CLAUDE.md'))).toBe(false);
    expect(readFileSync(join(tmp, 'AGENTS.md'), 'utf8')).toContain('Runtime: bun');
  });
});
