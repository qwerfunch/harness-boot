#!/usr/bin/env bash
# pre-commit-phase2.sh — F-034 (v0.10.9, F-127 fix)
#
# Auto-enforces Phase 2 dogfood discipline. Follows F-026.
# At git commit time: if there are staged code changes but no active
# feature in .harness/state.yaml, reject. The "every change MUST go
# through work.py" rule used to depend on human discipline; this hook
# moves it to the tooling.
#
# Six branches, in this order:
#   1. .harness/state.yaml absent → silent exit 0 (project doesn't use Phase 2).
#   2. HARNESS_BYPASS_PRE_COMMIT=1 env → exit 0 (true emergencies; --no-verify
#      is the git-standard equivalent).
#   3. Git is in a special operation (merge / cherry-pick / revert / rebase) →
#      exit 0 (F-127). The staged content originates from a different commit
#      that already had its own feature cycle; the discipline does not apply
#      to git's own conflict-resolution finalizers.
#   4. Staged set is whitelist-only (chore commits) → exit 0.
#      Whitelist: .harness/state.yaml · .harness/_workspace/* · CHANGELOG.md
#      · .harness/spec.archive.yaml (F-132 lifecycle artifact —
#        complete()'s archive auto-move writes here)
#      · docs/samples/harness-boot-self/spec.archive.yaml (lockstep
#        mirror of the above; touched by `cp` after complete()).
#   5. Non-whitelisted staged + no active feature → exit 1 with four bypass
#      options on stderr.
#   6. Non-whitelisted staged + active feature present → exit 0.
#
# Install: copy this file to .git/hooks/pre-commit and chmod +x it.

set -u

# Branch 1: no .harness/.
[ -f ".harness/state.yaml" ] || exit 0

# Branch 2: env bypass.
if [ "${HARNESS_BYPASS_PRE_COMMIT:-}" = "1" ]; then
    exit 0
fi

# Branch 3 (F-127): git special-operation short-circuit.
# When git itself is mid-operation, the staged content is not user-driven
# feature work — it's the resolution of a merge / cherry-pick / revert /
# rebase from a different commit that already had its own audit trail.
# Forcing an active_feature_id here would either reject legitimate finalizers
# or push the user to HARNESS_BYPASS_PRE_COMMIT, which defeats the discipline
# audit. Detection markers (any one suffices):
#   .git/MERGE_HEAD          — `git merge` in progress
#   .git/CHERRY_PICK_HEAD    — `git cherry-pick` in progress
#   .git/REVERT_HEAD         — `git revert` in progress
#   .git/rebase-merge/       — `git rebase` (merge backend) in progress
#   .git/rebase-apply/       — `git rebase` (apply backend, e.g. --apply) in progress
GIT_DIR="$(git rev-parse --git-dir 2>/dev/null || echo .git)"
if [ -f "$GIT_DIR/MERGE_HEAD" ] \
    || [ -f "$GIT_DIR/CHERRY_PICK_HEAD" ] \
    || [ -f "$GIT_DIR/REVERT_HEAD" ] \
    || [ -d "$GIT_DIR/rebase-merge" ] \
    || [ -d "$GIT_DIR/rebase-apply" ]; then
    exit 0
fi

# Staged files (added/modified; deletions excluded — delete-only commits are
# common enough that we let git handle them on its own).
STAGED="$(git diff --cached --name-only --diff-filter=AM 2>/dev/null || true)"

# Empty staged → pass (git itself will reject the commit).
[ -z "$STAGED" ] && exit 0

# Branch 4: whitelist check.
ALL_WHITELISTED=1
while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in
        .harness/state.yaml) ;;
        .harness/_workspace/*) ;;
        .harness/spec.archive.yaml) ;;
        docs/samples/harness-boot-self/spec.archive.yaml) ;;
        CHANGELOG.md) ;;
        *) ALL_WHITELISTED=0; break ;;
    esac
done <<< "$STAGED"

if [ "$ALL_WHITELISTED" = "1" ]; then
    exit 0
fi

# Branches 5/6: active feature check via the harness CLI.
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
