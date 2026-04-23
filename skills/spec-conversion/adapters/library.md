# Adapter: library

**출처 샘플**: `design/samples/tzcalc` (v0.2 변환, skill v0.3 적용)
**버전**: 0.1 (tzcalc 5회차 변환으로 v0.0 draft 검증 완료)

---

## 0. 버전 히스토리

| 버전 | 변경 | 날짜 |
|------|------|------|
| 0.0 | 샘플 없이 작성된 초기 draft. `public_api[]` · `compatibility_matrix` 를 미해결 질문으로 보유 | Phase 2.6 |
| 0.1 | tzcalc 샘플 변환(Phase 2.7)으로 draft 검증. NEW-24~27 공식화. 매핑 힌트·함정·체크리스트 확장 | 2026-04-22 |

---

## 1. 도메인 시그널

- **강한 신호**
  - "SDK", "npm 패키지", "라이브러리", "tree-shakable", "ESM", "CJS", "subpath exports"
  - "공개 API", "named export", "default export 금지"
  - "semver", "breaking change", "@deprecated", "LTS"
  - "0-dep", "런타임 의존성 없음", "peerDependencies.optional"
- **중간 신호**
  - "번들 크기", "gz", "size-limit", "bundle budget"
  - "provenance", "npm publish --provenance"
  - "타입 정의 포함", "`.d.ts`"
- **약한 신호**
  - "문서 사이트", "Docusaurus", "예제", "examples/"
  - 배포 대상이 UI 없이 다른 코드에 import 되는 형태

> **domain_adapter 판정 기준**: 강한 신호 2개 이상 + deliverable 이 "다른 코드에서 import 되는 아티팩트" 이면 library 로 확정.

---

## 2. 우선 체크 갭

| 순위 | 갭 ID | 의미 | 설명 |
|------|-------|------|------|
| 1 | **NEW-24 public_api** | 라이브러리는 API 가 곧 제품 | tzcalc 에서 11개 심볼 + semver 축이 나와 공식화 |
| 2 | G-08 release_plan | semver, LTS, deprecation | 1.x LTS 개월 수, major/minor/patch 정의 |
| 3 | **NEW-25 compatibility_matrix** | 지원 런타임/버전 매트릭스 | Node/Deno/Bun/browser/TS 등 축 |
| 4 | **NEW-26 deliverable.artifacts[]** | subpath_exports, formats, provenance | "어떤 산출물을 어떻게 배포하는가"의 구조 |
| 5 | **NEW-27 bundle_size_budget** | gz 기반 크기 예산 + CI 강제 | 라이브러리 건강성 메트릭 |
| 6 | G-02 API (HTTP REST/GraphQL) | **대체로 무관** | HTTP API 가 아닌 프로그램적 API |
| 7 | G-04 UI | **무관** | `@xxx/react` 같은 컴패니언 패키지로 분리 |
| 8 | G-11 Assets | **무관** | 스프라이트·폰트 없음 |
| 9 | G-14/15/16 | **대체로 무관** | 런타임 스케줄러·실패 정책·관측이 라이브러리 책임 밖 |

---

## 3. 권장 엔티티 원형

| 엔티티 | 역할 | 필수 불변식 |
|--------|------|-------------|
| Package | 배포 단위 | 이름·버전 유일 |
| PublicApi | 공개 심볼 | semver 적용 대상, 숨김 불가, underscore prefix 는 비공개 |
| BreakingChange | 호환성 이슈 | major 버전 상승 필수 |
| CompatibilityEntry | 런타임/버전 쌍 | tier(supported/best-effort/experimental) 필수 |
| SubpathExport | 경로 별 진입점 | 이름·형식·사이드이펙트 여부 |
| BundleBudget | 크기 예산 | 범위(full/subset)·압축·enforcement |
| Example | 사용 예시 | 실제 실행 가능 보증 |

---

## 4. 매핑 힌트

### 4.1 v2.3.7 에서 표현 가능한 것

| 원본 패턴 | spec 필드 |
|-----------|----------|
| "Node 18+ 지원" | `constraints.tech_stack.compatibility` (한 줄 수준) |
| "tree-shakable ESM" | `constraints.architectural[]` |
| "named export only" | BR + `constraints.architectural[]` |
| "0-dep 원칙" | BR + `constraints.architectural[]` |
| "1.x LTS 24개월" | BR + `project.stakeholders[].concerns[]` 에 간접 |
| "공개 API 3개 이상 이름 나열" | `features[].modules[]` 에 이름만 + BR-004 (named export) |
| "@deprecated 경로" | BR 의 rationale + `metadata.conversion.notes` |

### 4.2 v2.3.7 에서 표현 불가 → unrepresentable.md

| 원본 패턴 | spec 필드 |
|-----------|----------|
| "공개 API: foo(), bar() — foo 의 인자 순서 변경은 major, opts 축 추가는 minor" | unrepresentable → **NEW-24 `public_api[]`** |
| "Node 18/20/22 · Deno 1.40+ · Bun 1.x · browsers Chrome 110+" 매트릭스 | unrepresentable → **NEW-25 `compatibility_matrix`** |
| "subpath exports: `pkg`, `pkg/sub1`, `pkg/sub2`, `sideEffects: false`, `provenance: true`" | unrepresentable → **NEW-26 `deliverable.artifacts[]`** |
| "gz < 8 kB 전체, < 2 kB 단일 함수, CI 에서 블록" | unrepresentable → **NEW-27 `bundle_size_budget`** |
| "Breaking change: v2 에서 X 제거" | G-08 `release_plan` + unrepresentable 의 `breaking_changes[]` |
| "IANA tzdata 번들하지 않음" (부정 계약) | **P-22 음성 주장** 블록(v0.4 후보) 또는 BR 자연어 |

---

## 5. 흔한 함정 (tzcalc 에서 관측된 것 포함)

### 5.1 v0.0 에서 이미 예측한 함정

- **공개 API 를 features 의 modules 이름으로만 암시** — 공개 API 는 계약이므로 G-02 유사 구조 필수. tzcalc 에서도 실제 발생 — modules 에 `to_zone`, `from_zoned` 이름만 쓰고 opts 축(ambiguous: earlier/later/reject) 을 BR 로 흘릴 뻔.
- **버전 정책을 milestone 자연어로 흘리기** — semver 는 규칙이라 BR 로. tzcalc 에서 BR-006 (deprecation) · BR-007 (LTS 24mo) 로 분리 성공.
- **호환성 매트릭스를 "Node 20+" 한 줄로 축소** — 지원 플랫폼·런타임·버전 축을 matrix 로 구조화. tzcalc 에서 즉흥 `constraints.compat` 서브블록으로 대응 → NEW-25 공식화.
- **문서·예제 품질을 NFR 에 누락** — 라이브러리는 docs 가 제품 경험. tzcalc 의 F-009 에서 AC 2개로만 표현해 약함.

### 5.2 v0.1 에서 새로 발견된 함정

- **음성(negative) 계약의 자연어 뭉개기** — "런타임 dependencies = 0" · "IANA tzdata 번들 = 없음" 은 검증 가능한 불변식. BR 자연어로만 두면 CI 에서 강제 못 함. (skill v0.4 P-22 후보)
- **빌드 deps vs 런타임 deps 혼동** — `constraints.tech_stack` 에 둘을 섞으면 "0-dep" 계약이 흐려짐. tzcalc 에서 실제 발생: `tsup`, `vitest` 가 `dependencies` 같아 보이게 기록됨.
- **번들 크기 회귀를 BR 로만 남기기** — `size-limit` 수치(8 kB / 2 kB) 는 CI gate. AC 나 BR 에만 남기면 P-8 위반. NEW-27 로 분리.
- **deliverable.artifacts 를 type 한 줄로 축소** — npm 패키지도 subpath · format · provenance 축이 존재. type="library" 만으론 손실.
- **`@deprecated` 경로를 문서에만 기록** — minor 한 번 경유 후 major 에서 제거라는 **프로세스 자체가 계약**. tzcalc 에서 BR-006 에 rationale 로 명시.
- **Temporal polyfill 같은 peerDep 의 optional/mandatory 미결정을 AC 로 봉인** — 이번에 open_questions 로 올바르게 보존.

### 5.3 library 전용 비해당 원칙 (tzcalc 에서 확인)

다음 원칙은 library 도메인에서 "비해당" 이 정당한 답. 체크리스트에서 "해당 없음 근거 기록" 으로 넘김:

| 원칙 | 비해당 근거 |
|------|-------------|
| P-9 prototype_mode | 라이브러리는 prototype 이 아니라 정식 배포 |
| P-11 assets | 스프라이트·폰트 없음 |
| P-14 schedule/concurrency | 런타임 스케줄러 없음 |
| P-17 module layer | Tool/Skill/Agent 계층 없음 |
| P-18 execution DAG | 실행 주체 아님 |

---

## 6. 체크리스트 (v0.1 확정)

기본 체크:
- [ ] 공개 API 심볼이 3개 이상 언급되면 **NEW-24 `public_api[]`** 엔트리 필수
- [ ] semver 정책(major/minor/patch 정의 또는 breaking change 언급) 이 있으면 BR 존재
- [ ] 지원 플랫폼/런타임 버전 축이 2개 이상 (Node·Deno·Bun·browser·TS 등) → **NEW-25 `compatibility_matrix`**
- [ ] subpath exports 또는 dual format(ESM+CJS) 이 언급되면 **NEW-26 `deliverable.artifacts[]`**
- [ ] 번들 크기 수치(kb, gz) 가 언급되면 **NEW-27 `bundle_size_budget`**
- [ ] 0-dep / tzdata 번들 안 함 등 "없음"주장은 BR 자연어 + invariants 블록(P-22 v0.4) 양쪽 기록

추가 체크:
- [ ] 문서 사이트/예제 품질이 NFR 또는 별도 필드로 기록
- [ ] 1.x LTS 개월 수가 명시되면 BR 존재
- [ ] `@deprecated` 경로가 명시되면 BR 에 rationale 기록
- [ ] `underscore prefix = internal` 같은 "공개 API 경계 규칙" 이 있으면 BR 분리
- [ ] peerDep.optional 이 있으면 `constraints.tech_stack` 에 기록 + 관련 폴백 동작은 AC 로

비해당 선언:
- [ ] P-9 (prototype_mode false 근거 기록: "정식 배포 라이브러리")
- [ ] P-11/14/17/18 비해당 근거 기록
- [ ] G-04 (UI 없음) 근거 기록

어댑터 검증 기록 (P-21):
- [ ] `metadata.conversion.domain_adapter: "library"` 선언
- [ ] `adapter_version_used: "0.1"` 기록
- [ ] unrepresentable.md 에 "예측 vs 실제" 표 존재

---

## 7. v0.0 예측 vs 실제 (tzcalc 검증 결과)

| 예측 항목 | 실제 재현 | 판정 |
|-----------|:--------:|------|
| G-02 API 필수 (공개 API 표면) | ✅ | **정확 → NEW-24 로 승격** |
| G-08 release_plan (semver/LTS) 필수 | ✅ | 정확 |
| NEW(draft) public_api surface | ✅ | **NEW-24 로 공식화** |
| NEW(draft) compatibility_matrix | ✅ | **NEW-25 로 공식화** |
| G-04 대체로 무관 | ✅ | 정확 — 비해당 선언으로 처리 |

**예측 못했던 것 (v0.1 에서 추가)**:
- NEW-26 deliverable.artifacts[] (subpath/format/provenance 축)
- NEW-27 bundle_size_budget (CI gate 축)
- 음성(negative) 계약의 구조화 함정
- 빌드 deps vs 런타임 deps 혼동 함정

---

## 8. 미해결 질문 (v0.2 후보)

| # | 질문 | 해소 경로 |
|---|------|-----------|
| Q-1 | v2.3.7 `deliverable.type` enum 에 `library` 가 있는가? | `docs/schemas/spec.schema.json` 직접 확인 |
| Q-2 | `public_api[]` 를 top-level 에 둘지 `domain` 하위에 둘지 | v2.3.8 RFC |
| Q-3 | `compatibility_matrix` 와 기존 `constraints.tech_stack.compatibility` 의 통폐합 | v2.3.8 RFC |
| Q-4 | `bundle_size_budget` 이 `quality_gates` 같은 더 일반적 축으로 승격될지 | 다른 도메인(프론트엔드 SDK, 컨테이너 이미지) 샘플 추가 후 재평가 |
| Q-5 | OpenAPI/GraphQL 스키마와의 연동 전략 (G-02 확장) | library 아닌 HTTP API 샘플에서 다루어질 예정 |
| Q-6 | 음성 계약(0-dep, no-tzdata-bundled) 의 구조화 — `invariants[]` top-level 블록 승격? | skill v0.4 P-22 후보 |

---

## 9. 샘플 참조

**주 샘플**: `design/samples/tzcalc/`
- `plan.md` — 175줄 planning 원본
- `spec.yaml` — 5회차 변환 결과 (skill v0.3)
- `unrepresentable.md` — 16개 갭 (NEW-24~27 정식화)
- `conversion-notes.md` — 21 원칙 작동률 14/16 (비해당 5 제외)
- `backlink-matrix.md` — 15 섹션 중 ★★★+ = 33%

**다음 검증 후보** (v0.2 승격 전 권장):
- 프론트엔드 UI SDK (`@xxx/react` 또는 `shoelace` 류) — subpath + types + Tree-shake + a11y
- 컨테이너 이미지 배포 라이브러리 (e.g. Go module → multi-arch OCI) — artifacts[] 가 subpath 아닌 arch 축
- Python 패키지 (pypi) — extras_require, optional-deps 축이 npm 과 다름
