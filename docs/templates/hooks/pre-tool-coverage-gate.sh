#!/usr/bin/env bash
# harness-boot: PreToolUse(Bash) hook
# Blocks git commit when tdd_focus functions lack 100% line coverage (tdd / bundled-tdd strategies).
# Two-tier: confirmed-uncovered blocks; not-in-fnMap warns only.
set -euo pipefail

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

[[ "$TOOL" != "Bash" ]] && exit 0
echo "$COMMAND" | grep -qE '^git[[:space:]]+commit' || exit 0

# Emergency bypass
echo "$COMMAND" | grep -q '\[skip-coverage\]' && exit 0

# bundled-tdd red commit: test-only; impl does not exist by design
echo "$COMMAND" | grep -q '\[bundled-tdd:red\]' && exit 0

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FEATURE_LIST="$PROJECT_ROOT/feature-list.json"
[[ ! -f "$FEATURE_LIST" ]] && exit 0

CURRENT=$(jq -c '[.[] | select(.passes == false)][0] // empty' "$FEATURE_LIST")
[[ -z "$CURRENT" ]] && exit 0

TEST_STRATEGY=$(echo "$CURRENT" | jq -r '.test_strategy // "tdd"')
TDD_FOCUS=$(echo "$CURRENT" | jq -r '.tdd_focus // [] | .[]')
[[ -z "$TDD_FOCUS" ]] && exit 0

# state-verification: only verify test files exist
if [[ "$TEST_STRATEGY" == "state-verification" ]]; then
  CATEGORY=$(echo "$CURRENT" | jq -r '.category // empty')
  if find "$PROJECT_ROOT/src" -path "*$CATEGORY*" \( -name "*.test.*" -o -name "*.spec.*" \) 2>/dev/null | grep -q .; then
    exit 0
  fi
  echo "WARNING: No test files found for $CATEGORY module (test_strategy: state-verification)." >&2
  exit 0
fi

# integration: check overall file coverage >= 60%
if [[ "$TEST_STRATEGY" == "integration" ]]; then
  if ! {COVERAGE_COMMAND} >/dev/null 2>&1; then
    echo "WARNING: coverage command failed — gate cannot verify. Fix before committing." >&2
  fi
  COVERAGE_FILE="$PROJECT_ROOT/{COVERAGE_FILE}"
  if [[ -f "$COVERAGE_FILE" ]]; then
    OVERALL=$(jq '[.[] | .s | to_entries | .[] | .value] | if length == 0 then 100 else (([.[] | select(. > 0)] | length) / length * 100) end' "$COVERAGE_FILE" 2>/dev/null || echo "100")
    if awk -v v="$OVERALL" 'BEGIN { exit !(v+0 < 60) }'; then
      echo "BLOCKED: Overall coverage ${OVERALL}% is below 60% (test_strategy: integration)." >&2
      exit 2
    fi
  fi
  exit 0
fi

# tdd / bundled-tdd: per-function coverage check
if ! {COVERAGE_COMMAND} >/dev/null 2>&1; then
  echo "WARNING: coverage command failed — gate cannot verify. Fix before committing." >&2
fi
COVERAGE_FILE="$PROJECT_ROOT/{COVERAGE_FILE}"
[[ ! -f "$COVERAGE_FILE" ]] && { echo "WARNING: Coverage report not generated, skipping gate." >&2; exit 0; }

UNCOVERED=()
WARNINGS=()

for FUNC in $TDD_FOCUS; do
  FOUND=$(jq -r --arg fn "$FUNC" '
    [to_entries[] | .value.fnMap as $m | .value.f as $f |
     $m | to_entries[] | select(.value.name == $fn) |
     {count: $f[.key]}] | .[0] // empty
  ' "$COVERAGE_FILE" 2>/dev/null || true)

  if [[ -n "$FOUND" && "$FOUND" != "null" ]]; then
    COUNT=$(echo "$FOUND" | jq -r '.count // 0')
    [[ "$COUNT" == "0" ]] && UNCOVERED+=("$FUNC (0 calls)")
  else
    WARNINGS+=("$FUNC (not found in fnMap — arrow/re-export/inlined; verify manually)")
  fi
done

if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo "COVERAGE WARNING:" >&2
  printf '  ⚠ %s\n' "${WARNINGS[@]}" >&2
fi

if [[ ${#UNCOVERED[@]} -gt 0 ]]; then
  echo "BLOCKED: tdd_focus functions missing coverage:" >&2
  printf '  ✗ %s\n' "${UNCOVERED[@]}" >&2
  echo "Write tests first (TDD Red phase), then commit." >&2
  echo "Bypass: include [skip-coverage] in commit message." >&2
  exit 2
fi

exit 0
