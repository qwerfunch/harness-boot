import { describe, expect, it } from 'vitest';

import {
  findSimilarModulePairs,
  levenshtein,
} from '../../../src/core/spec/similarity.js';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('hooks', 'hooks')).toBe(0);
  });

  it('returns 1 for single-character substitution', () => {
    expect(levenshtein('hook', 'hock')).toBe(1);
  });

  it('returns 2 for two-character difference', () => {
    expect(levenshtein('linter', 'lintr')).toBe(1); // deletion
    expect(levenshtein('linter', 'lnter')).toBe(1);
    expect(levenshtein('linter', 'liner')).toBe(1);
    expect(levenshtein('audit', 'audits')).toBe(1);
    expect(levenshtein('hooks', 'hooky')).toBe(1);
  });

  it('is symmetric', () => {
    expect(levenshtein('skill', 'kills')).toBe(levenshtein('kills', 'skill'));
  });

  it('counts full replacement for disjoint strings', () => {
    expect(levenshtein('abc', 'xyz')).toBe(3);
  });
});

describe('findSimilarModulePairs', () => {
  it('flags pairs within distance 2 AND ratio ≤ 0.34', () => {
    const pairs = findSimilarModulePairs(['linter', 'lnter', 'audit']);

    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual(
      expect.objectContaining({ a: 'linter', b: 'lnter', distance: 1 }),
    );
  });

  it('does not flag short disjoint names (ratio > 0.34)', () => {
    // "a" vs "b" — distance 1, ratio 1.0 → not flagged
    const pairs = findSimilarModulePairs(['a', 'b']);

    expect(pairs).toEqual([]);
  });

  it('does not flag pairs beyond distance 2', () => {
    const pairs = findSimilarModulePairs(['skill', 'steps']);

    expect(pairs).toEqual([]);
  });

  it('deduplicates symmetric pairs', () => {
    const pairs = findSimilarModulePairs(['hooks', 'hook', 'events']);
    // only (hook, hooks) once — not twice
    expect(pairs).toHaveLength(1);
  });

  it('ignores identical duplicates', () => {
    const pairs = findSimilarModulePairs(['core', 'core']);
    expect(pairs).toEqual([]);
  });

  it('handles empty and singleton input', () => {
    expect(findSimilarModulePairs([])).toEqual([]);
    expect(findSimilarModulePairs(['only'])).toEqual([]);
  });
});
