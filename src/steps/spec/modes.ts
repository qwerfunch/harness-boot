// harness-boot — /harness:spec Mode A/B/R/E 순수 계획기 (F-008)
//
// 입력 (현재 spec · 모드) 을 받아 "무엇을 자동 채우고 · 무엇을 물을지" 만 계산한다.
// 실제 fs write 도, 대화 I/O 도 이 모듈 밖의 책임 (BR-009 계층 분리).

import { SPEC_FIELDS } from './fields.js';
import { getPath, isEmpty } from './path.js';
import type { PlanInput, SpecModePlan, SpecPrompt } from './types.js';

export function planMode(input: PlanInput): SpecModePlan {
  const { current, mode } = input;
  const autofills: Record<string, string> = {};
  const prompts: SpecPrompt[] = [];

  for (const field of SPEC_FIELDS) {
    const existing = getPath(current, field.path);
    const empty = isEmpty(existing);

    switch (mode) {
      case 'A':
        // Auto — 비어 있고 autoDefault 가 있으면 자동 채움, 질문은 전혀 하지 않는다.
        if (empty && field.autoDefault !== undefined) {
          autofills[field.path] = field.autoDefault;
        }
        break;

      case 'B':
        // Blank — 비어 있는 모든 필드를 제안 없이 질문한다.
        if (empty) {
          prompts.push({
            path: field.path,
            question: field.question,
            kind: field.kind,
          });
        }
        break;

      case 'R':
        // Refine — 자유 텍스트 필드 중 비어 있는 것만, autoDefault 를 제안으로 제시.
        if (empty && field.freeText) {
          const prompt: SpecPrompt = {
            path: field.path,
            question: field.question,
            kind: field.kind,
          };
          if (field.autoDefault !== undefined) prompt.default = field.autoDefault;
          prompts.push(prompt);
        }
        break;

      case 'E':
        // Expert — 비어 있는 필수 필드를 제안 없이 질문. 기존 값은 절대 건드리지 않는다 (BR-001).
        if (empty) {
          prompts.push({
            path: field.path,
            question: field.question,
            kind: field.kind,
          });
        }
        break;
    }
  }

  return { autofills, prompts };
}
