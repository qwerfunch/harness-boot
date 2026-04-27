# Preamble specification (BR-014 anti-rationalization)

The single source of truth for the 3-line header every harness-boot command
and agent emits. F-042 centralized this convention; the rest of the repo
references this document instead of redefining the rule.

## The 3 lines

```
<emoji> <command-or-agent-id> · <task summary> · <5–10 word reason>
NO skip: <constraint #1 — what this command/agent cannot bypass>
NO shortcut: <constraint #2 — what this command/agent cannot take a shortcut on>
```

- **Line 1**: emoji + `command/agent` id + a short task summary + a 5-to-10
  word reason. Communicates *what is happening right now*.
- **Lines 2-3 (BR-014 anti-rationalization)**: declare the two constraints
  this command or agent **cannot** bypass. Lines 2 and 3 must start with the
  literal prefixes `NO skip:` and `NO shortcut:` (English, exactly) — they
  are the hard-grep `scripts/self_check.sh` step 5 enforces.

## Why

Without the Preamble, the LLM tends to skip steps with rationalizations like
"already done" or "this is the easy path". The two `NO …:` lines turn that
gap into an explicit, machine-checked refusal.

## Files that follow this convention

- `commands/init.md`, `commands/work.md` — slash commands.
- `agents/orchestrator.md`, `agents/software-engineer.md`, `agents/reviewer.md`,
  `agents/backend-engineer.md`, `agents/frontend-engineer.md`,
  `agents/security-engineer.md`, `agents/a11y-auditor.md`,
  `agents/qa-engineer.md`, `agents/integrator.md`, `agents/tech-writer.md`,
  `agents/performance-engineer.md`, `agents/audio-designer.md`,
  `agents/visual-designer.md`, `agents/ux-architect.md`,
  `agents/researcher.md`, `agents/product-planner.md` — sub-agents.

Each of these files keeps the Preamble inline (it has to — that's what the
runtime emits), but they all backlink here so a future change ships in one
place.

## What `scripts/self_check.sh` step 5 actually checks

For every file under `commands/*.md`:

1. The line `^## Preamble` is present (the section header).
2. The line `^NO skip:` is present somewhere below.
3. The line `^NO shortcut:` is present somewhere below.
4. The string `scripts/` appears (the file references at least one script
   path — a sanity check that it isn't completely abstract).

Agents are not checked by step 5 today; that's a follow-up if the convention
ever needs broader enforcement.

## What you can change vs. what you cannot

- **Change freely**: emoji, command id format, task-summary length, the
  prose after each `NO …:` colon. The constraints themselves are
  command/agent-specific.
- **Don't change**: the literal prefixes `NO skip:` / `NO shortcut:` (they're
  hardcoded in `self_check.sh`), or the 3-line shape (line 1 + 2 + 3, in
  that order, before any other content).

## Brand-glossary backlink

`Preamble` and `BR-014` are defined in
[`docs/glossary/BRAND_TERMS.md`](glossary/BRAND_TERMS.md).
