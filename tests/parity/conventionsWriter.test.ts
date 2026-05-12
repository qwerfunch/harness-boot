/**
 * Unit tests for `src/init/codebase/conventionsWriter.ts` (F-160).
 *
 * Run via `npm test`.
 */

import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve as resolvePath} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {collectSignals} from '../../src/init/codebase/signals.js';
import {writeConventions} from '../../src/init/codebase/conventionsWriter.js';

const NPM_FIXTURE = resolvePath(__dirname, '..', 'perf', 'fixtures', 'npm');
const PY_FIXTURE = resolvePath(__dirname, '..', 'perf', 'fixtures', 'python');
const EMPTY_FIXTURE = resolvePath(__dirname, '..', 'perf', 'fixtures', 'empty');

describe('writeConventions', () => {
  let tmp: string;
  let outputPath: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'conv-'));
    outputPath = join(tmp, 'conventions.md');
  });

  afterEach(() => {
    rmSync(tmp, {recursive: true, force: true});
  });

  it('renders the seven mandatory sections for an npm project', () => {
    const result = writeConventions(collectSignals(NPM_FIXTURE), outputPath);
    expect(result.body).toContain('## Stack');
    expect(result.body).toContain('## Style');
    expect(result.body).toContain('## Rules');
    expect(result.body).toContain('## Comments');
    expect(result.body).toContain('## Tests');
    expect(result.body).toContain('## Imports');
    expect(result.body).toContain('## Directory');
  });

  it('stamps every fact line with a harness:fact sigil', () => {
    const result = writeConventions(collectSignals(NPM_FIXTURE), outputPath);
    expect(result.factCount).toBeGreaterThan(0);
    const sigils = result.body.match(/<!-- harness:fact key=/g) ?? [];
    expect(sigils.length).toBe(result.factCount);
  });

  it('keeps Comments and Tests as LLM hook stubs in PR 3a', () => {
    const result = writeConventions(collectSignals(NPM_FIXTURE), outputPath);
    expect(result.body).toContain('[pending: LLM hook stub');
  });

  it('emits a user-edit guard block', () => {
    const result = writeConventions(collectSignals(NPM_FIXTURE), outputPath);
    expect(result.body).toContain('<!-- harness:user-edit-begin -->');
    expect(result.body).toContain('<!-- harness:user-edit-end -->');
  });

  it('records express as a framework fact for npm fixture', () => {
    const result = writeConventions(collectSignals(NPM_FIXTURE), outputPath);
    expect(result.body).toMatch(/key=deps\.framework\s+value=express/);
  });

  it('records fastapi as a framework fact for python fixture', () => {
    const result = writeConventions(collectSignals(PY_FIXTURE), outputPath);
    expect(result.body).toMatch(/key=deps\.framework\s+value=fastapi/);
  });

  it('produces byte-identical output for the same signals', () => {
    const a = writeConventions(collectSignals(NPM_FIXTURE), outputPath);
    const b = writeConventions(collectSignals(NPM_FIXTURE), outputPath);
    expect(a.body).toBe(b.body);
    expect(readFileSync(outputPath, 'utf8')).toBe(a.body);
  });

  it('renders a usable file even for an empty project', () => {
    const result = writeConventions(collectSignals(EMPTY_FIXTURE), outputPath);
    expect(result.body).toContain('## Stack');
    expect(result.body).toContain('## Directory');
    // No facts on an empty fixture.
    expect(result.factCount).toBe(1); // directory_pattern stays present
  });
});
