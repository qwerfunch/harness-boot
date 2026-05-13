#!/usr/bin/env bash
# capture-tokens.sh — Stop hook (F-174)
#
# Reads the Claude Code Stop-event payload from stdin, parses the
# transcript JSONL to find the latest assistant message's `usage`, and
# records a typed `llm_call` event via `harness token` against the
# currently active feature.
#
# Closes the measurement-accuracy validity threat in the SWE-bench
# benchmark suite (F-173): vanilla token totals no longer depend on the
# user remembering to read `/cost` between turns. F-172 already shipped
# the `harness token` CLI + the `events.log` schema — this hook just
# auto-feeds it.
#
# Contract:
#   - Fail-open everywhere. Any parse error, missing field, missing
#     `.harness/`, missing active feature, or missing `usage` → exit 0.
#   - No stdout. Stop hooks treat non-zero with stop_hook_active=true
#     as an instruction to block further halts; we never want that.
#   - Stdin payload (Claude Code Stop):
#       {
#         "session_id": "...",
#         "cwd": "...",
#         "transcript_path": "/abs/path/to/session.jsonl",
#         "hook_event_name": "Stop",
#         "stop_hook_active": false
#       }
#   - Transcript JSONL is a Claude-Code-internal format and not a public
#     contract. Each assistant line is expected to carry
#     `.message.usage.input_tokens` + `.message.usage.output_tokens` and
#     `.message.model`. The hook picks the LATEST line that has usage.
#     If Claude Code changes the schema this hook silently degrades to
#     exit 0 — track via ISSUES-LOG when noticed.
#
# Privacy: the hook reads only the local `transcript_path` file (already
# on the user's disk because Claude Code wrote it there) and appends
# token counts + the model id to the local `events.log`. No network
# access. No conversation content leaves the script.
#
# Performance contract: in projects without a `.harness/` directory
# (the common case for sessions that just happen to have the plugin
# installed) the hook short-circuits BEFORE invoking node, so the
# per-turn overhead is the bash process itself (~5 ms on macOS/Linux).
#
# Opt-out:
#   HARNESS_DISABLE_TOKEN_HOOK=1 → exit 0 immediately, no work.
#
# Env overrides (for tests + the opt-out above):
#   HARNESS_DISABLE_TOKEN_HOOK  — any non-empty value disables the hook.
#   HARNESS_BIN  — path to `harness` binary (default: `harness` on PATH).
#   CAPTURE_TOKENS_KIND — kind tag passed to `harness token` (default:
#                 `subagent`, since the hook runs without user input).

set -u

# Opt-out short-circuit. Honors any non-empty value (`1`, `true`, etc.).
[ -n "${HARNESS_DISABLE_TOKEN_HOOK:-}" ] && exit 0

# Fast-path — Claude Code sets `CLAUDE_PROJECT_DIR` to the session's
# project root for every plugin hook invocation. When that env var is
# set AND the project has no `.harness/` directory, we can short-circuit
# without ever spawning node. This is the steady state for users who
# installed the plugin for the slash commands but don't run harness in
# the active project. Note: we deliberately do NOT fall back to `pwd` —
# the process cwd at hook time is whatever Claude Code's runtime
# happens to be in, which is often a parent directory that may itself
# contain an unrelated `.harness/`. Relying on `pwd` here would
# misattribute token events across project boundaries.
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ ! -d "$CLAUDE_PROJECT_DIR/.harness" ]; then
  exit 0
fi

INPUT="$(cat 2>/dev/null || true)"

if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -d "$CLAUDE_PROJECT_DIR/.harness" ]; then
  CWD="$CLAUDE_PROJECT_DIR"
else
  # No reliable env var. Parse the stdin payload's `cwd`. This is the
  # explicit source-of-truth from Claude Code for which directory the
  # session is operating in.
  CWD="$(printf '%s' "$INPUT" | node -e '
let raw = "";
process.stdin.on("data", c => raw += c);
process.stdin.on("end", () => {
  try {
    const d = raw.trim() ? JSON.parse(raw) : {};
    if (typeof d.cwd === "string") process.stdout.write(d.cwd);
  } catch { /* silent */ }
});
' 2>/dev/null || true)"
  [ -n "$CWD" ] && [ -d "$CWD/.harness" ] || exit 0
fi

# Extract transcript_path from the same payload (we always need node
# for this since the path isn't on the filesystem yet — well, it is,
# but its location is only known via the payload).
TRANSCRIPT="$(printf '%s' "$INPUT" | node -e '
let raw = "";
process.stdin.on("data", c => raw += c);
process.stdin.on("end", () => {
  try {
    const d = raw.trim() ? JSON.parse(raw) : {};
    if (typeof d.transcript_path === "string") process.stdout.write(d.transcript_path);
  } catch { /* silent */ }
});
' 2>/dev/null || true)"
[ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ] || exit 0

HARNESS_BIN="${HARNESS_BIN:-harness}"
KIND="${CAPTURE_TOKENS_KIND:-subagent}"

# Resolve active feature id via `harness work --current --json`.
# A null result (no active feature) gives an empty string, and we skip.
FEATURE="$("$HARNESS_BIN" work --harness-dir "$CWD/.harness" --current --json 2>/dev/null | node -e '
let raw = "";
process.stdin.on("data", c => raw += c);
process.stdin.on("end", () => {
  try {
    const d = raw.trim() ? JSON.parse(raw) : {};
    if (d && typeof d.feature_id === "string" && d.feature_id.length > 0) {
      process.stdout.write(d.feature_id);
    }
  } catch { /* silent */ }
});
' 2>/dev/null || true)"
[ -n "$FEATURE" ] || exit 0

# Walk the transcript JSONL from the bottom to find the most recent
# assistant message that carries a `usage` object. Emits one line:
#   "<tokens_in> <tokens_out> <model>"
USAGE="$(TRANSCRIPT_PATH="$TRANSCRIPT" node -e '
const fs = require("fs");
const path = process.env.TRANSCRIPT_PATH;
try {
  const text = fs.readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const o = JSON.parse(lines[i]);
      const msg = o && o.message;
      const u = msg && msg.usage;
      if (u && typeof u.input_tokens === "number" && typeof u.output_tokens === "number") {
        const model = (msg.model && typeof msg.model === "string") ? msg.model : "unknown";
        process.stdout.write(`${u.input_tokens} ${u.output_tokens} ${model}`);
        break;
      }
    } catch { /* skip malformed line */ }
  }
} catch { /* silent */ }
' 2>/dev/null || true)"
[ -n "$USAGE" ] || exit 0

# Split into three tokens. The model id is the third field and may
# contain hyphens / dots, but never spaces in Anthropic's identifiers.
read -r TOK_IN TOK_OUT MODEL <<<"$USAGE"
[ -n "$TOK_IN" ] && [ -n "$TOK_OUT" ] && [ -n "$MODEL" ] || exit 0

"$HARNESS_BIN" token \
  --harness-dir "$CWD/.harness" \
  --in "$TOK_IN" \
  --out "$TOK_OUT" \
  --model "$MODEL" \
  --feature "$FEATURE" \
  --kind "$KIND" \
  >/dev/null 2>&1 || true

exit 0
