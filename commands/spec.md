---
description: spec.yaml 편집 · 작성 · 정제 · 설명의 4 모드 대화형 인터페이스. spec-conversion skill 연계.
allowed-tools: [Read, Write, Edit, Bash, Glob]
argument-hint: "[plan.md | spec-path | --explain] [--mode A|B|R|E]  # 기본: 자동 분기"
---

# /harness:spec — 스펙 편집 UI (Mode A/B/R/E 자동 분기)

`.harness/spec.yaml` 을 대화형으로 만들고·고치고·읽습니다. 입력 · 파일 상태에 따라 **4 모드 자동 분기** 하며, 각 모드는 결정론적 — 같은 입력 → 같은 모드.

**v0.2 구현 범위**: Mode 분류 로직 + 각 Mode 의 workflow 정의. 자동 변환은 `skills/spec-conversion` 스킬이 이미 v0.5 (24 원칙 · 5 어댑터). Mode B 의 구조 추출은 `scripts/mode_b_*.py` 가 담당.

## Preamble (출력 맨 앞 3 줄)

```
📝 /harness:spec · <mode=A|B|R|E> · <근거 5~10 단어>
NO skip: Mode 분류기 실행 — 직관적으로 mode 가 보여도 명시적 분기
NO shortcut: Mode E 는 mtime 불변 (CQS — 파일 수정 시도 자체가 위반)
```

**1 줄**: 이모지 · 명령 · mode · 근거.
**2-3 줄 (Anti-rationalization, BR-014)**: 분류기 건너뛰기 · Mode E CQS 위반을 명시 거부.

예: `📝 /harness:spec · B-2 · plan.md → spec.yaml 자동 변환`.

## Mode 분류 (입력 → 모드)

Claude 는 인자 · 파일 상태를 보고 다음 순서로 모드 결정:

| 조건 | 모드 |
|---|---|
| `--explain` 또는 사용자가 설명만 요청 | **E** (Explain, read-only) |
| `.harness/spec.yaml` 부재 + 인자 = plan.md | **B** (Baseline — plan.md → spec 생성) |
| `.harness/spec.yaml` 부재 + 인자 없음 | **B** (empty baseline — 대화형으로 채워나감) |
| `.harness/spec.yaml` 존재 + 인자 = 섹션 추가 요청 | **A** (Addition) |
| `.harness/spec.yaml` 존재 + 인자 = 정제/수정 요청 | **R** (Refine) |
| `--mode X` 명시 | 강제로 X |

분기 결과를 preamble 의 mode 행에 기록. 같은 입력에 두 번 실행하면 같은 모드여야 함 (결정론 — F-002 AC).

---

## Mode B — Baseline (신규 spec 생성)

입력 없을 때 빈 spec 을 템플릿으로 스캐폴드, 또는 `plan.md` 주어지면 변환:

### B-1: empty baseline
1. `docs/templates/starter/spec.yaml.template` 를 읽어 `.harness/spec.yaml` 로 복사.
2. 필수 필드 — `project.name`, `domain.entities`, `features` — 를 하나씩 대화로 채움.
3. 각 답변 후 `scripts/canonical_hash.py` 로 해시 기록하며 진척 확인.

### B-1-vague: 한 줄 아이디어 → researcher → planner → B-2 (v0.5)

**Activation trigger**: classifier 가 `subtype: baseline-empty-vague` 를 반환한 경우 (spec 부재 + plan.md 인자 없음 + 사용자 intent 40 단어 미만).

이 분기는 B-1 의 3 문항 대화 대신 **전문가 체인**을 타서 풍부한 spec 을 얻는다:

```
사용자 의도 (한 문장) →
  @harness:researcher
    → `.harness/_workspace/research/brief.md` 작성
    → 사용자에게 brief 보여주고 승인 요청 (1. 예 · 2. 수정 · 3. 취소)
  @harness:product-planner (승인 후)
    → `.harness/_workspace/plan/plan.md` 작성
    → 사용자에게 plan 보여주고 승인 요청
  /harness:spec .harness/_workspace/plan/plan.md  (승인 후, B-2 로 자동 진입)
    → classifier 가 `.md` arg 감지 → subtype: baseline-from-plan → 기존 B-2 파이프라인
    → spec.yaml preview → 사용자 최종 승인 → `.harness/spec.yaml` 저장
```

**규약**:
- orchestrator 가 체인 책임. researcher · product-planner 는 서로 직접 호출 금지.
- 각 단계마다 사용자 승인 checkpoint. 수정 요청 시 해당 에이전트 재실행 (researcher 는 orchestrator 가 추가 context 주입 후 재소환).
- plan.md 경로는 **고정**: `.harness/_workspace/plan/plan.md`. B-2 classifier 는 `.md` 인자 감지로 동작하므로 별도 코드 변경 불필요.
- Discovery 단계이므로 두 에이전트는 `domain.md` 없이 동작 (Discovery 예외 — agents/researcher.md · agents/product-planner.md `## Context` 참고).

### B-2: plan.md → spec

**Activation trigger**: `/harness:spec --from plan.md` 또는 사용자 인자가 `.md` 확장자 + spec 부재.

#### LLM prompt template

```
1. Read <plan.md>
2. `skills/spec-conversion` SKILL.md v0.5 invocation:
   Stage 1 정찰 — Bash python3 scripts/mode_b_extract.py <plan.md>
     → BM25 통계 + 도메인 힌트
   Stage 2 저작 — 24 원칙 + 도메인 어댑터 (skills/spec-conversion/adapters/<kind>.md)
     로 features · entities · BR 초안 구성
   Stage 3 gap — source 에서 spec 으로 표현 불가능한 부분 식별
     → `.harness/_workspace/handoff/unrepresentable.md` 별도 저장
   Stage 4 backlink — 각 feature/BR 에 source_ref (plan.md 라인 번호 범위) 주입
3. Schema 검증: `python3 scripts/validate_spec.py <new-spec>`
   실패 시 §Stage 2 로 복귀
```

#### Approval checkpoint

최종 초안을 사용자에게 **전체 보여주고** 승인 받기:
```
"<plan.md> 에서 변환된 초안 spec 입니다:

<full spec yaml>

1. 예 · .harness/spec.yaml 로 저장
2. 특정 섹션 재작성 요청
3. 취소"
```

- gap 카탈로그 (unrepresentable.md) 는 승인과 무관하게 **항상 보여주고** 사용자 판단 유도 (손실 투명성)

#### 결정론 보장
- 같은 plan.md → (거의) 같은 초안 (LLM 랜덤성 최소화 위해 adapters 선택은 classifier 기반)
- 재실행 시 기존 `.harness/spec.yaml` 덮어쓰기 전 **먼저 diff 확인**

---

## Mode A — Addition (기존 spec 에 섹션/피처 추가)

**Activation trigger**: spec.yaml 존재 + 사용자 요청이 "~ 추가 / 신규 F-NNN / entity 추가 / BR 추가" 패턴.

### LLM prompt template

Mode A 활성화 시 Claude 는 **순서대로** 아래 단계를 실행:

```
1. Read .harness/spec.yaml (현재 상태 · 해시 기록)
2. 추가 대상 영역 식별:
   - features[] (신규 F-NNN · 최대 F-ID +1 사용)
   - domain.entities[] (신규 entity)
   - domain.business_rules[] (신규 BR-NNN)
   - constraints.* (보강)
3. 최소 침습 diff 작성 (기존 필드 건드리지 않음)
4. `scripts/spec_diff.py <old> <new> --yaml` 로 diff 렌더
```

### Approval checkpoint (중단 · 재개 지점)

diff 렌더 직후 **사용자에게 명시적으로 묻고** 응답을 기다림:

```
"다음 diff 를 .harness/spec.yaml 에 적용할까요?

<rendered diff>

1. 예 · 적용
2. 아니오 · 수정 제안
3. 취소"
```

사용자가 "1" 응답 전까지 Edit/Write 금지. "2" 면 다시 §3~§4 반복. `--dry-run` 인자는 이 checkpoint 를 자동 "3 취소" 로 처리.

### 성공 경로
적용 후 `git diff .harness/spec.yaml` 재출력 + 후속 안내 (§후속 단계).

---

## Mode R — Refine (기존 spec 정제)

**Activation trigger**: spec.yaml 존재 + 사용자 요청이 "강화 / 수정 / 정제 / refactor / 표현 개선 / 중복 제거" 패턴.

### LLM prompt template

```
1. 대상 필드 지정 받기 (예: "F-003 acceptance_criteria")
2. Read 해당 블록
3. 개선 제안 (3 축 우선):
   - 정합성 (BR-NNN 형식 · F-NNN 형식 통일)
   - 명확성 (애매한 description 구체화)
   - 간결성 (중복 표현 병합)
4. `scripts/spec_diff.py` diff 렌더
```

### Approval checkpoint

Mode A 와 동일한 3-옵션 prompt 구조. 사용자 "1" 전 Edit 금지.

### A 와의 차이
- **A**: 새 항목 (features · entities · BR) 추가 → spec 확장
- **R**: 기존 항목 속성 변경 → spec 정제 (new entity 추가 안 함)

분류기가 모호한 경우 (예: "F-003 에 tdd_focus 추가") 는 A 로 간주 (기존 블록에 sub-array 추가 = 구조 확장).

---

## Mode E — Explain (read-only · CQS 엄수)

**Activation trigger**: `--explain` 플래그 · 또는 사용자 요청이 "설명해줘 / 읽어줘 / 뭐야 / 보여줘" 읽기 패턴.

### LLM prompt template

```
1. 대상 범위 파싱:
   - 전체: scripts/explain_spec.py <spec.yaml>
   - 피처: scripts/explain_spec.py <spec.yaml> --feature F-003
   - 엔티티: scripts/explain_spec.py <spec.yaml> --entity User
2. Bash 실행 결과를 markdown 으로 렌더
3. 섹션별 1 단락 요약
```

### CQS 엄수 (BR-012 절대 조건)

- Edit · Write 도구 호출 **금지** (Mode E 전 구간)
- `.harness/spec.yaml` 의 `mtime` **불변** 보장
- 사용자가 Mode E 안에서 "근데 이거 수정 해줘" 요청 시 → **일단 완결한 뒤 Mode A/R 재분기 제안** (Mode E 안에서 수정 금지)
- tests/unit/test_explain_spec.py 가 mtime 불변 검증

### 출력 포맷
- H1: 대상 식별 (피처 이름 또는 "스펙 전체")
- H2+본문: 섹션별 1 단락 (description · modules · AC · 관련 BR)
- 마지막 줄: 관련 명령 제안 (e.g., "연관: /harness:work F-003")

---

## 후속 단계 안내

모든 모드 완료 후 말미에:

```
다음 단계:
  - 파생 재생성: /harness:sync
  - 검증: /harness:check (v0.3)
  - 피처 작업: /harness:work <F-ID> (v0.3)
```

## 실패 조건 (fail-fast)

- Mode E 에서 write 시도 감지 → 즉시 중단 + CQS 위반 보고.
- plan.md 가 있어야 할 Mode B-2 에서 파일 부재 → 대화형 baseline 로 fallback 제안.
- spec.yaml 이 스키마 위반 → `docs/schemas/spec.schema.json` 기준 path · reason 보고.

## v0.4 구현 상태 (shipped)

Claude 가 이 명령을 수행할 때 아래 스크립트를 직접 호출:

- **Mode 분류기** (결정론): `scripts/spec_mode_classifier.py --args "..." --spec-exists true|false`
  → `{"mode": "A|B|R|E", "rationale": "...", "subtype": "..."}` JSON 반환
- **Mode E (read-only)**: `scripts/explain_spec.py <spec.yaml> [--feature F-X | --entity Y] [--json]`
  → overview / feature / entity 요약 · `mtime` 불변 (CQS 테스트 검증)
- **Mode A/R diff**: `scripts/spec_diff.py <old> <new> [--yaml | --stat | --json]` 또는 `spec_diff.py <spec> --git-head`
  → Claude 가 spec 수정 후 사용자에게 diff 제시할 때 사용

**Modes A/R/B-2 의 LLM prose contract** (v0.4 확정, F-002 AC-3):
- 각 모드는 위 "Mode X" 섹션의 **LLM prompt template + Approval checkpoint** 를 따름
- Approval checkpoint 전에 Edit/Write 호출 금지 (사용자 "1 · 예" 응답 필수)
- `--dry-run` 인자는 checkpoint 를 자동 "3 · 취소" 로 해석 (diff 보여주고 종료)
- `tests/unit/test_spec_modes.py` 가 prose contract 의 필수 구성요소 grep 검증

**아직 자동화 안 된 부분** (의도적):
- Mode B-2 의 실 변환 로직은 skill-driven (여러 LLM 판단 단계 포함) · Python 단일 엔트리 부재
- Mode B-1 의 필수 필드 대화 루프도 LLM-driven · prose contract 만 명시
- 이 두 흐름 모두 Claude 가 commands/spec.md §§Mode B / Mode A / Mode R 의 지시를 **읽어서 수행** (meta-contract 기반, 자동 Python 없음)

## 참조

- `docs/samples/harness-boot-self/spec.yaml` — F-002 AC/tdd_focus.
- `skills/spec-conversion/SKILL.md` — Mode B 변환 파이프라인 v0.5.
- `scripts/mode_b_extract.py` · `mode_b_axes.py` · `mode_b_stopwords.py` · `mode_b_roundtrip.py` — 통계 추출 구현.
- `scripts/upgrade_to_2_3_8.py` — Mode R 의 스키마 마이그레이션 보조.
