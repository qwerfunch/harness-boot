#!/usr/bin/env bash
# doc-sync-check.sh — opt-in hook template (F-014)
#
# Trigger: PostToolUse Write|Edit
# Purpose: warn if CLAUDE.md @-imports no longer resolve (CLAUDE.md doc drift)
# Behavior: fail-open — stderr warning only

set -u

# Only run if CLAUDE.md exists at project root
if [ ! -f "CLAUDE.md" ]; then
    exit 0
fi

# Extract @<path> import lines (one per line, leading @)
BROKEN=""
while IFS= read -r line; do
    # strip leading @ and any trailing punctuation
    REL=$(echo "$line" | sed -E 's/^@//' | sed -E 's/[.,;:)]$//')
    # skip http(s) URLs
    case "$REL" in
        http://*|https://*) continue ;;
        "") continue ;;
    esac
    if [ ! -e "$REL" ]; then
        BROKEN="$BROKEN $REL"
    fi
done < <(grep -E '^@[^ ]+' CLAUDE.md 2>/dev/null || true)

if [ -n "$BROKEN" ]; then
    echo "doc-sync-check warn: CLAUDE.md @-import broken —$BROKEN" >&2
fi

exit 0
