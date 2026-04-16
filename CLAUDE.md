# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

harness-boot is a Claude Code plugin that converts detailed plan MDs into executable multi-agent harnesses. It generates ~50 files (9 agents, 8 skills, 5 hooks, 5 protocols) with TDD sub-agent isolation, code-doc sync enforcement, anti-rationalization skills, and Opus/Sonnet model routing.

## Commands

| Command | Purpose |
|---------|---------|
| `/setup <plan.md>` | Read a plan MD and generate the full harness (Phase 1-6). One-time per project. |
| `/start` | Begin development. Picks the next incomplete feature from feature-list.json and runs TDD cycle. |

## Local Development

```bash
# Run as a local plugin
claude --plugin-dir .

# Reload after modifying plugin files
/reload-plugins
```

## Architecture

The plugin is structured as Claude Code native commands + hooks:

- `commands/` — Slash command definitions (`setup.md`, `start.md`) with YAML frontmatter
- `docs/setup-guide.md` — Full harness engineering spec referenced by `/setup` at runtime via `${CLAUDE_PLUGIN_ROOT}/docs/setup-guide.md`
- `docs/start-prompts.md` — Kickoff and situational prompts for `/start`
- `hooks/hooks.json` — Plugin's own hook config (empty; actual project hooks are generated into target project's `.claude/settings.json`)

## Key Design: `/setup` Flow

Phase 1-6 sequential generation with user confirmation and checkpoint (`last_completed_phase` in PROGRESS.md) between each phase. Interrupted sessions can resume from the last completed phase.

1. Infrastructure (settings.json, hooks/, environment.md, security.md)
2. Protocols (tdd-loop, iteration-cycle, code-doc-sync, session-management, message-format) + CLAUDE.md
3. Agents (9 agents with `model:` frontmatter — opus for judgment, sonnet for execution)
4. Skills (8 skills, each must follow 6-section Anatomy with Rationalizations >= 3 rows)
5. Sub CLAUDE.md per directory
6. State files (feature-list.json, PROGRESS.md, CHANGELOG.md)

## Key Design: `/start` Flow

1. Load orchestrator agent + session context (bootstrap hook verifies PROGRESS.md ↔ feature-list.json consistency)
2. Detect mode (Initializer vs Coding) from PROGRESS.md
3. Select next `passes: false` feature from feature-list.json (array order = priority)
4. Run TDD cycle via Claude Code `Agent` tool: Red (tdd-test-writer) -> Green (tdd-implementer) -> Refactor (tdd-refactorer). Max 5 iterations, then escalate.
5. Quality gates 0-4 (Gate 0 enforced by implementer + reviewer), code-doc sync, single commit

## Four Core Principles

1. **TDD-First** — Red/Green/Refactor in isolated sub-agent contexts (prevents test-implementation knowledge leakage)
2. **Iteration Convergence** — Max 5 loops, then escalate to user
3. **Code-Doc Sync** — Triple defense: prompt protocol + PreToolUse hook (blocks commit) + reviewer check
4. **Anti-Rationalization** — Every skill embeds a rationalization-rebuttal table (>= 3 rows)

## Constraints for Generated Harnesses

- CLAUDE.md <= 1,500 tokens; SKILL.md <= 500 lines
- Hook scripts: shebang + stdin JSON parsing; exit 0 = proceed, exit 1 = hook error (proceeds), exit 2 = block action
- feature-list.json: array order = priority; only `passes` field may be changed; no add/delete/reorder/modify items
- Tech stack not specified in plan -> present 2-3 recommendations, wait for developer choice (never auto-select). Stored in CLAUDE.md (summary) + environment.md (detail).
- Quality gates require evidence; Gate 3 coverage: tdd_focus functions 100% line coverage, overall no regression
- Gate 4 rollback: single commit enables `git revert`; DB migrations require down-migration

## Model Routing

```
Opus (judgment): orchestrator, architect, reviewer, debugger
Sonnet (execution): implementer, tdd-test-writer, tdd-implementer, tdd-refactorer, tester
```
