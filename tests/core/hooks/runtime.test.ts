import { describe, expect, it } from 'vitest';

import {
  InMemoryEventLog,
  type EventLogEntry,
} from '../../../src/core/audit/event-log.js';
import {
  dispatchEvent,
  InMemoryOnceStore,
  type DispatchOptions,
  type HookInvocation,
  type HookRunner,
  type RunnerOutput,
} from '../../../src/core/hooks/runtime.js';
import type {
  OfficialHookEntry,
  ResolvedHook,
} from '../../../src/core/hooks/types.js';

// 커버: tdd_focus 2 (timeout · once · async 결합 경계) + 5 (hook 실패 시
// 이벤트 로그 무결성).

const entry = (patch: Partial<OfficialHookEntry> = {}): OfficialHookEntry => ({
  type: 'command',
  command: patch.command ?? 'noop',
  ...patch,
});

const mkHook = (
  id: string,
  overrides: Partial<OfficialHookEntry> = {},
): ResolvedHook => ({
  event: 'PreToolUse',
  id,
  entry: entry(overrides),
});

class RecordingRunner implements HookRunner {
  readonly calls: HookInvocation[] = [];
  constructor(
    private readonly output: RunnerOutput = { ok: true, exitCode: 0 },
  ) {}
  async run(invocation: HookInvocation): Promise<RunnerOutput> {
    this.calls.push(invocation);
    return this.output;
  }
}

class StallingRunner implements HookRunner {
  constructor(private readonly stallMs: number) {}
  async run(invocation: HookInvocation): Promise<RunnerOutput> {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, this.stallMs);
      invocation.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      });
    });
    return { ok: true, exitCode: 0 };
  }
}

class ConcurrencyProbeRunner implements HookRunner {
  public calls = 0;
  public peak = 0;
  private active = 0;
  constructor(private readonly workMs: number) {}
  async run(invocation: HookInvocation): Promise<RunnerOutput> {
    this.active += 1;
    this.peak = Math.max(this.peak, this.active);
    this.calls += 1;
    await new Promise((r) => setTimeout(r, this.workMs));
    this.active -= 1;
    void invocation;
    return { ok: true, exitCode: 0 };
  }
}

const baseOpts = (): DispatchOptions => ({
  runner: new RecordingRunner(),
  eventLog: new InMemoryEventLog(),
  onceStore: new InMemoryOnceStore(),
  policy: { allowedEnvVars: [] },
  processEnv: {},
});

describe('dispatchEvent', () => {
  it('invokes the runner and logs hook_fired', async () => {
    const opts = baseOpts();
    const hooks = [mkHook('h1')];

    const results = await dispatchEvent(
      hooks,
      'PreToolUse',
      undefined,
      { any: 'input' },
      opts,
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('h1');
    expect(results[0]?.ok).toBe(true);
    expect(results[0]?.skipped).toBe(false);
    expect(results[0]?.timedOut).toBe(false);
    expect((opts.runner as RecordingRunner).calls).toHaveLength(1);

    const entries = (opts.eventLog as InMemoryEventLog).entries;
    expect(entries.map((e: EventLogEntry) => e.type)).toContain('hook_fired');
  });

  it('honors once — second dispatch is skipped and logged', async () => {
    const opts = baseOpts();
    const hooks = [mkHook('once-hook', { once: true })];

    const first = await dispatchEvent(hooks, 'PreToolUse', undefined, {}, opts);
    const second = await dispatchEvent(hooks, 'PreToolUse', undefined, {}, opts);

    expect(first[0]?.skipped).toBe(false);
    expect(second[0]?.skipped).toBe(true);
    expect((opts.runner as RecordingRunner).calls).toHaveLength(1);

    const entries = (opts.eventLog as InMemoryEventLog).entries;
    expect(entries.map((e: EventLogEntry) => e.type)).toEqual([
      'hook_fired',
      'hook_skipped',
    ]);
  });

  it('times out when runner stalls longer than timeout, logs hook_timeout with statusMessage', async () => {
    const opts: DispatchOptions = {
      ...baseOpts(),
      runner: new StallingRunner(500),
      timeoutOverrideMs: 50,
    };
    const hooks = [mkHook('slow', { statusMessage: 'took too long' })];

    const results = await dispatchEvent(hooks, 'PreToolUse', undefined, {}, opts);

    expect(results[0]?.timedOut).toBe(true);
    expect(results[0]?.ok).toBe(false);
    expect(results[0]?.statusMessage).toBe('took too long');

    const entries = (opts.eventLog as InMemoryEventLog).entries;
    const timeoutEntry = entries.find(
      (e: EventLogEntry) => e.type === 'hook_timeout',
    );
    expect(timeoutEntry).toBeDefined();
    expect(timeoutEntry?.payload['statusMessage']).toBe('took too long');
  });

  it('runs async:true hooks in parallel (peak concurrency > 1)', async () => {
    const probe = new ConcurrencyProbeRunner(30);
    const opts: DispatchOptions = { ...baseOpts(), runner: probe };

    const hooks = [
      mkHook('a', { async: true }),
      mkHook('b', { async: true }),
      mkHook('c', { async: true }),
    ];

    const results = await dispatchEvent(hooks, 'PreToolUse', undefined, {}, opts);

    expect(results).toHaveLength(3);
    expect(probe.calls).toBe(3);
    expect(probe.peak).toBeGreaterThanOrEqual(2);
  });

  it('runs sync hooks serially (peak concurrency = 1)', async () => {
    const probe = new ConcurrencyProbeRunner(20);
    const opts: DispatchOptions = { ...baseOpts(), runner: probe };

    const hooks = [mkHook('a'), mkHook('b'), mkHook('c')];

    await dispatchEvent(hooks, 'PreToolUse', undefined, {}, opts);

    expect(probe.peak).toBe(1);
    expect(probe.calls).toBe(3);
  });

  it('logs hook_error when runner returns non-ok result', async () => {
    const opts: DispatchOptions = {
      ...baseOpts(),
      runner: new RecordingRunner({ ok: false, exitCode: 2, error: 'boom' }),
    };

    const results = await dispatchEvent(
      [mkHook('bad')],
      'PreToolUse',
      undefined,
      {},
      opts,
    );

    expect(results[0]?.ok).toBe(false);
    expect(results[0]?.exitCode).toBe(2);

    const entries = (opts.eventLog as InMemoryEventLog).entries;
    expect(entries.map((e: EventLogEntry) => e.type)).toContain('hook_error');
  });

  it('logs hook_error with stringified error when runner throws unexpectedly', async () => {
    class ThrowingRunner implements HookRunner {
      async run(): Promise<RunnerOutput> {
        throw new Error('bang');
      }
    }
    const opts: DispatchOptions = { ...baseOpts(), runner: new ThrowingRunner() };

    const results = await dispatchEvent(
      [mkHook('boom')],
      'PreToolUse',
      undefined,
      {},
      opts,
    );

    expect(results[0]?.ok).toBe(false);
    expect(results[0]?.timedOut).toBe(false);
    expect(results[0]?.error).toBe('bang');

    const entries = (opts.eventLog as InMemoryEventLog).entries;
    expect(entries.map((e: EventLogEntry) => e.type)).toContain('hook_error');
  });

  it('event log preserves chronological order across multiple dispatches', async () => {
    const opts = baseOpts();

    await dispatchEvent(
      [mkHook('first'), mkHook('second')],
      'PreToolUse',
      undefined,
      {},
      opts,
    );
    await dispatchEvent(
      [mkHook('third')],
      'PostToolUse',
      undefined,
      {},
      opts,
    );

    const ids = (opts.eventLog as InMemoryEventLog).entries.map(
      (e: EventLogEntry) => e.payload['id'],
    );

    expect(ids).toEqual(['first', 'second', 'third']);
  });
});
