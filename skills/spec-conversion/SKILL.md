---
name: spec-conversion
description: |
  기획 문서(plan.md 등) 또는 아키텍처 문서(architecture.md 등)를 harness-boot
  의 `.harness/spec.yaml` (v2.3.8 스키마)로 변환할 때 사용. 사용자가 "기획을
  스펙으로", "plan.md를 spec.yaml로", "설계문서 변환", "스펙 채우기" 등을
  요청하는 경우 트리거. 변환은 정보 손실을 최소화하고 🔒 구조 / 🗒 자유텍스트
  경계를 엄격히 준수하며, 담을 수 없는 덩어리는 `unrepresentable.md` 로
  분리한다. 도메인별 세부 체크는 `adapters/` 하위의 도메인 어댑터로 위임.
version: 0.5
---

# Spec Conversion Skill (v0.5)

v0.5 는 Phase 2.13 (v2.3.8 스키마 승격 · `metadata.extensions.*` → `metadata.*`) 이후의 **네이티브 전환** 판이다:

- **타겟 스키마 v2.3.7 → v2.3.8**. 9 블록(`command_map` / `ambient_files` / `host_binding` / `drift_catalog` / `versioning_axes` / `contribution_points` / `preamble_contract` / `changelog` / `gate_chain`)을 **`metadata.*` 에 직접 작성**. 생성 시 `metadata.extensions.*` 경유 금지.
- **예외 1건**: `agent_permissions` 는 여전히 `metadata.extensions.agent_permissions` (v2.4.0 스키마 대기).
- **검증 경로 2종 고정**: `docs/schemas/spec.schema.json` 로 validate + `scripts/conversion_diff.py --all` 로 시맨틱 회귀.
- **하위 호환**: 레거시 `metadata.extensions.*` 입력을 만나면 `scripts/upgrade_to_2_3_8.py` 호출 후 진행.

v0.4 (Phase 2.8~2.13) 자산 계승 — 원칙 24개(P-1~P-24), 어댑터 5종(cli/worker/saas/game/library v0.1/meta v0.2), 8 샘플 골든, v2.3.8 JSONSchema 및 마이그레이션 스크립트.

v0.3 에서 계승된 자산:
- v0.2 대비 원칙 **7개 추가** (P-15~P-21) → 21개 → 이번에 24개
- **MUST/SHOULD/MAY 우선순위 태깅** — agent 프롬프트 경제성
- **원칙별 정량 지표** — "작동했다" 가 아니라 "얼마나 커버했는가"
- **4단계 워크플로** — Stage 4 검증(back-link 매트릭스)
- **문서 성숙도 축** — planning/architecture/implementation 세 모드 분기

**관련 지식 자산**:
- 예시 스냅샷 **8건 (+3 재변환, meta 3-샘플)**: `design/samples/{url-shortener,retro-jumper,price-crawler,vapt-apk-sast,tzcalc,harness-boot-self,vite-bundle-budget,vscode-commit-craft}/` — meta 3-샘플은 `{...}/v2/` 에 **v2.3.8 네이티브** 산출물 (★★★+ 88~94%)
- 갭 매트릭스: `harness-boot-self/unrepresentable.md §4` (누적 G-01~16 + NEW-17~34) + `vite-bundle-budget/unrepresentable.md §3` (NEW-35) + `vscode-commit-craft/unrepresentable.md §3` (NEW-36 — **총 36종**) + `{...}/v2/unrepresentable-v2.md` 재변환 기준 해소/잔여 판정
- Phase 1 리뷰: `design/samples/PHASE1-REVIEW.md`
- 재변환 비교: `design/samples/META-RECONVERSION-COMPARE.md` (3 subtype fingerprint + F-1~F-8 HIT)
- 도메인 어댑터: `skills/spec-conversion/adapters/{worker,saas,game,library v0.1,meta v0.2}.md`
- 템플릿: `skills/spec-conversion/templates/backlink-matrix.md`
- 회귀 골든: `tests/regression/conversion-goldens/` (**8 샘플**, 8/8 PASS) — v2 재변환본은 별 트랙
- 세만틱 diff: `scripts/conversion_diff.py`
- **v2.3.8 스키마**: `docs/schemas/spec.schema.json` (draft 2020-12, 9 `$defs`, 11/11 validate)
- **마이그레이션**: `scripts/upgrade_to_2_3_8.py` (ruamel round-trip, `--dry-run`/`--no-backup`)
- v2.3.8 승격 RFC: `design/rfcs/v2.3.8-metadata-extensions-promotion.md`
- v2.4.0 후보 RFC: `design/rfcs/v2.4.0-schema-expansion.md` (`agent_permissions` + 잔여 P2)

---

## 0. 트리거 조건

- 사용자가 "plan.md → spec.yaml" / "기획 → 스펙" / "설계문서 변환" 등 요청
- `.harness/spec.yaml` 이 비었거나 `metadata.source.origin: planning_doc|architecture_doc` 프로젝트에서 `/harness:spec` Mode B 실행
- 사용자가 명시적으로 `@spec-conversion` 호출

---

## 1. 4단계 워크플로 (P-1, P-4, P-12, P-22 통합)

### Stage 0 — 문서 축 식별 (선제)

정찰 전에 먼저 **이 문서가 무엇인가** 를 판정:

1. **성숙도 축** (P-16):
   - **planning** — 200~500줄 초안, "할 일 목록" 성격
   - **architecture** — 1000줄+ 결정 문서, 이미 구현 직전
   - **implementation** — 코드 있는 상태(역방향 변환)
2. **도메인 축** — 어댑터 로드(§8 참조)
3. **저자 강조 축** (P-21) — 원본이 가장 강조하는 주장 3개를 뽑아
   `project.vision` 과 BR.rationale 에 **반드시** 반영

### Stage 1 — 정찰 (Reconnaissance)

문서 전체를 훑으며 **섹션별로 매핑 후보만 나열**. YAML 한 줄도 쓰지 않는다.

정찰 시 주의할 신호들:

- "v1 범위 밖", "비포함", "비목표" → **non_goals** (P-7)
- 수치 상수(k=0.01, 3초 무적, ±5%) → **tuning_constants** (P-8)
- "HTTP 5xx 재시도", "timeout 후 DLQ", "exponential backoff" → **failure_policies** (P-13)
- "매일 03:00", "cron", "concurrency 1", "rate limit" → **entry_points.schedule** (P-14)
- 스프라이트·팔레트·오디오·폰트·템플릿 → **assets** (P-11)
- "~면 좋음", "혹시", "TBD", "논의 필요", "미결정" → **open_questions** (P-6)
- 외부 SaaS·API 벤더 이름 → **external_dependencies** (P-12)
- "Tool", "Skill", "Agent" 3-layer 서술 → **module.layer** 힌트 (P-17/NEW-17)
- DAG·상태머신·실행 순서 언급 → **execution DAG** (P-18/NEW-18)
- LLM 모델명 + 라우팅·비용 → **llm.routing** (NEW-19)
- 요금제 표 → **pricing.plans** (NEW-20)
- 벤치마크·Ground Truth → **benchmarks** (NEW-22)

### Stage 2 — 작성

정찰 결과를 토대로 우선순위 순으로 YAML 작성:

1. `project` → `domain` (의미 결정력 높은 블록)
2. `features` (skeleton 우선)
3. `constraints` / `deliverable`
4. `metadata.source.source_lines` (최소 엔티티·피처 1건씩)

작성 중 **자리 없는 덩어리**를 만나면 즉시 unrepresentable.md 섹션에 1줄
기록(상세 기술은 Stage 3).

### Stage 3 — 갭 기록 및 노트 작성

- `unrepresentable.md`: 갭 카탈로그 (ID·인용·제안 스키마·**임시 대응 품질
  점수**(P-22) 필수)
- `conversion-notes.md`: 망설임·결정 로그 (skill 개선 재료)

### Stage 4 — 검증 (NEW in v0.3)

`templates/backlink-matrix.md` 기반으로 **원본의 모든 섹션이 산출물 중
하나로 갔는지** 확인:

- 미매핑 섹션 = **0** 이어야 함 (의도적 생략은 근거 기록)
- 매핑 품질 점수 분포 측정 (★1~5)
- 신규 갭(NEW-\*)이 발견되면 conversion-notes 에 skill 갱신 후보 기록

---

## 2. 원칙 목록 (21개, 우선순위 태깅됨)

**태그 의미**: MUST = 위반 시 스펙 붕괴 / SHOULD = 도메인 독립적 권장 /
MAY = 도메인 특수적

### 공통 원칙 (v0.1)

| # | 태그 | 원칙 | 한 줄 요약 | 메트릭 |
|---|:----:|------|-----------|--------|
| **P-1** | MUST | 4단계 변환 | Stage 0/1/2/3/4 분리, 정찰에서 타협 금지 | `stages_completed / 5` |
| **P-2** | MUST | 자리 없는 덩어리는 unrepresentable.md | 억지 매핑 금지 | `gaps_recorded / gaps_encountered` |
| **P-3** | MUST | 모호 표현을 AC 로 옮기지 않음 | "~면 좋음" → open_questions | `ambiguous_in_ac_ratio` (목표 ≤ 5%) |
| **P-4** | SHOULD | 엔티티 필드 점검 의무 | entity 정의 직후 필드 목록 탐색 | `fields_captured / fields_in_source` |
| **P-5** | SHOULD | modules 에서 external deps 추출 | 벤더성 이름 → 인벤토리 | `deps_extracted / vendor_hints` |
| **P-6** | MUST | 미결정을 결정으로 표현 금지 | 확신 없으면 open_question | `open_q_preserved / open_q_in_source` |

### v0.2 신규 원칙

| # | 태그 | 원칙 | 한 줄 요약 | 메트릭 |
|---|:----:|------|-----------|--------|
| **P-7** | SHOULD | 비목표 카탈로그 분리 | "v1 범위 밖" → non_goals | `non_goals_captured / declared` |
| **P-8** | SHOULD | 수치 상수를 AC 에서 분리 | k·delta·timer 는 tuning_constants | `ac_with_numeric_ratio` (목표 ≤ 10%) |
| **P-9** | MAY | prototype_mode 활성 조건 | 기간 ≤4주 + 데모 목적 + coverage<70 중 2개 | 조건 2개 충족 여부 bool |
| **P-10** | SHOULD | deliverable.type 과 platform 분리 | 정체성 소실 케이스 기록 | 소실 감지 bool (수동 검토) |
| **P-11** | MAY | 에셋 매니페스트 후보 분리 | 스프라이트·오디오 등 | `assets_recorded / mentions` |
| **P-12** | SHOULD | 외부 의존성 인벤토리 워크플로 | modules 직후 벤더 추출 | `external_deps_coverage` |
| **P-13** | SHOULD | 실패 정책을 BR 에 섞지 않음 | retry/backoff/DLQ → failure_policies | `failure_policy_in_br_count` (목표 0) |
| **P-14** | MAY | 스케줄·동시성·속도 제한 전용 후보 | cron·concurrency → entry_points 확장 | worker/job 도메인에서 `schedule_captured` |

### v0.3 신규 원칙 (Phase 2.5 유도)

| # | 태그 | 원칙 | 한 줄 요약 | 메트릭 |
|---|:----:|------|-----------|--------|
| **P-15** | MUST | 구조적 안전 불변식은 BR 과 분리 | "LLM 호출 금지"·"ScanDB 만 통신" 류는 `project.invariants[]` 또는 unrepresentable 의 `safety_constraints` | 분리 여부 bool |
| **P-16** | SHOULD | 문서 성숙도 축 분기 | planning vs architecture vs implementation — 변환 전략 다름 | `metadata.source.maturity` 기입 여부 |
| **P-17** | SHOULD | 모듈 계층(tool/skill/agent) 인지 | AI 에이전트 제품은 각 module 에 layer 속성 후보 | `modules_with_layer_hint / total` |
| **P-18** | SHOULD | 실행 DAG 는 features 평면이 아닌 별도 | DAG·orchestrator·상태머신 언급 시 unrepresentable 에 `execution.dag` 후보 | DAG 언급 시 엔트리 존재 bool |
| **P-19** | MUST | LLM agent 변환 시 과잉 발동 방지 | agent 는 P-6 가 과해지고 P-4 가 덜 되는 경향 — prompt 로 카운트 강제 | agent-mode 시 entity_field 미나열 시 재시도 |
| **P-20** | SHOULD | 요금제·티어·쿼터는 구조 보존 | "Free/Pro/Enterprise"는 stakeholder.concerns 로 축소 금지 | 요금제 언급 시 NEW-20 엔트리 존재 |
| **P-21** | SHOULD | 저자 강조 축 선제 식별 | Stage 0 에서 핵심 주장 3개 → project.vision + BR.rationale 필수 반영 | vision 길이 + BR.rationale 비어있지 않은 비율 |

### v0.4 신규 원칙 (Phase 2.8 유도 · harness-boot-self 변환)

| # | 태그 | 원칙 | 한 줄 요약 | 메트릭 |
|---|:----:|------|-----------|--------|
| **P-22** | SHOULD | 자기참조 스펙의 self-consistency 체크 | 스펙이 자기 BR 을 스스로 지키는지 변환 말미에 1회 훑어봄 | `self_ref_br_checked / total_br` (자기참조 스펙일 때만) |
| **P-23** | SHOULD | CLI/플러그인에서 features 와 entry_points 중복 허용 | meta 도메인에서는 같은 명령이 양쪽에 나타남 — command_map 도입 전까지 중복 감수 | 중복 의도 명시 bool (conversion-notes) |
| **P-24** | MAY | 변경 이력 metadata 보존 | architecture 성숙도 + 부록 changelog 가 있으면 metadata.changelog[] 또는 $include 권장 | changelog 언급 시 metadata 기입 bool |

**참고**: P-22 는 meta 도메인에서 **`self_reference=true` 샘플에만 MUST**, 그 외 (vite-bb / vscode-cc 등 host-plugin) 는 N/A (adapters/meta.md v0.2 §5.1 F-7 조건부).

---

## 3. 매핑 휴리스틱 (H-\*)

| # | 트리거 | 맵핑 대상 |
|---|--------|----------|
| H-1 | 단락형 서술 | 🗒 description/overview (5줄 이상 $include 고려) |
| H-2 | 정책·규칙 서술 | `domain.business_rules[]` (statement + rationale 분리) |
| H-3 | 기능 bullet | `features[].acceptance_criteria[]` (bullet 1 = AC 1) |
| H-4 | 타겟 사용자·이해관계자 | `project.stakeholders[]` (end-user 제외) |
| H-5 | 엔티티 정의 | `domain.entities[]` (3~7개, sensitive 판정 포함) |
| H-6 | 기술 스택 | `constraints.tech_stack` (결정값만, 이유는 ADR) |
| H-7 | 스켈레톤 | `features[0].type=skeleton`, AC 는 최소 왕복만 |
| H-8 | 공개 API 심볼 (library) | unrepresentable → `public_api[]` 후보 |
| H-9 | 벤치마크·Ground Truth | unrepresentable → `benchmarks` (NEW-22) |

---

## 4. 자주 범하는 실수 (Pitfalls, X-1~X-17)

| # | 실수 | 올바른 처리 |
|---|------|-------------|
| **X-1** | 미결정 이슈를 AC로 봉인 | `open_questions[]` (스키마 없으면 unrepresentable) |
| **X-2** | p95·FPS·가용성을 AC 자연어로 흘림 | `non_functional` (G-01) |
| **X-3** | Entity 필드를 invariants 에 뭉개기 | `entities[].attributes[]` (또는 unrepresentable) |
| **X-4** | 벤더를 modules 이름으로만 | `external_dependencies[]` (G-06) |
| **X-5** | 역할이 plan.md 명시 안 됐다고 stakeholder 누락 | concerns 로 등재 (법무·DevOps 포함) |
| **X-6** | bullet 여러 개를 AC 1개로 병합 | bullet 당 1 AC 가 기본 |
| **X-7** | 같은 기능을 features/BR 중복 | features="동작", BR="정책" |
| **X-8** | 재시도 정책을 BR 에 섞기 | failure_policies 별도 (P-13) |
| **X-9** | 수치 튜닝값을 AC 에 녹이기 | tuning_constants 별도 (P-8) |
| **X-10** | "비목표"를 vision 한 줄에 처박기 | non_goals 카탈로그 (P-7) |
| **X-11** | 스케줄·concurrency 를 BR 에만 | entry_points.schedule 후보 (P-14) |
| **X-12** | 요금제를 stakeholder.concerns 로 축소 | NEW-20 pricing.plans 구조 보존 (P-20) |
| **X-13** | LLM agent 가 모든 미결을 open_questions 로 몰기 | P-19 과잉 발동 감지 — 결정 가능한 건 결정 |
| **X-14** | 아키텍처 문서를 planning 처럼 접근해 결정 rationale 손실 | P-16 성숙도 분기 + BR.rationale 적극 사용 |
| **X-15** | 자기참조 스펙에서 자기 BR 을 자기가 지키는지 확인 안 함 | P-22 self-consistency 체크 (meta 도메인) |
| **X-16** | CLI 플러그인에서 features/entry_points 중복을 "오류"로 보고 억지 병합 | P-23 의도적 중복 허용, command_map 도입 대기 |
| **X-17** | 부록 changelog 를 description 에 녹이려다 metadata 탈락 | P-24 metadata.changelog[] 또는 $include |

---

## 5. $include 사용 기준

- 허용 디렉터리: `docs/spec/`, `.harness/spec/` 하위
- 대상: 🗒 자유 텍스트 필드만 (🔒 구조 필드 금지)
- 용도: 5줄 이상의 서사·자서술. 짧은 문장은 inline
- 회피: AC / business_rule.statement / open_question.options 처럼 "한 줄이 고유 의미"인 필드
- **architecture 성숙도에서**: 코드블록·큰 표·다이어그램은 적극적으로 $include (P-16)

---

## 6. 변환 체크리스트 (v0.3)

### 필수 항목 (MUST)

- [ ] `features[0].type == skeleton` 이며 AC 가 최소 왕복만 (P-1, R-1)
- [ ] plan.md 의 모든 섹션이 (a) spec 에 매핑, (b) unrepresentable.md 에 기록, (c) 의도적 생략 근거 기록 — 무명 누락 없음 (Stage 4, P-1)
- [ ] 구조적 안전 불변식이 `safety_constraints`/`invariants` 로 분리됨 (P-15)
- [ ] `metadata.source.maturity` 기입 (P-16)
- [ ] 저자 강조 축 3개가 vision + BR.rationale 에 반영 (P-21)

### 도메인 독립 SHOULD

- [ ] sensitive: true 엔티티에 sensitive_reason
- [ ] tdd feature 에 tdd_focus 비어있지 않음
- [ ] metadata.source.source_lines 최소 엔티티·피처 1건씩
- [ ] 비목표 표현 → non_goals (P-7)
- [ ] 수치 상수 → tuning_constants (P-8)
- [ ] 재시도·timeout → failure_policies (P-13)
- [ ] 외부 벤더 → external_dependencies (P-12)
- [ ] DAG·orchestrator 언급 시 NEW-18 엔트리 (P-18)
- [ ] 요금제 언급 시 NEW-20 엔트리 (P-20)

### 도메인 특수 MAY (해당 어댑터 로드 시)

- [ ] (worker) cron·concurrency → G-14 엔트리
- [ ] (game) 수치 계수 2+ → G-12 엔트리
- [ ] (game) prototype_mode 조건 충족 기록
- [ ] (saas) REST/WS 프로토콜 → G-02 엔트리
- [ ] (library) 공개 API 심볼 → public_api 엔트리

### Stage 4 검증 (HARD)

- [ ] `backlink-matrix.md` 작성 완료
- [ ] 미매핑 섹션 = 0
- [ ] 매핑 품질 ★★★ 이상 비율 측정 (목표 ≥ 70%, planning 샘플)
- [ ] 갭 임시 대응 품질 점수 평균 ≥ ★★★ (P-22)

---

## 7. 산출물 (5개)

1. `.harness/spec.yaml` — 주 산출물
2. `docs/spec/unrepresentable.md` — 갭 카탈로그 (갭 0 이라도 파일은 존재)
3. `docs/spec/conversion-notes.md` — 의사결정 로그
4. `docs/spec/backlink-matrix.md` — **Stage 4 검증 (v0.3 신규 필수)**
5. (선택) `docs/spec/<field>.md` — $include 로 분리한 자유텍스트

---

## 8. 도메인 어댑터

핵심 원칙만 이 SKILL.md 에 두고, 도메인 특수 체크는 어댑터로 위임:

| 어댑터 | 시그널 | 우선 갭 |
|--------|--------|---------|
| `adapters/worker.md` | cron·큐·ETL | G-14/15/16/06/12 |
| `adapters/saas.md` | React·요금제·SSO | NEW-20·G-02·G-04·NEW-19 |
| `adapters/game.md` | FPS·스프라이트·게임루프 | G-11/12/13·P-10 |
| `adapters/library.md` v0.1 | SDK·semver·패키지 | NEW-24·G-08·NEW-25·NEW-26·NEW-27 |
| `adapters/meta.md` **v0.2** | 플러그인·CLI·slash command·devtool·에디터확장 (self-bootstrap + host-plugin 2형, host-plugin 은 빌드도구·에디터확장 2서브타입) | NEW-28·NEW-33·NEW-30·NEW-29·NEW-34·NEW-35 host_binding·**NEW-36 contribution_points** |

**로딩 규칙**: Stage 0 에서 도메인 판정 후 해당 어댑터를 Read. 복수 도메인이
해당되면 모두 로드 (예: VAPT = saas + security).

---

## 9. 회귀 보장 (v0.5: 2-축)

**축 1 — 시맨틱 (불변성)**:
- Golden set: `tests/regression/conversion-goldens/{sample}/`
- Diff: `python3 scripts/conversion_diff.py --all`
- 종료 코드 0(PASS) / 1(FAIL HARD) / 2(WARN SOFT)
- Goldens 는 edit-wins 로만 갱신 (자동 덮어쓰기 금지)

**축 2 — 스키마 (v2.3.8 네이티브 준수)**:
- Schema: `docs/schemas/spec.schema.json` (draft 2020-12)
- 전수 validate — v1 5 + v2 3 + sub-goldens 3 = 11/11 OK 목표
- `metadata.extensions.*` 가 출력에 남아있으면 reviewer 가 수동 플래그 (skill 위반)

**승격 조건**: skill 버전업 머지 전 두 축 모두 PASS. `scripts/upgrade_to_2_3_8.py --dry-run` 로 입력 샘플 pre-flight 가능.

---

## 10. 자가 진화 (Phase 3 이후 설계)

1. **Phase 2.5 완료**: skill v0.3 + golden + diff + backlink matrix (2026-04-22)
2. **Phase 3**: `agents/spec-converter.md` 승격. `/harness:spec` Mode B 가 자동 호출
3. **Phase 4**:
   - `.harness/events.log` 의 `spec_conversion_corrected` 이벤트 정의
   - `/harness:spec --learn` 사용자 수정 학습
   - golden regression 자동 확장
   - edit-wins 규칙 준수
4. **Phase 5**: v2.3.8 스키마 확장 기반 골든 재검증

---

## 11. 스키마 확장 현황 (v2.3.8 승격 결과 + v2.4.0 후보)

### 11.1 v2.3.8 에서 승격 완료 (2026-04-23 · 9 블록)

| ID | 필드 | 등급 | 위치 |
|----|------|:---:|------|
| NEW-28 | `command_map[]` | P0 | `metadata.command_map` (최상위 승격) |
| NEW-33 | `ambient_files[]` | P0 | `metadata.ambient_files` |
| NEW-35 | `host_binding` | P0 (host-plugin 조건부) | `metadata.host_binding` |
| NEW-31 | `drift_catalog[]` | P0 | `metadata.drift_catalog` |
| NEW-32 | `versioning_axes[]` | P0 | `metadata.versioning_axes` |
| NEW-36 | `contribution_points[]` | P1 (editor-extension 서브타입) | `metadata.contribution_points` |
| NEW-34 | `preamble_contract` | P1 | `metadata.preamble_contract` |
| P-24 | `changelog[]` | P1 (MAY) | `metadata.changelog` |
| NEW-30 | `gate_chain[]` | P2 (MAY · anyOf 2 스타일) | `metadata.gate_chain` |

**작성 규칙 (v0.5 MUST)**: 생성 시 **위치는 `metadata.*` 직접**. `metadata.extensions.*` 경유는 deprecated (입력에선 허용, 출력에선 금지).

### 11.2 v2.4.0 에서 처리할 잔여 (`metadata.extensions.*` 유지)

| ID | 필드 | 상태 | 메모 |
|----|------|------|------|
| NEW-29 | `agent_permissions[]` | extensions 잔존 | v2.4.0 에이전트 12종 매트릭스와 함께 승격 예정 |

### 11.3 v2.4.0 후보 (미승격 · 단일/약한 재현)

| ID | 제안 필드 | 재현 샘플 | 등급 |
|----|-----------|-----------|:---:|
| NEW-24 | `public_api[]` | tzcalc + self | P0 |
| G-01 | `non_functional` | 6/6 | P1 |
| G-10 | `open_questions[]` | 6/6 | P1 (최상위 이미 사용 중) |
| G-13 | `non_goals[]` | 5/6 | P1 |
| NEW-25 | `compatibility_matrix` | tzcalc + self | P1 |
| NEW-26 | `deliverable.artifacts[]` | tzcalc + self | P1 |
| NEW-17~23, 27 | 도메인 특수 | 각 1/6 | P2 |
| G-04/07/08/09/11/12/14/15/16 | (각 blocks) | 이월 | P2 |

자세한 RFC: `design/rfcs/v2.4.0-schema-expansion.md`

---

## 12. 버전 이력

- **v0.1** (2026-04-22): URL 단축기 1회 변환 추출. P-1~P-6, H-1~H-7, X-1~X-7.
- **v0.2** (2026-04-22): retro-jumper + price-crawler 추가. P-7~P-14, X-8~X-11, 체크리스트 확장.
- **v0.3** (2026-04-22): VAPT 변환(Phase 2.5) 이후 개편. **P-15~P-21, X-12~X-14, Stage 4 검증, 우선순위 태깅(MUST/SHOULD/MAY), 원칙별 메트릭, 도메인 어댑터 분리, golden + semantic diff 인프라.**
- **v0.4** (2026-04-22): harness-boot-self 자기변환(Phase 2.8) 이후 개편. **P-22~P-24, X-15~X-17, meta 어댑터 v0.0 신설, library 어댑터 v0.1, 누적 갭 34종, v2.4.0 RFC P0 5건 확정.**
- **v0.4+ / Phase 2.9 revision** (2026-04-22): vite-plugin-bundle-budget 변환으로 **meta 어댑터 v0.0 → v0.1 승격** (자기참조 + host-plugin 2형 커버), **NEW-35 host_binding 신규 (누적 35종)**, P-22 self-consistency 를 `self_reference=true` 조건부로 명확화, F-9(Config 엔티티 분리) 가설 HIT 확정. 회귀 7/7 PASS 유지.
- **v0.4++ / Phase 2.9 revision 2** (2026-04-22): vscode-commit-craft 변환으로 **meta 어댑터 v0.1 → v0.2 승격** (host-plugin 서브타입 빌드도구·에디터확장 2형 세분화), **NEW-36 contribution_points 신규 (누적 36종)**, F-8(에디터 확장 surface_map) 가설 PARTIAL HIT 확정, host-plugin BR/F ≈ 1.0 수렴 관찰 (self-bootstrap 0.67 와 구분). 회귀 **8/8 PASS**. v2.4.0 RFC 권고 업데이트: NEW-35 P1 확정, NEW-36 P2 신설, NEW-29 조건부화(agent N≥2).
- **Phase 2.10 / self 재변환** (2026-04-22): 사용자 지시로 harness-boot-self 를 **재변환** (re_conversion_round=2, skill v0.4 + meta adapter v0.2). **`metadata.extensions.*` 네임스페이스 9 블록 실장** (command_map·ambient_files·host_binding·agent_permissions·gate_chain·drift_catalog·versioning_axes·preamble_contract·contribution_points), top-level `open_questions[]` 11 엔트리 + `metadata.changelog[]` 6 엔트리 추가. **★★★+ 65% → 94% (17-기준) / 100% (rated)** — 사용자 목표 ≥90% 달성. NEW-28~34 **전수 해소** 확인. v2.3.8-rfc 승격 후보 4건 식별 (command_map / gate_chain / drift_catalog / preamble_contract). 회귀 분류: v1 골든 8/8 PASS 유지, v2 는 `harness-boot-self/v2/` 에 별도 산출물로 등록. 관찰: 자기참조 샘플은 미래 schema RFC 의 candidate fields 증거 수집 용도로 작동 (P-25 후보 씨앗).
- **Phase 2.11 / meta 3-샘플 재변환** (2026-04-23): self v2 에서 검증한 `metadata.extensions.*` 9-블록 패턴을 **vite-bundle-budget v2** (host-plugin/build-tool) + **vscode-commit-craft v2** (host-plugin/editor-extension) 에 교차 적용. 둘 다 7 블록 실장, **★★★+ 65% → 88% (17-기준) / 94% (rated)** 3/3 샘플에서 재현. vscode-cc v2 에서 NEW-36 contribution_points **7 kind 전수 실현** (command/keybinding/view/configuration/menus/statusbar/activationEvents) — editor-extension subtype 의 distinctive 특성 실증. 서브타입 지문 확정: self-bootstrap BR/F=0.67 + preamble.required=true, host-plugin build-tool BR/F=1.0 + peer_contract, host-plugin editor-extension BR/F=1.0 + publisher_contract. MANIFEST.yaml 의 `re_conversions: 1→3`, `host_subtype` 필드 추가. `design/samples/META-RECONVERSION-COMPARE.md` (3 샘플 지문 매트릭스 + F-8 가설 3/3 완전 실현 + v2.3.8 승격 스코어카드) 산출.
- **Phase 2.12 / v2.3.8-rfc** (2026-04-23): 위 3/3 meta 재변환 데이터를 근거로 **`design/rfcs/v2.3.8-metadata-extensions-promotion.md`** 저작. 9 블록 등급 판정: command_map/ambient_files/drift_catalog/versioning_axes **P0 MUST-if-present (3/3 HIT)**, host_binding **P0 SHOULD 서브타입 조건부 (2/2 host-plugin)**, contribution_points **P1 SHOULD 서브타입 인식**, preamble_contract **P1 MAY**, changelog **P2 MAY**, gate_chain **P1 MAY (조건부 — self-bootstrap full, host-plugin 은 drift_catalog.action 흡수 허용)**. `metadata.extensions.*` 네임스페이스는 deprecated (v2.5.0 제거 예정).
- **Phase 2.13 / v2.3.8 구현** (2026-04-23): `docs/schemas/spec.schema.json` v2.3.8 작성 (8 블록 + gate_chain `$defs`, 11/11 샘플 validate). `scripts/upgrade_to_2_3_8.py` 마이그레이션 스크립트 구현 (ruamel.yaml round-trip 으로 주석·순서 보존, `--dry-run` / `--no-backup` 지원). 3 v2 샘플 `metadata.extensions.*` → `metadata.*` 이관 완료 (self-v2: 8 블록 이관 + agent_permissions 유지 [v2.4.0 대기], vite-bb/vscode-cc: 7 블록 이관 + extensions 네임스페이스 완전 제거). conversion_diff 회귀 **8/8 PASS** + JSONSchema 검증 **11/11 OK**. **v2.3.8 승격 조건 충족 상태**.
- **v0.5 / Phase 2.14-A** (2026-04-23): **v2.3.8 네이티브 전환**. SKILL.md frontmatter version 0.4→0.5, 타겟 스키마 선언을 v2.3.8 로 갱신. §11 을 "v2.3.8 승격 완료 (9 블록) · v2.4.0 대기 (agent_permissions) · v2.4.0 후보 (단일/약한 재현)" 3-티어로 재편. §9 회귀 보장을 시맨틱(conversion_diff) + 스키마(jsonschema draft 2020-12) **2-축** 체계로 정식화. `templates/` 에 **3종 신설** — `spec-skeleton-v2.3.8.yaml` (metadata.* 직접 배치 모범, extensions 경유 금지 주석), `unrepresentable.md` (v2.3.8 승격 완료 필드 목록 + 재변환 라운드 판정 표), `conversion-notes.md` (가설/개선 후보/회귀 체크 6-섹션 표준형). 회귀 **11/11 schema OK + 8/8 semantic PASS** 재확인.
