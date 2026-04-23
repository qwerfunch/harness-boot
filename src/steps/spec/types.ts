// harness-boot — /harness:spec Mode 분기 타입 (F-008)
//
// 4 모드 각자의 목적:
//   A (Auto)    — 비어 있는 필수 필드를 "합리적 기본값" 으로 자동 채움
//                 (설치 후 walking-skeleton 최단 경로).  프롬프트는 발생하지 않는다.
//   B (Blank)   — 비어 있는 필드만 질문, 기본 제안 없음.
//   R (Refine)  — 자유 텍스트 필드(summary · description · overview) 중
//                 비어 있는 것만 제안 기본값과 함께 질문.
//   E (Expert)  — 비어 있는 필수 필드를 제안 없이 질문, 기존 값 절대 유지 (BR-001).

export type SpecMode = 'A' | 'B' | 'R' | 'E';

export type PromptKind = 'string' | 'multiline';

export interface SpecPrompt {
  path: string;           // JSON-dotted path, e.g. "project.name"
  question: string;
  kind: PromptKind;
  default?: string;       // Mode R 만 제안
}

export interface SpecModePlan {
  autofills: Record<string, string>;  // Mode A 만 비어 있지 않음
  prompts: readonly SpecPrompt[];
}

export interface PlanInput {
  current: unknown;                   // parsed spec (부분적 · 비어 있을 수 있음)
  mode: SpecMode;
}
