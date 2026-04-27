# harness-boot

> [English](README.md) · [한국어](README.ko.md)

> **Your AI has speed. We give it direction.**

harness-boot is a multi-agent development harness for Claude Code. Where most AI tools add *capability*, we add *focus*.

[![plugin](https://img.shields.io/badge/plugin-v0.11.4-blue)](.claude-plugin/plugin.json)
[![tests](https://img.shields.io/badge/tests-1117%20passing-brightgreen)](tests)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## 🐎 Why a *harness*?

A loose horse runs fast in every direction. A harnessed horse runs fast toward something.

```
You  ──▶  ① Translate  ──▶  ② Evolve  ──▶  ③ Focus  ──▶  ④ Collaborate  ──▶  ⑤ Unify  ──▶  Result
          (your words)     (the docs)      (the agents)   (the experts)        (two commands)
```

---

## Five strengths

| # | Strength | How it works | What you get |
|---|---|---|---|
| 1 | **Translate** | Your plain-language ideas become structured specs that AIs can actually act on | Less guessing, more on-target output |
| 2 | **Evolve** | Edit one place, the rest stays in sync; mismatches surface automatically; your manual tweaks survive | Design docs are always current — no manual upkeep |
| 3 | **Focus** | Each agent works inside its lane; completion criteria are enforced by the system, not by trust | AIs stay on the work that's theirs |
| 4 | **Collaborate** | Role-specialized agents follow set procedures; every decision and disagreement is recorded | Blind spots get covered, every step is traceable |
| 5 | **Unify** | Two slash commands. Talk to it in plain English; see the plan before anything runs | Almost nothing to memorize |

---

## Architecture

```
        Plain language / plan.md / existing code
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │  spec.yaml  (single source of truth)     │
   │   ├─ Ideas      — vision · users         │
   │   └─ Rules      — features · decisions   │
   └──────────┬─────────────────┬─────────────┘
              │                 │
       Auto-derived         Expert collaboration
              │                 │
              ▼                 ▼
   ┌────────────────┐  ┌──────────────────────┐
   │ domain.md      │  │ orchestrator         │
   │ architecture   │  │  ├─ Planning         │
   │ events.log     │  │  ├─ Design           │
   │ chapters/      │  │  ├─ Implementation   │
   │ drift detector │  │  ├─ QA · Integration │
   └────────────────┘  │  └─ Audit (read-only)│
                       │  + ceremonies        │
                       └──────────────────────┘
                                │
                                ▼
                         /harness-boot:work
                  (no args = dashboard · words = intent)
```

---

## Quick start

In Claude Code:

```bash
/plugin marketplace add qwerfunch/harness-boot
/plugin install harness-boot@harness-boot

cd my-new-project
/harness-boot:init "a simple to-do app"
/harness-boot:work
```

**Requirements**: Python 3.10+, `pyyaml` (required), `jsonschema` (recommended).

If it takes more than 5 minutes, [open an issue](https://github.com/qwerfunch/harness-boot/issues). We'll fix it.

---

## How to use it

### Talk to it in plain English

Append whatever you'd normally say after `/harness-boot:work`. Short keywords and full sentences both work.

| Intent | What you can say |
|---|---|
| Dashboard / what's next | (no args) · "what's on my plate?" · "where am I?" · "what should I do next?" |
| Run checks | "test it" · "run the gates" · "check what's there" · "make sure nothing's missing" |
| Mark as done | "it's done" · "ready to ship" · "I think we're good" · "let's wrap up the login feature" |
| Block / pause | "I'm stuck" · "pausing this" · "the upstream API isn't ready" · "calling it for the day" |
| Start / switch | "login feature" · "let's do signup next" · "F-3" · "tackle billing first" |
| Resume | "keep going" · "back to yesterday's work" · "do the recommended one" |
| Add evidence | "I checked" · "got reviewed" · "a friend tried it" · "QA passed" |
| Drop a feature | "skip this one" · "cancel" · "F-9 — never mind" |
| Look back | "what did I do last week?" · "history of F-3" · "why did we go with OAuth?" |

These are just samples — Claude reads context and handles other phrasings too. When it isn't sure, it shows you the plan and asks Y/n before running anything.

### A short conversation

```
You> we're basically done with login, let's wrap it

Claude> Read intent: complete F-3 (Login feature)
        Status: 5/6 gates passed · 1 evidence (need 3)
        Not enough evidence to mark this done. Pick one:
          1) Add more evidence (manual check, review, test, etc.)
          2) Switch to prototype mode
          3) Use --hotfix-reason to bypass
          4) Cancel

You> 1, a friend just reviewed it and signed off

Claude> reviewer_check evidence added. Try again? [Y/n]

You> Y

Claude> Done. Retrospective auto-written.
        Up next: F-4 (Signup).
```

### Dashboard output

```
harness-boot

Active: "Login feature"
  Progress: 3/6 gates passed · 2 evidence
  Blockers: accessibility · Space-key behavior unclear
Pending: "Signup" · "Forgot password"
Next: (1) run the next gate (recommended)
```

---

## Built with harness-boot

| Project | Demo | Source | Description |
|---|---|---|---|
| **cosmic-suika** | [Play](https://qwerfunch.github.io/cosmic-suika-pages/) | [GitHub](https://github.com/qwerfunch/cosmic-suika-pages) | Space-themed merge game |
| *Yours next* | — | — | Add your harness-boot project here |

**Built something?** Send a [PR](https://github.com/qwerfunch/harness-boot/pulls) or [issue](https://github.com/qwerfunch/harness-boot/issues) and we'll add it.

Recommended format: **image or GIF** (1–3 seconds, ≤ 800px wide, ≤ 5 MB) plus a one-liner and a link. Full guide: [`docs/assets/README.md`](docs/assets/README.md).

---

## Repository layout

```
harness-boot/
├── .claude-plugin/        plugin.json · marketplace.json
├── agents/                specialist agent definitions
├── commands/              slash commands (init · work)
├── hooks/                 session-bootstrap · prompt-log
├── scripts/               Python implementation (core · ceremonies · gate · render · spec · ui)
├── skills/spec-conversion/  plan.md → spec.yaml conversion
├── docs/                  schema · templates · samples · portfolio assets
└── tests/                 unit · integration · regression · scale
```

---

## Status

**v0.11.3** — preparing for external adoption, running our own dogfood.

- Changelog — [CHANGELOG.md](CHANGELOG.md)
- Developer guide — [CLAUDE.md](CLAUDE.md)
- Issues — [GitHub Issues](https://github.com/qwerfunch/harness-boot/issues)

```bash
python3 -m pip install --user -r requirements-dev.txt
python3 -m pytest tests/ -q
bash scripts/self_check.sh
```

---

## License

[MIT](LICENSE) — qwerfunch
