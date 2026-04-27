---
description: harness-boot 플러그인을 현재 프로젝트에 설치 — .harness/ 골격 + CLAUDE.md 편성. 프로젝트당 1회. 자연어 또는 3 옵션 메뉴로 진입.
allowed-tools: [Read, Write, Edit, Bash, Glob]
argument-hint: "[자연어 설명 또는 빈 호출 (메뉴)]  # 예: 트위터 같은 거 만들래 · 대충 프로토타입 · plan.md 있어"
---

# /harness-boot:init — 하네스 설치 (v0.9)

이 명령은 **현재 작업 디렉터리에 harness-boot 골격을 생성**합니다. **한 프로젝트에 평생 1 회** 실행.

## 진입 2 방식

**A · 자연어 직접 (권장)**

```
/harness-boot:init 솔로 음악인 연습용 포모도로 타이머
/harness-boot:init 트위터 같은 거 만들래
/harness-boot:init 빨리 대충 프로토타입
/harness-boot:init plan.md 기반으로 시작
/harness-boot:init 이미 만들던 코드에 적용
```

Claude 는 자연어를 읽어 **3 옵션 중 하나로 라우팅** + 필요한 힌트 주입. 라우팅 결과를 사용자에게 plan 으로 공개 → Y/n → 진행.

### 자연어 → 라우팅 규칙

| 사용자 말 | 라우팅 |
|---|---|
| 단순 아이디어 | 옵션 1 (아이디어만) |
| "~~~ 같은 거" · "~~~ 처럼" · 참고 제품 언급 | 옵션 1 + 레퍼런스 맥락 주입 |
| "대충" · "빨리" · "프로토타입" · "실험" | 옵션 1 + `project.mode: prototype` hint |
| "제대로" · "크게" · "장기" · "정식" | 옵션 1 + `project.mode: product` (default) 명시 |
| "plan.md" · "기획 문서" · "기획서" · "요구사항" | 옵션 2 |
| "기존 코드" · "이미 만들던" · "기존 프로젝트" | 옵션 3 |
| (모호 · 다의적) | 3 옵션 메뉴 fallback |

**Plan 공개 예**:

```
사용자: /harness-boot:init 트위터 같은 거 만들래

Claude 해석:
  • 아이디어 있음 + 레퍼런스 언급 (Twitter)
  • → 옵션 1 (아이디어부터) + 레퍼런스 맥락 주입

실행 계획:
  1. .harness/ 골격 생성
  2. researcher 에게 "Twitter 참고 · MVP 축소" context 주입
  3. 배경 조사 → 로드맵 → 첫 피처 준비

이 해석 맞나요?
  Y = 그대로 진행
  n = 다시 설명해 주세요
  다른 자연어 = Claude 가 재해석
```

**B · 빈 호출 → 3 옵션 메뉴 (fallback)**

자연어 없이 `/harness-boot:init` 만 실행 · 또는 라우팅 모호 시:

```
🚀 harness-boot 을 이 프로젝트에 처음 적용합니다

어떤 상황이세요?

  1) 아이디어만 있어요
     → 함께 기획부터 · 대화로 진행

  2) 기획 문서가 이미 있어요
     → 문서 기반으로 빠르게 설계 만들기

  3) 이미 코드가 있는 프로젝트에 적용
     → 현재 상태부터 정리 · 앞으로의 로드맵

  0) 어떤 차이인지 잘 모르겠어요
     → 각 옵션 간단 설명
```

## Preamble (출력 맨 앞 3 줄)

```
🧰 /harness-boot:init · <mode=solo|team> · <근거 5~10 단어>
NO skip: §0-2 기존 .harness/spec.yaml 검사 — 재실행 시 덮어쓰기 금지
NO shortcut: §5 events.log 에 harness_initialized 이벤트 append
```

**1 줄**: 이모지 · 명령 · mode · 근거.
**2-3 줄 (Anti-rationalization, BR-014)**: 이 명령이 건너뛸 수 없는 제약 2 개를 명시적으로 선언. LLM 이 "이미 됐다" 로 skip 하는 경로 차단.

예: `🧰 /harness-boot:init · solo · 빈 디렉터리에 .harness/ 최초 스캐폴딩`

## 단계

### 0. 전처리 — 기존 설치 확인

1. `Bash: pwd` 로 현재 디렉터리 확인.
2. `Bash: ls package.json pyproject.toml Cargo.toml .git 2>/dev/null` 로 프로젝트 루트 신호 4 종 중 존재하는 것을 수집 — **정보성만**. 판정 결과에 따라 중단하지 않음 (사용자가 `/harness-boot:init` 을 명시적으로 호출한 이상 현재 디렉터리 설치 의도로 간주).
   - 하나라도 존재: 최종 보고의 "모드" 라인 앞에 `프로젝트 신호: <감지된 파일 목록>` 한 줄 추가.
   - 하나도 없음: 최종 보고의 끝에 **한 줄 권고** 만 추가 — `팁: 'git init' 로 저장소 초기화를 권장합니다.` (중단 없음, 바로 다음 단계로 진행).
3. `Glob: .harness/**` 로 기존 하네스 존재 여부 확인.
   - 이미 `.harness/spec.yaml` 가 있으면 **경고 출력 후 중단**: "하네스가 이미 설치되어 있습니다. `.harness/spec.yaml` 을 직접 편집하세요. (v0.2+ 에서 `/harness-boot:work`·`/harness-boot:work` 활성화 예정)"
4. 인자 문자열 파싱: 인자에 `--team` 이 포함되면 `mode=team` (state.yaml 을 `.gitignore` 에 추가), `--solo` 이거나 인자 없으면 `mode=solo` (커밋 대상 유지). 이외 인자는 무시 + 말미 보고에 "인식 안 된 인자: X" 경고.

### 1. 디렉터리 생성

`Bash` 로:

```
mkdir -p .harness .harness/hooks .harness/protocols .harness/_workspace/handoff
mkdir -p .claude/agents .claude/skills
```

### 2. starter 템플릿 복사 (3개 파일, CLAUDE.md 는 §3)

플러그인 레포의 `docs/templates/starter/` 에서 읽어와 **내용을 사용자 프로젝트** 로 씁니다.

**플러그인 루트 경로 해석** (Claude Code 2.1.x 관찰 — NEW-37 · NEW-44 기반):

Claude 는 다음 순서로 시도, **첫 성공값** 을 사용:

**전략 A — `$PATH` 역산** (가장 신뢰 높음):
```bash
echo "$PATH" | tr ':' '\n' | grep -E '/plugins/.*/bin$' | while IFS= read -r bin_dir; do
  root="${bin_dir%/bin}"
  manifest="$root/.claude-plugin/plugin.json"
  [ -r "$manifest" ] || continue
  name=$(jq -r '.name // empty' "$manifest" 2>/dev/null)
  if [ "$name" = "harness" ]; then
    printf '%s\n' "$root"; exit 0
  fi
done
```

**전략 B — 레지스트리 `installPath`**:
```bash
jq -r '.plugins | to_entries[] | select(.key | startswith("harness@")) | .value[0].installPath // empty' \
  ~/.claude/plugins/installed_plugins.json
```
→ 결과 경로가 실존할 때만 사용 (`[ -d "$path" ]`).

**전략 C — 마켓플레이스 `source.path` fallback** (NEW-44, directory-type 전용):
- `~/.claude/settings.json` 의 `extraKnownMarketplaces[<marketplace>].source.path` 획득.
- 해당 경로의 `.claude-plugin/marketplace.json` 을 읽어 `plugins[] | select(.name == "harness") | .source` 의 상대 경로를 marketplace 루트에 결합.
- `~` 는 `$HOME` 으로 확장. symlink 는 `realpath` 로 해결.

**전략 D — 사용자 프롬프트** (최후 fallback):
"플러그인 루트 경로를 직접 입력하세요 (예: `~/Developer/harness-boot`):"

**환경변수 주의**: `$CLAUDE_PLUGIN_ROOT` 는 CC 2.1.x 에서 **설정되지 않음** (첫 실행 스모크 2026-04-23 에서 확정). 이 변수에 의존하지 말 것.

템플릿 매핑 (§2 에서 처리하는 3 파일):

| 원본 (플러그인 내) | 대상 (사용자 프로젝트) |
|---|---|
| `docs/templates/starter/spec.yaml.template` | `.harness/spec.yaml` |
| `docs/templates/starter/harness.yaml.template` | `.harness/harness.yaml` |
| `docs/templates/starter/state.yaml.template` | `.harness/state.yaml` |

각 파일에 대해:
1. `Read` 플러그인 내 템플릿.
2. `Write` 대상 경로 (내용 수정 없음).

`CLAUDE.md` 는 병합 로직이 섞여있으므로 §3 이 전담합니다.

### 2.5. 선택 파일 — `.gitignore` + `conftest.py` (v0.8.9)

**`.gitignore`** — 프로젝트 루트. `.harness/` 안의 파생물 (events.log · state.yaml · harness.yaml · domain.md · architecture.yaml · _workspace/) 과 로테이션된 `events.log.YYYYMM*` 를 무시하는 설정 포함. 이게 없으면 `/harness-boot:work --run-gate gate_4` 가 매번 dirty working tree 로 fail — v0.8.6 e2e 실증에서 확인된 gap.

- 대상: 프로젝트 루트 `.gitignore`
- 원본: `docs/templates/starter/.gitignore.template`
- **이미 `.gitignore` 가 있으면 **append 병합** (중복 라인은 생략 · "# harness-boot —" 섹션 헤더로 구분)**. 새로 만들면 전체 복사.

**`conftest.py`** — Python 프로젝트만. `src/<pkg>/` 레이아웃에서 pytest 수집 + subprocess smoke 의 PYTHONPATH 전파 처리. Node/다른 런타임이면 건너뜀.

- 대상: 프로젝트 루트 `conftest.py`
- 원본: `docs/templates/starter/conftest.py.template`
- **이미 `conftest.py` 가 있으면 사용자에게 병합 여부 확인 후 manual merge** (자동 병합 금지 — pytest 설정은 프로젝트마다 민감).
- `src/` 디렉터리가 없는 프로젝트에는 복사하지 않음 (flat layout 은 필요 없음).

이 섹션을 건너뛰면 나중에 수동으로 복사해도 됨. `/harness-boot:init --solo` 같은 라이트 모드에서는 기본 skip.

### 3. CLAUDE.md 생성 또는 병합

**신규 생성** 케이스 (CLAUDE.md 가 프로젝트 루트에 없을 때):
1. `Read` 플러그인 내 `docs/templates/starter/CLAUDE.md.template`.
2. `{{PROJECT_NAME}}` 을 실제 프로젝트 이름으로 치환. 다음 순서로 **첫 유효값** 을 사용 (유효 = 비어있지 않고 공백만도 아닌 문자열):
   - `package.json` 의 `name` 필드 (존재 + 유효 시)
   - `pyproject.toml` 의 `[project].name` (존재 + 유효 시)
   - `pyproject.toml` 의 `[tool.poetry].name` (존재 + 유효 시)
   - 현재 디렉터리 이름 (`basename "$PWD"`) — 결과가 `.` · 공백 포함 · 빈 문자열이면 건너뜀
   - 위 모두 실패 시 사용자에게 프롬프트: "프로젝트 이름을 입력하세요 (kebab-case 권장):"

   추출된 이름을 **kebab-case 로 정규화**:
   - 공백 · `_` · `.` → `-`
   - 연속 `-` → 단일 `-`
   - 앞뒤 `-` 제거
   - 소문자 변환
   - 정규화 후 빈 문자열이면 사용자 프롬프트로 fallback
3. `Write` 대상 `CLAUDE.md`.

**이미 존재** 케이스: 기존 파일 끝에 다음 1줄을 **덧붙이고** (중복이면 스킵):

```
@.harness/spec.yaml
```

그리고 별도로 한 단락을 추가:

```
## harness-boot

이 프로젝트는 harness-boot 플러그인으로 관리됩니다. `/harness-boot:work` 으로 제품 설명을 편집하세요.
```

### 4. .gitignore 편성

1. 기존 `.gitignore` 가 없으면 `.gitignore` 를 `Write`.
2. 다음 엔트리가 없으면 추가 (공백줄 구분):

```
# harness-boot
.harness/_workspace/
.harness/events.log
.harness.tmp/
.harness.backup/
```

3. `--team` 인자면 추가:

```
.harness/state.yaml
```

### 5. 초기 이벤트 로그

`.harness/events.log` 를 **신규** 로 작성 (JSON Lines, 1줄):

```json
{"ts":"<ISO8601 UTC>","type":"harness_initialized","plugin_version":"0.1.0","mode":"<team|solo>"}
```

타임스탬프 (UTC ISO8601) 획득은 다음 순서로 시도 — **첫 성공값** 사용:

1. `Bash: date -u +%Y-%m-%dT%H:%M:%SZ` (POSIX `date` — macOS · Linux · Git Bash on Windows).
2. 실패 시 `Bash: python3 -c 'import datetime; print(datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))'` (Python 3 설치 시).
3. 실패 시 `Bash: node -e 'console.log(new Date().toISOString().replace(/\.\d{3}Z$/, "Z"))'` (Node 설치 시).
4. 모두 실패 시 사용자에게 현재 UTC 시각 입력 프롬프트 (`YYYY-MM-DDTHH:MM:SSZ` 형식).

또한 `plugin_version` 값은 `.claude-plugin/plugin.json` 의 `version` 필드에서 동적으로 읽되 실패 시 하드코딩 `"0.1.0"` fallback.

### 6. 최종 보고 (사용자 향)

아래 요약을 **한 번만** 출력:

```
✅ harness-boot 설치 완료 (v0.1.0)

생성된 파일:
  .harness/spec.yaml          ← 당신이 편집할 유일한 파일
  .harness/harness.yaml       ← 도구 관리
  .harness/state.yaml         ← 진행 상태
  .harness/events.log         ← 이벤트 스트림
  CLAUDE.md                   ← Claude 세션 컨텍스트 (spec.yaml import 포함)
  .gitignore                  ← 병합됨

다음 단계 (v0.1.0 기준 — /harness-boot:work 등은 v0.2+ 예정):
  1. `.harness/spec.yaml` 을 직접 편집하세요. 예시는 docs/samples/ 참고.
     이미 `plan.md` 가 있다면: skills/spec-conversion 을 활성화하고 "이 plan.md 를 spec.yaml 로 변환해줘" 요청.
  2. 편집 완료 후 세션을 재시작하면 CLAUDE.md 의 @ import 가 새 spec 을 로드합니다.

문서: https://github.com/qwerfunch/harness-boot
v0.2 로드맵: /harness-boot:work (파생) · /harness-boot:work (구현) · /harness-boot:work (드리프트)
```

## 실패 조건 (fail-fast)

- 쓰기 권한 없음 → 사용자에게 권한 확인 요청, 다른 단계 진행 중단.
- `.harness/spec.yaml` 이미 존재 → §0-2 경고로 중단.
- starter 템플릿 Read 실패 (플러그인 경로 못 찾음) → 사용자에게 플러그인 설치 확인 요청, 수동 경로 입력 프롬프트.

## v0.1.0 범위 제한

이 최소판은 **파일 생성** 까지만 합니다. 다음은 **미구현 — v0.2+**:

- `scripts/hash-fixtures.mjs` 호출로 초기 spec 해시 계산
- `.claude/settings.json` + `.claude/agents/*.md` + `.claude/skills/*.md` 자동 생성
- `.harness/hooks/*.mjs` 자동 복사
- 6개 핵심 훅 (security-gate, doc-sync-check, coverage-gate, format, test-runner, session-start-bootstrap)

v0.1.0 단계에서는 사용자가 spec.yaml 을 채운 후 `/harness-boot:work` · `/harness-boot:work` 로 수동 진전하면 됩니다. `.claude/` 는 비어있어도 Claude Code 가 경고하지 않습니다.

## Issue logging — harness-boot 개선 피드백 루프 (F-027)

이 명령을 실행하면서 **harness-boot 플러그인 자체의 마찰** (어색한 UX · 작동 안 하는 명령 · 헷갈리는 안내 · stale doc · dead reference · 빠진 자동화 · 갑자기 막힘) 을 발견하면 **즉시 한 항목씩** `.harness/_workspace/issues-log.md` 에 append. 사용자가 메인테이너에게 공유 시 다음 plugin 릴리즈 (예: cosmic-suika I-001/I-008/I-010 → v0.10.x 환원) 의 trigger.

`.harness/_workspace/issues-log.md` 가 없으면 새로 만들고 짧은 헤더 (`# harness-boot ISSUES-LOG — <project name>`) 만 1 회 작성.

**Entry 템플릿 (markdown, append-only)**:

```markdown
## YYYY-MM-DDTHH:MM:SSZ — <한 줄 제목>
- **Source**: /harness-boot:init
- **Category**: ergonomics | bug | missing-feature | dead-reference | docs-stale
- **Severity**: blocker | annoying | trivial
- **What happened**: <1~3 줄 — Claude 가 본 사실>
- **Suggested fix**: <선택 — 떠오르면 1 줄>
```

**언제 안 적나**: 사용자 코드/스펙 자체의 문제 (그건 사용자가 고친다) · 단순 사용자 오타 · 일반 Claude Code 사용법 (harness-boot 무관). 의심스러우면 한 줄로 적되 Severity=trivial.

**NO skip**: 이 섹션은 fail-open 이지만 (logging 실패가 명령을 막지 않음) **Claude 가 마찰을 봤는데 적지 않으면** 다음 사용자가 같은 마찰을 또 만남 — 디시플린.
