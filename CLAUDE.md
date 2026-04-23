# harness-boot — 플러그인 개발 레포

> 이 CLAUDE.md 는 **이 레포에서 플러그인을 개발할 때** 읽는 컨텍스트입니다.
> `docs/templates/starter/CLAUDE.md.template` 는 `/harness:init` 이 **사용자 프로젝트에** 쓰는 별개 파일이며 이 파일과 혼동하지 마세요.

## 1. 이 레포가 뭐냐

Claude Code 플러그인 `harness-boot` 의 소스. 사용자는 `/harness:init` 로 자기 프로젝트에 `.harness/` 골격을 설치하고, `.harness/spec.yaml` 을 편집 혹은 `/harness:spec` 으로 파생/정제하며, 나머지는 플러그인이 파생.

- **현재 릴리즈**: v0.3.9 (2026-04-23 태그 · GitHub Release). 공식 마켓플레이스 PR 은 안정화 마무리 후.
- **설치 경로**: `/plugin marketplace add qwerfunch/harness-boot` → `/plugin install harness@harness-boot`. 공식 claude-plugins-official 마켓 PR 머지 전까지 이 경로가 유일.
- **SemVer 정책**: 0.3.x 는 patch-first. 기능 추가여도 0.3.X+1. minor/major 는 사용자 확인 + 큰 마일스톤 한정 (v0.4 후보).
- **라이선스**: MIT · Author: qwerfunch

## 2. 지금 어디쯤 있나

**v0.3.9 릴리즈 완료** (2026-04-23). 0.3.x 코어 스토리 완결 상태:

- **8 슬래시 명령 전부 shipped**: `init` · `spec` · `sync` · `work` · `status` · `check` · `events` · `metrics`.
- **Gate 자동화 0~5 전부**: `/harness:work --run-gate gate_N` 이 pytest/mypy/ruff/coverage/git-diff/smoke 자동 감지 + 실행. **BR-004 Iron Law (gate_5=pass + evidence≥1 없이 done 거부) 전 구간 자동**.
- **Drift 탐지 8/8**: Generated · Derived · Spec · Include · Evidence · Code · Doc · Anchor.
- **자기 파생 dogfood 성공**: `docs/samples/harness-boot-self/spec.yaml` 로 self-describe round trip.
- **누적 테스트**: 373/373 (unittest, 16 skipped).

**다음 작업 후보**:
- **공식 마켓플레이스 PR** (anthropic/claude-plugins-official 등록) — 이제 0.3.x 스토리 완결이라 타이밍 근접.
- **v0.4 마일스톤** (minor bump 대상): shipped hooks 세트 · cross-language hash 테스트 벡터 (부록 D.7) · integrator 에이전트 · event log rotation 등.
- **v0.3.10+ 미세 조정**: 템플릿 보강 (NEW-51/52/53) · init.md §0 `ls -d` 가독성 등.

## 3. 레포 구조 (실제로 트래킹되는 것만)

```
.claude-plugin/
├── plugin.json                     # 플러그인 매니페스트 (name: "harness", v0.3.9)
└── marketplace.json                # single-plugin marketplace (v0.1.1~, NEW-45)
commands/                           # 8 슬래시 명령
├── init.md · spec.md · sync.md · work.md
├── status.md · check.md · events.md · metrics.md
skills/spec-conversion/             # plan.md → spec.yaml 변환 스킬 v0.5
scripts/                            # Python 구현 (23 파일)
├── sync.py · work.py · status.py · check.py · events.py · metrics.py
├── spec_mode_classifier.py · explain_spec.py · spec_diff.py     # spec Mode E/A/R/B-1
├── validate_spec.py                  # JSONSchema 2020-12 검증
├── include_expander.py               # $include depth=1 전개 (F-009)
├── canonical_hash.py                 # YAML → canonical JSON → SHA-256 + merkle (F-010)
├── render_domain.py · render_architecture.py   # spec → domain.md · architecture.yaml
├── state.py                          # state.yaml helper (공통 유틸)
├── plugin_root.py                    # NEW-37/44 4-전략 경로 해석
├── gate_runner.py                    # Gate 0~5 자동 실행
├── mode_b_*.py                       # BM25 통계 추출 (Mode B Phase 1)
├── conversion_diff.py                # 의미 diff
└── upgrade_to_2_3_8.py               # 스펙 마이그레이션
tests/unit/                         # 17 테스트 파일 · 373 tests
tests/regression/conversion-goldens/   # 8 golden samples + MANIFEST
docs/
├── schemas/spec.schema.json        # spec v2.3.8 JSONSchema (prefixItems[0] = skeleton)
├── samples/harness-boot-self/      # self-referential canonical spec (21 features)
├── templates/starter/              # /harness:init 이 복사하는 4 템플릿
├── setup/
│   ├── local-install.md            # 플러그인 설치 스모크
│   └── first-run-checklist.md
└── release/v0.1.0.md               # 태깅·PR 플레이북
README.md · CHANGELOG.md · LICENSE · CLAUDE.md (이 파일)
```

**트래킹 안 되는 것** (.gitignore): `design/` · `legacy/` · `translations-ko/` · `node_modules/` 등.

## 4. 현재 git 상태

- **태그**: v0.1.0, v0.1.1, v0.2.0, v0.2.1, v0.3.0 ~ v0.3.9 원격 push 완료. 태그 이동 금지.
- **develop HEAD**: `830403d feat(metrics): /harness:metrics (F-008) — events.log aggregation — v0.3.9`
- **main**: develop 과 동기 (default branch · 마켓플레이스 fetch ref)
- **작업 트리**: clean
- **다음 분기**: `feat/v0.3.10-*` 또는 `feat/v0.4-*` (develop 에서)

## 5. 커밋 히스토리 맥락

0.3.x 핵심 흐름 (가장 최근 → 과거):
- `830403d feat(metrics): /harness:metrics (F-008) — v0.3.9` (events.log 집계)
- `b2a5e2c feat(check): add Code / Doc / Anchor drift — v0.3.8` (F-006 8/8 complete)
- `e95cd82 feat(gate): add gate_5 (runtime smoke) auto-runner — v0.3.7`
- `4ae74c6 feat(gate): add gate_4 (commit check) auto-runner — v0.3.6`
- `58dd7ce feat(gate): Gate 3 coverage auto-runner (v0.3.5)`
- `19fdb43 feat(gate): Gate 2 lint auto-runner (v0.3.4)`
- `7ef34cd feat(gate): Gate 1 type-check auto-runner (v0.3.3)`
- `72dfbc7 feat(v0.3.2): Walking Skeleton + Anti-rationalization + README honesty` (4-way 정합 감사)

v0.2 핵심 커밋 (Phase 0 · self-describe round trip) · v0.1.0 피벗 (`76da3d5`) · 피벗 이전 TS CLI (`feat/v0.2.0-archive` 브랜치) 는 `git log` 로 소급.

## 6. 참고 문서 지도

| 무엇을 하려면 | 읽을 파일 |
|---|---|
| 현재 상황 30 초 파악 | `README.md` + 이 파일 |
| **Claude Code 에서 이어 작업** | `design/HANDOFF-to-claude-code.md` (gitignore) |
| 첫 실행 검증 | `docs/setup/first-run-checklist.md` |
| 태깅·마켓 PR 플레이북 | `docs/release/v0.1.0.md` (v0.3.x 에도 동일 적용) |
| 전체 변경 이력 | `CHANGELOG.md` |
| 슬래시 명령 스펙 | `commands/*.md` (8 개, 모두 preamble 규약 통일) |
| 스펙 v2.3.8 JSONSchema | `docs/schemas/spec.schema.json` (Walking Skeleton 강제 + BR 패턴) |
| **self-referential canonical spec** | `docs/samples/harness-boot-self/spec.yaml` — 21 features · self-describe 입력 |
| 스킬 v0.5 구현 가이드 | `skills/spec-conversion/SKILL.md` |
| 스크립트 레이어 테스트 기준 | `tests/unit/test_*.py` — 373 tests, 기능별 분리 |
| 로컬 메모리 (사용자 스타일 · 진행 기록) | `design/.memory/MEMORY.md` (gitignore) |

## 7. 작업 규칙

- **design/ 는 개인 작업 공간**. 절대 `git add` 하지 마세요. 공개할 가치가 있으면 `docs/` 로 승격.
- **legacy/ 도 동일**. 트래킹된 기존 파일만 유지, 새 파일 추가 금지.
- **플러그인은 자기 자신에 설치되지 않음**. 이 레포에 `/harness:init` 실행하면 모순.
- **자체 도그푸드 정책** (v0.3.10+ · 2 단계 설계):
  - **Phase 1 (현재, v0.3.10~)**: 레포 루트 `.harness/` 는 **observational** — `scripts/self_check.sh` 5 단계 검증 (diff · validate · sync · check · commands 규약) 과 `test_self_dogfood` 만 수행. `sync_completed` 외 feature lifecycle 이벤트는 발생하지 않는 게 정상. `state.yaml` 은 릴리즈 태그 시점에만 갱신 (노이즈 최소화).
  - **Phase 2 (v0.3.11+ 첫 실 피처 진입부터)**: `.harness/` 가 **active workspace** 로 전환 — `scripts/work.py` / `/harness:work` 를 기여자가 자기 feature 사이클에 **실제로** 사용. 피처 activate → gate 실행 → evidence 기록 → complete 전이를 `.harness/state.yaml` 에 기록, `events.log` (gitignored) 에 실 타임라인 누적. `/harness:metrics` 가 비로소 진짜 lead time · gate pass rate 출력. 이 시점부터 state.yaml 커밋은 feature PR 단위로 같이 나감 (릴리즈 시점 제한 해제).
  - **공통 규칙** (Phase 무관):
    - `spec.yaml` 은 `docs/samples/harness-boot-self/spec.yaml` 의 **복사본** (symlink 아님). `scripts/self_check.sh` 가 `diff -q` 로 동기성 강제.
    - `events.log` · `harness.yaml` · `domain.md` · `architecture.yaml` · `chapters/` 는 gitignored.
    - `/harness:init` 은 이 repo 에서 **절대 실행 금지** (플러그인 소스 자체 덮어씀).
    - 사용자 충돌 없음: 사용자가 `/harness:*` 실행 시 `$(pwd)/.harness` 만 참조 — 우리 내부 `.harness/` 는 invisible.
- **슬래시 명령 사용 경로** (2026-04-23 검증):
  - ✅ 작동: `/plugin marketplace add qwerfunch/harness-boot` + `/plugin install harness@harness-boot` → `/harness:*` 8 개 명령 전부 사용 가능. 업그레이드는 `/plugin update harness@harness-boot`.
  - ⚠️ 미확인: `CLAUDE_PLUGIN_ROOT` env 또는 `settings.json plugins[]` 로 **dev checkout 라이브 반영** 시도 → 설치본이 우선하여 작동 안 함 관찰됨.
  - 결론: 편집 즉시 슬래시 명령 반영은 **현재 불가**. 스크립트 수정 → 커밋 → 릴리즈 → `/plugin update` 의 루프만 동작. 편집-검증 빠르게 하려면 `python3 scripts/*.py` 직접 호출.
  - 상세 경로: `docs/setup/local-install.md` §2 + 부록 A.
- **사용자 충돌 없음 보장**: 사용자가 `/harness:*` 실행 시 항상 `$(pwd)/.harness` 만 참조 — 우리 내부 `.harness/` 는 invisible.
- **태그는 절대 이동 금지**. 깨진 버전은 yank + hotfix (docs/release/v0.1.0.md §5).
- **main 은 default branch**. 각 릴리즈마다 `git checkout main && git merge --ff-only develop && git push origin main` 으로 fast-forward. `/plugin marketplace add qwerfunch/harness-boot` 가 여기서 fetch.
- **Patch-first 버전 정책**: 새 기능이라도 0.3.X+1. minor/major 는 사용자 확인 후 큰 마일스톤에 예약.
- **커밋/PR 언어**: 영어. 응답/설명 언어: 한국어 (파일 내용은 문맥에 따라).
- **Anti-rationalization**: 8 commands 모두 Preamble 3 줄 직후 "NO skip / NO shortcut" 2 행 필수 (BR-014).
- **CQS 강제**: read-only 명령 (`status` · `check` · `events` · `metrics` · `spec` Mode E) 은 대상 파일 mtime 을 변경하지 않음. 테스트가 mtime 불변을 확인.

## 8. 알려진 제한사항 (v0.3.9 기준)

**닫힘**
- 0.1.x: NEW-37/39/40/42/44/45 전부 해소.
- 0.2.x: NEW-50 (plugin_version resolution) 해소.
- 0.3.x: Gate 자동화 0~5, drift 8/8, Walking Skeleton 스키마 강제, Anti-rationalization 2 행 규약.

**열림 (v0.3.10+ 또는 v0.4 대상)**
- 공식 마켓플레이스 PR: anthropic/claude-plugins-official 등록.
- shipped hooks 세트 (현재 `hooks/` 디렉터리 자체 부재 → fail-open 가정이 공허).
- integrator 에이전트 (`agents/` 디렉터리 부재).
- Cross-language canonical hash 테스트 벡터 (부록 D.7).
- Event log rotation (`events.log.YYYYMM` 분할 미구현).
- 템플릿 보강 (NEW-51/52/53).

## 9. 다음 Phase 후보

**v0.3.9 완료 (2026-04-23). 다음 작업**:

### 즉시 착수 가능
- **공식 마켓플레이스 PR** — anthropic/claude-plugins-official 에 harness 등록. 0.3.x 스토리 완결.
- **v0.3.10 미세 조정** — 템플릿 보강 · init.md §0 `ls -d` 가독성 · CHANGELOG 정리.

### 큰 다음 마일스톤 (v0.4, minor bump)
- Shipped hooks 세트 (security-gate · doc-sync-check · coverage-gate · format · test-runner · session-start-bootstrap).
- integrator 에이전트 — 메인 조립 wire-up 책임 (design doc 기둥 6).
- Cross-language canonical hash 테스트 벡터 (Node/Go 교차 검증).
- Event log rotation.

## 10. Import

현재 없음. 필요 시 `design/HANDOFF-*.md` 는 개인 노트 (gitignore) 이므로 전역 @import 는 의존하지 말 것.
