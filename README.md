**[English](README.md)** | [한국어](README.ko.md)

# harness-boot

**A Claude Code plugin that turns your plan MD into a fully wired multi-agent harness.**

---

## Agents write great code. But...

Claude Code agents are remarkably capable. They write solid code and handle most tasks you throw at them. But spend enough time working alongside them and a familiar pattern emerges.

- They quietly skip tests — always with a reasonable-sounding justification.
- They change the code but forget the docs. Sound familiar?
- When the session resets, context is lost and the same ground gets covered again.

Here's the interesting part: even when your prompt explicitly says "always write tests," the agent will find a perfectly plausible reason why *this particular change* doesn't need one. Knowing the rules and following them are two different problems.

harness-boot starts from a simple question — what if the rules were enforced by structure, not instruction?

---

## Design Is Your Responsibility

> A good harness is only as good as the design behind it.
>
> Automating the design phase would be convenient, but in our experience, bundling design and execution together tends to produce mediocre results in both. Design gets stronger through iteration — reshaping, questioning, tearing down, rebuilding — and that process needs room to breathe apart from execution.
>
> **For now, harness-boot deliberately stays out of design.** The architecture decisions, the structural trade-offs, the late-night plan revisions — that's your domain. When the plan feels ready, hand it over.
>
> We handle the rest. Thoroughly.

---

## How harness-boot Works

### Plan-Driven Harness Generation — Not a Boilerplate Stamper

harness-boot doesn't produce a one-size-fits-all scaffold. It reads your plan and tailors the harness to the project — extracting tech stack, architecture patterns, and feature lists from the document. When the plan leaves something unspecified, it presents 2–3 options and waits for your decision. No silent defaults.

### TDD Isolation — Separation Enforces Honesty

The agent writing tests cannot see the implementation, and vice versa. Since the test-writer has never read the production code, tests can't be reverse-engineered to pass. Each TDD phase — writing a failing test (Red), making it pass (Green), cleaning up (Refactor) — runs in a separate sub-agent with its own isolated context.

### Domain Persona — Agents That Understand Your Business

An agent implementing `hashPassword` needs to know it's bound by SOC2 compliance, not just that it takes a string and returns a hash. During `/setup`, harness-boot extracts a domain persona from your plan — project purpose, key entities, business rules, domain vocabulary, stakeholder concerns — and feeds the right slice to each agent. The orchestrator sees the full picture; the test writer sees only the entities and invariants relevant to the current feature. Agents stop making locally correct but globally wrong decisions.

### Anti-Rationalization — Preemptive Rebuttals

"It's just a refactor, no tests needed." "It's an internal function, docs aren't necessary." Agents reach for these justifications regularly. Every skill includes a rebuttal table that anticipates these excuses: *"I know you'll say X. You still need to do Y. Here's why."* This turns out to work better than repeating the rules.

### Runtime Hooks — Structure Over Suggestion

Prompt instructions can be ignored. Hooks cannot. If code is committed without corresponding doc updates, the commit is blocked — not flagged, blocked. The same mechanism catches dangerous commands before they execute.

### Iteration Convergence — No Infinite Loops

Each feature gets a maximum of 5 TDD cycle attempts. If the agent can't converge within that window, it summarizes the situation and escalates to the developer instead of burning through cycles. This protects both your time and your token budget.

### Session Continuity — Pick Up Where You Left Off

When a session ends, work resumes from the last checkpoint. On every session start, the bootstrap hook automatically verifies consistency between progress state and the feature list, surfacing any discrepancies before work continues.

---

## Quick Start

```bash
# 1. Clone and load as a Claude Code plugin
git clone <this-repo>
cd harness-boot
claude --plugin-dir .

# 2. Feed it your plan
/setup path/to/plan.md

# 3. Confirm each generation phase (1-6) as prompted

# 4. Start development — picks the next feature, runs TDD cycle
/start
```

## Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/setup <plan.md>` | Read a plan and generate the harness structure | Once at project start |
| `/start` | Pick the next feature and run a TDD cycle | After harness is ready, use repeatedly |

## Generated Harness Structure

```
project-root/
├── CLAUDE.md                  # Project summary (<1,500 tokens)
├── PROGRESS.md                # State tracking + checkpoint/resume
├── feature-list.json          # Feature list + pass status
├── CHANGELOG.md               # Change history
├── .claude/
│   ├── settings.json          # Hook configuration
│   ├── agents/                # Sub-agents (model routing via frontmatter)
│   ├── skills/                # Skills (Anthropic Agent Skills format)
│   ├── protocols/             # TDD, iteration convergence, doc sync, etc.
│   ├── examples/              # Golden samples
│   ├── domain-persona.md      # Domain context for agents
│   └── *.md                   # context-map, security, quality-gates, etc.
├── hooks/                     # Hook scripts
└── scripts/                   # Automation utilities
```

---

## Closing Note

Every principle in harness-boot — TDD isolation, anti-rationalization, enforced doc sync, iteration convergence — addresses a problem that long predates LLMs. Skipping tests, forgetting docs, convincing yourself "this time it's fine" — these are deeply human patterns. The difference is that with people, we solved them through culture: code reviews, retrospectives, team norms. With agents, we solved them through structure.

That's where harness-boot comes from.

---

**Docs:** [Harness Engineering Guide](docs/setup-guide.md) | [Kickoff Prompts](docs/start-prompts.md)

**References:** [Anthropic Skills](https://github.com/anthropics/skills) | [Agent Skills Collection](https://github.com/addyosmani/agent-skills) | [Everything Claude Code](https://github.com/affaan-m/everything-claude-code)

**License:** MIT
