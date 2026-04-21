// harness-boot — Hook 설정 로딩 · 검증 · join (F-004, red phase stub)
//
// `hooks/hooks.json` (공식) 과 `.harness/hooks/meta.json` (확장) 를 읽어
// ResolvedHook[] 로 합친다.  join 은 (event, matcher, index) 튜플로 결정적.

import type {
  MetaConfig,
  OfficialHooksConfig,
  ResolvedHook,
} from './types.js';

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

export function parseHooksJson(_raw: unknown): OfficialHooksConfig {
  throw new Error('not implemented: parseHooksJson');
}

export function parseMetaJson(_raw: unknown): MetaConfig {
  throw new Error('not implemented: parseMetaJson');
}

export function joinConfig(
  _official: OfficialHooksConfig,
  _meta: MetaConfig,
): ResolvedHook[] {
  throw new Error('not implemented: joinConfig');
}
