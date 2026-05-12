/**
 * Perf bench for the init UX overhaul (F-158).
 *
 * Anchors the regression gate **before** scenario 1 / 2 / 3 land:
 * runs `runSkeletonInit()` against four fixtures (empty · plan-md ·
 * npm · python) and compares the measured `init_wall_time_ms` and
 * `init_tokens_total` against the committed baseline in
 * `init-baseline.json`. Fails on:
 *
 *   - `init_wall_time_ms` > baseline × 1.20  (regression gate)
 *   - `init_tokens_total` > baseline × 1.30
 *   - `spec_field_coverage_pct` below baseline (monotonic
 *     non-decrease rule)
 *
 * Skeleton-only path has zero LLM calls, so `init_tokens_total` is
 * always 0 in this PR. Token plumbing arrives with scenario 1.
 *
 * Run via `npm run test:perf`.
 */

import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve as resolvePath} from 'node:path';
import {describe, expect, it} from 'vitest';
import {parse as yamlParse} from 'yaml';

import {runSkeletonInit} from '../../src/init/skeleton.js';

const PLUGIN_ROOT = resolvePath(__dirname, '..', '..');
const FIXTURES = resolvePath(__dirname, 'fixtures');
const BASELINE_PATH = resolvePath(__dirname, 'init-baseline.json');
const REQUIRED_SPEC_FIELDS: ReadonlyArray<string> = [
  'project',
  'constraints',
  'domain',
  'features',
];

/** Baseline shape committed to disk. */
interface Baseline {
  readonly version: number;
  readonly scenario: string;
  readonly fixtures: Record<string, FixtureBaseline>;
  readonly thresholds: {
    readonly wall_time_multiplier: number;
    readonly tokens_multiplier: number;
  };
}

interface FixtureBaseline {
  readonly init_wall_time_ms: number;
  readonly init_tokens_total: number;
  readonly spec_field_coverage_pct: number;
}

interface MeasuredFixture extends FixtureBaseline {
  readonly llm_call_count: number;
}

function copyFixture(src: string): string {
  const tmp = mkdtempSync(join(tmpdir(), 'init-bench-'));
  // Recursive copy without spawning a shell — uses cp -a equivalent.
  // Node 20 supports `fs.cp` with `recursive`.
  const {cpSync} = require('node:fs') as typeof import('node:fs');
  cpSync(src, tmp, {recursive: true});
  return tmp;
}

function loadSpecCoverage(targetDir: string): number {
  const specPath = join(targetDir, '.harness', 'spec.yaml');
  if (!existsSync(specPath)) return 0;
  const raw = readFileSync(specPath, 'utf8');
  const parsed = yamlParse(raw) as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== 'object') return 0;
  let present = 0;
  for (const field of REQUIRED_SPEC_FIELDS) {
    const value = parsed[field];
    if (value !== undefined && value !== null) present += 1;
  }
  return Math.round((present / REQUIRED_SPEC_FIELDS.length) * 100);
}

function measure(fixtureName: string): MeasuredFixture {
  const fixtureSrc = join(FIXTURES, fixtureName);
  const target = copyFixture(fixtureSrc);
  try {
    const result = runSkeletonInit({targetDir: target, pluginRoot: PLUGIN_ROOT});
    return {
      init_wall_time_ms: result.wallTimeMs,
      init_tokens_total: 0,
      spec_field_coverage_pct: loadSpecCoverage(target),
      llm_call_count: result.llmCallCount,
    };
  } finally {
    rmSync(target, {recursive: true, force: true});
  }
}

function loadBaseline(): Baseline {
  const raw = readFileSync(BASELINE_PATH, 'utf8');
  return JSON.parse(raw) as Baseline;
}

describe('init bench (scenario: skeleton-only)', () => {
  const baseline = loadBaseline();
  const fixtureNames = Object.keys(baseline.fixtures);

  it('baseline file is sane', () => {
    expect(baseline.version).toBeGreaterThanOrEqual(1);
    expect(baseline.scenario).toBe('skeleton-only');
    expect(fixtureNames.length).toBe(4);
    expect(baseline.thresholds.wall_time_multiplier).toBeGreaterThan(1);
    expect(baseline.thresholds.tokens_multiplier).toBeGreaterThan(1);
  });

  for (const name of ['empty', 'plan-md', 'npm', 'python']) {
    it(`fixture: ${name}`, () => {
      const measured = measure(name);
      const expected = baseline.fixtures[name]!;

      // Always zero LLM calls on the skeleton-only path.
      expect(measured.llm_call_count).toBe(0);
      expect(measured.init_tokens_total).toBe(0);

      // Wall time: regression gate — wall +20 %.
      const wallCeiling =
        Math.max(expected.init_wall_time_ms, 50) * baseline.thresholds.wall_time_multiplier;
      expect(measured.init_wall_time_ms).toBeLessThan(wallCeiling);

      // Tokens: regression gate — tokens +30 %.
      const tokensCeiling = Math.max(
        expected.init_tokens_total * baseline.thresholds.tokens_multiplier,
        0,
      );
      expect(measured.init_tokens_total).toBeLessThanOrEqual(tokensCeiling);

      // Spec coverage: monotonic non-decrease.
      expect(measured.spec_field_coverage_pct).toBeGreaterThanOrEqual(
        expected.spec_field_coverage_pct,
      );
    });
  }
});
