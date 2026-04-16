# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

harness-boot is a Claude Code plugin that converts detailed plan MDs into executable multi-agent harnesses. It generates ~56 files (9+ agents, 8 skills, 6 hooks, 5 protocols) with TDD sub-agent isolation, code-doc sync enforcement, coverage gate enforcement, anti-rationalization skills, Opus/Sonnet model routing, and execution mode selection (Agent Team / Sub-agent / Hybrid) for module-parallel development.

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
- `docs/start-prompts.md` — Development start and situational prompts for `/start`
- `docs/references/` — Agent design patterns, orchestrator templates, QA agent guide (adapted from [revfactory/harness](https://github.com/revfactory/harness))
- `hooks/hooks.json` — Plugin's own hook config (empty; actual project hooks are generated into target project's `.claude/settings.json`)

## Key Design: `/setup` Flow

Phase 1-6 sequential generation with user confirmation and checkpoint (`last_completed_phase` in PROGRESS.md) between each phase. Interrupted sessions can resume from the last completed phase.

1. Infrastructure (settings.json, hooks/, environment.md, security.md, domain-persona.md, scripts/update-feature-status.sh, CI/CD workflow (optional, GitHub Actions or GitLab CI))
2. Protocols (tdd-loop, iteration-cycle, code-doc-sync, session-management, message-format) + CLAUDE.md
3. Agents (9+ agents with `model:` frontmatter — opus for judgment, sonnet for execution) + Execution mode selection + optional QA agent
4. Skills (8 skills in [Anthropic Agent Skills format](https://github.com/anthropics/skills): `skill-name/SKILL.md` with 7-section anatomy, YAML frontmatter with name/description/metadata/allowed-tools, Rationalizations >= 3 rows)
5. Sub CLAUDE.md per directory (with architecture layer context if pattern selected)
6. State files (feature-list.json, PROGRESS.md, CHANGELOG.md, error-recovery.md with 5 scenario playbooks)

## Key Design: `/start` Flow

1. Load orchestrator agent + session context (bootstrap hook verifies PROGRESS.md ↔ feature-list.json consistency) + domain-persona.md
2. Detect mode (Initializer vs Coding) from PROGRESS.md
3. Check execution mode (Agent Team / Sub-agent / Hybrid)
4. Select feature(s): Sub-agent → one at a time; Agent Team → parallel independent modules
5. Run TDD cycle: Sub-agent via `Agent` tool, Agent Team via `TeamCreate`+`SendMessage`+`TaskCreate`. Red -> Green -> Refactor in isolated sub-agent contexts regardless of mode. Max 5 iterations, then escalate.
6. QA agent verifies cross-boundary consistency (if included per QA criteria)
7. Quality gates 0-4 (Gate 0 enforced by implementer + reviewer), coverage gate hook, code-doc sync, auto-update feature-list.json, single commit per feature (never batch)

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
- Architecture pattern: prototype/PoC/MVP -> skip (Simple Flat). Otherwise assessed by project scale (8+ features, 3+ domain categories, cross-cutting concerns). If warranted and unspecified -> present 2-3 recommendations with plain-language explanations, wait for developer choice (never auto-select). Stored alongside tech stack in CLAUDE.md (summary) + environment.md (detail section).
- Quality gates require evidence; Gate 3 coverage: tdd_focus functions 100% line coverage, overall no regression
- Gate 4 rollback: single commit per feature enables `git revert`; DB migrations require down-migration
- Coverage gate hook: blocks `git commit` when tdd_focus functions lack test coverage ([skip-coverage] bypass)
- Feature status auto-update: `scripts/update-feature-status.sh` marks `passes: true` after Gate 4 passes — prevents tracking drift
- Per-feature commit discipline: even "implement all features" requests execute sequentially (TDD → gates → commit → next)

## Execution Mode (New)

Setup analyzes module independence to recommend the best mode:
- **Agent Team**: 3+ independent modules → parallel development with `TeamCreate`/`SendMessage`/`TaskCreate`
- **Sub-agent**: Sequential features → baseline default with `Agent` tool
- **Hybrid**: Per-phase mode switching (concrete decision criteria: 3 conditions + per-phase assignment table)

Team architecture patterns: Fan-out/Fan-in, Pipeline, Supervisor, Producer-Reviewer, Expert Pool, Hierarchical.

Reference: `docs/references/agent-design-patterns.md` (adapted from [revfactory/harness](https://github.com/revfactory/harness))

## Model Routing

```
Opus (judgment): orchestrator, architect, reviewer, debugger, qa-agent
Sonnet (execution): implementer, tdd-test-writer, tdd-implementer, tdd-refactorer, tester
```
