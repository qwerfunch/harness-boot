# v0.1.0 릴리즈 플레이북

Claude Code 마켓플레이스 등록까지의 **가시적 절차** 를 한 곳에. 이전 단계들은 `CHANGELOG.md` · `docs/setup/first-run-checklist.md` 에 의존합니다.

---

## 0. 전제 검증

다음이 **모두** 참이어야 진행:

- [ ] `CHANGELOG.md` v0.1.0 섹션 작성 완료
- [ ] `docs/setup/first-run-checklist.md` 의 §1~§7 모두 실제 Claude Code 에서 통과
- [ ] `README.md` 링크 전부 OK (깃헙 push 후 404 없어야 함)
- [ ] `plugin.json` 의 `version` 이 `"0.1.0"`
- [ ] `LICENSE` 존재, 저작권 연도 정확

실패 항목이 있으면 **태깅 금지**. 해결 후 재시작.

---

## 1. 레포 Housekeeping (pre-tag)

현재 git 상태에 **145 개 삭제(구 TS CLI) + 8 개 신규(플러그인 뼈대)** 가 대기 중. 릴리즈 전에 하나의 일관된 커밋으로 묶습니다.

### 방식 A — Single squashed commit (권장)

```bash
cd ~/Developer/work/harness-boot

# 1. 확인: 예상하지 못한 변경 없는지
git status

# 2. 모든 삭제·추가·수정을 스테이징
git add -A

# 3. 커밋 메시지: BREAKING 피벗 명시
git commit -m "feat!: pivot to native Claude Code plugin (v0.1.0)

Architecture pivot from TypeScript CLI (bin/harness-boot + src/**)
to native Claude Code plugin (.claude-plugin/ + commands/ + skills/).

- Add .claude-plugin/plugin.json manifest
- Add commands/init.md (/harness:init)
- Add skills/spec-conversion/SKILL.md v0.5 (24 principles, 5 adapters)
- Add docs/schemas/spec.schema.json (spec v2.3.8, JSONSchema 2020-12)
- Add docs/templates/starter/ (4 templates)
- Add scripts/mode_b_*.py (BM25 statistical extractor)
- Add tests/regression/conversion-goldens/ (8 samples + MANIFEST)
- Add README.md, CHANGELOG.md, docs/setup/

BREAKING CHANGE: The TypeScript CLI from previous iterations is removed.
Users of the old CLI must re-install as a Claude Code plugin.

See CHANGELOG.md for full details and v0.2 roadmap."

# 4. 확인: main/develop 에 푸시
git push origin develop   # 현재 브랜치
```

### 방식 B — Two commits (기존 CLI 제거 + 새 구조 추가)

깃 히스토리 가독성 선호 시:

```bash
# Commit 1: 구조 제거
git rm -r bin src schemas spec.yaml package.json package-lock.json \
          docs/commands docs/constitution.md docs/hooks.md \
          docs/skill-layout.md docs/spec-schema.md \
          .claude/agents .claude/commands \
          legacy
git commit -m "chore!: remove TypeScript CLI and legacy tree

Preparation for v0.1.0 plugin pivot. All TS sources and legacy docs
are archived in git history (tag v0.0.x if needed)."

# Commit 2: 새 구조 추가
git add .claude-plugin commands skills docs scripts tests \
        README.md CHANGELOG.md LICENSE .gitignore
git commit -m "feat: native Claude Code plugin (v0.1.0)

See CHANGELOG.md."
```

A 가 빠르고 B 가 깔끔. **A 권장**.

---

## 2. 태깅

```bash
# 이전 TS CLI 를 포기하지 않고 보존하려면 먼저 v0.0.x 태그를 삭제된 커밋에 찍기 (선택)
# git tag v0.0.1-pre-pivot <HASH_OF_LAST_TS_COMMIT>
# git push origin v0.0.1-pre-pivot

# v0.1.0 annotated tag
git tag -a v0.1.0 -m "harness-boot v0.1.0

Native Claude Code plugin. /harness:init + spec-conversion skill.
See CHANGELOG.md for full notes."

git push origin v0.1.0
```

**깃헙 릴리즈 생성**: `Releases → Draft a new release → v0.1.0`. 본문은 `CHANGELOG.md` 의 [0.1.0] 섹션을 그대로 복붙.

---

## 3. Marketplace 등록 PR

Claude Code 플러그인 마켓플레이스는 (2026-04 시점) `anthropic-claude-code/plugins-marketplace` 또는 유사 레지스트리 레포에 PR 을 올려 등록합니다. **실제 레지스트리 경로 · 스키마는 첫 등록 시 확인 필요** (NEW-44). 아래는 일반적 패턴.

### PR 본문 템플릿

```markdown
# Add harness-boot to marketplace

## Plugin Info

- **Name**: harness-boot
- **Version**: 0.1.0
- **Author**: qwerfunch
- **License**: MIT
- **Repository**: https://github.com/qwerfunch/harness-boot
- **Tag**: v0.1.0

## Description

Plan.md 하나로 출발해 Claude Code 에이전트·스킬·훅·프로토콜을 파생·생성·진화시키는 harness 플러그인. `.harness/spec.yaml` (v2.3.8) 을 단일 사용자 편집 대상으로 유지하며 나머지는 자동 생성.

## Install

```bash
claude plugin marketplace add qwerfunch/harness-boot
claude plugin install harness-boot
```

## First Command

```text
/harness:init
```

## Scope (v0.1.0)

- `/harness:init` — `.harness/` 스캐폴딩 + CLAUDE.md 편성
- Skill `spec-conversion` v0.5 — plan.md → spec.yaml 변환
- 8 golden samples + JSONSchema (spec v2.3.8)

v0.2+ 예정: `/harness:sync` · `/harness:work` · `/harness:status` · `/harness:check` + 6 core hooks.

## Smoke Test

[docs/setup/local-install.md](https://github.com/qwerfunch/harness-boot/blob/v0.1.0/docs/setup/local-install.md) 의 6 단계 스모크 시나리오를 참조.

## Known Limitations

- 첫 실제 런타임 실행 1 회 완료 (first-run-checklist §2/§4/§5 passed).
- `CLAUDE.md` 의 `@.harness/architecture.yaml` · `@.harness/domain.md` import 는 v0.2 의 `/harness:sync` 가 생성할 때까지 미충족 — Claude Code 의 silently ignore 동작에 의존.
- Windows PowerShell 전용 환경의 `date -u` fallback 미구현 (v0.2 예정).

## Checklist

- [x] plugin.json valid JSON
- [x] .claude-plugin/plugin.json `version` matches git tag
- [x] LICENSE present (MIT)
- [x] README.md with install + first command
- [x] CHANGELOG.md
- [x] first-run-checklist §1~§7 passed in real Claude Code session
```

---

## 4. 릴리즈 후 1 주 모니터링

등록 PR 이 머지되면 **최초 1 주** 동안:

- 깃헙 Issues 에 올라오는 첫 번째 문제들 확인 — 이게 v0.1.1 patch 의 입력.
- NEW-37/39/40/42 중 실제 사용자가 걸린 항목을 우선순위 1 로 v0.1.1 patch 릴리즈.
- Claude Code 의 실제 env var 주입 방식이 문서화되면 RFC 업데이트.

---

## 5. 롤백 계획

**v0.1.0 이 깨진 것으로 판명되면**:

```bash
# 마켓플레이스에서 플러그인 비활성화 요청 (레지스트리 오너에게 이슈 or DM)
# 태그 유지하되 v0.1.1-hotfix 를 긴급 릴리즈
# CHANGELOG 에 yanked 표시

# 극단: 태그 이동 (비권장, 마켓에 이미 설치한 사용자 깨짐)
# git tag -d v0.1.0 && git push origin :refs/tags/v0.1.0
```

일반적으로는 **yank + hotfix** 가 정답. 태그는 절대 이동하지 말 것.

---

## 부록 — 체크리스트 원샷

```
[ ] CHANGELOG.md §0.1.0 완성
[ ] first-run-checklist §1~§7 green
[ ] README 링크 검증 (git diff 전후 모두)
[ ] plugin.json version=0.1.0
[ ] git add -A + squashed commit (방식 A)
[ ] git tag -a v0.1.0 + push
[ ] GitHub Release draft → publish
[ ] Marketplace PR 제출
[ ] 1 주 모니터링
```
