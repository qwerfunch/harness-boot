/**
 * Unit tests for `src/init/codebase/mdDetect.ts` (F-162).
 *
 * Run via `npm test`.
 */

import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {detectPlanDocCandidate} from '../../src/init/codebase/mdDetect.js';

describe('detectPlanDocCandidate', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'md-detect-'));
  });
  afterEach(() => {
    rmSync(tmp, {recursive: true, force: true});
  });

  it('returns null on an empty directory', () => {
    expect(detectPlanDocCandidate(tmp)).toBeNull();
  });

  it('returns null when only README.md is present', () => {
    writeFileSync(join(tmp, 'README.md'), '# Hello', 'utf8');
    expect(detectPlanDocCandidate(tmp)).toBeNull();
  });

  it('returns null when CHANGELOG.md is present alongside README', () => {
    writeFileSync(join(tmp, 'README.md'), '# Hello', 'utf8');
    writeFileSync(join(tmp, 'CHANGELOG.md'), '# 1.0', 'utf8');
    expect(detectPlanDocCandidate(tmp)).toBeNull();
  });

  it('returns the single non-README md when exactly one exists', () => {
    writeFileSync(join(tmp, 'README.md'), '# Hello', 'utf8');
    writeFileSync(join(tmp, 'PLAN.md'), '# Plan', 'utf8');
    expect(detectPlanDocCandidate(tmp)).toBe('PLAN.md');
  });

  it('returns the md candidate even without README', () => {
    writeFileSync(join(tmp, 'PRODUCT_BRIEF.md'), '# Brief', 'utf8');
    expect(detectPlanDocCandidate(tmp)).toBe('PRODUCT_BRIEF.md');
  });

  it('returns null when two non-README mds are present', () => {
    writeFileSync(join(tmp, 'README.md'), '# Hello', 'utf8');
    writeFileSync(join(tmp, 'PLAN.md'), '# Plan', 'utf8');
    writeFileSync(join(tmp, 'ARCHITECTURE.md'), '# Arch', 'utf8');
    expect(detectPlanDocCandidate(tmp)).toBeNull();
  });

  it('ignores LICENSE / CONTRIBUTING / SECURITY by name', () => {
    writeFileSync(join(tmp, 'LICENSE.md'), 'MIT', 'utf8');
    writeFileSync(join(tmp, 'CONTRIBUTING.md'), 'see PR', 'utf8');
    writeFileSync(join(tmp, 'SECURITY.md'), 'report to ...', 'utf8');
    writeFileSync(join(tmp, 'IDEA.md'), '# Idea', 'utf8');
    expect(detectPlanDocCandidate(tmp)).toBe('IDEA.md');
  });

  it('is case-insensitive for the non-plan filter', () => {
    writeFileSync(join(tmp, 'Readme.md'), '# Hello', 'utf8');
    writeFileSync(join(tmp, 'PLAN.md'), '# Plan', 'utf8');
    expect(detectPlanDocCandidate(tmp)).toBe('PLAN.md');
  });

  it('returns null when only non-plan docs exist', () => {
    writeFileSync(join(tmp, 'README.md'), '# Hello', 'utf8');
    writeFileSync(join(tmp, 'CHANGELOG.md'), '# 1.0', 'utf8');
    writeFileSync(join(tmp, 'LICENSE.md'), 'MIT', 'utf8');
    expect(detectPlanDocCandidate(tmp)).toBeNull();
  });
});
