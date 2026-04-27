#!/usr/bin/env bash
# harness-boot session-bootstrap hook (F-014)
#
# Global scope: fires at SessionStart in EVERY user workspace after plugin install.
# Must be:
#   - silent when .harness/ doesn't exist (most projects)
#   - informational only — never fails user action (fail-open enforced via || true in hooks.json)
#   - no mutation (CQS)
# Output is shown to the user, so keep it under 3 lines.

set -u

# PROJECT-SCOPED: only surface banner when user's cwd has a .harness/ dir.
# This keeps the hook invisible in non-harness projects.
if [ ! -d ".harness" ]; then
    exit 0
fi

# Absolute minimum banner. Users with many sessions-per-day see this often,
# so keep it under 3 lines and emoji-free per BR-012.
echo "harness-boot detected .harness/ — try /harness-boot:work for the dashboard"

exit 0
