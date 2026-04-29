#!/usr/bin/env bash
# self_check.sh — harness-boot 자체 도그푸드 검증 (TS-only since F-107)
#
# 5 단계 검증 (모두 `node bin/harness` 경유):
#   1. .harness/spec.yaml == docs/samples/harness-boot-self/spec.yaml (SSoT 동기성)
#   2. validate spec — JSONSchema 통과
#   3. sync (--soft) — 변경 없으면 skip · derived 파일 보장
#   4. check 13/13 drift 에러 없음
#   5. commands/*.md 규약 (Preamble + Anti-rationalization + harness CLI 위임)
#
# 하나라도 fail 시 non-zero exit · 실패 지점 stderr 출력.
# 실행 위치: 레포 루트 cwd.

set -eu
set -o pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

fail() {
    echo "self_check: FAIL — $*" >&2
    exit 1
}

step() {
    echo "self_check [${1}/5] $2"
}

HARNESS_BIN="$REPO_ROOT/bin/harness"
if [ ! -f "$HARNESS_BIN" ]; then
    fail "$HARNESS_BIN 없음 — 'npm install' 후 'npm run build' 가 필요합니다"
fi
if [ ! -d "$REPO_ROOT/dist" ]; then
    fail "$REPO_ROOT/dist 없음 — 'npm run build' 실행 필요"
fi

# --- Step 1: SSoT 동기성 ---
step 1 "SSoT diff (.harness/spec.yaml vs docs/samples/...)"
if ! diff -q .harness/spec.yaml docs/samples/harness-boot-self/spec.yaml >/dev/null; then
    fail "SSoT drift — .harness/spec.yaml ≠ docs/samples/harness-boot-self/spec.yaml · 한 쪽을 다른 쪽에 맞춰 sync"
fi

# --- Step 2: JSONSchema 검증 ---
step 2 "validate .harness/spec.yaml"
if ! node "$HARNESS_BIN" validate .harness/spec.yaml >/dev/null 2>&1; then
    node "$HARNESS_BIN" validate .harness/spec.yaml >&2 || true
    fail "validate 실패"
fi

# --- Step 3: sync (--soft 으로 idempotent) ---
step 3 "sync (.harness/ · derived 보장)"
if ! node "$HARNESS_BIN" sync --soft --harness-dir .harness >/dev/null 2>&1; then
    node "$HARNESS_BIN" sync --soft --harness-dir .harness >&2 || true
    fail "sync 실패"
fi

# --- Step 4: check 13 drift kinds — error severity 0 ---
step 4 "check --harness-dir .harness"
CHECK_OUT=$(node "$HARNESS_BIN" check --harness-dir .harness --project-root . --json 2>/dev/null || true)
if [ -z "$CHECK_OUT" ]; then
    fail "check 출력 없음"
fi
ERR_COUNT=$(node -e "
const fs = require('fs');
const d = JSON.parse(\`$CHECK_OUT\`);
const errs = (d.findings || []).filter(f => f.severity === 'error');
console.log(errs.length);
for (const f of errs) {
  console.error(\`  [\${f.kind}] \${f.path}: \${f.message}\`);
}
")
if [ "$ERR_COUNT" != "0" ]; then
    fail "check 에 error severity $ERR_COUNT 건 — 위 stderr 참조"
fi

# --- Step 5: commands/*.md 규약 grep ---
step 5 "commands/*.md preamble · anti-rationalization · CLI 위임"
MISSING=0
for f in commands/*.md; do
    if ! grep -q "^## Preamble" "$f"; then
        echo "  [$f] '## Preamble' 섹션 누락" >&2
        MISSING=$((MISSING + 1))
    fi
    if ! grep -q "^NO skip:" "$f"; then
        echo "  [$f] Anti-rationalization 'NO skip:' 라인 누락" >&2
        MISSING=$((MISSING + 1))
    fi
    if ! grep -q "^NO shortcut:" "$f"; then
        echo "  [$f] Anti-rationalization 'NO shortcut:' 라인 누락" >&2
        MISSING=$((MISSING + 1))
    fi
    if ! grep -qE 'harness\.js|harness ' "$f"; then
        echo "  [$f] harness CLI 위임 경로 누락" >&2
        MISSING=$((MISSING + 1))
    fi
done
if [ "$MISSING" != "0" ]; then
    fail "commands/*.md 규약 위반 $MISSING 건"
fi

echo "self_check: all 5 steps OK"
