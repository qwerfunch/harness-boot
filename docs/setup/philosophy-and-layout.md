# Philosophy and Directory Structure

## Core Philosophy

| Principle | Description | Enforcement Mechanism |
|-----------|-------------|----------------------|
| **Testable-First** | Code is designed for testability (separable functions, pure boundaries, DI points). `lean-tdd` defers test writing to a post-hoc BDD gate; strict `tdd` keeps Red → Green → Refactor for safety-critical domains. | Gate 0 evidence + sub-agent context isolation |
| **Iteration Convergence** | Implement → test → verify → feedback → fix loop. Repeat until convergence. | Max 5 iterations then escalation |
| **Code-Doc Sync** | When code changes, update related docs in the same commit. | **Runtime blocking** via PreToolUse hook |
| **Anti-Rationalization** | Pre-empt agent excuses for skipping steps. | Excuse-rebuttal tables in every skill (>= 2 rows) |
| **One Question at a Time** | All user-facing decisions use numbered choices with ★ recommended option. | Enforced in command prompts (`commands/setup.md`, `commands/start.md`) |

> LLMs are adept at corner-cutting reasoning like "this small change doesn't need tests."
> **"I know you'll say X. But you're wrong because Y"** is more effective than "don't do X."

---

## Directory Structure

```
project-root/
├── CLAUDE.md                              # Main summary (<1,500 tokens)
├── README.md                              # Project documentation (in conversation_language)
├── PROGRESS.md                            # State tracking
├── feature-list.json                      # Feature list + pass status (JSON)
├── CHANGELOG.md                           # Change history (Keep a Changelog format)
├── .gitignore                             # Tech stack-specific ignore patterns
│
├── .claude/
│   ├── settings.json                      # Hook configuration (runtime guardrails)
│   ├── agents/                            # 9+ agents (+ optional qa-agent, module-specific agents)
│   │   ├── orchestrator.md                #   Orchestrator
│   │   ├── implementer.md                 #   TDD orchestration
│   │   ├── tdd-test-writer.md             #   Red phase only
│   │   ├── tdd-implementer.md             #   Green phase only
│   │   ├── tdd-refactorer.md              #   Refactor phase only
│   │   ├── reviewer.md                    #   Code review
│   │   ├── tester.md                      #   Integration/E2E testing
│   │   ├── architect.md                   #   Design decisions
│   │   ├── debugger.md                    #   Debugging specialist
│   │   └── qa-agent.md                    #   Integration coherence (optional)
│   │                                      #   Model routing: see model-routing.md
│   ├── skills/                            # 8 skills (Anthropic Agent Skills format)
│   │   ├── new-feature/                   #   Each skill directory contains:
│   │   │   ├── SKILL.md                   #     YAML frontmatter + 7-section body
│   │   │   └── references/               #     Overflow content (optional)
│   │   ├── bug-fix/
│   │   ├── refactor/
│   │   ├── tdd-workflow/
│   │   ├── api-endpoint/
│   │   ├── db-migration/
│   │   ├── context-engineering/
│   │   └── deployment/                    #   (same structure as new-feature/)
│   ├── protocols/                         # 5 protocols
│   │   ├── tdd-loop.md
│   │   ├── iteration-cycle.md
│   │   ├── code-doc-sync.md
│   │   ├── session-management.md
│   │   └── message-format.md
│   ├── examples/                          # Golden samples + anti-patterns
│   ├── domain-persona.md                  # Domain context for agents (~500 tokens)
│   ├── context-map.md                     # Bounded context mapping (references domain-persona.md)
│   ├── environment.md
│   ├── security.md
│   ├── quality-gates.md
│   ├── error-recovery.md
│   └── observability.md
│
├── hooks/                                 # 6 executable hook scripts
│   ├── session-start-bootstrap.mjs
│   ├── pre-tool-security-gate.mjs
│   ├── pre-tool-doc-sync-check.mjs
│   ├── pre-tool-coverage-gate.mjs
│   ├── post-tool-format.mjs
│   └── post-tool-test-runner.mjs
│
├── scripts/
│   └── update-feature-status.mjs
│
├── _workspace/                            # Intermediate outputs + handoff/ envelopes (Subagent Dispatch coordination)
│   ├── {phase}_{agent}_{artifact}.{ext}   #   Convention: 01_architect_dependencies.md
│   └── handoff/{from}->{to}.md            #   Directed agent-to-agent envelopes
│
└── src/
    └── ...                                # No sub CLAUDE.md — layer rules injected from .claude/context-map.md
```
