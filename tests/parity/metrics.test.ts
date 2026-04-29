/**
 * Parity test for `src/metrics.ts` (F-098).
 *
 * Coverage:
 *
 *   - parsePeriod recognises s/m/h/d/w (case-insensitive).
 *   - aggregate produces canonical counts + lead-time stats.
 *   - gate stats pass_rate excludes skipped from denominator.
 *   - compute filters by since / period.
 *
 * Run via `npm run test:parity`.
 */

import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {aggregate, compute, formatHuman, parsePeriod} from '../../src/metrics.js';

describe('metrics.parsePeriod', () => {
  it('parses common units', () => {
    expect(parsePeriod('7d')).toBe(7 * 86400 * 1000);
    expect(parsePeriod('24h')).toBe(24 * 3600 * 1000);
    expect(parsePeriod('30m')).toBe(30 * 60 * 1000);
    expect(parsePeriod('60s')).toBe(60 * 1000);
    expect(parsePeriod('2w')).toBe(2 * 604800 * 1000);
  });

  it('case-insensitive', () => {
    expect(parsePeriod('7D')).toBe(parsePeriod('7d'));
    expect(parsePeriod('24H')).toBe(parsePeriod('24h'));
  });

  it('throws on garbage', () => {
    expect(() => parsePeriod('foo')).toThrow(/invalid period/);
    expect(() => parsePeriod('7y')).toThrow(/invalid period/);
  });
});

describe('metrics.aggregate', () => {
  const events = [
    {ts: '2026-04-29T08:00:00Z', type: 'feature_activated', feature: 'F-001'},
    {ts: '2026-04-29T08:01:00Z', type: 'gate_recorded', feature: 'F-001', gate: 'gate_0', result: 'pass'},
    {ts: '2026-04-29T08:02:00Z', type: 'gate_recorded', feature: 'F-001', gate: 'gate_0', result: 'fail'},
    {ts: '2026-04-29T08:03:00Z', type: 'gate_recorded', feature: 'F-001', gate: 'gate_5', result: 'skipped'},
    {ts: '2026-04-29T08:10:00Z', type: 'feature_done', feature: 'F-001'},
    {ts: '2026-04-29T08:00:00Z', type: 'sync_failed'},
    {ts: '2026-04-29T09:00:00Z', type: 'feature_activated', feature: 'F-002'},
    {ts: '2026-04-29T09:30:00Z', type: 'feature_blocked', feature: 'F-002'},
  ];

  it('counts events by type', () => {
    const r = aggregate(events);
    expect(r.total_events).toBe(events.length);
    expect(r.event_types['feature_activated']).toBe(2);
    expect(r.event_types['gate_recorded']).toBe(3);
  });

  it('counts feature throughput', () => {
    const r = aggregate(events);
    expect(r.features.activated).toBe(2);
    expect(r.features.done).toBe(1);
    expect(r.features.blocked).toBe(1);
  });

  it('computes lead time as activate → done delta', () => {
    const r = aggregate(events);
    // F-001 activated at 08:00:00, done at 08:10:00 — 600s.
    expect(r.lead_time_sec.count).toBe(1);
    expect(r.lead_time_sec.min).toBe(600);
    expect(r.lead_time_sec.max).toBe(600);
    expect(r.lead_time_sec.median).toBe(600);
    expect(r.lead_time_sec.mean).toBe(600);
  });

  it('gate stats pass_rate excludes skipped from denominator', () => {
    const r = aggregate(events);
    const g0 = r.gate_stats['gate_0']!;
    expect(g0.pass).toBe(1);
    expect(g0.fail).toBe(1);
    expect(g0.pass_rate).toBe(0.5);
    const g5 = r.gate_stats['gate_5']!;
    expect(g5.skipped).toBe(1);
    expect(g5.pass_rate).toBe(0); // no pass+fail
  });

  it('counts drift incidents from sync_failed', () => {
    const r = aggregate(events);
    expect(r.drift_incidents).toBe(1);
  });
});

describe('metrics.compute', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'metrics-'));
  });
  afterEach(() => {
    rmSync(workDir, {recursive: true, force: true});
  });

  it('reads events.log and aggregates', () => {
    const events = [
      '{"ts":"2026-04-29T08:00:00Z","type":"feature_activated","feature":"F-001"}',
      '{"ts":"2026-04-29T08:10:00Z","type":"feature_done","feature":"F-001"}',
    ];
    writeFileSync(join(workDir, 'events.log'), `${events.join('\n')}\n`, 'utf-8');
    const r = compute(workDir);
    expect(r.total_events).toBe(2);
    expect(r.lead_time_sec.count).toBe(1);
  });

  it('since filter drops older events', () => {
    const events = [
      '{"ts":"2026-04-29T08:00:00Z","type":"feature_done","feature":"F-001"}',
      '{"ts":"2026-04-30T08:00:00Z","type":"feature_done","feature":"F-002"}',
    ];
    writeFileSync(join(workDir, 'events.log'), `${events.join('\n')}\n`, 'utf-8');
    const r = compute(workDir, {since: '2026-04-30T00:00:00Z'});
    expect(r.total_events).toBe(1);
    expect(r.window.start).toBe('2026-04-30T00:00:00Z');
  });

  it('period filter sets window relative to `now`', () => {
    const events = [
      '{"ts":"2026-04-29T08:00:00Z","type":"feature_done","feature":"F-001"}',
      '{"ts":"2026-05-01T08:00:00Z","type":"feature_done","feature":"F-002"}',
    ];
    writeFileSync(join(workDir, 'events.log'), `${events.join('\n')}\n`, 'utf-8');
    const r = compute(workDir, {period: '1d', now: new Date('2026-05-01T12:00:00Z')});
    expect(r.window.period).toBe('1d');
    // Within the last day from 2026-05-01 noon, only the 2026-05-01 event qualifies.
    expect(r.total_events).toBe(1);
  });
});

describe('metrics.formatHuman', () => {
  it('renders the canonical layout', () => {
    const r = aggregate([
      {ts: 'A', type: 'feature_activated', feature: 'F-001'},
      {ts: 'B', type: 'feature_done', feature: 'F-001'},
    ]);
    const out = formatHuman(r);
    expect(out.startsWith('📊 /harness:metrics\n')).toBe(true);
    expect(out).toContain('Total events: 2');
    expect(out).toContain('Features: 1 done · 1 activated');
  });
});
