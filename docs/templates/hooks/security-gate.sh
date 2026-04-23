#!/usr/bin/env bash
# security-gate.sh — opt-in hook template (F-014)
#
# Trigger: PreToolUse Bash
# Purpose: warn on high-risk commands (rm -rf, sudo, chmod 777, curl|sh)
# Behavior: fail-open — prints warning to stderr but exits 0
#
# Install:
#   mkdir -p .claude/hooks && cp "$CLAUDE_PLUGIN_ROOT/docs/templates/hooks/security-gate.sh" .claude/hooks/
#   # Add to .claude/settings.local.json:
#   #   "hooks": { "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command",
#   #     "command": "bash $PWD/.claude/hooks/security-gate.sh || true" }] }] }

set -u

# Read stdin JSON payload from Claude Code
PAYLOAD=$(cat)

# Extract the bash command via python3 (no jq dependency)
CMD=$(python3 -c "
import json, sys
try:
    d = json.loads(sys.stdin.read() or '{}')
    print(d.get('tool_input', {}).get('command', ''))
except Exception:
    pass
" <<< "$PAYLOAD")

if [ -z "$CMD" ]; then
    exit 0
fi

# High-risk patterns (case-sensitive for precision)
WARN=""
case "$CMD" in
    *"rm -rf /"|*"rm -rf / "*)
        WARN="rm -rf at filesystem root" ;;
    *"rm -rf /home"*|*"rm -rf /Users"*|*"rm -rf /etc"*|*"rm -rf /usr"*|*"rm -rf /var"*|*"rm -rf /opt"*|*"rm -rf /boot"*|*"rm -rf /root"*)
        WARN="rm -rf on system directory" ;;
    *"rm -rf ~"*|*"rm -rf \$HOME"*)
        WARN="rm -rf on home directory" ;;
    *"sudo rm"*|*"sudo chmod"*|*"sudo chown"*)
        WARN="sudo + mutation" ;;
    *"chmod 777"*|*"chmod -R 777"*)
        WARN="chmod 777 (world-writable)" ;;
    *"curl "*"|"*"bash"*|*"curl "*"|"*"sh"*|*"wget "*"|"*"bash"*)
        WARN="pipe curl/wget to shell" ;;
    *":(){:|:&};:"*)
        WARN="fork-bomb pattern" ;;
esac

if [ -n "$WARN" ]; then
    echo "security-gate warn: $WARN — cmd: ${CMD:0:100}" >&2
fi

# fail-open: always succeed
exit 0
