# Changelog

All notable changes to harness-boot are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

---

## [Unreleased]

- docs(readme): 핵심 흐름 다이어그램 단순화 (5 박스 → 3 블록 플랫) + "spec.yaml 을 사용자가 직접 편집" 표현을 "/harness:spec 도구 경유" 로 바로잡음 + 예시의 구체 피처 ID (F-003) → `<피처 ID>` 일반화 + `/harness:status 로 목록 조회` 스텝 추가. "30초 체험" → "전형 사용 흐름".
- Marketplace PR (anthropic/claude-plugins-official) — 안정화 후 제출 (v0.4 후보)
- Gate 1~5 자동 실행 (현재 gate_0 만) — v0.3.2 후보
- F-006 확장: Code / Doc / Anchor drift (현재 5/8) — v0.3.2~v0.3.3 후보
- 템플릿 보강: NEW-51/52/53 (entry_points health_check · domain.md backlink · feature_graph sort)

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

[Unreleased]: https://github.com/qwerfunch/harness-boot/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.1.0
