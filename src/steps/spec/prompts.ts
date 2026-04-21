// harness-boot — Spec 대화형 진행 상태 (F-008)
//
// 설계 원칙: One Question at a Time.  한 번에 하나의 prompt 만 꺼내고,
// 사용자의 답을 받아 반영한 뒤 다음을 꺼낸다.  현재 위치를 순수 state 로
// 관리하므로 대화 트랜스크립트에 재적용 가능 (결정적).

import { setPath } from './path.js';
import type { SpecModePlan, SpecPrompt } from './types.js';

export interface SpecProgress {
  /** Mode A 가 미리 결정한 자동 채움 — 최종 적용 시 1 회 병합. */
  readonly autofills: Record<string, string>;
  readonly queue: readonly SpecPrompt[];
  /** 다음에 물을 prompt 의 index. `queue.length` 면 완료. */
  readonly cursor: number;
  /** 현재까지 수집한 answer 를 path→value 로 저장. */
  readonly answers: Record<string, string>;
}

export function startProgress(plan: SpecModePlan): SpecProgress {
  return {
    autofills: { ...plan.autofills },
    queue: plan.prompts,
    cursor: 0,
    answers: {},
  };
}

/** 다음 질문 (없으면 undefined — 진행 종료). */
export function nextPrompt(progress: SpecProgress): SpecPrompt | undefined {
  return progress.queue[progress.cursor];
}

export function isDone(progress: SpecProgress): boolean {
  return progress.cursor >= progress.queue.length;
}

/**
 * 현재 prompt 에 대한 답을 반영한다.  빈 문자열 answer 는 "건너뜀" 으로 해석 —
 * Mode R/E 처럼 기존 값 보존이 중요한 모드에서 사용자가 skip 할 수 있게 한다.
 * default 가 있는 prompt(Mode R) 에서 빈 답은 default 를 선택한 것과 동의어다.
 */
export function applyAnswer(
  progress: SpecProgress,
  answer: string,
): SpecProgress {
  const prompt = progress.queue[progress.cursor];
  if (!prompt) {
    // 이미 끝났는데 더 들어온 답 — 보수적으로 무시하지 않고 에러.
    throw new Error('spec prompts: 이미 종료된 progress 에 답을 적용할 수 없다.');
  }

  const nextAnswers = { ...progress.answers };
  const trimmed = answer.trim();
  if (trimmed !== '') {
    nextAnswers[prompt.path] = answer;
  } else if (prompt.default !== undefined) {
    // 빈 입력 + default 제안 → default 채택.
    nextAnswers[prompt.path] = prompt.default;
  }
  // 그 외 (빈 입력 + default 없음) 는 skip — 기존 값 유지.

  return {
    autofills: progress.autofills,
    queue: progress.queue,
    cursor: progress.cursor + 1,
    answers: nextAnswers,
  };
}

/**
 * progress 종료 후, 입력 spec 위에 autofills + answers 를 차례로 얹어 반환.
 * autofills 먼저 → answers 가 덮는다 (Mode 조합 시 answer 우선).
 */
export function materialize(
  current: Record<string, unknown>,
  progress: SpecProgress,
): Record<string, unknown> {
  let out = current;
  for (const [path, value] of Object.entries(progress.autofills)) {
    out = setPath(out, path, value);
  }
  for (const [path, value] of Object.entries(progress.answers)) {
    out = setPath(out, path, value);
  }
  return out;
}
