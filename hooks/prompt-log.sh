#!/usr/bin/env bash
# prompt-log.sh — UserPromptSubmit hook (F-028)
#
# Silently appends every user prompt to .harness/_workspace/prompts/YYYY-MM.jsonl.
# Future use: a corpus for "prompt shape" analysis — which natural-language
# inputs reliably trigger init/work routing.
#
# Contract:
#   - In a workspace without .harness/, silently exit 0 (the common case for
#     most user sessions).
#   - Fail-open: no error here may block the user prompt from being processed
#     (exit 0 guaranteed).
#   - No stdout. UserPromptSubmit treats exit 2 as blocking, but stdout is
#     visible to the user even on exit 0, so we keep it strictly silent.
#   - Claude Code passes a JSON payload on stdin:
#       {"session_id": "...", "cwd": "...", "user_prompt": "...", ...}
#     We prefer `user_prompt`; fall back to `prompt` for older Claude Code
#     versions.

set -u

# Read stdin (JSON payload). If cat fails, exit 0 silently.
INPUT="$(cat 2>/dev/null || true)"

# Resolve cwd: input.cwd > $CLAUDE_PROJECT_DIR > pwd.
CWD="$(printf '%s' "$INPUT" | node -e '
let raw = "";
process.stdin.on("data", c => raw += c);
process.stdin.on("end", () => {
  try {
    const d = JSON.parse(raw);
    process.stdout.write(d.cwd || "");
  } catch { /* silent */ }
});
' 2>/dev/null || true)"
[ -z "$CWD" ] && CWD="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# No .harness/ → silent exit (the common case).
[ -d "$CWD/.harness" ] || exit 0

DEST_DIR="$CWD/.harness/_workspace/prompts"
mkdir -p "$DEST_DIR" 2>/dev/null || exit 0

MONTH="$(date -u +%Y-%m 2>/dev/null || echo unknown)"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo unknown)"
DEST="$DEST_DIR/${MONTH}.jsonl"

# Append a single JSONL line. If node is unavailable, exit 0 silently.
printf '%s' "$INPUT" | TS_VALUE="$TS" node -e '
let raw = "";
process.stdin.on("data", c => raw += c);
process.stdin.on("end", () => {
  try {
    const d = raw.trim() ? JSON.parse(raw) : {};
    const text = d.user_prompt || d.prompt || "";
    const sid = d.session_id || "";
    const entry = {ts: process.env.TS_VALUE, session_id: sid, prompt: text};
    console.log(JSON.stringify(entry));
  } catch { /* silent */ }
});
' >> "$DEST" 2>/dev/null || true

exit 0
