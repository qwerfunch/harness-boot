/**
 * F-172 — `recordLlmCall` parity tests.
 *
 * The helper has been around since F-159 (init scenarios); F-172 adds
 * the optional `feature` field and the `work` scenario tag so general
 * `harness work` cycles can record token usage too.
 */

import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {recordLlmCall} from '../../src/init/tokenLog.js';

describe('recordLlmCall (F-159 + F-172 feature field)', () => {
  let tmp: string;
  let eventsPath: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'tokenlog-'));
    eventsPath = join(tmp, 'events.log');
  });

  afterEach(() => {
    rmSync(tmp, {recursive: true, force: true});
  });

  it('writes a single llm_call event with required fields', () => {
    recordLlmCall({
      eventsPath,
      event: {
        scenario: 'idea',
        agent: 'researcher',
        tokens_in: 100,
        tokens_out: 50,
        model: 'claude-sonnet-4-6',
      },
      now: '2026-05-13T10:00:00Z',
    });
    const line = readFileSync(eventsPath, 'utf8').trim();
    const event = JSON.parse(line);
    expect(event.type).toBe('llm_call');
    expect(event.scenario).toBe('idea');
    expect(event.agent).toBe('researcher');
    expect(event.tokens_in).toBe(100);
    expect(event.tokens_out).toBe(50);
    expect(event.model).toBe('claude-sonnet-4-6');
    expect(event.feature).toBeUndefined();
  });

  it('F-172 — `work` scenario + `feature` field round-trips', () => {
    recordLlmCall({
      eventsPath,
      event: {
        scenario: 'work',
        agent: 'user',
        tokens_in: 2000,
        tokens_out: 800,
        model: 'claude-opus-4-7',
        feature: 'F-172',
      },
      now: '2026-05-13T10:05:00Z',
    });
    const event = JSON.parse(readFileSync(eventsPath, 'utf8').trim());
    expect(event.scenario).toBe('work');
    expect(event.feature).toBe('F-172');
  });

  it('appends without truncating existing events.log content', () => {
    recordLlmCall({
      eventsPath,
      event: {scenario: 'idea', agent: 'a', tokens_in: 1, tokens_out: 1},
      now: '2026-05-13T10:00:00Z',
    });
    recordLlmCall({
      eventsPath,
      event: {scenario: 'work', agent: 'b', tokens_in: 2, tokens_out: 2, feature: 'F-1'},
      now: '2026-05-13T10:01:00Z',
    });
    const lines = readFileSync(eventsPath, 'utf8').split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).scenario).toBe('idea');
    expect(JSON.parse(lines[1]!).feature).toBe('F-1');
  });

  it('fail-open — does not throw on unwritable path', () => {
    expect(() =>
      recordLlmCall({
        eventsPath: '/proc/0/does-not-exist',
        event: {scenario: 'work', agent: 'x', tokens_in: 1, tokens_out: 1},
      }),
    ).not.toThrow();
  });
});
