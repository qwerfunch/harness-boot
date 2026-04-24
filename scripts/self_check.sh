#!/usr/bin/env bash
# self_check.sh — harness-boot 자체 도그푸드 Passive 검증 (v0.3.10+, Phase 1)
#
# 5 단계 검증:
#   1. .harness/spec.yaml == docs/samples/harness-boot-self/spec.yaml (SSoT 동기성)
#   2. validate_spec 통과
#   3. sync --dry-run round-trip 재현
#   4. check 8/8 drift 에러 없음
#   5. commands/*.md 규약 (Preamble + Anti-rationalization + bash 블록) 존재
#
# 하나라도 fail 시 non-zero exit · 마지막 실패 지점 stderr 출력.
# 실행 위치: 레포 루트 cwd.

set -eu
set -o pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

fail() {
    echo "self_check: FAIL — $*" >&2
    exit 1
}

step() {
    echo "self_check [${1}/5] $2"
}

# --- Step 1: SSoT 동기성 ---
step 1 "SSoT diff (.harness/spec.yaml vs docs/samples/...)"
if ! diff -q .harness/spec.yaml docs/samples/harness-boot-self/spec.yaml >/dev/null; then
    fail "SSoT drift — .harness/spec.yaml ≠ docs/samples/harness-boot-self/spec.yaml · 한 쪽을 다른 쪽에 맞춰 sync"
fi

# --- Step 2: JSONSchema 검증 ---
step 2 "validate .harness/spec.yaml"
if ! python3 scripts/spec/validate.py .harness/spec.yaml >/dev/null 2>&1; then
    # 에러 재실행하여 사용자에게 stderr 보이기
    python3 scripts/spec/validate.py .harness/spec.yaml >&2 || true
    fail "validate_spec 실패"
fi

# --- Step 3: sync round-trip (실제 실행 · derived 파일 생성) ---
# harness.yaml · domain.md · architecture.yaml 은 gitignored (로컬 생성).
# 재실행 시 edit-wins 로 보호 · 해시 변화 시만 재생성.
step 3 "sync (.harness/ · derived 생성)"
if ! python3 scripts/sync.py --harness-dir .harness >/dev/null 2>&1; then
    python3 scripts/sync.py --harness-dir .harness >&2 || true
    fail "sync 실패"
fi

# --- Step 4: check 8/8 drift ---
step 4 "check --harness-dir .harness --project-root ."
# check 는 drift 있으면 exit 6. error severity 만 fail 로 취급 (warn 허용)
CHECK_OUT=$(python3 scripts/check.py --harness-dir .harness --project-root . --json 2>/dev/null || true)
if [ -z "$CHECK_OUT" ]; then
    fail "check.py 출력 없음"
fi
# JSON 파싱 + error severity 카운트
ERR_COUNT=$(python3 -c "
import json, sys
try:
    d = json.loads('''$CHECK_OUT''')
except Exception as e:
    print('PARSE_FAIL', file=sys.stderr); sys.exit(1)
errs = [f for f in d.get('findings', []) if f.get('severity') == 'error']
print(len(errs))
for f in errs:
    print(f'  [{f[\"kind\"]}] {f[\"path\"]}: {f[\"message\"]}', file=sys.stderr)
")
if [ "$ERR_COUNT" != "0" ]; then
    fail "check 에 error severity $ERR_COUNT 건 — 위 stderr 참조"
fi

# --- Step 5: commands/*.md 규약 grep ---
step 5 "commands/*.md preamble · anti-rationalization · bash 블록"
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
    if ! grep -q 'scripts/' "$f"; then
        # 모든 command 는 한 개 이상 scripts/ 참조를 가져야 함
        # (bash 블록 또는 인라인 `scripts/foo.py` 어느 쪽이든 허용).
        # LLM 드리븐 명령도 최소 하나의 스크립트 위임 경로를 명시해야.
        echo "  [$f] 'scripts/' 참조 누락 — 스크립트 위임 경로 명시 필요" >&2
        MISSING=$((MISSING + 1))
    fi
done
if [ "$MISSING" != "0" ]; then
    fail "commands/*.md 규약 위반 $MISSING 건"
fi

echo "self_check: all 5 steps OK"
