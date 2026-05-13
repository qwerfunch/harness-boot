#!/usr/bin/env bash
# run-vanilla.sh — SWE-bench Verified A/B, vanilla Claude Code 시도
#
# Usage: bash run-vanilla.sh <task_id>
#   e.g. bash run-vanilla.sh django__django-13551
#
# 이 스크립트가 하는 일:
#   1. SWE-bench harness 의 task fixture 로 Docker 환경 띄움
#   2. Issue body 를 prompt 로 출력 — 사용자가 Claude Code 안에서 자연어로 작업
#   3. 사용자가 작업 끝나면 patch 를 SWE-bench test 로 채점
#   4. 결과를 results/vanilla/<task_id>.json 에 저장
#
# F-172 의 hook 자동화가 land 한 후에는 token 측정이 자동, 현재는 수기 입력.

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
    echo "[warn] $RESULT_JSON 이미 존재 — overwrite 하려면 직접 삭제 후 재실행" >&2
    exit 4
fi

echo "==== vanilla 시도 — $TASK_ID ===="
echo ""
echo "1) SWE-bench harness 가 별도 터미널에서 Docker 환경 띄워야 합니다:"
echo "   cd ~/swe-bench-ab/SWE-bench"
echo "   python -m swebench.harness.run_evaluation \\"
echo "       --instance_ids $TASK_ID \\"
echo "       --predictions_path /dev/null \\"
echo "       --run_id vanilla-prep-$TASK_ID \\"
echo "       --cache_level instance"
echo ""
echo "2) 그 후 Claude Code 안에서 task 작업 — 자연어로."
echo "   issue body 와 base commit 의 코드는 SWE-bench 의 task fixture 에서 자동 로드."
echo ""
echo "3) 매 turn 끝나면 /cost 실행, 누적 token 을 아래 prompt 에 입력:"
echo ""

# 양쪽 측정 동일 procedure — 사용자가 turn 사이에 /cost 입력
read -rp "Final tokens_input (사용자가 /cost 결과 누적값): " TOKENS_IN
read -rp "Final tokens_output: " TOKENS_OUT
read -rp "Wall time in seconds (start → finish): " WALL_SEC
read -rp "Attempts (재시도 횟수, 1=한번에 통과): " ATTEMPTS
read -rp "Patch 의 net LOC 변경 (+추가 - -삭제 의 절대값 합): " CODE_LOC
read -rp "Tests added (새 test 함수 수): " TESTS_ADDED
read -rp "SWE-bench harness 채점 통과 [y/n]: " RESOLVED_YN
read -rp "Tests passed (all/partial/none): " TESTS_PASSED
read -rp "Notes (한 줄 정성 관찰): " NOTES

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
