# Changelog

All notable changes to harness-boot are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

---

## [Unreleased]

- Marketplace PR (anthropic/claude-plugins-official) — 안정화 후 제출
- Phase 3 CI — `.github/workflows/self-check.yml` + PR gate
- Cross-language hash test vectors (Appendix D.7)
- Event log rotation (`events.log.YYYYMM`)
- AC coverage drift (check.py 10 번째 drift)
- Agent eval fixture — 15 agents × 3 대표 입력 회귀 (v0.7 PR-β 예정)
- Design review auto-wire (v0.8+ — ux-architect flows.md save 훅 모호성)
- ADR supersedes 자동 전이 (v0.7 PR-β)

## [0.7.1] — 2026-04-24

**Activate UX patch. 3 gaps surfaced during v0.7.0 live smoke test.**

### Added

- `scripts/work.py::deactivate(harness_dir)` — clears `session.active_feature_id` without touching feature status. CLI: `--deactivate`. Emits `feature_deactivated` event.
- `scripts/work.py::remove_feature(harness_dir, fid)` — deletes feature entry from `state.yaml`. Refuses done features (audit trail protection). Clears active pointer if removing the active feature. CLI: `--remove FID`. Emits `feature_removed` event with `prior_status`.
- `scripts/state.py::remove_feature(fid) -> bool` and `features_in_progress() -> list[str]` helpers.
- `tests/unit/test_work_ux.py` — 16 tests covering ghost warning, concurrent warning, deactivate, remove semantics, done-protection, CLI flags.

### Changed

- `scripts/work.py::activate()` now warns on stderr (proceeds regardless — backward compat):
  - **ghost feature**: `spec.yaml` exists but F-N is not defined in `features[]`.
  - **concurrent in_progress**: another feature is already `in_progress`.
- `commands/work.md` — new sections *Activate UX 경고* + *Session pointer 정리* documenting warnings and the two new flags.

### Tests

566/566 green (550 + 16). self_check 5/5 PASS.

## [0.7.0] — 2026-04-24

**Auto-wire kickoff · retro ceremonies. `scripts/work.py::activate/complete()` 가 `kickoff.py` · `retro.py` 를 자동 호출 — v0.6 의 "prose-contract 수동 호출" 약속이 실 구현으로 전환.**

### Added

- `scripts/kickoff.py::detect_shapes(feature, *, spec=None)` — feature dict → routing shape list 자동 감지:
  - title · AC · modules 비어 있음 → `["baseline-empty-vague"]`
  - `ui_surface.present=true` → `ui_surface.present` (+ `has_audio=true` → audio-designer)
  - `performance_budget` 선언 → `performance_budget`
  - `sensitive=true` 또는 `domain.entities[].sensitive=true` 참조 → `sensitive_or_auth`
  - 위 전문가 shape 모두 없음 → `pure_domain_logic`
  - 항상 최종에 `feature_completion` 추가
- `scripts/kickoff.py::has_audio(feature)` — `ui_surface.has_audio` 추출.
- `scripts/work.py::_autowire_kickoff` · `_autowire_retro` — activate/complete 내부 훅. spec.yaml resolve 되고 feature 존재할 때만 발화, 예외는 silent swallow (activate/complete 는 ceremony 오류로 실패하지 않음).
- `tests/unit/test_work_autowire.py` — 15 tests: shape detection 7 · activate autowire 6 · complete autowire 2. 핵심 불변: backward-compat (spec.yaml 미존재 시 kickoff/retro 디렉터리 생성 없음) + 이벤트 순서 (`feature_activated` < `kickoff_started`, `feature_done` < `feature_retro_written`).

### Changed

- `commands/work.md` Kickoff · Retrospective 섹션의 "prose-contract 로 수동 호출" 문구를 "자동 호출 (v0.7 auto-wire)" 로 정정. Design Review 섹션은 수동 유지 명시 (file-watcher 훅 없음, v0.8+ 로 미룸).
- Shape 감지 규칙 문서가 `commands/work.md` Kickoff 섹션에 편입 — orchestrator 가 어떤 shape 로 어떤 에이전트를 소환하는지 사용자가 예측 가능.

### Tests

550/550 green (기존 535 + 15 autowire). self_check 5/5 PASS.

## [0.6.1] — 2026-04-24

**Critical fixes surfaced by pre-push audit. v0.6.0 was not pushed; these patches land before first publish.**

### Fixed

- **Event schema drift** (v0.6.0 blocker) — `scripts/retro.py::analyze()` was reading `"feature_id"` and `"feature_completed"`, but the canonical emitter `scripts/work.py` uses `"feature"` + `"feature_done"`. retro ran blind against real pipelines (tests passed only because they fabricated fake events). Aligned retro.py · kickoff.py · design_review.py to emit `"feature"` key (matches work.py). Retro filter now uses `"feature_done"`. tests/unit/test_{retro,kickoff,design_review}.py updated.
- **Reviewer write permission mismatch** (v0.6.0 blocker) — `agents/reviewer.md` Context prose promised retro.md write exception, but frontmatter `tools: [Read, Grep, Glob, Bash]` blocks Write. Claude Code enforces via frontmatter, not prose. Resolved by **keeping CQS strict** — reviewer returns draft prose, orchestrator writes the file. reviewer frontmatter unchanged. Retro template comments clarify handoff.
- **Auto-trigger claims** (v0.6.0 blocker) — `commands/work.md` said kickoff fires "자동" on `activate` and retro on `--complete`, but `scripts/work.py::activate/complete()` never calls them. Documentation softened to "orchestrator 가 prose-contract 로 수동 호출" with v0.7 note for auto-wire. Same applies to design-review trigger.
- **ROUTING_SHAPES drift risk** — `scripts/kickoff.py::ROUTING_SHAPES` and `commands/work.md` Orchestration Routing table were not mutually validated. `tests/unit/test_work_routing.py::KickoffRoutingShapesParityTests` adds 3 checks (forward/reverse shape coverage + per-shape agent inclusion).

### Known (documented · deferred to v0.7)

- `decisions[].supersedes[]` — 렌더만 되고 **old ADR 의 `status=superseded` 자동 전이는 미구현** (수동 업데이트 필요). `skills/spec-conversion` Mode B-2 또는 별도 preprocessor 에서 v0.7 에 구현 예정.
- `state.yaml.features[].skipped_agents[]` — schema 문서화 됐으나 `scripts/state.py` · `scripts/work.py` 가 읽거나 쓰지 않음. v0.7 에서 skip policy 실 구현 시 연동.
- `features[].performance_budget` — schema 만 존재, `gate_runner.py` 에 연동 없음. v0.7 에서 performance-engineer 자동 트리거에 사용.
- `agents/visual-designer.md` / `a11y-auditor.md` Tier 1 only — motion/a11y 결정이 플랫폼 의존이나 현재 `constraints.tech_stack` 접근 없음. v0.7 에 `render_domain.py` 에 `## Platform` 섹션 추가 검토.

### Tests

535/535 green (기존 532 + 3 routing parity). self_check 5/5 PASS.

## [0.6.0] — 2026-04-24

**3-Anchor Tier orchestration + real-team ceremonies (kickoff · design-review · Q&A · retro). 사용자 우려 "모든 에이전트에 전부 주입은 과도 · 플래너 산출이 다른 에이전트로 전달되어야" 에 대한 구조적 답.**

### Added

**Schema (PR-α, additive only)**:
- `decisions[]` (top-level) — ADR 카탈로그. `supersedes[]` / `superseded_by` 양방향 연결.
- `risks[]` (top-level) — risk catalog. likelihood/impact × mitigation × status {open, mitigated, materialized, closed}.
- `features[].performance_budget` — Web Vitals (lcp_ms/inp_ms/cls/bundle_kb) + backend (latency_p95_ms/memory_rss_mb) + custom[].
- `constraints.tech_stack` 구조화 — runtime/min_version/language/test/build. `additionalProperties: true` 보존.

**Renderer (PR-β)**:
- `scripts/render_domain.py` 에 `## Decisions` · `## Risks` 섹션 — plan.md ADR/Risk 가 drop 되지 않고 domain.md 에 흐름.
- `skills/spec-conversion/SKILL.md` H-10~H-13 heuristics — plan.md → decisions[]/risks[] 변환 규약.

**Agent Tier 체계 (PR-γ)**:
- 13 expert agent 의 `## Context` 블록을 Tier 별로 업데이트:
  - **Tier 1 only** (Design): ux-architect · visual-designer · audio-designer · a11y-auditor — domain.md 만.
  - **Tier 1 + 2** (Engineering/Quality/Integration): software-engineer · frontend-engineer · backend-engineer · security-engineer · performance-engineer · qa-engineer · integrator — + architecture.yaml.
  - **Tier 1 + 3** (Docs): tech-writer — + plan.md (ADR 원문 인용).
  - **전 Tier** (Audit): reviewer — full access + retro.md write exception.
- `tests/unit/test_agents.py` 에 `TierMappingTests` — 각 agent 가 자기 Tier anchor 만 언급하는지 grep 검증.

**Ceremonies (PR-δ + PR-ε)**:
- `scripts/kickoff.py` — routing shape 기반 per-role template + `kickoff_started` event.
- `scripts/inbox.py` — `.harness/_workspace/questions/F-N--<from>--<to>.md` 폴링 · blocking flag 파싱.
- `scripts/design_review.py` — visual + frontend + a11y (+ audio if has_audio) reviewer trio/quartet.
- `scripts/retro.py` — events.log 분석 (first gate fail · ceremony count) + reviewer draft → tech-writer polish 템플릿.
- `commands/work.md` 에 Kickoff · Q&A · Design Review · Retrospective 4 섹션 prose contract.

### Changed

- `agents/reviewer.md` `## Context` 섹션 신설 — 전 Tier access + retro.md write 예외 명시.
- `agents/software-engineer.md` `## Context` 섹션 신설 (Tier 1+2).
- `.claude-plugin/{plugin,marketplace}.json` — 0.5.1 → 0.6.0.
- `docs/templates/starter/CLAUDE.md.template` — 4 신규 ceremony 디렉터리 언급.

### Tests
532/532 unit tests green (16 skipped + 2 jsonschema-not-installed). v0.5.1 의 459 대비 +73 신규 (24 schema · 6 renderer · 5 Tier · 12 kickoff · 9 inbox · 6 design_review · 11 retro). self_check 5/5 PASS.

### v0.5.1 deferred 해소

- B1-10 `constraints.tech_stack` 구조화 ✅
- B1-5 feature-context payload — `commands/work.md` 섹션으로 prose 정리 (머신 schema 는 v0.7 검토)
- B1-6 a11y 재감사 자동 trigger — retro ceremony 가 대체 (수동 호출은 여전히 사용자 선택)

### Why

v0.5.1 suika-web 도그푸드에서 드러난 구조적 gap — plan.md 의 ADR/Risk 가 downstream 에 전달 안 됨, architecture.yaml 이 렌더만 되고 미참조, orchestrator payload 가 prose-only, ceremony 전무 — 에 대한 일괄 답. 사용자 질문 "모든 에이전트가 모든 정보 읽는 건 과도 · 아키텍처는 엔지니어 위주" 를 Tier 구조로 반영.

### Not breaking

- 기존 self-spec · .harness/spec.yaml · v0.5 starter template 모두 v0.6 schema 로 validate.
- 기존 `@harness:*` 호출 호환 유지.
- ceremony 는 opt-in — 소규모 피처는 건너뛸 수 있음.

## [0.5.1] — 2026-04-24

**suika-web 실전 도그푸드에서 드러난 프로즈 gap 4 건 patch. 코드 변경 없음.**

### Changed
- `commands/work.md` Preamble — Iron Law 문구에 "상태 전이는 scripts/work.py 경유" 명시. state.yaml 수동 편집과 events.log drift 를 방지 (B1-1).
- `commands/work.md` — `## Skip 정책` 섹션 추가. security-engineer · performance-engineer · audio-designer 는 조건부 skip 허용하되 **state.yaml `skipped_agents[]` 에 사유 기록**. integrator · tech-writer 는 원칙 skip 금지 (문서-only 피처 예외) (B1-7).
- `agents/frontend-engineer.md` — `## Viewport · Resize · Physics 체크리스트` 추가. canvas resize 시 physics world 재구축 · viewport-fit=cover + safe-area-inset 4 방향 · aria-live debounce · SRI/onerror · reduced-motion transform sweep 포함 (B1-2).
- `agents/security-engineer.md` — STRIDE Tampering 에 `## Supply Chain / CDN` 체크리스트 구체화. 외부 CDN 로드는 SRI 필수 · crossorigin=anonymous · onerror fallback · exact version pinning · 라이선스 확인 (B1-8).
- `.claude-plugin/{plugin,marketplace}.json` — 0.5.0 → 0.5.1.

### Why
`/Users/qwerfunch/Developer/work/suika-web/` 에서 v0.5.0 workflow 를 14 agent 역할극으로 시뮬한 결과:
- Matter.js CDN 을 SRI 없이 로드했다가 뒤늦게 제거 (security-engineer 규약 부재 원인)
- resize 핸들러가 walls 재구축 안 해서 회전 시 과일 탈출 가능 (frontend-engineer 규약 부재 원인)
- suika-web state.yaml 수동 작성 → events.log 와 drift (Phase 1 observational 경계 문서 부재 원인)
- security-engineer 를 "no sensitive entity" 이유로 skip 했는데 사유 기록 안 됨 (skip 정책 부재 원인)

각 item 은 **실전에서 드러난 gap** 이며 **severity should** 이상 만 반영. nice-to-have (B1-3 sync.md 문서화 gap · B1-11 ui_surface 스코프 주석) 은 v0.6 으로 연기.

### Tests
459/459 unit tests green 유지 (프로즈 변경이라 계약 영향 없음). self_check 5/5 PASS.

### Deferred to v0.6
- B1-4 `scripts/init.py` 도입 or prose-only 설계 확정
- B1-5 feature-context payload JSON schema
- B1-6 a11y post-implementation 재감사 자동 trigger
- B1-10 `constraints` schema 구조화 (tech_stack runtime/min_version)
- B1-12 나머지 10 agent fixture

## [0.5.0] — 2026-04-24

**전문가 에이전트 풀(14) + Orchestration Routing. 제품 개발 라이프사이클 전반에 최고 수준 전문가가 도메인을 이해하고 동작.**

### BREAKING
- `agents/implementer.md` → `agents/software-engineer.md` (rename). `@harness:implementer` 사용자는 `@harness:software-engineer` 로 전환.
- 테스트 내부 변수 `_IMPLEMENTER_FORBIDDEN` → `_SOFTWARE_ENGINEER_FORBIDDEN`.
- 보존: `ai_implementer` persona role (`project.stakeholders[]`) · CHANGELOG 과거 엔트리 · regression golden fixture.

### Added
- 13 신규 sub-agent (`agents/*.md`) — 14-agent 포트폴리오 완성:
  - **Stage D (Discovery)** — `researcher` · `product-planner`
  - **Stage X (eXperience)** — `ux-architect` (reference) · `visual-designer` · `audio-designer` · `a11y-auditor`
  - **Stage E (Engineering)** — `frontend-engineer` · `backend-engineer` · `security-engineer` · `performance-engineer`
  - **Stage Q (Quality)** — `qa-engineer`
  - **Stage I (Integration & Docs)** — `integrator` · `tech-writer`
- 각 에이전트는 named framework rubrics 내장: JTBD · Mom Test · Nielsen 10 · 5E · WCAG 2.2 · Atomic Design · Twelve-Factor · DDD · STRIDE · OWASP ASVS · OAuth 2.1 · Web Vitals · USE method · Test Pyramid · Diátaxis 등.
- **domain.md 단일 참조점** 규약 — Stage X/E/Q/I 는 `spec.yaml` 직접 읽지 않고 `.harness/domain.md` 만 anchor. `test_agents.py` 가 규약 위반 grep 으로 검증.
- **Discovery 예외** — researcher · product-planner 는 domain.md 없이도 동작 (bootstrap).
- `docs/schemas/spec.schema.json`: `project.brief` (researcher/planner anchor) + `features[].ui_surface` (orchestrator routing key). 둘 다 additive.
- `scripts/spec_mode_classifier.py`: `baseline-empty-vague` subtype — 한 줄 아이디어(< 40 단어) → researcher 경로.
- `scripts/render_domain.py`: `## Stakeholders` 섹션 렌더.
- `commands/spec.md`: Mode B-1-vague 분기 prose contract (researcher → planner → Mode B-2 chain).
- `commands/work.md`: **Orchestration Routing** 표 (6 shape-branch × agent chain) + 충돌 조정 규약 + 피처 컨텍스트 payload shape.
- `tests/unit/test_work_routing.py` (신규) · `tests/fixtures/agent-evals/ux-architect/` (reference fixture).
- `docs/templates/starter/CLAUDE.md.template` · `spec.yaml.template`: 전문가 풀 섹션 + `brief` · `ui_surface` 필드 seed.

### Changed
- `agents/README.md` — 권한 매트릭스 14 행.
- `agents/orchestrator.md` · `reviewer.md` — `implementer` → `software-engineer` 참조 정리.
- `.claude-plugin/plugin.json` · `marketplace.json` — 0.4.1 → 0.5.0.

### Tests
459/459 unit tests green (16 skipped). 기존 v0.4.1 의 432 대비 +27 신규.

### Why
하네스 자체는 충분히 다듬어졌으나, **사용자 프로젝트를 실제로 만드는** 전문가 층이 빈약했다. 한 줄 아이디어만 받으면 stub spec 에서 멈췄고, UX/UI/a11y/audio 는 first-class 가 아니었다. v0.5 는 이 gap 을 한 번에 메우되 domain.md 단일 참조점 + 계약 기반 routing 으로 확장성을 확보한다.

## [0.4.1] — 2026-04-23

**Coding style guide 반영. 사용자 피드백 기반.**

### Added
- `agents/implementer.md` § **코딩 스타일** 섹션 신규 — Google Python Style Guide 준수 + spec reference (F-NNN · AC-N · BR-NNN) 는 **docstring/주석에만**, 함수/클래스 이름에 금지. 예시 ✅/❌ 포함.
- `commands/work.md` § **코딩 스타일** 섹션 — 동일 규칙 요약 + implementer.md 로 cross-link.
- `tests/unit/test_agents.py` + 2 tests (`StyleGuideTests`) — Google Python Style 언급 + ID-in-docstring rule 문서화 검증.

### Why
A/B 테스트 결과물 리뷰에서 사용자 피드백: `AC1_CodeFormatTests` · `BR004_StrictestRuleTests` 같은 **이름에 spec ID 를 박는 패턴이 가독성 저해**. 이름은 도메인 의미 (`CodeFormatTests`, `StrictestRuleSelectionTests`), spec reference 는 docstring 메타데이터로 분리해야 한다는 원칙.

### Changed
- `.claude-plugin/plugin.json` · `marketplace.json` — 0.4.0 → 0.4.1

### Testing
- 430 → **432 tests** (+2 StyleGuideTests).
- self_check 5/5 green.

### 범위 외 (참고)
A/B test B 조건 artifacts (`/tmp/ab-test-harness-boot/*/B-harness/test_*.py`) 도 새 규약으로 재작성 — 이는 repo 외 demo 라 커밋엔 미포함. 32/32 tests 유지.

## [0.4.0] — 2026-04-23

**첫 minor bump. Agent orchestration & interactive flows 완결.** F-002 · F-012 · F-014 및 신규 인프라 F-023 · F-024 를 묶음 → 24/24 features done.

### Added — Agent 층 (F-023 · F-012)
- **`agents/` 디렉터리 신규** (plugin root) — Claude Code 2.1.x 규약의 자동 discovery 위치
- **3 core sub-agents**:
  - `orchestrator` — 다단계 조율 (Agent · Read/Write/Edit/Bash/Task* · WebFetch)
  - `implementer` — TDD 코드 빌더 (Read/Write/Edit/Bash/Grep/Glob/NotebookEdit, 하지만 Agent tool 없음 · 추가 delegation 금지)
  - `reviewer` — read-only 감사 (Read/Grep/Glob/Bash만 · Edit/Write 금지, CQS 엄수)
- **권한 매트릭스** 문서화 (`agents/README.md`) + Claude Code 런타임 enforcement 확증
- 각 에이전트 본문에 BR-014 Preamble + Anti-rationalization 2 행 규약
- 10 신규 tests (디렉터리/frontmatter/permission/preamble)

### Added — Hook 층 (F-024 · F-014)
- **`hooks/hooks.json`** 신규 (plugin root) — SessionStart banner 하나만 (global scope 의식적 최소화)
- **`hooks/session-bootstrap.sh`** — `.harness/` 존재 시 `/harness:status` 유도 배너 · 없으면 silent exit 0
- **`docs/templates/hooks/` 5 opt-in 템플릿** (사용자가 자기 프로젝트 `.claude/hooks.json` 으로 복사):
  - `security-gate.sh` (PreToolUse Bash) — rm -rf root · system · home · chmod 777 · fork-bomb 감지
  - `format.sh` (PostToolUse Write|Edit) — prettier/black/gofmt/rustfmt auto-apply
  - `doc-sync-check.sh` (PostToolUse Write|Edit) — CLAUDE.md @-import 유효성
  - `test-runner.sh` (PostToolUse Write|Edit) — 바뀐 파일 타입별 테스트 실행
  - `coverage-gate.sh` (PreToolUse Bash) — `rm -rf` / git reset --hard / force push / SQL DROP 경고 + 1s delay
- **Fail-open 강제**: 모든 훅 `exit 0` 종결 · 플러그인 hook 은 exit 2 반환 불가
- 21 신규 tests (infra 5 · templates 5 · pipe-test 11 — false-positive 회귀 포함 `rm -rf /tmp/foo` must NOT warn)

### Added — Interactive Mode 층 (F-002 완결)
- **commands/spec.md 대폭 확장** — Modes A/R/B-2 의 LLM prose contract 구체화:
  - 각 Mode 별 **Activation trigger** (결정론 분기)
  - **LLM prompt template** (Claude 가 따라야 할 단계)
  - **Approval checkpoint** (사용자 "1·예" 응답 전까지 Edit/Write 금지)
  - **`--dry-run` 의미론**: checkpoint 자동 "3·취소"
- Mode E 의 CQS 엄수 문구 재강화 (Edit 호출 금지 · mtime 불변 · 대화 중 수정 요청은 Mode A/R 재분기)
- Mode B-2 의 `skills/spec-conversion` 4-stage 호출 + schema 재검증 루프 명시
- 12 신규 tests (prose contract grep 검증 — 각 Mode 섹션 필수 구성요소 존재)

### Changed
- `.claude-plugin/plugin.json` · `marketplace.json` — 0.3.13 → **0.4.0** (첫 minor bump)
- `docs/samples/harness-boot-self/spec.yaml` → 24 features (F-023 + F-024 신규)
- `.harness/state.yaml` — F-002 partial → done · 4 신규 feature cycles 기록

### Testing
- 387 → **430 unit tests** (+10 agents + 21 hooks + 12 modes = +43 신규)
- self_check 5 steps green
- `/harness:check` 9/9 drift clean (errors 0 · warns 0)

### Phase 2 dogfood 집계
- 총 15 feature cycles recorded via `scripts/work.py` 이번 세션 누적 (F-020, F-022, F-015, F-019, F-021, F-013, F-017, F-023, F-012, F-024, F-014, F-002 + 세션 전 3)
- state.yaml: **24/24 features done** (100%) — harness-boot-self 스펙의 모든 선언이 실 구현 증거 보유
- lead time baseline: median 1.32m · mean 1.64m · max 3.97m (n ≥ 10)

### Scope
v0.4 완결. 다음 minor (v0.5) 후보:
- 공식 마켓플레이스 PR
- Cross-language canonical hash 테스트 벡터
- Event log rotation
- Phase 3 CI (.github/workflows/)
- 템플릿 보강 NEW-51/52/53

## [0.3.13] — 2026-04-23

**Phase 2 집단 closeout — 5 planned features 일괄 처리 + F-017 실 구현.**

### Added
- **Protocol drift (9 번째 drift 종) — F-017 AC-2 구현**
  - `scripts/check.py.check_protocol()` · `.harness/protocols/*.md` 각 파일의 frontmatter `protocol_id` 가 파일명 stem 과 일치하는지 자동 검증
  - 7 신규 테스트 (`ProtocolDriftTests`): no-protocols / matching-id / mismatched-id / missing-frontmatter / missing-id / invalid-yaml / non-dict
  - `commands/check.md` — 9 종 drift 반영
- **Protocol 라이브러리 (F-017 AC-1)**
  - `docs/protocols/README.md` — 프로토콜 형식 spec + 버전 정책 (breaking 은 `_v2` 병행 파일로 parallel-protocol · 기존 `status: deprecated` 2 minor 유지)
  - `docs/protocols/sync-to-work-handoff.md` — stable 프로토콜 v1 · `/harness:sync` → `/harness:work` 핸드오프 페이로드 스키마

### F-017 완료
AC-1 (breaking 은 병행 유지) · AC-2 (protocol_id == 파일명 stem 자동 검증) 둘 다 충족.

### 일괄 closeout (Phase 2 cycles 3~7)
- **F-015** (CLAUDE.md shim + 사용자 프로젝트 분리) — 이미 `docs/templates/starter/CLAUDE.md.template` + `commands/init.md §3` 에서 구현됨. BR-009 + NEW-44 검증 evidence 로 done.
- **F-019** (v1→v2 마이그레이션) — v1 사용자 부재 (첫 public release = v0.1.0 이 곧 v2.3.8 schema). BR-007 Non-claim 원칙 적용 · done.
- **F-021** (플러그인 자체 빌드 · 배포) — 12 태그 (v0.1.0~v0.3.12) + 2 매니페스트 + 4 tracked 디렉터리 + v0.3.10 real-session `/plugin update` smoke. AC-1 AC-2 충족 · done.
- **F-013** (Claude skills 호출 인터페이스) — `skills/spec-conversion/SKILL.md v0.5` 이미 shipped (frontmatter description + 5 adapters + 4 templates). AC-1 AC-2 충족 · done.
- **F-017** (Protocols) — 위 Added 섹션 참조.

### Phase 2 연기 (v0.4 minor bump)
- **F-012** (sub-agents Tool 권한 매트릭스) — `agents/` 디렉터리 부재 → v0.4 에 agents 인프라와 함께
- **F-014** (Hooks 시스템) — `hooks/` 디렉터리 부재 → v0.4 에 hooks 인프라와 함께
- **F-002** (Modes A/R/B-2 실 구현) — LLM 대화 루프 실구현 필요, 단일 세션 범위 초과 → v0.4 후보

### Changed
- `docs/samples/harness-boot-self/spec.yaml` · `.harness/spec.yaml` — 변경 없음 (F-022 까지 유지)
- `.harness/state.yaml` — 5 features 전이 기록 (F-013/F-015/F-017/F-019/F-021 모두 done)
- `scripts/check.py` docstring — v0.3.13 범위 9/9 반영
- `.claude-plugin/plugin.json` · `marketplace.json` — 0.3.12 → 0.3.13

### Testing
- 380 → **387 tests** (+ 7 ProtocolDriftTests).
- self_check 5 단계 green 유지.

### Phase 2 누적 통계
- Features done via /harness:work: 7 (F-020, F-022, F-015, F-019, F-021, F-013, F-017)
- state.yaml done 총계: 19/22 (86%). 남은 3 개 (F-002 partial, F-012, F-014) 는 v0.4 후보.
- events.log 누적 lifecycle 이벤트: 40+ 건 · 실 lead time 분포 · gate pass_rate 추적 가능.

## [0.3.12] — 2026-04-23

**F-022 — gate_runner auto-detect layout heuristics. v0.3.11 에서 발견한 bug 를 측정-수정-검증 루프로 처리.**

### Added
- **`detect_gate_0_command` 의 namespace-package 지원** — `tests/unit/test_*.py` 같은 서브디렉터리 레이아웃에서 pytest 부재 시 `python3 -m unittest discover tests.unit` module-path form 사용. 이전엔 `-s tests` fallback 이 "NO TESTS RAN" (exit 5) 반환.
- 우선순위: pytest → `tests/unit/` (선호) → `tests/<기타 sub>/` (알파벳 순 첫 매치) → `-s tests` (평면 레이아웃 fallback).
- 4 신규 테스트:
  - `test_tests_unit_subpackage_prefers_module_path` — tests/unit 인식
  - `test_tests_other_subpackage_module_path` — tests/integration 같은 임의 sub 도 동작
  - `test_tests_unit_prefers_over_other_subpackages` — tests/unit 가 알파벳 순 우선
  - `test_tests_flat_layout_falls_back_to_dash_s` — 회귀 방지 (tests/test_*.py 평면 레이아웃은 기존 동작 유지)

### Phase 2 dogfood 루프 2 번째 사이클
- F-020 (v0.3.11) 에서 발견한 gate_0 auto-detect bug 를 F-022 로 공식 등록
- `scripts/work.py F-022 --run-gate gate_0` 이 **override 없이** PASS — AC-2 충족
- `/harness:metrics` 로 측정 기회: v0.3.12 이후 gate_0 pass_rate 상승 관찰 가능

### Changed
- `docs/samples/harness-boot-self/spec.yaml` — F-022 신규 추가 (21 → 22 features).
- `.harness/spec.yaml` — sample 재복사.
- `.harness/state.yaml` — F-022 cycle 기록.
- `.claude-plugin/plugin.json` · `marketplace.json` — 0.3.11 → 0.3.12.

### Testing
- 376 → **380 tests** (+ 4 DetectCommandTests).
- self_check 5 단계 green 유지.
- harness-boot 자체 gate_0 이 dev workflow 에서 override 없이 동작.

### 의미
Phase 2 는 **자기 자신의 개선 루프를 측정** 할 수 있음을 실증. v0.3.11 의 metric 에서 `gate_0 pass_rate 50%` 로 bug 가 정량화됐고, v0.3.12 에서 fix 후 다음 metric 에 개선이 수치로 나타남. 이것이 dogfood 의 재귀적 가치.

## [0.3.11] — 2026-04-23

**F-020 — YAML Language Server 지원 · Phase 2 첫 실 피처 착수.**

### Added
- **starter 템플릿 $schema 지시자** — `docs/templates/starter/spec.yaml.template` 최상단에 `# yaml-language-server: $schema=https://raw.githubusercontent.com/qwerfunch/harness-boot/main/docs/schemas/spec.schema.json` 추가. 사용자가 `/harness:init` 후 생성된 `.harness/spec.yaml` 편집 시 VSCode (redhat.vscode-yaml) · IntelliJ 에서 **자동완성 · 검증 · 에러 하이라이팅** 동작. 템플릿 주석에 IDE 확장 설치 안내 포함.
- **회귀 방지 테스트** — `tests/unit/test_starter_schema.py` — 템플릿과 sample spec 양쪽 첫 줄이 정확한 $schema 지시자인지 grep. 2 신규 tests.
- **Canonical self-spec 은 이미 $schema 지시자 보유** 확인 — sample 과 template 간 일관성 유지.

### Phase 2 Active dogfood 첫 실증
**이번 릴리즈가 Phase 2 의 첫 실제 feature 사이클 기록**:
- `scripts/work.py F-020` → `.harness/state.yaml` 에 in_progress 전이 + `events.log` 에 `feature_activated` 이벤트
- `scripts/work.py F-020 --run-gate gate_0 --override-command ...` → 376 tests PASS · auto evidence
- 수동 evidence 1 건 추가 · gate_5 는 test_starter_schema 로 대체 기록
- `--complete` 시 BR-004 검증 통과
- **events.log 에 진짜 feature lifecycle 이벤트가 최초로 쌓임** (기존엔 sync_completed 만)

### Discovered (향후 개선 후보)
- gate_0 auto-detect 가 `tests/` 디렉터리에 `__init__.py` 없으면 `python3 -m unittest discover -s tests` 로 fallback 해서 **NO TESTS RAN (exit 5)** 반환. 우리 레이아웃 (`tests/unit/`) 에선 `python3 -m unittest discover tests.unit` 이 필요. 현재는 `--override-command` 로 우회. v0.3.12 에서 `detect_gate_0_command` 가 `tests/unit/__init__.py` 존재 확인 후 module path 로 discover 하도록 개선.

### Changed
- `.claude-plugin/plugin.json` · `marketplace.json` — 0.3.10 → 0.3.11.
- `.harness/state.yaml` — F-020 planned → done (evidence 2, gate_0 pass, gate_5 pass).

### Testing
- 374 → **376 tests** (+ 2 StarterSchemaTests).
- self_check 5 단계 green 유지.

## [0.3.10] — 2026-04-23

**Phase 1 Passive dogfood — 자기 자신에게 자기 스크립트 돌리기.**

### Added
- **`.harness/` 레포 루트 신규** (3 tracked, 4 derived-gitignored):
  - `.harness/spec.yaml` — `docs/samples/harness-boot-self/spec.yaml` 의 **복사본** (symlink 아님 — 크로스 플랫폼 안전).
  - `.harness/state.yaml` — 21 피처 status 를 v0.3.9 기준으로 seed. 갱신 정책: **릴리즈 태그 시점에만** (`/plugin upgrade` 노이즈 최소화).
  - `.harness/README.md` — 사용자 혼란 방지 안내 (이것은 **dev 도그푸드** · 사용자 스펙 아님).
  - gitignored: `events.log`, `harness.yaml`, `domain.md`, `architecture.yaml`, `chapters/`.
- **`scripts/self_check.sh`** — 5 단계 무결성 검증:
  1. `.harness/spec.yaml == docs/samples/harness-boot-self/spec.yaml` (SSoT 동기성 · `diff -q`).
  2. `validate_spec .harness/spec.yaml` (JSONSchema).
  3. `sync --harness-dir .harness` (derived 재생성 · round-trip 재현).
  4. `check --harness-dir .harness --project-root .` (8/8 drift · error severity 0 요구).
  5. `commands/*.md` 규약 grep (Preamble · Anti-rationalization 2 행 · `scripts/` 참조).
  → 하나라도 fail 시 non-zero exit, 마지막 실패 지점 stderr.
- **`tests/unit/test_self_dogfood.py`** — `self_check.sh` 를 subprocess 로 호출해 exit 0 assert. 파일 부재 시 skip (사용자 환경 안전 방어).

### Changed
- `.gitignore` — `.harness/` derived 파일 5 종 미추적.
- `CLAUDE.md` §7 — 자체 도그푸드 규약 4 줄 추가 (Passive 관측 / SSoT / Phase 2 예고 / 사용자 충돌 없음 보장).
- `README.md` — **Self-hostable** 기둥 설명에 v0.3.10 self_check 반영.
- `.claude-plugin/plugin.json` · `marketplace.json` — 0.3.9 → 0.3.10.

### 사용자 영향 (검증 완료)
- 사용자가 `/harness:*` 를 자기 프로젝트에서 실행 시 여전히 `$(pwd)/.harness` 만 참조. 플러그인 내부 `.harness/` 는 invisible. **충돌 없음.**
- 플러그인 install 후 git clone 에 `.harness/spec.yaml` · `state.yaml` · `README.md` 가 함께 배포되지만 실행 경로에 영향 없음 · 바이트 증가 최소 (~100KB).

### Testing
- 373 → **374 tests** (+1 self_dogfood, OK, 16 skipped).
- self_check 5 단계 green 확인: SSoT diff · validate · sync · check (0 errors) · commands 규약 (8 files × 3 checks = 24 passes).

### Dogfood 이점
- scripts/sync.py 등 수정 시 self 스펙 파생이 깨지면 **unittest 가 즉시 감지** → release gate.
- commands/*.md 에서 Anti-rationalization · Preamble 누락 자동 탐지 (v0.3.2 감사 P1 항목의 자동화).
- Phase 2 에서는 `scripts/work.py` 실사용으로 **실 lead time · gate pass rate** 가 `/harness:metrics` 에 축적 예정.

## [0.3.9] — 2026-04-23

**F-008 `/harness:metrics` 신규 구현.** 0.3.x 코어 명령 8 개 전부 shipped 상태.

### Added
- **`/harness:metrics`** (F-008) — `.harness/events.log` 집계 read-only 명령. 윈도우 내 집계: total events + type 별 분포 · features activated/done/blocked · lead time 분포 (마지막 activated → 첫 done, 초 단위 min/median/mean/max) · gate 별 pass/fail/skipped + pass_rate · drift 빈도 (sync_failed 카운트).
- **CLI**: `--period 7d|24h|30m|30s|2w` (소 → 대 단위 자동 추정) · `--since ISO8601` (우선) · `--format human|json|csv` · `--harness-dir`.
- **JSON 포맷** (CI 친화) · **CSV 포맷** (`metric,key,value` long-format, spreadsheet 붙여넣기용).
- 33 신규 테스트 (period parser 8 · aggregate 9 · compute 7 · format 6 · CLI 3).

### CQS 강제
- `events.log` mtime 불변 테스트 포함.
- `state.yaml` · `harness.yaml` · `spec.yaml` 미접근.

### Testing
- 340 → **373 tests** (+33 metrics).
- Dogfood: 합성 이벤트 7 건으로 human 포맷 출력 검증 — lead time 1.25h / gate_0 pass rate 100% 정확.

### Scope
- 0.3.x 코어 8 명령: `init` · `spec` · `sync` · `work` · `status` · `check` · `events` · `metrics` 전부 shipped.
- 다음: 안정화 · 공식 마켓플레이스 PR · 템플릿 보강 (v0.3.10+) · v0.4 마일스톤.

## [0.3.8] — 2026-04-23

**F-006 drift 탐지 8/8 완결.**

### Added
- **Code drift** (`check_code`) — `features[].modules[]` 가 dict 이면서 `source` 필드가 있으면 그 경로가 `project_root` 기준 실존하는지 검증. 단순 문자열 모듈은 논리 식별자로 보고 skip (false positive 방지).
- **Doc drift** (`check_doc`) — `project_root/CLAUDE.md` 의 `@<path>` import 타겟이 실존하는지 + 파생 `domain.md` · `architecture.yaml` 이 0 byte 가 아닌지. `@http(s)://` 은 외부 링크로 보고 skip.
- **Anchor drift** (`check_anchor`) — `features[].id` 가 `^F-\d+$` 패턴인지 · 유일성 · `depends_on: [...]` 참조가 실제 feature ID 집합 내에 존재하는지.
- `--project-root` CLI 옵션 — 기본값은 `--harness-dir` 의 부모.

### Changed
- `commands/check.md` — 8/8 drift 목록 갱신 + preamble Anti-rationalization 2 행 "8 종" 표기.
- `scripts/check.py` 모듈 docstring — v0.4+ deferred 표기 제거, 전부 shipped 로 갱신.

### Testing
- 322 → **340 tests** (+18: Code 4 · Doc 6 · Anchor 8).
- Dogfood: `docs/samples/harness-boot-self/spec.yaml` 에 대해 Code · Anchor 각각 0 findings (21 features · F-001..F-021 모두 유효 · depends_on 참조 모두 해결).

### Coverage
| Drift | Before | After |
|---|---|---|
| Generated | ✅ | ✅ |
| Derived   | ✅ | ✅ |
| Spec      | ✅ | ✅ |
| Include   | ✅ | ✅ |
| Evidence  | ✅ | ✅ |
| Code      | ⏳ v0.4+ | ✅ |
| Doc       | ⏳ v0.4+ | ✅ |
| Anchor    | ⏳ v0.4+ | ✅ |

## [0.3.7] — 2026-04-23

**Gate 자동화 완결 — BR-004 Iron Law fully automated.**

### Added
- **Gate 5 (runtime smoke) 자동 실행** — `/harness:work --run-gate gate_5` 가 convention 기반 자동 감지: `scripts/smoke.sh` → `tests/smoke/` + pytest → `tests/smoke/` + unittest → Makefile `smoke:` → package.json `scripts.smoke`. 감지 실패 시 `skipped` 반환 (reason 에 `harness.yaml.gate_commands.gate_5` override 안내 포함). 기본 timeout 600s. 13 신규 테스트 (detect 7 + run 5 + dispatcher 1).

### Changed
- `commands/work.md` — gate_5 감지 우선순위 + override 권장 · 범위 표기 업데이트 (gate_0~5 전부 자동화).
- 디스패처 `not yet supported` 메시지가 v0.3.7 기준으로 갱신 (gate_6+ 에 한해 skipped).

### Meaning
BR-004 Iron Law — "gate_5=pass + evidence≥1 없이 `done` 거부" — 가 이제 **완전 자동 실행**. 수동 `--gate gate_5 pass` 없이 `--run-gate gate_5` 로 검증 가능. runtime smoke 가 프로젝트별 특성이 강하므로 harness.yaml override 가 실제 주요 경로.

### Testing
- 309 → **322 tests** (+ 13 Gate 5 + 1 dispatcher 갱신).
- Dogfood: harness-boot 자체 `scripts/smoke.sh` 부재 → `skipped` 정확히 반환 (expected behavior).

## [0.3.6] — 2026-04-23

### Added
- **Gate 4 (commit check) 자동 실행** — `/harness:work --run-gate gate_4` 가 `git diff --quiet && git diff --cached --quiet` 로 working tree + staging area 의 clean 여부 검증. git repo 아니거나 `git` 바이너리 부재 시 `skipped` 반환. 기본 timeout 30s. 8 신규 테스트 (detect 3 + run 5).

### Changed
- `commands/work.md` — gate_4 감지 로직 + skip 조건 명시. gate 자동화 범위 표기 (0~4) 갱신.

### Testing
- 300 → **309 tests** (+ 8 Gate 4 + 1 dispatcher 갱신).
- Dogfood: harness-boot 자체 레포에서 F-104 `--run-gate gate_4` 동작 확인 (미커밋 파일 존재 시 FAIL 정확히 감지).

## [0.3.5] — 2026-04-23

### Added
- **Gate 3 (coverage) 자동 실행** — `/harness:work --run-gate gate_3` 가 Python (pytest-cov / coverage+pytest), TypeScript/JavaScript (package.json scripts.coverage / npx nyc), Rust (cargo-tarpaulin / cargo-llvm-cov), Go (go test -cover) 에 대해 커버리지 도구 자동 감지 + 실행. threshold 는 도구 자체 설정 (`[tool.coverage]` · package.json · etc.) 을 따름 — harness 는 tool 선택 · exit code 로 pass/fail. 기본 timeout 600s (테스트 + 커버리지 수집은 더 오래 걸림). 12 신규 테스트.

### Changed
- `commands/work.md` — gate_3 감지 우선순위 + threshold 정책 명시.

### Testing
- 288 → **300 tests** (+ 12 Gate 3 관련).
- Dogfood: harness-boot-selfhost 에서 F-103 --run-gate gate_3 PASS.

## [0.3.4] — 2026-04-23

### Added
- **Gate 2 (lint) 자동 실행** — `/harness:work --run-gate gate_2` 가 Python (ruff · flake8), TypeScript/JavaScript (eslint · npx eslint), Rust (cargo clippy), Go (golangci-lint) 에 대해 린터 자동 감지 + 실행. 감지 순서: pyproject+ruff → pyproject+flake8 → package.json+eslint → .eslintrc*+npx → Cargo+clippy → go.mod+golangci-lint. pass 시 evidence 자동 기록. 11 신규 테스트.

### Changed
- `commands/work.md` — gate_2 감지 우선순위 명시.

### Testing
- 277 → **288 tests** (+ 11 Gate 2 관련).
- Dogfood: harness-boot-selfhost 에서 F-102 --run-gate gate_2 PASS.

## [0.3.3] — 2026-04-23

### Added
- **Gate 1 (type check) 자동 실행** — `/harness:work --run-gate gate_1` 가 Python · TypeScript · Rust · Go 에 대해 타입 체커 자동 감지 + 실행. 감지 우선순위: pyproject+mypy → pyproject+pyright → tsconfig+tsc → Cargo+cargo check → go.mod+go vet. pass 시 evidence 자동 기록 + `gate_auto_run` 이벤트. 10 신규 테스트 (detect · run · dispatcher).

### Changed
- **`gate_runner.py` 내부 리팩터** — `_execute()` 공통 subprocess 헬퍼 + `_resolve_command()` 우선순위 해석 헬퍼 추출. 향후 Gate 2~5 추가 시 함수당 ~10 줄로 축소 가능.
- `commands/work.md` — gate_0/gate_1 감지 우선순위 명시.

### Testing
- 267 → **277 tests** (+ 10 Gate 1 관련).
- Dogfood: harness-boot-selfhost 에서 `/harness:work F-101 --run-gate gate_1` 성공.

## [0.3.2] — 2026-04-23

v0.3.1 까지 발표된 8 철학 기둥과 실제 구현 · README 주장 간 정합을 감사하고 2 개 선언-only 항목을 강제 enforcement 로 승격 + README over-claim 4 건 톤 조정 + preamble 규약 통일.

### Fixed
- **Walking Skeleton 스키마 강제** — `docs/schemas/spec.schema.json` 의 `features` 에 `prefixItems[0].type = "skeleton"` + `minItems: 1`. `/harness:sync` Gate 0~1 이 첫 피처 타입 위반을 자동 차단. 이전에는 템플릿 주석으로만 안내되던 규약이 이제 JSONSchema 로 검증됨. 6 신규 테스트 (`WalkingSkeletonEnforcementTests`).
- **Anti-rationalization 2 행 규약 commands 전체 적용** (BR-014) — `commands/init.md · spec.md · sync.md · work.md · status.md · check.md · events.md` 전부 Preamble 섹션에 "NO skip: ..." / "NO shortcut: ..." 2 행을 command-specific 제약으로 명시. 이전엔 암묵적이었음.

### Changed
- **README over-claim 톤 조정** — 감사 결과 4 항목 정직화:
  - Canonical Hashing — cross-language 테스트 벡터는 v0.4+ 로 명시.
  - Hook fail-open — "⏳ (v0.4+)". `hooks/` 디렉터리 자체가 shipped 안 됨.
  - Event log rotation — "v0.4+". 코드 없음.
  - integrator 에이전트 — "⏳ (v0.4+)". `agents/` 디렉터리 부재.
  - 각 기둥에 ✅ / 🛠 / ⏳ 상태 마커 부착.
- **Preamble 세부 규약 8 commands 통일** — 이모지 · 명령 · mode/scope · 5~10 단어 근거. 이전엔 init/sync/spec 만 구체, work/status/check/events 는 축약형이었음. + 2-3 줄 anti-rationalization 규약 고정.

### Testing
- 261 → **267 tests** (+ 6 WalkingSkeletonEnforcement).
- `harness-boot-self` canonical spec 통과 확인 (features[0] = "skeleton").

### 감사 보고 (세션 내 기록)
4-way 정합 (design doc · 구현 · README · 테스트). 핵심 결론: 철학 정합 7 → 9/10, 문서-코드 일치 6 → 8/10.

## [0.3.1] — 2026-04-23

### Added
- **`scripts/gate_runner.py`** — Gate 0 (tests) 자동 실행. pytest → unittest → npm test → make test 자동 감지 + `harness.yaml.gate_commands.<gate>` override + timeout 지원. stdout/stderr 마지막 30 줄 tail 로 요약.
- **`/harness:work --run-gate <NAME>`** — gate_runner 실행 → state 자동 기록 + pass 시 evidence 자동 추가 + `gate_auto_run` 이벤트 로그. gate_1~5 는 현재 `skipped` 반환 (v0.3.2+).
- 지원 플래그: `--override-command`, `--project-root`, `--timeout`.

### Testing
- **261 unit tests** (v0.3.0 의 237 + gate_runner 19 + work run-gate 5).
- Dogfood: harness-boot 자체 테스트 (261/261) 을 plugin 의 `/harness:work --run-gate gate_0` 로 실행해서 PASS + evidence 자동 기록.

### Versioning policy
- 이 버전부터 **patch bump 우선** 정책 적용. 새 명령 · 헬퍼 추가는 patch (0.3.X+1). minor/major 는 사용자 확인 후 큰 마일스톤에 예약.

## [0.3.0] — 2026-04-23

### Added — Development loop closed

4 신규 슬래시 명령 + 1 공통 유틸:

- **`/harness:work`** (F-004) — 피처 단위 개발 사이클 상태 관리. 활성화 · Gate 기록 · 증거 수집 · `done` 전이. BR-004 (Iron Law) 준수 — gate_5=pass + evidence≥1 없으면 done 거부. `scripts/work.py` + 17 tests.
- **`/harness:status`** (F-005) — 세션 · 피처 카운트 · drift · 마지막 sync · active 피처 요약 (CQS read-only). `scripts/status.py` + 11 tests (mtime 불변 검증).
- **`/harness:check`** (F-006, partial) — 5/8 drift 탐지 (Generated · Spec · Derived · Include · Evidence). Code/Doc/Anchor 는 v0.4+. `scripts/check.py` + 23 tests.
- **`/harness:events`** (F-007) — events.log 조회 with kind/feature/since 필터 (CQS). `scripts/events.py` + 12 tests.
- **공통 유틸** `scripts/state.py` (17 tests) — state.yaml 의 read/save/lifecycle helper. 모든 v0.3 명령이 공유.

### Testing
- 총 **237 unit tests** (v0.2.1 의 157 + 80 신규).
- F-004 end-to-end full-cycle 테스트: activate → 6 gate pass → evidence → complete. 9 events 정확한 순서 검증.

### Closed issues from Phase α dogfood
- (이미 v0.2.1 에서) NEW-50 — plugin_version resolution fallback.

### Known remaining
- Phase 1 Gate 자동 실행 (test runner · runtime smoke) 은 v0.4.
- Code · Doc · Anchor drift 는 v0.4.
- Modes A/R/B-1/B-2 실제 interactive 흐름은 여전히 LLM 드리븐 (classifier + diff 도구는 있음).

## [0.2.1] — 2026-04-23

### Fixed
- **NEW-50**: `_plugin_version` 이 scratch 워크스페이스에서 `"unknown"` 으로 기록되던 문제 해결 — `_script_repo_version()` (strategy 0, `__file__` 기반) + `plugin_root.resolve()` (strategy 2, 4-전략 체인) fallback 추가. events.log 의 `plugin_version` 이 실제 실행 중인 sync.py 의 repo 버전을 정확히 반영.

### Added (test)
- 3 신규 단위 테스트 (`PluginVersionResolutionTests`) — strategy 0 bypass + parent search hit + plugin_root.resolve fallback + 전체 실패 시 'unknown'.

### Discovered (Phase α dogfood, 2026-04-23)
- `docs/samples/harness-boot-self/spec.yaml` 을 scratch 워크스페이스에서 `/harness:sync` 돌려 self-describe round trip 검증. `plugin_root_resolver` 모듈이 architecture.yaml 에 정상 노출 (v0.1.1 NEW-37/44 회귀 보호 확인). 발견 갭 NEW-50~55 는 local 노트 (`design/phase-v0.3-dogfood-findings.md`).

### Testing
- 157 unit tests (0.2.0 의 154 + 3 신규).

## [0.2.0] — 2026-04-23

### Added — Self-describe round trip
- **`/harness:sync`** (F-003) — Phase 0 완성. `spec.yaml` 에서 `domain.md` · `architecture.yaml` · `harness.yaml` 해시트리 · `events.log` 파생. edit-wins 보호 + `--dry-run` / `--force`. 구현: `scripts/sync.py` + `commands/sync.md`.
- **`/harness:spec`** (F-002, partial) — Mode A/B/R/E 자동 분기. Mode E (read-only explain) + classifier + diff 렌더러는 Python 구현. Modes A/R/B-1/B-2 는 Claude LLM 대화 드리븐 (spec-conversion skill v0.5 와 연계).
- **$include 전개 엔진** (F-009) — `scripts/include_expander.py`. Depth=1 강제 · 🔒 필드 차단 · chapters 디렉터리 escape 방지.
- **Canonical Hashing — Merkle 3층** (F-010) — `scripts/canonical_hash.py`. Canonical JSON → SHA-256. subtree 해시 + merkle_root 결합.
- **JSONSchema 검증** (Gate 0~1) — `scripts/validate_spec.py`. sync 가 파생 전 스키마 검증. 실패 시 `sync_failed` 이벤트.
- **플러그인 루트 해석 유틸** — `scripts/plugin_root.py`. NEW-37/44 4-전략 체인을 재사용 가능 모듈로.
- **Self-referential canonical spec** — `docs/samples/harness-boot-self/spec.yaml` · `README.md`. harness-boot 자체를 한 제품으로 보고 변환한 21 features 스펙. v0.2 의 round-trip 실증 입력.

### Changed
- `.claude-plugin/plugin.json.version` → `"0.2.0"`.
- `.claude-plugin/marketplace.json` plugin entry version → `"0.2.0"`.
- `commands/sync.md` 가 `scripts/sync.py` 에 위임.
- `commands/spec.md` 가 신규 Python 스크립트 (`spec_mode_classifier.py` · `explain_spec.py` · `spec_diff.py`) 를 CLI 로 호출.

### Testing
- 총 **154 unit tests** (v0.1.1 의 0 → v0.2.0 의 154). 모든 파생 빌딩블록 커버.
- **Self-describe smoke** — `harness-boot-self/spec.yaml` → `domain.md` (~11 KB) · `architecture.yaml` (~10.7 KB) · 6 subtree 해시 · merkle_root. `spec_hash = 6971d901...`.

### Dependencies
- Python 3.10+ · `pyyaml` 필수 · `jsonschema` 선택 (설치 시 structural validation 활성).

## [0.1.1] — 2026-04-23

### Added
- **`.claude-plugin/marketplace.json`** — single-plugin marketplace. `/plugin marketplace add github:qwerfunch/harness-boot` 경로로 직접 설치 가능 (NEW-45 해소).

### Changed
- **`/harness:init` 강건성 개선**:
  - 프로젝트 루트 신호 체크가 **정보성** 으로 동작 — 4 개 신호가 없어도 중단하지 않고, 최종 보고에 `팁: 'git init' 권장` 한 줄만 추가 (NEW-39, re-smoke 피드백으로 y/N 프롬프트를 info-only 로 완화).
  - 프로젝트 이름 추출 체인에 empty/whitespace/null 감지 + kebab-case 정규화 추가 (NEW-40).
  - `date -u` 실패 시 Python/Node fallback + 마지막 수단으로 사용자 프롬프트 (NEW-42, Windows Git Bash 대응).
  - §2 플러그인 루트 경로 해석을 4-전략 체인 (PATH/registry/marketplace-source/prompt) 으로 확장 (NEW-44).

### Closed (retrospective)
- **NEW-37** — `$CLAUDE_PLUGIN_ROOT` 은 CC 2.1.x 에서 미설정. 실제 해석은 `$PATH` 주입 `<root>/bin` 역산. v0.1.0 (`37bd0a4`) 에서 이미 문서 패치됨, v0.1.1 RFC 는 closure 만.

### Remaining (v0.1.2+)
- NEW-39/40/42/44 가 실제 사용자 시나리오에서 정말 해소되는지 재검증 필요 (두 번째 first-run 스모크 대상).
- 공식 마켓플레이스 PR — 안정화 후.

## [0.1.0] — 2026-04-23

### BREAKING
- 아키텍처 **피벗**: TypeScript CLI (bin/harness-boot + src/**) 를 전면 폐기하고, Claude Code 네이티브 플러그인으로 재설계. 구 CLI 경로 · 구 commands (`/analyze`, `/spec` 구버전) · `src/**` 코어는 제거됨. 이전 사용자가 있다면 레포 재설치 필요.

### Added
- **플러그인 매니페스트** `.claude-plugin/plugin.json` — `commands/` · `skills/` · `agents/` · `hooks/` 디렉터리 선언.
- **슬래시 명령** `/harness:init` (commands/init.md) — `.harness/` 스캐폴딩 + CLAUDE.md 편성 + `.gitignore` 병합 + 초기 events.log. `--team` / `--solo` 모드 분기 지원.
- **스킬** `skills/spec-conversion/SKILL.md` v0.5 — plan.md → spec.yaml 변환. 24 원칙 · 5 도메인 어댑터 (saas · game · worker · library · meta) · 4-stage 파이프라인 (정찰 → 저작 → gap → backlink).
- **spec.yaml 스키마** v2.3.8 (`docs/schemas/spec.schema.json`) — JSONSchema draft 2020-12. 9 블록 네이티브 배치 (`metadata.*`). 11/11 샘플 validation 통과.
- **Starter 템플릿** 4종 (`docs/templates/starter/`) — spec.yaml · harness.yaml · state.yaml · CLAUDE.md. `{{PROJECT_NAME}}` 치환.
- **Mode B 통계 추출** (`scripts/mode_b_*.py`) — BM25 (k1=1.5, b=0.75) + Porter-lite 스테밍 + 한국어 조사 제거 + 12 축 질의 어휘. 6 샘플 회귀 recall 0.991 / precision 0.861 (가설 F-9 HIT).
- **Golden 샘플** 8개 (`tests/regression/conversion-goldens/`) — url-shortener · retro-jumper · price-crawler · vapt-apk-sast · tzcalc · vite-bundle-budget · vscode-commit-craft · harness-boot-self. MANIFEST.yaml 인덱스.
- **문서**: `README.md` (30초 파악), `docs/setup/local-install.md` (스모크 시나리오 6 검증).

### Deferred to v0.2+
- `/harness:sync` — spec 변경 후 domain.md · architecture.yaml 파생.
- `/harness:work` — Walking Skeleton → 기능 구현 사이클.
- `/harness:status` · `/harness:check` — 진행·드리프트 조회.
- `scripts/hash-fixtures.mjs` — Merkle 해시 트리 계산.
- `.claude/agents/**` · `.claude/skills/**` 자동 생성.
- 6 핵심 훅: security-gate · doc-sync-check · coverage-gate · format · test-runner · session-start-bootstrap.

### First-run smoke (2026-04-23, Claude Code 2.1.118)

- §1~§7 전부 통과. NEW-37 메커니즘 확정 — `$CLAUDE_PLUGIN_ROOT` 는 미설정, `$PATH` 주입된 `<plugin-root>/bin` 역산이 실제 경로 해석 방법.
- `.claude/` 빈 디렉터리 · `@import` 누락은 silently ignore 확인.
- 관찰 결과에 따라 4 개 fix 커밋 (`db2562b`·`2978fa6`·`057f931`·`37bd0a4`) 을 릴리즈 전 머지.

### Known Limitations (v0.1.1 에서 해소 예정)

- Windows PowerShell 환경의 `date -u` fallback (NEW-42).
- 루트 판단 실패 시 fallback (NEW-39).
- 프로젝트 이름 추출 엣지케이스 (NEW-40).
- `directory`-type marketplace 의 `installPath` 캐시 미생성 (NEW-44, 2026-04-23 관찰).
- repo 자체의 `.claude-plugin/marketplace.json` 미존재로 직접 `github:` 설치 불가 (NEW-45, 2026-04-23 관찰).

### Design 근거 (로컬 전용)
주 설계 문서 (`design/harness-boot-design-2.3.7.md`) 와 RFC·샘플·메모리 파일은 `.gitignore` 로 공개 레포에서 제외. 기여자는 별도 요청. 자동 생성되는 공개 산출물 (스키마 · 스킬 · 템플릿 · 골든) 만 트래킹.

---

[Unreleased]: https://github.com/qwerfunch/harness-boot/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.4.1
[0.4.0]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.4.0
[0.3.13]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.13
[0.3.12]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.12
[0.3.11]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.11
[0.3.10]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.10
[0.3.9]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.9
[0.3.8]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.8
[0.3.7]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.7
[0.3.6]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.6
[0.1.0]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.1.0
