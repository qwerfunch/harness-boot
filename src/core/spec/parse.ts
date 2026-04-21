// harness-boot — spec.yaml YAML 파싱 계층 (F-006)
//
// `yaml@2` (eemeli/yaml) 를 사용한 얇은 래퍼.  파싱 성공 시 raw 객체를, 실패
// 시 인간 가독성 높은 에러 문자열을 반환한다.  형식 계약(JSON Schema) 및
// 의미 규칙(rules.ts) 은 별도 레이어에서 적용된다.

import { parse as parseYaml, YAMLError } from 'yaml';

import type { ParseResult } from './types.js';

export function parseSpecYaml(source: string): ParseResult {
  try {
    const data = parseYaml(source, { prettyErrors: true });
    if (data === null || data === undefined) {
      return { ok: false, error: 'spec.yaml 이 비어 있거나 null 을 반환한다.' };
    }
    return { ok: true, data };
  } catch (e: unknown) {
    const message =
      e instanceof YAMLError
        ? `YAML 파싱 실패: ${e.message}`
        : e instanceof Error
          ? `YAML 파싱 실패: ${e.message}`
          : 'YAML 파싱 실패: 알 수 없는 에러';
    return { ok: false, error: message };
  }
}
