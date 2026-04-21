// harness-boot — Hook Runtime 타입 계약 (F-004)
//
// Claude Code 공식 hooks.json 스키마 (type/command/async/asyncRewake/shell/
// timeout/statusMessage/once + 상위 matcher) 를 day-1 네이티브로 수용하고,
// harness-boot 확장 필드 (id/description/env) 는 별도 meta.json 에 둔다
// (BR-005, C5 해소).

export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PreCompact'
  | 'SessionStart'
  | 'Stop'
  | 'SessionEnd'
  | 'UserPromptSubmit';

export const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'PreCompact',
  'SessionStart',
  'Stop',
  'SessionEnd',
  'UserPromptSubmit',
] as const satisfies readonly HookEvent[];

export type HookShell = 'sh' | 'bash' | 'zsh' | 'pwsh';

export interface OfficialHookEntry {
  readonly type: 'command';
  readonly command: string;
  readonly async?: boolean;
  readonly asyncRewake?: boolean;
  readonly shell?: HookShell;
  readonly timeout?: number; // 초 단위 양의 정수, 기본 10
  readonly statusMessage?: string;
  readonly once?: boolean;
}

export interface HookMatcherBlock {
  readonly matcher?: string;
  readonly hooks: readonly OfficialHookEntry[];
}

export type OfficialHooksConfig = Partial<Record<HookEvent, readonly HookMatcherBlock[]>>;

export interface MetaHookEntry {
  readonly id: string;
  readonly event: HookEvent;
  readonly matcher?: string;
  readonly index: number;
  readonly description?: string;
  readonly env?: Record<string, string>;
}

export interface MetaConfig {
  readonly hooks: readonly MetaHookEntry[];
  readonly allowedEnvVars?: readonly string[];
}

export interface ResolvedHook {
  readonly event: HookEvent;
  readonly matcher?: string;
  readonly id: string;
  readonly description?: string;
  readonly env?: Record<string, string>;
  readonly entry: OfficialHookEntry;
}
