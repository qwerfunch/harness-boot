/**
 * Unit tests for `src/init/scenarioPlanDoc.ts` (F-162).
 *
 * Run via `npm test`.
 */

import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve as resolvePath} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {parse as yamlParse} from 'yaml';

import {runSkeletonInit} from '../../src/init/skeleton.js';
import {seedSpecFromPlanDoc} from '../../src/init/scenarioPlanDoc.js';

const PLUGIN_ROOT = resolvePath(__dirname, '..', '..');

const SAMPLE_PLAN = `# Pomodoro Timer for Solo Musicians

A 25/5 minute timer with instrument-specific warmup recommendations
for solo practice sessions.

## Users

- Classical musicians
- Indie songwriters
`;

const PLAN_WITH_SECRET = `# Demo App

API key for the demo provider: sk-abcdefghijklmnopqrstuvwx

This is a placeholder description.
`;

describe('seedSpecFromPlanDoc', () => {
  let tmp: string;
  let mdPath: string;
  let specPath: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'plan-doc-'));
    runSkeletonInit({targetDir: tmp, pluginRoot: PLUGIN_ROOT});
    specPath = join(tmp, '.harness', 'spec.yaml');
    mdPath = join(tmp, 'PLAN.md');
  });

  afterEach(() => {
    rmSync(tmp, {recursive: true, force: true});
  });

  it('copies the first H1 into project.name', () => {
    writeFileSync(mdPath, SAMPLE_PLAN, 'utf8');
    const result = seedSpecFromPlanDoc({mdPath, specPath, projectRoot: tmp});
    expect(result.projectName).toBe('Pomodoro Timer for Solo Musicians');
  });

  it('uses the first paragraph as the summary', () => {
    writeFileSync(mdPath, SAMPLE_PLAN, 'utf8');
    const result = seedSpecFromPlanDoc({mdPath, specPath, projectRoot: tmp});
    expect(result.summary).toMatch(/25\/5 minute timer/);
  });

  it('stamps metadata.source.plan_doc_path with the relative path', () => {
    writeFileSync(mdPath, SAMPLE_PLAN, 'utf8');
    const result = seedSpecFromPlanDoc({mdPath, specPath, projectRoot: tmp});
    expect(result.planDocPath).toBe('PLAN.md');
  });

  it('writes spec.yaml carrying source.origin=plan_doc and draft=true', () => {
    writeFileSync(mdPath, SAMPLE_PLAN, 'utf8');
    const result = seedSpecFromPlanDoc({mdPath, specPath, projectRoot: tmp});
    writeFileSync(specPath, result.specYaml, 'utf8');
    const parsed = yamlParse(readFileSync(specPath, 'utf8')) as Record<string, unknown>;
    const meta = parsed['metadata'] as Record<string, unknown>;
    const source = meta['source'] as Record<string, unknown>;
    expect(source['origin']).toBe('plan_doc');
    expect(source['plan_doc_path']).toBe('PLAN.md');
    expect(meta['draft']).toBe(true);
    expect(typeof meta['content_hash']).toBe('string');
  });

  it('redacts credentials before they land in the spec', () => {
    writeFileSync(mdPath, PLAN_WITH_SECRET, 'utf8');
    const result = seedSpecFromPlanDoc({mdPath, specPath, projectRoot: tmp});
    expect(result.summary).not.toContain('sk-abcdefghijklmnopqrstuvwx');
    expect(result.specYaml).not.toContain('sk-abcdefghijklmnopqrstuvwx');
    expect(result.specYaml).toContain('[REDACTED: openai-key]');
  });

  it('falls back to the filename when no H1 exists', () => {
    writeFileSync(mdPath, 'A plain description without a heading.', 'utf8');
    const result = seedSpecFromPlanDoc({mdPath, specPath, projectRoot: tmp});
    expect(result.projectName).toBe('PLAN');
  });

  it('produces a deterministic content_hash given the same input', () => {
    writeFileSync(mdPath, SAMPLE_PLAN, 'utf8');
    const a = seedSpecFromPlanDoc({mdPath, specPath, projectRoot: tmp});
    // Overwrite spec.yaml with skeleton again to repeat the seed step.
    rmSync(join(tmp, '.harness'), {recursive: true, force: true});
    runSkeletonInit({targetDir: tmp, pluginRoot: PLUGIN_ROOT});
    const b = seedSpecFromPlanDoc({mdPath, specPath, projectRoot: tmp});
    expect(b.contentHash).toBe(a.contentHash);
  });
});
