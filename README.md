# harness-boot

> [English](README.md) · [한국어](README.ko.md)

> **Your AI has speed. We give it direction.**

harness-boot is a multi-agent development harness for Claude Code. Where most AI tools add *capability*, we add *focus*.

[![plugin](https://img.shields.io/badge/plugin-v0.11.7-blue)](.claude-plugin/plugin.json)
[![tests](https://img.shields.io/badge/tests-1117%20passing-brightgreen)](tests)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## 🐎 Why a *harness*?

A loose horse runs fast in every direction. A harnessed horse runs fast toward something.

```
You  ──▶  ① Convert  ──▶  ② Evolve  ──▶  ③ Focus  ──▶  ④ Collaborate  ──▶  ⑤ Unify  ──▶  Result
          (the context)   (the docs)      (the rules)    (the experts)        (two commands)
```

---

## Five strengths

| # | Strength | How it works | What you get |
|---|---|---|---|
| 1 | **Convert** | Plain-language ideas convert into an intermediate language — structured specs that every AI agent can act on directly | Same context for every agent — less guessing, sharper output |
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
```

Pick the entry point that fits — both feed into the same harness:

```bash
# A. From a one-line idea
/harness-boot:init "a simple to-do app"

# B. From an existing planning doc (plan.md, design notes, a sketch)
/harness-boot:init plan.md
```

Then drive every feature through the lifecycle:

```bash
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

A typical happy path — start a feature, run the gates, mark it done.

```
You> let's start the login feature

Claude> Starting F-3 (Login).
        To finish: gate_5 (smoke run) PASS + at least 1 evidence.
        Next: run the gates.

You> run them

Claude> gate_0  (tests)             PASS — 19 unit tests
        gate_5  (smoke run)         PASS — evidence auto-saved
        gate_1/2/3  (type/lint/coverage)   SKIPPED — no tool detected
        Iron Law satisfied (gate_5 + evidence). Mark F-3 done? [Y/n]

You> Y

Claude> Done. Retro saved: .harness/_workspace/retro/F-3.md
        Up next: F-4 (Signup). Say "switch" or "show what's left".
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

| Project | Preview | Demo | Source | Description |
|---|---|---|---|---|
| **cosmic-suika** | _(image landing soon)_ | [Play](https://qwerfunch.github.io/cosmic-suika-pages/) | [GitHub](https://github.com/qwerfunch/cosmic-suika-pages) | Space-themed merge game |
| *Yours next* | — | — | — | Add your harness-boot project here |

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

**v0.11.5** — preparing for external adoption, running our own dogfood.

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
