# Philosophy and Directory Structure

## Core Philosophy

| Principle | Description | Enforcement Mechanism |
|-----------|-------------|----------------------|
| **TDD-First** | Test first → minimal implementation → refactor. Focus on core logic only. | Gate 0 + sub-agent context isolation |
| **Iteration Convergence** | Implement → test → verify → feedback → fix loop. Repeat until convergence. | Max 5 iterations then escalation |
| **Code-Doc Sync** | When code changes, update related docs in the same commit. | **Runtime blocking** via PreToolUse hook |
| **Anti-Rationalization** | Pre-empt agent excuses for skipping steps. | Excuse-rebuttal tables in every skill |

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
│   ├── session-start-bootstrap.sh
│   ├── pre-tool-security-gate.sh
│   ├── pre-tool-doc-sync-check.sh
│   ├── pre-tool-coverage-gate.sh
│   ├── post-tool-format.sh
│   └── post-tool-test-runner.sh
│
├── scripts/
│   └── update-feature-status.sh
│
├── _workspace/                            # Intermediate outputs (Agent Team file-based transfer)
│   └── {phase}_{agent}_{artifact}.{ext}   #   Convention: 01_architect_dependencies.md
│
└── src/
    └── ...                                # No sub CLAUDE.md — layer rules injected from .claude/context-map.md
```
