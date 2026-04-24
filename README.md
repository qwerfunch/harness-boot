# harness-boot

> **자연어로 쓴 기획 의도를 AI 가 따라갈 수 있는 "중간언어" 로 바꾸고, 그 중간언어를 SSoT 로 16 개 전문가 에이전트를 Tier 읽기 규약과 4 ceremony 아래 오케스트레이션한다.**
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
      │    + Decisions    │   │  · 16 agent Tier 호출      │
      │    + Risks        │   │  · Kickoff · Design Review │
      │  · architecture   │   │  · Q&A inbox · Retro       │
      │  · merkle 해시    │   │                            │
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
| `/harness:sync` | spec → `domain.md` · `architecture.yaml` · `harness.yaml` 파생 + Merkle 해시 |
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
/harness:work F-0 activate             # Kickoff ceremony 기동 (orchestrator 호출)
# ... 16 agent 중 feature shape 매칭된 에이전트 순차 소환 (prose-contract)
/harness:work F-0 --run-gate gate_0    # gate 0~5 자동 실행 (pytest/mypy/ruff/coverage/smoke)
/harness:work F-0 --evidence "17/17"   # 증거 기록
/harness:work F-0 --complete           # BR-004 Iron Law 통과 확인 → done
                                       # → Retro ceremony 자동 생성
/harness:check                         # drift 점검 (read-only)
```

---

## 16 Agent Orchestration

v0.5 에 도입된 전문가 풀. `@harness:<name>` @-mention 으로 수동 호출 가능 · orchestrator 가 feature shape 에 따라 자동 라우팅.

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

각 에이전트는 `agents/<name>.md` 의 `## Context` 블록에 **읽을 Tier** 를 선언. frontmatter `tools:` 가 권한 enforce.

### 6 Routing Shape

orchestrator 가 `commands/work.md` §Orchestration Routing 표 + `scripts/kickoff.py::ROUTING_SHAPES` 기준으로 체인 결정 (둘 drift 방지 parity 테스트 강제).

| shape_key | chain |
|---|---|
| `baseline-empty-vague` | researcher → product-planner → Mode B-2 → spec |
| `ui_surface.present` | ux-architect → visual (+audio) → a11y → frontend (+software) |
| `sensitive_or_auth` | security-engineer ∥ reviewer (security BLOCK veto) |
| `performance_budget` | performance-engineer |
| `pure_domain_logic` | backend-engineer (+software) |
| `feature_completion` | qa → engineers(tests) → integrator → tech-writer → reviewer |

---

## 3-Anchor Tier — 역할별 차등 읽기

모든 에이전트에 모든 정보 주입은 토큰·집중력·역할 경계 모두 손해. v0.6 은 **Tier 체계**로 해결:

| Tier | 파일 | 내용 | 읽는 에이전트 |
|---|---|---|---|
| **1** | `.harness/domain.md` | Project · Stakeholders · Entities · BR · **Decisions · Risks** (v0.6) | 전원 필수 |
| **2** | `.harness/architecture.yaml` | modules · tech_stack · host binding · contribution points · gate chain | Engineering · Quality · Integration · Audit |
| **3** | `.harness/_workspace/plan/plan.md` | ADR 원문 · RICE · Appetite · Open Questions | tech-writer · reviewer · orchestrator |

규약:
- `spec.yaml` 은 **누구도 직접 참조 금지** (SSoT 격리 · 링커 폭증 방지).
- Design stage (ux/visual/audio/a11y) 는 Tier 1 만 — 행동·시각·청각 설계에 집중.
- Engineering 은 Tier 1 + 2 — module 경계 · tech stack 인식.
- Docs (tech-writer) 는 Tier 1 + 3 — ADR 원문 "Why" 인용.
- Audit (reviewer) 만 전 Tier — drift 감사 역할이므로 제한 없음 (read-only 는 유지).

Cross-role empathy 는 **domain.md 의 Decisions/Risks 섹션**으로 달성 — visual-designer 도 `entities.sensitive=true` · `Decisions[tag=security]` 를 볼 수 있어 PII CTA 같은 사고 예방.

---

## 4 Ceremony — 실제 팀 Ritual 이식

v0.6 신규. `_workspace/` 에 파일로 누적되어 `grep` · `git` 으로 추적 가능.

| Ceremony | Trigger | Python | Orchestrator | 산출 |
|---|---|---|---|---|
| **Kickoff** | `/harness:work F-N activate` 직후 | `scripts/kickoff.py` (템플릿 · events.log `kickoff_started`) | routing-match agent 들에게 "80 단어 3 bullet 우려" fan-out | `_workspace/kickoff/F-N.md` |
| **Design Review** | ux-architect `flows.md` 저장 후 | `scripts/design_review.py` (3~4 reviewer 템플릿) | visual · frontend · a11y (+audio) 병렬 리뷰 수집 | `_workspace/design-review/F-N.md` |
| **Q&A (file-drop)** | 에이전트가 불명확 발견 | `scripts/inbox.py` (polling) | `questions/F-N--<from>--<to>.md` Answer 섹션 append | `_workspace/questions/` |
| **Retrospective** | `/harness:work F-N --complete` 직후 | `scripts/retro.py` (events.log 분석 · What Shipped · First Gate to Fail 자동 채움) | reviewer draft prose → orchestrator write · tech-writer polish | `_workspace/retro/F-N.md` |

**원칙**: Python 은 **템플릿 + `events.log` append** 만. LLM fan-out · 파일 write 는 orchestrator 책임. Claude Code 의 subagent @-mention 과 정합.

**v0.6.1 fix**: 모든 신규 emitter 가 canonical key `"feature": "F-N"` (not "feature_id") + type `feature_done` (not "feature_completed") 를 따름 — work.py 규약과 통일. drift test 로 강제.

---

## plan.md → spec.yaml 변환 (Mode B-2)

plan.md 가 이미 있으면 대부분 자동화:

- 4-stage 파이프라인: **정찰** (BM25 통계) → **저작** (24 원칙 + 5 도메인 어댑터) → **gap** (unrepresentable 카탈로그) → **backlink** (source_ref 매트릭스).
- 8 golden 샘플 + 회귀 러너 (recall 0.991 · precision 0.861).
- 어댑터: `saas` · `game` · `worker` · `library` · `meta`.
- **v0.6 H-10~H-13**: plan.md 의 `## Trade-off ADRs` → `spec.decisions[]` · `## Risks` → `spec.risks[]` · performance budget 언급 → `features[].performance_budget` · ADR supersedes 언급 → `supersedes[]` + reverse.

plan.md 없으면 `/harness:spec` 만 호출해 대화형 (Mode B-1) · 한 줄 아이디어면 researcher 체인 (B-1-vague).

참조: [`skills/spec-conversion/SKILL.md`](skills/spec-conversion/SKILL.md) · [`tests/regression/conversion-goldens/`](tests/regression/conversion-goldens/) · [`docs/samples/harness-boot-self/`](docs/samples/harness-boot-self/).

---

## 하네스 엔지니어링 — 8 기둥

harness = LLM 개발에 걸어놓는 **규율 구조**.

1. **사고의 글 vs 실행의 글** — 🗒 vs 🔒 를 필드 성격으로 분리. 스키마가 경계 강제.
2. **Single Source of Truth** — `.harness/` 에만 원천. `.claude/` 는 어댑터. 파생 파일은 뷰.
3. **Schema-First** — JSONSchema 2020-12 검증. 실행의 글 모든 필드 스키마 보유.
4. **User-Minimal Input** — 사용자 직접 편집 파일은 `spec.yaml` **하나**.
5. **Derive-first · Edit-wins** — 파생 원칙. 드문 사용자 수정은 해시 감지로 덮어쓰기 금지.
6. **Runtime-Verified First** — `features[0].type="skeleton"` + Gate 5 runtime smoke + integrator agent 로 "켜지는 코드" 강제.
7. **Transparency-by-Preamble** — 모든 명령이 stdout 3 줄 preamble + 2 줄 anti-rationalization (BR-014).
8. **Standard-First** — Claude Code 규약 위치 (`.claude/agents/` · `.claude/skills/`) 존중.

### 구현 보충 (v0.6.1 기준)

- **Canonical Hashing** ✅ — Canonical YAML → JSON → SHA-256 Merkle. 주석·공백 무시. subtree + root 19 tests.
- **CQS** ✅ — 진단 명령은 파일 읽기만 · mtime 불변 테스트.
- **Append-only events.log** ✅ — JSONL · canonical key `"feature": "F-N"` · 전 emitter 통일.
- **BR-004 Iron Law** ✅ — `gate_5=pass + evidence≥1` 없는 `done` 거부.
- **Hook fail-open** 🛠 — `hooks/` 인프라 v0.4 ship, session-bootstrap 외 5 개 템플릿은 opt-in.
- **Self-hostable** ✅ — `docs/samples/harness-boot-self/spec.yaml` + `scripts/self_check.sh` 5-step 자가 검증.

---

## 상태 · 버전

| 릴리즈 | 핵심 |
|---|---|
| v0.3.x | 8 slash commands · 8 drift · gate 0~5 auto · self-describe round trip |
| v0.4.0 | `agents/` · `hooks/` 인프라 · 3 core agents (orchestrator · implementer · reviewer) |
| v0.5.0 | **14 agent Expert Portfolio** · BREAKING `implementer` → `software-engineer` · Orchestration Routing 표 |
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
├── agents/                  # 16 md + README (3 core + 13 expert · Tier 선언)
├── commands/                # 8 slash commands
├── scripts/                 # Python
│   ├── sync.py · work.py · check.py · events.py · metrics.py
│   ├── render_domain.py · render_architecture.py
│   ├── canonical_hash.py · include_expander.py · gate_runner.py
│   ├── spec_mode_classifier.py · validate_spec.py · plugin_root.py · state.py
│   ├── mode_b_*.py          # plan.md 통계 추출
│   └── kickoff.py · inbox.py · design_review.py · retro.py   # v0.6 ceremony
├── skills/spec-conversion/  # Mode B-2 변환 skill (v0.5 + H-10~H-13 v0.6)
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
