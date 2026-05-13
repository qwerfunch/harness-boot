#!/usr/bin/env bash
# run-vanilla.sh — SWE-bench Verified A/B, vanilla Claude Code attempt.
#
# Usage: bash run-vanilla.sh <task_id>
#   e.g. bash run-vanilla.sh django__django-13551
#
# What this script does:
#   1. Tells you how to spin up the SWE-bench Docker fixture for this task.
#   2. Prints the issue body so you can drive Claude Code in natural language.
#   3. After you finish, grades the patch via the SWE-bench test harness.
#   4. Saves the outcome to results/vanilla/<task_id>.json.
#
# Token measurement is still manual on the vanilla side until further
# Claude Code automation lands (the F-174 Stop hook auto-captures only
# when harness-boot is installed in the same session).

set -euo pipefail

TASK_ID="${1:-}"
if [ -z "$TASK_ID" ]; then
    echo "usage: $0 <task_id>" >&2
    exit 3
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/../results/vanilla"
mkdir -p "$RESULTS_DIR"
RESULT_JSON="$RESULTS_DIR/${TASK_ID}.json"

if [ -f "$RESULT_JSON" ]; then
    echo "[warn] $RESULT_JSON already exists — delete it first to re-run." >&2
    exit 4
fi

echo "==== vanilla attempt — $TASK_ID ===="
echo ""
echo "1) In a separate terminal, spin up the Docker fixture for this task:"
echo "   cd ~/swe-bench-ab/SWE-bench"
echo "   python -m swebench.harness.run_evaluation \\"
echo "       --instance_ids $TASK_ID \\"
echo "       --predictions_path /dev/null \\"
echo "       --run_id vanilla-prep-$TASK_ID \\"
echo "       --cache_level instance"
echo ""
echo "2) Then drive Claude Code in natural language. The issue body and the"
echo "   base-commit code are auto-loaded from the SWE-bench task fixture."
echo ""
echo "3) After every turn, run /cost and remember the cumulative numbers."
echo "   This script asks for the final values below."
echo ""

# Same measurement procedure on both sides — the user types /cost output
# in between turns.
read -rp "Final tokens_input (cumulative from /cost): " TOKENS_IN
read -rp "Final tokens_output: " TOKENS_OUT
read -rp "Wall time in seconds (start → finish): " WALL_SEC
read -rp "Attempts (retry count; 1 = passed on first try): " ATTEMPTS
read -rp "Net LOC change in the patch (|+lines| + |-lines|): " CODE_LOC
read -rp "Tests added (new test functions count): " TESTS_ADDED
read -rp "SWE-bench harness graded PASS [y/n]: " RESOLVED_YN
read -rp "Tests passed (all/partial/none): " TESTS_PASSED
read -rp "Notes (one-line qualitative observation): " NOTES

RESOLVED="false"
if [ "${RESOLVED_YN,,}" = "y" ]; then
    RESOLVED="true"
fi

cat > "$RESULT_JSON" <<EOF
{
  "task_id": "$TASK_ID",
  "approach": "vanilla",
  "resolved": $RESOLVED,
  "tokens_input": $TOKENS_IN,
  "tokens_output": $TOKENS_OUT,
  "wall_time_sec": $WALL_SEC,
  "attempts": $ATTEMPTS,
  "code_loc": $CODE_LOC,
  "tests_added": $TESTS_ADDED,
  "tests_passed": "$TESTS_PASSED",
  "harness_drift_catches": null,
  "harness_evidence_kinds": null,
  "notes": "$NOTES",
  "model": "${MODEL:-unknown}",
  "run_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo ""
echo "✓ $RESULT_JSON saved"
