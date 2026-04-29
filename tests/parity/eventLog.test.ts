/**
 * Parity test for `src/core/eventLog.ts` (F-085).
 *
 * For each fixture under `tests/parity/fixtures/event_log/<name>/`,
 * the Python helper (`generate_fixtures.py`) snapshotted:
 *
 *   - `initial.json` — the harness directory state before rotation
 *     (filename → contents map).
 *   - `now_yyyymm.txt` — the rotation boundary used.
 *   - `read_expected.json` — the ordered events `read_events` yields
 *     against the initial state.
 *   - `expected_post_state.json` — the directory contents Python's
 *     `rotate()` produced.
 *   - `expected_moved.json` — the move map `rotate()` returned.
 *
 * The TS test reproduces each initial state on a fresh tmp dir, runs
 * `rotate()` and `readEvents()`, and asserts byte-equal output.
 *
 * Run via `npm run test:parity`.
 */

import {mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {beforeEach, describe, expect, it} from 'vitest';

import {parseYyyymmFromTs, readEvents, rotate} from '../../src/core/eventLog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(__dirname, 'fixtures', 'event_log');

interface FixtureBundle {
  name: string;
  initial: Record<string, string>;
  nowYyyymm: string;
  readExpected: Array<Record<string, unknown>>;
  expectedPostState: Record<string, string>;
  expectedMoved: Record<string, number>;
}

/** Loads every fixture directory under `tests/parity/fixtures/event_log/`. */
function loadFixtures(): FixtureBundle[] {
  const out: FixtureBundle[] = [];
  for (const name of readdirSync(FIXTURES_ROOT).sort()) {
    const fixtureDir = join(FIXTURES_ROOT, name);
    const initialPath = join(fixtureDir, 'initial.json');
    let initialRaw: string;
    try {
      initialRaw = readFileSync(initialPath, 'utf-8');
    } catch {
      // Skip non-fixture entries (e.g. generate_fixtures.py at the root).
      continue;
    }
    const initial = JSON.parse(initialRaw) as Record<string, string>;
    const nowYyyymm = readFileSync(join(fixtureDir, 'now_yyyymm.txt'), 'utf-8').trim();
    const readExpected = JSON.parse(
      readFileSync(join(fixtureDir, 'read_expected.json'), 'utf-8'),
    ) as Array<Record<string, unknown>>;
    const expectedPostState = JSON.parse(
      readFileSync(join(fixtureDir, 'expected_post_state.json'), 'utf-8'),
    ) as Record<string, string>;
    const expectedMoved = JSON.parse(
      readFileSync(join(fixtureDir, 'expected_moved.json'), 'utf-8'),
    ) as Record<string, number>;
    out.push({
      name,
      initial,
      nowYyyymm,
      readExpected,
      expectedPostState,
      expectedMoved,
    });
  }
  return out;
}

/** Materializes a {filename: contents} dict into a fresh directory. */
function writeInitialState(target: string, initial: Record<string, string>): void {
  for (const [name, contents] of Object.entries(initial)) {
    writeFileSync(join(target, name), contents, 'utf-8');
  }
}

/** Returns events.log + every events.log.YYYYMM file as a content map. */
function captureState(target: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(target).sort()) {
    if (name === 'events.log' || /^events\.log\.\d{6}$/.test(name)) {
      out[name] = readFileSync(join(target, name), 'utf-8');
    }
  }
  return out;
}

describe('eventLog parity (Python ↔ TypeScript)', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'eventlog-parity-'));
  });

  const fixtures = loadFixtures();

  it('discovers fixtures', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(5);
  });

  for (const fx of fixtures) {
    it(`rotate() matches Python output: ${fx.name}`, () => {
      writeInitialState(workDir, fx.initial);
      const moved = rotate(workDir, {nowYyyymm: fx.nowYyyymm});

      // Move map equals Python output exactly.
      expect(moved).toEqual(fx.expectedMoved);

      // Disk contents equal Python output byte-for-byte.
      const after = captureState(workDir);
      expect(after).toEqual(fx.expectedPostState);

      rmSync(workDir, {recursive: true, force: true});
    });

    it(`readEvents() matches Python order: ${fx.name}`, () => {
      writeInitialState(workDir, fx.initial);

      const events = Array.from(readEvents(workDir));
      expect(events).toEqual(fx.readExpected);

      rmSync(workDir, {recursive: true, force: true});
    });

    it(`rotate() is idempotent: ${fx.name}`, () => {
      writeInitialState(workDir, fx.initial);
      rotate(workDir, {nowYyyymm: fx.nowYyyymm});
      const firstState = captureState(workDir);

      // A second rotation finds nothing to do because all moveable
      // events were already split out on the first call.
      const secondMoved = rotate(workDir, {nowYyyymm: fx.nowYyyymm});
      expect(secondMoved).toEqual({});

      const secondState = captureState(workDir);
      expect(secondState).toEqual(firstState);

      rmSync(workDir, {recursive: true, force: true});
    });
  }
});

describe('eventLog edge cases', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'eventlog-edge-'));
  });

  it('returns empty array when harness dir does not exist', () => {
    const missing = join(workDir, 'does-not-exist');
    const events = Array.from(readEvents(missing));
    expect(events).toEqual([]);

    const moved = rotate(missing);
    expect(moved).toEqual({});

    rmSync(workDir, {recursive: true, force: true});
  });

  it('rotate dryRun does not modify disk', () => {
    const log = join(workDir, 'events.log');
    const initial =
      JSON.stringify({ts: '2026-02-01T00:00:00Z', type: 'old'}) +
      '\n' +
      JSON.stringify({ts: '2026-04-01T00:00:00Z', type: 'cur'}) +
      '\n';
    writeFileSync(log, initial, 'utf-8');

    const moved = rotate(workDir, {nowYyyymm: '202604', dryRun: true});
    expect(moved).toEqual({'202602': 1});

    // Disk untouched.
    expect(readFileSync(log, 'utf-8')).toBe(initial);

    // No bucket file created.
    const entries = readdirSync(workDir);
    expect(entries.includes('events.log.202602')).toBe(false);

    rmSync(workDir, {recursive: true, force: true});
  });

  it('parseYyyymmFromTs returns null on unparseable input', () => {
    expect(parseYyyymmFromTs('not-an-iso')).toBeNull();
    expect(parseYyyymmFromTs('')).toBeNull();
    expect(parseYyyymmFromTs(undefined)).toBeNull();
    expect(parseYyyymmFromTs(null)).toBeNull();
    expect(parseYyyymmFromTs(42)).toBeNull();
  });

  it('parseYyyymmFromTs extracts YYYYMM from ISO 8601', () => {
    expect(parseYyyymmFromTs('2026-04-15T03:14:00Z')).toBe('202604');
    expect(parseYyyymmFromTs('1999-12-31T23:59:59+09:00')).toBe('199912');
  });

  it('rotate appends to pre-existing bucket file', () => {
    writeFileSync(
      join(workDir, 'events.log.202602'),
      JSON.stringify({ts: '2026-02-15T00:00:00Z', type: 'historical'}) + '\n',
      'utf-8',
    );
    writeFileSync(
      join(workDir, 'events.log'),
      JSON.stringify({ts: '2026-02-20T00:00:00Z', type: 'new_feb'}) + '\n',
      'utf-8',
    );

    rotate(workDir, {nowYyyymm: '202604'});

    const bucket = readFileSync(join(workDir, 'events.log.202602'), 'utf-8');
    // Both events present — historical first (pre-existing), new_feb appended.
    expect(bucket).toContain('historical');
    expect(bucket).toContain('new_feb');
    expect(bucket.indexOf('historical')).toBeLessThan(bucket.indexOf('new_feb'));

    rmSync(workDir, {recursive: true, force: true});
  });
});
