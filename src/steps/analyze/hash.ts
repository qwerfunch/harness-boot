// harness-boot — spec 결정적 해시 (F-007)
//
// 현재는 spec.yaml 문자열의 sha256 만.  F-013 에서 하위 파생 파일까지 포함한
// 머클 트리 루트로 확장된다 — 지금 단계에서는 spec 본문 변경만 감지하면
// idempotent vs new_input 분기가 성립한다.

import { createHash } from 'node:crypto';

export function sha256(source: string): string {
  return createHash('sha256').update(source, 'utf8').digest('hex');
}
