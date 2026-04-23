# spec.yaml Schema v0.2 (F-006)

> **doc_sync 대상** — 이 문서는 `src/core/spec/**/*.ts` 와
> `schemas/spec.schema.json` 의 변경에 동기화된다 (severity: `error`).
> 규칙 · 필드 · 기본값이 바뀌면 본 문서를 함께 갱신해야 하며, 그렇지 않으면
> `/harness:check` Gate 5 에서 실패한다.

`spec.yaml` 은 harness-boot 의 **단일 진실의 원천(SSoT)** 이다.  본 피처는
(a) 대외 공개용 JSON Schema(`schemas/spec.schema.json`, Draft 2020-12) 와
(b) 내부 의미 검증 규칙 6 개 + 모듈 유사도 warning 을 함께 담당한다.  두
계층은 역할이 다르다.

| 계층 | 위치 | 책임 |
|---|---|---|
| **형식** (Form) | `schemas/spec.schema.json` | 키 존재 · 타입 · enum · 정규식 — IDE 자동완성 · 사용자 입력 1 차 방어 |
| **의미** (Semantics) | `src/core/spec/rules.ts` | 순환 의존 · Walking Skeleton · sensitive 강제 등 — 그래프 · 교차참조 · 도메인 규칙 |

---

## 1. 사용자 입장 — IDE 자동완성

`spec.yaml` 파일 맨 위에 이미 다음 주석이 박혀 있다.

```yaml
# yaml-language-server: $schema=./schemas/spec.schema.json
```

VS Code `YAML` 확장이 이 주석을 읽어 키 · enum · required 필드 자동완성을
제공한다.  AC4 의 수용 지점.

## 2. JSON Schema 개요

- **Draft** — `$schema: https://json-schema.org/draft/2020-12/schema`
- **$id** — `https://harness-boot.dev/schemas/spec.schema.json`
- **필수 최상위 키** — `version` · `project` · `domain` · `constraints` ·
  `deliverable` · `features`
- **`additionalProperties: true`** 로 확장 허용 — 사용자 프로젝트가 자유
  필드를 추가해도 schema 수준에서 거절하지 않는다.  금지 필드는 의미 규칙이
  잡는다.

### 2.1 주요 enum

| 필드 | 허용 값 |
|---|---|
| `features[].type` | `skeleton` · `feature` · `spike` · `chore` |
| `features[].status` | `planned` · `in_progress` · `done` · `blocked` |
| `features[].test_strategy` | `tdd` · `lean-tdd` · `integration` · `state-verification` · `property` · `manual` |
| `deliverable.type` | `library` · `cli` · `web-service` · `ui` · `data-pipeline` · `other` |
| `features[].doc_sync[].severity` | `error` · `warn` · `warning` · `info` |

### 2.2 ID 정규식

- `features[].id` — `^F-\d{3,}$` (예: `F-001`, `F-012`)
- `deliverable.smoke_scenarios[].id` — `^SS-\d{3,}$`
- `features[].depends_on[]` — `^F-\d{3,}$`

## 3. 의미 검증 규칙 (§5.1 6 rules + similarity)

`validateSpec(data)` 가 순서대로 적용하며 `SpecFinding[]` 을 반환한다.

| Rule ID | severity | 설명 |
|---|---|---|
| `spec/walking-skeleton` | error | `features[0].type === 'skeleton'`.  `constraints.quality.prototype_mode === true` 시 면제 |
| `spec/cycle` | error | `features[].depends_on` 그래프 비순환 (self-loop 포함) |
| `spec/deliverable-completeness` | error | `deliverable.type` 이 `other` 가 아니면 `entry_points` 와 `smoke_scenarios` 각각 ≥ 1 필요 |
| `spec/sensitive-enforcement` | error / warn | `title` 이나 `modules[]` 중 하나가 `/^(auth\|payment\|pii\|hook\|gate\|audit)/i` 에 매치되면 `test_strategy === 'tdd'` 강제.  `sensitive: false` 로 명시 override 하면 warning 으로 다운그레이드 |
| `spec/strategy-required-fields` | error | `tdd` → `tdd_focus` 배열 ≥ 1, `integration` · `state-verification` → `test_strategy_reason` 문자열 non-empty |
| `spec/framework-required` | error | `constraints.tech_stack.framework` non-empty |
| `spec/module-similarity` | warning | 전체 feature.modules[] 합집합 중 Levenshtein ≤ 2 **AND** edit ratio ≤ 0.34 인 이름 쌍은 경고 (오타 탐지) |

### 3.1 sensitive 자동 추론 경로

1. feature.title 또는 modules[] 중 하나가 `SENSITIVE_NAME_PATTERN` 에 매치
2. `test_strategy === 'tdd'` 면 통과 — 이미 TDD 정책 하에 구축됨
3. 그렇지 않고 `sensitive: false` 로 명시 override — **warning** 수준으로
   리포트 (검토 권장)
4. 그 외 — **error**

설계 근거: Gate 와 Hook 은 품질 · 안전의 최종 관문(BR-005 · BR-006) 이라
TDD 가 아니면 회귀 리스크가 크다.  사용자는 `sensitive: false` 로 명시할
자유를 유지하되 경고를 감수한다.

### 3.2 유사도 계산

`findSimilarModulePairs(names)` 는 대칭 쌍을 한 번씩만 반환한다:

- 거리(`levenshtein`) ≤ 2
- 편집 비율(거리 / max 길이) ≤ 0.34

짧은 이름(`a` vs `b`) 은 거리 1 이어도 비율 1.0 이 되어 플래그되지 않는다.

## 4. 공개 API

```ts
import {
  parseSpecYaml,
  validateSpec,
  hasSpecErrors,
  findSimilarModulePairs,
  levenshtein,
  SENSITIVE_NAME_PATTERN,
} from '../src/core/spec/index.js';
```

- `parseSpecYaml(source): { ok: true, data } | { ok: false, error }` —
  순수, 예외 없음.
- `validateSpec(data): { findings }` — 순수, 입력이 object 가 아니면 `spec/
  framework-required` 로 단일 에러 반환 (상위 JSON Schema 가 이미 막았어야 함).
- `hasSpecErrors(report): boolean` — `severity: 'error'` 존재 여부.

## 5. 에러 리포트 구조

```ts
type SpecFinding = {
  rule: SpecRuleId;
  severity: 'error' | 'warning' | 'info';
  message: string;   // 한국어 (BR-010)
  path?: string;     // "features[F-002].test_strategy" 같은 JSON Pointer 유사 표기
};
```

`path` 는 사람이 읽기 쉬운 경로로, JSON Pointer 엄격 형식은 아니다.  에러
리포터(F-011 Gate 5) 가 이를 가공해 파일 위치로 매핑한다.

## 6. 도그푸드 (AC5)

`tests/core/spec/schema.test.ts` 는 루트 `spec.yaml` 을 AJV (strict: false)
로 로드해 현재 스키마에 대해 valid 한지 검증한다.  CI 에서 동일 테스트가
재실행되며, 스키마 변경이 자기 자신을 깨뜨리면 즉시 red 가 된다.

## 7. 포워드 포인터

- **F-007** (`/harness:analyze`) — 초기 `.harness/spec.yaml` 스켈레톤 생성
  시 본 스키마를 reference 한다.
- **F-011** (`/harness:check`) — Gate 5 에서 `validateSpec` + AJV 조합을
  실행해 의미 · 형식 두 축 모두 검증한다.
- **F-008** (`/harness:spec`) — Mode A/B/R/E 대화형 편집이 본 스키마의
  enum / required 를 UX 힌트로 사용한다.

---

## 참고

- `spec.yaml` F-006 `acceptance_criteria` · `tdd_focus` · `doc_sync`.
- 설계 §5.1 검증 규칙 6 개 (depends_on 비순환 · Walking Skeleton ·
  deliverable 완전성 · sensitive 강제 · 전략별 필수 필드 · framework 필수).
- JSON Schema Draft 2020-12 스펙:
  https://json-schema.org/draft/2020-12/schema
