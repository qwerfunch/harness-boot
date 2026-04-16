**[English](README.md)** | [한국어](README.ko.md)

# harness-boot

**Boot a detailed plan MD into a Claude Code native multi-agent harness.**

Give it a polished plan, get back ~50 executable files — 9 agents, 8 skills, 5 hooks, 5 protocols — with TDD isolation, runtime guardrails, and Opus/Sonnet model routing. All wired up. Ready to `/start`.

---

## Bring Your Own Masterpiece

> **We don't design the blueprint — we build the factory that follows it.**
>
> In harness engineering, design is everything. A plan should be sharpened, questioned, rewritten, stripped down, rebuilt, and sharpened again — until there's nothing left to cut. Trying to squeeze that level of rigor into an automated plugin? That's how you end up with a project that *looks* sophisticated but *is* mediocre.
>
> So we made a deliberate choice: **harness-boot does not touch your design.** Not even a little. You do the obsessive planning. You agonize over the architecture. You lose sleep over naming conventions. And when you're done — when your plan MD is a work of art — you hand it to us.
>
> We do the boring part. Flawlessly.
>
> **Show up with a polished plan and leave with 50 files.
> Show up with a napkin sketch and leave with 50 regrets.**

---

## What It Does

- **Plan-to-harness generation** — Reads your plan MD and produces the full structure in one session (Phases 1-6, with confirmation gates)
- **TDD sub-agent isolation** — Red/Green/Refactor in separate sub-agent contexts to prevent knowledge leakage
- **Runtime guardrails** — Security gates, auto-formatting, doc-sync enforcement via hooks
- **Anti-rationalization** — Every skill embeds excuse-rebuttal tables so agents can't cut corners
- **Model routing** — Opus for judgment, Sonnet for execution (~30% cost reduction)
- **Cross-session state** — Checkpoint/resume, Initializer/Coding mode switching, state consistency verification
- **Quality gates** — 5-stage gates (TDD -> Implementation -> Review -> Testing -> Deploy), each requiring concrete evidence

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
| `/setup <plan.md>` | Generate harness structure from a detailed plan | Once at project start |
| `/start` | Start development (run TDD on next feature) | After harness is ready, use repeatedly |

<details>
<summary><strong>Generated Harness Structure</strong></summary>

```
project-root/
├── CLAUDE.md                  # Main summary (<1,500 tokens)
├── PROGRESS.md                # State tracking + checkpoint/resume
├── feature-list.json          # Feature list + pass status
├── CHANGELOG.md               # Change history
├── .claude/
│   ├── settings.json          # Hook configuration
│   ├── agents/                # 9 sub-agents (model routing via frontmatter)
│   ├── skills/                # 8 skills (Anthropic Agent Skills format)
│   ├── protocols/             # TDD, iteration convergence, doc sync, etc.
│   ├── examples/              # Golden samples
│   └── *.md                   # context-map, security, quality-gates, etc.
├── hooks/                     # 5 executable hook scripts
└── scripts/                   # Automation utilities
```

</details>

## How It Works

Four principles govern every generated harness:

1. **TDD-First** — Test-writer, implementer, and refactorer run in isolated sub-agent contexts. No shared memory, no cheating.
2. **Iteration Convergence** — Max 5 loops per feature. If it can't converge, it escalates to you instead of spiraling.
3. **Code-Doc Sync** — Triple defense: prompt protocol tells agents to sync, a PreToolUse hook blocks commits that don't, and the reviewer double-checks.
4. **Anti-Rationalization** — LLMs are excellent at convincing themselves "this small change doesn't need tests." Every skill includes a rebuttal table that says: *"I know you'll say X. You're wrong because Y."*

---

**Docs:** [Harness Engineering Guide](docs/setup-guide.md) | [Kickoff Prompts](docs/start-prompts.md)

**References:** [Anthropic Skills](https://github.com/anthropics/skills) | [Agent Skills Collection](https://github.com/addyosmani/agent-skills) | [Everything Claude Code](https://github.com/affaan-m/everything-claude-code)

**License:** MIT
