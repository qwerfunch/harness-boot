# 로컬 설치 스모크 시나리오 (v0.1.0)

마켓플레이스 등록 전에 **로컬 클론으로 플러그인이 동작하는지** 1분 안에 확인하는 절차입니다. 각 단계 끝에는 "기대 출력" 이 있어 실패를 즉시 식별할 수 있습니다.

---

## 전제

- Claude Code 가 설치되어 있음 (`claude --version` 동작).
- Git 이 설치되어 있음.
- 테스트용 빈 디렉터리 하나 (예: `~/tmp/harness-smoke/`). 기존 프로젝트에서 시험하지 마세요.

---

## 1. 플러그인 로컬 클론

```bash
# 임의의 플러그인 보관 위치 선택 (예시)
mkdir -p ~/.claude/plugins
cd ~/.claude/plugins
git clone https://github.com/qwerfunch/harness-boot.git
cd harness-boot
```

**기대 출력**: `.claude-plugin/plugin.json` · `commands/init.md` · `skills/spec-conversion/SKILL.md` · `docs/templates/starter/` 가 존재.

```bash
ls .claude-plugin/plugin.json commands/init.md skills/spec-conversion/SKILL.md docs/templates/starter/
```

4 경로 모두 OK 로 나와야 합니다.

---

## 2. Claude Code 가 플러그인을 인식하는지 확인

Claude Code 설정에 플러그인 경로를 등록합니다. 방법은 환경에 따라 두 가지:

### 방식 A — 환경변수 (단순)

```bash
export CLAUDE_PLUGIN_ROOT="$HOME/.claude/plugins/harness-boot"
```

### 방식 B — `~/.claude/settings.json` (영속)

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

**기대 출력**: Claude Code 재시작 후 `/harness:init` 이 슬래시 명령 자동완성에 나타남.

---

## 3. 테스트 프로젝트에서 `/harness:init` 실행

```bash
mkdir -p ~/tmp/harness-smoke
cd ~/tmp/harness-smoke
git init
claude
```

Claude Code 세션 안에서:

```
/harness:init --solo
```

**기대 출력** (Claude 응답 말미):

```
✅ harness-boot 설치 완료 (v0.1.0)

생성된 파일:
  .harness/spec.yaml          ← 당신이 편집할 유일한 파일
  .harness/harness.yaml       ← 도구 관리
  .harness/state.yaml         ← 진행 상태
  .harness/events.log         ← 이벤트 스트림
  CLAUDE.md                   ← Claude 세션 컨텍스트 (spec.yaml import 포함)
  .gitignore                  ← 병합됨

다음 단계:
  1. `/harness:spec` 을 불러 제품 설명을 채우세요.
     이미 `plan.md` 가 있다면: `/harness:spec --from plan.md`
  2. 채운 후 `/harness:sync` 로 도메인/아키텍처 파생을 실행하세요.
  3. `/harness:work` 로 Walking Skeleton 기능부터 구현을 시작하세요.
```

> **주의**: v0.1.0 에서는 `/harness:spec` · `/harness:sync` · `/harness:work` 가 아직 없습니다. 위 "다음 단계" 는 Claude 가 출력하는 **안내 텍스트일 뿐**, 실행 가능 명령이 아닙니다. 직접 `.harness/spec.yaml` 을 편집하세요.

---

## 4. 파일 생성 검증

다른 터미널에서 (세션 종료 없이):

```bash
cd ~/tmp/harness-smoke
ls -la .harness/
cat .harness/events.log
head -20 CLAUDE.md
grep "harness-boot" .gitignore
```

**기대 출력**:

- `.harness/` 안에 `spec.yaml` · `harness.yaml` · `state.yaml` · `events.log` · `hooks/` · `protocols/` · `_workspace/handoff/` 존재.
- `events.log` 에 1 줄 JSON Lines: `{"ts":"2026-04-...","type":"harness_initialized","plugin_version":"0.1.0","mode":"solo"}`.
- `CLAUDE.md` 첫 줄이 `# harness-smoke — Claude Code 워크스페이스` (프로젝트 이름 치환 확인).
- `.gitignore` 에 `.harness/_workspace/` 등 harness-boot 블록 존재.

모두 통과하면 v0.1.0 스모크 **성공**.

---

## 5. 재실행 방어 검증

```
/harness:init --solo
```

**기대 출력**: "하네스가 이미 설치되어 있습니다" 경고로 중단. 파일은 그대로.

---

## 6. `--team` 모드 분기 검증 (선택)

```bash
cd ~/tmp
rm -rf harness-smoke-team
mkdir harness-smoke-team
cd harness-smoke-team
git init
claude
```

Claude 세션:

```
/harness:init --team
```

그 후:

```bash
grep "state.yaml" .gitignore
```

**기대 출력**: `.harness/state.yaml` 이 `.gitignore` 에 포함.

---

## 실패 디버깅 체크리스트

| 증상 | 원인 후보 | 해결 |
|------|----------|------|
| `/harness:init` 이 자동완성에 안 나옴 | 플러그인 경로 미등록 | §2 방식 A/B 재확인. Claude Code 재시작. |
| "플러그인 경로 못 찾음" 오류 | `CLAUDE_PLUGIN_ROOT` 미설정 or `settings.json` 경로 오타 | `echo $CLAUDE_PLUGIN_ROOT` 확인. 경로는 **절대 경로**. |
| `.harness/spec.yaml` 템플릿 Read 실패 | 레포 클론이 얕거나 불완전 | `git fetch --all` 후 `ls docs/templates/starter/spec.yaml.template` 재확인. |
| `CLAUDE.md` 프로젝트 이름이 `{{PROJECT_NAME}}` 그대로 | 디렉터리명 추출 실패 | `.harness/harness.yaml` 을 수동 수정하거나 `package.json`·`pyproject.toml` 을 먼저 생성 후 재실행. |
| `events.log` 타임스탬프가 `null` | `date -u` 명령 미지원 | Claude 가 ISO8601 문자열을 fallback 으로 채움. 수동 수정 가능. |

---

## 정리

```bash
rm -rf ~/tmp/harness-smoke ~/tmp/harness-smoke-team
```

플러그인 클론은 유지해도 됩니다 (다른 프로젝트에서 재사용).

---

## 다음

v0.1.0 스모크를 통과했다면 실제 프로젝트에서 `.harness/spec.yaml` 을 편집하세요. 막히면:

- [docs/templates/starter/spec.yaml.template](../templates/starter/spec.yaml.template) — 최소 골격
- [tests/regression/conversion-goldens/](../../tests/regression/conversion-goldens/) — 8 완성 예시
- [skills/spec-conversion/SKILL.md](../../skills/spec-conversion/SKILL.md) — plan.md 가 있다면 변환 가이드

v0.2.0 에서 `/harness:sync` · `/harness:work` 가 합류하면 자동화가 확대됩니다.

---

## 부록 A — Dev 모드 (v0.3.10+, 플러그인 기여자 전용)

**목적**: harness-boot **자체를 개발하면서** 편집 중인 코드를 `/harness:*` 슬래시 명령으로 즉시 검증. Phase 2 (Active dogfood) 의 전제.

### A.1 언제 필요한가

- `scripts/sync.py` 수정 후 `/harness:sync` 가 실제로 수정된 코드를 쓰는지 확인
- `commands/work.md` 의 prose 규약이 LLM 에게 제대로 해석되는지 실세션 검증
- `scripts/work.py` 로 harness-boot 자체 피처 사이클을 기록하고 `/harness:metrics` 로 집계

### A.2 세팅 (택 1)

**방식 A — 환경변수 (세션 단위, 가장 단순)**:

```bash
export CLAUDE_PLUGIN_ROOT="/Users/you/Developer/work/harness-boot"   # 실제 dev checkout 경로
claude
```

**방식 B — `~/.claude/settings.json` (영속)**:

```json
{
  "plugins": [
    {
      "name": "harness-boot-dev",
      "path": "/Users/you/Developer/work/harness-boot"
    }
  ]
}
```

### A.3 검증

1. Claude Code 세션 새로 열기
2. 프롬프트에 `/harness:` 입력 → 자동완성에 `/harness:init` · `:sync` · `:work` · `:status` · `:check` · `:events` · `:metrics` · `:spec` 8 개 전부 나타남
3. 테스트 명령 실행: `/harness:status`
4. 기대 출력: 사용자 cwd 의 `.harness/` (예: 플러그인 repo 자신의 `.harness/` 에서 실행했다면 harness-boot-self 의 21 피처 status)

### A.4 편집 루프 (즉시 반영)

- `scripts/*.py` 편집 → 다음 슬래시 명령 호출부터 **수정된 코드** 사용 (캐시 없음)
- `commands/*.md` 편집 → LLM 이 매 turn 에 읽으므로 세션 재시작 불필요
- 따라서 "코드 수정 → `/harness:sync` → 결과 확인" 루프가 TDD 만큼 빠름

### A.5 사용자 released 플러그인과의 전환

released 버전 (`/plugin install harness@harness-boot` 으로 받은 것) 과 dev 모드는 **상호 배타**. 동시 활성 시 Claude Code 가 어느 쪽을 쓸지 우선순위가 불명확.

```bash
# dev 모드 해제
unset CLAUDE_PLUGIN_ROOT                   # 방식 A 해제
# settings.json 에서 "harness-boot-dev" 항목 삭제    # 방식 B 해제

# released 플러그인 재활성
/plugin install harness@harness-boot       # 이미 설치되어 있으면 skip
```

### A.6 주의사항

- **dev checkout 내부에서 `/harness:init` 실행 금지** (CLAUDE.md §7). 이 repo 자신이 플러그인 소스 — init 이 `commands/` · `scripts/` 를 덮어쓰려 함.
- dev 모드에서 `/harness:work F-XXX --complete` 호출 시 **이 repo 의 `.harness/state.yaml`** 이 수정됨. 커밋/push 전 `git status` 확인.
- `.harness/events.log` 는 gitignored — 개인 로그. 다른 기기 간 공유 안 됨.
- **stale plugin install 주의**: `~/.claude/plugins/harness-boot/` 에 released 버전이 있으면 방식 A/B 의 경로가 거기로 잘못 해석될 여지. `echo $CLAUDE_PLUGIN_ROOT` 로 현재 경로 확인 필수.

### A.7 자체 무결성 검증 (Phase 1, 항상 가능)

dev 모드 세팅 없이도 `python3 scripts/*.py` 직접 호출은 항상 현재 checkout 코드 사용. 즉 Phase 1 self_check 는 dev 모드 불필요:

```bash
cd /path/to/harness-boot
bash scripts/self_check.sh                  # 5 단계 검증 (v0.3.10+)
python3 -m unittest discover tests.unit     # 374 tests 포함 test_self_dogfood
```

Phase 2 (슬래시 명령 실사용) 에서만 위 A.1~A.6 세팅 필요.

---

## 부록 B — 참조

- `CLAUDE.md §7` — 작업 규칙 (자체 도그푸드 가이드 포함)
- `.harness/README.md` — dev-only 도그푸드 안내
- `scripts/self_check.sh` — Phase 1 5 단계 검증
