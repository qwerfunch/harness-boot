# Changelog

All notable changes to harness-boot are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

---

## [Unreleased]

**보류 (사용자 결정 시점에)**:

- Marketplace PR (anthropic/claude-plugins-official) — 사용자 명시 후 진입.

## [0.10.4] — 2026-04-27

**Phase 2 self-hosting active — harness-boot 자체 도그푸드 활성화 + ergonomics 정리.**

2026-04-25 의 deferral 이 사용자 결정으로 뒤집혀 본 레포의 모든 신규 피처가
`python3 scripts/work.py` 사이클을 거친다 (cosmic-suika 와 동일 규약).
`project.mode: prototype` 으로 시작. 활성화 자체를 F-025 로 트래킹, 직후
발견된 5 갭 (smoke shim · stale doc · dead-ref · CHANGELOG · gate_0 scope) 을
F-026 으로 묶어 첫 풀 사이클 reference 로 완주.

### Added

- **`scripts/smoke.sh`** — `self_check.sh` 의 thin wrapper. `scripts/gate/runner.py`
  의 gate_5 auto-detect 가 가장 먼저 잡아 `--override-command` 의존 제거.
- **`pytest.ini`** — `testpaths = tests/unit` 으로 베어 `python -m pytest` 의
  scope 고정. 이전엔 `design/oss-refs/` (gitignored 외부 OSS 참조본) 까지
  recursive collection 시도하다 의존성 부재로 collection error → exit 2.
  gate_0 가 베어 pytest 를 호출하므로 override 불필요해짐.
- **F-025 · F-026** in `docs/samples/harness-boot-self/spec.yaml` +
  `.harness/spec.yaml` — Phase 2 활성화 (F-025) 와 후속 정리 (F-026).
  features 24 → 26.
- **`project.mode: prototype`** in spec — Iron Law D 는 evidence ≥ 1 + gate_5 pass.
  product 로 promote 는 사용자 결정 시점.

### Changed

- **`CLAUDE.md`** v0.3.9 표기 → v0.10.3 reality 로 전면 갱신 (§1~§9). slash
  명령 8 → 2 (init · work), 자체 도그푸드 정책 Phase 1 observational →
  Phase 2 active flip. v0.4 ~ v0.10 narrative 추가.
- **`hooks/session-bootstrap.sh`** dead reference 수정: 안내 명령
  `/harness:status` (v0.9.0 통합 시 부재화) → `/harness-boot:work` (no-args
  대시보드, v0.9.2 entry point). **사용자 visible behavior change** —
  플러그인 설치된 모든 워크스페이스의 SessionStart 배너에 영향.
- **`.harness/README.md`** · **`scripts/self_check.sh`** 헤더 — Phase 1 표기를
  Phase 2 active 로 갱신. README 에 work.py 4-verb 사이클 사용 예시 추가.
- **`.gitignore`** — `.harness/_workspace/` 추가 (kickoff · retro · design_review
  · questions ceremony 산출 미추적).

### Notes

- F-025 사이클: gate_5 (override 시기) + 1 declared evidence → done.
- F-026 사이클: gate_0 (838 tests) + gate_5 (smoke shim 자동) + 1 declared
  evidence → done. **Phase 2 의 첫 풀 사이클 reference**.
- 회귀: self_check 5/5 + 838 tests OK.
- 메모리 갱신: `project_self_hosting_deferred` → `_active`,
  `feedback_cosmic_suika_harness_only` 일반화 (cosmic-suika + harness-boot
  양쪽 적용).
- 다음 신규 피처부터는 `--override-command` 없이 `--run-gate gate_0/5` 만으로
  깔끔하게 굴러감. Phase 2 의 정상 형태 확보.

**v0.8 완결** (PR-α + PR-β):

- ~~Design review auto-wire~~ ✅ v0.8.0
- ~~나머지 agent fixtures (8 종)~~ ✅ v0.8.1 — 15/15 fixtures 전원 완결

**v0.9 범위 후보 (novel axis)**:

- URL → design seed: `/harness:clone <url>` 또는 별도 `harness-seed` 플러그인. `.harness/_workspace/design/{flows,tokens,components}.md|yaml` 를 자동 시드 · visual-designer/ux-architect 는 refine 역할로 전환. (2026-04-24 검토 — scope 크고 IP 경계 주의 필요)
- gate_perf auto-detect heuristics (lighthouse.config.js · k6 · wrk 설정 감지)

**기타 backlog**:

- ~~Phase 3 CI — `.github/workflows/self-check.yml` + PR gate~~ ✅ v0.8.3
- Cross-language hash test vectors (Appendix D.7)
- ~~Event log rotation (`events.log.YYYYMM`)~~ ✅ v0.8.6
- AC coverage drift (check.py 11 번째 drift 후보)
- pre-commit hook (Phase 2 자동 enforcement) — 디시플린이 흔들릴 때 진입 후보.

## [0.10.3] — 2026-04-27

**Iron Law D — product mode strict (cosmic-suika I-008 환원).**

이전 contract (gate_5 pass + N declared evidence) 만으로는 gate_2 (lint)
fail 이 있어도 complete 가 통과하던 문제. product 모드는 이제 record 된
모든 gate 의 last_result 가 fail 이 아닐 때만 통과한다. prototype 모드는
lighter contract 유지.

### Changed

- **`scripts/work.py::complete`** — product 모드일 때 추가 검증 1 단계:
  ``gates`` 맵에서 ``last_result == "fail"`` 인 항목이 하나라도 있으면
  reject. 메시지에 모든 fail gate 이름 나열 (정렬). prototype 모드는
  검증 skip — 현행 동작 유지. ``hotfix_reason`` 제공 시 strict 우회 가능
  (audit trail 은 hotfix evidence 로 보존).

### Notes

- skipped / unrecorded gate 는 검증 대상 아님 — 사용자가 특정 gate 를
  의도적으로 안 돌렸을 수 있음 (도구 미설치 환경 등). record 된 gate
  중 fail 만이 차단 사유.
- 검증 순서: gate_5 pass → product strict → declared evidence 카운트 →
  state 전이. 가장 직접적인 gate fail 을 먼저 거름.
- 8 new tests in `tests/unit/test_iron_law_declared.py`
  (ProductModeFailedGateTests). 누적 838 tests OK.

## [0.10.2] — 2026-04-27

**npm scripts auto-detection — gate_runner cosmic-suika I-001 환원.**

npm-only 프로젝트가 `pyproject.toml` 부재 + `tests/` 디렉터리 (vitest 등의
관용) 가 있을 때 gate_0 이 unittest fallback 으로 잘못 잡히는 문제 + 사용자
정의 npm scripts (typecheck/lint/test:coverage/smoke/test:e2e) 가 무시되는
문제를 해결.

### Added

- **`_npm_script_command(project_root, script_name)`** in
  `scripts/gate/runner.py` — package.json scripts → `npm run <script>`
  (또는 `npm test` for `script_name == "test"`). package.json 부재,
  scripts 부재, script 미정의, npm PATH 부재 모두 None 반환.
- **gate_1 (typecheck)** — `package.json scripts.typecheck` 매핑 (tsc 직접
  호출보다 우선, pyproject + mypy/pyright 보다는 후순위).
- **gate_2 (lint)** — `package.json scripts.lint` 매핑 (eslint 직접 호출 ·
  npx fallback 보다 우선).
- **gate_3 (coverage)** — `package.json scripts.test:coverage` (vitest/jest
  관용) 우선, 없으면 `coverage`. 도구 직접 호출 (nyc) 보다 우선.
- **gate_5 (smoke)** — `package.json scripts.smoke` 우선, 없으면
  `test:e2e` (Playwright/Cypress 관용). 단 `scripts/smoke.sh` 는 명시적
  entry point 라 npm scripts 보다 더 우선.

### Changed

- **gate_0 (test) 우선순위 재배치** — `pyproject + pytest` 다음으로 npm
  `scripts.test` 가 `tests/` unittest fallback **보다 위**. 이전엔 마지막
  fallback 이라, npm-only 프로젝트가 vitest 용 `tests/` 디렉터리를 갖고
  있으면 `python -m unittest discover tests` 로 잘못 잡혔음.
- **gate_5 우선순위 재배치** — `scripts/smoke.sh` 다음으로 npm
  `scripts.smoke` / `test:e2e` 가 `tests/smoke/` unittest fallback **보다
  위**. cosmic-suika 의 playwright e2e 의도 보존.

### Notes

- 우선순위 일반 원칙 (gate_1~5 공통): **pyproject (Python 도구) > 사용자
  정의 npm scripts > 도구 직접 호출 (eslint, tsc, nyc) > 언어별 polyglot
  fallback**. mixed (pyproject + package.json) 프로젝트에서는 Python 도구가
  우선 — 풀스택 monorepo 가 한 root 에 같이 있으면 backend 검증이 더
  엄격하다는 일반적 expectation 반영.
- `_npm_script_command` 는 read-only · 부작용 없음. CQS 보존.
- 23 new tests (NpmScriptCommandHelperTests + 각 DetectGateNTests 의 npm
  분기 + 우선순위 케이스). 누적 830 tests OK.

## [0.10.1] — 2026-04-27

**cosmic-suika ISSUES-LOG 환원 patch — AnchorIntegration drift +
no-args dashboard 후보 가시화.**

dogfood 프로젝트 (cosmic-suika) 에서 누적된 이슈 중 플러그인 코드/스키마
부족함으로 환원 가능한 두 건 (I-010, I-002) 을 묶어서 처리.

### Added

#### I-010 — AnchorIntegration drift (declarative integration wiring guard)

35 개 피처가 독립적으로 모두 gate_5 (smoke) 를 통과했음에도 통합 진입점
(`src/main.ts`) 이 비어 있어 end-to-end 동작이 안 됐다. per-feature smoke
만으로는 검출 불가능한 통합 wiring 누락을 declarative 로 가드한다.

- **`features[].integration_anchor: string[]`** schema field in
  `docs/schemas/spec.schema.json` — optional list of project-relative
  anchor file paths. Feature 가 ship (`status=done`) 시 declared
  module 의 basename 또는 path-token stem 이 anchor 파일들 중 적어도
  하나에 등장해야 한다. Backward-compatible — 기존 spec 은 변경 없이 검증.
- **`AnchorIntegration` drift in `scripts/check.py`** (drift catalog
  11/11) — `Stale` 과 동일한 grep-level 휴리스틱 (`basename`, `/stem`,
  `"stem`, `'stem`). Severity:
  - `error` — anchor 파일이 부재 (사용자가 잘못된 경로를 적음).
  - `warn` — 어떤 anchor 에서도 module 참조 못 찾음 (통합 누락 가능성;
    Iron Law 위반은 아님).
  - silent — `archived`, `superseded_by`, status≠`done`,
    `integration_anchor` 미선언/빈 배열, `modules` 비어 있음.
- 12 new tests in `tests/unit/test_check.py` (basename/stem 매칭,
  any-of 시맨틱, 면제 조건, anchor 부재 error, run_check 등록).

#### I-002 — `/harness:work` 빈 호출 대시보드에 spec 미등록 후보 노출

기존 빈 호출 대시보드는 `state.yaml` 에 등록된 피처만 표시 → spec.yaml 에
정의된 31 개 피처 중 아직 activate 가 일어나지 않은 후보가 비가시화. 사용자가
무엇을 다음에 시작해야 하는지 발견 어려움.

- **`scripts/ui/dashboard.py::_render_unregistered`** — spec features ∖
  state by_id 차집합을 spec 순서로 표시. 헤더에 총 후보 수, 5 개 초과 시
  `… 외 N 개 (spec.yaml 참조)` 힌트. archived / superseded_by 면제.
- **`scripts/ui/intent_planner.py::_first_unregistered_in_spec`** — idle
  분기에서 state-level planned 가 없을 때 spec-level 첫 미등록 피처를
  `start_feature` 액션으로 추천. in_progress 가 있으면 resume 이 우선,
  unregistered 가 보조로 따라옴.
- empty-state hint (`아직 피처가 없습니다`) 는 unregistered 후보가 있으면
  표시 안 됨 (사용자가 곧바로 후보를 보게 됨).
- 13 new tests in `tests/unit/test_dashboard.py` · `test_intent_planner.py`.

누적 807 tests OK.

### Notes

- `integration_anchor` 는 opt-in. 기존 프로젝트는 바꾸지 않으면 드리프트
  없음. 사용자가 anchor 를 적는 순간부터 검증.
- 휴리스틱은 import graph 를 파싱하지 않는다 — false negative (런타임
  문자열 조립으로 import) 와 false positive (anchor 파일에 동명 식별자가
  무관하게 등장) 모두 가능. Pragmatic by design.
- Dashboard 변경은 CQS 보존 — 파일 수정 없음. work.py main() 의 빈 호출
  분기는 그대로이며, ui 모듈 두 곳만 수정.

## [0.10.0] — 2026-04-25

**Two-layer supersession — features[] supersedes/superseded_by + archive flow + Stale drift.**

Resolves the asymmetry surfaced by the cosmic-suika dogfood: `decisions[]`
already had `supersedes` for ADRs, but features had no equivalent. Pivots
forced a binary choice — rewrite history (lose audit) or leave dead code
(lose reality). The two-layer model splits these cleanly:

- **Spec is additive** — features never deleted; `supersedes` /
  `superseded_by` chain marks replacement (mirrors the ADR pattern).
- **State is transitional** — `done → archived` through a new audited
  `feature_archived` event.
- **Code is replacement** — dead modules can be deleted freely; the new
  `Stale` drift surfaces done features whose declared modules are
  unreferenced and not yet archived/superseded.

### Added

- **`features[].supersedes` / `features[].superseded_by`** schema fields
  in `docs/schemas/spec.schema.json` — array of `F-N` and single `F-N`
  string respectively, both optional, mirroring the existing
  `decisions[].supersedes` pattern. Backward-compatible: existing specs
  validate unchanged.
- **`scripts/work.py archive(...)`** + `--archive [--superseded-by F-N]
  [--reason "..."]` CLI flags — transition a `done` feature to
  `archived`, append `feature_archived` event with `superseded_by` /
  `reason` to `events.log`, and force-refresh the retro template so the
  new "Superseded By" section can fill in. Guards: feature must be
  `done`, `--superseded-by` target must exist in spec, idempotent on
  re-archive.
- **`Stale` drift** in `scripts/check.py` — flags features where
  `status == "done"`, declared `modules` exist with concrete `source`
  paths, but no `src/` file references them. Severity `warn` (gives
  cleanup time, not Iron Law). Exempted: `status == "archived"`,
  `superseded_by` set, or no modules declared. Silent when no `src/`
  tree (non-typescript/python repos).
- **`scripts/check.py::check_anchor`** extension — Anchor drift now also
  validates `supersedes` / `superseded_by` references: dangling-ref,
  self-ref, cycle detection (DFS), and bidirectional consistency
  (`A.superseded_by = B` must match `B.supersedes ⊇ [A]`, else warn).
- **`scripts/ceremonies/retro.py`** — `analyze` detects
  `feature_archived` events; template renders an auto-filled
  `## Superseded By` section showing replacement F-N + reason +
  timestamp. Renders in both `prototype` and `product` modes.
- **`tests/unit/test_feature_supersedes.py`** (new, 12 tests) —
  reference validity, self-ref rejection, two-/three-node cycle
  detection, bidirectional consistency, dangling-ref handling.
- **`tests/unit/test_check.py::StaleDriftTests`** — 8 tests covering the
  Stale drift exemptions and detection.
- **`tests/unit/test_work.py::ArchiveTests`** — 9 tests covering
  archive transitions, idempotency, guards, event emission.
- **`tests/unit/test_retro.py::ArchivedRetroSectionTests`** — 5 tests
  covering Superseded By section rendering across modes.
- **`tests/unit/test_schema_additive.py::FeatureSupersedesSchemaTests`**
  — schema-shape backward-compat assertions.

### Changed

- `DriftKind` comment updated to include `Stale`. `run_check` registers
  the new check after `Adr` so the order in `Checked:` line stays
  predictable.

### v0.9.x → v0.10.0

| Version | Status |
|---|---|
| v0.9.0 ~ v0.9.6 | shipped |
| **v0.10.0** | ✅ Two-layer supersession metadata |

### Numbers

- Tests: 764 → 802 (+38).
- self_check 5/5 PASS.
- New module surface: schema fields ×2, drift kind ×1, CLI flag ×3,
  retro section ×1.

### Validated externally

The cosmic-suika dogfood was the first consumer: 3 design pivots
accumulated 3 done features (`F-037 / F-038 / F-040`) that no longer
matched the implemented game. After v0.10.0 they're marked
`superseded_by F-042 / F-043` and archived, and ~600 LOC of orphaned
modules (sun.ts, sun-surface.ts, saturn-ring.ts, sun-absorption.ts +
test, launcher-anchor.ts) deleted with `check.py` Stale drift staying
clean. The audit chain — every pivot recorded in `events.log` with
reason — survived intact.

## [0.9.6] — 2026-04-25

**Project mode axis — `prototype` vs `product` ceremony lightening.**

`spec.project.mode` becomes a single switch that simultaneously tightens or
relaxes Iron Law D (already in place since v0.9.3), kickoff template depth,
retrospective template depth, and design-review autowire. Existing specs
without the field continue to behave identically (defaults to `product`).

### Added

- **`scripts/core/project_mode.py`** — shared `resolve_mode(spec) -> "prototype" | "product"` helper. Pure function, no I/O. Replaces the duplicated mode resolution that was inlined in `scripts/work.py`.
- **`scripts/ceremonies/kickoff.py`** — `generate_kickoff(..., mode=...)`. `prototype` renders one bullet per agent and a one-line guidance comment; `product` keeps the original three-bullet / 80-word prompt. Agent list itself unchanged across modes — only per-agent depth is lightened. The `kickoff_started` event now carries `mode`.
- **`scripts/ceremonies/retro.py`** — `generate_retro(..., mode=...)`. `prototype` renders only the three machine-extractable sections (What Shipped · First Gate to Fail · Ceremonies summary) and skips the five LLM-driven sections that need a reviewer→tech-writer pass. `feature_retro_written` event now carries `mode`.
- **`scripts/work.py::_autowire_design_review`** — fourth AND condition: skips the autowire when mode is `prototype`. Explicit `--design-review` flag still forces generation in either mode.
- **`docs/schemas/spec.schema.json`** — `project.mode` enum (`prototype` · `product`) added with description.
- **`tests/unit/test_project_mode.py`** — 22 tests:
  - `resolve_mode` (11) — defaults, enum gating, malformed input handling, non-dict spec.
  - Kickoff lightening (4) — product 3-bullets, prototype 1-bullet, default mode, event metadata.
  - Retro lightening (4) — product full template, prototype machine-only, default mode, event metadata.
  - Design-review autowire (3) — product autowires, prototype skips, prototype `--design-review` overrides skip.

### Changed

- `scripts/work.py` no longer holds its own `_resolve_project_mode` — imports `core.project_mode.resolve_mode`. All Iron Law D mode lookups, kickoff autowire, retro autowire, and design-review autowire now go through the same single path.

### v0.9.x progress

| Version | Status |
|---|---|
| v0.9.0 | ✅ Namespace rename + 6 commands removed |
| v0.9.1 | ✅ feature_resolver |
| v0.9.2 | ✅ Dashboard + intent_planner |
| v0.9.3 | ✅ Iron Law D + hotfix override |
| v0.9.4 | ✅ Scenario contract table + integration tests + plugin description modernization (round 1) |
| v0.9.5 | ✅ README user-friendly rewrite + plugin description tagline style |
| **v0.9.6** | ✅ project.mode prototype/product ceremony lightening |
| v0.10.0 | ⏳ Legacy shim removal · README top reorganization |

### Numbers

- Tests: 742 → 764 (+22).
- self_check 5/5 PASS.
- One new module (`scripts/core/project_mode.py`), schema enum addition, three ceremony / autowire touch-ups.

## [0.9.5] — 2026-04-25

**Docs-only patch — README / 플러그인 description 사용자 친화 개편.**

v0.9.4 에서 나온 README 가 타이틀 문장 가치 제안 부족 · 내부 용어 (F-N · AC · Iron Law D · CQS · drift 10) 노출 · "솔로 음악인 연습용 포모도로" niche 예시 · 구조 다이어그램 부재로 사용자가 이해하기 어렵다는 피드백. 이 릴리즈는 코드 변경 없이 문서만 교체.

### Changed

- **`README.md`** 전면 재작성 — 가치 제안 기반 재배열:
  - 타이틀 문장: v0.9.3 의 원문 복원 ("자연어 아이디어를 스펙으로 굳히고, 전문가 에이전트 팀이 역할별로 협업해 ...").
  - **전체 구조** 섹션 신설 — 아이디어 → `spec.yaml` (단일 원천) → 파생 문서 + 전문가 팀 → `/harness-boot:work` 흐름을 ASCII 로 시각화.
  - 예시 교체 — "솔로 음악인 연습용 포모도로 타이머" → **"간단한 할 일 관리 앱"** / "로그인 기능" / "회원가입" 등 모두 이해 가능한 보통 이름.
  - 내부 용어 은닉 — F-N · @F-N · AC · gate_0~5 · Iron Law D · CQS · drift 10-way · declared evidence 를 사용자 섹션에서 제거. 쉬운 문구로 풀어 서술 (유일 잔존 위치: CI 사용 예시 코드 블록 — 기술 맥락상 적절).
  - **이런 분에게 유용합니다** 재작성 — negative framing ("'다 됐다' 통제") 제거, positive value 기반 (일관 흐름 · 역할 분리 · 결정 맥락 유지 · 축적된 스펙 위 협업).
  - "일상 / 매일" → "작업 / 이후 작업" 용어 통일 (4 곳).
  - `spec.yaml` 문구 갱신 — "사용자가 직접 편집하는 파일" → "자연어 대화로 자동 생성 · 갱신되는 시스템 원천". 직접 편집은 escape hatch 로 재위치.
  - 마케팅성 섹션 (Phase 1~4 로드맵 · "적은 인원 × 큰 시스템") 유지 제거.
- **`.claude-plugin/plugin.json`** · **`.claude-plugin/marketplace.json`** — description 을 타이틀 문장 스타일로 교체: "자연어 아이디어를 스펙으로 굳히고 ... AI 개발 하네스 프레임워크. Claude Code 플러그인 · 2 개 slash command ... 외울 것 최소화 · 자연어 입력."

### v0.9.x 진행

| 버전 | 상태 |
|---|---|
| v0.9.0 | ✅ namespace rename + 6 command 삭제 |
| v0.9.1 | ✅ feature_resolver |
| v0.9.2 | ✅ dashboard + intent_planner |
| v0.9.3 | ✅ Iron Law D + hotfix override |
| v0.9.4 | ✅ 시나리오 매핑 · 통합 테스트 + 플러그인 description 1차 현대화 |
| **v0.9.5** | ✅ README 사용자 친화 재구성 + 플러그인 description 타이틀 스타일 |
| v0.9.6 | ⏳ `project.mode` prototype/product 분기 · 의례 경량화 (v0.9.5 로 계획됐던 항목) |
| v0.10.0 | ⏳ legacy shim 제거 |

### Numbers

- Tests: 742 (unchanged — docs-only).
- README: 322 줄 (v0.9.4 의 298 대비 + 구조 다이어그램 / walkthrough).
- self_check 5/5 PASS.

## [0.9.4] — 2026-04-25

**UX re-architecture step 5 — README 전면 개편 · 시나리오 매핑 계약 테이블 · 플러그인 description 현대화.**

### Added

- **`scripts/ui/scenarios.py`** — 자연어 phrase ↔ 내부 action canonical 계약 테이블.
  - `ScenarioMapping(category, phrases, action, description, read_only)` frozen dataclass.
  - `SCENARIOS` tuple 10 entries · 5 categories (일상 · 시작 · 근거 · 정리).
  - `Action` Literal 9 values (dashboard · activate · run_gates · complete · block · deactivate · add_evidence · remove · switch).
  - `dispatch_action_name(action) -> str` — action id → `scripts/work.py` 함수명.
  - `as_readme_rows()` — README 렌더링용 `(category, phrases, description)` 표.
- **`tests/integration/test_scenario_mappings.py`** — 20 tests, 4 categories:
  - Structural — 빈 리스트 · frozen · known action · 빈 phrases · 빈 description · dashboard=read_only · ≤ 6 categories.
  - Dispatch — 모든 action 이 dispatch name 보유 · `work.py` 에 해당 attr 존재 + callable.
  - README rendering — row 개수 일치 · phrase quoting.
  - End-to-end smoke — dashboard snapshot · activate · block · deactivate · add_evidence · complete (Iron Law D) · remove · run_gates.
  - Coverage — Action literal 전부 SCENARIOS 에 등장 (switch 별칭 제외).

### Changed

- **`README.md`** — 전면 재작성 (370 → 225 줄):
  - 한 줄 tagline 을 2-command UX 에 재정렬.
  - "어떻게 말해도 됩니다" 시나리오 매핑 섹션 신설 (scenarios.py 와 동기).
  - 8 commands 잔상 제거 — 모든 예제를 `/harness-boot:work` 자연어 형식으로 통일.
  - Iron Law D · drift 10/10 · CQS · events chain 을 "품질 불변량" 한 섹션으로 통합.
  - Phase 1~4 로드맵 · "적은 인원 × 큰 시스템" 마케팅 섹션 제거 — 현실적 현재 상태 + 열린 작업으로 대체.
  - FAQ 4 → 5 항목 · CI 사용법 명시 추가.
  - 뱃지: v0.9.4 · tests 742.
- **`.claude-plugin/plugin.json` · `.claude-plugin/marketplace.json`** — description 완전 교체.
  - 구: "Plan.md 하나로 출발해 ..." (plan.md 만 입력으로 가정하던 v0.2 시절 표현)
  - 신: "Claude Code 용 spec-driven 개발 하네스. 2 개 명령으로 자연어 아이디어부터 완료까지. Iron Law D · drift 10/10 · events.log · 16 에이전트 · 4 루틴 auto-wire."

### v0.9.x 진행

| 버전 | 상태 |
|---|---|
| v0.9.0 | ✅ namespace rename + 6 command 삭제 |
| v0.9.1 | ✅ feature_resolver |
| v0.9.2 | ✅ dashboard + intent_planner |
| v0.9.3 | ✅ Iron Law D + hotfix override |
| **v0.9.4** | ✅ README 전면 개편 · 시나리오 매핑 · 플러그인 description 현대화 |
| v0.9.5 | ⏳ `project.mode` prototype/product 의례 경량화 분기 |
| v0.10.0 | ⏳ legacy shim 제거 · README 상단 재작성 |

### Numbers

- Tests: 722 → 742 (+20 integration).
- README: 370 → 225 줄 (39% 감소).
- self_check 5/5 PASS.
- 신규 모듈 1 개 (`scripts/ui/scenarios.py`) · 신규 test dir (`tests/integration/`).

## [0.9.3] — 2026-04-25

**UX re-architecture step 4 — Iron Law D (누적 declared evidence). BR-004 강화: gate_5 pass + 최근 7 일 declared evidence N 개.**

### Added

- **`scripts/core/state.py`**:
  - `is_declared_evidence(ev) -> bool` — evidence kind 를 automatic vs declared 로 분류. `gate_run` / `gate_auto_run` 만 automatic, 나머지 (test · manual_check · user_feedback · reviewer_check · blocker · hotfix · generic · 미지정 kind) 는 declared. Kind-based 분류로 기존 state.yaml 과 forward-compatible (migration 불필요).
  - `count_declared_evidence(feature, *, window_days=7, now=None) -> int` — 최근 trailing window 내 declared 카운트. ts 누락 / 파싱 실패 entry 는 최근 취급 (보수적 — 타임스탬프 없다고 불이익 없음).
  - `IRON_LAW_D_DEFAULT_WINDOW_DAYS = 7` 상수.
- **`scripts/work.py`**:
  - `_resolve_project_mode(spec) -> "product" | "prototype"` — `spec.project.mode` 읽기, 미정·미지원 값은 `product` (strict default) fallback.
  - `complete(harness_dir, fid, *, hotfix_reason=None)` — Iron Law D 로 전면 교체:
    - product (default): 3 declared.
    - prototype (`spec.project.mode: prototype`): 1 declared.
    - `--hotfix-reason "..."`: product 에서도 1 declared 허용. 사유가 `kind=hotfix` evidence 로 자동 append 되어 audit 에 남음. 빈 사유 거부.
    - 거부 시 state.yaml 불변 — hotfix 경로 rollback 포함.
    - `feature_done` event 에 `iron_law_mode` · `declared_count` · `required` · `hotfix_reason` 첨부.
  - CLI `--hotfix-reason FLAG`.
- **`tests/unit/test_iron_law_declared.py`** — 33 tests:
  - Kind taxonomy (10) · count window (7) · product mode completion (4) · prototype mode (2) · mode resolution edge cases (3) · hotfix override (5) · event metadata (1) · CLI wiring (1).
- **`commands/work.md`** — "완료 (done 전이)" 섹션 Iron Law D 로 재작성 + kind taxonomy 표.

### Changed

- **`tests/unit/test_work.py::CompleteTests`** · **`test_work_autowire.py`** · **`test_work_ux.py`** — 기존 1-evidence 기반 테스트를 3-declared 기반으로 업데이트 (product default 일관). `test_plan_to_done` 은 3 declared (test · manual_check · reviewer_check) 로 확장.

### Design

**왜 "누적 declared" 인가** (요구사항 재검토 결과):
- 기계 필터 (길이 / 키워드 규칙) 는 "ok" 3 번도 통과 — 성의의 역설. 제거.
- 개수 자체가 성실성 신호: 하나하나 짧아도 세 번 쓰는 **행위** 가 의도를 입증.
- TDD 사이클에서 test · manual_check · reviewer_check 는 **자연히** 쌓임 — 억지 요구 아님.
- Hotfix 는 긴급 예외 경로로 인정 (single-entry + reason). audit 에 투명하게 남김.
- Automatic (`gate_run`) 은 gate runner 부산물이라 자기증명에 불인정 — 이게 핵심.

### v0.9.x 진행

| 버전 | 상태 |
|---|---|
| v0.9.0 | ✅ namespace rename + 6 command 삭제 |
| v0.9.1 | ✅ feature_resolver |
| v0.9.2 | ✅ dashboard + intent_planner |
| **v0.9.3** | ✅ Iron Law D + hotfix override |
| v0.9.4 | ⏳ 시나리오 매핑 integration test · README "어떻게 말해도 됩니다" |
| v0.9.5 | ⏳ `project.mode` prototype/product 의례 경량화 |
| v0.10.0 | ⏳ legacy shim 제거 · README 재작성 |

### Numbers

- Tests: 689 → 722 (+33 Iron Law D + 기존 테스트 업데이트).
- self_check 5/5 PASS.

## [0.9.2] — 2026-04-25

**UX re-architecture step 3 — 빈 호출 대시보드 + intent_planner 결정론 추천. `/harness-boot:work` 하나로 상태 파악 + 다음 할 일 한 눈에.**

### Added

- **`scripts/ui/intent_planner.py::suggest(state, spec) -> list[Suggestion]`** — 상태 → Top 1~3 다음 행동 추천. 순수 결정론 (LLM 호출 없음).
  - Active feature 있을 때: `blocked/blocker` 최우선 → gate `fail` 분석+재실행 → 가장 이른 미통과 gate 실행 → `gate_5` 통과+근거 0 → 근거 추가 → 완료 처리.
  - Active 없을 때: `in_progress` 존재 → 이어 작업 / `planned` 존재 → 다음 피처 시작 / 없음 → 새 피처 등록.
  - `Suggestion(label, action, feature_id, gate)` frozen dataclass. `action` 은 machine id (`run_gate` · `complete` · `resolve_block` · ...).
  - Title lookup: 가능한 곳마다 `spec.features[].name` 을 label 에 임베드 — 사용자가 F-N 대신 제목으로 인식.
- **`scripts/ui/dashboard.py::render(state, spec, suggestions) -> str`** — 빈 호출 대시보드 렌더러. 순수 함수 · I/O 없음.
  - 섹션: `작업 중` (title · 검증 N/6 통과 · 근거 N 개 · 차단 note) · `진행 중 (다른)` · `보류` · `대기` · `다음 할 일`.
  - 최근 non-blocker evidence 가 있으면 이전 blocker note 자동 억제 — 해결 후 차단 문구 잔상 제거.
  - "Enter = 1 (추천)" 푸터로 Top 추천 즉시 선택 경로 안내.
- **`scripts/work.py`** — 빈 호출 분기 추가. `python3 scripts/work.py` (feature id 없음) → 대시보드 출력. `--json` 지원 (snapshot shape).
  - `dashboard_snapshot(harness_dir) -> dict` 공개 — State · spec · suggestions · counts · active_feature_id 를 묶어 반환. CQS (읽기 전용).
- **`tests/unit/test_intent_planner.py`** — 22 tests:
  - Suggestion 데이터 형상 · default fields.
  - Idle paths: 빈 state / 계획 only / 진행 중 only / 진행+계획 공존 / dangling active.
  - Gate progression: no gates → gate_0 / gate_0 pass → gate_1 / 0~4 pass → gate_5.
  - Completion: all pass 근거 0 → add_evidence / all pass 근거 ≥ 1 → complete.
  - Fail/block: gate fail → analyze+rerun / blocked status → resolve_block / blocker evidence → resolve_block / blocker 뒤 non-blocker 이면 정상 흐름 복귀.
  - Malformed inputs · title lookup.
  - Max 3 suggestions.
- **`tests/unit/test_dashboard.py`** — 19 tests:
  - Render — 빈 state / active block / 제목 lookup / blocker note / blocker 자동 억제 / title fallback to id.
  - Sections — 진행 중 others / pending / blocked / active 는 others/blocked 에서 제외.
  - Suggestion block — 번호 · 추천 marker · "Enter = 1".
  - CLI integration — `work.py` 빈 호출 · JSON 출력 · state/events mtime 불변 · 파일 생성 없음 · missing harness_dir 에러.
- **`commands/work.md`** — `### 대시보드 (v0.9.2 — 빈 호출)` 섹션 추가.

### v0.9.x 진행

| 버전 | 상태 |
|---|---|
| v0.9.0 | ✅ namespace rename + 6 command 삭제 |
| v0.9.1 | ✅ feature_resolver 모듈 + 테스트 |
| **v0.9.2** | ✅ dashboard + intent_planner (읽기 전용 진입점) |
| v0.9.3 | ⏳ Iron Law D · 누적 declared evidence · hotfix flag |
| v0.9.4 | ⏳ 시나리오 매핑 integration test · README "어떻게 말해도 됩니다" |
| v0.9.5 | ⏳ `project.mode` prototype/product 분기 |
| v0.10.0 | ⏳ legacy shim 제거 · README 재작성 |

### Numbers

- Tests: 666 → 687 (+21 — intent_planner 22 tests 중 일부는 기존 helper 와 중복되지 않음, dashboard 19 tests).
- `scripts/ui/` 총 3 모듈: feature_resolver (v0.9.1) · intent_planner · dashboard.

## [0.9.1] — 2026-04-25

**UX re-architecture step 2 — title fuzzy + @F-N resolver. v0.9 의 "F-N 외우지 않음" 기반 모듈.**

### Added

- **`scripts/ui/`** — 신규 subpackage. UI helpers · slash command 와 결정론 scripts 사이 라우팅 레이어. 향후 dashboard · intent_planner · sync_gate · confirm 모듈의 그릇.
- **`scripts/ui/feature_resolver.py::resolve(query, spec) -> ResolveResult`** — 사용자 입력을 spec.features[] 의 dict 로 해결.
  - `@F-N` 명시 prefix (최우선) — 파워 유저 escape · title 매칭 절대 섞이지 않음.
  - 평문 `F-N` (caps-insensitive) — 기존 CLI 호환.
  - 제목 substring fuzzy (대소문자 무시 · 공백 정규화).
  - 결과 3 종: `single` · `multiple` (2+ 매칭 · caller 가 메뉴 제시) · `none`.
  - 순수 함수 · I/O 없음 · state 변경 없음.
- **`tests/unit/test_feature_resolver.py`** — 21 tests 커버:
  - `@F-N` 명시 (존재/부재/잘못된 패턴/공백)
  - 평문 `F-N` (존재/부재)
  - Title fuzzy (단일/다중/대소문자/공백/부분 단어/무매칭)
  - Edge cases (빈 query · 빈 features · title 없는 feature)
  - 우선순위 (@F-N · F-N 이 title 보다 우선)
  - ResolveResult 데이터 형상

### v0.9.x 진행

| 버전 | 상태 |
|---|---|
| v0.9.0 | ✅ namespace rename + 6 command 삭제 |
| **v0.9.1** | ✅ feature_resolver 모듈 + 테스트 (wiring 은 v0.9.2) |
| v0.9.2 | ⏳ dashboard · intent routing · Plan+Y/n UX |
| v0.9.3 | ⏳ Iron Law D · 누적 declared evidence |
| v0.9.4 | ⏳ 시나리오 매핑 integration test |
| v0.9.5 | ⏳ project.mode prototype/product 축 |

### Tests

646/646 green (625 + 21). self_check 5/5 PASS.

## [0.9.0] — 2026-04-24

**UX re-architecture · 첫 단계. Plugin namespace rename + command surface 8 → 2 collapse. 내부 엔진 변화 없음 · slash command 재조직만.**

### Breaking change — 재설치 필요

Plugin name `harness` → **`harness-boot`** (프로젝트 이름과 일치). 기존 설치는 자동 승계 안 됨:

```
/plugin uninstall harness@harness-boot
/plugin install harness-boot@harness-boot
```

`.harness/` 디렉터리 · spec.yaml · state.yaml · 사용자 작업물 전부 보존 (plugin 이름 무관).

### Changed

- **Slash command 8 → 2**:
  - `/harness-boot:init` — 최초 셋업 (기존 `/harness:init`)
  - `/harness-boot:work` — 일상 (기존 `/harness:work` 가 새 인터페이스로 재구성될 예정 · 현재 기능은 v0.8.10 과 동일)
- **삭제**: `commands/{spec,sync,status,check,events,metrics}.md` (6 파일). 이 기능들은 v0.9.2+ 에서 `/harness-boot:work` 자연어 라우팅으로 흡수 예정. 이번 릴리즈는 파일 삭제만.
- **`commands/init.md`** 상단 재설계 — 자연어 직접 진입 (A · 권장) + 3 옵션 메뉴 (B · fallback) 2 경로:
  - `/harness-boot:init 트위터 같은 거 만들래` → 옵션 1 + 레퍼런스 맥락 주입
  - `/harness-boot:init 빨리 대충 프로토타입` → 옵션 1 + mode hint
  - `/harness-boot:init plan.md 있어` → 옵션 2 (기획 문서)
  - `/harness-boot:init 이미 만들던 코드` → 옵션 3 (기존 프로젝트)
  - 빈 호출 → 3 옵션 메뉴 fallback
- **`plugin.json` + `marketplace.json`**: plugin name `harness` → `harness-boot`.
- **README** 빠른 시작 섹션 재작성 — 2 command + 자연어 중심.

### Removed

- `tests/unit/test_spec_modes.py` — 삭제된 `commands/spec.md` 의 Mode A/B/R/E 계약 검증. v0.9.2 에서 `/harness-boot:work` 자연어 라우팅 re-implementation 후 새 테스트로 대체 예정.

### v0.9.x 로드맵 (예고)

| 버전 | 내용 |
|---|---|
| v0.9.1 | `scripts/ui/feature_resolver.py` · title fuzzy match · `@F-N` escape |
| v0.9.2 | `/harness-boot:work` 빈 호출 → 대시보드 · 자연어 → intent 라우팅 · Plan+Y/n UX |
| v0.9.3 | Iron Law D — 누적 declared evidence (prototype 1 · product 3 · hotfix override) |
| v0.9.4 | 시나리오 매핑 integration test · README "어떻게 말해도 됩니다" |
| v0.9.5 | `project.mode: prototype/product` 축 · 의례 경량화 |
| v0.10.0 | (미정) · v0.9.x 완주 후 재검토 |

### Tests

625/625 green (이전 637 − 12: test_spec_modes 삭제분). self_check 5/5 PASS.

## [0.8.10] — 2026-04-24

**CI hotfix — pytest + coverage added to requirements-dev.txt. v0.8.8's `PytestCommandDetectionTests` failed on CI because the matrix only had pyyaml + jsonschema.**

### Problem

v0.8.8 introduced `_pytest_command()` with two new tests assuming pytest is importable. requirements-dev.txt (v0.8.5 SSoT) only listed pyyaml + jsonschema, so CI matrix on py3.10–3.13 ran without pytest and both tests hit `AssertionError: unexpectedly None`. CI failed on all 4 Python minors.

### Fixed

- **`requirements-dev.txt`** — pytest + coverage added. Comments point to v0.8.10 as the release that added each dep.
- No code changes — just dev dependency widening. CI matrix now installs pytest, so `_pytest_command()` binary-or-module detection succeeds and both tests PASS.

### Lesson captured (again)

This is the second time a test assumption (pytest installed) diverged from the CI environment. v0.8.4 was the first (jsonschema missing). The pattern: when a helper uses a capability, the test asserting the helper's behavior must have that capability guaranteed by requirements-dev.txt. Reviewer checklist entry candidate.

### Tests

CI re-run expected green across py3.10-3.13. Local: 637/637 green (no new tests).

## [0.8.9] — 2026-04-24

**Starter `.gitignore` + `conftest.py` templates — closes the third v0.8.6 e2e finding. Onboarding friction removed.**

### Problem (from v0.8.6 e2e smoke)

- **No `.gitignore` shipped** → `.harness/events.log` · `state.yaml` · `_workspace/` were tracked by default. `/harness:work --run-gate gate_4` (commit check) FAILs on every mutation.
- **No `conftest.py` helper** → Python projects with `src/<pkg>/` layout couldn't run pytest collection or subprocess smoke (`python -m pkg`) without manual `sys.path` / `PYTHONPATH` configuration.

### Added

- **`docs/templates/starter/.gitignore.template`** — ignores mutable harness files (events.log + rotated `events.log.YYYYMM*`, state.yaml, harness.yaml, domain.md, architecture.yaml, `_workspace/`) plus common Python/Node/IDE noise. Comments at bottom list what to **keep** tracking (spec.yaml, chapters/, protocols/). Designed for append-merge when user already has a .gitignore.
- **`docs/templates/starter/conftest.py.template`** — pythonpath injection for `src/<pkg>/` layouts. Handles both pytest collection (`sys.path.insert`) and subprocess propagation (`os.environ["PYTHONPATH"]`). Safe no-op when no `src/` directory exists. Optional — Python projects only.
- **`commands/init.md` §2.5** — new "선택 파일" section documenting when to copy each template, merge policy (`.gitignore` = append · `conftest.py` = manual for existing files), and `--solo` lite-mode skip.
- **`tests/unit/test_starter_schema.py::OptionalStarterTemplatesTests`** — 4 tests: gitignore ships with mutable files listed, gitignore preserves user-editables (spec.yaml · chapters/ · protocols/), conftest ships with sys.path + PYTHONPATH handling, init.md documents both templates.

### End-to-end smoke findings — fully resolved

| Finding | Fix version |
|---|---|
| `shutil.which("pytest")` misses user-site installs | v0.8.8 |
| `--complete` re-emits events on done feature | v0.8.7 |
| retro.md overwritten on re-complete | v0.8.7 |
| No `.gitignore` → gate_4 dirty tree | **v0.8.9** |
| No `conftest.py` → Python smoke fails | **v0.8.9** |

All 5 gaps surfaced by the v0.8.6 greet-e2e live run are now closed.

### Tests

637/637 green (633 + 4 new). self_check 5/5 PASS.

## [0.8.8] — 2026-04-24

**Gate 0/3 pytest detection — covers user-site / venv installs. Second fix from v0.8.6 e2e smoke findings.**

### Problem

`detect_gate_0_command` / `detect_gate_3_command` used `shutil.which("pytest")` to find the test runner. If pytest was installed only as a Python module (pip `--user`, venv without activated PATH, Homebrew site-packages, etc.), the binary wouldn't appear on PATH, so detection fell through to `unittest discover` — which collected 0 tests when the project's layout was pytest-idiomatic. Gate 0 then returned exit 5 (NO_TESTS_COLLECTED) spuriously. Surfaced on the live greet-e2e smoke.

### Fixed

- **`scripts/gate/runner.py::_pytest_command()`** — new helper returns a runnable pytest command:
  1. If `shutil.which("pytest")` → `["pytest"]` (cleanest invocation).
  2. Else if `python -m pytest --version` succeeds → `[sys.executable, "-m", "pytest"]` (covers user-site/venv).
  3. Else `None`.
- **`detect_gate_0_command`** and **`detect_gate_3_command`** both route pytest detection through `_pytest_command()` instead of bare `shutil.which`. Behavior for non-pytest runners (unittest, npm, make, cargo, go) is unchanged.
- **`tests/unit/test_gate_runner.py::PytestCommandDetectionTests`** — 2 new tests verifying the helper returns a callable command on any Python with pytest installed, and module form starts with `sys.executable`.
- Existing `DetectCommandTests` that monkey-patched `shutil.which("pytest") → None` updated to also mock `gr._pytest_command = lambda: None` so they continue to exercise the unittest fallback path.

### Tests

633/633 green (631 + 2 new). self_check 5/5 PASS.

## [0.8.7] — 2026-04-24

**Complete + retro idempotency — closes the third instance of the "ceremony writes unconditionally" pattern. Surfaced by v0.8.6 end-to-end smoke run.**

### Problem

During the live e2e verification (smoke project: `greet-e2e` CLI), `--complete` was called twice on the same `done` feature. Observed: duplicate `feature_done` event, `retro/F-0.md` overwritten, duplicate `feature_retro_written` event. Exact mirror of the kickoff bug fixed in v0.8.2. 3 ceremonies auto-wired × 3 flavors of the same defect → third patch.

### Fixed

- **`scripts/work.py::complete(harness_dir, fid)`** — early return with `action=queried`, message "already done — no re-completion" when feature's status is already `done`. No event emission, no retro autowire.
- **`scripts/ceremonies/retro.py::generate_retro`** gains `force: bool = False`. When `retro/F-N.md` exists and `force=False`: return path without write or event.
- **`scripts/work.py::_autowire_retro`** propagates `force` kwarg (defaults False on automatic calls).
- **New `--retro` CLI flag** forces regeneration (mirrors `--kickoff` and `--design-review`). Emits fresh `feature_retro_written` event and yields `action=retro_refreshed`.

### Ceremony idempotency — now unified across all 3

| Ceremony | Patch | Force flag |
|---|---|---|
| Kickoff | v0.8.2 | `--kickoff` |
| Design Review | v0.8.0 (native) | `--design-review` |
| Retrospective | **v0.8.7** | `--retro` |

The three auto-wired ceremonies now obey the same write-once-then-preserve rule. Consistency contract verified by 4 new tests.

### Tests

631/631 green (627 + 4 new: `CompleteIdempotencyTests` × 2, `RetroForceRefreshTests` × 2). self_check 5/5 PASS.

## [0.8.6] — 2026-04-24

**Phase 2 scale readiness · first step — `events.log` monthly rotation.**

### Why

Events accumulate forever. On a long-running project (the vision's "수년 운영" target) the single `events.log` grows unbounded, and every `/harness:events` / `/harness:metrics` call pays linear parse cost over history. v0.8.6 introduces opt-in rotation that keeps the **write path identical** (no emitter change) while letting queries span split files transparently.

### Added

- **`scripts/core/event_log.py`** — new module with two public functions:
  - `read_events(harness_dir)` — unified event stream across `events.log` + every `events.log.YYYYMM` sibling, returned in timestamp order. Unparseable-ts events sort last but are never dropped.
  - `rotate(harness_dir, *, now_yyyymm=None, dry_run=False)` — moves events whose ts is strictly older than the current month into `events.log.YYYYMM` buckets. Current-month events and events with unparseable ts stay in `events.log`. Returns `{yyyymm: count}` moved. Idempotent.
- **CLI**: `python3 scripts/core/event_log.py rotate [--harness-dir PATH] [--dry-run]`.
- **`tests/unit/test_event_log.py`** — 10 tests: empty harness, single log, merged rotated files, corrupted-line skip, split semantics, append to existing rotated file, idempotency, unparseable-ts preservation, dry-run non-mutation, events.py integration.

### Changed

- **`scripts/events.py`** main path now calls `read_events(harness_dir)` instead of `parse_events(events.log)` — automatically surfaces rotated files. Legacy `parse_events(path)` helper kept for backward compat (any downstream consumer passing a path directly).
- **`scripts/metrics.py`** `compute(log_path, ...)` — when `log_path.name == "events.log"`, routes through `read_events(log_path.parent)`. Other paths fall back to single-file parser (preserves test-only direct-path calls).
- **`commands/events.md`** — new "Log rotation (v0.8.6)" section with CLI usage + writer/reader contract + idempotency guarantee.

### Tests

627/627 green (617 + 10). self_check 5/5 PASS.

## [0.8.5] — 2026-04-24

**Development dependency SSoT — direct follow-up to v0.8.4's lesson.**

### Added

- **`requirements-dev.txt`** — single source of truth for local + CI. Lists `pyyaml` (required) and `jsonschema` (schema validation). Comments point back to v0.8.4 as the incident that justified the file.
- **README §빠른 시작** — local dev setup block showing `python -m pip install -r requirements-dev.txt`, `python -m unittest discover tests/unit`, `bash scripts/self_check.sh`. Mentions CI installs the same file for matrix parity.

### Changed

- **`.github/workflows/self-check.yml`** — install step now runs `pip install -r requirements-dev.txt` instead of inline package names. Keeps CI and local in lockstep. Comment in the workflow references v0.8.4 incident.

### Why

v0.8.4 was a CI-caught bug hidden locally by a missing `jsonschema` install (12 tests silently skipped). The direct lesson: **local dev environment must match CI**. This release formalizes that parity with a manifest.

### Tests

617/617 green (no new tests; existing suite unchanged). self_check 5/5 PASS.

## [0.8.4] — 2026-04-24

**Hotfix: path depth off-by-one after v0.7.6 subpackage relocation. CI (v0.8.3) caught this immediately on first matrix run — exactly what the gate was built for.**

### Problem

v0.7.6 moved `scripts/validate_spec.py` → `scripts/spec/validate.py` (+ two siblings) but retained the original `Path(__file__).resolve().parent.parent` pattern. When the file was at `scripts/validate_spec.py` that resolved to repo root; after the move it resolves to `scripts/`, which is wrong.

Locally the failure was silent — 12 of the 14 `test_validate_spec.py` cases skip when `jsonschema` is not installed, so the broken path code was never exercised. CI installs `jsonschema` in the full matrix, so every Python minor exposed the bug on the first run.

Error message seen in CI:

```
AssertionError: 'features' not found in
'스키마 파일 없음: /home/runner/work/harness-boot/harness-boot/scripts/docs/schemas/spec.schema.json'
                                                     ^^^^^^^
                                                     bogus prefix
```

### Fixed

- `scripts/spec/validate.py::_default_schema_path` — `parent.parent` → `parents[2]`.
- `scripts/spec/conversion_diff.py::REPO_ROOT` — `parent.parent` → `parents[2]`.
- `scripts/spec/mode_b/roundtrip.py::REPO` — `parent.parent` → `parents[3]`.

Comments added to each fixed line pointing to this release so future relocations notice the depth dependency.

### Verification

With `jsonschema` installed locally (matching CI env): 617/617 green, 0 skipped (previously 18 skipped locally because jsonschema was missing — that was what hid the bug). self_check 5/5 PASS.

### Lessons captured

- Dev dependencies file missing — `pyyaml` + `jsonschema` should be documented as expected local deps. Candidate v0.8.5 or v0.9 cleanup item.
- Path-depth discipline — any module that computes repo-relative paths via `__file__` needs a comment stating its depth, so future `git mv` callers know to update it.

## [0.8.3] — 2026-04-24

**Phase 3 CI — GitHub Actions self-check workflow. Every PR + push to main/develop runs the full suite + self_check against Python 3.10-3.13.**

### Added

- **`.github/workflows/self-check.yml`** — matrix build (Python 3.10 · 3.11 · 3.12 · 3.13) on Ubuntu. Triggers on push to `main` / `develop` and on any PR targeting those branches. `fail-fast: false` so each Python minor reports independently.
- Pipeline steps:
  1. Checkout (fetch-depth 1).
  2. Setup Python with `actions/setup-python@v5`.
  3. Install `pyyaml` + `jsonschema` (CI runs the full matrix with structural validation enabled).
  4. `python -m unittest discover tests/unit --verbose` — full 617-test regression.
  5. `bash scripts/self_check.sh` — SSoT · validate · sync · check · commands 규약 5 steps.
- **Concurrency group** keyed on ref name — in-progress runs cancel when a new push lands.

### Why

Closes one of the v1.0 checklist items: automated regression gate on public branches. Before v0.8.3 the suite ran only locally; now it's enforced on every PR before merge.

### Tests

617/617 green locally (CI will mirror on first run). self_check 5/5 PASS.

## [0.8.2] — 2026-04-24

**Kickoff idempotency patch — re-activate no longer overwrites curated kickoff headings. Brings kickoff in line with design-review's idempotency policy.**

### Problem (surfaced in v0.8.0 live smoke test)

`scripts/work.py::_autowire_kickoff` called `kickoff.generate_kickoff` unconditionally. Re-activating the same feature (even via `--current` follow-up by orchestrator) re-wrote `_workspace/kickoff/F-N.md`, wiping any heading content that had been curated between calls. Also emitted a duplicate `kickoff_started` event each time.

### Fixed

- **`ceremonies.kickoff.generate_kickoff`** now accepts `force: bool = False`. When the kickoff.md already exists and `force=False`, the function returns the existing path without rewriting the file or emitting an event.
- **`scripts/work.py::_autowire_kickoff`** passes `force=False`, so autowire re-runs are silent idempotent skips.
- **`--kickoff` CLI flag** — explicit force re-generation for cases where the agent lineup needs to refresh (e.g., `ui_surface.present` flipped true, or `has_audio` changed). Mirror of `--design-review` pattern. Emits new `kickoff_started` event and yields action=`kickoff_refreshed`.
- `commands/work.md` Kickoff Ceremony section documents the idempotency rule + `--kickoff` flag usage.

### Tests

617/617 green (612 + 5: 3 idempotency tests covering re-activate preservation, single event emission, record_gate no-re-fire; 2 force-refresh tests). self_check 5/5 PASS.

### Live smoke evidence

This patch was triggered by direct verification. Before: events.log showed two `kickoff_started` entries from two `activate` calls. After: one entry, regardless of how many state-mutating work calls touch the feature.

## [0.8.1] — 2026-04-24

**Agent eval fixture coverage reaches 15/15 — v1.0 체크리스트의 fixture 항목 완결.**

### Added — 8 새 fixtures

| Agent | producer_type | output_path |
|---|---|---|
| `backend-engineer` | code | null (OpenAPI + src/domain + tests/domain 조합) |
| `security-engineer` | markdown | `.harness/_workspace/security/report.md` (STRIDE + Findings + Verdict) |
| `performance-engineer` | markdown | `.harness/_workspace/perf/report.md` (Budget + Measurements + Verdict) |
| `audio-designer` | yaml | `.harness/_workspace/design/audio.yaml` (sound/loudness/freq_strategy/reduced_motion) |
| `qa-engineer` | markdown | `.harness/_workspace/qa/strategy.md` (Risk Map + Test Strategy + Coverage) |
| `integrator` | markdown | `.harness/_workspace/integration/notes.md` (Assembly + CI + Gate 5 Override) |
| `orchestrator` | markdown | null — prose returned to user (상태 전이 + 참여 에이전트 + BLOCK + 다음 단계) |
| `reviewer` | markdown | null — prose returned to orchestrator (CQS · BR-012 엄수) |

각 fixture 는 역할 경계 침범을 막는 `forbidden_phrases` 포함:
- qa-engineer 가 `LUFS` (audio-designer 어휘) · `bench` (performance-engineer 영역) 사용 금지
- integrator 가 `새 ADR 추가` 금지 (product-planner 영역)
- reviewer 가 `Edit(` · `Write(` · `TODO: fix` 사용 금지 (CQS 위반 정후)
- orchestrator 가 `WCAG SC` · `CVSS` 사용 금지 (도메인 전문가 영역)

### Coverage

| 이전 (v0.7.4) | v0.8.1 |
|---|---|
| 7/15 fixtures | **15/15 fixtures** |

### Tests

612/612 green (fixture 8 추가는 새 테스트 없이 기존 파라메트릭 스키마에 통합 · 모두 green). self_check 5/5 PASS.

## [0.8.0] — 2026-04-24

**Ceremony auto-wire 4/4 완결 — design-review 자동 발화 (마지막 남은 수동 ceremony 해소).**

### Added

- `scripts/work.py::_autowire_design_review(harness_dir, fid, *, force=False)` — state-mutating work.py 호출 말미에서 3 조건 AND readiness 평가:
  1. `features[F-N].ui_surface.present == true` — UI 없는 피처는 design-review 의미 없음
  2. `.harness/_workspace/design/flows.md` 존재 — ux-architect delivered
  3. `.harness/_workspace/design-review/F-N.md` 미존재 — idempotent
- 4 wiring 지점: `activate`, `record_gate`, `add_evidence`, `run_and_record_gate`. 각 호출 말미에 조건 체크 후 필요 시 `ceremonies.design_review.generate_design_review` 호출. kickoff/retro 와 동일하게 silent-swallow exceptions (ceremony 오류가 state mutation 을 실패시키지 않음).
- `--design-review` CLI flag — idempotent (조건 3) 우회, 기존 design-review/F-N.md 덮어쓰고 재생성. UI 조건 (1) 과 flows.md 조건 (2) 는 여전히 적용.
- `tests/unit/test_work_design_review.py` — 10 tests: auto-fire conditions (5) · multiple trigger points (3) · has_audio propagation (1) · force re-generate flag (1).

### Changed

- `commands/work.md` Design Review Ceremony 섹션 전면 개정:
  - "prose-contract 수동 호출" → "v0.8 auto-wire"
  - 3 조건 readiness check 규약 명시
  - `--design-review` flag 안내

### Ceremony 자동화 현황 (v0.8.0 시점)

| Ceremony | 상태 | 트리거 | 버전 |
|---|---|---|---|
| Kickoff | ✅ auto | `work.activate` | v0.7 |
| Retrospective | ✅ auto | `work.complete` | v0.7 |
| Design Review | ✅ auto | 3 조건 readiness (state-mutating calls) | **v0.8** |
| Q&A file-drop | 🟡 poll | `inbox.py --feature` — orchestrator 주기 polling | — |

Q&A 는 "protocol" 성격이라 auto-wire 대상 아님 — orchestrator 가 stage 경계에서 `inbox.py` 로 poll 하는 게 설계 의도.

### Tests

612/612 green (602 + 10). self_check 5/5 PASS.

### Version policy note

v0.8.0 은 **minor bump**. 사유 = ceremony auto-wire 스토리 (4/4) 의 마일스톤 완결. 이전 v0.7.x patch 시리즈와 달리 사용자 대면 capability (자동 발화) 의 구조적 변화.

## [0.7.6] — 2026-04-24

**Deeper scripts/ reorganization — root cleaned to 6 primary command entries. Internal refactor only; `/harness:*` behavior byte-for-byte identical.**

### Refactored

- **13 더 많은 파일 서브패키지로 이동** (v0.7.5 는 내부 전용 8 만 이동, v0.7.6 은 공개 CLI 포함 모두 정리):
  - `state.py` · `canonical_hash.py` · `plugin_root.py` → `core/`
  - `gate_runner.py` → `gate/runner.py`
  - `kickoff.py` · `retro.py` · `design_review.py` · `inbox.py` → `ceremonies/`
  - `validate_spec.py` → `spec/validate.py`
  - `explain_spec.py` → `spec/explain.py`
  - `spec_diff.py` → `spec/diff.py`
  - `spec_mode_classifier.py` → `spec/mode_classifier.py`
  - `mode_b_extract.py` → `spec/mode_b_extract.py`
- **scripts/ 루트에 6 primary CLI 만 남음**: `sync · work · status · check · events · metrics`. 4 subdir (`core` · `gate` · `ceremonies` · `spec` · `render`) 로 나머지 분산.
- `commands/*.md` 의 `$PLUGIN_ROOT/scripts/<name>.py` 참조 18 군데 일괄 업데이트. 사용자는 `/plugin update` 한 번이면 byte-for-byte 동일 경험.
- 모든 cross-import 경로 업데이트 (`import state` → `from core.state import` 등). 3 루트 CLI (work/check/sync/status) + 13 moved 파일 + 21 test 파일 커버.
- `scripts/self_check.sh` 의 `validate_spec.py` 경로 보정.

### Added

- 새 3 서브패키지 `__init__.py` — 책임 경계 + 호출 방향 명시 (`core` 는 아무 것도 호출 않음; 다른 서브패키지는 `core` 만 호출; 서브패키지 간 상호 호출 금지).
- `scripts/README.md` 전면 개정 — 5 서브패키지 레이아웃 · 의존 그래프 · 공개 CLI 표.

### Changed — 버전 정책 명시화

v0.7.5 에서 "공개 CLI 경로 변경은 major bump" 라고 기록했던 문구를 **철회**. 실제 계약은:

- **사용자 대면**: `/harness:*` 슬래시 명령만. 이게 진짜 공개 API.
- **내부 구현 경로**: `scripts/**/*.py` 는 patch 단위로 자유롭게 이동 가능. commands/*.md 가 동일 커밋에서 갱신되고 테스트가 녹색이면 OK. `/plugin update` 후 사용자는 변화를 인지하지 않음.

이 구분이 scripts/README.md §"버전 정책" 에 고정됨.

### Tests

602/602 green (baseline 동일). self_check 5/5 PASS. `git mv` 로 history 보존.

## [0.7.5] — 2026-04-24

**Internal refactor — scripts/ directory organization + professional docstrings. No user-facing behavior change.**

### Refactored

- **scripts/ 디렉터리 정리** — 내부 전용 모듈 8 개를 서브패키지로 이동. 공개 CLI 경로 (commands/*.md 가 참조하는 `scripts/<name>.py`) 는 **전부 그대로** — `/harness:*` 동작에 영향 없음.
  - `render_domain.py` → `render/domain.py`
  - `render_architecture.py` → `render/architecture.py`
  - `include_expander.py` → `spec/include_expander.py`
  - `conversion_diff.py` → `spec/conversion_diff.py`
  - `upgrade_to_2_3_8.py` → `spec/upgrade_to_2_3_8.py`
  - `mode_b_axes.py` → `spec/mode_b/axes.py`
  - `mode_b_roundtrip.py` → `spec/mode_b/roundtrip.py`
  - `mode_b_stopwords.py` → `spec/mode_b/stopwords.py`
- 각 서브패키지에 `__init__.py` + module docstring (책임 경계 · 호출 방향 명시).
- 소비자 import 경로 업데이트 (sync · check · mode_b_extract · 3 test 파일) — `import X` → `from <pkg> import X`.

### Added

- `scripts/README.md` — 29 파일 인벤토리 · 의존 방향 다이어그램 · 공개 vs 내부 표시 · 테스트/버전 정책. 새 기여자가 "어디에 코드 추가할지" 즉시 파악 가능.
- 전문 수준 module docstring 보강 (`retro.py` · `render/domain.py` · `render/architecture.py` · `spec/mode_b/stopwords.py` · `spec/mode_b/axes.py`): 공개 API · 섹션 순서 · 결정론 계약 · 이벤트 스키마 계약 · CLI 사용법 · 업그레이드 경로 명시.

### Version policy 확립

- **공개 CLI 경로** (`scripts/<name>.py`) 변경은 **major bump** (v1.0+) 대상. commands/*.md 가 직접 참조하므로.
- **내부 서브패키지** (`scripts/render/*`, `scripts/spec/*`, `scripts/spec/mode_b/*`) 는 자유 재편.
- 이 규약은 `scripts/README.md` §"버전 정책" 에 고정.

### Tests

602/602 green (baseline 동일, 변경된 테스트는 3 파일의 import 경로 뿐). self_check 5/5 PASS.

## [0.7.4] — 2026-04-24

**Design-tier Platform access + fixture schema for YAML/code producers.**

### Added

- `scripts/render_domain.py` 에 `## Platform` 섹션 렌더러 (v0.7.4). `constraints.tech_stack` (runtime · min_version · language · test · build + 추가 필드) 가 선언돼 있으면 Project 바로 뒤 · Stakeholders 앞에 렌더. Tier 1 only agents (visual-designer · a11y-auditor) 가 architecture.yaml(Tier 2) 접근 없이도 플랫폼 맥락에 닿음. tech_stack 부재/비어있음 시 섹션 자체 생략.
- `agents/visual-designer.md` + `agents/a11y-auditor.md` Context 블록 업데이트 — domain.md 의 Platform 섹션을 명시적으로 참조 (runtime=browser → system-ui · runtime=ios → Dynamic Type 등 플랫폼별 기본값 규약).
- `tests/unit/test_agent_fixtures.py` — `producer_type` 필드 지원 (`markdown` 기본 · `yaml` · `code`). 타입별 요구 키 디스패치: markdown → required_sections_in_order · yaml → required_top_keys · code → required_file_patterns. 기존 v0.7.2 fixture 5 개는 producer_type 생략 시 markdown 으로 간주되어 계속 PASS.
- `tests/fixtures/agent-evals/visual-designer/` (producer_type=yaml) · `tests/fixtures/agent-evals/software-engineer/` (producer_type=code) — 2 개 non-markdown fixture 추가. 총 7 agents 커버.
- `tests/unit/test_render_domain.py::PlatformSectionTests` — 5 tests (부재 · 존재 · 순서 · 부분 필드 · 빈 stack 처리).

### Tests

602/602 green (594 + 8). self_check 5/5 PASS.

## [0.7.3] — 2026-04-24

**ADR supersedes drift check + gate_perf with performance_budget integration.**

### Added

- `scripts/check.py::check_adr_supersedes(spec)` — 10 번째 drift 종류 `Adr`. `decisions[].supersedes[]` 가 가리키는 ADR 의 `status` 가 `superseded` 가 아니면 warn (domain.md 가 동일 주제에 두 개의 accepted ADR 을 렌더하는 모순 방지). supersedes 가 존재하지 않는 ADR id 를 가리키면 dangling reference warn. SSoT 원칙 유지 — 자동 수정 없음 (사용자 개입 필요).
- `scripts/gate_runner.py::run_gate_perf` — performance_budget 기반 perf 게이트. auto-detect 없음 (perf 도구 다양성), `harness.yaml.gate_commands.gate_perf` 또는 `--override-command` 로 커맨드 공급 필수. 기본 timeout 900s. run_gate dispatcher 에 gate_perf 등록.
- `scripts/work.py::_format_performance_budget(budget)` — budget dict → 한 줄 요약 (`lcp_ms=2500 · inp_ms=200 · bundle_kb=180 · api_startup_ms=300`). gate_perf pass 시 evidence summary 에 자동 주입 (`gate_run` kind).
- `tests/unit/test_check.py::AdrSupersedesDriftTests` — 6 tests.
- `tests/unit/test_gate_runner.py::RunGatePerfTests` — 5 tests (pass/fail override, skipped 기본, harness.yaml override, dispatcher 인식).
- `tests/unit/test_work_autowire.py::PerfGateBudgetIntegrationTests` — 2 tests (perf gate pass 시 budget summary 주입 · 다른 gate 는 주입 없음).

### Changed

- `commands/check.md` — 10/10 drift 로 변경, Adr 섹션 추가, Preamble "9 종" → "10 종".
- `commands/work.md` — Gate 자동 실행 목록에 gate_perf 라인 추가.

### Tests

594/594 green (581 + 13). self_check 5/5 PASS.

## [0.7.2] — 2026-04-24

**Agent eval fixture expansion + skipped_agents state API.**

### Added

- `tests/fixtures/agent-evals/{researcher,product-planner,a11y-auditor,tech-writer}/` — 4 new fixture directories. Each ships `input.md` (representative brief) + `expected-structure.yaml` (required sections, phrases, forbidden phrases). Now 5 agents covered (+ existing ux-architect).
- `tests/unit/test_agent_fixtures.py` — parametric schema check. Auto-discovers any directory under `tests/fixtures/agent-evals/` and validates required keys, section H2/H3 form, agent name ↔ directory match. Future fixtures: drop a directory, tests pick it up.
- `scripts/state.py::add_skipped_agent(fid, agent, reason)` + `get_skipped_agents(fid)` — v0.5 routing policy had documented `skipped_agents[]` but state.py never implemented the write API. Silent skip policy remains orchestrator business; state now has the substrate. Refuses empty reason (audit-trail integrity).
- `tests/unit/test_state.py::SkippedAgentsTests` — 6 tests covering add/read, order, empty-input refusal, save/load round-trip.

### Scope pivot

Original v0.7 PR-β scope listed "15 agents × 3 대표 입력 회귀". Reduced to 4 new markdown-producing agents: engineers (frontend/software) and visual-designer emit code/YAML, which the current markdown-section schema does not fit. v0.7.3+ will extend the schema for those agent classes.

### Tests

581/581 green (566 + 15). self_check 5/5 PASS.

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
