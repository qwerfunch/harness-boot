---
description: 피처 단위 개발 사이클 관리 — 활성화 · Gate 결과 기록 · 증거 수집 · done 전이 (F-004). Phase 1 Gate 실행 자체는 사용자 · CI 가 담당.
allowed-tools: [Read, Write, Bash]
argument-hint: "<F-ID> [--gate NAME RESULT] [--evidence SUMMARY] [--complete] [--block REASON] [--current]"
---

# /harness-boot:work — 피처 개발 사이클 (F-004)

이 명령은 **피처 단위 TDD 사이클의 상태 관리자**. v0.3 범위에서 Gate 실행 자체는 사용자 또는 CI 가 수행하고 결과만 `state.yaml` + `events.log` 에 기록.

**v0.3 경계**:
- 실제 테스트 러너 · 커버리지 계산 · Gate 5 runtime smoke 자동화는 **범위 밖** (v0.4+).
- 이 명령은 result 기록과 상태 전이에 집중.

## Preamble (출력 맨 앞 3 줄)

```
🛠 /harness-boot:work · <action on F-ID> · <근거 5~10 단어>
NO skip: BR-004 Iron Law — gate_5=pass + evidence ≥ 1 없이 done 거부
NO shortcut: 모든 상태 전이는 scripts/work.py 경유 — state.yaml 수동 편집 금지 (work.py 가 events.log 자동 append)
```

**1 줄**: 이모지 · 명령 · <action on F-ID> · 근거.
**2-3 줄 (Anti-rationalization, BR-014)**: Iron Law 우회 · 이벤트 로그 skip 을 명시 거부.

예: `🛠 /harness-boot:work · activate F-003 · sync 완료 후 spec 변경 대응`.

## 역할별 서브커맨드

Claude 는 인자에 따라 `scripts/work.py` 를 호출. `$PLUGIN_ROOT` 는 `commands/init.md §2` 의 4-전략 체인 (또는 `scripts/core/plugin_root.py`) 으로 해석.

### 대시보드 (v0.9.2 — 빈 호출)

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" --harness-dir "$(pwd)/.harness"
python3 "$PLUGIN_ROOT/scripts/work.py" --harness-dir "$(pwd)/.harness" --json
```

인자 없이 호출하면 **읽기 전용 대시보드**가 출력된다.

```
📊 harness-boot

작업 중: "로그인 흐름"
  진행: 검증 3/6 통과 · 근거 1 개
  차단: 접근성 · Space 키 동작 미정

진행 중 (다른):
  "대시보드"

보류: "결제"

대기: "로그아웃" · "설정"

다음 할 일:
  (1) 검증 실행: gate_3 (추천)
  (2) 다른 작업으로 전환

Enter = 1 (추천)
```

CQS — `state.yaml` · `events.log` mtime 불변. "다음 할 일" 1~3 안은 `scripts/ui/intent_planner.py` 의 결정론 규칙 산출물 (LLM 호출 없음): active feature 의 gate 진행 · evidence 상태 · blocker 를 읽어 **다음 논리적 단계** 한 개를 추천으로 제시. 사용자가 자연어로 수정 요청하거나 명시 명령을 보내면 해당 분기로 진입.

### 활성화

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --harness-dir "$(pwd)/.harness" --json
```

- `planned` → `in_progress` 전이 + `session.active_feature_id` 설정.
- 이미 `done` 이면 읽기만 (재활성화 거부).

**F-037 Layer B fog-clear (auto, 2026-04-27)**: brownfield 프로젝트 (`metadata.source.origin == "existing_code"`) 에서 activate 시점에 자동으로 발화. `feature.modules[]` 가 가리키는 영역만 결정론 정찰 → `.harness/chapters/area-{slug}.md` 작성 + `.harness/area_index.yaml` 갱신 + `events.log` 의 `fog_cleared` 이벤트. 이후 같은 activate 의 kickoff 가 chapter 를 자동 참조 ("기존 스타일 컨텍스트" 섹션). idempotent — 같은 area set 두 번째 activate 는 chapter byte-identical + event 중복 X. 사용자 편집은 chapter 의 `<!-- harness:user-edit-begin -->` ~ `end` 영역으로 보존.

**opt-out**: `python3 work.py F-NNN --no-fog` (이번 한 번) 또는 `spec.metadata.fog.disabled: true` (영구). 그린필드 (`origin: idea`) 에서 fog 가 노이즈면 `metadata.fog.disabled: true` 로 비활성.

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

`scripts/gate/runner.py` 가 러너를 자동 감지:

- **gate_0 (tests)**: pyproject+pytest → tests/+unittest → npm test → make test
- **gate_1 (type check)**: pyproject+mypy → pyproject+pyright → tsconfig+tsc → Cargo+cargo check → go.mod+go vet
- **gate_2 (lint)**: pyproject+ruff → pyproject+flake8 → package.json+eslint → .eslintrc+npx → Cargo+cargo clippy → go.mod+golangci-lint
- **gate_3 (coverage, v0.3.5+)**: pyproject+pytest-cov → coverage+pytest → package.json.scripts.coverage → npx nyc → Cargo+tarpaulin → Cargo+llvm-cov → go test -cover. threshold 는 도구 자체 설정 (`[tool.coverage]` 등) 을 따름.
- **gate_4 (commit check, v0.3.6+)**: `git diff --quiet && git diff --cached --quiet` — working tree + staging area 모두 clean 이어야 pass. git repo 아니거나 `git` 바이너리 부재 시 `skipped`.
- **gate_5 (runtime smoke, v0.3.7+)**: `scripts/smoke.sh` → `tests/smoke/` + pytest → `tests/smoke/` + unittest → Makefile `smoke:` → package.json `scripts.smoke`. runtime smoke 는 프로젝트별 특성이 강하므로 **`harness.yaml.gate_commands.gate_5` override 권장**. 감지 실패 시 `skipped` (reason 에 override 안내 포함). 기본 timeout 600s.
- **gate_perf (performance, v0.7.3+)**: auto-detect 없음 (perf 도구 다양성). `harness.yaml.gate_commands.gate_perf` 또는 `--override-command` 필수. pass 시 evidence summary 에 feature 의 `performance_budget` (lcp_ms · inp_ms · bundle_kb · custom[]) 이 자동 주입. 기본 timeout 900s.

결과 자동 기록 + pass 시 evidence 자동 추가. Override 우선순위: `--override-command` → `harness.yaml.gate_commands.<gate>` → auto-detect.

**현재 범위**: gate_0~5 + gate_perf 자동화. gate_0~5 는 BR-004 Iron Law 필수 경로, gate_perf 는 `performance_budget` 선언된 피처의 orchestrator routing (performance-engineer) 에서 호출.

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
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --complete --hotfix-reason "prod down — redis race"
```

**Iron Law D** (v0.9.3 — BR-004 강화):

1. `gate_5` (runtime smoke) 결과 = `pass`
2. 최근 **7 일 declared evidence** (kind != `gate_run` · `gate_auto_run`) 개수 ≥ 요구치:
   - `product` 모드 (default): **3 개**
   - `prototype` 모드 (`spec.project.mode: prototype`): **1 개**
3. `--hotfix-reason "..."`: product 모드에서도 1 개 허용. 사유가 `kind=hotfix` evidence 로 자동 기록되어 audit trail 남김.

거부 시 이유 반환 (상태 불변 · 재호출 가능). 통과 시 `done` 전이 + `active_feature_id` 해제 + `feature_done` 이벤트에 `iron_law_mode` · `declared_count` · `required` · (있다면) `hotfix_reason` 첨부.

**kind taxonomy**:
- automatic: `gate_run` · `gate_auto_run` — gate runner 자동 생성, Iron Law D 불인정.
- declared: `test` · `manual_check` · `user_feedback` · `reviewer_check` · `blocker` · `hotfix` · `generic` · `trivial` · 그 외 — 개발자 의도 신호, Iron Law D 인정.

**`kind=trivial`** (v0.10.7, cosmic-suika I-006 환원): 정말 작은 변경 (한 줄 wiring · typo · doc-only · style fix) 의 evidence 라는 의도 신호. **Iron Law D 면제 X** — 여전히 카운트되고 evidence ≥ N 임계값에 포함됨. 단지 reviewer / audit reader 가 "이건 ceremony 가 아니라 진짜 trivial 이었다" 를 알 수 있게 하는 의미적 마커. ceremony 한 줄도 아까운 cleanup PR 에 사용. 진짜 emergency 우회는 `--hotfix-reason` 사용.

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
/harness-boot:work F-004                                 → activated
... (사용자가 TDD red/green/refactor 수행) ...
/harness-boot:work F-004 --gate gate_0 pass --note "19 tests green"
/harness-boot:work F-004 --gate gate_1 pass --note "type check clean"
/harness-boot:work F-004 --gate gate_2 pass
/harness-boot:work F-004 --gate gate_3 pass --note "coverage 85%"
/harness-boot:work F-004 --gate gate_4 pass --note "merged"
/harness-boot:work F-004 --gate gate_5 pass --note "smoke session OK"
/harness-boot:work F-004 --evidence "full suite 237/237" --kind test
/harness-boot:work F-004 --complete                      → done
```

## 실패 조건

- harness_dir 미존재 → 중단.
- `--complete` 인데 gate_5 미통과 또는 evidence 없음 → action=queried + 이유 메시지 반환 (실패 아님, 재호출 가능).
- invalid gate result → exit 3.

## Activate UX 경고 (v0.7.1)

`activate` 는 아래 상황에서 stderr 경고를 찍고도 진행한다 (backward compat — 실패 아님):

- **ghost feature**: `spec.yaml` 은 존재하나 해당 `F-N` 이 그 안에 없음. `/harness-boot:work` 으로 등록하거나 `--remove F-N` 으로 되돌릴 것을 안내.
- **concurrent in_progress**: 다른 피처가 이미 `in_progress`. 새 피처 activate 전에 완료·block 또는 무시하고 병렬 작업.

## Session pointer 정리 (v0.7.1)

```bash
/harness-boot:work --deactivate              # session.active_feature_id 만 비움. 피처 status 유지
/harness-boot:work --remove F-99             # state.yaml features[] 에서 항목 삭제 (유령 정리). done 피처는 보호
```

- `--deactivate` 는 단일 작업 세션을 닫을 때 (상태는 나중에 재개 가능).
- `--remove` 는 ghost 나 오타로 만들어진 엔트리 회수. `feature_removed` event 가 log 에 남아 audit 가능.

## Orchestration Routing (v0.5)

orchestrator 가 피처 shape 에 따라 소환 체인을 결정한다. 아래 표는 **머신 체크 가능한 계약** — `tests/unit/test_work_routing.py` 가 이 표를 파싱해 6 행 존재 + shape_key + agent_chain 컬럼을 assert.

| shape_key | agent_chain |
|---|---|
| baseline-empty-vague | `@harness:researcher` → `@harness:product-planner` → `/harness-boot:work <plan.md>` |
| ui_surface.present | `@harness:ux-architect` → (`@harness:visual-designer` ∥ `@harness:audio-designer` if has_audio) → `@harness:a11y-auditor` → `@harness:frontend-engineer` (+ `@harness:software-engineer` for logic) |
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

**자유 텍스트 의도 라우팅 (F-038, 2026-04-27)**: 사용자가 work 안에서 자유 텍스트로 던지는 의도 — *질문 / 디자인 / 기획 / 구현 / 리뷰* — 는 **이 표의 shape 키에 흡수**된다. orchestrator 가 shape 에 매칭된 전문가 chain 을 호출하므로 별도 의도 분류기 없이도 자연스럽게 분기됨:

| 사용자 의도 | 매핑되는 shape / 에이전트 |
|---|---|
| "이 도메인 어떻게 모델링?" / "엔티티 관계 질문" | `pure_domain_logic` → `backend-engineer` (+ `software-engineer`) |
| "이 화면 흐름 디자인" / "버튼 위치 검토" | `ui_surface.present` → `ux-architect` → `visual-designer` → `a11y-auditor` → `frontend-engineer` |
| "기획 검토" / "이 기능 vs 다른 기능 우선순위" | `baseline-empty-vague` (스펙 미정) → `researcher` → `product-planner` |
| "성능 / 응답시간 목표" | `performance_budget` → `performance-engineer` |
| "보안 / 인증 / 결제" | `sensitive_or_auth` → `security-engineer` ∥ `reviewer` |
| "구현해 / 코드 짜 / 테스트 추가" | feature shape 의 engineer + `qa-engineer` |
| "리뷰 / 검수 / 마무리" | `feature_completion` → `qa-engineer` → engineers → `integrator` → `tech-writer` → `reviewer` |

**라우팅 투명성 (F-038)**: `python3 work.py F-N` activate 직후 출력에 `routed agents: <chain>` 한 줄이 자동 추가되고, no-args dashboard 에도 active feature 의 `agent chain:` 섹션이 노출된다. 즉 **사용자가 kickoff.md 를 직접 열지 않아도 이번 activate 가 어떤 에이전트를 호출하는지 즉시 본다**. 머신 체크: `tests/unit/test_work_routed_agents.py` + `test_dashboard_agent_chain.py` 가 routed_agents 일치를 검증.

**Parallel dispatch (F-039, 2026-04-27)**: orchestrator 가 같은 메시지에서 여러 Agent tool call 을 보내면 Claude Code 가 **native 로 병렬 실행**한다. write conflict 가 없는 read-only 감사 또는 독립 산출물 에이전트끼리만 병렬화하면 안전. 현재 명시된 그룹:

- `sensitive_or_auth` → `(@harness:security-engineer ∥ @harness:reviewer)` — 둘 다 read-only 감사. security BLOCK 이 veto.
- `ui_surface.present` (has_audio=true) → `(@harness:visual-designer ∥ @harness:audio-designer)` — 둘 다 ux-architect 의 `flows.md` 의존, 출력 파일 분리 (tokens.yaml · audio.yaml).

라우팅 표기: 병렬 그룹은 `(a ∥ b)` 로 묶이고, 순차 단계는 `→` 로 연결됨. `routed agents:` (activate 출력) 와 `agent chain:` (dashboard) 둘 다 동일 문법. 머신 체크: `kickoff.PARALLEL_GROUPS` 상수 + `parallel_groups_for_shapes()` helper + `tests/unit/test_kickoff_parallel_groups.py` · `test_work_parallel_routing.py` · `test_dashboard_parallel.py` 가 그룹 매핑 + 렌더링을 검증. 안전 규칙: **새 병렬 그룹 추가 전 write conflict 가능성 검토** — 두 에이전트가 같은 파일을 동시 작성하면 마지막 writer wins 위험. orchestrator 책임.

## Kickoff Ceremony (v0.6 + v0.8.2 idempotency)

`/harness-boot:work F-N activate` state 전이 직후 `scripts/work.py` 가 **자동으로** `kickoff.generate_kickoff` 를 호출한다 (v0.7 auto-wire). spec.yaml 이 resolve 되고 해당 feature 가 존재할 때만 발화 — spec 미존재 시 silent skip (backward compat). Discovery 단계(spec 최초 작성)는 해당 없음.

**Idempotency (v0.8.2)**: `.harness/_workspace/kickoff/F-N.md` 이 이미 존재하면 **덮어쓰지 않음**. 사용자(또는 orchestrator)가 heading 을 채운 뒤 재-activate 해도 내용 보존. 재생성이 필요하면 `--kickoff` 플래그로 force:

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-N --kickoff --harness-dir .harness
```

이 플래그는 shape 변화 등으로 agent 라인업을 다시 뽑아야 할 때 사용. (design-review 의 `--design-review` 와 같은 패턴)

**실행 메커니즘** (v0.7 auto-wire):

`activate()` 내부가 `_autowire_kickoff()` 를 호출 → `spec.yaml` 파싱 → `kickoff.detect_shapes(feature)` 로 shape list 산출 → `kickoff.generate_kickoff()` 발화. CLI 로도 수동 재현 가능:

```bash
python3 "$PLUGIN_ROOT/scripts/ceremonies/kickoff.py" \
    --harness-dir .harness \
    --feature F-N \
    --shape ui_surface.present \
    --shape feature_completion \
    [--has-audio]
```

Shape 감지 규칙 (`kickoff.detect_shapes`):
- title · AC · modules 전부 비어 있음 → `["baseline-empty-vague"]`
- `ui_surface.present=true` → `ui_surface.present` (+ `has_audio=true` 면 audio-designer 포함)
- `performance_budget` 선언 있음 → `performance_budget`
- `sensitive=true` 또는 도메인의 sensitive entity 참조 → `sensitive_or_auth`
- 위 전문가 shape 모두 없음 → `pure_domain_logic`
- 항상 최종에 `feature_completion` 추가

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
python3 "$PLUGIN_ROOT/scripts/ceremonies/inbox.py" --harness-dir .harness --feature F-N
# → 🔒/⬜️ · 🔒 blocking · F-N · from → to · path
```

`--json` 으로 machine-parse · `--all` 로 answered 포함.

**이벤트**: orchestrator 는 새 question 파일 감지 시 `question_opened` · answer append 시 `question_answered` 를 `events.log` 에 append (PR-ε retro 에서 집계).

**왜 파일 기반**: daemon · routing 복잡도 0, `git grep` 으로 이력 추적, PR diff 로 리뷰 가능. Slack 스레드의 로컬 등가물.

## Design Review Ceremony (v0.8 auto-wire)

v0.8 부터 `scripts/work.py` 가 자동 발화. 트리거는 단일 lifecycle 이벤트가 아니라 **3 조건 readiness check** — state-mutating work.py 호출 (activate · record_gate · add_evidence · run_and_record_gate) 말미에서 평가.

**자동 발화 3 조건** (AND):

1. `features[F-N].ui_surface.present == true` — UI 없는 피처는 design-review 의미 없음
2. `.harness/_workspace/design/flows.md` 존재 — ux-architect 가 delivered
3. `.harness/_workspace/design-review/F-N.md` 미존재 — **idempotent**, 한 번만 발화

셋 다 참이면 `ceremonies.design_review.generate_design_review` 가 호출되어 template + `design_review_opened` event 를 생성. 하나라도 거짓이면 silent skip.

**수동 재생성** (예: flows.md 업데이트 후 design-review 갱신):

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-N --design-review --harness-dir .harness
```

`--design-review` 플래그는 idempotent 조건 (3) 을 우회해 덮어쓴다. 조건 (1)(2) 는 여전히 적용 — UI 없는 피처엔 강제 재생성도 발화 안 함.

**CLI 직접 호출** (raw template 생성):

```bash
python3 "$PLUGIN_ROOT/scripts/ceremonies/design_review.py" \
    --harness-dir .harness --feature F-N [--has-audio]
```

**참여**: `visual-designer` + `frontend-engineer` + `a11y-auditor` (+ `audio-designer` if has_audio). 그 외 agent 는 flows.md 접근 권한 없음 (Tier 규약).

**산출**: `.harness/_workspace/design-review/F-N.md` — reviewer 별 concerns 섹션 + orchestrator "Decisions" 푸터. 충돌 2회 반복 시 사용자 escalate.

**이벤트**: `design_review_opened`.

## Retrospective Ceremony (v0.6 + v0.8.7 idempotency)

`/harness-boot:work F-N --complete` 성공(gate_5 + evidence) 직후 `scripts/work.py::complete()` 가 **자동으로** `retro.generate_retro` 를 호출한다 (v0.7 auto-wire). spec.yaml 미존재 시 silent skip (kickoff 와 대칭).

**Idempotency (v0.8.7)**:

- `--complete` 를 **이미 done 인 피처에 재호출** 시 no-op + `action=queried` 반환. `feature_done` · `feature_retro_written` event 중복 발화 없음.
- `.harness/_workspace/retro/F-N.md` 이 이미 존재하면 덮어쓰지 않음 — orchestrator 가 reviewer → tech-writer 로 채운 prose 가 재생성으로 날아가지 않음.
- 재생성이 필요하면 `--retro` 플래그로 force:

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-N --retro --harness-dir .harness
```

(kickoff 의 `--kickoff` · design-review 의 `--design-review` 와 같은 패턴. 3 ceremony 모두 일관.)

```bash
python3 "$PLUGIN_ROOT/scripts/ceremonies/retro.py" --harness-dir .harness --feature F-N
```

**산출**: `.harness/_workspace/retro/F-N.md`
- 머신 섹션 (retro.py 자동 채움): What Shipped · First Gate to Fail · Ceremonies summary (kickoff/design-review/questions 카운트).
- LLM 섹션 (orchestrator 가 reviewer → tech-writer 순차 호출): Risks Materialized vs plan.md · Decisions Revised · Kickoff Predictions Right/Wrong · Reviewer Reflection · Copy Polish.

**author 순서**: reviewer 가 draft **prose 반환** (read-only 유지 · CQS — BR-012), orchestrator 가 Reviewer Reflection 섹션에 draft 를 write. 이어 tech-writer 가 Copy Polish 섹션에서 prose 를 직접 다듬음 (tech-writer tools 에 Write/Edit 있음). 순차 고정.

**이벤트**: `feature_retro_written` (분석 summary 포함).

**향후 활용**: retro 코퍼스는 cross-feature learning · `/harness-boot:work` 기반 입력.

## 참조

- `scripts/work.py` — 실제 구현.
- `scripts/core/state.py` — state.yaml helper.
- `docs/samples/harness-boot-self/spec.yaml` — F-004 AC · modules.
- BR-004 (Iron Law): "NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE".
- `agents/*.md` — 각 전문가 에이전트의 `## Context` · `## 산출 규약`.

## Issue logging — harness-boot 개선 피드백 루프 (F-027)

이 명령을 실행하면서 **harness-boot 플러그인 자체의 마찰** (Gate 자동 감지 실패 · spec/state 부정합 · ceremony 산출 깨짐 · stale doc · dead reference · 어색한 UX · 빠진 자동화) 을 발견하면 **즉시 한 항목씩** `.harness/_workspace/issues-log.md` 에 append. 사용자가 메인테이너에게 공유 시 다음 plugin 릴리즈 (예: cosmic-suika I-001/I-008/I-010 → v0.10.x 환원) 의 trigger.

`.harness/_workspace/issues-log.md` 가 없으면 새로 만들고 짧은 헤더 (`# harness-boot ISSUES-LOG — <project name>`) 만 1 회 작성.

**Entry 템플릿 (markdown, append-only)**:

```markdown
## YYYY-MM-DDTHH:MM:SSZ — <한 줄 제목>
- **Source**: /harness-boot:work [F-N]
- **Category**: ergonomics | bug | missing-feature | dead-reference | docs-stale | gate-detect
- **Severity**: blocker | annoying | trivial
- **What happened**: <1~3 줄 — Claude 가 본 사실 + 관련 명령/파일 경로>
- **Suggested fix**: <선택 — 떠오르면 1 줄>
```

**언제 안 적나**: 사용자 피처 자체의 버그 (그건 사용자가 F-N evidence 로 기록) · 단순 git 충돌 같은 일반 dev 마찰 · gate 가 정당하게 fail 한 경우 (사용자 코드가 잘못됨). 의심스러우면 한 줄로 적되 Severity=trivial.

**NO skip**: 이 섹션은 fail-open 이지만 (logging 실패가 사이클을 막지 않음) **Claude 가 마찰을 봤는데 적지 않으면** 다음 사용자가 같은 마찰을 또 만남 — 디시플린.

---

## Glossary / 용어집 (F-040)

플러그인 출력 + 문서에서 자주 보이는 용어를 사용자 친화 표현으로 풀어 둡니다. 백엔드 코드 / 스키마 / commit 은 영어 jargon 을 그대로 유지 (drift 위험 회피); 사용자 노출 출력은 `HARNESS_LANG=ko` · `spec.project.language: ko` 또는 시스템 한국어 locale 시 친화 표현으로 자동 전환.

| 용어 (jargon) | 짧은 풀이 (EN) | 짧은 풀이 (KO) |
|---|---|---|
| **Walking Skeleton** | the smallest end-to-end slice that proves the system is wired | 시스템이 연결됐음을 증명하는 가장 작은 끝-끝 골격 |
| **Iron Law D** | "no done without walking skeleton + N declared evidence + gate_5 pass" | "기본 골격 + 근거 N 개 + 검증 5단계 통과 없이 완료 불가" |
| **gate_0 ~ gate_5** | staged checks (lint → unit → integration → coverage → clean tree → smoke) | 단계별 검증 (린트 → 단위 → 통합 → 커버리지 → 깨끗한 작업 트리 → 동작 확인) |
| **evidence** | a recorded artifact that this AC passed (test run / contract / smoke) | 이 인수기준이 통과했음을 기록한 산출물 |
| **drift** | spec ↔ code/doc/state divergence detected by check.py | 스펙과 코드/문서/상태의 어긋남 (check.py 가 자동 검출) |
| **kickoff** | per-feature ceremony that names participating agents and their concerns | 피처별 시작 회의 — 참여 에이전트와 우려사항 |
| **retro** | per-feature retrospective written after `--complete` | 피처 완료 후 회고 |
| **autowire** | implicit ceremony fired by `work.py activate` (kickoff / fog-clear / design-review) | activate 시점에 자동 발화하는 부수 작업 |
| **preamble** | the 3-line header every command emits (BR-014 anti-rationalization) | 모든 명령이 출력 맨 앞에 박는 3줄 안내 (NO skip / NO shortcut) |
| **fog-clear** (F-037) | per-feature reconnaissance that fills `.harness/chapters/area-*.md` | 피처마다 영역 정찰 — 지도의 어둠을 걷어냄 |
| **routed agents** (F-038) | the agents the orchestrator will engage for this feature | 이번 피처에 참여할 팀 |
| **parallel groups** (F-039) | agent pairs orchestrator may dispatch in one message (e.g. `(security ∥ reviewer)`) | 한 메시지에서 동시 호출 가능한 에이전트 묶음 |
| **mode = prototype \| product** | ceremony weight switch — prototype is lighter, product strict | 디시플린 강도 — prototype 은 가벼움, product 는 엄격 |
| **shape** | feature classification driving the agent chain (UI / sensitive / pure-domain / etc.) | 피처 유형 — 어떤 에이전트 체인이 호출될지 결정 |
| **sigil region** | `<!-- harness:user-edit-begin -->` … `<!-- harness:user-edit-end -->` block preserved across regen | 자동 재생성에도 보존되는 사용자 편집 보호 영역 |
