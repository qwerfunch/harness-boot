/**
 * Integration test for the draft auto-promotion hook (F-159 AC-3).
 *
 * Boots a temp `.harness/` via `runSkeletonInit`, drops a draft
 * spec written by `generateIdeaSpec` into it, runs the `activate()`
 * lifecycle, and asserts:
 *
 *   - First activate keeps `draft: true` (hash still matches).
 *   - After a user edit, the next activate flips `draft` to `false`
 *     and drops `content_hash`.
 *   - A `spec_promoted` event lands in `events.log`.
 *   - Promotion is idempotent — a subsequent activate doesn't
 *     re-fire the event.
 *
 * Run via `npm test`.
 */

import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve as resolvePath} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {parse as yamlParse} from 'yaml';

import {generateIdeaSpec} from '../../src/init/scenarioIdea.js';
import {runSkeletonInit} from '../../src/init/skeleton.js';
import {activate} from '../../src/work.js';

const PLUGIN_ROOT = resolvePath(__dirname, '..', '..');

describe('draft auto-promotion on activate', () => {
  let tmp: string;
  let harnessDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'harness-draft-'));
    const skel = runSkeletonInit({targetDir: tmp, pluginRoot: PLUGIN_ROOT});
    harnessDir = skel.harnessDir;
    const draft = generateIdeaSpec({
      name: 'demo',
      vision: 'demo project',
      features: ['alpha', 'beta', 'gamma'],
      mode: 'prototype',
      qualityFocus: [],
    });
    writeFileSync(join(harnessDir, 'spec.yaml'), draft.specYaml, 'utf8');
  });

  afterEach(() => {
    rmSync(tmp, {recursive: true, force: true});
  });

  function readSpec(): Record<string, unknown> {
    return yamlParse(readFileSync(join(harnessDir, 'spec.yaml'), 'utf8')) as Record<
      string,
      unknown
    >;
  }

  function specPromotedEvents(): number {
    if (!existsSync(join(harnessDir, 'events.log'))) return 0;
    const log = readFileSync(join(harnessDir, 'events.log'), 'utf8');
    return log
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((evt) => evt['type'] === 'spec_promoted').length;
  }

  it('keeps draft=true when the user has not edited spec.yaml', () => {
    activate(harnessDir, 'F-1');
    const meta = readSpec()['metadata'] as Record<string, unknown>;
    expect(meta['draft']).toBe(true);
    expect(typeof meta['content_hash']).toBe('string');
    expect(specPromotedEvents()).toBe(0);
  });

  it('flips draft to false + drops content_hash + writes spec_promoted on edit', () => {
    const specPath = join(harnessDir, 'spec.yaml');
    // Simulate a user edit.
    const original = readFileSync(specPath, 'utf8');
    writeFileSync(specPath, original.replace('demo project', 'demo (user-tweaked)'), 'utf8');

    activate(harnessDir, 'F-1');

    const meta = readSpec()['metadata'] as Record<string, unknown>;
    expect(meta['draft']).toBe(false);
    expect(meta['content_hash']).toBeUndefined();
    expect(specPromotedEvents()).toBe(1);
  });

  it('promotion is idempotent', () => {
    const specPath = join(harnessDir, 'spec.yaml');
    const original = readFileSync(specPath, 'utf8');
    writeFileSync(specPath, original.replace('demo project', 'edited once'), 'utf8');

    activate(harnessDir, 'F-1');
    activate(harnessDir, 'F-1');

    expect(specPromotedEvents()).toBe(1);
  });
});
