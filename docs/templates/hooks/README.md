# Opt-in hook templates (v0.4+, F-014)

The harness-boot plugin only ships **one hook in the plugin root** (`hooks/` — the SessionStart banner). Every other hook lives here as a **template the user copies in when they want it**.

## Why opt-in

A Claude Code plugin hook fires in **every workspace where the plugin is installed**. If `security-gate` lived plugin-wide, every Bash invocation in a non-harness project would still pay for it — death by a thousand pre-tool checks.

The fix: **ship the templates here**, and let each project copy what it needs into `.claude/hooks.json`.

## Five templates

| File | Trigger | What it does | Risk |
|---|---|---|---|
| `security-gate.sh` | PreToolUse Bash | Warns on `rm -rf` · `sudo` · `chmod 777` (exit 0, fail-open) | Low |
| `format.sh` | PostToolUse Write\|Edit | Auto-formats with prettier / black if installed (skips otherwise) | Very low |
| `doc-sync-check.sh` | PostToolUse Write\|Edit | Greps that `@import` targets in CLAUDE.md still exist | Very low |
| `test-runner.sh` | PostToolUse Write\|Edit (`.py` · `.ts` · `.go`) | Runs the tests touching the changed file (opt-in — can be slow) | Medium |
| `coverage-gate.sh` | PreToolUse Bash (`rm -rf` · `git reset --hard`) | Warns and `sleep 2` before the call | Low |

## Install (user)

```bash
# 1. cd into your project root.
cd /path/to/my-project

# 2. Copy the hooks you want into your own .claude/.
mkdir -p .claude/hooks
cp "$CLAUDE_PLUGIN_ROOT/docs/templates/hooks/security-gate.sh" .claude/hooks/

# 3. Add a hooks section to .claude/settings.json (or merge into an existing one).
cat > .claude/settings.local.json <<'EOF'
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "bash $PWD/.claude/hooks/security-gate.sh || true"
      }]
    }]
  }
}
EOF

# 4. Restart Claude Code, or run /hooks to reload.
```

Each template has the per-script install snippet at the top of its file too.

## Common contract (every template follows)

1. **fail-open** — a non-zero exit must never block Claude Code. Wrap with `|| true` or force `exit 0`.
2. **CQS** — diagnose only. Do not modify the target file's mtime.
3. **Parse stdin JSON safely** — use `jq` or `python3 -c "import json,sys; ..."`. Never pipe through unquoted `xargs`.
4. **Quote paths with spaces** — always quote variables that hold file paths.
5. **Verify with a pipe-test** — feed a sample stdin payload and confirm exit 0.

## Adding a template (contributor)

1. Write `docs/templates/hooks/<name>.sh`.
2. Add a row to the table above.
3. Add shebang / fail-open / executable-permission checks to `tests/unit/test_hooks.py`.
4. Commit.
