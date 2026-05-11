/**
 * Parity test for the F-140 transient retry path on
 * `src/drive/realTest.ts` + the loop's retry decision.
 *
 * Covers `readTransientRetryConfig` directly. The loop-level retry
 * behaviour is exercised through the existing drive loop tests.
 *
 * Run via `npm run test:parity`.
 */

import {existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  DEFAULT_MAX_TRANSIENT_RETRIES,
  readTransientRetryConfig,
} from '../../src/drive/realTest.js';

interface Workspace {
  dir: string;
  harness: string;
}

function makeWorkspace(): Workspace {
  const dir = mkdtempSync(join(tmpdir(), 'transient-'));
  const harness = join(dir, '.harness');
  mkdirSync(harness, {recursive: true});
  return {dir, harness};
}

function writeHarnessYaml(harness: string, body: string): void {
  writeFileSync(join(harness, 'harness.yaml'), body, 'utf-8');
}

describe('readTransientRetryConfig', () => {
  let ws: Workspace;
  beforeEach(() => {
    ws = makeWorkspace();
  });
  afterEach(() => {
    rmSync(ws.dir, {recursive: true, force: true});
  });

  it('returns enabled=true with default cap when harness.yaml is absent', () => {
    expect(existsSync(join(ws.harness, 'harness.yaml'))).toBe(false);
    const cfg = readTransientRetryConfig(ws.harness);
    expect(cfg.enabled).toBe(true);
    expect(cfg.cap).toBe(DEFAULT_MAX_TRANSIENT_RETRIES);
  });

  it('returns enabled=true with default cap when drive.real_test is absent', () => {
    writeHarnessYaml(ws.harness, 'drive: {}\n');
    const cfg = readTransientRetryConfig(ws.harness);
    expect(cfg.enabled).toBe(true);
    expect(cfg.cap).toBe(DEFAULT_MAX_TRANSIENT_RETRIES);
  });

  it('honours transient_retry: false (opt-out)', () => {
    writeHarnessYaml(
      ws.harness,
      'drive:\n  real_test:\n    command: "true"\n    transient_retry: false\n',
    );
    const cfg = readTransientRetryConfig(ws.harness);
    expect(cfg.enabled).toBe(false);
  });

  it('honours custom max_transient_retries', () => {
    writeHarnessYaml(
      ws.harness,
      'drive:\n  real_test:\n    command: "true"\n    max_transient_retries: 3\n',
    );
    const cfg = readTransientRetryConfig(ws.harness);
    expect(cfg.enabled).toBe(true);
    expect(cfg.cap).toBe(3);
  });

  it('clamps invalid cap (negative or non-number) to the default', () => {
    writeHarnessYaml(
      ws.harness,
      'drive:\n  real_test:\n    command: "true"\n    max_transient_retries: "abc"\n',
    );
    const cfg = readTransientRetryConfig(ws.harness);
    expect(cfg.cap).toBe(DEFAULT_MAX_TRANSIENT_RETRIES);
  });

  it('cap=0 disables retry effectively (kept for explicit opt-out)', () => {
    writeHarnessYaml(
      ws.harness,
      'drive:\n  real_test:\n    command: "true"\n    max_transient_retries: 0\n',
    );
    const cfg = readTransientRetryConfig(ws.harness);
    expect(cfg.cap).toBe(0);
  });
});
