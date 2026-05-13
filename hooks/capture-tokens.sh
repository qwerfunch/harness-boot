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
#   - Transcript JSONL: each line is one message; assistant lines carry
#     `.message.usage.input_tokens` + `.message.usage.output_tokens` and
#     `.message.model`. We pick the LATEST line that has usage.
#
# Env overrides (for tests):
#   HARNESS_BIN  — path to `harness` binary (default: `harness` on PATH).
#   CAPTURE_TOKENS_KIND — kind tag passed to `harness token` (default:
#                 `subagent`, since the hook runs without user input).

set -u

INPUT="$(cat 2>/dev/null || true)"

# Resolve cwd + transcript_path via a single Node parse. If anything
# fails we leak nothing and exit 0.
RESOLVED="$(printf '%s' "$INPUT" | node -e '
let raw = "";
process.stdin.on("data", c => raw += c);
process.stdin.on("end", () => {
  try {
    const d = raw.trim() ? JSON.parse(raw) : {};
    const cwd = typeof d.cwd === "string" ? d.cwd : "";
    const tp = typeof d.transcript_path === "string" ? d.transcript_path : "";
    process.stdout.write(JSON.stringify({cwd, tp}));
  } catch { process.stdout.write("{}"); }
});
' 2>/dev/null || echo "{}")"

CWD="$(printf '%s' "$RESOLVED" | node -e '
let raw = "";
process.stdin.on("data", c => raw += c);
process.stdin.on("end", () => {
  try { process.stdout.write(JSON.parse(raw).cwd || ""); }
  catch { /* silent */ }
});
' 2>/dev/null || true)"
[ -z "$CWD" ] && CWD="${CLAUDE_PROJECT_DIR:-$(pwd)}"

TRANSCRIPT="$(printf '%s' "$RESOLVED" | node -e '
let raw = "";
process.stdin.on("data", c => raw += c);
process.stdin.on("end", () => {
  try { process.stdout.write(JSON.parse(raw).tp || ""); }
  catch { /* silent */ }
});
' 2>/dev/null || true)"

# No .harness/ → silent exit (the common case for unrelated sessions).
[ -d "$CWD/.harness" ] || exit 0
# No readable transcript → nothing to extract.
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
