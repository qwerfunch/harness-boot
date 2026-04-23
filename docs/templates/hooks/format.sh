#!/usr/bin/env bash
# format.sh — opt-in hook template (F-014)
#
# Trigger: PostToolUse Write|Edit
# Purpose: run formatter if installed (prettier/black/gofmt)
# Behavior: fail-open — format failure never blocks user

set -u

PAYLOAD=$(cat)
FILE=$(python3 -c "
import json, sys
try:
    d = json.loads(sys.stdin.read() or '{}')
    r = d.get('tool_response', {})
    i = d.get('tool_input', {})
    print(r.get('filePath') or i.get('file_path', ''))
except Exception:
    pass
" <<< "$PAYLOAD")

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
    exit 0
fi

case "$FILE" in
    *.py)
        if command -v black >/dev/null 2>&1; then
            black --quiet "$FILE" 2>/dev/null || true
        fi
        ;;
    *.js|*.jsx|*.ts|*.tsx|*.json|*.md|*.yaml|*.yml)
        if command -v prettier >/dev/null 2>&1; then
            prettier --write --ignore-unknown "$FILE" 2>/dev/null || true
        fi
        ;;
    *.go)
        if command -v gofmt >/dev/null 2>&1; then
            gofmt -w "$FILE" 2>/dev/null || true
        fi
        ;;
    *.rs)
        if command -v rustfmt >/dev/null 2>&1; then
            rustfmt "$FILE" 2>/dev/null || true
        fi
        ;;
esac

exit 0
