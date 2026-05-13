#!/usr/bin/env bash
# run-harness.sh — SWE-bench Verified A/B, harness-boot 시도
#
# Usage: bash run-harness.sh <task_id>
#   e.g. bash run-harness.sh django__django-13551
#
# 이 스크립트가 하는 일:
#   1. SWE-bench harness 의 task fixture 를 Docker 안에서 띄움
#   2. workdir 안에서 `harness init` → existing_code scenario 자동 라우팅
#   3. Task issue 를 새 feature 로 spec.yaml 에 등록 (F-1)
#   4. `harness work F-1` activate → 사용자가 Claude Code 안에서 작업
#   5. 매 LLM 호출 직후 `harness token --in X --out Y --model M --feature F-1`
#   6. evidence + commit + complete 의 정상 lifecycle
#   7. Patch 가 SWE-bench test 통과 시 resolved=true
#   8. `harness metrics --json` 의 token + events.log 의 drift catches 추출
#   9. results/harness/<task_id>.json 저장

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
    echo "[warn] $RESULT_JSON 이미 존재 — overwrite 하려면 직접 삭제 후 재실행" >&2
    exit 4
fi

echo "==== harness 시도 — $TASK_ID ===="
echo ""
echo "1) SWE-bench harness 가 별도 터미널에서 Docker 환경 띄워야 합니다 (vanilla 시도와 동일)."
echo ""
echo "2) workdir 안에서 (Docker 내부):"
echo "   harness init                # F-171 auto-routing → existing_code"
echo "   # 그 다음 spec.yaml 에 F-1 (이 task 의 issue) 등록"
echo "   harness work F-1            # activate"
echo ""
echo "3) Claude Code 안에서 task 작업. 매 LLM 호출 직후:"
echo "   harness token --harness-dir .harness --in X --out Y --model M --feature F-1"
echo ""
echo "4) 작업 끝나면:"
echo "   harness work F-1 --evidence '...' --kind manual_check"
echo "   git commit -m 'fix(F-1): ...'"
echo "   harness work F-1 --complete"
echo ""
echo "5) SWE-bench harness 채점 후 아래 prompt 에 결과 입력:"
echo ""

# 사용자에게 harness 측 데이터 입력 받기
read -rp "tokens_input (harness metrics --json 의 tokens.input_total): " TOKENS_IN
read -rp "tokens_output: " TOKENS_OUT
read -rp "Wall time in seconds: " WALL_SEC
read -rp "Attempts (1=한번에 complete): " ATTEMPTS
read -rp "Patch 의 net LOC 변경: " CODE_LOC
read -rp "Tests added: " TESTS_ADDED
read -rp "SWE-bench harness 채점 통과 [y/n]: " RESOLVED_YN
read -rp "Tests passed (all/partial/none): " TESTS_PASSED
read -rp "Drift catches (harness check 가 잡은 issue 수, 0 가능): " DRIFT_CATCHES
read -rp "Evidence kinds (comma-separated, e.g. 'manual_check,test,reviewer_check'): " EVIDENCE_KINDS_RAW
read -rp "Notes: " NOTES

RESOLVED="false"
if [ "${RESOLVED_YN,,}" = "y" ]; then
    RESOLVED="true"
fi

# evidence_kinds 를 JSON array 로
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
