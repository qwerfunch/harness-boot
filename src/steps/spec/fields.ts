// harness-boot — /harness:spec 이 다루는 필드 카탈로그 (F-008)
//
// "One Question at a Time" UX 를 위해 질문 가능한 필드를 명시적으로 나열한다.
// 자유 텍스트(long) 필드는 Refine 모드에서만 재제안되며, 구조 필드는 Auto 에서
// 기본값이 제공된다.

import type { PromptKind } from './types.js';

export interface FieldSpec {
  path: string;
  kind: PromptKind;
  question: string;
  /** Refine 이 제안하거나 Auto 가 채울 기본값 — 없으면 Auto 에서도 제외한다. */
  autoDefault?: string;
  /** Refine 대상 — 자유 텍스트 여부. */
  freeText: boolean;
}

export const SPEC_FIELDS: readonly FieldSpec[] = [
  {
    path: 'project.name',
    kind: 'string',
    question: '프로젝트 이름은 무엇입니까? (영문 · 하이픈 권장)',
    freeText: false,
  },
  {
    path: 'project.version',
    kind: 'string',
    question: '프로젝트 버전은? (SemVer 예: 0.1.0)',
    autoDefault: '0.1.0',
    freeText: false,
  },
  {
    path: 'project.summary',
    kind: 'string',
    question: '프로젝트 한 줄 요약은?',
    freeText: true,
  },
  {
    path: 'project.description',
    kind: 'multiline',
    question: '프로젝트 상세 설명을 자유롭게 서술하세요.',
    freeText: true,
  },
  {
    path: 'domain.overview',
    kind: 'multiline',
    question: '도메인 개요 — 무엇을 · 왜 · 어떤 긴장을 다루는가?',
    freeText: true,
  },
  {
    path: 'constraints.tech_stack.language',
    kind: 'string',
    question: '주 개발 언어는? (예: TypeScript 5)',
    autoDefault: 'TypeScript 5',
    freeText: false,
  },
  {
    path: 'constraints.tech_stack.runtime',
    kind: 'string',
    question: '런타임은? (예: Node.js 20+ (ESM))',
    autoDefault: 'Node.js 20+ (ESM)',
    freeText: false,
  },
  {
    path: 'constraints.tech_stack.framework',
    kind: 'string',
    question: '프레임워크/플랫폼은? (필수)',
    autoDefault: 'Claude Code Plugin API v1',
    freeText: false,
  },
  {
    path: 'constraints.tech_stack.testing',
    kind: 'string',
    question: '테스트 러너는? (예: Vitest 2)',
    autoDefault: 'Vitest 2',
    freeText: false,
  },
  {
    path: 'constraints.architecture.pattern',
    kind: 'string',
    question: '아키텍처 패턴은? (layered · hexagonal · etc.)',
    autoDefault: 'layered',
    freeText: false,
  },
];
