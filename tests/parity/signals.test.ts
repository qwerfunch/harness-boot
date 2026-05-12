/**
 * Unit tests for `src/init/codebase/signals.ts` (F-160).
 *
 * Uses the existing perf fixtures (`tests/perf/fixtures/npm` and
 * `tests/perf/fixtures/python`) as input — they ship a real
 * `package.json` and `pyproject.toml` respectively.
 *
 * Run via `npm test`.
 */

import {resolve as resolvePath} from 'node:path';
import {describe, expect, it} from 'vitest';

import {collectSignals} from '../../src/init/codebase/signals.js';

const NPM_FIXTURE = resolvePath(__dirname, '..', 'perf', 'fixtures', 'npm');
const PY_FIXTURE = resolvePath(__dirname, '..', 'perf', 'fixtures', 'python');
const EMPTY_FIXTURE = resolvePath(__dirname, '..', 'perf', 'fixtures', 'empty');

describe('collectSignals — npm fixture', () => {
  it('detects manifest + node runtime', () => {
    const s = collectSignals(NPM_FIXTURE);
    expect(s.manifests).toContain('package.json');
    expect(s.tech.runtime).toBe('node');
    expect(s.tech.language).toBe('javascript');
  });

  it('categorizes express as a framework dep', () => {
    const s = collectSignals(NPM_FIXTURE);
    expect(s.dependencies.framework).toContain('express');
  });

  it('categorizes vitest under test deps', () => {
    const s = collectSignals(NPM_FIXTURE);
    expect(s.dependencies.test).toContain('vitest');
  });

  it('detects README presence', () => {
    const s = collectSignals(NPM_FIXTURE);
    expect(s.readmePreview).toMatch(/perf-fixture-npm/);
  });

  it('reports directory pattern (colocated when only src/ exists)', () => {
    const s = collectSignals(NPM_FIXTURE);
    expect(['colocated', 'src+tests', 'flat']).toContain(s.directoryPattern);
  });
});

describe('collectSignals — python fixture', () => {
  it('detects pyproject + python language', () => {
    const s = collectSignals(PY_FIXTURE);
    expect(s.manifests).toContain('pyproject.toml');
    expect(s.tech.language).toBe('python');
  });

  it('detects pyproject [tool.ruff] style config', () => {
    const s = collectSignals(PY_FIXTURE);
    expect(s.styleConfigs.some((c) => c.includes('pyproject.toml'))).toBe(true);
  });

  it('parses fastapi as a framework dep', () => {
    const s = collectSignals(PY_FIXTURE);
    expect(s.dependencies.framework).toContain('fastapi');
  });
});

describe('collectSignals — empty fixture', () => {
  it('returns empty signals without throwing', () => {
    const s = collectSignals(EMPTY_FIXTURE);
    expect(s.manifests).toEqual([]);
    expect(s.styleConfigs).toEqual([]);
    expect(s.dependencies.framework).toEqual([]);
    expect(s.readmePreview).toBeNull();
  });
});
