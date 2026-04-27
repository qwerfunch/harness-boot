# harness-boot — 플러그인 개발 레포

> 이 CLAUDE.md 는 **이 레포에서 플러그인을 개발할 때** 읽는 컨텍스트입니다.
> `docs/templates/starter/CLAUDE.md.template` 는 `/harness-boot:init` 이 **사용자 프로젝트에** 쓰는 별개 파일이며 이 파일과 혼동하지 마세요.

## 1. 이 레포가 뭐냐

Claude Code 플러그인 `harness-boot` 의 소스. 사용자는 `/harness-boot:init` 로 자기 프로젝트에 `.harness/` 골격을 설치하고, 이후 `/harness-boot:work` 한 명령으로 피처 사이클(activate → gate → evidence → complete)을 돌린다. v0.9.0 의 UX 재구조화로 외울 명령은 2 개로 통합됨.

- **현재 릴리즈**: v0.11.0 (2026-04-27 태그 · F-047 vision consolidation). 마켓플레이스 PR 은 사용자 결정 시점까지 보류 (memory: marketplace_timing). 누적 이력 상세는 `git log` / `CHANGELOG.md` 참조.
- **설치 경로**: `/plugin marketplace add qwerfunch/harness-boot` → `/plugin install harness-boot@harness-boot`. 업그레이드 `/plugin update harness-boot@harness-boot`.
- **SemVer 정책**: patch-first. 새 기능이라도 X.Y.Z+1. minor/major 는 사용자 확인 + 큰 마일스톤 한정.
- **라이선스**: MIT · Author: qwerfunch

## 2. 지금 어디쯤 있나

**v0.10.7 — Phase 2 self-hosting active + observability + scaling preparedness** (2026-04-27).

핵심 누적:
- **2 슬래시 명령** (`/harness-boot:init` · `/harness-boot:work`) — v0.9.0 통합. init 은 자연어 직진 또는 3 옵션 메뉴, work 는 무인자(no-args dashboard, v0.9.2) · 인텐트 자연어 · F-ID 직접 호출 모두 지원.
- **Gate 자동화 0/1/2/3/5 전부** — `scripts/gate/runner.py` 가 pyproject pytest · npm scripts (typecheck/lint/test:coverage/smoke/test:e2e, v0.10.2) · 도구 직접 호출 · 언어별 polyglot fallback 순으로 자동 감지. **BR-004 Iron Law (gate_5=pass + 선언 evidence ≥ N) 전 구간 자동.**
- **Iron Law D — cumulative declared evidence** (v0.9.3) + **product mode strict** (v0.10.3) — `project.mode == product` 일 때 record 된 모든 gate 의 last_result 가 fail 이 아닐 것까지 강제. prototype 은 lighter contract.
- **Project mode 축** (v0.9.6) — `spec.project.mode ∈ {prototype, product}` 단일 스위치가 Iron Law D 임계값 · kickoff/retro 템플릿 · design-review autowire 전부를 결정. 미지정 → product (strict default).
- **Drift 탐지 8/8** + **Two-layer supersession metadata + Stale drift** (v0.10.0) — `features[].supersedes` / `superseded_by` 와 archive flow.
- **Ceremonies 자동화 4/4** — kickoff · retro · design-review · inbox.
- **자체 도그푸드 Phase 2 active** (2026-04-27) — `.harness/` 가 active workspace. 본 레포의 새 피처도 `python3 scripts/work.py F-N --harness-dir .harness` 사이클을 거침. 자세한 규약은 §7 참조.
- **Init/work observability** (v0.10.5) — `commands/{init,work}.md` 의 `## Issue logging` 섹션 + `hooks/prompt-log.sh` UserPromptSubmit hook. 사용자 프로젝트의 `.harness/_workspace/{issues-log.md, prompts/YYYY-MM.jsonl}` 누적 → 메인테이너 환원 사이클 트리거 + prompt 형상화.
- **Scaling preparedness** (v0.10.6) — `features[]` 에 5 additive fields (area · archived_at · archive_reason · digest · include_path) + `scripts/spec/{shard,unshard,summary}.py` sharding 도구 + `tests/scale/test_scale.py` 100/1000/3000/10000 features 실측. 사용자는 ~300 임계점까지 안 호출해도 무방.
- **cosmic-suika ISSUES-LOG batch return** (v0.10.7) — I-003 (tsconfig 권장값) · I-004 (risks[].id pattern 완화) · I-006 (`--kind trivial` 의미 명시) · I-007 (changelog version optional) — F-027 컨벤션의 첫 환원 사이클.
- **누적 테스트**: 883 (CHANGELOG v0.10.7 기준 unittest). 41 test 파일.

**다음 작업 후보**: §9 참조.

## 3. 레포 구조 (실제로 트래킹되는 것만)

```
.claude-plugin/
├── plugin.json                     # 플러그인 매니페스트 (name: "harness-boot", v0.10.7)
└── marketplace.json                # single-plugin marketplace
.harness/                           # Phase 2 active dogfood workspace (§7)
├── spec.yaml                       # docs/samples/harness-boot-self/spec.yaml 의 복사본 (diff -q 강제)
├── state.yaml                      # work.py 가 갱신, 수동 편집 금지
├── README.md                       # 도그푸드 정책 짧은 안내
├── domain.md · architecture.yaml   # gitignored (sync 가 파생)
├── harness.yaml · events.log       # gitignored
├── chapters/                       # gitignored
└── _workspace/                     # gitignored (ceremonies — kickoff · retro · design_review · questions)
commands/                           # 2 슬래시 명령 (v0.9.0 통합)
├── init.md · work.md
agents/                             # 15 fixtures (v0.8.1 완결)
hooks/                              # hooks.json + scripts/ (v0.4 ship)
skills/spec-conversion/             # plan.md → spec.yaml 변환 스킬
scripts/                            # Python 구현 (v0.7.6 subpackages 정리)
├── work.py · sync.py · status.py · check.py · events.py · metrics.py · self_check.sh
├── core/                           # canonical_hash · event_log · plugin_root · project_mode · state
├── ceremonies/                     # design_review · inbox · kickoff · retro
├── gate/                           # runner (Gate 0/1/2/3/5 auto)
├── render/                         # architecture · domain
├── spec/                           # validate · mode_classifier · explain · diff · conversion_diff
│                                   # · include_expander · mode_b_extract · upgrade_to_2_3_8
└── ui/                             # dashboard · feature_resolver · intent_planner · scenarios
tests/unit/                         # 38 test 파일 · 838+ tests
tests/regression/conversion-goldens/   # golden samples + MANIFEST
docs/
├── schemas/spec.schema.json        # spec v2.3.8 JSONSchema (Walking Skeleton 강제 + project.mode)
├── samples/harness-boot-self/      # self-referential canonical spec (24 features → 25 with F-025)
├── templates/starter/              # /harness-boot:init 이 복사하는 템플릿 (CLAUDE.md.template 등)
├── glossary/BRAND_TERMS.md         # F-041 — 28 brand jargon (Walking Skeleton · Iron Law D · …)
├── i18n/README.md                  # F-040 — runtime locale 정책
├── preamble-spec.md                # F-042 — Preamble + NO skip / NO shortcut 단일 source
└── archive/                        # F-042 — historical (local-install · first-run · v0.1.0 / v0.4 plans · i18n-ko-frozen-f041/)
.github/workflows/self-check.yml    # Phase 3 CI (v0.8.3) — PR 마다 self_check.sh
README.md · CHANGELOG.md · LICENSE · CLAUDE.md (이 파일) · requirements-dev.txt
```

**트래킹 안 되는 것** (.gitignore): `design/` · `legacy/` · `translations-ko/` · `node_modules/` · `.harness/{events.log,harness.yaml,domain.md,architecture.yaml,chapters/}` 등.

## 4. 현재 git 상태

- **태그**: v0.1.0 ~ v0.10.7 원격 push 완료 (v0.10.4 retroactive). 태그 이동 금지.
- **main HEAD**: `2610829 feat(v0.10.7): cosmic-suika ISSUES-LOG batch return (I-003 / I-004 / I-006 / I-007)`
- **default branch**: main (마켓플레이스 fetch ref). 작업 브랜치는 `feat/v0.X.Y-*` / `fix/v0.X.Y-*` 패턴, main 으로 fast-forward 머지.
- **작업 트리**: clean
- **다음 분기**: 백로그 (§9) 또는 cosmic-suika ISSUES-LOG 환원 후속.

## 5. 커밋 히스토리 맥락

**v0.10.x 라인 — Phase 2 self-hosting + cosmic-suika ISSUES-LOG 환원 + observability + scaling preparedness** (2026-04-27 cluster):
- `2610829 feat(v0.10.7): cosmic-suika ISSUES-LOG batch return (I-003 / I-004 / I-006 / I-007)` (tsconfig 권장 + risks pattern + kind=trivial + changelog version optional)
- `3e8160a feat(v0.10.6): scaling preparedness — F-029 schema + F-030 sharding tools + F-031 stress test` (1000~10000 features 사후 마이그레이션 비용 회피)
- `36dab82 feat(v0.10.5): init/work observability — issue logging (F-027) + prompt logging (F-028)` (cosmic-suika ISSUES-LOG 패턴 표준화)
- `bc8e539 feat(v0.10.4): Phase 2 self-hosting active — F-025/F-026 + smoke shim + pytest scope` (Phase 1 → Phase 2 flip)
- `38eba96 feat(v0.10.3): cosmic-suika I-008 — Iron Law D product mode strict` (record 된 gate fail 시 complete 차단)
- `2a4c66d feat(v0.10.2): cosmic-suika I-001 — npm scripts auto-detection in gate runner`
- `89c5776 feat(v0.10.1): cosmic-suika ISSUES-LOG patch — AnchorIntegration drift + no-args dashboard candidates`
- `ede6f98 feat(v0.10.0): two-layer supersession — features[] supersedes/superseded_by + archive flow + Stale drift`

**v0.9.x 라인 — UX 재구조화 + Iron Law D + 모드 축 도입**:
- `e969e28 feat(v0.9.0)!: UX re-architecture step 1 — namespace rename + command consolidation` (8 → 2 commands, `harness` → `harness-boot`)
- `87a490c feat(v0.9.1): feature_resolver module + scripts/ui/ scaffolding`
- `9d31637 feat(v0.9.2): dashboard + intent_planner — no-args entry point`
- `1a631ab feat(v0.9.3): Iron Law D — cumulative declared evidence + hotfix override`
- `8194716 feat(v0.9.4): README overhaul + scenario contract table + plugin description modernization`
- `db9d0db feat(v0.9.6): project mode axis — prototype/product ceremony lightening`

**v0.8.x 라인 — agent fixtures + ceremonies + CI**:
- `66c8a25 feat(v0.8.0): design-review auto-wire closes 4/4 ceremony automation`
- `aae9e8f feat(v0.8.1): complete agent-eval fixtures 15/15`
- `9746770 feat(v0.8.3): Phase 3 CI — GitHub Actions self-check workflow`
- `1bc95a8 feat(v0.8.6): events.log monthly rotation`

**v0.7.x 이전** (subpackage 정리 · gate auto-runners) 은 `git log --oneline v0.7.0..HEAD` 또는 태그 목록(`git tag --sort=-version:refname`)으로 소급.

## 6. 참고 문서 지도

| 무엇을 하려면 | 읽을 파일 |
|---|---|
| 현재 상황 30 초 파악 | `README.md` + 이 파일 |
| **Claude Code 에서 이어 작업** | `design/HANDOFF-to-claude-code.md` (gitignored) |
| 첫 실행 검증 | `docs/archive/first-run-checklist-v0.1.0.md` (F-042 archive) |
| 태깅·릴리즈 플레이북 | `docs/archive/release-v0.1.0-playbook.md` (F-042 archive · v0.10.x 동일 적용) |
| 전체 변경 이력 | `CHANGELOG.md` |
| 슬래시 명령 스펙 | `commands/{init,work}.md` (preamble 규약 · NO skip / NO shortcut 2 행 BR-014) |
| 스펙 v2.3.8 JSONSchema | `docs/schemas/spec.schema.json` |
| **self-referential canonical spec** | `docs/samples/harness-boot-self/spec.yaml` — `.harness/spec.yaml` 의 SSoT |
| 스킬 v0.5 구현 가이드 | `skills/spec-conversion/SKILL.md` |
| 스크립트 레이어 테스트 | `tests/unit/test_*.py` (38 파일, 838+ tests) |
| Project mode 의미론 | `scripts/core/project_mode.py` (prototype vs product 차이 docstring) |
| Self-hosting 부록 | `docs/archive/local-install-v0.1.0.md` 부록 A (F-042 archive) |
| 로컬 메모리 (사용자 스타일 · 진행 기록) | `~/.claude/projects/.../memory/MEMORY.md` (gitignored) |

## 7. 작업 규칙

- **design/ 는 개인 작업 공간**. 절대 `git add` 하지 마세요. 공개할 가치가 있으면 `docs/` 로 승격.
- **legacy/ 도 동일**. 트래킹된 기존 파일만 유지, 새 파일 추가 금지.
- **플러그인은 자기 자신에 설치되지 않음**. 이 레포에 `/harness-boot:init` 실행 금지 — 플러그인 소스 자체를 덮어쓴다.

- **자체 도그푸드 정책 — Phase 2 active** (2026-04-27 부터):
  - **새 피처는 모두 work.py 사이클을 거친다**. cosmic-suika 외부 dogfood 와 동일 규약. "리팩터" / "문서만" / "작은 fix" 도 예외 아님.
  - 사용 명령:
    ```
    python3 scripts/work.py F-N --harness-dir .harness                        # activate
    python3 scripts/work.py F-N --harness-dir .harness --run-gate gate_0      # ... 1, 2, 3, 5
    python3 scripts/work.py F-N --harness-dir .harness --evidence "..."       # declared evidence
    python3 scripts/work.py F-N --harness-dir .harness --complete             # 전이
    ```
  - 슬래시 명령은 **이 레포에서 live-edit 가 안 됨** (설치본이 우선). 따라서 항상 `python3 scripts/work.py` 직접 호출이 dev 진입점. (사용자 프로젝트에서는 `/harness-boot:work` 가 래퍼.)
  - `.harness/state.yaml` 커밋은 feature PR 단위로 같이 나감 (이전 Phase 1 의 "릴리즈 태그 시점에만" 제한 해제).
  - `events.log` 에 lifecycle 이벤트 (`feature_activated` · `gate_run` · `evidence_declared` · `feature_completed`) 가 누적되며, `/harness-boot:work` 대시보드 · `scripts/metrics.py` 가 진짜 lead time / gate pass rate 출력.
  - `project.mode` 는 `prototype` (현재 기본) — Iron Law D 는 evidence ≥ 1 + gate_5 pass. product 로 promote 는 사용자 결정.

- **공통 규칙** (Phase 무관):
  - `.harness/spec.yaml` 은 `docs/samples/harness-boot-self/spec.yaml` 의 **복사본** (symlink 아님). `scripts/self_check.sh` 가 `diff -q` 로 동기성 강제. 새 피처 추가는 **양쪽 동시에**.
  - `events.log` · `harness.yaml` · `domain.md` · `architecture.yaml` · `chapters/` · `_workspace/` 는 gitignored.
  - 사용자 충돌 없음: 사용자가 `/harness-boot:*` 실행 시 항상 `$(pwd)/.harness` 만 참조 — 우리 내부 `.harness/` 는 invisible.

- **슬래시 명령 사용 경로** (2026-04-23 검증, 2026-04-27 재확인):
  - 작동: `/plugin marketplace add qwerfunch/harness-boot` + `/plugin install harness-boot@harness-boot` → `/harness-boot:{init,work}` 사용 가능. 업그레이드 `/plugin update harness-boot@harness-boot`.
  - 미작동: `CLAUDE_PLUGIN_ROOT` env / `settings.json plugins[]` 로 dev checkout 라이브 반영 — 설치본이 우선.
  - 결론: 편집 즉시 슬래시 반영은 불가. **이 레포 내부 dev workflow 는 항상 `python3 scripts/*.py` 직접 호출**. 슬래시 검증은 release → `/plugin update` 루프.
  - 상세: `docs/archive/local-install-v0.1.0.md` §2 + 부록 A (F-042 archive).

- **태그는 절대 이동 금지**. 깨진 버전은 yank + hotfix (`docs/archive/release-v0.1.0-playbook.md` §5 · F-042 archive).
- **main 은 default branch**. 머지는 `feat/v0.X.Y-*` 브랜치에서 PR → main fast-forward.
- **Patch-first 버전 정책**: 새 기능이라도 X.Y.Z+1. minor/major 는 사용자 확인 + 큰 마일스톤 한정.
- **버전 릴리즈는 사용자 결정**: 자동 태깅 금지. 커밋·머지는 자유, 태그·release notes 는 사용자 명시 후.
- **커밋/PR 언어**: 영어. 응답/설명 언어: 한국어 (파일 내용은 문맥에 따라).
- **Anti-rationalization**: 2 commands 모두 Preamble 3 줄 직후 "NO skip / NO shortcut" 2 행 필수 (BR-014).
- **CQS 강제**: read-only 명령 (`status` · `check` · `events` · `metrics`) 은 대상 파일 mtime 을 변경하지 않음. 테스트가 mtime 불변을 확인.

## 8. 알려진 제한사항 (v0.10.7 기준)

**닫힘 (이전 CLAUDE.md 시점 대비)**
- v0.4 ~ v0.7: agent fixtures 15/15 · ceremonies 4/4 · subpackages 정리 · gate auto-runners.
- v0.8.x: Phase 3 CI · events.log monthly rotation · agent fixtures 완결 · design-review autowire.
- v0.9.x: 명령 통합 (8 → 2) · feature_resolver · no-args dashboard · Iron Law D · README user-friendly · project mode axis.
- v0.10.0~3: two-layer supersession + Stale drift · cosmic-suika I-001/I-008/I-010 환원.
- v0.10.4: **Phase 2 self-hosting deferral 해소** (2026-04-27) — 본 레포가 본격 dogfood 진입.
- v0.10.5: init/work observability — F-027 issue logging convention + F-028 prompt log hook.
- v0.10.6: scaling preparedness — F-029 schema (5 additive fields) + F-030 sharding tools + F-031 stress test (1000~10000 features 실측).
- v0.10.7: cosmic-suika ISSUES-LOG batch return (I-003 tsconfig + I-004 risks pattern + I-006 kind=trivial + I-007 changelog version optional).

**열림**
- Cross-language canonical hash 테스트 벡터 (부록 D.7) — Node/Go 교차 검증 미구현.
- AC coverage drift (check.py 11 번째 drift candidate).
- URL → design seed — scope 크고 IP 경계 주의 (2026-04-24 검토).
- gate_perf auto-detect heuristics (lighthouse · k6 · wrk 설정 감지).
- pre-commit hook (Phase 2 자동 enforcement) — 디시플린이 흔들릴 때 진입 후보.
- F-030 sharding tools 의 사용자 진입로 (현재 `python3 scripts/spec/shard.py` 수동 호출만; 자동화 시점 미정).
- F-028 prompt log hook 의 production 검증 — 사용자가 `/plugin update` 후 실제 prompt 들이 누적되는지 실측 필요.

## 9. 다음 Phase 후보

**v0.10.7 완료 (2026-04-27). 후속 후보** (우선순위 미고정):

### 즉시 착수 가능
- 본 레포 새 피처를 work.py 사이클에 실어서 가는 것 자체가 가장 큰 작업 (Phase 2 정착).
- AC coverage drift detector — check.py 11 번째 drift.
- cosmic-suika ISSUES-LOG 의 다음 환원 가능 항목.

### 큰 다음 마일스톤 (사용자 확인 후 minor bump 검토)
- Cross-language canonical hash 테스트 벡터 (Node/Go 교차).
- URL → design seed (scope 결정 필요).
- gate_perf auto-detect heuristics.

## 10. Import

현재 없음. 필요 시 `design/HANDOFF-*.md` 는 개인 노트 (gitignored) 이므로 전역 @import 는 의존하지 말 것.
