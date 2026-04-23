# harness-boot — 플러그인 개발 레포

> 이 CLAUDE.md 는 **이 레포에서 플러그인을 개발할 때** 읽는 컨텍스트입니다.
> `docs/templates/starter/CLAUDE.md.template` 는 `/harness:init` 이 **사용자 프로젝트에** 쓰는 별개 파일이며 이 파일과 혼동하지 마세요.

## 1. 이 레포가 뭐냐

Claude Code 플러그인 `harness-boot` 의 소스. 사용자는 `/harness:init` 로 자기 프로젝트에 `.harness/` 골격을 설치하고, `.harness/spec.yaml` 만 편집하며, 나머지는 플러그인이 파생.

- **현재 릴리즈**: v0.1.1 (2026-04-23 태그 · GitHub Release 발행). 공식 마켓플레이스 PR 은 안정화 후로 미룸.
- **설치 경로 (v0.1.1)**: `/plugin marketplace add qwerfunch/harness-boot` → `/plugin install harness@harness-boot`. 공식 claude-plugins-official 마켓 PR 이 머지될 때까지 이 경로가 유일.
- **SemVer**: 0.1.x = 최소 뼈대 · init 강건성. v0.2+ 에서 `/harness:sync` · `/harness:work` 합류.
- **라이선스**: MIT · Author: qwerfunch

## 2. 지금 어디쯤 있나

**v0.1.1 릴리즈 완료** (2026-04-23). 태그 `v0.1.1` · GitHub Release · develop `cbb01c3`. v0.1.0 first-run 스모크에서 나온 5 개 이슈 (NEW-37/39/40/42/44/45) 모두 닫힘 — init.md 로직 하드닝 + 자체 marketplace.json 추가.

**다음 Phase 후보**:
- **v0.1.2 미세 개선** (시간 남을 때): init.md §0 신호 체크를 `ls -d` 로 정리 (현재 `.git` 디렉터리 내용까지 출력됨, 사소한 가독성 이슈).
- **v0.2 `/harness:sync` 스펙 착수**: 더 큰 피처.
- **공식 마켓플레이스 PR** (아주 나중에): v0.2~v0.3 안정화 후 anthropic/claude-plugins-official 에 제출.

## 3. 레포 구조 (실제로 트래킹되는 것만)

```
.claude-plugin/plugin.json       # 플러그인 매니페스트 (name: "harness")
.claude-plugin/marketplace.json  # 단일 플러그인 마켓플레이스 (v0.1.1~, NEW-45)
commands/init.md                 # /harness:init (v0.1 유일 명령)
skills/spec-conversion/          # plan.md → spec.yaml 변환 스킬 v0.5
docs/
├── schemas/spec.schema.json     # spec v2.3.8 JSONSchema
├── templates/starter/           # /harness:init 이 복사하는 4 템플릿
├── setup/
│   ├── local-install.md         # 플러그인 설치 스모크
│   └── first-run-checklist.md   # 첫 실행 10-항목 검증
└── release/v0.1.0.md            # 태깅·PR 플레이북 (v0.1.1 에도 동일 적용)
scripts/
├── mode_b_*.py                  # BM25 통계 추출 (Mode B Phase 1)
├── upgrade_to_2_3_8.py          # v2.3.x → v2.3.8 마이그레이션
└── conversion_diff.py           # 의미 diff
tests/regression/conversion-goldens/   # 8 golden samples + MANIFEST
README.md · CHANGELOG.md · LICENSE · CLAUDE.md (이 파일)
```

**트래킹 안 되는 것** (.gitignore): `design/` · `legacy/` · `translations-ko/` · `node_modules/` 등.

## 4. 현재 git 상태

- **태그**: `v0.1.0` (`bfc8b3e`) · `v0.1.1` (`cbb01c3`) 원격 push 완료
- **develop HEAD**: `cbb01c3 docs(changelog): finalize v0.1.1 release date and NEW-39 description`
- **main**: develop 과 동기화 (default branch — `/plugin marketplace add qwerfunch/harness-boot` 이 fetch 하는 ref)
- **작업 트리**: clean
- **다음 분기**: `feat/v0.1.2-*` 또는 `feat/v0.2-*` (develop 에서)

## 5. 커밋 히스토리 맥락

v0.1.1 릴리즈 경로 핵심 커밋:
- `cbb01c3 docs(changelog): finalize v0.1.1 release date and NEW-39 description`
- `5eac0db fix(init): relax NEW-39 — info-only signal check, no blocking prompt` (재스모크 피드백 반영)
- `4f186f5 Merge pull request #44 from qwerfunch/feat/v0.1.1-init-hardening` (7 커밋 묶음)
- `d5826dc Merge pull request #43 from qwerfunch/feat/v0.1.0-native-plugin-pivot` (v0.1.0 first-run smoke findings)
- `1c3c42a Merge pull request #42` (피벗 커밋 develop 에 합류)
- `76da3d5 feat: pivot to native Claude Code plugin (v0.1.0)` (TS CLI → 네이티브 플러그인)
- `726c128 archive: v0.2.0 TS CLI 재작성 wip` (`feat/v0.2.0-archive` 브랜치에 보존)

피벗 이전의 TypeScript CLI 히스토리 (`b035331`·`19e125b`·`2ebbbf3` 등) 는 `feat/v0.2.0-archive` 브랜치와 그 parent 로만 접근.

## 6. 참고 문서 지도

| 무엇을 하려면 | 읽을 파일 |
|---|---|
| 현재 상황 30초 파악 | `README.md` + 이 파일 |
| **Claude Code 에서 이어 작업** | `design/HANDOFF-to-claude-code.md` (gitignore) |
| 첫 실행 검증 | `docs/setup/first-run-checklist.md` |
| 태깅·마켓 PR | `docs/release/v0.1.0.md` |
| v0.1.0 변경 이력 | `CHANGELOG.md` |
| `/harness:init` 명령 스펙 | `commands/init.md` (v0.1.1 re-smoke 피드백 반영) |
| 스펙 v2.3.8 JSONSchema | `docs/schemas/spec.schema.json` |
| **self-referential canonical spec** | `docs/samples/harness-boot-self/spec.yaml` — harness-boot 자체를 한 제품으로 본 v2.3.8 스펙 (21 features · 8 commands). v0.2 피처 설계 참조점. |
| 스킬 v0.5 구현 가이드 | `skills/spec-conversion/SKILL.md` |
| 드라이런 결과 · 발견 갭 | `design/phase-2.16-e2e-dryrun-report.md` (gitignore) |
| 로컬 메모리 (사용자 스타일 포함) | `design/.memory/MEMORY.md` (gitignore) |

## 7. 작업 규칙

- **design/ 는 개인 작업 공간**. 절대 `git add` 하지 마세요. 공개할 가치가 있는 문서는 `docs/` 로 승격.
- **legacy/ 도 동일**. 트래킹된 기존 파일만 유지, 새 파일은 넣지 않음.
- **플러그인은 자기 자신에 설치되지 않음**. 이 레포에 `/harness:init` 실행하면 모순. 테스트는 항상 별도 scratch 디렉터리에서 (`~/tmp/harness-*-run/`).
- **태그는 절대 이동하지 말 것**. v0.1.x 가 깨지면 yank + hotfix (docs/release/v0.1.0.md §5 참조).
- **main 은 default branch**. `/plugin marketplace add qwerfunch/harness-boot` 가 여기서 fetch. develop push 시마다 `git push origin develop:main` 으로 fast-forward 권장.

## 8. 알려진 제한사항 (v0.1.1 기준)

**닫힘 (v0.1.0 / v0.1.1 에서 해소)**
- NEW-37: `$CLAUDE_PLUGIN_ROOT` 는 CC 2.1.x 에서 **미설정**. `$PATH` 주입된 `<plugin-root>/bin` 역산이 실제 메커니즘. `commands/init.md §2` 에 4-전략 체인으로 문서화.
- NEW-39: 프로젝트 루트 신호 없을 때 info-only 처리 (중단 안 함 · 팁 라인만 추가).
- NEW-40: 이름 추출 체인 + kebab-case 정규화.
- NEW-42: `date -u` → python3 → node → prompt fallback.
- NEW-44: `directory` marketplace `installPath` 미생성 시 `source.path` fallback.
- NEW-45: `.claude-plugin/marketplace.json` 추가로 `github:` 직접 설치 경로 활성화.
- `.claude/` 빈 디렉터리 무해성: silently ignore 확인.
- `CLAUDE.md` 의 미존재 `@import`: silently ignore 확인.

**열림 (v0.1.2+ 대상)**
- `ls -d` 정리: init.md §0 신호 체크가 `.git` 디렉터리 내용까지 출력. 사소한 가독성 이슈.
- 공식 마켓플레이스 PR: anthropic/claude-plugins-official 등록 — 버전업 · 안정화 후.

## 9. 다음 Phase 후보

**v0.1.1 완료 (2026-04-23) + v0.2 Phase 0 핵심 구현 완료 (2026-04-23). 다음 작업 후보**:

### v0.2 Phase 0 현황 (완료)
- F-003 `/harness:sync` — `scripts/sync.py` + JSONSchema 검증 + 18 tests.
- F-009 `$include` 엔진 — `scripts/include_expander.py` + 23 tests.
- F-010 Canonical Hashing — `scripts/canonical_hash.py` + 19 tests.
- F-002 `/harness:spec` Mode 분류기 + Mode E — `scripts/spec_mode_classifier.py` · `explain_spec.py` + 26 tests.
- 공통 유틸: `scripts/plugin_root.py`(NEW-37/44 경로 해석, 14 tests) · `scripts/render_domain.py`(18) · `scripts/render_architecture.py`(16) · `scripts/validate_spec.py`(8).
- **총 142 tests · harness-boot-self 스펙 자기 파생 smoke 통과**.

### 다음 작업
- **F-002 Modes A/R/B-2 실제 구현** (선택) — Mode classifier 위에 diff 렌더러 + spec-conversion skill 연계. LLM 대화 루프로 해도 충분.
- **v0.2 태그** — Phase 0 완결 지점. `v0.2.0-alpha` 또는 `v0.2.0`. main 동기화 후.
- **F-004 `/harness:work`** — 피처 단위 TDD/구현 루프. v0.3 핵심.
- **F-005 `/harness:status`** · **F-006 `/harness:check`** — read-only 조회/검증.
- **v0.1.2 미세 개선** (init.md §0 `ls -d`).
- **공식 마켓플레이스 PR** (아주 나중에).

## 10. Import

(v0.1.0 에서는 아직 없음. v0.2 에서 `.harness/` 로 import 추가 예정.)
