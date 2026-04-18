#!/usr/bin/env bash
# Docs Size Policy check (non-blocking).
# Prints any .md under docs/ exceeding 500 lines without a <!-- size-exception: ... --> comment.
# Rationale: Claude Code slash commands load referenced files whole — see docs/templates/README.md "Docs Size Policy".

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIMIT=500
violations=0

while IFS= read -r -d '' file; do
  lines=$(wc -l <"$file" | tr -d ' ')
  if [ "$lines" -gt "$LIMIT" ]; then
    if ! grep -q 'size-exception:' "$file"; then
      printf '%s: %s lines (limit %s, no size-exception)\n' "${file#$REPO_ROOT/}" "$lines" "$LIMIT"
      violations=$((violations + 1))
    fi
  fi
done < <(find "$REPO_ROOT/docs" -name '*.md' -print0)

if [ "$violations" -eq 0 ]; then
  echo "OK: all docs/**.md within ${LIMIT}-line limit (or carry a size-exception comment)."
fi

# Non-blocking: always exit 0 so the hook does not stop commits/CI.
exit 0
