# Opt-in hook templates (v0.4+, F-014)

harness-boot 플러그인은 **SessionStart banner 하나만** 플러그인 루트 `hooks/` 에 ship. 나머지 훅은 **사용자가 원할 때 복사** 하도록 이 디렉터리에 template 로 제공.

## 왜 opt-in?

Claude Code 플러그인 훅은 설치된 **모든 workspace 에서 fire**. 예를 들어 security-gate 가 plugin-wide 라면 harness 를 쓰지 않는 프로젝트에서도 bash 한 줄마다 실행됨 → 사용자 경험 저해.

해결: **infra template 은 여기에 두고**, 각 프로젝트 필요 시 사용자가 `.claude/hooks.json` 으로 개별 복사.

## 포함된 template 5 종

| 파일 | 트리거 | 동작 | 위험도 |
|---|---|---|---|
| `security-gate.sh` | PreToolUse Bash | `rm -rf` · `sudo` · `chmod 777` 감지 시 경고 (exit 0, fail-open) | 낮음 |
| `format.sh` | PostToolUse Write\|Edit | prettier / black 설치 시 자동 포맷 (없으면 skip) | 매우 낮음 |
| `doc-sync-check.sh` | PostToolUse Write\|Edit | CLAUDE.md 의 `@import` 타겟이 여전히 존재하는지 grep | 매우 낮음 |
| `test-runner.sh` | PostToolUse Write\|Edit (`.py` · `.ts` · `.go`) | 바뀐 파일에 해당하는 테스트 실행 (opt-in · 느릴 수 있음) | 중간 |
| `coverage-gate.sh` | PreToolUse Bash (`rm -rf` · `git reset --hard`) | 실행 전 경고 + sleep 2 | 낮음 |

## 설치 방법 (사용자용)

```bash
# 1. 사용자 프로젝트 루트로 이동
cd /path/to/my-project

# 2. 원하는 hook script 를 자기 .claude/ 로 복사
mkdir -p .claude/hooks
cp "$CLAUDE_PLUGIN_ROOT/docs/templates/hooks/security-gate.sh" .claude/hooks/

# 3. .claude/settings.json 에 hooks 섹션 추가 (or merge)
cat > .claude/settings.local.json <<'EOF'
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "bash $PWD/.claude/hooks/security-gate.sh || true"
      }]
    }]
  }
}
EOF

# 4. Claude Code 재시작 또는 /hooks 로 reload
```

각 template 스크립트 상단 주석에 개별 설치 스니펫 포함됨.

## 공통 규칙 (모든 template 준수)

1. **fail-open**: script exit != 0 이어도 Claude Code 작업 차단 금지 → `|| true` 래핑 또는 `exit 0` 강제
2. **CQS**: 진단만. 대상 파일 mtime 변경 금지
3. **stdin JSON 파싱**: `jq` 나 `python3 -c "import json,sys; ..."` 로 안전 처리 · unquoted `| xargs` 금지
4. **경로 공백 대응**: 파일 경로 변수는 항상 quote
5. **검증**: pipe-test 로 각 template 을 직접 실행 (샘플 stdin payload) 해서 exit 0 확인

## 기여자 확장

새 template 추가:
1. `docs/templates/hooks/<name>.sh` 작성
2. 이 README 표에 한 줄 추가
3. `tests/unit/test_hooks.py` 에 shebang · fail-open · 실행권한 검증 추가
4. 커밋
