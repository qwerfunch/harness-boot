---
description: spec.yaml 편집 · 작성 · 정제 · 설명의 4 모드 대화형 인터페이스. spec-conversion skill 연계.
allowed-tools: [Read, Write, Edit, Bash, Glob]
argument-hint: "[plan.md | spec-path | --explain] [--mode A|B|R|E]  # 기본: 자동 분기"
---

# /harness:spec — 스펙 편집 UI (Mode A/B/R/E 자동 분기)

`.harness/spec.yaml` 을 대화형으로 만들고·고치고·읽습니다. 입력 · 파일 상태에 따라 **4 모드 자동 분기** 하며, 각 모드는 결정론적 — 같은 입력 → 같은 모드.

**v0.2 구현 범위**: Mode 분류 로직 + 각 Mode 의 workflow 정의. 자동 변환은 `skills/spec-conversion` 스킬이 이미 v0.5 (24 원칙 · 5 어댑터). Mode B 의 구조 추출은 `scripts/mode_b_*.py` 가 담당.

## Preamble (출력 맨 앞)

```
📝 /harness:spec · <mode 이름> · <근거 10단어 이내>
```

예: `📝 /harness:spec · Mode-B baseline · plan.md 에서 신규 spec 생성`.

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

### B-2: plan.md → spec
1. `Read <plan.md>`.
2. `skills/spec-conversion/SKILL.md` v0.5 의 4-stage 파이프라인 호출:
   - Stage 1 정찰 (Mode B 통계 추출 — `scripts/mode_b_extract.py`).
   - Stage 2 저작 (24 원칙 적용, 도메인 어댑터 선택).
   - Stage 3 gap (unrepresentable 감지).
   - Stage 4 backlink (source_ref · chapter 링크).
3. 결과 spec 을 `.harness/spec.yaml` 로 write.
4. gap 카탈로그는 `.harness/_workspace/handoff/unrepresentable.md` 에 별도 저장.

---

## Mode A — Addition (기존 spec 에 섹션/피처 추가)

1. `.harness/spec.yaml` 현재 상태 파악 (해시 기록).
2. 추가 요청에 해당하는 영역 식별 (`features[]`, `domain.entities[]`, `business_rules[]` 등).
3. 최소 침습 diff 로 삽입.
4. `git diff .harness/spec.yaml` 로 사용자에게 리뷰 제공 (— 없으면 `diff <old> <new>`).
5. `--dry-run` 시 write 생략.
6. 성공 시 `/harness:sync` 실행 안내.

---

## Mode R — Refine (기존 spec 정제)

1. 대상 필드 지정 (예: "F-003 의 acceptance_criteria 강화").
2. 원본 읽고 + 개선 제안.
3. 사용자 승인 후 edit.
4. `git diff` 출력.
5. `--dry-run` 지원.

A 와 R 의 차이: A 는 "새로 추가", R 은 "기존 강화/수정".

---

## Mode E — Explain (read-only)

1. 대상: 전체 spec 또는 특정 필드 (`/harness:spec --explain features[F-003]`).
2. 요약 출력만. **파일 수정 0, `mtime` 불변** (CQS 검사).
3. 포맷: markdown, 섹션별 1 단락.

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

## v0.2 구현 상태

Claude 가 이 명령을 수행할 때 아래 스크립트를 직접 호출 가능 (모두 발행됨):

- **Mode 분류기**: `scripts/spec_mode_classifier.py --args "..." --spec-exists true|false`
  → `{"mode": "A|B|R|E", "rationale": "...", "subtype": "..."}` JSON 반환.
  Claude 는 이 결과로 분기 결정을 preamble 에 기록.
- **Mode E (read-only)**: `scripts/explain_spec.py <spec.yaml> [--feature F-X | --entity Y] [--json]`
  → overview / feature / entity 요약. 파일 mtime 불변 (CQS 테스트로 검증됨).
- **Mode A/R diff**: `scripts/spec_diff.py <old> <new> [--yaml | --stat | --json]` 또는 `spec_diff.py <spec> --git-head` (git HEAD 와 비교).
  Claude 가 spec 수정 후 사용자에게 diff 제시할 때 사용.

아직 자동화 안 된 부분:

- **Mode B-2 (plan.md → spec)** — `skills/spec-conversion` 스킬 (v0.5) 을 Claude 가 대화로 호출. Python 단일 엔트리포인트 없음 (변환이 여러 판단 단계를 포함하기 때문).
- **Mode B-1 대화 흐름** — LLM-driven. 템플릿을 뼈대로 시작해서 필수 필드를 하나씩 묻고 채워나감.

두 흐름 모두 Claude 가 스크립트를 읽어들이지 않고 직접 수행하므로 commands/spec.md 의 지시문을 따라 대화형으로 진행.

## 참조

- `docs/samples/harness-boot-self/spec.yaml` — F-002 AC/tdd_focus.
- `skills/spec-conversion/SKILL.md` — Mode B 변환 파이프라인 v0.5.
- `scripts/mode_b_extract.py` · `mode_b_axes.py` · `mode_b_stopwords.py` · `mode_b_roundtrip.py` — 통계 추출 구현.
- `scripts/upgrade_to_2_3_8.py` — Mode R 의 스키마 마이그레이션 보조.
