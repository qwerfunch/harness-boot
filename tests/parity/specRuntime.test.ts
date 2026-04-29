/**
 * Parity test for `src/spec/{includeExpander,modeClassifier}.ts` (F-090).
 *
 * Coverage:
 *
 *   - includeExpander: depth-1 enforcement, locked-field guard,
 *     traversal escape rejection, missing-file error, deep-copy
 *     safety, no-op when no $include is present.
 *   - modeClassifier: priority order matches Python decision tree
 *     for all 7 branches.
 *
 * Run via `npm run test:parity`.
 */

import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  IncludeError,
  LOCKED_FIELD_NAMES,
  expand,
  findIncludes,
  resolveChaptersDir,
} from '../../src/spec/includeExpander.js';
import {Mode, classify} from '../../src/spec/modeClassifier.js';

describe('includeExpander parity', () => {
  let workDir: string;
  let chaptersDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'include-'));
    chaptersDir = join(workDir, 'chapters');
    mkdirSync(chaptersDir, {recursive: true});
  });
  afterEach(() => {
    rmSync(workDir, {recursive: true, force: true});
  });

  it('returns the same object when no $include is present', () => {
    const spec = {project: {name: 'x', description: 'inline'}};
    expect(expand(spec, chaptersDir)).toBe(spec);
  });

  it('expands a single $include with depth-1 (nested $include is literal)', () => {
    writeFileSync(
      join(chaptersDir, 'desc.md'),
      'real content\n$include: "nested.md"\nliteral text',
      'utf-8',
    );
    const spec = {project: {description: {$include: 'desc.md'}}};
    const out = expand(spec, chaptersDir) as {project: {description: string}};
    expect(out.project.description).toContain('real content');
    // Nested $include is preserved as a literal string, not re-expanded.
    expect(out.project.description).toContain('$include: "nested.md"');
  });

  it('does not mutate the original spec object', () => {
    writeFileSync(join(chaptersDir, 'a.md'), 'A', 'utf-8');
    const spec = {project: {description: {$include: 'a.md'}}};
    const original = JSON.parse(JSON.stringify(spec));
    expand(spec, chaptersDir);
    expect(spec).toEqual(original);
  });

  it('rejects $include under each LOCKED_FIELD name', () => {
    writeFileSync(join(chaptersDir, 'val.md'), 'forbidden', 'utf-8');
    for (const field of LOCKED_FIELD_NAMES) {
      const spec = {[field]: {$include: 'val.md'}};
      expect(() => expand(spec, chaptersDir)).toThrow(IncludeError);
    }
  });

  it('allow-locked override skips the locked-field guard', () => {
    writeFileSync(join(chaptersDir, 'val.md'), 'forbidden', 'utf-8');
    const spec = {id: {$include: 'val.md'}};
    expect(() =>
      expand(spec, chaptersDir, {strictLockedFields: false}),
    ).not.toThrow();
  });

  it('rejects absolute-path $include values', () => {
    writeFileSync(join(chaptersDir, 'val.md'), 'x', 'utf-8');
    const spec = {project: {description: {$include: '/etc/passwd'}}};
    expect(() => expand(spec, chaptersDir)).toThrow(IncludeError);
  });

  it('rejects traversal escapes that leave the chapters directory', () => {
    writeFileSync(join(workDir, 'outside.md'), 'leaked', 'utf-8');
    const spec = {project: {description: {$include: '../outside.md'}}};
    expect(() => expand(spec, chaptersDir)).toThrow(IncludeError);
  });

  it('rejects missing target files with IncludeError', () => {
    const spec = {project: {description: {$include: 'does-not-exist.md'}}};
    expect(() => expand(spec, chaptersDir)).toThrow(IncludeError);
  });

  it('treats multi-key mappings with $include as plain data, not includes', () => {
    const spec = {project: {description: {$include: 'desc.md', extra: 'x'}}};
    expect(findIncludes(spec)).toHaveLength(0);
  });

  it('expands list members independently', () => {
    writeFileSync(join(chaptersDir, 'a.md'), 'AAA', 'utf-8');
    writeFileSync(join(chaptersDir, 'b.md'), 'BBB', 'utf-8');
    const spec = {features: [{$include: 'a.md'}, {$include: 'b.md'}]};
    const out = expand(spec, chaptersDir) as {features: string[]};
    expect(out.features).toEqual(['AAA', 'BBB']);
  });

  it('resolveChaptersDir picks .harness/chapters when present', () => {
    const specPath = join(workDir, 'spec.yaml');
    writeFileSync(specPath, '', 'utf-8');
    const harness = join(workDir, '.harness', 'chapters');
    mkdirSync(harness, {recursive: true});
    expect(resolveChaptersDir(specPath)).toBe(harness);
  });

  it('resolveChaptersDir falls back to ./chapters when .harness is missing', () => {
    const tmp2 = mkdtempSync(join(tmpdir(), 'include2-'));
    try {
      const specPath = join(tmp2, 'spec.yaml');
      writeFileSync(specPath, '', 'utf-8');
      const fallback = join(tmp2, 'chapters');
      mkdirSync(fallback);
      expect(resolveChaptersDir(specPath)).toBe(fallback);
    } finally {
      rmSync(tmp2, {recursive: true, force: true});
    }
  });

  it('respects an explicit override', () => {
    expect(resolveChaptersDir('/somewhere/spec.yaml', '/explicit/path')).toBe(
      '/explicit/path',
    );
  });
});

describe('modeClassifier parity', () => {
  it('explicit --mode A wins over heuristics', () => {
    const r = classify({args: ['--mode', 'A'], specExists: false});
    expect(r.mode).toBe(Mode.ADDITION);
    expect(r.rationale).toContain('explicit --mode');
  });

  it('explicit --mode E wins even with explain text', () => {
    const r = classify({args: ['--mode', 'E', '--explain']});
    expect(r.mode).toBe(Mode.EXPLAIN);
  });

  it('rejects unknown --mode value', () => {
    expect(() => classify({args: ['--mode', 'Z']})).toThrow(/unknown --mode/);
  });

  it('--explain flag → Mode E', () => {
    const r = classify({args: ['--explain'], specExists: true});
    expect(r.mode).toBe(Mode.EXPLAIN);
  });

  it('explain intent text → Mode E', () => {
    const r = classify({intentText: 'please describe this feature'});
    expect(r.mode).toBe(Mode.EXPLAIN);
  });

  it('spec missing + plan.md → Mode B baseline-from-plan', () => {
    const r = classify({args: ['plan.md'], specExists: false});
    expect(r.mode).toBe(Mode.BASELINE);
    expect(r.subtype).toBe('baseline-from-plan');
  });

  it('spec missing + sparse intent (1-39 words) → baseline-empty-vague', () => {
    const r = classify({specExists: false, intentText: 'login flow improvements'});
    expect(r.mode).toBe(Mode.BASELINE);
    expect(r.subtype).toBe('baseline-empty-vague');
  });

  it('spec missing + no intent → baseline-empty', () => {
    const r = classify({specExists: false});
    expect(r.subtype).toBe('baseline-empty');
  });

  it('spec missing + long intent (≥40 words) → baseline-empty', () => {
    const long = 'word '.repeat(45);
    const r = classify({specExists: false, intentText: long});
    expect(r.subtype).toBe('baseline-empty');
  });

  it('spec exists + addition hint (Korean) → Mode A', () => {
    const r = classify({specExists: true, intentText: '새 피처 추가'});
    expect(r.mode).toBe(Mode.ADDITION);
  });

  it('spec exists + addition hint (English add) → Mode A', () => {
    const r = classify({specExists: true, intentText: 'add a logout button'});
    expect(r.mode).toBe(Mode.ADDITION);
  });

  it('spec exists + neutral intent → Mode R (refine)', () => {
    const r = classify({specExists: true, intentText: 'tweak copy'});
    expect(r.mode).toBe(Mode.REFINE);
  });
});
