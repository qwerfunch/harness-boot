/**
 * Unit tests for `src/init/skeleton.ts` (F-158).
 *
 * Covers:
 *
 *   - `runSkeletonInit()` writes the three starter templates plus
 *     `events.log` into `<target>/.harness/` and returns the expected
 *     result shape (4 files, llmCallCount = 0).
 *   - Wall time is bounded — < 500 ms even on a cold filesystem.
 *   - Refuses to overwrite an existing `.harness/spec.yaml`.
 *   - `events.log` carries one JSON line with `type =
 *     harness_initialized` and `origin = skeleton-only`.
 *
 * Run via `npm test`.
 */

import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve as resolvePath} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {runSkeletonInit} from '../../src/init/skeleton.js';

const PLUGIN_ROOT = resolvePath(__dirname, '..', '..');

describe('runSkeletonInit', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'harness-skeleton-'));
  });

  afterEach(() => {
    rmSync(tmp, {recursive: true, force: true});
  });

  it('writes spec.yaml · harness.yaml · state.yaml · events.log + CLAUDE.md (F-171)', () => {
    const result = runSkeletonInit({targetDir: tmp, pluginRoot: PLUGIN_ROOT});
    // F-171 — CLAUDE.md auto-copy adds a 5th file.
    expect(result.filesWritten).toHaveLength(5);
    expect(result.llmCallCount).toBe(0);
    expect(existsSync(join(tmp, '.harness', 'spec.yaml'))).toBe(true);
    expect(existsSync(join(tmp, '.harness', 'harness.yaml'))).toBe(true);
    expect(existsSync(join(tmp, '.harness', 'state.yaml'))).toBe(true);
    expect(existsSync(join(tmp, '.harness', 'events.log'))).toBe(true);
    expect(existsSync(join(tmp, 'CLAUDE.md'))).toBe(true);
    expect(result.claudeMdWritten).toBe(true);
  });

  it('F-171 — preserves an existing CLAUDE.md (skip-if-exists)', () => {
    const existingPath = join(tmp, 'CLAUDE.md');
    writeFileSync(existingPath, '# pre-existing\n', 'utf8');
    const result = runSkeletonInit({targetDir: tmp, pluginRoot: PLUGIN_ROOT});
    expect(result.claudeMdWritten).toBe(false);
    // File content unchanged.
    expect(readFileSync(existingPath, 'utf8')).toBe('# pre-existing\n');
    // The file is NOT included in filesWritten when we didn't touch it.
    expect(result.filesWritten).toHaveLength(4);
  });

  it('completes in under 500 ms (regression gate anchor)', () => {
    const result = runSkeletonInit({targetDir: tmp, pluginRoot: PLUGIN_ROOT});
    expect(result.wallTimeMs).toBeLessThan(500);
  });

  it('refuses to overwrite an existing spec.yaml', () => {
    runSkeletonInit({targetDir: tmp, pluginRoot: PLUGIN_ROOT});
    expect(() => runSkeletonInit({targetDir: tmp, pluginRoot: PLUGIN_ROOT})).toThrow(
      /already exists/,
    );
  });

  it('writes one harness_initialized event line with origin=skeleton-only', () => {
    runSkeletonInit({
      targetDir: tmp,
      pluginRoot: PLUGIN_ROOT,
      now: '2026-05-12T00:00:00Z',
      pluginVersion: '0.15.4',
    });
    const log = readFileSync(join(tmp, '.harness', 'events.log'), 'utf8');
    const lines = log.split('\n').filter((line) => line.length > 0);
    expect(lines).toHaveLength(1);
    const event = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(event['type']).toBe('harness_initialized');
    expect(event['origin']).toBe('skeleton-only');
    expect(event['plugin_version']).toBe('0.15.4');
    expect(event['mode']).toBe('solo');
  });

  it('respects mode=team', () => {
    runSkeletonInit({
      targetDir: tmp,
      pluginRoot: PLUGIN_ROOT,
      mode: 'team',
      now: '2026-05-12T00:00:00Z',
    });
    const log = readFileSync(join(tmp, '.harness', 'events.log'), 'utf8');
    const event = JSON.parse(log.trim()) as Record<string, unknown>;
    expect(event['mode']).toBe('team');
  });

  it('throws a useful error when the plugin root is wrong', () => {
    const bogus = mkdtempSync(join(tmpdir(), 'harness-skeleton-bad-'));
    try {
      writeFileSync(join(bogus, '.gitkeep'), '', 'utf8'); // ensure it's just an empty dir
      expect(() => runSkeletonInit({targetDir: tmp, pluginRoot: bogus})).toThrow();
    } finally {
      rmSync(bogus, {recursive: true, force: true});
    }
  });
});
