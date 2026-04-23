#!/usr/bin/env bash
# test-runner.sh — opt-in hook template (F-014)
#
# Trigger: PostToolUse Write|Edit (for .py, .ts, .go files)
# Purpose: run affected tests after source code change
# Behavior: fail-open — test failure never blocks user action, only reports
#
# Warning: slow on large codebases. Consider enabling only for specific file
# patterns via the matcher field in settings.json.

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
        # Prefer pytest for single-file; fallback to unittest discover
        if command -v pytest >/dev/null 2>&1; then
            pytest --tb=no -q "$FILE" 2>&1 | tail -3 || true
        elif [ -d "tests/unit" ]; then
            python3 -m unittest discover tests.unit 2>&1 | tail -3 || true
        fi
        ;;
    *.ts|*.tsx)
        if [ -f "package.json" ] && command -v npm >/dev/null 2>&1; then
            # Most JS projects have npm test
            npm test --silent 2>&1 | tail -3 || true
        fi
        ;;
    *.go)
        if [ -f "go.mod" ] && command -v go >/dev/null 2>&1; then
            go test ./... 2>&1 | tail -3 || true
        fi
        ;;
esac

exit 0
