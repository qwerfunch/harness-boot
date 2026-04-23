# harness-boot — 플러그인 개발 레포

> 이 CLAUDE.md 는 **이 레포에서 플러그인을 개발할 때** 읽는 컨텍스트입니다.
> `docs/templates/starter/CLAUDE.md.template` 는 `/harness:init` 이 **사용자 프로젝트에** 쓰는 별개 파일이며 이 파일과 혼동하지 마세요.

## 1. 이 레포가 뭐냐

Claude Code 플러그인 `harness-boot` 의 소스. 사용자는 `/harness:init` 로 자기 프로젝트에 `.harness/` 골격을 설치하고, `.harness/spec.yaml` 만 편집하며, 나머지는 플러그인이 파생.

- **현재 릴리즈**: v0.1.0 (준비 완료, 첫 실제 실행 대기)
- **SemVer**: 0.1.0 = 최소 뼈대. v0.2+ 에서 `/harness:sync` · `/harness:work` 합류.
- **라이선스**: MIT · Author: qwerfunch

## 2. 지금 어디쯤 있나

**v0.1.0 릴리즈 캠페인 90% 완료.** Cowork 에서 Phase 2.14~2.17 진행. 남은 10% 는 실제 Claude Code 세션 1 회 실행.

즉시 해야 할 일은 `design/HANDOFF-to-claude-code.md` 를 읽고 `docs/setup/first-run-checklist.md` §1~§7 실행.

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

## 4. 현재 git 상태 — 커밋 대기

다음 커밋은 **v0.1.0 릴리즈 커밋** 이어야 합니다. TS CLI → 플러그인 피벗을 담은 단일 squashed commit.

```
M  .claude-plugin/plugin.json
?? README.md · CHANGELOG.md · CLAUDE.md
?? commands/ · docs/{release,schemas,setup,templates}/
?? scripts/ · skills/ · tests/regression/
D  × 145  (구 TS CLI: bin/ · src/ · package.json · 구 commands/·docs/)
```

**`git commit` 전에 반드시**:
1. `docs/setup/first-run-checklist.md` §1~§7 통과 (실제 Claude Code 에서 1회)
2. 블로커 발견 시 `commands/init.md` 또는 `docs/templates/starter/CLAUDE.md.template` 수정
3. 통과 시 `docs/release/v0.1.0.md` 방식 A 따라 `git add -A` + squashed commit + tag

**현재 브랜치**: `develop`. v0.1.0 태그는 이 브랜치에서.

## 5. 커밋 히스토리 맥락

최신 3 커밋 (`git log -3 --oneline`):
- `b035331 chore(spec): transition F-008 planned→done`
- `19e125b feat(cli): wire up /harness:spec subcommand + docs (F-008)`
- `2ebbbf3 feat(spec): add /harness:spec Mode A/B/R/E interactive fill (F-008)`

이들은 **피벗 전 TypeScript CLI 시절** 커밋입니다. 새 플러그인 구조는 아직 한 번도 커밋되지 않았음. 이번 v0.1.0 커밋이 디렉션 전환의 기록이 됩니다.

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
- **v0.1.0 태그 전에는 push 금물**. 실제 세션 실행 결과에 따라 커밋 내용이 달라질 수 있음.
- **플러그인은 자기 자신에 설치되지 않음**. 이 레포에 `/harness:init` 실행하면 모순. 테스트는 항상 별도 scratch 디렉터리에서.

## 8. 알려진 제한사항 (v0.1.0 에 남김)

- **NEW-37**: `CLAUDE_PLUGIN_ROOT` 실제 런타임 주입 방식 미확정. 첫 실행으로 확정 예정.
- **NEW-39**: 루트 판단 실패 시 fallback 미지정 → v0.2.
- **NEW-40**: 프로젝트 이름 추출 엣지케이스 → v0.1.1.
- **NEW-42**: Windows PowerShell `date -u` fallback → v0.2.
- **`.claude/` 빈 디렉터리 무해성**: 드라이런에서는 OK, 실제 Claude Code 세션 검증 대기.
- **CLAUDE.md 의 `@.harness/architecture.yaml` · `@.harness/domain.md`**: v0.1.0 에서는 타겟 없음. silently ignore 되리라 가정.

## 9. 다음 Phase 후보

**Phase 2.17 완료 후** (= v0.1.0 태깅 + 마켓 PR 머지 후):

- **E**: `/harness:sync` 스펙 초안 — v0.2 핵심
- **F**: `scripts/hash-fixtures.mjs` + session-start-bootstrap 훅 구현
- **J**: `docs/rfcs/v0.1.1-init-hardening.md` — NEW-37/39/40/42 통합 RFC

## 10. Import

(v0.1.0 에서는 아직 없음. v0.2 에서 `.harness/` 로 import 추가 예정.)
