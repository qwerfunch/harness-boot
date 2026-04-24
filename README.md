# harness-boot

> **자연어로 쓴 기획 의도를 AI 가 따라갈 수 있는 "중간언어 (spec.yaml)" 로 바꾸고, 그 중간언어를 단일 원천 (SSoT) 으로 삼아 전문가 에이전트 팀을 역할별 읽기 계층과 팀 ceremony (kickoff · design review · Q&A · retro) 아래 오케스트레이션한다.**
>
> Claude Code 플러그인으로 제공.

[![version](https://img.shields.io/badge/plugin-v0.6.1-blue)](.claude-plugin/plugin.json)
[![spec](https://img.shields.io/badge/spec-v2.3.8-green)](docs/schemas/spec.schema.json)
[![tests](https://img.shields.io/badge/tests-535%20passing-brightgreen)](tests/unit)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## 왜?

LLM 에게 "이런 제품을 만들어줘" 라고 자연어로 던지면 세 문제가 동시에 발생합니다:

1. **사고의 글과 실행의 글 혼재** — "직관적이어야 한다" 와 "POST /users returns 201" 이 한 문단에 섞여 LLM 이 자유 영역과 계약 영역을 구분 못 함.
2. **정보 정체** — 기획자가 내린 ADR · Risk · trade-off 가 Design · Engineering 에이전트에게 전달되지 않음. 결정 rationale 이 product-planner 이후 invisible.
3. **증거 없는 완료** — "됐다" 라고 말해도 runtime smoke · test · drift 검증 흔적 없음.

**harness-boot 의 답**:

- (1) 두 글을 `spec.yaml` 안에서 **스키마로 분리** · LLM 이 판별 부담 없이 필드가 묻는 것만 답한다.
- (2) `plan.md` 의 ADR/Risk 를 `domain.md` 로 렌더하고 `architecture.yaml` 을 파생 · 에이전트는 **역할별 Tier 로 차등 읽기**.
- (3) **BR-004 Iron Law** — `gate_5 pass + evidence ≥ 1` 없이는 `done` 이 거부됨.

> 사고의 글은 자유로워야 하고, 실행의 글은 구조화되어야 한다.
> 두 글이 어긋나거나 실행 결과와 차이가 날 때 알려주는 것이 **harness 의 일**.

---

## 핵심 흐름

사용자가 관리하는 파일은 `spec.yaml` 하나. 거기서 모든 파생·개발·관찰이 출발.

```
      자연어 기획 (plan.md · 대화 · 한 줄 아이디어)
                       │
                       │  /harness:init          (최초 1회)
                       ▼
         ╔══════════════════════════════════════╗
         ║          spec.yaml  (SSoT)           ║  ←  /harness:spec
         ║    🗒 사고의 글    · 자유 서술        ║     (Mode A/B/R/E)
         ║    🔒 실행의 글    · 스키마 검증      ║     · plan.md 변환
         ║    decisions[] · risks[]  (v0.6)     ║     · 한 줄 → researcher
         ╚══════════╤══════════════════╤════════╝
                    │                  │
             /harness:sync      /harness:work  <F-N>
                    │                  │
                    ▼                  ▼
      ┌───────────────────┐   ┌────────────────────────────┐
      │  파생 뷰 (v0.6)   │   │  개발 사이클 + Ceremony    │
      │  · domain.md      │   │  · Gate 0~5 · BR-004       │
      │    + Decisions    │   │  · 에이전트 역할별 소환     │
      │    + Risks        │   │  · Kickoff · Design Review │
      │  · architecture   │   │  · Q&A inbox · Retro       │
      │  · 해시 트리      │   │                            │
      └───────────────────┘   └────────────────────────────┘

      관찰 (read-only · CQS):
         /harness:status   세션 · 피처 · drift 요약
         /harness:check    8 종 drift 탐지
         /harness:events   events.log 필터
         /harness:metrics  lead time · gate pass · drift 빈도
```

**어긋남을 찾는 3 지점**:
- `spec.yaml` — 스키마 검증 (실행의 글 형식 불일치).
- `/harness:sync` — 해시 비교 (파생 drift).
- `/harness:work` — Gate 실행 결과 (증거 없는 `done` 차단).

---

## 설치

```
/plugin marketplace add qwerfunch/harness-boot
/plugin install harness@harness-boot
```

Claude Code 2.1+ · Python 3.10+ · `pyyaml` · `jsonschema` (선택).
재시작 후 `/harness:init` 자동완성에 뜨면 성공.

---

## 8 슬래시 명령

| 명령 | 역할 |
|---|---|
| `/harness:init` | `.harness/` 골격 + CLAUDE.md 편성 (`--solo` / `--team`) |
| `/harness:spec` | spec.yaml 편집 · Mode A/R/E + B-1(empty)/B-1-vague(한 줄 → researcher)/B-2(plan.md 변환) |
| `/harness:sync` | spec → `domain.md` · `architecture.yaml` · `harness.yaml` 파생 + 해시 트리 갱신 |
| `/harness:work` | 피처 lifecycle (activate · gate 기록/자동실행 · evidence · complete) |
| `/harness:status` | 세션 · 피처 · drift · 마지막 sync 요약 (CQS) |
| `/harness:check` | 8 종 drift 탐지 (Generated · Spec · Derived · Include · Evidence · Code · Doc · Anchor) |
| `/harness:events` | events.log 필터 조회 (CQS) |
| `/harness:metrics` | lead time · gate pass rate · drift 빈도 |

---

## 전형 사용 흐름

```bash
/harness:init --solo                   # .harness/ 스캐폴딩
/harness:spec plan.md                  # 또는: /harness:spec "수박게임 웹"
                                       #   → 40 단어 미만이면 researcher → product-planner → B-2
/harness:sync                          # spec → domain/architecture/harness.yaml
/harness:status                        # 피처 목록·ID (F-0, F-1, ...)
/harness:work F-0 activate             # Kickoff ceremony 기동 (orchestrator 가 호출)
# ... 피처 shape 에 매칭된 에이전트만 순차 소환 (문서 규약 기반)
/harness:work F-0 --run-gate gate_0    # gate 0~5 자동 실행 (pytest/mypy/ruff/coverage/smoke)
/harness:work F-0 --evidence "17/17"   # 증거 기록
/harness:work F-0 --complete           # BR-004 Iron Law 통과 확인 → done
                                       # → Retro ceremony 자동 생성
/harness:check                         # drift 점검 (read-only)
```

---

## 전문가 에이전트 오케스트레이션

v0.5 에 도입된 전문가 풀. `@harness:<name>` 형태의 @-mention 으로 직접 호출하거나, orchestrator 가 피처의 shape (UI 여부 · 민감 entity · 성능 예산 등) 에 따라 자동 라우팅한다.

### Stage 별 구성

| Stage | Agent | 산출 |
|---|---|---|
| **Discovery** | researcher · product-planner | brief.md · plan.md |
| **eXperience** | ux-architect · visual-designer · audio-designer · a11y-auditor | flows.md · tokens.yaml · components.yaml · audio.yaml · a11y/report.md |
| **Engineering** | software-engineer · frontend-engineer · backend-engineer · security-engineer · performance-engineer | `src/` · 테스트 · `_workspace/security/` · `_workspace/perf/` |
| **Quality** | qa-engineer | qa/strategy.md |
| **Integration** | integrator · tech-writer | DI 배선 · README · CHANGELOG · docs/ |
| **Coordination** | orchestrator | ceremony 파일 write · agent 소환 |
| **Audit** | reviewer | drift 리포트 · retro Reflection 의 prose draft (read-only · CQS) |

각 에이전트는 `agents/<name>.md` 의 `## Context` 블록에 **읽는 계층** 을 선언. frontmatter `tools:` 가 권한을 실제로 enforce (예: reviewer 는 Read/Grep/Glob/Bash 만 — 파일 수정 불가능).

### 피처 Shape 별 라우팅

orchestrator 는 `commands/work.md` 의 라우팅 표와 `scripts/kickoff.py` 의 매핑 상수를 동일 소스로 사용한다 (두 곳이 어긋나지 않도록 parity 테스트로 강제).

| 피처 shape | 에이전트 체인 |
|---|---|
| `baseline-empty-vague` (한 줄 아이디어) | researcher → product-planner → Mode B-2 → spec.yaml |
| `ui_surface.present` (UI 있는 피처) | ux-architect → visual (+audio) → a11y → frontend (+software) |
| `sensitive_or_auth` (민감 entity/인증) | security-engineer ∥ reviewer (security BLOCK veto) |
| `performance_budget` (성능 예산 선언) | performance-engineer |
| `pure_domain_logic` (순수 서비스/도메인) | backend-engineer (+software) |
| `feature_completion` (완료 직전) | qa → engineers(tests) → integrator → tech-writer → reviewer |

---

## 3 계층 참조 — 역할별 차등 읽기

모든 에이전트에게 모든 정보를 주입하면 토큰 비용·집중력·역할 경계가 모두 손상된다. v0.6 은 **3 계층 (Tier) 체계**로 해결:

| 계층 | 파일 | 내용 | 읽는 에이전트 |
|---|---|---|---|
| **Tier 1** | `.harness/domain.md` | Project · Stakeholders · Entities · Business Rules · **Decisions · Risks** (v0.6 신규) | 전원 필수 |
| **Tier 2** | `.harness/architecture.yaml` | modules · tech_stack · host binding · contribution points · gate chain | Engineering · Quality · Integration · Audit |
| **Tier 3** | `.harness/_workspace/plan/plan.md` | ADR 원문 · RICE 점수 · appetite · open questions | tech-writer · reviewer · orchestrator |

규약:
- `spec.yaml` 은 **누구도 직접 참조하지 않는다** — 원천 파일을 격리해 스키마 변경이 모든 에이전트를 깨지 않도록.
- Design 계열 (ux / visual / audio / a11y) 은 Tier 1 만 — 행동·시각·청각 설계에 집중, 모듈 그래프 불필요.
- Engineering 계열은 Tier 1+2 — 모듈 경계와 기술 스택 맥락 필요.
- Docs (tech-writer) 는 Tier 1+3 — ADR 원문을 "Why" 섹션에 인용.
- Audit (reviewer) 만 전 계층 접근 — drift 감사 역할이라 제한 없음 (읽기 전용은 유지).

**역할 간 공유 맥락** 은 domain.md 의 Decisions/Risks 섹션으로 확보 — 예를 들어 visual-designer 도 `entities.sensitive=true` 나 `Decisions[tag=security]` 를 볼 수 있어 PII 가 담긴 CTA 같은 사고를 예방.

---

## 팀 Ceremony — 실제 현업 리추얼 이식

v0.6 신규. 각 ceremony 의 산출은 `.harness/_workspace/` 에 파일로 누적 — `grep` 과 `git` 으로 이력 추적 가능.

| Ceremony | 트리거 | Python 역할 | Orchestrator 역할 | 산출 |
|---|---|---|---|---|
| **Kickoff** | `/harness:work F-N activate` 직후 | 템플릿 생성 · events.log 에 `kickoff_started` 기록 | 피처 shape 에 매칭된 에이전트들에게 "80 단어 내 우려 3 bullet" 요청 후 응답을 파일에 append | `_workspace/kickoff/F-N.md` |
| **Design Review** | ux-architect 가 `flows.md` 저장 후 | 리뷰어 (visual · frontend · a11y · 조건부 audio) 템플릿 생성 | 각 리뷰어를 병렬 호출해 concerns 수집 · Decisions 푸터에 판정 | `_workspace/design-review/F-N.md` |
| **Q&A (파일 기반)** | 에이전트가 불명확한 점 발견 | `scripts/inbox.py` 가 열린 질문을 폴링 | `questions/F-N--<보낸이>--<받는이>.md` 에 Answer 섹션 추가 | `_workspace/questions/` |
| **Retrospective** | `/harness:work F-N --complete` 직후 | `events.log` 분석해 "What Shipped · 첫 번째 실패 Gate · Ceremony 요약" 자동 채움 | reviewer 로부터 Reflection 초안을 문자열로 받아 파일에 write · 이어 tech-writer 가 prose 다듬음 | `_workspace/retro/F-N.md` |

**원칙**: Python 스크립트는 **템플릿 생성 + 이벤트 로그 기록** 만 담당. 실제 지능 작업 (에이전트 호출 · 파일에 prose write) 은 orchestrator 의 LLM 책임. Claude Code 의 subagent 호출 모델과 정합.

**v0.6.1 정정**: 모든 이벤트 emitter 가 표준 key `"feature": "F-N"` 과 타입명 `"feature_done"` 을 따름 (`scripts/work.py` 규약과 통일) — 이전 `"feature_id"` · `"feature_completed"` 불일치를 routing-parity 테스트로 검출 · 수정.

---

## plan.md → spec.yaml 변환 (Mode B-2)

plan.md 가 이미 있으면 대부분 자동화:

- 4 단계 파이프라인: **정찰** (키워드·통계 추출) → **저작** (24 원칙 + 5 도메인 어댑터) → **갭 기록** (스펙으로 표현 불가능한 부분 카탈로그화) → **백링크** (각 spec 필드를 plan.md 의 행 번호로 연결).
- 8 golden 샘플 + 회귀 러너 (recall 0.991 · precision 0.861).
- 어댑터: `saas` · `game` · `worker` · `library` · `meta`.
- **v0.6 변환 규약 추가**: plan.md 의 `## Trade-off ADRs` 섹션을 `spec.decisions[]` 로 · `## Risks` 섹션을 `spec.risks[]` 로 매핑. 성능 예산 서술은 `features[].performance_budget` 로, ADR 의 supersedes (대체) 관계는 `supersedes[]` 배열로 양방향 연결. 이전엔 이 정보들이 변환 중 `unrepresentable.md` 로 누락됐던 경로를 막음.

plan.md 없으면 `/harness:spec` 만 호출해 대화형 (Mode B-1) · 한 줄 아이디어면 researcher 체인 (B-1-vague).

참조: [`skills/spec-conversion/SKILL.md`](skills/spec-conversion/SKILL.md) · [`tests/regression/conversion-goldens/`](tests/regression/conversion-goldens/) · [`docs/samples/harness-boot-self/`](docs/samples/harness-boot-self/).

---

## 하네스 엔지니어링 — 8 기둥

harness 는 LLM 개발 루프에 걸어두는 **규율 구조**.

1. **사고의 글 vs 실행의 글** — 🗒 (자유 서술) vs 🔒 (ID·enum·수치) 를 **필드 성격으로 분리**. 스키마가 경계를 강제.
2. **단일 원천 (Single Source of Truth)** — `.harness/` 에만 원천. `.claude/` 아래는 어댑터. 파생 파일은 뷰일 뿐.
3. **Schema-First** — JSONSchema 로 실행의 글 필드 검증. 스키마 위반 시 sync 차단.
4. **사용자 최소 입력** — 사용자가 직접 편집하는 파일은 `spec.yaml` **하나**.
5. **파생 우선 · 사용자 수정 존중** — 파생 파일은 원칙적으로 편집 대상 아니지만, 사용자가 수정하면 해시 비교로 감지해 덮어쓰지 않음.
6. **실행 우선 검증** — 첫 피처는 반드시 타입 `skeleton` (걸어다니는 최소 뼈대) · Gate 5 (runtime smoke) + integrator 로 "켜지는 코드" 강제.
7. **Preamble 투명성** — 모든 명령이 stdout 3 줄 preamble + 2 줄 anti-rationalization (근거·우회 거부 선언).
8. **표준 위치 존중** — Claude Code 규약 경로 (`.claude/agents/` · `.claude/skills/`) 를 그대로 사용.

### 구현 상태 (v0.6.1 기준)

- **표준 해시트리** ✅ — Canonical YAML → JSON → SHA-256 으로 subtree 와 root 를 모두 해시 (주석·공백 무시, 의미만 해시).
- **읽기/쓰기 분리 (CQS)** ✅ — 진단 명령은 파일을 읽기만 하고 mtime 을 바꾸지 않음 (테스트로 검증).
- **추가 전용 이벤트 로그** ✅ — JSONL · 표준 key `"feature": "F-N"` · 모든 emitter 통일.
- **BR-004 Iron Law** ✅ — `gate_5=pass + evidence≥1` 없이는 `done` 선언 거부.
- **Hook fail-open** 🛠 — v0.4 에 `hooks/` 인프라 ship, 세션 부트스트랩 외 5 개 템플릿은 opt-in.
- **자체 검증 가능** ✅ — `docs/samples/harness-boot-self/spec.yaml` 로 자기 자신을 표현 + `scripts/self_check.sh` 5 단계 자가 검증.

---

## 상태 · 버전

| 릴리즈 | 핵심 |
|---|---|
| v0.3.x | 8 slash commands · 8 drift · gate 0~5 auto · self-describe round trip |
| v0.4.0 | `agents/` · `hooks/` 인프라 · 3 core agents (orchestrator · implementer · reviewer) |
| v0.5.0 | **전문가 에이전트 풀 도입** · BREAKING `implementer` → `software-engineer` · Orchestration Routing 표 |
| v0.5.1 | suika-web 도그푸드에서 찾은 prose gap 4건 patch |
| **v0.6.0** | **3-Anchor Tier** · plan.md ADR/Risk → domain.md 렌더 · 4 ceremony (Kickoff · Design Review · Q&A · Retro) · schema additive (`decisions[]` · `risks[]` · `performance_budget` · `tech_stack` 구조화) |
| **v0.6.1 (current)** | Pre-push audit 3 blocker fix · event schema 통일 · reviewer CQS 유지 · auto-trigger 문구 정정 · routing drift 테스트 |
| v0.7 (계획) | ceremony auto-wire (work.py subprocess) · 15 agent fixture 확장 · eval harness · Known 4건 실 구현 (`supersedes` 자동 전이 · `skipped_agents[]` · `performance_budget` consumer · Design-stage platform 섹션) |

**검증 수준**:
- 535 unit tests (18 skipped) · self_check 5/5 PASS
- Self-describe round trip: harness-boot 자신을 변환한 spec 으로 sync 실행 → 일관된 파생
- End-to-end work cycle dogfood: F-099 활성화 → gate_5 → evidence → done · BR-004 enforcement 확인
- **외부 도그푸드**: `/Users/qwerfunch/Developer/work/suika-web/` — 완성형 수박게임 웹 (v0.5 workflow 역할극 · v0.6.1 ceremony 스크립트 실증)

---

## 레포 구조

```
harness-boot/
├── .claude-plugin/          # plugin.json · marketplace.json (v0.6.1)
├── agents/                  # 에이전트 정의 md + README (core + 전문가 · 계층 선언)
├── commands/                # 8 slash commands
├── scripts/                 # Python
│   ├── sync.py · work.py · check.py · events.py · metrics.py
│   ├── render_domain.py · render_architecture.py
│   ├── canonical_hash.py · include_expander.py · gate_runner.py
│   ├── spec_mode_classifier.py · validate_spec.py · plugin_root.py · state.py
│   ├── mode_b_*.py          # plan.md 통계 추출
│   └── kickoff.py · inbox.py · design_review.py · retro.py   # v0.6 ceremony
├── skills/spec-conversion/  # plan.md → spec.yaml 변환 스킬 (v0.5 · v0.6 에 ADR/Risk 매핑 규약 추가)
├── docs/
│   ├── schemas/spec.schema.json          # v2.3.8 + v0.6 additive
│   ├── templates/starter/                # init 템플릿
│   └── samples/harness-boot-self/        # self-referential spec
└── tests/
    ├── unit/                             # 535 tests
    └── regression/conversion-goldens/    # 8 Mode B-2 goldens
```

---

## 참여

[CHANGELOG](CHANGELOG.md) · [CLAUDE.md](CLAUDE.md) · [schema](docs/schemas/spec.schema.json) · [GitHub Issues](https://github.com/qwerfunch/harness-boot/issues).

## 라이선스

[MIT](LICENSE) · © qwerfunch
