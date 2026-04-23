# 첫 실행 검증 체크리스트 (v0.1.0)

이 체크리스트는 **실제 Claude Code 세션** 에서 harness-boot 플러그인을 **1 회** 돌려보고 남은 미지수(10 항목)를 닫는 용도입니다. [드라이런 리포트 §6](../../design/phase-2.16-e2e-dryrun-report.md) 가 문서 기반으로 예상한 동작을 **실제 런타임 동작과 비교**합니다.

대상 독자: 플러그인 유지보수자 (이 레포 오너). v0.1.0 태깅·마켓플레이스 PR 직전 1 회 실행.

소요 시간: 5~10 분.

---

## 준비

**사전 요건**
- Claude Code 최신 버전 (`claude --version`).
- 깨끗한 테스트 프로젝트 디렉터리 (예: `~/tmp/harness-first-run/`, 기존 프로젝트 금물).
- 이 레포를 로컬에 클론 (`~/.claude/plugins/harness-boot/` 권장).

**플러그인 등록** (`~/.claude/settings.json` 에 추가):

```json
{
  "plugins": [
    {
      "name": "harness-boot",
      "path": "~/.claude/plugins/harness-boot"
    }
  ]
}
```

Claude Code 재시작.

---

## 체크리스트

### 1. 슬래시 명령 자동완성 확인

```bash
mkdir -p ~/tmp/harness-first-run
cd ~/tmp/harness-first-run
git init
claude
```

세션 안에서 `/` 입력 후 `harness` 자동완성에 `/harness:init` 이 나타나는지.

- [ ] `/harness:init` 이 자동완성 목록에 표시됨
- [ ] argument-hint `[--team | --solo]` 가 표시됨 (있으면)

**실패 시**: 플러그인 경로 등록 오류. `settings.json` 경로 절대 경로 확인.

---

### 2. 플러그인 경로 런타임 주입 (NEW-37 닫기)

`/harness:init --solo` 실행. Claude 가 §2 수행 중 템플릿을 어떻게 읽는지 관찰.

- [ ] Claude 가 `Read` 또는 `Bash cat` 으로 템플릿을 **성공적으로 열었다**
- [ ] 사용한 실제 경로는? → 메모: `_____________`
- [ ] 환경변수 `$CLAUDE_PLUGIN_ROOT` 가 세션에 실제로 주입되는지 (`Bash: echo $CLAUDE_PLUGIN_ROOT`)

**결과 기록**:
```
실제 환경변수 이름: _________________
실제 경로: _________________________
```

이 결과로 v0.1.1 RFC 의 NEW-37 문구가 확정됩니다.

---

### 3. 생성된 파일 구조

```bash
ls -la .harness/
cat .harness/events.log
head -5 CLAUDE.md
grep "harness-boot" .gitignore
```

- [ ] `.harness/` 에 `spec.yaml` · `harness.yaml` · `state.yaml` · `events.log` · `hooks/` · `protocols/` · `_workspace/handoff/` 존재
- [ ] `events.log` 에 1 줄 JSON: `{"ts":"...","type":"harness_initialized","plugin_version":"0.1.0","mode":"solo"}`
- [ ] `CLAUDE.md` 첫 줄이 `# harness-first-run — Claude Code 워크스페이스`
- [ ] `.gitignore` 에 `.harness/_workspace/`, `.harness/events.log` 등 harness-boot 블록

---

### 4. `.claude/` 빈 디렉터리 무해성 검증

```bash
ls -la .claude/
```

- [ ] `.claude/agents/` · `.claude/skills/` 가 **빈 디렉터리** 로 존재함
- [ ] Claude Code 세션이 "empty agents/skills" 경고를 내지 **않았다**
- [ ] 세션 시작 시 어떤 auto-load 로그/경고가 있었다면 메모: `_____________`

**결과**: 경고 없음 → OK. 경고 있음 → init.md §1 에서 `.claude/` 생성을 제거하거나 최소 README.md placeholder 를 넣을지 결정.

---

### 5. CLAUDE.md 의 @ import 행동

`CLAUDE.md` 는 다음 3 줄을 포함합니다:

```
@.harness/spec.yaml
@.harness/architecture.yaml
@.harness/domain.md
```

v0.1.0 에서 생성되는 파일은 `spec.yaml` 뿐 (나머지 2 개는 부재).

세션에 "파일을 찾을 수 없음" 관련 메시지가 있는지 확인.

- [ ] `@.harness/spec.yaml` 은 정상 import 됨
- [ ] `@.harness/architecture.yaml` · `@.harness/domain.md` 누락에 대한 경고 **없음** (silently ignore)
- [ ] 경고가 있었다면 메모: `_____________`

**결과**: 경고 없음 → OK. 경고 있음 → 템플릿에서 미존재 import 를 주석 처리하거나 v0.2 에서 `/harness:sync` 가 생성될 때까지 import 제거.

---

### 6. 재실행 방어

다시 `/harness:init --solo`.

- [ ] Claude 가 "하네스가 이미 설치되어 있습니다. `.harness/spec.yaml` 을 직접 편집하세요." 로 중단
- [ ] 기존 파일 변경 **없음** (`git diff --stat` 으로 확인)

---

### 7. `--team` 모드 분기

새 디렉터리에서:

```bash
cd ~/tmp
rm -rf harness-team-run
mkdir harness-team-run
cd harness-team-run
git init
claude
```

`/harness:init --team`.

- [ ] `.gitignore` 에 `.harness/state.yaml` 이 추가됨
- [ ] 중단 메시지 말미 보고에 `mode: team` 이 반영됨

---

### 8. 프로젝트 이름 추출

세 가지 케이스를 각각 시험 (빈 디렉터리 → package.json 있음 → pyproject.toml 있음):

**케이스 A**: `harness-empty/` (.git 만) → CLAUDE.md 첫줄 `# harness-empty — ...`
**케이스 B**: `harness-pkg/` 에 `package.json` 생성 `{"name":"my-pkg"}` → `# my-pkg — ...`
**케이스 C**: `harness-py/` 에 `pyproject.toml` 생성 `[project]\nname="my-py"` → `# my-py — ...`

- [ ] 케이스 A ✅
- [ ] 케이스 B ✅
- [ ] 케이스 C ✅
- [ ] `package.json` 에 `name` 이 빈 문자열 "" 일 때도 케이스 A 로 fallback? `_____________`

---

### 9. 실패 조건 안내

고의로 쓰기 권한 없는 디렉터리에서 실행 (`chmod 000 somedir/`).

- [ ] Claude 가 "쓰기 권한 없음" 을 감지하고 중단
- [ ] 사용자에게 해결 방안 제시

(건너뛰어도 무방. 시간 여유 있을 때만.)

---

### 10. 정리 및 피드백

```bash
rm -rf ~/tmp/harness-*
```

**최종 판정**:

- [ ] 1~7 항목 모두 통과 → v0.1.0 태깅 준비 완료
- [ ] 2 / 4 / 5 중 하나 이상 실패 → **v0.1.0 차단**. init.md 또는 CLAUDE.md.template 수정 후 재실행.
- [ ] 8 의 엣지케이스 실패 → v0.1.1 RFC 에 기록 (블로커 아님)

---

## 결과 기록 위치

이 체크리스트의 결과는 `design/phase-2.17-first-run-results.md` (.gitignore) 에 기록하세요. 중요 발견은 `design/rfcs/v0.1.1-init-hardening.md` 로 승격.

체크 완료 후 [v0.1.0 릴리즈 플레이북](../release/v0.1.0.md) 을 진행하면 됩니다.
