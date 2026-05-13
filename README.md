# harness-boot

> [English](README.md) · [한국어](README.ko.md)

> **Your AI has speed. We give it direction.**

harness-boot is a multi-agent development harness for Claude Code. Where most AI tools add *capability*, we add *focus*.

[![plugin](https://img.shields.io/badge/plugin-v0.15.9-blue)](.claude-plugin/plugin.json)
[![tests](https://img.shields.io/badge/tests-866%20passing-brightgreen)](tests/parity)
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

If it takes more than 5 minutes, [open an issue](https://github.com/qwerfunch/harness-boot/issues). We'll fix it.

---

## Manual install

Use this when you want to run from a local clone — for contributors, forks, or offline setups. The repo's `.claude-plugin/marketplace.json` makes any clone act as a self-hosted marketplace.

> Note: harness-boot is not listed in the official Claude Code marketplace yet — the `qwerfunch/harness-boot` form above resolves to this GitHub repo directly.

```bash
git clone https://github.com/qwerfunch/harness-boot.git
cd harness-boot
```

Then in Claude Code (use the absolute path of the clone):

```bash
/plugin marketplace add /absolute/path/to/harness-boot
/plugin install harness-boot@harness-boot
```

To update later, `git pull` in the clone and run `/plugin marketplace update harness-boot`.

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

Claude> Starting Login (F-3).
        To finish: smoke run (gate_5) PASS + at least 1 evidence.
        Next: run the gates.

You> run them

Claude> tests             (gate_0)       PASS — 19 unit tests
        smoke run         (gate_5)       PASS — evidence auto-saved
        type/lint/coverage (gate_1/2/3)  SKIPPED — no tool detected
        Iron Law satisfied (smoke run + evidence). Mark Login (F-3) done? [Y/n]

You> Y

Claude> Done. Retro saved: .harness/_workspace/retro/F-3.md
        Up next: Signup (F-4). Say "switch" or "show what's left".
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
| **cosmic-suika** | <a href="https://qwerfunch.github.io/cosmic-suika-pages/"><img src="docs/assets/cosmic-suika.png" alt="cosmic-suika preview" width="240"></a> | [Play](https://qwerfunch.github.io/cosmic-suika-pages/) | [GitHub](https://github.com/qwerfunch/cosmic-suika-pages) | Space-themed merge game |
| *Yours next* | — | — | — | Add your harness-boot project here |

**Built something?** Open a [PR](https://github.com/qwerfunch/harness-boot/pulls) adding your project to the table — copy an existing row as a template. Or open an [issue](https://github.com/qwerfunch/harness-boot/issues) with the image and a one-liner if a PR is overkill.

Send any image, GIF, or screenshot that shows the project — plus a one-liner and a link. We'll optimize and place it on merge. Full guide: [`docs/assets/README.md`](docs/assets/README.md).

---

## Benchmarks

Does harness-boot actually produce better output than vanilla Claude Code — fewer tokens, more issues resolved? The framework for an apples-to-apples comparison is public, with the methodology, task list, and reproduction scripts open for inspection.

- **Suite**: SWE-bench Verified (20-task subset across 9 popular Python repos: django, sympy, scikit-learn, matplotlib, sphinx, pytest, requests, flask, pylint, astropy, pandas, xarray)
- **Measures**: resolve rate · token consumption · wall time · code quality signals (LOC, tests added, drift catches)
- **Status**: framework public, measurement in progress
- **Read**: [`docs/benchmark/swe-bench-verified/REPORT.md`](docs/benchmark/swe-bench-verified/REPORT.md) — results table fills in row-by-row as runs complete
- **Methodology**: [`docs/benchmark/swe-bench-verified/README.md`](docs/benchmark/swe-bench-verified/README.md) — why SWE-bench Verified, why 20 tasks, what's measured
- **Reproduce**: [`docs/benchmark/swe-bench-verified/scripts/setup.md`](docs/benchmark/swe-bench-verified/scripts/setup.md) — end-to-end external setup
- **Validity caveats**: [`docs/benchmark/swe-bench-verified/analysis/threats-to-validity.md`](docs/benchmark/swe-bench-verified/analysis/threats-to-validity.md)
- **Privacy**: the auto token capture (Stop hook · F-174) reads only the local transcript file Claude Code already wrote and appends token counts + the model id to your local `events.log`. No network access. Set `HARNESS_DISABLE_TOKEN_HOOK=1` to opt out entirely.

---

## Repository layout

```
harness-boot/
├── .claude-plugin/        plugin.json · marketplace.json
├── agents/                specialist agent definitions
├── commands/              slash commands (init · work)
├── hooks/                 session-bootstrap · prompt-log
├── src/                   TypeScript implementation
├── dist/cli/              esbuild single-file bundle (committed; no node_modules at install site)
├── bin/harness            Node shim that loads the bundle — `harness <subcommand>`
├── self_check.sh          5-step self-dogfood verification
├── skills/spec-conversion/  plan.md → spec.yaml conversion
├── docs/                  schema · templates · samples · portfolio assets
└── tests/parity/          TS parity test suite
```

---

## Status

**v0.15.0** — Adaptive drive + structural archive separation + plugin-level writing rules (F-129 → F-140). Iron Law gains paired `perf_regression` / `perf_resolved` evidence kinds so silently-regressing perf cycles can no longer ship. `complete()` now relocates done feature bodies into a sibling `spec.archive.yaml` and `harness sync` migrates pre-existing bodies in one pass — `spec.yaml` stays slim by construction. `harness drive` becomes adaptive: deterministic replan after each completion, periodic real-test injection (`harness.yaml drive.real_test.command`), and transient-retry on flaky e2e. Plugin-level `docs/communication-rules.md` standardises answer-first format and native-tone replies for any user language.

Previously: **v0.14.3** — Stability + cleanup batch (F-122 → F-128). `tests/parity/driveLoopAndPlan.test.ts` time-bomb fixed (F-122) so CI on every downstream fork stays green; CLAUDE.md brought back in sync (F-123) and refactored into stable / semi-static sigil / volatile-pointer layers so future drift is structurally prevented (F-124); the pre-cutover Python footprint (`legacy/scripts/`, `tests/unit`, `tests/integration`, `tests/scale` — ~28 k lines combined) evicted from git tracking, working trees preserved locally (F-125 + F-126); `hooks/pre-commit-phase2.sh` now short-circuits during git's own merge / cherry-pick / revert / rebase finalizers so conflict-resolution commits no longer require `HARNESS_BYPASS_PRE_COMMIT=1` (F-127). Zero capability addition, zero behaviour change; v0.14.2 installs are functionally identical.

**v0.14.0** — `drive` ships (F-118 + F-119). New autonomous-loop slash command `/harness-boot:drive "<natural-language goal>"` that scaffolds a *Goal* (a container that groups N features) via researcher → product-planner → feature-author and then runs every feature's gate cycle to completion. **Bounded by design**: BR-015 forbids self-issued `--hotfix-reason`, `git commit/push/tag`, and any shared-state mutation; the loop *halts* on 9 enumerated conditions (commit boundary, retry threshold, drift error, blocked feature, wall-clock, iteration cap, network failure, STOP file, plan-phase approval) and yields back to the user. Read-only `harness drive --status [G-N] [--all] [--json] [--watch]` is mtime-invariant (CQS, BR-012).

Previously: **v0.13.2** — Repo root cleanup (F-117): dead Python config (`pytest.ini`, `requirements-dev.txt`) removed after the v0.13 TS-only cutover. No behavior change.

**v0.13.1** added the `feature-author` skill — auto-triggers on Korean ("X 기능 구현해줘", "X 만들어줘") or English ("draft a feature", "spec out X") prompts to scaffold a complete `features[]` entry with shape detection, project-mode-aware AC count, and lockstep paste instructions.

- Changelog — [CHANGELOG.md](CHANGELOG.md)
- Developer guide — [CLAUDE.md](CLAUDE.md)
- Issues — [GitHub Issues](https://github.com/qwerfunch/harness-boot/issues)

```bash
# For contributors building from source (devDependencies only —
# end users install via /plugin install and need no npm step):
npm install
npm test            # vitest suite (parity tests)
bash self_check.sh  # 5-step structural verification
```

---

## License

[MIT](LICENSE) — Free to use, free to fork.
