// harness-boot — Hook 실행 런타임 (F-004)
//
// 실제 셸 실행은 HookRunner 주입으로 교체 가능 (테스트 격리).  timeout ·
// once · async 의 결합 경계를 TDD 로 고정한다 (tdd_focus 2).

import type { EventLog } from '../audit/event-log.js';
import { resolveEnv, type EnvPolicy } from './env.js';
import type { EventContext } from './events.js';
import type { HookEvent, ResolvedHook } from './types.js';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface HookInvocation {
  readonly hook: ResolvedHook;
  readonly env: Readonly<Record<string, string>>;
  readonly input: unknown;
  readonly signal: AbortSignal;
}

export interface RunnerOutput {
  readonly ok: boolean;
  readonly exitCode?: number;
  readonly error?: string;
}

export interface HookRunner {
  run(invocation: HookInvocation): Promise<RunnerOutput>;
}

export interface HookResult {
  readonly id: string;
  readonly ok: boolean;
  readonly exitCode?: number;
  readonly timedOut: boolean;
  readonly skipped: boolean;
  readonly durationMs: number;
  readonly error?: string;
  readonly statusMessage?: string;
}

export interface OnceStore {
  has(id: string): boolean;
  mark(id: string): void;
}

export class InMemoryOnceStore implements OnceStore {
  private readonly fired = new Set<string>();

  has(id: string): boolean {
    return this.fired.has(id);
  }

  mark(id: string): void {
    this.fired.add(id);
  }
}

export interface DispatchOptions {
  readonly runner: HookRunner;
  readonly eventLog: EventLog;
  readonly onceStore: OnceStore;
  readonly policy: EnvPolicy;
  readonly processEnv: Record<string, string | undefined>;
  readonly now?: () => number;
  // 테스트용 주입 훅: 지정 시 entry.timeout 대신 이 값(ms)이 사용된다.
  // 실서비스에서는 미설정 — entry.timeout(초) × 1000 또는 기본 10000ms.
  readonly timeoutOverrideMs?: number;
}

export async function dispatchEvent(
  hooks: readonly ResolvedHook[],
  _event: HookEvent,
  _context: EventContext | undefined,
  input: unknown,
  opts: DispatchOptions,
): Promise<HookResult[]> {
  const now = opts.now ?? (() => Date.now());
  const results: HookResult[] = new Array(hooks.length);
  const asyncTasks: Promise<void>[] = [];

  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i] as ResolvedHook;
    const task = (async () => {
      results[i] = await runOne(hook, input, opts, now);
    })();
    if (hook.entry.async === true) {
      asyncTasks.push(task);
    } else {
      await task;
    }
  }
  await Promise.all(asyncTasks);
  return results;
}

async function runOne(
  hook: ResolvedHook,
  input: unknown,
  opts: DispatchOptions,
  now: () => number,
): Promise<HookResult> {
  const start = now();
  const startedIso = new Date(start).toISOString();

  if (hook.entry.once === true && opts.onceStore.has(hook.id)) {
    await opts.eventLog.append({
      ts: startedIso,
      type: 'hook_skipped',
      payload: { id: hook.id, event: hook.event, reason: 'once' },
    });
    return {
      id: hook.id,
      ok: true,
      timedOut: false,
      skipped: true,
      durationMs: 0,
    };
  }

  const envRes = resolveEnv(hook.env, opts.processEnv, opts.policy);
  const timeoutMs = computeTimeoutMs(hook, opts);
  const controller = new AbortController();
  const timer =
    timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  let output: RunnerOutput;
  let timedOut = false;
  try {
    output = await opts.runner.run({
      hook,
      env: envRes.env,
      input,
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      timedOut = true;
      output = { ok: false, error: 'timeout' };
    } else {
      output = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  const durationMs = now() - start;
  const ok = output.ok && !timedOut;
  const statusMessage = hook.entry.statusMessage;

  const result: HookResult = {
    id: hook.id,
    ok,
    timedOut,
    skipped: false,
    durationMs,
    ...(output.exitCode !== undefined ? { exitCode: output.exitCode } : {}),
    ...(output.error !== undefined ? { error: output.error } : {}),
    ...(statusMessage !== undefined ? { statusMessage } : {}),
  };

  const logType = timedOut
    ? 'hook_timeout'
    : !output.ok
      ? 'hook_error'
      : 'hook_fired';

  await opts.eventLog.append({
    ts: startedIso,
    type: logType,
    payload: {
      id: hook.id,
      event: hook.event,
      ok,
      timedOut,
      durationMs,
      ...(output.exitCode !== undefined ? { exitCode: output.exitCode } : {}),
      ...(output.error !== undefined ? { error: output.error } : {}),
      ...(statusMessage !== undefined ? { statusMessage } : {}),
    },
  });

  if (ok && hook.entry.once === true) {
    opts.onceStore.mark(hook.id);
  }

  return result;
}

function computeTimeoutMs(hook: ResolvedHook, opts: DispatchOptions): number {
  if (opts.timeoutOverrideMs !== undefined) return opts.timeoutOverrideMs;
  if (hook.entry.timeout !== undefined) return hook.entry.timeout * 1000;
  return DEFAULT_TIMEOUT_MS;
}
