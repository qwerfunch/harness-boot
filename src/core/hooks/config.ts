// harness-boot — Hook 설정 로딩 · 검증 · join (F-004, red phase stub)
//
// `hooks/hooks.json` (공식) 과 `.harness/hooks/meta.json` (확장) 를 읽어
// ResolvedHook[] 로 합친다.  join 은 (event, matcher, index) 튜플로 결정적.

import {
  HOOK_EVENTS,
  type HookEvent,
  type HookMatcherBlock,
  type HookShell,
  type MetaConfig,
  type MetaHookEntry,
  type OfficialHookEntry,
  type OfficialHooksConfig,
  type ResolvedHook,
} from './types.js';

const SHELL_VALUES: readonly HookShell[] = ['sh', 'bash', 'zsh', 'pwsh'];

export type HooksConfigErrorCode =
  | 'EVENT_UNKNOWN'
  | 'FIELD_INVALID'
  | 'META_MISSING'
  | 'META_ORPHAN'
  | 'MATCHER_MISMATCH'
  | 'DUPLICATE_ID';

export class HooksConfigError extends Error {
  constructor(
    message: string,
    public readonly code: HooksConfigErrorCode,
  ) {
    super(message);
    this.name = 'HooksConfigError';
  }
}

export function parseHooksJson(raw: unknown): OfficialHooksConfig {
  if (!isRecord(raw)) {
    throw new HooksConfigError(
      'hooks.json 루트는 객체여야 한다',
      'FIELD_INVALID',
    );
  }

  const out: Partial<Record<HookEvent, readonly HookMatcherBlock[]>> = {};

  for (const [eventKey, blocksRaw] of Object.entries(raw)) {
    if (!isHookEvent(eventKey)) {
      throw new HooksConfigError(
        `알 수 없는 이벤트: ${eventKey}`,
        'EVENT_UNKNOWN',
      );
    }
    if (!Array.isArray(blocksRaw)) {
      throw new HooksConfigError(
        `${eventKey} 값은 배열이어야 한다`,
        'FIELD_INVALID',
      );
    }
    out[eventKey] = blocksRaw.map((block, blockIdx) =>
      parseMatcherBlock(eventKey, blockIdx, block),
    );
  }

  return out;
}

export function parseMetaJson(raw: unknown): MetaConfig {
  if (!isRecord(raw)) {
    throw new HooksConfigError('meta.json 루트는 객체여야 한다', 'FIELD_INVALID');
  }

  const hooksRaw = raw['hooks'];
  if (!Array.isArray(hooksRaw)) {
    throw new HooksConfigError(
      'meta.json.hooks 는 배열이어야 한다',
      'FIELD_INVALID',
    );
  }

  const hooks: MetaHookEntry[] = hooksRaw.map((entry, idx) =>
    parseMetaEntry(idx, entry),
  );

  const seen = new Set<string>();
  for (const h of hooks) {
    if (seen.has(h.id)) {
      throw new HooksConfigError(
        `DUPLICATE_ID: id=${h.id}`,
        'DUPLICATE_ID',
      );
    }
    seen.add(h.id);
  }

  const allowedEnvVars = raw['allowedEnvVars'];
  if (allowedEnvVars !== undefined) {
    if (
      !Array.isArray(allowedEnvVars) ||
      !allowedEnvVars.every((v) => typeof v === 'string')
    ) {
      throw new HooksConfigError(
        'allowedEnvVars 는 문자열 배열이어야 한다',
        'FIELD_INVALID',
      );
    }
    return { hooks, allowedEnvVars: allowedEnvVars as readonly string[] };
  }

  return { hooks };
}

export function joinConfig(
  official: OfficialHooksConfig,
  meta: MetaConfig,
): ResolvedHook[] {
  const metaByKey = new Map<string, MetaHookEntry>();
  for (const m of meta.hooks) {
    metaByKey.set(metaKey(m.event, m.index), m);
  }

  const consumed = new Set<string>();
  const resolved: ResolvedHook[] = [];

  for (const event of HOOK_EVENTS) {
    const blocks = official[event];
    if (!blocks) continue;
    let flatIndex = 0;
    for (const block of blocks) {
      for (const entry of block.hooks) {
        const key = metaKey(event, flatIndex);
        const m = metaByKey.get(key);
        if (!m) {
          throw new HooksConfigError(
            `META_MISSING: ${event}[${flatIndex}] 에 대응하는 meta 엔트리가 없다`,
            'META_MISSING',
          );
        }
        if ((m.matcher ?? undefined) !== (block.matcher ?? undefined)) {
          throw new HooksConfigError(
            `MATCHER_MISMATCH: ${event}[${flatIndex}] official=${String(
              block.matcher,
            )} meta=${String(m.matcher)}`,
            'MATCHER_MISMATCH',
          );
        }
        consumed.add(key);
        resolved.push(buildResolved(event, block.matcher, m, entry));
        flatIndex += 1;
      }
    }
  }

  for (const [key, m] of metaByKey) {
    if (!consumed.has(key)) {
      throw new HooksConfigError(
        `META_ORPHAN: meta id=${m.id} (${m.event}[${m.index}]) 에 대응하는 official 엔트리가 없다`,
        'META_ORPHAN',
      );
    }
  }

  return resolved;
}

function buildResolved(
  event: HookEvent,
  matcher: string | undefined,
  meta: MetaHookEntry,
  entry: OfficialHookEntry,
): ResolvedHook {
  return {
    event,
    id: meta.id,
    entry,
    ...(matcher !== undefined ? { matcher } : {}),
    ...(meta.description !== undefined
      ? { description: meta.description }
      : {}),
    ...(meta.env !== undefined ? { env: meta.env } : {}),
  };
}

function metaKey(event: HookEvent, index: number): string {
  return `${event}#${index}`;
}

function parseMatcherBlock(
  event: HookEvent,
  blockIdx: number,
  raw: unknown,
): HookMatcherBlock {
  if (!isRecord(raw)) {
    throw new HooksConfigError(
      `${event}[${blockIdx}] 는 객체여야 한다`,
      'FIELD_INVALID',
    );
  }
  const matcherRaw = raw['matcher'];
  if (matcherRaw !== undefined && typeof matcherRaw !== 'string') {
    throw new HooksConfigError(
      `${event}[${blockIdx}].matcher 는 문자열이어야 한다`,
      'FIELD_INVALID',
    );
  }
  const hooksRaw = raw['hooks'];
  if (!Array.isArray(hooksRaw)) {
    throw new HooksConfigError(
      `${event}[${blockIdx}].hooks 는 배열이어야 한다`,
      'FIELD_INVALID',
    );
  }
  const hooks = hooksRaw.map((h, i) =>
    parseOfficialEntry(`${event}[${blockIdx}].hooks[${i}]`, h),
  );
  return matcherRaw !== undefined
    ? { matcher: matcherRaw, hooks }
    : { hooks };
}

function parseOfficialEntry(
  path: string,
  raw: unknown,
): OfficialHookEntry {
  if (!isRecord(raw)) {
    throw new HooksConfigError(`${path} 는 객체여야 한다`, 'FIELD_INVALID');
  }
  if (raw['type'] !== 'command') {
    throw new HooksConfigError(
      `${path}.type 는 "command" 여야 한다`,
      'FIELD_INVALID',
    );
  }
  if (typeof raw['command'] !== 'string' || raw['command'].length === 0) {
    throw new HooksConfigError(
      `${path}.command 는 비어있지 않은 문자열이어야 한다`,
      'FIELD_INVALID',
    );
  }
  const entry: Record<string, unknown> = {
    type: 'command',
    command: raw['command'],
  };
  if (raw['async'] !== undefined) {
    if (typeof raw['async'] !== 'boolean') {
      throw new HooksConfigError(
        `${path}.async 는 boolean 이어야 한다`,
        'FIELD_INVALID',
      );
    }
    entry['async'] = raw['async'];
  }
  if (raw['asyncRewake'] !== undefined) {
    if (typeof raw['asyncRewake'] !== 'boolean') {
      throw new HooksConfigError(
        `${path}.asyncRewake 는 boolean 이어야 한다`,
        'FIELD_INVALID',
      );
    }
    entry['asyncRewake'] = raw['asyncRewake'];
  }
  if (raw['shell'] !== undefined) {
    if (
      typeof raw['shell'] !== 'string' ||
      !SHELL_VALUES.includes(raw['shell'] as HookShell)
    ) {
      throw new HooksConfigError(
        `${path}.shell 는 ${SHELL_VALUES.join(' | ')} 중 하나여야 한다`,
        'FIELD_INVALID',
      );
    }
    entry['shell'] = raw['shell'];
  }
  if (raw['timeout'] !== undefined) {
    if (
      typeof raw['timeout'] !== 'number' ||
      !Number.isInteger(raw['timeout']) ||
      raw['timeout'] < 0
    ) {
      throw new HooksConfigError(
        `${path}.timeout 는 0 이상의 정수여야 한다`,
        'FIELD_INVALID',
      );
    }
    entry['timeout'] = raw['timeout'];
  }
  if (raw['statusMessage'] !== undefined) {
    if (typeof raw['statusMessage'] !== 'string') {
      throw new HooksConfigError(
        `${path}.statusMessage 는 문자열이어야 한다`,
        'FIELD_INVALID',
      );
    }
    entry['statusMessage'] = raw['statusMessage'];
  }
  if (raw['once'] !== undefined) {
    if (typeof raw['once'] !== 'boolean') {
      throw new HooksConfigError(
        `${path}.once 는 boolean 이어야 한다`,
        'FIELD_INVALID',
      );
    }
    entry['once'] = raw['once'];
  }
  return entry as unknown as OfficialHookEntry;
}

function parseMetaEntry(idx: number, raw: unknown): MetaHookEntry {
  const path = `meta.hooks[${idx}]`;
  if (!isRecord(raw)) {
    throw new HooksConfigError(`${path} 는 객체여야 한다`, 'FIELD_INVALID');
  }
  if (typeof raw['id'] !== 'string' || raw['id'].length === 0) {
    throw new HooksConfigError(
      `${path}.id 는 비어있지 않은 문자열이어야 한다`,
      'FIELD_INVALID',
    );
  }
  if (typeof raw['event'] !== 'string' || !isHookEvent(raw['event'])) {
    throw new HooksConfigError(
      `${path}.event 가 알 수 없는 이벤트다: ${String(raw['event'])}`,
      'EVENT_UNKNOWN',
    );
  }
  if (
    typeof raw['index'] !== 'number' ||
    !Number.isInteger(raw['index']) ||
    raw['index'] < 0
  ) {
    throw new HooksConfigError(
      `${path}.index 는 0 이상의 정수여야 한다`,
      'FIELD_INVALID',
    );
  }
  const entry: Record<string, unknown> = {
    id: raw['id'],
    event: raw['event'],
    index: raw['index'],
  };
  if (raw['matcher'] !== undefined) {
    if (typeof raw['matcher'] !== 'string') {
      throw new HooksConfigError(
        `${path}.matcher 는 문자열이어야 한다`,
        'FIELD_INVALID',
      );
    }
    entry['matcher'] = raw['matcher'];
  }
  if (raw['description'] !== undefined) {
    if (typeof raw['description'] !== 'string') {
      throw new HooksConfigError(
        `${path}.description 는 문자열이어야 한다`,
        'FIELD_INVALID',
      );
    }
    entry['description'] = raw['description'];
  }
  if (raw['env'] !== undefined) {
    if (!isRecord(raw['env'])) {
      throw new HooksConfigError(
        `${path}.env 는 객체여야 한다`,
        'FIELD_INVALID',
      );
    }
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw['env'])) {
      if (typeof v !== 'string') {
        throw new HooksConfigError(
          `${path}.env.${k} 는 문자열이어야 한다`,
          'FIELD_INVALID',
        );
      }
      env[k] = v;
    }
    entry['env'] = env;
  }
  return entry as unknown as MetaHookEntry;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isHookEvent(v: string): v is HookEvent {
  return (HOOK_EVENTS as readonly string[]).includes(v);
}
