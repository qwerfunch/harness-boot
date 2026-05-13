/**
 * F-171 — auto-detect routing for `harness init` (no flags).
 *
 * Asserts the four branches of {@link autoDetectScenario}:
 *
 *   - empty directory       → `skeleton-only`
 *   - `package.json` only   → `existing_code`
 *   - single `SPEC.md`      → `plan_doc`
 *   - both plan.md + code   → `plan_doc` (plan beats code per spec)
 *
 * The routing functions feed the no-flag CLI entry point; correctness
 * here is what makes "사용자가 요청하지 않아도 적시에 자동 수행"
 * actually feel automatic.
 */

import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {autoDetectScenario} from '../../src/init/autoDetect.js';

describe('autoDetectScenario (F-171)', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'autodetect-'));
  });

  afterEach(() => {
    rmSync(tmp, {recursive: true, force: true});
  });

  it('empty directory → skeleton-only', () => {
    const result = autoDetectScenario(tmp);
    expect(result.scenario).toBe('skeleton-only');
    expect(result.reason).toMatch(/no plan|no manifests/);
  });

  it('single plan.md → plan_doc', () => {
    writeFileSync(join(tmp, 'SPEC.md'), '# product spec\n', 'utf8');
    const result = autoDetectScenario(tmp);
    expect(result.scenario).toBe('plan_doc');
    expect(result.reason).toContain('SPEC.md');
  });

  it('README.md only → skeleton-only (README is in the non-plan list)', () => {
    writeFileSync(join(tmp, 'README.md'), '# proj\n', 'utf8');
    const result = autoDetectScenario(tmp);
    expect(result.scenario).toBe('skeleton-only');
  });

  it('manifest only (package.json) → existing_code', () => {
    writeFileSync(join(tmp, 'package.json'), '{"name":"x","version":"0.0.0"}\n', 'utf8');
    const result = autoDetectScenario(tmp);
    expect(result.scenario).toBe('existing_code');
    expect(result.reason).toContain('package.json');
  });

  it('src + tests directory layout → existing_code', () => {
    mkdirSync(join(tmp, 'src'), {recursive: true});
    mkdirSync(join(tmp, 'tests'), {recursive: true});
    writeFileSync(join(tmp, 'src', 'index.ts'), 'export {};', 'utf8');
    writeFileSync(join(tmp, 'tests', 'index.test.ts'), 'export {};', 'utf8');
    const result = autoDetectScenario(tmp);
    expect(result.scenario).toBe('existing_code');
  });

  it('plan.md + codebase → plan_doc wins (explicit intent beats inference)', () => {
    writeFileSync(join(tmp, 'SPEC.md'), '# product spec\n', 'utf8');
    writeFileSync(join(tmp, 'package.json'), '{"name":"x","version":"0.0.0"}\n', 'utf8');
    const result = autoDetectScenario(tmp);
    expect(result.scenario).toBe('plan_doc');
  });

  it('non-existent directory → skeleton-only (fail-safe fallback)', () => {
    const result = autoDetectScenario(join(tmp, 'does-not-exist'));
    expect(result.scenario).toBe('skeleton-only');
  });
});
