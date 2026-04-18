#!/usr/bin/env bash
# harness-boot: SessionStart hook
# Loads project state and warns on PROGRESS.md ↔ feature-list.json drift.
set -euo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROGRESS_FILE="$PROJECT_ROOT/PROGRESS.md"
FEATURE_LIST="$PROJECT_ROOT/feature-list.json"

if [[ -f "$PROGRESS_FILE" ]]; then
  echo "## Session Bootstrap"
  echo ""
  echo "### PROGRESS.md Status"
  awk '/^## Status/,/^## / { if (!/^## [^S]/) print }' "$PROGRESS_FILE" | head -20
  echo ""
fi

if [[ -f "$FEATURE_LIST" ]]; then
  TOTAL=$(jq 'length' "$FEATURE_LIST" 2>/dev/null || echo "?")
  PASSING=$(jq '[.[] | select(.passes == true)] | length' "$FEATURE_LIST" 2>/dev/null || echo "?")
  echo "### feature-list.json"
  echo "- Features: $PASSING / $TOTAL passing"
  echo ""
fi

# Drift detection: PROGRESS.md reports a feature as Complete but feature-list.json has passes: false (or vice versa)
if [[ -f "$PROGRESS_FILE" && -f "$FEATURE_LIST" ]]; then
  DRIFT=""
  while IFS= read -r FEAT_ID; do
    [[ -z "$FEAT_ID" ]] && continue
    PASS=$(jq -r --arg id "$FEAT_ID" '.[] | select(.id == $id) | .passes' "$FEATURE_LIST" 2>/dev/null)
    PROGRESS_STATE=$(grep -E "^\s*[-*]\s+\[[ x]\]\s+$FEAT_ID" "$PROGRESS_FILE" 2>/dev/null | head -1)
    if echo "$PROGRESS_STATE" | grep -q '\[x\]' && [[ "$PASS" == "false" ]]; then
      DRIFT+="  - $FEAT_ID: PROGRESS.md=Complete, feature-list.json=passes:false"$'\n'
    elif echo "$PROGRESS_STATE" | grep -q '\[ \]' && [[ "$PASS" == "true" ]]; then
      DRIFT+="  - $FEAT_ID: PROGRESS.md=Incomplete, feature-list.json=passes:true"$'\n'
    fi
  done < <(jq -r '.[].id' "$FEATURE_LIST" 2>/dev/null)
  if [[ -n "$DRIFT" ]]; then
    echo "### ⚠ State Drift Detected"
    printf "%s" "$DRIFT"
    echo "Resolve before starting new work."
    echo ""
  fi
fi

echo "### Recent Commits"
git -C "$PROJECT_ROOT" log --oneline -5 2>/dev/null || echo "(no git history)"

exit 0
