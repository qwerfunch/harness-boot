/**
 * Unit tests for `src/init/codebase/conventionsFill.ts` (F-163).
 *
 * Run via `npm test`.
 */

import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve as resolvePath} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  fillConventionsSection,
  hasPendingPlaceholder,
  SectionAlreadyFilledError,
} from '../../src/init/codebase/conventionsFill.js';
import {writeConventions} from '../../src/init/codebase/conventionsWriter.js';
import {collectSignals} from '../../src/init/codebase/signals.js';

const NPM_FIXTURE = resolvePath(__dirname, '..', 'perf', 'fixtures', 'npm');

describe('fillConventionsSection', () => {
  let tmp: string;
  let conventionsPath: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'fill-'));
    conventionsPath = join(tmp, 'conventions.md');
    // Seed with a real conventions.md so we exercise the placeholder pattern.
    writeConventions(collectSignals(NPM_FIXTURE), conventionsPath);
  });

  afterEach(() => {
    rmSync(tmp, {recursive: true, force: true});
  });

  it('replaces the comments placeholder with supplied text', () => {
    const text = '- JSDoc on exported functions only\n- English, single-line preferred';
    fillConventionsSection(conventionsPath, 'comments', text);
    const body = readFileSync(conventionsPath, 'utf8');
    expect(body).toContain('JSDoc on exported functions only');
    expect(body).not.toContain('[pending: LLM hook stub — PR 3b fills sample-driven comment');
  });

  it('replaces the tests placeholder with supplied text', () => {
    const text = '- AAA pattern, fixtures via builder functions';
    fillConventionsSection(conventionsPath, 'tests', text);
    const body = readFileSync(conventionsPath, 'utf8');
    expect(body).toContain('AAA pattern, fixtures via builder functions');
    expect(body).not.toContain('[pending: LLM hook stub — PR 3b fills sample-driven test-pattern');
  });

  it('leaves the other placeholder intact when only one is filled', () => {
    fillConventionsSection(conventionsPath, 'comments', '- filled comments');
    const body = readFileSync(conventionsPath, 'utf8');
    expect(body).toContain('filled comments');
    expect(body).toContain('[pending: LLM hook stub — PR 3b fills sample-driven test-pattern');
  });

  it('preserves the harness:fact sigils and user-edit guard', () => {
    const before = readFileSync(conventionsPath, 'utf8');
    const sigilCount = (before.match(/<!-- harness:fact key=/g) ?? []).length;
    const guardCount = (before.match(/<!-- harness:user-edit-begin -->/g) ?? []).length;
    fillConventionsSection(conventionsPath, 'comments', '- filled');
    const after = readFileSync(conventionsPath, 'utf8');
    expect((after.match(/<!-- harness:fact key=/g) ?? []).length).toBe(sigilCount);
    expect((after.match(/<!-- harness:user-edit-begin -->/g) ?? []).length).toBe(guardCount);
  });

  it('throws SectionAlreadyFilledError when fill is called twice', () => {
    fillConventionsSection(conventionsPath, 'comments', '- once');
    expect(() => fillConventionsSection(conventionsPath, 'comments', '- twice')).toThrow(
      SectionAlreadyFilledError,
    );
  });

  it('throws when the body has been hand-edited to remove the placeholder', () => {
    const body = readFileSync(conventionsPath, 'utf8').replace(
      /> _\[pending: LLM hook stub — PR 3b fills sample-driven comment-style detection\]_/,
      '> _custom comments — user edited_',
    );
    writeFileSync(conventionsPath, body, 'utf8');
    expect(() => fillConventionsSection(conventionsPath, 'comments', '- new')).toThrow(
      SectionAlreadyFilledError,
    );
  });
});

describe('hasPendingPlaceholder', () => {
  it('returns true for a freshly-written conventions body', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'fill-'));
    const path = join(tmp, 'conventions.md');
    writeConventions(collectSignals(NPM_FIXTURE), path);
    const body = readFileSync(path, 'utf8');
    expect(hasPendingPlaceholder(body, 'comments')).toBe(true);
    expect(hasPendingPlaceholder(body, 'tests')).toBe(true);
    rmSync(tmp, {recursive: true, force: true});
  });

  it('returns false after a fill', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'fill-'));
    const path = join(tmp, 'conventions.md');
    writeConventions(collectSignals(NPM_FIXTURE), path);
    fillConventionsSection(path, 'comments', '- filled');
    const body = readFileSync(path, 'utf8');
    expect(hasPendingPlaceholder(body, 'comments')).toBe(false);
    expect(hasPendingPlaceholder(body, 'tests')).toBe(true);
    rmSync(tmp, {recursive: true, force: true});
  });
});
