#!/usr/bin/env bash
# pre-commit-phase2.sh — F-034 (v0.10.9)
#
# Auto-enforces Phase 2 dogfood discipline. Follows F-026.
# At git commit time: if there are staged code changes but no active
# feature in .harness/state.yaml, reject. The "every change MUST go
# through work.py" rule used to depend on human discipline; this hook
# moves it to the tooling.
#
# Five branches, in this order:
#   1. .harness/state.yaml absent → silent exit 0 (project doesn't use Phase 2).
#   2. HARNESS_BYPASS_PRE_COMMIT=1 env → exit 0 (true emergencies; --no-verify
#      is the git-standard equivalent).
#   3. Staged set is whitelist-only (chore commits) → exit 0.
#      Whitelist: .harness/state.yaml · .harness/_workspace/* · CHANGELOG.md
#   4. Non-whitelisted staged + no active feature → exit 1 with four bypass
#      options on stderr.
#   5. Non-whitelisted staged + active feature present → exit 0.
#
# Install: copy this file to .git/hooks/pre-commit and chmod +x it.

set -u

# Branch 1: no .harness/.
[ -f ".harness/state.yaml" ] || exit 0

# Branch 2: env bypass.
if [ "${HARNESS_BYPASS_PRE_COMMIT:-}" = "1" ]; then
    exit 0
fi

# Staged files (added/modified; deletions excluded — delete-only commits are
# common enough that we let git handle them on its own).
STAGED="$(git diff --cached --name-only --diff-filter=AM 2>/dev/null || true)"

# Empty staged → pass (git itself will reject the commit).
[ -z "$STAGED" ] && exit 0

# Branch 3: whitelist check.
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

# Branches 4/5: active feature check via the harness CLI.
ACTIVE="$(node -e '
const yaml = require("yaml");
const fs = require("fs");
try {
  const s = yaml.parse(fs.readFileSync(".harness/state.yaml", "utf-8"));
  const a = (s && s.session && s.session.active_feature_id) || "";
  process.stdout.write(a);
} catch (_) {
  process.stdout.write("");
}
' 2>/dev/null || true)"

if [ -z "$ACTIVE" ]; then
    cat <<'EOF' >&2
✖ pre-commit (harness-boot Phase 2 · F-034): no active feature

You have staged code changes but .harness/state.yaml has no active feature.
That breaks the "every change MUST go through harness work" discipline.

Pick one:

  1. node bin/harness work F-N --harness-dir .harness           # activate
  2. Add a new F-N to spec.yaml first, then 1
  3. git commit --no-verify                                        # one-off bypass
  4. HARNESS_BYPASS_PRE_COMMIT=1 git commit ...                    # env bypass

Whitelist (passes when staged alone): .harness/state.yaml · .harness/_workspace/* · CHANGELOG.md
EOF
    exit 1
fi

# Branch 5: active feature present → pass.
exit 0
