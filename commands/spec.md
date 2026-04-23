---
description: Interactively fill spec.yaml in Mode A/B/R/E (Step 2 of Canonical 6-Step)
---

# /harness:spec

루트 `spec.yaml` 을 대화형으로 채우거나 보강한다 (F-008).  "One Question at a Time" 원칙에 따라 한 번에 하나의 질문만 묻고, 모드에 따라 자동 채움 · 제안 · 존중 범위가 달라진다.

## Mode 요약

| Mode | 언제 쓰나 | 동작 |
|---|---|---|
| `A` (Auto)   | 최단 경로 부트스트랩 | 비어 있는 구조 필드를 합리적 기본값으로 자동 채움, 질문 없음 |
| `B` (Blank)  | 기본 제안 없이 직접 입력 | 비어 있는 필드만 제안 없이 질문 |
| `R` (Refine) | 자유 텍스트 보강 | `summary · description · domain.overview` 중 빈 것만 제안과 함께 질문 |
| `E` (Expert) | 정교한 수동 작성 | 기존 값은 절대 건드리지 않고 빈 필드만 제안 없이 질문 (BR-001) |

## 질문 필드 카탈로그

`src/steps/spec/fields.ts` 의 `SPEC_FIELDS` — 현재 10 개:

- `project.{name, version, summary, description}`
- `domain.overview`
- `constraints.tech_stack.{language, runtime, framework, testing}`
- `constraints.architecture.pattern`

## 실행 순서

1. 루트 `spec.yaml` 읽기 — 없으면 빈 문서로 시작해 신규 작성한다 (`ENOENT` 만 허용, 다른 에러는 종료코드 2).
2. Mode 분기 → `planMode` 가 `{ autofills, prompts }` 를 계산.
3. `prompts` 를 순차적으로 readline 으로 질문.  빈 답 + default 가 있으면 default 채택, 빈 답 + default 없음이면 해당 필드는 건너뛴다 (기존 값 보존).
4. 자동 채움 + 답변을 반영해 YAML 로 직렬화, 루트 `spec.yaml` 에 저장.

## 예시

```bash
$ harness-boot spec --mode=A
spec mode=A autofilled=6 asked=0 → /…/spec.yaml

$ harness-boot spec --mode=R
프로젝트 한 줄 요약은?
> harness-boot 은 …
프로젝트 상세 설명을 자유롭게 서술하세요.
>
도메인 개요 — 무엇을 · 왜 · 어떤 긴장을 다루는가?
> …
spec mode=R autofilled=0 asked=3 → /…/spec.yaml
```

## 자세한 계약

- 모드별 결정 테이블 · 필드 카탈로그 업데이트 절차 · BR-001 과의 관계는 `docs/commands/spec.md` 참조.
- 구현: `src/steps/spec/**/*.ts`
- 회귀 테스트: `tests/steps/spec/**/*.test.ts`
