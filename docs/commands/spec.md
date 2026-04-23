# /harness:spec (F-008)

> **doc_sync 대상** — 이 문서는 `src/steps/spec/**/*.ts` 와 `commands/spec.md` 의
> 변경에 동기화된다 (severity: `warn`).  Mode 테이블 · 필드 카탈로그 · 빈 답
> 처리 규약이 바뀌면 본 문서를 함께 갱신해야 하며, 그렇지 않으면
> `/harness:check` Gate 5 에서 경고가 발생한다.

Canonical 6-Step 의 2 단계.  루트 `spec.yaml` 을 대화형으로 채우거나 보강한다.
설계 원칙은 **One Question at a Time** — 한 번에 하나의 질문만 묻고, 모드에
따라 자동 채움 · 제안 · 기존 값 보존 범위가 달라진다.

---

## 1. Mode 결정 테이블

| Mode | 자동 채움 | 질문 대상 | 제안(default) | 기존 값 |
|---|---|---|---|---|
| `A` Auto   | `autoDefault` 가 있는 빈 필드 | 없음 | — | 보존 |
| `B` Blank  | 없음 | 모든 빈 필드 | 없음 | 보존 |
| `R` Refine | 없음 | `freeText: true` 이면서 비어 있는 필드 | `autoDefault` 를 제안 | 보존 |
| `E` Expert | 없음 | 모든 빈 필드 | 없음 | **절대** 건드리지 않음 (BR-001) |

순수 계산: `planMode(PlanInput): SpecModePlan` — `src/steps/spec/modes.ts`.

## 2. 필드 카탈로그

`SPEC_FIELDS` (`src/steps/spec/fields.ts`) — `{ path, kind, question, autoDefault?, freeText }`

현재 10 개 필드:

- `project.name` — 문자열 · 제안 없음 · 구조 필드
- `project.version` — 문자열 · `0.1.0` 제안 · 구조 필드
- `project.summary` — 문자열 · 자유 텍스트 (Refine 대상)
- `project.description` — 다중 라인 · 자유 텍스트 (Refine 대상)
- `domain.overview` — 다중 라인 · 자유 텍스트 (Refine 대상)
- `constraints.tech_stack.language` — `TypeScript 5`
- `constraints.tech_stack.runtime` — `Node.js 20+ (ESM)`
- `constraints.tech_stack.framework` — `Claude Code Plugin API v1`
- `constraints.tech_stack.testing` — `Vitest 2`
- `constraints.architecture.pattern` — `layered`

카탈로그 확장은 `SPEC_FIELDS` 배열에 항목을 추가하는 것만으로 반영된다 —
전제: `path` 가 점-경로 형식(`a.b.c`) 이고 배열 인덱싱을 쓰지 않는다.

## 3. 빈 답 처리 규약

`applyAnswer(progress, answer)` (`src/steps/spec/prompts.ts`) 의 분기:

1. `answer.trim() !== ''` → 그 문자열을 해당 path 에 저장.
2. `answer.trim() === '' && prompt.default !== undefined` → **default 를 선택** 한 것으로 저장.
3. `answer.trim() === '' && prompt.default === undefined` → **skip** — 기존 값 보존.

Mode R 에서 사용자가 제안을 그대로 받아들이려면 Enter 만 누르면 된다.
Mode E 에서 빈 입력은 항상 skip → 기존 값을 덮지 않는다.

## 4. BR-001 과의 관계

본 명령은 **사용자가 명시적으로 spec.yaml 을 편집하려는 유일한 입력 경로** 다.
따라서 최종 YAML 은 루트 `spec.yaml` 에 **덮어쓴다** — BR-001 의 "덮어쓰기
금지" 는 _파생 산출물_ 에 한정한다.  spec.yaml 은 SSoT 이자 편집 대상이다.

단, Mode E 는 BR-001 의 정신을 상속 — 기존 값이 있는 필드는 질문도 받지
않고 자동 채움도 하지 않는다.  사용자가 명시 답변으로 값을 바꾸는 것만 허용.

## 5. CLI 사용법

```bash
harness-boot spec --mode=A   # 자동 채움 (질문 없음)
harness-boot spec --mode=B   # 빈 필드 질문
harness-boot spec --mode=R   # 자유 텍스트만 제안과 함께
harness-boot spec --mode=E   # 기존 값 불가침, 빈 필드만 질문
harness-boot spec            # 기본 --mode=A
```

종료 코드:
- `0` — 성공
- `2` — 사용자 입력 문제 (잘못된 `--mode` 값, spec.yaml 읽기 실패 등)
- `1` — 예기치 못한 런타임 에러

## 6. 공개 API

```ts
import {
  runSpec,
  planMode,
  startProgress,
  applyAnswer,
  isDone,
  nextPrompt,
  materialize,
  SPEC_FIELDS,
} from '../../src/steps/spec/index.js';
```

- `runSpec(input): Promise<RunSpecResult>` — 오케스트레이터.  `ask` 주입으로
  readline · 테스트 배열 모두 지원.
- `planMode(PlanInput): SpecModePlan` — 순수.  `autofills + prompts` 계산.
- 나머지는 진행 상태 기계 (`SpecProgress` 불변 업데이트).

## 7. 결정성 · 테스트

- 모든 분기는 순수 함수 — fixture 없이 `toMatchObject` 로 단언.
- `tests/steps/spec/modes.test.ts` · `prompts.test.ts` · `runSpec.test.ts` 가
  5 AC 전수 커버.
- 대화 I/O 는 `AskFn` 주입 — 테스트는 고정 답 Map 을 넘긴다.

## 8. 포워드 포인터

- **F-007** (`/harness:analyze`) — 본 명령이 만든 `spec.yaml` 을 해시로 잡아
  `.harness/harness.yaml.generated_from.root_hash` 에 기록한다.
- **F-009** (`/harness:plan`) — spec → `.claude/**` 어댑터 파생.  본 명령의
  결과 spec 이 plan 의 입력.
- **F-006** — 본 명령이 쓰는 `spec.yaml` 은 F-006 스키마 · 규칙으로 검증되어야
  하며, 현재 CLI 는 쓰기 전 검증을 생략한다 (빈 spec 초기화 유즈케이스
  보존). 검증은 `/harness:check` Gate 에서 수행.

---

## 참고

- `spec.yaml` F-008 acceptance_criteria · doc_sync 계약.
- BR-001 덮어쓰기 금지 (spec.yaml 은 예외 — SSoT 편집 경로).
- 구현: `src/steps/spec/{types,fields,path,modes,prompts,index}.ts`.
