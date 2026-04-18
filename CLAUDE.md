# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

harness-boot is a Claude Code plugin that converts detailed plan MDs into executable multi-agent harnesses. It generates ~56 files (9+ agents, 8 skills, 6 hooks, 5 protocols) with TDD sub-agent isolation, code-doc sync enforcement, coverage gate enforcement, anti-rationalization skills, Opus/Sonnet model routing, and Agent Team execution (`TeamCreate`/`SendMessage`/`TaskCreate`) for module-parallel development.

## Commands

| Command | Purpose |
|---------|---------|
| `/harness-boot:setup <plan.md>` | Read a plan MD and generate the full harness (Phase 1-6). One-time per project. |
| `/harness-boot:start` | Begin development. Picks the next incomplete feature from feature-list.json and runs TDD cycle. |

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
- `docs/setup/` — Modular harness engineering spec (11 topic files + INDEX). `/setup` loads `${CLAUDE_PLUGIN_ROOT}/docs/setup/INDEX.md` at Step 0 and pulls topic files on-demand per the Phase→Files map.
- `docs/protocols/` — Plugin-internal runtime protocols (e.g., `tdd-cycles.md` — the canonical per-`test_strategy` cycle + Gate 0 evidence reference cited from `commands/start.md`). Distinct from `docs/templates/protocols/`, which is copied into the generated harness.
- `docs/start-prompts.md` — Development start and situational prompts for `/start`
- `docs/references/` — Agent design patterns, orchestrator templates, QA agent guide (adapted from [revfactory/harness](https://github.com/revfactory/harness))
- `hooks/hooks.json` — Plugin's own hook config (empty; actual project hooks are generated into target project's `.claude/settings.json`)

## Key Design: `/setup` Flow

Phase 1-6 sequential generation. After Step 1.7 approval of the decision review, phases 1-6 auto-progress without per-phase prompts. `last_completed_phase` is still checkpointed in PROGRESS.md at every phase boundary so an interrupted session auto-resumes from Phase N+1 on re-run. The flow pauses for the user only on errors, or at Phase 6 when the dependency graph / test-strategy classification is surfaced for confirmation. QA agent inclusion is auto-decided from the 3+ modules-with-integration-points criterion (shown in the Step 1.7 summary; overridable via "Change a decision").

1. Infrastructure (settings.json, hooks/, environment.md, security.md, domain-persona.md, scripts/update-feature-status.sh)
2. Protocols (tdd-loop, iteration-cycle, code-doc-sync, session-management, message-format) + CLAUDE.md
3. Agents (9+ agents with `model:` frontmatter — opus for judgment, sonnet for execution) + module-specific implementers + optional QA agent
4. Skills (8 skills in [Anthropic Agent Skills format](https://github.com/anthropics/skills): `skill-name/SKILL.md` with 7-section anatomy, YAML frontmatter with name/description/metadata/allowed-tools, Rationalizations >= 2 rows)
5. Context map (`.claude/context-map.md` — module → layer mapping; architecture rules injected into sub-agent prompts at dispatch time, no per-directory CLAUDE.md files)
6. State files (feature-list.json, PROGRESS.md, CHANGELOG.md, error-recovery.md with 5 scenario playbooks)

## Key Design: `/start` Flow

1. Load orchestrator agent + session context (bootstrap hook verifies PROGRESS.md ↔ feature-list.json consistency) + domain-persona.md
2. Detect mode (Initializer vs Coding) from PROGRESS.md
3. Select feature(s) with numbered choices: parallel independent modules by default; single-module projects run one feature at a time. **Auto-pilot option** runs all remaining features, pausing only on errors.
4. Run development cycle per `test_strategy`: `tdd` → Red/Green/Refactor (3 isolated sub-agents); `bundled-tdd` → Bundled Red→Green (single `tdd-bundler`, 2-commit evidence) + optional Refactor; `state-verification` → Implement/State-Test/Refactor; `integration` → Implement/Integration-Test. Steps 3-6 auto-proceed on success — no mid-feature pauses. Max 5 iterations (tracked in PROGRESS.md), then escalate.
5. QA agent verifies cross-boundary consistency (if included per QA criteria)
6. Quality gates 0-4 (Gate 0 enforced by implementer + reviewer), coverage gate hook, code-doc sync, auto-update feature-list.json, single commit per feature (never batch)

## Five Core Principles

1. **TDD-First** — Red/Green/Refactor in isolated sub-agent contexts (prevents test-implementation knowledge leakage). Per-feature `test_strategy` allows alternatives: `bundled-tdd` (speed-oriented, single sub-agent with 2-commit red→green evidence), `state-verification` (UI/rendering), or `integration` (wiring).
2. **Iteration Convergence** — Max 5 loops (tracked in PROGRESS.md), then escalate to user
3. **Code-Doc Sync** — Triple defense: prompt protocol + PreToolUse hook (blocks commit on export changes) + reviewer check
4. **Anti-Rationalization** — Every skill embeds a rationalization-rebuttal table (>= 2 rows, domain-specific; add more when genuine excuses exist, but do not pad)
5. **One Question at a Time** — All user-facing decisions use numbered choices with ★ recommended option. Never batch questions.

## Constraints for Generated Harnesses

- CLAUDE.md <= 1,500 tokens; SKILL.md <= 500 lines
- Hook scripts: shebang + stdin JSON parsing; exit 0 = proceed, exit 1 = hook error (proceeds), exit 2 = block action
- feature-list.json: array order = priority; `depends_on` for dependency tracking; `test_strategy` per feature (`tdd`/`bundled-tdd`/`state-verification`/`integration`); only `passes` field may be changed during `/start`
- Tech stack not specified in plan -> present 2-3 recommendations, wait for developer choice (never auto-select). Stored in CLAUDE.md (summary) + environment.md (detail).
- Architecture pattern: prototype/PoC/MVP -> skip (Simple Flat). Otherwise assessed by project scale (8+ features, 3+ domain categories, cross-cutting concerns). If warranted and unspecified -> present 2-3 recommendations with plain-language explanations, wait for developer choice (never auto-select). Stored alongside tech stack in CLAUDE.md (summary) + environment.md (detail section).
- Quality gates require evidence; Gate 3 coverage varies by `test_strategy`: tdd=>= 70% line on tdd_focus, bundled-tdd=>= 70% line on tdd_focus (same as tdd) + 2-commit red→green sequence required at Gate 0, state-verification=test files exist, integration=60% file coverage; Gate 2 includes Comment Rules (`docs/setup/code-style.md#comment-rules`) compliance
- Gate 4 rollback: single commit per feature enables `git revert`; DB migrations require down-migration
- Coverage gate hook: blocks `git commit` when any tdd_focus function falls below 70% line coverage (computed by intersecting fnMap.loc with statementMap entries). Functions not found in fnMap produce warnings only, not blocks. ([skip-coverage] bypass)
- Doc-sync hook: blocks `git commit` only when export changes detected without feature's doc_sync targets updated (internal refactors pass through). ([skip-doc-sync] bypass)
- Feature status auto-update: `scripts/update-feature-status.sh` marks `passes: true` after Gate 4 passes — prevents tracking drift
- Per-feature commit discipline: even "implement all features" requests execute sequentially (TDD → gates → commit → next)

## Execution

The harness uses **Agent Team** execution unconditionally. The orchestrator creates a team of module-specific implementers (`implementer-<slug>`), reviewer, and optional qa-agent via `TeamCreate`, coordinates integration points via `SendMessage`, and tracks progress via `TaskCreate`/`TaskUpdate`. Single-module projects use a team of one implementer + reviewer — the team surface is uniform across project sizes.

Team architecture patterns: Fan-out/Fan-in, Pipeline, Supervisor, Producer-Reviewer, Expert Pool, Hierarchical.

Reference: `docs/references/agent-design-patterns.md` (adapted from [revfactory/harness](https://github.com/revfactory/harness))

## Model Routing

```
Opus (judgment): orchestrator, architect, reviewer, debugger, qa-agent
Sonnet (execution): implementer, tdd-test-writer, tdd-implementer, tdd-refactorer, tdd-bundler, tester
```
`tdd-bundler` is generated conditionally — only when `feature-list.json` contains at least one feature with `"test_strategy": "bundled-tdd"`.
