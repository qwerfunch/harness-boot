---
description: 피처 단위 개발 사이클 관리 — 활성화 · Gate 결과 기록 · 증거 수집 · done 전이 (F-004). Phase 1 Gate 실행 자체는 사용자 · CI 가 담당.
allowed-tools: [Read, Write, Bash]
argument-hint: "<F-ID> [--gate NAME RESULT] [--evidence SUMMARY] [--complete] [--block REASON] [--current]"
---

# /harness:work — 피처 개발 사이클 (F-004)

이 명령은 **피처 단위 TDD 사이클의 상태 관리자**. v0.3 범위에서 Gate 실행 자체는 사용자 또는 CI 가 수행하고 결과만 `state.yaml` + `events.log` 에 기록.

**v0.3 경계**:
- 실제 테스트 러너 · 커버리지 계산 · Gate 5 runtime smoke 자동화는 **범위 밖** (v0.4+).
- 이 명령은 result 기록과 상태 전이에 집중.

## Preamble (출력 맨 앞 3 줄)

```
🛠 /harness:work · <action on F-ID> · <근거 5~10 단어>
NO skip: BR-004 Iron Law — gate_5=pass + evidence ≥ 1 없이 done 거부
NO shortcut: 모든 상태 전이는 scripts/work.py 경유 — state.yaml 수동 편집 금지 (work.py 가 events.log 자동 append)
```

**1 줄**: 이모지 · 명령 · <action on F-ID> · 근거.
**2-3 줄 (Anti-rationalization, BR-014)**: Iron Law 우회 · 이벤트 로그 skip 을 명시 거부.

예: `🛠 /harness:work · activate F-003 · sync 완료 후 spec 변경 대응`.

## 역할별 서브커맨드

Claude 는 인자에 따라 `scripts/work.py` 를 호출. `$PLUGIN_ROOT` 는 `commands/init.md §2` 의 4-전략 체인 (또는 `scripts/plugin_root.py`) 으로 해석.

### 활성화

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --harness-dir "$(pwd)/.harness" --json
```

- `planned` → `in_progress` 전이 + `session.active_feature_id` 설정.
- 이미 `done` 이면 읽기만 (재활성화 거부).

### Gate 결과 기록 (수동)

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --gate gate_0 pass --note "19 unit tests" --json
```

결과 ∈ {pass, fail, skipped}. `pass` 면 `session.last_gate_passed` 갱신.

### Gate 자동 실행 (v0.3.1+, Phase 1)

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --run-gate gate_0 --json
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --run-gate gate_0 --override-command "pytest tests/unit" --json
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --run-gate gate_0 --project-root ../other --timeout 60
```

`scripts/gate_runner.py` 가 러너를 자동 감지:

- **gate_0 (tests)**: pyproject+pytest → tests/+unittest → npm test → make test
- **gate_1 (type check)**: pyproject+mypy → pyproject+pyright → tsconfig+tsc → Cargo+cargo check → go.mod+go vet
- **gate_2 (lint)**: pyproject+ruff → pyproject+flake8 → package.json+eslint → .eslintrc+npx → Cargo+cargo clippy → go.mod+golangci-lint
- **gate_3 (coverage, v0.3.5+)**: pyproject+pytest-cov → coverage+pytest → package.json.scripts.coverage → npx nyc → Cargo+tarpaulin → Cargo+llvm-cov → go test -cover. threshold 는 도구 자체 설정 (`[tool.coverage]` 등) 을 따름.
- **gate_4 (commit check, v0.3.6+)**: `git diff --quiet && git diff --cached --quiet` — working tree + staging area 모두 clean 이어야 pass. git repo 아니거나 `git` 바이너리 부재 시 `skipped`.
- **gate_5 (runtime smoke, v0.3.7+)**: `scripts/smoke.sh` → `tests/smoke/` + pytest → `tests/smoke/` + unittest → Makefile `smoke:` → package.json `scripts.smoke`. runtime smoke 는 프로젝트별 특성이 강하므로 **`harness.yaml.gate_commands.gate_5` override 권장**. 감지 실패 시 `skipped` (reason 에 override 안내 포함). 기본 timeout 600s.

결과 자동 기록 + pass 시 evidence 자동 추가. Override 우선순위: `--override-command` → `harness.yaml.gate_commands.<gate>` → auto-detect.

**현재 범위**: gate_0~5 **모두** 자동화 완료 (v0.3.7 = BR-004 Iron Law fully automated).

### 증거 추가

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --evidence "도메인 스모크 통과" --kind test --json
```

### 블록

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --block "외부 API 미배포" --kind blocker --json
```

→ 상태 `blocked` + evidence 에 reason 기록 + events.log 에 `feature_blocked`.

### 완료 (done 전이)

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --complete --json
```

**전제 조건** (BR-004 Iron Law — 증거 없는 완료 주장 금지):
1. `gate_5` (runtime smoke) 결과 = `pass`
2. `evidence` 최소 1 건

둘 중 하나라도 미충족 시 거부 + 이유 반환. 통과 시 `done` 전이 + `active_feature_id` 해제.

### 현재 active 조회 (CQS — 읽기만)

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" --current --json
```

## 코딩 스타일 (구현 전 숙지)

Python 코드는 **Google Python Style Guide** 를 따름. **spec reference (F-NNN · AC-N · BR-NNN) 는 docstring 또는 주석에만** — 함수/클래스 이름은 도메인 의미로.

```python
# ✅
class StrictestRuleTests(unittest.TestCase):
    """BR-004: 복수 rule 매칭 시 가장 엄격한 max 채택."""

# ❌
class BR004_StrictestRuleTests(unittest.TestCase): ...
class AC1_CodeFormatTests(unittest.TestCase): ...
```

상세: `agents/software-engineer.md § 코딩 스타일`.

## 전형 시나리오

피처 1 개의 풀 사이클:

```
/harness:work F-004                                 → activated
... (사용자가 TDD red/green/refactor 수행) ...
/harness:work F-004 --gate gate_0 pass --note "19 tests green"
/harness:work F-004 --gate gate_1 pass --note "type check clean"
/harness:work F-004 --gate gate_2 pass
/harness:work F-004 --gate gate_3 pass --note "coverage 85%"
/harness:work F-004 --gate gate_4 pass --note "merged"
/harness:work F-004 --gate gate_5 pass --note "smoke session OK"
/harness:work F-004 --evidence "full suite 237/237" --kind test
/harness:work F-004 --complete                      → done
```

## 실패 조건

- harness_dir 미존재 → 중단.
- `--complete` 인데 gate_5 미통과 또는 evidence 없음 → action=queried + 이유 메시지 반환 (실패 아님, 재호출 가능).
- invalid gate result → exit 3.

## Orchestration Routing (v0.5)

orchestrator 가 피처 shape 에 따라 소환 체인을 결정한다. 아래 표는 **머신 체크 가능한 계약** — `tests/unit/test_work_routing.py` 가 이 표를 파싱해 6 행 존재 + shape_key + agent_chain 컬럼을 assert.

| shape_key | agent_chain |
|---|---|
| baseline-empty-vague | `@harness:researcher` → `@harness:product-planner` → `/harness:spec <plan.md>` |
| ui_surface.present | `@harness:ux-architect` → `@harness:visual-designer` (+ `@harness:audio-designer` if has_audio) → `@harness:a11y-auditor` → `@harness:frontend-engineer` (+ `@harness:software-engineer` for logic) |
| sensitive_or_auth | `@harness:security-engineer` ∥ `@harness:reviewer` (parallel audit; security BLOCK vetoes) |
| performance_budget | `@harness:performance-engineer` (v0.6 schema field 연동, v0.5 는 inline payload 전달 시만) |
| pure_domain_logic | `@harness:backend-engineer` (+ `@harness:software-engineer` 보조) |
| feature_completion | `@harness:qa-engineer` → engineers (tests) → `@harness:integrator` → `@harness:tech-writer` → `@harness:reviewer` (final) |

**Conflict resolution (orchestrator 책임)**:
- `security-engineer` vs `reviewer` 불일치 → security BLOCK 이 **veto** (민감성 우위)
- `ux-architect` flow 와 `visual-designer` tokens 충돌 → ux-architect authoritative; 2회 반복 시 orchestrator 가 사용자에게 결정 요청
- `a11y-auditor` 는 read-only 이므로 BLOCK 만 발행 — PASS 판정에 다른 에이전트 영향 없음

**Skip 정책 (v0.5.1 명시화)**:
- `security-engineer` — 피처에 `entities[].sensitive=true` 또는 auth/payment 표면이 없으면 skip. 단, **skip 사유를 `.harness/state.yaml` feature 항목의 `skipped_agents[]` 에 기록** (추후 audit 가능). 사유 예: `"no sensitive entity, static client only"`.
- `performance-engineer` — `features[].performance_budget` 선언 없을 시 skip. 동일하게 사유 기록.
- `audio-designer` — `features[].ui_surface.has_audio=false` 이면 skip.
- `integrator` · `tech-writer` — 이 둘은 **완료 직전 chain 에서 skip 금지**. 아주 작은 피처라도 1 줄 단위 wire-up · changelog 반영 책임은 유지. 예외적으로 문서-only 변경 피처(test_strategy=none)에서만 skip 허용 · 사유 기록.
- 원칙: **명시 skip 과 조용한 누락을 구분**. skip 은 state.yaml 에 trace 남김.

**Feature context payload (orchestrator → expert)**:
에이전트 호출 시 프롬프트에 아래 prose 로 인라인 삽입. 전문가는 spec.yaml 을 뒤져 찾지 않음.
```
feature_id: F-NNN
ac_summary:
  - AC-1: ...
  - AC-2: ...
modules: [...]
test_strategy: tdd | contract | property | smoke
ui_surface: {present, platforms, has_audio}  # (있을 때만)
```

## Kickoff Ceremony (v0.6)

`/harness:work F-N activate` state 전이 직후 orchestrator 가 **prose-contract 로 수동 호출** (v0.6 범위 — `scripts/work.py` 가 kickoff.py 를 자동 subprocess 호출 하지는 않음 · v0.7 에서 auto-wire 검토). Discovery 단계(spec 최초 작성)는 해당 없음 — 기존 spec 에서 새 feature activate 시만.

**실행 메커니즘**:

```bash
python3 "$PLUGIN_ROOT/scripts/kickoff.py" \
    --harness-dir .harness \
    --feature F-N \
    --shape ui_surface.present \
    --shape feature_completion \
    [--has-audio]
```

Python 은 **템플릿만 생성**하고 orchestrator 에게 제어를 반환:

1. `.harness/_workspace/kickoff/F-N.md` — per-role heading · 빈 bullet 자리.
2. `.harness/events.log` 에 `kickoff_started` append (agents list 포함).

이후 orchestrator 가 prose-contract 으로 각 agent 를 순서대로 소환 ("F-N 의 당신 관점 우려 3 bullet. [Tier anchor] 를 80 단어 내로.") → 응답을 해당 heading 아래 append.

**참여 범위**: 위 Orchestration Routing 표 + feature shape 매칭. 전 14 agent 소환 금지. `kickoff.py` 의 `ROUTING_SHAPES` 상수가 이 표와 1:1 일치 (test_ceremony_routing.py 로 정합성 검증).

**소비**: 이후 이 feature 의 모든 agent 는 `.harness/_workspace/kickoff/F-N.md` 를 briefing 의 일부로 참조 (cross-role empathy 제공).

## Q&A File-Drop Protocol (v0.6)

에이전트가 작업 중 불명확·상충을 발견하면 **직접 다른 agent 를 호출하지 않고** 파일 기반 inbox 에 질문을 떨어뜨린다. orchestrator 가 stage 경계에서 poll.

**파일 규약**: `.harness/_workspace/questions/F-N--<from>--<to>.md`

```markdown
---
to: ux-architect
blocking: true
needs_reply_by: design-review
---
## Question (2026-04-25T10:00:00Z · from frontend-engineer)

AC-2 "즉시 전이" 가 150ms 내인가 300ms 내인가. design tokens/motion/session-start 은
200ms 인데 AC 문서에 명시 없음.

## Answer (2026-04-25T10:30:00Z · from ux-architect)

200ms 로 통일. flows.md 의 motion/session-start 기준이 canonical.
```

**폴링**:

```bash
python3 "$PLUGIN_ROOT/scripts/inbox.py" --harness-dir .harness --feature F-N
# → 🔒/⬜️ · 🔒 blocking · F-N · from → to · path
```

`--json` 으로 machine-parse · `--all` 로 answered 포함.

**이벤트**: orchestrator 는 새 question 파일 감지 시 `question_opened` · answer append 시 `question_answered` 를 `events.log` 에 append (PR-ε retro 에서 집계).

**왜 파일 기반**: daemon · routing 복잡도 0, `git grep` 으로 이력 추적, PR diff 로 리뷰 가능. Slack 스레드의 로컬 등가물.

## Design Review Ceremony (v0.6)

`ux-architect` 가 `.harness/_workspace/design/flows.md` 를 저장한 뒤 orchestrator 가 **prose-contract 로 수동 호출** (v0.6 범위 — file-watcher · git hook 없음 · `scripts/work.py` 에도 `--design-review` 플래그 미존재). 고정 reviewer 3 명(+ has_audio 시 audio-designer 포함 4 명).

```bash
python3 "$PLUGIN_ROOT/scripts/design_review.py" \
    --harness-dir .harness --feature F-N [--has-audio]
```

**참여**: `visual-designer` + `frontend-engineer` + `a11y-auditor` (+ `audio-designer` if has_audio). 그 외 agent 는 flows.md 접근 권한 없음 (Tier 규약).

**산출**: `.harness/_workspace/design-review/F-N.md` — reviewer 별 concerns 섹션 + orchestrator "Decisions" 푸터. 충돌 2회 반복 시 사용자 escalate.

**이벤트**: `design_review_opened`.

## Retrospective Ceremony (v0.6)

`/harness:work F-N --complete` 성공(gate_5 + evidence) 직후 orchestrator 가 **prose-contract 로 수동 호출** (v0.6 범위 — `scripts/work.py::complete()` 가 retro.py 를 subprocess 호출 하지는 않음).

```bash
python3 "$PLUGIN_ROOT/scripts/retro.py" --harness-dir .harness --feature F-N
```

**산출**: `.harness/_workspace/retro/F-N.md`
- 머신 섹션 (retro.py 자동 채움): What Shipped · First Gate to Fail · Ceremonies summary (kickoff/design-review/questions 카운트).
- LLM 섹션 (orchestrator 가 reviewer → tech-writer 순차 호출): Risks Materialized vs plan.md · Decisions Revised · Kickoff Predictions Right/Wrong · Reviewer Reflection · Copy Polish.

**author 순서**: reviewer 가 draft **prose 반환** (read-only 유지 · CQS — BR-012), orchestrator 가 Reviewer Reflection 섹션에 draft 를 write. 이어 tech-writer 가 Copy Polish 섹션에서 prose 를 직접 다듬음 (tech-writer tools 에 Write/Edit 있음). 순차 고정.

**이벤트**: `feature_retro_written` (분석 summary 포함).

**향후 활용**: retro 코퍼스는 cross-feature learning · `/harness:metrics` 기반 입력.

## 참조

- `scripts/work.py` — 실제 구현.
- `scripts/state.py` — state.yaml helper.
- `docs/samples/harness-boot-self/spec.yaml` — F-004 AC · modules.
- BR-004 (Iron Law): "NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE".
- `agents/*.md` — 각 전문가 에이전트의 `## Context` · `## 산출 규약`.
