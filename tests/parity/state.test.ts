/**
 * Parity test for `src/core/state.ts` (F-086).
 *
 * For each fixture under `tests/parity/fixtures/state/<name>/`,
 * the Python helper (`generate_fixtures.py`) snapshotted:
 *
 *   - `state.yaml` — Python's `State.save()` output for a known data
 *     shape. The TS port loads this as input.
 *   - `data.json` — what `yaml.safe_load(state.yaml)` returns. The TS
 *     port asserts deep-equal after loading.
 *   - `iron_law.json` — declared-evidence count expectations indexed
 *     by feature id, with PIN_NOW pinned in `now.txt`.
 *   - `now.txt` — the reference time (ISO 8601) used as `now` for
 *     declared-evidence math; mirrors the Python generator.
 *
 * Coverage: data-shape semantic equivalence after YAML round-trip,
 * Iron Law byte-equal math, round-trip safety (load → save → reload
 * preserves data), and edge cases (default schema for missing file,
 * gate result enum, status enum).
 *
 * Run via `npm run test:parity`.
 */

import {mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {beforeEach, describe, expect, it} from 'vitest';

import {
  AUTOMATIC_EVIDENCE_KINDS,
  IRON_LAW_WINDOW_DAYS,
  State,
  countDeclaredEvidence,
  isDeclaredEvidence,
} from '../../src/core/state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(__dirname, 'fixtures', 'state');

interface FixtureBundle {
  name: string;
  fixtureDir: string;
  expectedData: Record<string, unknown>;
  ironLaw: Record<string, number>;
  pinnedNow: Date;
}

/** Loads every fixture directory under `tests/parity/fixtures/state/`. */
function loadFixtures(): FixtureBundle[] {
  const out: FixtureBundle[] = [];
  for (const name of readdirSync(FIXTURES_ROOT).sort()) {
    const fixtureDir = join(FIXTURES_ROOT, name);
    const dataPath = join(fixtureDir, 'data.json');
    let dataRaw: string;
    try {
      dataRaw = readFileSync(dataPath, 'utf-8');
    } catch {
      // Skip non-fixture entries (e.g. generate_fixtures.py).
      continue;
    }
    const expectedData = JSON.parse(dataRaw) as Record<string, unknown>;
    const ironLaw = JSON.parse(
      readFileSync(join(fixtureDir, 'iron_law.json'), 'utf-8'),
    ) as Record<string, number>;
    const pinnedNowIso = readFileSync(join(fixtureDir, 'now.txt'), 'utf-8').trim();
    out.push({
      name,
      fixtureDir,
      expectedData,
      ironLaw,
      pinnedNow: new Date(pinnedNowIso),
    });
  }
  return out;
}

describe('state parity (Python ↔ TypeScript)', () => {
  const fixtures = loadFixtures();

  it('discovers fixtures', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(5);
  });

  for (const fx of fixtures) {
    it(`State.load matches Python data shape: ${fx.name}`, () => {
      const state = State.load(fx.fixtureDir);
      // The fixture dir contains state.yaml; the loaded data shape
      // should equal Python's yaml.safe_load output exactly.
      expect(state.data).toEqual(fx.expectedData);
    });

    it(`Iron Law math matches Python counts: ${fx.name}`, () => {
      const state = State.load(fx.fixtureDir);
      for (const [fid, expectedCount] of Object.entries(fx.ironLaw)) {
        const feature = state.getFeature(fid);
        if (expectedCount === 0 && feature === null) {
          // Acceptable — no feature, no evidence to count.
          continue;
        }
        expect(feature, `feature ${fid} not found in fixture ${fx.name}`).not.toBeNull();
        const count = countDeclaredEvidence(feature, {
          windowDays: IRON_LAW_WINDOW_DAYS,
          now: fx.pinnedNow,
        });
        expect(count, `iron law count mismatch on ${fid}`).toBe(expectedCount);
      }
    });

    it(`round-trip preserves data shape: ${fx.name}`, () => {
      // Load the fixture, save it to a fresh tmp file, reload it,
      // and assert the data shape is identical. This guards against
      // PyYAML/eemeli-yaml subtle string-quoting drifts that could
      // break field types on the second pass.
      const workDir = mkdtempSync(join(tmpdir(), 'state-roundtrip-'));
      const original = State.load(fx.fixtureDir);
      const dst = new State(join(workDir, 'state.yaml'), structuredClone(original.data));
      dst.save();

      const reloaded = State.load(workDir);
      expect(reloaded.data).toEqual(original.data);

      rmSync(workDir, {recursive: true, force: true});
    });
  }
});

describe('state mutators', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'state-mut-'));
  });

  it('load on missing file returns default schema', () => {
    const state = State.load(workDir);
    expect(state.data.version).toBe('2.3');
    expect(state.data.schema_version).toBe('2.3');
    expect(state.data.features).toEqual([]);
    expect(state.data.session.active_feature_id).toBeNull();
    expect(state.data.session.last_command).toBe('');

    rmSync(workDir, {recursive: true, force: true});
  });

  it('ensureFeature inserts planned placeholder', () => {
    const state = State.load(workDir);
    const f = state.ensureFeature('F-100');
    expect(f.id).toBe('F-100');
    expect(f.status).toBe('planned');
    expect(f.gates).toEqual({});
    expect(f.evidence).toEqual([]);
    expect(f.started_at).toBeNull();
    expect(f.completed_at).toBeNull();

    // Re-calling returns the same object identity.
    expect(state.ensureFeature('F-100')).toBe(f);

    rmSync(workDir, {recursive: true, force: true});
  });

  it('setStatus updates lifecycle timestamps', () => {
    const state = State.load(workDir);
    state.setStatus('F-100', 'in_progress');
    const f = state.getFeature('F-100')!;
    expect(f.status).toBe('in_progress');
    expect(f.started_at).not.toBeNull();
    expect(f.completed_at).toBeNull();

    state.setStatus('F-100', 'done');
    expect(f.status).toBe('done');
    expect(f.completed_at).not.toBeNull();

    rmSync(workDir, {recursive: true, force: true});
  });

  it('setStatus rejects unknown status', () => {
    const state = State.load(workDir);
    // @ts-expect-error — runtime guard intentionally tested.
    expect(() => state.setStatus('F-100', 'bogus')).toThrow(/invalid status/);

    rmSync(workDir, {recursive: true, force: true});
  });

  it('recordGateResult sets last_gate_passed only on pass', () => {
    const state = State.load(workDir);
    state.recordGateResult('F-100', 'gate_0', 'fail', {note: 'red'});
    expect(state.data.session.last_gate_passed).toBeNull();

    state.recordGateResult('F-100', 'gate_0', 'pass', {note: 'green'});
    expect(state.data.session.last_gate_passed).toBe('gate_0');

    state.recordGateResult('F-100', 'gate_1', 'skipped');
    // Still gate_0 — skip does not advance.
    expect(state.data.session.last_gate_passed).toBe('gate_0');

    rmSync(workDir, {recursive: true, force: true});
  });

  it('recordGateResult rejects unknown result', () => {
    const state = State.load(workDir);
    // @ts-expect-error — runtime guard intentionally tested.
    expect(() => state.recordGateResult('F-100', 'gate_0', 'maybe')).toThrow(
      /invalid gate result/,
    );

    rmSync(workDir, {recursive: true, force: true});
  });

  it('addEvidence appends with auto ts', () => {
    const state = State.load(workDir);
    state.addEvidence('F-100', 'manual_check', 'reviewer eyeballed UI');
    const f = state.getFeature('F-100')!;
    expect(f.evidence).toHaveLength(1);
    expect(f.evidence[0]!.kind).toBe('manual_check');
    expect(f.evidence[0]!.summary).toBe('reviewer eyeballed UI');
    expect(f.evidence[0]!.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

    rmSync(workDir, {recursive: true, force: true});
  });

  it('addSkippedAgent rejects empty agent or reason', () => {
    const state = State.load(workDir);
    expect(() => state.addSkippedAgent('F-100', '', 'no reason')).toThrow(/agent name/);
    expect(() => state.addSkippedAgent('F-100', 'security-engineer', '')).toThrow(/reason/);

    rmSync(workDir, {recursive: true, force: true});
  });

  it('addSkippedAgent appends entries that getSkippedAgents returns', () => {
    const state = State.load(workDir);
    state.addSkippedAgent('F-100', 'security-engineer', 'no sensitive entity');
    state.addSkippedAgent('F-100', 'audio-designer', 'has_audio=false');
    const log = state.getSkippedAgents('F-100');
    expect(log).toHaveLength(2);
    expect(log[0]!.agent).toBe('security-engineer');
    expect(log[1]!.agent).toBe('audio-designer');

    // Defensive copy — mutating the returned array does not affect state.
    log.pop();
    expect(state.getSkippedAgents('F-100')).toHaveLength(2);

    rmSync(workDir, {recursive: true, force: true});
  });

  it('removeFeature clears active pointer when needed', () => {
    const state = State.load(workDir);
    state.ensureFeature('F-100');
    state.setActive('F-100');
    expect(state.removeFeature('F-100')).toBe(true);
    expect(state.data.session.active_feature_id).toBeNull();

    expect(state.removeFeature('F-999')).toBe(false);

    rmSync(workDir, {recursive: true, force: true});
  });

  it('featuresInProgress filters by status', () => {
    const state = State.load(workDir);
    state.setStatus('F-100', 'in_progress');
    state.setStatus('F-101', 'planned');
    state.setStatus('F-102', 'in_progress');
    state.setStatus('F-103', 'done');
    expect(state.featuresInProgress()).toEqual(['F-100', 'F-102']);

    rmSync(workDir, {recursive: true, force: true});
  });

  it('setLastCommand stamps started_at on first call only', () => {
    const state = State.load(workDir);
    state.setLastCommand('/harness:work F-100');
    const stamp = state.data.session.started_at;
    expect(stamp).not.toBeNull();

    state.setLastCommand('/harness:work F-200');
    // Second call must not overwrite the original session start time.
    expect(state.data.session.started_at).toBe(stamp);
    expect(state.data.session.last_command).toBe('/harness:work F-200');

    rmSync(workDir, {recursive: true, force: true});
  });

  it('featureCounts aggregates across all statuses', () => {
    const state = State.load(workDir);
    state.setStatus('F-100', 'in_progress');
    state.setStatus('F-101', 'in_progress');
    state.setStatus('F-102', 'done');
    state.setStatus('F-103', 'blocked');
    state.setStatus('F-104', 'archived');
    const counts = state.featureCounts();
    expect(counts).toEqual({
      planned: 0,
      in_progress: 2,
      blocked: 1,
      done: 1,
      archived: 1,
    });

    rmSync(workDir, {recursive: true, force: true});
  });

  it('save then load preserves arbitrary mutation', () => {
    const state = State.load(workDir);
    state.setStatus('F-100', 'in_progress');
    state.recordGateResult('F-100', 'gate_0', 'pass', {note: 'green'});
    state.addEvidence('F-100', 'manual_check', '한국어 verify ✅');
    state.setActive('F-100');
    state.setLastCommand('/harness:work F-100');
    state.save();

    const reloaded = State.load(workDir);
    expect(reloaded.getFeature('F-100')!.status).toBe('in_progress');
    expect(reloaded.getFeature('F-100')!.gates['gate_0']!.last_result).toBe('pass');
    expect(reloaded.getFeature('F-100')!.evidence[0]!.summary).toBe('한국어 verify ✅');
    expect(reloaded.data.session.active_feature_id).toBe('F-100');
    expect(reloaded.data.session.last_command).toBe('/harness:work F-100');

    rmSync(workDir, {recursive: true, force: true});
  });
});

describe('Iron Law evidence math', () => {
  it('AUTOMATIC_EVIDENCE_KINDS contains gate_run and gate_auto_run', () => {
    expect(AUTOMATIC_EVIDENCE_KINDS.has('gate_run')).toBe(true);
    expect(AUTOMATIC_EVIDENCE_KINDS.has('gate_auto_run')).toBe(true);
  });

  it('isDeclaredEvidence treats automatic kinds as not declared', () => {
    expect(isDeclaredEvidence({kind: 'gate_run'})).toBe(false);
    expect(isDeclaredEvidence({kind: 'gate_auto_run'})).toBe(false);
  });

  it('isDeclaredEvidence treats manual/test/user kinds as declared', () => {
    expect(isDeclaredEvidence({kind: 'manual_check'})).toBe(true);
    expect(isDeclaredEvidence({kind: 'test'})).toBe(true);
    expect(isDeclaredEvidence({kind: 'user_feedback'})).toBe(true);
    expect(isDeclaredEvidence({kind: 'reviewer_check'})).toBe(true);
    expect(isDeclaredEvidence({kind: 'generic'})).toBe(true);
    expect(isDeclaredEvidence({kind: 'blocker'})).toBe(true);
    expect(isDeclaredEvidence({kind: 'hotfix'})).toBe(true);
  });

  it('isDeclaredEvidence treats missing or non-string kind as declared', () => {
    expect(isDeclaredEvidence({summary: 'no kind'})).toBe(true);
    expect(isDeclaredEvidence({kind: 42})).toBe(true);
  });

  it('isDeclaredEvidence rejects non-objects', () => {
    expect(isDeclaredEvidence(null)).toBe(false);
    expect(isDeclaredEvidence('string')).toBe(false);
    expect(isDeclaredEvidence(['array'])).toBe(false);
    expect(isDeclaredEvidence(undefined)).toBe(false);
  });

  it('countDeclaredEvidence excludes entries outside the trailing window', () => {
    const now = new Date('2026-05-01T00:00:00Z');
    const feature = {
      evidence: [
        {ts: '2026-04-30T00:00:00Z', kind: 'manual_check', summary: 'recent'},
        {ts: '2026-04-01T00:00:00Z', kind: 'manual_check', summary: 'old'},
      ],
    };
    expect(countDeclaredEvidence(feature, {windowDays: 7, now})).toBe(1);
    // Wider window pulls the old entry back in.
    expect(countDeclaredEvidence(feature, {windowDays: 60, now})).toBe(2);
  });

  it('countDeclaredEvidence on non-feature returns 0', () => {
    expect(countDeclaredEvidence(null)).toBe(0);
    expect(countDeclaredEvidence('string')).toBe(0);
    expect(countDeclaredEvidence({})).toBe(0);
  });

  it('countDeclaredEvidence treats missing/unparseable ts as recent', () => {
    const now = new Date('2026-05-01T00:00:00Z');
    const feature = {
      evidence: [
        {kind: 'test', summary: 'no ts'},
        {ts: 'not-an-iso', kind: 'manual_check', summary: 'unparseable'},
      ],
    };
    expect(countDeclaredEvidence(feature, {windowDays: 7, now})).toBe(2);
  });
});

describe('state save format compatibility', () => {
  it('written state.yaml is parseable by Python-style YAML loader (sanity)', () => {
    // The TS save() should produce valid YAML — we round-trip through
    // the same parser to confirm at minimum it is self-consistent.
    const workDir = mkdtempSync(join(tmpdir(), 'state-fmt-'));
    const state = State.load(workDir);
    state.ensureFeature('F-200');
    state.setStatus('F-200', 'in_progress');
    state.addEvidence('F-200', 'test', 'parity check');
    state.save();

    // Confirm the file is non-empty and contains the structural keys.
    const raw = readFileSync(join(workDir, 'state.yaml'), 'utf-8');
    expect(raw).toContain('version:');
    expect(raw).toContain('features:');
    expect(raw).toContain('F-200');
    expect(raw).toContain('session:');

    // Re-loading via TS produces the same shape.
    const reloaded = State.load(workDir);
    expect(reloaded.getFeature('F-200')!.evidence).toHaveLength(1);

    rmSync(workDir, {recursive: true, force: true});
  });

  it('handles a manually-written minimal state.yaml', () => {
    const workDir = mkdtempSync(join(tmpdir(), 'state-min-'));
    writeFileSync(
      join(workDir, 'state.yaml'),
      'version: "2.3"\nschema_version: "2.3"\nfeatures: []\nsession:\n  started_at: null\n  last_command: ""\n  last_gate_passed: null\n  active_feature_id: null\n',
      'utf-8',
    );
    const state = State.load(workDir);
    expect(state.data.features).toEqual([]);
    expect(state.data.session.last_command).toBe('');

    rmSync(workDir, {recursive: true, force: true});
  });
});
