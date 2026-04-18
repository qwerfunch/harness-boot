#!/usr/bin/env bash
# harness-boot: PreToolUse(Bash) hook
# Strategy-dependent commit gate:
#   lean-tdd (default): BDD file + Given/When/Then count >= acceptance_test length
#   tdd: tdd_focus functions >= 70% line coverage (functions not in fnMap warn only)
#   state-verification: test files exist under module path
#   integration: overall file coverage >= 60%
set -euo pipefail

COVERAGE_THRESHOLD=70

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

[[ "$TOOL" != "Bash" ]] && exit 0
echo "$COMMAND" | grep -qE '^git[[:space:]]+commit' || exit 0

# Emergency bypass
echo "$COMMAND" | grep -q '\[skip-coverage\]' && exit 0

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FEATURE_LIST="$PROJECT_ROOT/feature-list.json"
[[ ! -f "$FEATURE_LIST" ]] && exit 0

CURRENT=$(jq -c '[.[] | select(.passes == false)][0] // empty' "$FEATURE_LIST")
[[ -z "$CURRENT" ]] && exit 0

TEST_STRATEGY=$(echo "$CURRENT" | jq -r '.test_strategy // "lean-tdd"')
FEATURE_ID=$(echo "$CURRENT" | jq -r '.id // empty')
TDD_FOCUS=$(echo "$CURRENT" | jq -r '.tdd_focus // [] | .[]')

# lean-tdd: BDD scenario count >= acceptance_test length
if [[ "$TEST_STRATEGY" == "lean-tdd" ]]; then
  EXPECTED=$(echo "$CURRENT" | jq '.acceptance_test | length')
  [[ -z "$FEATURE_ID" ]] && exit 0
  BDD_FILE=$(find "$PROJECT_ROOT" -type f \( -name "${FEATURE_ID}.bdd.*" -o -name "${FEATURE_ID}.bdd" \) 2>/dev/null | head -n 1 || true)
  if [[ -z "$BDD_FILE" ]]; then
    echo "BLOCKED: No BDD file found for ${FEATURE_ID} (test_strategy: lean-tdd)." >&2
    echo "Expected: <test-dir>/${FEATURE_ID}.bdd.<ext> with ${EXPECTED} Given/When/Then block(s)." >&2
    echo "Bypass: include [skip-coverage] in commit message." >&2
    exit 2
  fi
  # Count Given/When/Then blocks (one block = a line containing all three tokens, or a describe/it name containing all three)
  SCENARIOS=$(grep -ciE 'given.*when.*then' "$BDD_FILE" || echo 0)
  if [[ "$SCENARIOS" -lt "$EXPECTED" ]]; then
    echo "BLOCKED: BDD file ${BDD_FILE} has ${SCENARIOS} Given/When/Then block(s); acceptance_test requires ${EXPECTED}." >&2
    echo "Add the missing scenarios (bdd-writer) before committing." >&2
    echo "Bypass: include [skip-coverage] in commit message." >&2
    exit 2
  fi
  exit 0
fi

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

# tdd: per-function line coverage check (>= $COVERAGE_THRESHOLD%)
if ! {COVERAGE_COMMAND} >/dev/null 2>&1; then
  echo "WARNING: coverage command failed — gate cannot verify. Fix before committing." >&2
fi
COVERAGE_FILE="$PROJECT_ROOT/{COVERAGE_FILE}"
[[ ! -f "$COVERAGE_FILE" ]] && { echo "WARNING: Coverage report not generated, skipping gate." >&2; exit 0; }

UNDER=()
WARNINGS=()

for FUNC in $TDD_FOCUS; do
  FOUND=$(jq -r --arg fn "$FUNC" '
    [to_entries[] |
     .value as $file |
     $file.fnMap as $fnm |
     $file.statementMap as $sm |
     $file.s as $s |
     $fnm | to_entries[] | select(.value.name == $fn) |
     .value.loc as $floc |
     [$sm | to_entries[] |
       select(.value.start.line >= $floc.start.line and .value.start.line <= $floc.end.line) |
       .key] as $keys |
     ($keys | length) as $total |
     ([$keys[] | . as $k | $s[$k] | select(. > 0)] | length) as $covered |
     {total: $total, covered: $covered,
      pct: (if $total == 0 then 100 else ($covered / $total * 100) end)}
    ] | .[0] // empty
  ' "$COVERAGE_FILE" 2>/dev/null || true)

  if [[ -n "$FOUND" && "$FOUND" != "null" ]]; then
    PCT=$(echo "$FOUND" | jq -r '.pct')
    COVERED=$(echo "$FOUND" | jq -r '.covered')
    TOTAL=$(echo "$FOUND" | jq -r '.total')
    if awk -v p="$PCT" -v t="$COVERAGE_THRESHOLD" 'BEGIN { exit !(p+0 < t+0) }'; then
      UNDER+=("$FUNC ($(printf '%.0f' "$PCT")% line — $COVERED/$TOTAL, below ${COVERAGE_THRESHOLD}%)")
    fi
  else
    WARNINGS+=("$FUNC (not found in fnMap — arrow/re-export/inlined; verify manually)")
  fi
done

if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo "COVERAGE WARNING:" >&2
  printf '  ⚠ %s\n' "${WARNINGS[@]}" >&2
fi

if [[ ${#UNDER[@]} -gt 0 ]]; then
  echo "BLOCKED: tdd_focus functions below ${COVERAGE_THRESHOLD}% line coverage:" >&2
  printf '  ✗ %s\n' "${UNDER[@]}" >&2
  echo "Add tests to cover the missing lines, or refine tdd_focus." >&2
  echo "Bypass: include [skip-coverage] in commit message." >&2
  exit 2
fi

exit 0
