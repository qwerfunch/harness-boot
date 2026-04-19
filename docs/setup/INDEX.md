# harness-boot Setup Spec — Index

This directory holds the harness-engineering specification consumed by `/harness-boot:setup`. It replaces the legacy single-file `docs/setup-guide.md`. Claude Code slash commands load referenced files whole, so the spec is split by topic: `/setup` reads **INDEX.md first**, then pulls in only the topic files relevant to the current phase. Every cross-reference uses `${CLAUDE_PLUGIN_ROOT}/docs/setup/<file>.md#<anchor>` and resolves to a stable anchor comment (`<!-- anchor: slug -->`) so heading renames do not break links.

## File Manifest

| File | Covers | Phase(s) | Size |
|------|--------|----------|------|
| [philosophy-and-layout.md](philosophy-and-layout.md) | Core philosophy + directory tree | always-on | ~85 lines |
| [runtime-guardrails.md](runtime-guardrails.md) | Security gate, coverage gate, hooks, gate evidence | 1, 2 | ~350 lines |
| [domain-persona.md](domain-persona.md) | Domain persona template + module extraction | 1 | ~130 lines |
| [cross-session-state.md](cross-session-state.md) | Tech stack / architecture decisions, language, feature-list.json, PROGRESS.md | 1, 2, 6 | ~420 lines |
| [tdd-isolation.md](tdd-isolation.md) | TDD 3-agent split + bdd-writer, file classification | 3 | ~125 lines |
| [model-routing.md](model-routing.md) | Opus/Sonnet per-agent routing | 3 | ~35 lines |
| [code-style.md](code-style.md) | Google style, Comment Rules, logging | 3, 4 | ~195 lines |
| [skills-anatomy.md](skills-anatomy.md) | 7-section skill format + validation checklist | 4 | ~310 lines |
| [agents-and-gates.md](agents-and-gates.md) | Agent roster, team architecture, Gates 0-4 | 3 | ~185 lines |
| [evolution-and-recovery.md](evolution-and-recovery.md) | Code-doc sync, evolution, error recovery, observability | 2, 6 | ~360 lines |
| [generation-rules.md](generation-rules.md) | Phase order, plan→harness conversion, token budget | always-on | ~65 lines |

## Phase → Files Map

`/setup` loads INDEX.md + the always-on pair at session start; subsequent files are pulled in on-demand per phase.

| Phase | Purpose | Files to load |
|-------|---------|---------------|
| — | Session bootstrap | `philosophy-and-layout.md`, `generation-rules.md`, this index |
| **1** | Infrastructure (settings, hooks, environment, security, domain-persona, update-feature-status.mjs) | `runtime-guardrails.md`, `domain-persona.md`, `cross-session-state.md` (tech-stack / architecture / language / .gitignore sections) |
| **2** | Protocols + CLAUDE.md + README.md | `runtime-guardrails.md` (protocol references), `cross-session-state.md` (README.md section), `evolution-and-recovery.md` (code-doc-sync protocol) |
| **3** | Agents (orchestrator, implementers, reviewer, QA, TDD sub-agents) | `agents-and-gates.md`, `tdd-isolation.md`, `model-routing.md`, `code-style.md` (for Comment Rules reference) + pre-baked rule fragments from `../templates/agents/rules/*.md` |
| **4** | Skills (8-skill pack in Anthropic Agent Skills format) | `skills-anatomy.md`, `code-style.md` (Comment Rules) + pre-baked skill bodies from `../templates/skills/<skill>/SKILL.md` (5 domain-agnostic) and `.tmpl` (3 project-adapted) |
| **5** | Context map (`.claude/context-map.md`) | `philosophy-and-layout.md` (layout rules) |
| **6** | State files (feature-list.json, PROGRESS.md, CHANGELOG.md, error-recovery.md, observability.md) | `cross-session-state.md` (feature-list + PROGRESS schemas), `evolution-and-recovery.md` (error recovery + observability) |

## Anchor Glossary

Stable anchors cited by `commands/setup.md`, `commands/start.md`, and cross-file references.

| Anchor | Location | Used by |
|--------|----------|---------|
| `#module-extraction` | `domain-persona.md` | `/setup` Phase 1 (domain-persona generation) |
| `#language-settings` | `cross-session-state.md` | `/setup` Phase 1, CHANGELOG.md generation |
| `#conversation-language-detection` | `cross-session-state.md` | `/setup` Step 1.1.5 (OS-aware locale fallback) |
| `#file-classification-for-tdd-test-writer` | `tdd-isolation.md` | `/setup` Phase 3 (implementer prompts) |
| `#comment-rules` | `code-style.md` | Phases 3, 4; Gate 2 review; tdd-implementer, tdd-refactorer, reviewer agents |
| `#validation-checklist` | `skills-anatomy.md` | `/setup` Phase 4 (skill pack validation) |
| `#cycle-lean-tdd` | `../protocols/tdd-cycles.md` | `/start` Step 4 (default: Design → Implement → BDD-Verify → Refactor) |
| `#cycle-tdd` | `../protocols/tdd-cycles.md` | `/start` Step 4 (strict 3-agent TDD cycle; safety-critical opt-in) |
| `#cycle-state-verification` | `../protocols/tdd-cycles.md` | `/start` Step 4 (UI / rendering strategy) |
| `#cycle-integration` | `../protocols/tdd-cycles.md` | `/start` Step 4 (wiring / entry points) |
| `#gate-0` | `../protocols/tdd-cycles.md` | `/start` Step 5 (Gate 0 parent; routes to per-strategy sub-anchor) |
| `#gate-0-lean-tdd` | `../protocols/tdd-cycles.md` | `/start` Step 5 (Gate 0 evidence for `lean-tdd`: BDD scenario count) |
| `#gate-0-tdd` | `../protocols/tdd-cycles.md` | `/start` Step 5 (Gate 0 evidence for `tdd`) |
| `#gate-0-state-verification` | `../protocols/tdd-cycles.md` | `/start` Step 5 (Gate 0 evidence for `state-verification`) |
| `#gate-0-integration` | `../protocols/tdd-cycles.md` | `/start` Step 5 (Gate 0 evidence for `integration`) |
| `#runtime-smoke-gate` | `agents-and-gates.md` | `/start` session-terminal; session-management.md, qa-agent-guide.md, templates/agents/rules/11-qa-invocation-timing.md |
| `#runtime-smoke-configuration` | `cross-session-state.md` | `/setup` Phase 1 (environment.md generation); referenced from agents-and-gates.md Gate 5 trigger |

Anchors in `commands/start.md` (e.g. `qa-invocation-timing`, `iteration-tracking`, `feature-selection-algorithm`) live at the command surface, not the setup spec, and are cited directly by path-plus-anchor rather than through this glossary.

When adding a new cross-reference, add an `<!-- anchor: slug -->` HTML comment on the target heading first, then register the slug here.

## Loading Recipe for `/setup`

1. At Step 0, load this file (`INDEX.md`) plus the two always-on files: `philosophy-and-layout.md` and `generation-rules.md`.
2. For each phase, load only the files named in the Phase → Files Map row.
3. When a phase needs a single anchored section from another file (e.g. Phase 3 citing `code-style.md#comment-rules`), load the whole file on first reference, then reuse it for the remainder of the session.
4. Never load `docs/setup-guide.md` — it is deprecated and slated for removal.
5. Phase 3 and Phase 4 read pre-baked template trees (`docs/templates/agents/rules/` and `docs/templates/skills/`) to avoid re-emitting fixed text. Fragments under `agents/rules/` are regenerated by `scripts/build-rule-fragments.mjs`; do not hand-edit. See `commands/setup.md` Phase 3 Step 4 and Phase 4 Step 5.

## Docs Size Policy

Single files under `docs/` must stay **≤ 500 lines (≈ 1,600 tokens)**. Files exceeding the limit must carry a top-of-file `<!-- size-exception: <reason> -->` comment; reviewers reject uncommented over-limit files. Rationale: Claude Code slash commands have no include/glob/anchor mechanism — every referenced file is loaded whole, so oversized docs force unnecessary context on every `/setup` invocation.

Soft-enforced by `scripts/check-doc-sizes.mjs` (non-blocking).
