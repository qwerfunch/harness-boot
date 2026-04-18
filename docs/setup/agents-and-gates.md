# Agent Definitions and Quality Gates

## Agent Definitions

### Agent Team Execution & Team Architecture

> Patterns adapted from [revfactory/harness](https://github.com/revfactory/harness) (Apache-2.0). Full reference: `docs/references/agent-design-patterns.md`.

#### Agent Team Execution

harness-boot uses a single execution model: **Agent Team**. The orchestrator creates a team via `TeamCreate`, assigns work via `TaskCreate`/`TaskUpdate`, and members coordinate via `SendMessage`. The team surface is uniform regardless of project size — single-module projects simply register a team of one implementer + reviewer.

#### Team Architecture Patterns

Choose an architecture pattern based on module structure:

| Pattern | Use When | Example |
|---------|----------|---------|
| **Fan-out/Fan-in** | Independent modules, parallel work | Frontend + Backend + Infra teams |
| **Pipeline** | Sequential dependencies | Analysis -> Design -> Implement -> Test |
| **Supervisor** | Dynamic work assignment needed | Feature supervisor distributes to workers |
| **Producer-Reviewer** | Quality assurance critical | Implementer -> Reviewer feedback loops |

> Full pattern descriptions with composite patterns: `docs/references/agent-design-patterns.md`

#### Data Transfer Protocols

Specify in the orchestrator how agents share work products:

| Strategy | Method | Best When |
|----------|--------|-----------|
| **Message** | `SendMessage` | Real-time coordination, lightweight state |
| **Task** | `TaskCreate`/`TaskUpdate` | Progress tracking, dependency management |
| **File** | Write/Read to `_workspace/` | Large data, structured outputs, audit trail |

All three strategies are used together. TDD sub-agents (`tdd-test-writer`, `tdd-implementer`, `tdd-refactorer`, `tdd-bundler`) are invoked via the `Agent` tool inside an implementer's execution — they are not team members and return results directly to the caller.

File-based transfer rules:
- `_workspace/` folder for intermediate outputs
- Convention: `{phase}_{agent}_{artifact}.{ext}`
- Final outputs only to user-specified paths; preserve `_workspace/` for audit trail

#### QA Agent Integration

> Full guide: `docs/references/qa-agent-guide.md`

When the plan has 3+ modules with integration points, generate a QA agent:
- **Model**: opus (boundary verification requires judgment)
- **Type**: `general-purpose` (needs to run verification scripts, not read-only)
- **Core method**: "Read Both Sides Simultaneously" — cross-compare producer output with consumer input at every boundary
- **Timing**: Incremental after each module completion, not just at the end
- **Team membership**: QA agent as permanent team member receiving completion notifications

Add to the generated harness:
- `.claude/agents/qa-agent.md`
- QA step in orchestrator workflow (after module TDD completes, before Gate 2 review)
- Boundary mismatches classified as Critical severity in Gate 2

#### Team Communication Protocol for Agents

**Only agents that actually exchange team messages** add a `## Team Communication Protocol` section: `orchestrator`, module-specific implementers, `reviewer`, and `qa-agent` (when included). `architect`, `debugger`, `tester`, and the `tdd-*` sub-agents (test-writer / implementer / refactorer / bundler) **omit the section** — they are invoked via the `Agent` tool inside an implementer cycle or on escalation, not through team messaging, so a placeholder section would be empty ceremony.

For agents that include the section, it must specify:
- **Receive from**: Who sends what messages
- **Send to**: Who receives what messages
- **Task requests**: What task types from shared task list

> Orchestrator template: `docs/references/orchestrator-template.md`

#### Orchestrator Agent Frontmatter

```yaml
---
name: orchestrator
description: >
  Orchestrates the development workflow. Team formation, task decomposition,
  TDD enforcement, quality gate coordination.
tools: Read, Glob, Grep, Write, Edit, Bash, Agent, TeamCreate, SendMessage, TaskCreate, TaskUpdate
model: opus
---
```

### Common Input/Output

```jsonc
// Input
{ "task_id": "", "type": "feature|bugfix|refactor|test", "description": "",
  "target_files": [], "acceptance_test": [],
  "tdd_focus": [], "doc_sync_targets": [], "feature_id": "FEAT-XXX",
  "domain_context": { "entities": [], "rules": [], "vocabulary": {} } }

// Output
{ "task_id": "", "status": "success|failure|partial|blocked", "iteration_count": 0,
  "changes": { "code": [], "tests": [], "docs": [] },
  "test_results": { "total": 0, "passed": 0, "failed": 0, "coverage": "" },
  "feature_passes": false, "blockers": [], "notes": "" }
```

### Agent Roles

Model assignment per agent is defined once in `model-routing.md`. This table covers role and domain-view only.

| Agent | Core Role | Domain View |
|-------|-----------|-------------|
| **orchestrator** | Initializer/Coding mode switching, task decomposition, tdd_focus/doc_sync assignment, one-at-a-time | Full persona (reads domain-persona.md) |
| **implementer** | Sequential TDD sub-agent calls, convergence loop management (max 5), single commit | Feature-scoped entities + rules (from orchestrator prompt) |
| **reviewer** | 3-stage review: (1) TDD compliance (2) Code quality (3) Doc sync. REJECT if docs missing | Entities + Rules + Vocabulary (inlined in agent MD) |
| **tester** | Core function selection, feedback with expected vs actual values | Success criteria + rules (agent MD section) |
| **architect** | ADR writing, impact doc listing, schema changes require migration + docs together | Full persona (reads domain-persona.md) |
| **debugger** | Root cause analysis, minimal fix, mandatory regression test | Full persona (reads domain-persona.md) |
| **tdd-test-writer** | Red phase only (for `tdd` / `state-verification`). Does not read implementation code | Feature-scoped entities + invariants (from implementer prompt) |
| **tdd-implementer** | Green phase only (for `tdd` / `state-verification`). Minimal implementation | Feature-scoped entities + rules (from implementer prompt) |
| **tdd-refactorer** | Refactor phase (all TDD strategies). No behavior changes | Vocabulary only (from implementer prompt) |
| **tdd-bundler** (conditional) | Bundled Red→Green for `bundled-tdd` features. Single-agent, 2-commit sequence (`[bundled-tdd:red]` → `[bundled-tdd:green]`). Included only when feature-list.json contains at least one `"test_strategy": "bundled-tdd"` entry | Feature-scoped entities + rules (from implementer prompt) |

### Agent Rationalization Defense

Each generated agent MD must include a "Common Rationalizations" section (minimum 2 rows, matching the Skill requirement in `skills-anatomy.md`). Domain-specific rebuttals only — do not pad with generic filler. Examples:

| Agent | Excuse | Rebuttal |
|-------|--------|----------|
| **orchestrator** | "This feature is simple, skip TDD" | All features with tdd_focus use TDD, no exceptions |
| **reviewer** | "Minor change, quick approval" | All changes get full 3-stage review regardless of size |
| **implementer** | "Tests are passing, skip refactor phase" | Refactor is mandatory even if no changes result |
| **debugger** | "I know the fix, skip root cause analysis" | Root cause must be documented; symptom fixes recur |
| **tdd-bundler** | "I'll tweak the test to match the impl — it's easier" | Editing the test after the red commit destroys the red→green evidence; Gate 0 blocks on test-file byte divergence between red and green commits. Abort and restart the cycle instead. |
| **tdd-bundler** | "Skip the red commit, just commit everything at once" | Red commit IS the evidence; without it Gate 0 cannot verify the test was ever failing. The two-commit sequence is non-negotiable for `bundled-tdd`. |

---

## Quality Gates

> "Looks good" is not a passing criterion. Every gate requires **evidence**.

| Gate | Check | Evidence | Rationalization Defense |
|------|-------|----------|------------------------|
| **0: TDD** (prerequisite) | Tests exist for tdd_focus. Behavior varies by `test_strategy` (see below) | Test files, call order logs | "Too simple to need tests" → if tdd_focus specified, no exceptions |
| **1: Implementation** | 0 compile errors, 0 lint errors, all tests pass, docs changes included | tsc/eslint/test output, git diff | "Docs later" → hook blocks commit |
| **2: Review** | 0 Critical/Major issues + **Comment Rules compliance** (see `code-style.md#comment-rules`) | Reviewer feedback (file/line/severity) | "Trivial change, skip review" → all changes are reviewed |
| **3: Testing** | Coverage per `test_strategy` (see below); overall project coverage: no regression | Coverage report, execution logs | — |
| **4: Deploy** | Gates 0-3 pass, feature passes: true, rollback procedure ready | sync-docs pass log | "Worked in staging" → check environment differences |

> Gate 0 not met → Gates 1-4 cannot proceed.

### Gate Behavior by `test_strategy`

| Gate | `tdd` (default) | `bundled-tdd` | `state-verification` | `integration` |
|------|-----------------|---------------|---------------------|---------------|
| **Gate 0** | Full: test files exist, Red → Green order evidence from 3-agent cycle, happy/boundary/error cases | Full tdd_focus coverage + 2-commit red→green sequence (`[bundled-tdd:red]` fails, `[bundled-tdd:green]` passes, test file byte-identical between the two) | Relaxed: test files exist, tests pass, state assertions present | Relaxed: integration test file exists, tests pass |
| **Gate 3** | tdd_focus functions: >= 70% line coverage | tdd_focus functions: >= 70% line coverage (same as `tdd`) | Test files exist for module (no per-function coverage) | Overall file coverage >= 60% |

### Gate 0 Enforcement

The **implementer agent** checks Gate 0 before proceeding to Gate 1:
1. Verify test files exist for each `tdd_focus` item
2. **If `test_strategy` = `"tdd"`**: Verify Red phase produced failing tests (evidence: test runner output with failures), then Green phase made them pass
3. **If `test_strategy` = `"bundled-tdd"`**: Verify the two-commit sequence via git log:
   - A commit whose subject starts with `[bundled-tdd:red]` exists on the current feature branch and its body captures failing test output for the feature's `tdd_focus`.
   - A later commit whose subject starts with `[bundled-tdd:green]` exists and captures passing test output.
   - `git diff <red-sha> <green-sha> -- <test-files>` is empty (test files unchanged between red and green).
   - If any of these fail, Gate 0 fails.
4. **If `test_strategy` = `"state-verification"`**: Verify test files exist and include state assertions (not pixel-level rendering checks)
5. **If `test_strategy` = `"integration"`**: Verify integration test file exists and passes

If Gate 0 fails: return to Red/Implement phase (or restart the bundled cycle). This counts toward the 5-iteration convergence limit.
The **reviewer agent** independently re-checks Gate 0 compliance during Gate 2.

### Gate 2: Comment Rules Compliance

The **reviewer agent** checks Comment Rules (see `code-style.md#comment-rules`) as part of Gate 2:
- **File headers**: Every new source file must have a file header block (purpose, dependencies, related docs)
- **Public function JSDoc**: All exported functions must have JSDoc with parameter descriptions and business logic notes
- **Key constants/types**: Non-obvious constants and type definitions must have explanatory comments
- **Why-comments**: Complex logic, gotchas, and workarounds must have inline "why" comments

Missing comments → Severity: **Major** (does not block commit, but reviewer flags for correction before Gate 2 passes).

### Rollback Procedure (Gate 4 Requirement)

Before marking a feature as `passes: true`, verify:
1. All changes are in a single commit (enables `git revert <sha>`)
2. If a DB migration exists: a corresponding down-migration file must exist
3. If config changes exist: previous values are documented in the commit message

The rollback procedure is: `git revert <feature-commit-sha>` + run down-migrations if applicable.
