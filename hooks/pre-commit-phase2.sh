#!/usr/bin/env bash
# pre-commit-phase2.sh — F-034 (v0.10.9)
#
# Phase 2 dogfood discipline 자동 enforcement. F-026 후속.
# git commit 시 staged code 변경이 있는데 .harness/state.yaml 의 active
# feature 가 없으면 reject. 사람 디시플린에 의존하던 'every change MUST
# go through work.py' 를 도구가 책임.
#
# 5 분기 (정확히 이 순서):
#   1. .harness/state.yaml 부재 → silent exit 0 (Phase 2 안 쓰는 프로젝트)
#   2. HARNESS_BYPASS_PRE_COMMIT=1 env → exit 0 (true emergencies; --no-verify
#      도 동등하나 git 표준)
#   3. staged 가 화이트리스트만 (chore commits) → exit 0
#      whitelist: .harness/state.yaml · .harness/_workspace/* · CHANGELOG.md
#   4. non-whitelisted staged + active feature 부재 → exit 1 + stderr 에 4 우회 옵션
#   5. non-whitelisted staged + active feature 있음 → exit 0
#
# Install: python3 .../scripts/install_pre_commit.py --install

set -u

# 분기 1: .harness/ 부재.
[ -f ".harness/state.yaml" ] || exit 0

# 분기 2: env bypass.
if [ "${HARNESS_BYPASS_PRE_COMMIT:-}" = "1" ]; then
    exit 0
fi

# Staged files (added/modified, deleted 제외 — 삭제만 있는 commit 도 일반적).
STAGED="$(git diff --cached --name-only --diff-filter=AM 2>/dev/null || true)"

# 빈 staged → 통과 (git 가 별도로 거부할 것).
[ -z "$STAGED" ] && exit 0

# 분기 3: 화이트리스트 검사.
ALL_WHITELISTED=1
while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
        .harness/state.yaml) ;;
        .harness/_workspace/*) ;;
        CHANGELOG.md) ;;
        *) ALL_WHITELISTED=0; break ;;
    esac
done <<< "$STAGED"

if [ "$ALL_WHITELISTED" = "1" ]; then
    exit 0
fi

# 분기 4/5: active feature 검사.
ACTIVE="$(python3 -c '
import sys, yaml
try:
    s = yaml.safe_load(open(".harness/state.yaml"))
    a = (s.get("session") or {}).get("active_feature_id")
    print(a or "")
except Exception:
    print("")
' 2>/dev/null || true)"

if [ -z "$ACTIVE" ]; then
    cat <<'EOF' >&2
✖ pre-commit (harness-boot Phase 2 · F-034): no active feature

staged 코드 변경이 있는데 .harness/state.yaml 의 active feature 가 없습니다.
"every change MUST go through work.py" 디시플린 위반 (cosmic-suika 메모리).

다음 중 하나로 해결:

  1. python3 scripts/work.py F-N --harness-dir .harness            # 활성화
  2. spec.yaml 에 새 F-N 추가 후 1
  3. git commit --no-verify                                        # 일회성 우회
  4. HARNESS_BYPASS_PRE_COMMIT=1 git commit ...                    # env 우회

화이트리스트 (단독 staged 시 통과): .harness/state.yaml · .harness/_workspace/* · CHANGELOG.md
EOF
    exit 1
fi

# 분기 5: active 있음 → 통과.
exit 0
