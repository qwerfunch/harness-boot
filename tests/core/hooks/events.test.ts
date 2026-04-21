import { describe, expect, it } from 'vitest';

import { selectHooksForEvent } from '../../../src/core/hooks/events.js';
import {
  HOOK_EVENTS,
  type HookEvent,
  type OfficialHookEntry,
  type ResolvedHook,
} from '../../../src/core/hooks/types.js';

// 커버: tdd_focus 1 (7 이벤트 라우팅 정확성).

const entry = (command: string): OfficialHookEntry => ({
  type: 'command',
  command,
});

const mkResolved = (
  event: HookEvent,
  id: string,
  matcher?: string,
): ResolvedHook => ({
  event,
  id,
  entry: entry(`run-${id}`),
  ...(matcher !== undefined ? { matcher } : {}),
});

describe('selectHooksForEvent', () => {
  it.each(HOOK_EVENTS)('routes %s to matching hook only', (event) => {
    const all: ResolvedHook[] = HOOK_EVENTS.map((e) => mkResolved(e, `h-${e}`));

    const picked = selectHooksForEvent(all, event);

    expect(picked.map((p) => p.id)).toEqual([`h-${event}`]);
  });

  it('returns empty array when no hook matches the event', () => {
    const resolved = [mkResolved('PreToolUse', 'only-pre')];

    expect(selectHooksForEvent(resolved, 'Stop')).toEqual([]);
  });

  it('empty or undefined matcher always matches regardless of toolName', () => {
    const resolved = [
      mkResolved('PreToolUse', 'no-matcher'),
      mkResolved('PreToolUse', 'empty-matcher', ''),
    ];

    const picked = selectHooksForEvent(resolved, 'PreToolUse', {
      toolName: 'AnyTool',
    });

    expect(picked.map((p) => p.id)).toEqual(['no-matcher', 'empty-matcher']);
  });

  it('regex matcher filters PreToolUse by toolName', () => {
    const resolved = [
      mkResolved('PreToolUse', 'write-only', 'Write|Edit'),
      mkResolved('PreToolUse', 'bash-only', '^Bash$'),
    ];

    const pickedWrite = selectHooksForEvent(resolved, 'PreToolUse', {
      toolName: 'Write',
    });
    const pickedBash = selectHooksForEvent(resolved, 'PreToolUse', {
      toolName: 'Bash',
    });
    const pickedGrep = selectHooksForEvent(resolved, 'PreToolUse', {
      toolName: 'Grep',
    });

    expect(pickedWrite.map((p) => p.id)).toEqual(['write-only']);
    expect(pickedBash.map((p) => p.id)).toEqual(['bash-only']);
    expect(pickedGrep).toEqual([]);
  });

  it('UserPromptSubmit runs matcher regex against promptText', () => {
    const resolved = [
      mkResolved('UserPromptSubmit', 'deploy-gate', '^deploy\\b'),
    ];

    const picked = selectHooksForEvent(resolved, 'UserPromptSubmit', {
      promptText: 'deploy production',
    });
    const skipped = selectHooksForEvent(resolved, 'UserPromptSubmit', {
      promptText: 'hello world',
    });

    expect(picked.map((p) => p.id)).toEqual(['deploy-gate']);
    expect(skipped).toEqual([]);
  });

  it('preserves declaration order for multiple matching hooks', () => {
    const resolved = [
      mkResolved('PostToolUse', 'first'),
      mkResolved('PostToolUse', 'second'),
      mkResolved('PostToolUse', 'third'),
    ];

    const picked = selectHooksForEvent(resolved, 'PostToolUse');

    expect(picked.map((p) => p.id)).toEqual(['first', 'second', 'third']);
  });
});
