<!-- size-exception: stub redirect retained for one release cycle -->

# Harness Engineering Spec — MOVED

This monolithic guide has been split into topic files under [`docs/setup/`](setup/INDEX.md) and [`docs/protocols/`](protocols/). Do **not** load this file — it is kept for one release only to avoid breaking bookmarks, and will be deleted in the next release.

## Where to go now

- **Start here**: [`docs/setup/INDEX.md`](setup/INDEX.md) — file manifest, phase→files map, anchor glossary, loading recipe for `/setup`.
- **TDD cycles per `test_strategy`**: [`docs/protocols/tdd-cycles.md`](protocols/tdd-cycles.md) — the four cycles (`lean-tdd` (default), `tdd` (safety-critical opt-in), `state-verification`, `integration`) and Gate 0 evidence rules, cited by `commands/start.md`.

## Section mapping

| Legacy section | New location |
|----------------|--------------|
| §0 Core Philosophy, §1 Directory Structure | [`docs/setup/philosophy-and-layout.md`](setup/philosophy-and-layout.md) |
| §2 Runtime Guardrails | [`docs/setup/runtime-guardrails.md`](setup/runtime-guardrails.md) |
| §3 Domain Persona + Module Extraction | [`docs/setup/domain-persona.md`](setup/domain-persona.md) — anchor `#module-extraction` |
| §4 Cross-Session State (tech stack, architecture, language, feature-list.json, PROGRESS.md) | [`docs/setup/cross-session-state.md`](setup/cross-session-state.md) — anchor `#language-settings` |
| §5 TDD Sub-Agent Context Isolation | [`docs/setup/tdd-isolation.md`](setup/tdd-isolation.md) — anchor `#file-classification-for-tdd-test-writer` |
| §6 Model Routing | [`docs/setup/model-routing.md`](setup/model-routing.md) |
| §7 Code Style, Linting, Comment Rules | [`docs/setup/code-style.md`](setup/code-style.md) — anchor `#comment-rules` |
| §8 Skills Anatomy + §8.8 Validation | [`docs/setup/skills-anatomy.md`](setup/skills-anatomy.md) — anchor `#validation-checklist` |
| §9 Agent Definitions, §10 Quality Gates | [`docs/setup/agents-and-gates.md`](setup/agents-and-gates.md) |
| §11 Code-Doc Sync, §12 Evolution, §13 Error Recovery, §13.5 Observability | [`docs/setup/evolution-and-recovery.md`](setup/evolution-and-recovery.md) |
| §14 Generation Order, §15 Plan-to-Harness Conversion, §16 Token Budget | [`docs/setup/generation-rules.md`](setup/generation-rules.md) |
