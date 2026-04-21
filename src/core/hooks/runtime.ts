// harness-boot — Hook 실행 런타임 (F-004, red phase stub)
//
// 실제 셸 실행은 HookRunner 주입으로 교체 가능 (테스트 격리).  timeout ·
// once · async 의 결합 경계를 TDD 로 고정한다 (tdd_focus 2).

import type { EventLog } from '../audit/event-log.js';
import type { EnvPolicy } from './env.js';
import type { EventContext } from './events.js';
import type { HookEvent, ResolvedHook } from './types.js';

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
  _hooks: readonly ResolvedHook[],
  _event: HookEvent,
  _context: EventContext | undefined,
  _input: unknown,
  _opts: DispatchOptions,
): Promise<HookResult[]> {
  throw new Error('not implemented: dispatchEvent');
}
