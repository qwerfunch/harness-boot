#!/usr/bin/env bash
# harness-boot: PostToolUse(Write|Edit) hook
# Auto-formats the edited file using a language-appropriate formatter.
# Extension-dispatched — works for polyglot projects without stack-specific edits.
set -euo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[[ -z "$FILE" || ! -f "$FILE" ]] && exit 0

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.scss|*.html|*.md|*.yaml|*.yml)
    command -v npx >/dev/null 2>&1 && npx --no-install prettier --write "$FILE" 2>/dev/null || true
    ;;
  *.py)
    command -v black >/dev/null 2>&1 && black --quiet "$FILE" 2>/dev/null || true
    command -v isort >/dev/null 2>&1 && isort --quiet "$FILE" 2>/dev/null || true
    ;;
  *.go)
    command -v gofmt >/dev/null 2>&1 && gofmt -w "$FILE" 2>/dev/null || true
    ;;
  *.rs)
    command -v rustfmt >/dev/null 2>&1 && rustfmt --quiet "$FILE" 2>/dev/null || true
    ;;
  *.java)
    command -v google-java-format >/dev/null 2>&1 && google-java-format -i "$FILE" 2>/dev/null || true
    ;;
  *.rb)
    command -v rubocop >/dev/null 2>&1 && rubocop -a "$FILE" 2>/dev/null || true
    ;;
esac

exit 0
