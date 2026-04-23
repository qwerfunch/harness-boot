---
description: harness-boot 플러그인을 현재 프로젝트에 설치 — .harness/ 골격 + CLAUDE.md 편성. 프로젝트당 1회.
allowed-tools: [Read, Write, Edit, Bash, Glob]
argument-hint: "[--team | --solo]  # (선택) state.yaml 커밋 정책"
---

# /harness:init — 하네스 설치

이 명령은 **현재 작업 디렉터리에 harness-boot 골격을 생성**합니다. Claude 는 다음 단계를 순서대로 **정확히** 수행하세요. 각 단계 후 간단히 성공/실패를 보고하되, 전체 명령 실행 중 **요약은 마지막에 1회** 만 하세요.

## Preamble (출력 맨 앞)

```
🧰 /harness:init · 설치 · <근거 10단어 이내>
```

예: `🧰 /harness:init · 설치 · .harness/ 새로 생성 + CLAUDE.md 병합`

## 단계

### 0. 전처리 — 기존 설치 확인

1. `Bash: pwd` 로 현재 디렉터리 확인. 사용자 프로젝트 루트가 맞는지 판단:
   - `Bash: ls package.json pyproject.toml Cargo.toml .git 2>/dev/null | head` 로 4 개 신호 중 존재하는 것을 수집.
   - **하나라도 존재**: 정상 — 바로 다음 단계로.
   - **하나도 없음**: 사용자에게 확인 프롬프트: "이 디렉터리는 프로젝트 루트로 보이지 않습니다 (`package.json` · `pyproject.toml` · `Cargo.toml` · `.git` 모두 부재). 현재 위치 `${PWD}` 에 하네스를 설치할까요? (y/N)". "N" 또는 빈 답변이면 중단. "y" 면 `git init` 을 먼저 하도록 권고 후 진행.
2. `Glob: .harness/**` 로 기존 하네스 존재 여부 확인.
   - 이미 `.harness/spec.yaml` 가 있으면 **경고 출력 후 중단**: "하네스가 이미 설치되어 있습니다. `.harness/spec.yaml` 을 직접 편집하세요. (v0.2+ 에서 `/harness:spec`·`/harness:check` 활성화 예정)"
3. 인자 문자열 파싱: 인자에 `--team` 이 포함되면 `mode=team` (state.yaml 을 `.gitignore` 에 추가), `--solo` 이거나 인자 없으면 `mode=solo` (커밋 대상 유지). 이외 인자는 무시 + 말미 보고에 "인식 안 된 인자: X" 경고.

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

이 프로젝트는 harness-boot 플러그인으로 관리됩니다. `/harness:spec` 으로 제품 설명을 편집하세요.
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

다음 단계 (v0.1.0 기준 — /harness:spec 등은 v0.2+ 예정):
  1. `.harness/spec.yaml` 을 직접 편집하세요. 예시는 docs/samples/ 참고.
     이미 `plan.md` 가 있다면: skills/spec-conversion 을 활성화하고 "이 plan.md 를 spec.yaml 로 변환해줘" 요청.
  2. 편집 완료 후 세션을 재시작하면 CLAUDE.md 의 @ import 가 새 spec 을 로드합니다.

문서: https://github.com/qwerfunch/harness-boot
v0.2 로드맵: /harness:sync (파생) · /harness:work (구현) · /harness:check (드리프트)
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

v0.1.0 단계에서는 사용자가 spec.yaml 을 채운 후 `/harness:spec` · `/harness:sync` 로 수동 진전하면 됩니다. `.claude/` 는 비어있어도 Claude Code 가 경고하지 않습니다.
