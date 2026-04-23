# harness-boot — 플러그인 개발 레포

> 이 CLAUDE.md 는 **이 레포에서 플러그인을 개발할 때** 읽는 컨텍스트입니다.
> `docs/templates/starter/CLAUDE.md.template` 는 `/harness:init` 이 **사용자 프로젝트에** 쓰는 별개 파일이며 이 파일과 혼동하지 마세요.

## 1. 이 레포가 뭐냐

Claude Code 플러그인 `harness-boot` 의 소스. 사용자는 `/harness:init` 로 자기 프로젝트에 `.harness/` 골격을 설치하고, `.harness/spec.yaml` 만 편집하며, 나머지는 플러그인이 파생.

- **현재 릴리즈**: v0.1.0 (2026-04-23 태그 · GitHub Release 발행 · Marketplace PR 은 v0.1.1 과 묶어 제출)
- **SemVer**: 0.1.0 = 최소 뼈대. v0.2+ 에서 `/harness:sync` · `/harness:work` 합류.
- **라이선스**: MIT · Author: qwerfunch

## 2. 지금 어디쯤 있나

**v0.1.0 릴리즈 완료** (2026-04-23). 태그 `v0.1.0` (`bfc8b3e`) · GitHub Release · develop 머지 (`d5826dc`) 모두 완결. First-run 체크리스트 §1~§7 실제 Claude Code 2.1.118 세션에서 통과.

**다음 Phase 후보**:
- v0.1.1 init hardening RFC (NEW-37 closed · 39/40/42 pending · 44/45 신규) + marketplace PR 병행
- v0.2 `/harness:sync` 스펙 착수

## 3. 레포 구조 (실제로 트래킹되는 것만)

```
.claude-plugin/plugin.json       # 플러그인 매니페스트
commands/init.md                 # /harness:init (v0.1 유일 명령)
skills/spec-conversion/          # plan.md → spec.yaml 변환 스킬 v0.5
docs/
├── schemas/spec.schema.json     # spec v2.3.8 JSONSchema
├── templates/starter/           # /harness:init 이 복사하는 4 템플릿
├── setup/
│   ├── local-install.md         # 플러그인 설치 스모크
│   └── first-run-checklist.md   # 첫 실행 10-항목 검증
└── release/v0.1.0.md            # 태깅·PR 플레이북
scripts/
├── mode_b_*.py                  # BM25 통계 추출 (Mode B Phase 1)
├── upgrade_to_2_3_8.py          # v2.3.x → v2.3.8 마이그레이션
└── conversion_diff.py           # 의미 diff
tests/regression/conversion-goldens/   # 8 golden samples + MANIFEST
README.md · CHANGELOG.md · LICENSE · CLAUDE.md (이 파일)
```

**트래킹 안 되는 것** (.gitignore): `design/` · `legacy/` · `translations-ko/` · `node_modules/` 등.

## 4. 현재 git 상태

- **태그**: `v0.1.0` (`bfc8b3e`) 원격 push 완료
- **develop HEAD**: `d5826dc` (PR #43 머지 — 4 first-run fix 커밋 포함)
- **작업 트리**: clean (이 문서 갱신 커밋 전)
- **브랜치**: `develop` — 다음 작업도 이 브랜치에서 (v0.1.1 시작 시 `feat/v0.1.1-*` 분기)

## 5. 커밋 히스토리 맥락

v0.1.0 릴리즈 경로 핵심 커밋:
- `d5826dc Merge pull request #43 from qwerfunch/feat/v0.1.0-native-plugin-pivot` (first-run smoke findings)
- `1c3c42a Merge pull request #42` (피벗 커밋 develop 에 합류)
- `76da3d5 feat: pivot to native Claude Code plugin (v0.1.0)` (TS CLI → 네이티브 플러그인 single squashed commit)
- `726c128 archive: v0.2.0 TS CLI 재작성 wip` (preserved on `feat/v0.2.0-archive` 브랜치)

피벗 이전의 TypeScript CLI 히스토리 (`b035331`·`19e125b`·`2ebbbf3` 등) 는 `feat/v0.2.0-archive` 브랜치와 그 parent 로만 접근.

## 6. 참고 문서 지도

| 무엇을 하려면 | 읽을 파일 |
|---|---|
| 현재 상황 30초 파악 | `README.md` + 이 파일 |
| **Claude Code 에서 이어 작업** | `design/HANDOFF-to-claude-code.md` (gitignore) |
| 첫 실행 검증 | `docs/setup/first-run-checklist.md` |
| 태깅·마켓 PR | `docs/release/v0.1.0.md` |
| v0.1.0 변경 이력 | `CHANGELOG.md` |
| `/harness:init` 명령 스펙 | `commands/init.md` (Phase 2.16 드라이런 패치 반영됨) |
| 스펙 v2.3.8 JSONSchema | `docs/schemas/spec.schema.json` |
| 스킬 v0.5 구현 가이드 | `skills/spec-conversion/SKILL.md` |
| 드라이런 결과 · 발견 갭 | `design/phase-2.16-e2e-dryrun-report.md` (gitignore) |
| 로컬 메모리 (사용자 스타일 포함) | `design/.memory/MEMORY.md` (gitignore) |

## 7. 작업 규칙

- **design/ 는 개인 작업 공간**. 절대 `git add` 하지 마세요. 공개할 가치가 있는 문서는 `docs/` 로 승격.
- **legacy/ 도 동일**. 트래킹된 기존 파일만 유지, 새 파일은 넣지 않음.
- **플러그인은 자기 자신에 설치되지 않음**. 이 레포에 `/harness:init` 실행하면 모순. 테스트는 항상 별도 scratch 디렉터리에서 (`~/tmp/harness-*-run/`).
- **태그는 절대 이동하지 말 것**. v0.1.0 이 깨지면 yank + hotfix (docs/release/v0.1.0.md §5 참조).

## 8. 알려진 제한사항 (v0.1.0 릴리즈됨)

**닫힘 (2026-04-23 first-run 스모크로 확정)**
- **NEW-37**: `$CLAUDE_PLUGIN_ROOT` 는 CC 2.1.x 에서 **미설정**. 실제 경로 해석은 `$PATH` 주입된 `<plugin-root>/bin` 역산. `commands/init.md` 에 반영 (`37bd0a4`).
- `.claude/` 빈 디렉터리 무해성: silently ignore 확인.
- `CLAUDE.md` 의 미존재 `@import`: silently ignore 확인.

**열림 (v0.1.1 RFC 대상)**
- **NEW-39**: 루트 판단 실패 시 fallback.
- **NEW-40**: 프로젝트 이름 추출 엣지케이스 (`package.json.name` 빈 문자열 등).
- **NEW-42**: Windows PowerShell `date -u` fallback.
- **NEW-44** (신규): `directory`-type marketplace 의 `installPath` 미생성. 실제 경로는 `source.path` 에서.
- **NEW-45** (신규): repo 자체의 `marketplace.json` 미존재로 `github:qwerfunch/harness-boot` 직접 설치 불가.

## 9. 다음 Phase 후보

**Phase 2.17 완료 (2026-04-23). 다음 작업 후보**:

- **v0.1.1 패치** (근일): `docs/rfcs/v0.1.1-init-hardening.md` RFC + marketplace PR (anthropic/claude-plugins-official) + `marketplace.json` repo 추가 (NEW-45).
- **v0.2 피처 E**: `/harness:sync` 스펙 초안 — spec 변경 후 domain.md · architecture.yaml 파생.
- **v0.2 피처 F**: `scripts/hash-fixtures.mjs` + session-start-bootstrap 훅 구현.

## 10. Import

(v0.1.0 에서는 아직 없음. v0.2 에서 `.harness/` 로 import 추가 예정.)
