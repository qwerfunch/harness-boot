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

### 권장 경로 — 마켓플레이스 설치 ✅ **검증됨 (v0.3.10 real-session 확인)**

v0.1.1 부터 `.claude-plugin/marketplace.json` 이 레포에 포함됨. GitHub 직접 설치 지원:

```
/plugin marketplace add qwerfunch/harness-boot
/plugin install harness@harness-boot
```

기대: Claude Code 재시작 후 `/harness:` 자동완성에 **8 개 명령** (init · spec · sync · work · status · check · events · metrics) 전부 표시.

업그레이드:
```
/plugin marketplace update harness-boot
/plugin update harness@harness-boot
```

현재 버전 확인:
```
/plugin list
```

### 레거시 경로 ⚠️ **미검증 — 로컬 클론 직결**

아래 두 방식은 v0.1.0 시점 문서로 **Claude Code 가 실제로 해당 메커니즘을 지원하는지 확증되지 않음**. 자기 책임으로 시도. 실패 시 위 마켓플레이스 경로로 복귀 권장.

**방식 A — 환경변수**:
```bash
export CLAUDE_PLUGIN_ROOT="$HOME/.claude/plugins/harness-boot"
```

**방식 B — `~/.claude/settings.json`**:
```json
{
  "plugins": [
    {
      "name": "harness-boot",
      "path": "/absolute/path/to/harness-boot"
    }
  ]
}
```

> 2026-04-23 검증 시도: v0.1.1 이 설치된 상태에서 `CLAUDE_PLUGIN_ROOT=/path/to/dev-checkout` 설정해도 Claude Code 는 여전히 설치본 (v0.1.1) 의 명령만 노출. 즉 방식 A 가 플러그인 경로 override 로 기능하지 않음을 시사. Claude Code 플러그인 discovery 는 실제로는 `/plugin install` 기반의 마켓플레이스 경로만 사용하는 것으로 관찰됨.

**기대 출력** (마켓플레이스 경로 기준): Claude Code 재시작 후 `/harness:init` 이 슬래시 명령 자동완성에 나타남.

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

## 부록 A — 자체 도그푸드 · Dev 편집 루프 (v0.3.10+)

**목적**: harness-boot 기여자가 자기 변경사항을 검증. 두 경로가 있고 **현재 검증된 경로는 A.1 뿐**.

### A.1 ✅ 검증됨 — Scripts-direct + 릴리즈된 플러그인 (2 track)

**Track 1 — 스크립트 직접 호출** (항상 현재 checkout 코드 사용):

```bash
cd /path/to/harness-boot
bash scripts/self_check.sh                  # 5 단계 검증 (v0.3.10+)
python3 -m unittest discover tests.unit     # 374 tests 포함 test_self_dogfood
python3 scripts/status.py --harness-dir .harness
python3 scripts/check.py --harness-dir .harness --project-root .
```

→ `scripts/` 편집 즉시 반영. dev 모드 세팅 불필요.

**Track 2 — 릴리즈된 플러그인으로 슬래시 명령** (편집 → 릴리즈 → `/plugin update` 루프):

```
/plugin marketplace add qwerfunch/harness-boot
/plugin install harness@harness-boot
# 이후 각 릴리즈마다:
/plugin marketplace update harness-boot
/plugin update harness@harness-boot
```

→ `/harness:*` 8 개 명령이 릴리즈된 스냅샷의 `commands/*.md` + `scripts/*.py` 사용.
→ 2026-04-23 확인: v0.3.10 업그레이드 후 `/harness:status` 실행 시 Preamble 3 줄 + Anti-rationalization 2 줄 + 21 features status 정상 출력.

**편집-검증 사이클**:
- scripts 변경 → 커밋 · 태그 · 릴리즈 · `/plugin update` → `/harness:*` 에 반영
- 릴리즈 비용 부담되면 Track 1 (직접 호출) 이 현실적

### A.2 ⚠️ 미검증 — Dev checkout 라이브 반영 (편집 즉시 슬래시 명령 반영)

아래 두 방식은 Claude Code 가 실제로 지원하는지 **확증 안 됨**. 2026-04-23 시도 결과 둘 다 설치된 플러그인 버전을 우회하지 못함을 시사.

**방식 A — 환경변수**:
```bash
export CLAUDE_PLUGIN_ROOT="/path/to/dev-checkout"
```

**방식 B — `~/.claude/settings.json`**:
```json
{
  "plugins": [
    {
      "name": "harness-boot-dev",
      "path": "/path/to/dev-checkout"
    }
  ]
}
```

실험 결과 (2026-04-23):
- v0.1.1 이 `/plugin install` 로 이미 설치된 상태에서 `CLAUDE_PLUGIN_ROOT=/path/to/dev-checkout-at-v0.3.9` 지정
- Claude Code 재시작 후 `/harness:` 자동완성에 `/harness:init` **한 개만** 노출 (v0.1.1 의 명령 목록)
- 즉 설치된 플러그인이 우선 · 환경변수는 무시됨

결론: **현재 Claude Code 버전에서 dev checkout 라이브 반영은 작동하지 않는 것으로 관찰됨**. 진짜 live-edit dev 루프가 필요하면 다음 중 하나:
1. Claude Code 공식 문서/이슈에서 지원 메커니즘 확인 (claude-code-guide 에이전트 활용 권장)
2. 릴리즈 루프를 짧게 (예: 수정 → 로컬 commit → `/plugin update`) — v0.3.10 에 Track 2 로 실증
3. 로컬 마켓플레이스 wrapper (`~/.claude/plugins/local-harness-marketplace/.claude-plugin/marketplace.json`) 가 dev checkout 을 source 로 지정 — 일부 팀이 이미 사용한다는 보고

### A.3 주의사항

- **dev checkout 내부에서 `/harness:init` 실행 금지** (CLAUDE.md §7). 이 repo 자신이 플러그인 소스 — init 이 `commands/` · `scripts/` 를 덮어쓰려 함.
- `/harness:work F-XXX --complete` 를 이 repo cwd 에서 호출 시 **이 repo 의 `.harness/state.yaml`** 이 수정됨. 커밋/push 전 `git status` 확인.
- `.harness/events.log` 는 gitignored — 개인 로그. `test_self_dogfood` 가 매번 sync 돌릴 때마다 sync_completed 이벤트 누적.

### A.4 Phase 2 실제 사용 시 (v0.3.11+ 예정)

첫 실 피처 예: `F-014 Hooks 시스템` 같은 v0.4 후보.

```
/harness:work F-014                    # 활성화 · state.yaml 에 in_progress 기록
# (TDD 작업) ...
/harness:work F-014 --run-gate gate_0  # pytest 자동 실행
/harness:work F-014 --run-gate gate_2  # ruff 자동
/harness:work F-014 --run-gate gate_4  # commit clean 체크
/harness:work F-014 --evidence "..." --complete  # BR-004 검증
/harness:metrics --period 7d           # 실 lead time · gate pass rate 집계
```

→ `.harness/events.log` 에 실 피처 타임라인 누적 → `/harness:metrics` 가 진짜 수치 출력.
→ Track 2 (릴리즈된 플러그인) 경로로도 가능하나 릴리즈 전 변경 반영 안 됨 — 피처 도중 스크립트 수정이 잦으면 Track 1 추천.

---

## 부록 B — 참조

- `CLAUDE.md §7` — 작업 규칙 (자체 도그푸드 가이드 포함)
- `.harness/README.md` — dev-only 도그푸드 안내
- `scripts/self_check.sh` — Phase 1 5 단계 검증
