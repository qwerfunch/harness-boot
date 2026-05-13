#!/usr/bin/env bash
# run-harness.sh — SWE-bench Verified A/B, harness-boot attempt.
#
# Usage: bash run-harness.sh <task_id>
#   e.g. bash run-harness.sh django__django-13551
#
# What this script does:
#   1. Brings up the SWE-bench task Docker fixture.
#   2. Inside the workdir, runs `harness init` (auto-routes to existing_code).
#   3. Registers the issue as a new feature in spec.yaml (e.g. F-1).
#   4. `harness work F-1` to activate; the user then drives Claude Code.
#   5. Either the F-174 Stop hook auto-captures token usage, or the user
#      calls `harness token --in X --out Y --model M --feature F-1` after
#      each LLM call.
#   6. Normal lifecycle: evidence → commit → complete.
#   7. Grades the patch via the SWE-bench harness; resolved = true on PASS.
#   8. Extracts token totals from `harness metrics --json` and drift catches
#      from events.log.
#   9. Saves the outcome to results/harness/<task_id>.json.

set -euo pipefail

TASK_ID="${1:-}"
if [ -z "$TASK_ID" ]; then
    echo "usage: $0 <task_id>" >&2
    exit 3
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/../results/harness"
mkdir -p "$RESULTS_DIR"
RESULT_JSON="$RESULTS_DIR/${TASK_ID}.json"

if [ -f "$RESULT_JSON" ]; then
    echo "[warn] $RESULT_JSON already exists — delete it first to re-run." >&2
    exit 4
fi

echo "==== harness attempt — $TASK_ID ===="
echo ""
echo "1) In a separate terminal, spin up the Docker fixture for this task"
echo "   (same as the vanilla side)."
echo ""
echo "2) Inside the Docker workdir:"
echo "   harness init                # F-171 auto-routing → existing_code"
echo "   # then register F-1 (this task's issue) in spec.yaml"
echo "   harness work F-1            # activate"
echo ""
echo "3) Drive Claude Code through the task. After each LLM call:"
echo "   harness token --harness-dir .harness --in X --out Y --model M --feature F-1"
echo "   (Or rely on the F-174 Stop hook for automatic capture.)"
echo ""
echo "4) Once the work is finished:"
echo "   harness work F-1 --evidence '...' --kind manual_check"
echo "   git commit -m 'fix(F-1): ...'"
echo "   harness work F-1 --complete"
echo ""
echo "5) After SWE-bench grades the patch, paste the numbers below:"
echo ""

# Collect harness-side data from the user.
read -rp "tokens_input (harness metrics --json -> tokens.input_total): " TOKENS_IN
read -rp "tokens_output: " TOKENS_OUT
read -rp "Wall time in seconds: " WALL_SEC
read -rp "Attempts (1 = completed on first try): " ATTEMPTS
read -rp "Net LOC change in the patch: " CODE_LOC
read -rp "Tests added: " TESTS_ADDED
read -rp "SWE-bench harness graded PASS [y/n]: " RESOLVED_YN
read -rp "Tests passed (all/partial/none): " TESTS_PASSED
read -rp "Drift catches (issues `harness check` flagged; 0 is fine): " DRIFT_CATCHES
read -rp "Evidence kinds (comma-separated, e.g. 'manual_check,test,reviewer_check'): " EVIDENCE_KINDS_RAW
read -rp "Notes: " NOTES

RESOLVED="false"
if [ "${RESOLVED_YN,,}" = "y" ]; then
    RESOLVED="true"
fi

# Turn evidence_kinds into a JSON array.
EVIDENCE_KINDS=$(python3 -c "
import json, sys
raw = sys.argv[1].strip()
if not raw:
    print('[]')
else:
    parts = [p.strip() for p in raw.split(',') if p.strip()]
    print(json.dumps(parts))
" "$EVIDENCE_KINDS_RAW")

cat > "$RESULT_JSON" <<EOF
{
  "task_id": "$TASK_ID",
  "approach": "harness",
  "resolved": $RESOLVED,
  "tokens_input": $TOKENS_IN,
  "tokens_output": $TOKENS_OUT,
  "wall_time_sec": $WALL_SEC,
  "attempts": $ATTEMPTS,
  "code_loc": $CODE_LOC,
  "tests_added": $TESTS_ADDED,
  "tests_passed": "$TESTS_PASSED",
  "harness_drift_catches": $DRIFT_CATCHES,
  "harness_evidence_kinds": $EVIDENCE_KINDS,
  "notes": "$NOTES",
  "model": "${MODEL:-unknown}",
  "plugin_version": "$(node -e "console.log(require('${SCRIPT_DIR}/../../../../.claude-plugin/plugin.json').version)" 2>/dev/null || echo 'unknown')",
  "run_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo ""
echo "✓ $RESULT_JSON saved"
