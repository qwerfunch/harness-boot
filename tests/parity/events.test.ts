/**
 * Parity test for `src/events.ts` (F-093).
 *
 * Coverage:
 *
 *   - filterEvents kind / feature / since combinations.
 *   - feature lookup falls through `feature` → `feature_id` →
 *     `payload.feature`.
 *   - formatHuman produces the canonical Python-shaped output.
 *
 * Run via `npm run test:parity`.
 */

import {describe, expect, it} from 'vitest';

import {filterEvents, formatHuman, parseTs} from '../../src/events.js';

const SAMPLE = [
  {ts: '2026-04-29T08:00:00Z', type: 'feature_activated', feature: 'F-001'},
  {ts: '2026-04-29T08:01:00Z', type: 'gate_run', feature: 'F-001'},
  {ts: '2026-04-29T08:02:00Z', type: 'gate_run', feature_id: 'F-002'},
  {ts: '2026-04-29T08:03:00Z', type: 'evidence_added', payload: {feature: 'F-003'}},
  {ts: '2026-04-29T08:04:00Z', type: 'feature_done', feature: 'F-001', spec_hash: 'abcdef0123456789'},
];

describe('events.filterEvents parity', () => {
  it('no filters returns all', () => {
    expect(filterEvents(SAMPLE)).toHaveLength(SAMPLE.length);
  });

  it('kind filter excludes mismatches', () => {
    const out = filterEvents(SAMPLE, {kind: 'gate_run'});
    expect(out).toHaveLength(2);
    expect(out.every((e) => e['type'] === 'gate_run')).toBe(true);
  });

  it('feature filter checks `feature` / `feature_id` / `payload.feature`', () => {
    expect(filterEvents(SAMPLE, {feature: 'F-001'})).toHaveLength(3);
    expect(filterEvents(SAMPLE, {feature: 'F-002'})).toHaveLength(1);
    expect(filterEvents(SAMPLE, {feature: 'F-003'})).toHaveLength(1);
  });

  it('since cutoff drops strictly older events', () => {
    const out = filterEvents(SAMPLE, {since: '2026-04-29T08:02:00Z'});
    // Strictly less than the cutoff means 08:00 and 08:01 drop.
    expect(out).toHaveLength(3);
  });

  it('combined kind + feature filter ANDs', () => {
    const out = filterEvents(SAMPLE, {kind: 'gate_run', feature: 'F-001'});
    expect(out).toHaveLength(1);
    expect(out[0]!['ts']).toBe('2026-04-29T08:01:00Z');
  });

  it('combined since + kind filter ANDs', () => {
    const out = filterEvents(SAMPLE, {kind: 'gate_run', since: '2026-04-29T08:02:00Z'});
    expect(out).toHaveLength(1);
    expect(out[0]!['feature_id']).toBe('F-002');
  });

  it('empty input → empty output', () => {
    expect(filterEvents([])).toEqual([]);
  });
});

describe('events.formatHuman parity', () => {
  it('emits "no matching events" for empty input', () => {
    expect(formatHuman([])).toBe('(no matching events)\n');
  });

  it('renders header + per-event line + trailing newline', () => {
    const out = formatHuman(SAMPLE.slice(0, 2));
    expect(out.startsWith('📜 /harness:events (2 events)\n')).toBe(true);
    expect(out.endsWith('\n')).toBe(true);
    expect(out).toContain('2026-04-29T08:00:00Z  feature_activated');
    expect(out).toContain('feature=F-001');
  });

  it('truncates spec_hash to 12 chars', () => {
    const out = formatHuman(SAMPLE.slice(4, 5));
    expect(out).toContain('spec_hash=abcdef012345');
    expect(out).not.toContain('abcdef0123456789');
  });

  it('joins multi-key extras with the · separator', () => {
    const events = [{ts: 'x', type: 't', feature: 'F-1', phase: 'p'}];
    const out = formatHuman(events);
    expect(out).toContain('feature=F-1 · phase=p');
  });
});

describe('events.parseTs parity', () => {
  it('parses Z-suffixed ISO 8601', () => {
    const d = parseTs('2026-04-29T08:00:00Z');
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe('2026-04-29T08:00:00.000Z');
  });

  it('returns null on empty / non-string', () => {
    expect(parseTs('')).toBeNull();
    expect(parseTs(null)).toBeNull();
    expect(parseTs(42)).toBeNull();
  });

  it('returns null on garbage', () => {
    expect(parseTs('not-an-iso')).toBeNull();
  });
});
