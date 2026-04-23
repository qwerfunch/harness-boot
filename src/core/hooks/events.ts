// harness-boot — 이벤트 라우팅 (F-004, red phase stub)

import type { HookEvent, ResolvedHook } from './types.js';

export interface EventContext {
  readonly toolName?: string;
  readonly promptText?: string;
}

export function selectHooksForEvent(
  resolved: readonly ResolvedHook[],
  event: HookEvent,
  context?: EventContext,
): ResolvedHook[] {
  const subject = matcherSubject(event, context);

  return resolved.filter((hook) => {
    if (hook.event !== event) return false;
    if (hook.matcher === undefined || hook.matcher === '') return true;
    if (subject === undefined) return false;
    try {
      return new RegExp(hook.matcher).test(subject);
    } catch {
      return false;
    }
  });
}

function matcherSubject(
  event: HookEvent,
  context: EventContext | undefined,
): string | undefined {
  if (!context) return undefined;
  if (event === 'UserPromptSubmit') return context.promptText;
  return context.toolName;
}
