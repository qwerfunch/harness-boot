#!/usr/bin/env bash
# harness-boot: PreToolUse(Bash) hook
# Blocks git commit when export changes are not accompanied by the feature's doc_sync targets.
# Granular: internal refactors (no export diff) pass through.
set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

[[ "$TOOL" != "Bash" ]] && exit 0
echo "$COMMAND" | grep -qE '^git[[:space:]]+commit' || exit 0

# Emergency bypass
echo "$COMMAND" | grep -q '\[skip-doc-sync\]' && exit 0

# bundled-tdd red commit is test-only; exports haven't landed yet by design
echo "$COMMAND" | grep -q '\[bundled-tdd:red\]' && exit 0

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FEATURE_LIST="$PROJECT_ROOT/feature-list.json"
[[ ! -f "$FEATURE_LIST" ]] && exit 0

# Find current feature (first passes: false)
CURRENT=$(jq -c '[.[] | select(.passes == false)][0] // empty' "$FEATURE_LIST")
[[ -z "$CURRENT" ]] && exit 0

STAGED_FILES=$(git -C "$PROJECT_ROOT" diff --cached --name-only 2>/dev/null || true)
[[ -z "$STAGED_FILES" ]] && exit 0

# Detect export changes in any staged src file
EXPORT_CHANGED=0
while IFS= read -r SRC_FILE; do
  [[ -z "$SRC_FILE" ]] && continue
  case "$SRC_FILE" in
    src/*|lib/*|app/*|packages/*|internal/*)
      if git -C "$PROJECT_ROOT" diff --cached -U0 -- "$SRC_FILE" 2>/dev/null | grep -qE '^[+-].*(export|pub fn|pub struct|pub enum|public [a-zA-Z])' ; then
        EXPORT_CHANGED=1
        break
      fi
      ;;
  esac
done <<< "$STAGED_FILES"

[[ "$EXPORT_CHANGED" -eq 0 ]] && exit 0  # Internal-only change; doc-sync not required

# Export changed → verify feature's doc_sync targets are in staged set
DOC_TARGETS=$(echo "$CURRENT" | jq -r '.doc_sync // [] | .[]')

if [[ -z "$DOC_TARGETS" ]]; then
  # Feature has no doc_sync targets → blanket rule: any .md must be staged
  if echo "$STAGED_FILES" | grep -qE '\.md$'; then
    exit 0
  fi
  echo "BLOCKED: Export change detected but no .md doc update staged." >&2
  echo "Bypass: include [skip-doc-sync] in commit message." >&2
  exit 2
fi

MISSING=()
while IFS= read -r TARGET; do
  [[ -z "$TARGET" ]] && continue
  echo "$STAGED_FILES" | grep -Fxq "$TARGET" || MISSING+=("$TARGET")
done <<< "$DOC_TARGETS"

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "BLOCKED: Export change detected but doc_sync targets not staged:" >&2
  for m in "${MISSING[@]}"; do
    echo "  ✗ $m" >&2
  done
  echo "Update docs or bypass with [skip-doc-sync] in commit message." >&2
  exit 2
fi

exit 0
