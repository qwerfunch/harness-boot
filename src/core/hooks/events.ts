// harness-boot — 이벤트 라우팅 (F-004, red phase stub)

import type { HookEvent, ResolvedHook } from './types.js';

export interface EventContext {
  readonly toolName?: string;
  readonly promptText?: string;
}

export function selectHooksForEvent(
  _resolved: readonly ResolvedHook[],
  _event: HookEvent,
  _context?: EventContext,
): ResolvedHook[] {
  throw new Error('not implemented: selectHooksForEvent');
}
