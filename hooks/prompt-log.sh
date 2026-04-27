#!/usr/bin/env bash
# prompt-log.sh — UserPromptSubmit hook (F-028)
#
# 사용자가 입력한 모든 prompt 를 .harness/_workspace/prompts/YYYY-MM.jsonl 에
# 무음 append. 추후 'prompt 형상화' (어떤 자연어가 init/work 라우팅을 잘
# 트리거하는지) 데이터 베이스.
#
# 계약:
#   - .harness/ 가 없는 워크스페이스에서는 silent exit 0 (대부분의 user 세션).
#   - fail-open: 어떤 에러도 사용자 prompt 처리를 막지 않음 (exit 0 보장).
#   - 출력 없음 (stdout 비움) — UserPromptSubmit 은 exit 2 일 때 블로킹이지만
#     0 일 때도 stdout 이 사용자에게 보일 수 있어 무조건 무출력.
#   - stdin 으로 Claude Code 가 JSON payload 전달:
#       {"session_id": "...", "cwd": "...", "user_prompt": "...", ...}
#     `user_prompt` 우선, 없으면 `prompt` fallback (Claude Code 버전 호환).

set -u

# stdin 읽기 (JSON payload). cat 실패해도 exit 0 으로 빠져나감.
INPUT="$(cat 2>/dev/null || true)"

# cwd 결정: input.cwd > $CLAUDE_PROJECT_DIR > pwd
CWD="$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    d = json.loads(sys.stdin.read())
    print(d.get("cwd", "") or "")
except Exception:
    print("")
' 2>/dev/null || true)"
[ -z "$CWD" ] && CWD="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# .harness/ 없으면 silent exit (대부분의 워크스페이스).
[ -d "$CWD/.harness" ] || exit 0

DEST_DIR="$CWD/.harness/_workspace/prompts"
mkdir -p "$DEST_DIR" 2>/dev/null || exit 0

MONTH="$(date -u +%Y-%m 2>/dev/null || echo unknown)"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo unknown)"
DEST="$DEST_DIR/${MONTH}.jsonl"

# JSONL 한 줄 append. python3 부재 시도 silent exit.
printf '%s' "$INPUT" | python3 -c "
import json, sys
try:
    raw = sys.stdin.read()
    d = json.loads(raw) if raw.strip() else {}
    text = d.get('user_prompt') or d.get('prompt') or ''
    sid = d.get('session_id', '')
    entry = {'ts': '$TS', 'session_id': sid, 'prompt': text}
    print(json.dumps(entry, ensure_ascii=False))
except Exception:
    pass
" >> "$DEST" 2>/dev/null || true

exit 0
