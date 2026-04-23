#!/usr/bin/env bash
# coverage-gate.sh — opt-in hook template (F-014)
#
# Trigger: PreToolUse Bash (for destructive commands)
# Purpose: extra confirmation pause before potentially destructive commands
# Behavior: fail-open — warns + sleeps briefly, never blocks

set -u

PAYLOAD=$(cat)
CMD=$(python3 -c "
import json, sys
try:
    d = json.loads(sys.stdin.read() or '{}')
    print(d.get('tool_input', {}).get('command', ''))
except Exception:
    pass
" <<< "$PAYLOAD")

if [ -z "$CMD" ]; then
    exit 0
fi

DESTRUCTIVE=""
case "$CMD" in
    *"rm -rf"*|*"rm -fr"*)
        DESTRUCTIVE="rm -rf" ;;
    *"git reset --hard"*|*"git clean -f"*)
        DESTRUCTIVE="git destructive" ;;
    *"git push --force"*|*"git push -f"*)
        DESTRUCTIVE="force push" ;;
    *"drop table"*|*"DROP TABLE"*|*"drop database"*|*"DROP DATABASE"*)
        DESTRUCTIVE="SQL DROP" ;;
esac

if [ -n "$DESTRUCTIVE" ]; then
    echo "coverage-gate warn: $DESTRUCTIVE pattern detected — review before proceed" >&2
    # Brief pause to make the warning visible (no block)
    sleep 1
fi

exit 0
