---
description: Starts actual development after the harness is ready. Selects the next incomplete feature from feature-list.json and implements it via TDD cycle. Can be run repeatedly.
---

# /start — Start Development

Starts actual development work with the harness in place.

## Prerequisites
- `/setup` must be completed
- `.claude/settings.json`, `.claude/skills/`, `PROGRESS.md`, and `feature-list.json` must exist

## Procedure

### Step 1: Load Harness
1. Load `.claude/agents/orchestrator.md`
2. Receive context provided by SessionStart hook (PROGRESS.md summary, incomplete feature count, last 5 git log entries)
3. Load `.claude/domain-persona.md` for domain context

### Step 2: Determine Mode
- **PROGRESS.md is empty or has no tasks** → First start after Initializer
- **PROGRESS.md has an In Progress task** → Resume interrupted session
  - Check the TDD phase of the In Progress task (Red / Green / Refactor / Verify)
  - Continue from that phase
- **PROGRESS.md has no In Progress tasks** → Proceed with new feature

### Step 3: Select Feature(s)

**Check execution mode** from orchestrator's `metadata.execution-mode` (in `.claude/agents/orchestrator.md`).

#### Sub-agent mode (default):
Select the highest-priority feature with `passes: false` from `feature-list.json`.

#### Agent Team mode:
Analyze module independence among top-priority `passes: false` features. If features are in different modules with no dependencies, select multiple features for parallel development.

**Pre-flight dependency check** before confirming parallel features:
- No shared `tdd_focus` targets between selected features
- No shared `doc_sync` targets that would cause merge conflicts
- No feature dependency chains (feature B depends on feature A's output)
If any dependency detected, fall back to sequential for the dependent pair.

Consider dependencies:
- Start with the most foundational features (auth > profile > order > payment)
- Fix any broken features first
- In Agent Team mode, only parallelize features with no shared dependencies

Report the selected feature(s) to the user:
```
Next feature(s) to work on:
  ID: FEAT-XXX
  Category: {category}
  Description: {description}
  TDD Focus: {tdd_focus}
  Doc Sync: {doc_sync}
  Execution: {Sub-agent | Agent Team (parallel with FEAT-YYY)}

Proceed? (y/n)
```

### Step 4: Execute TDD Cycle

#### Sub-agent mode (default):
Call sub-agents using the Claude Code `Agent` tool with isolated contexts:
- `Agent(implementer)` — orchestrates the TDD cycle
- Within implementer: `Agent(tdd-test-writer)` for Red, `Agent(tdd-implementer)` for Green, `Agent(tdd-refactorer)` for Refactor
- `Agent(reviewer)` for Gate 2

Pass task input (feature ID, tdd_focus, acceptance_criteria, doc_sync targets) as the agent's prompt argument.

Execution flow:

```
Plan (analyze acceptance_criteria)
  ↓
Red: call tdd-test-writer sub-agent
  - Write failing tests (happy/boundary/error)
  - Do not read implementation code
  - Verify: run tests → all FAIL
  ↓
Green: call tdd-implementer sub-agent
  - Write minimal implementation to pass tests
  - Verify: run tests → all PASS
  ↓
Refactor: call tdd-refactorer sub-agent
  - No behavior changes allowed
  - Verify: tests still PASS
  ↓
Verify: full test suite + feature verification
  - On failure, return to Green/Red (max 5 iterations)
  - After 5 iterations, escalate
```

#### Agent Team mode:
Create a team for parallel module development. Each team member runs its own TDD sub-agent cycle.

```
TeamCreate(members: [implementer-a, implementer-b, reviewer, qa-agent?])
  ↓
TaskCreate(FEAT-XXX -> implementer-a, FEAT-YYY -> implementer-b)
  ↓
Each implementer independently:
  Red(tdd-test-writer) → Green(tdd-implementer) → Refactor(tdd-refactorer)
  ↓
Members coordinate via SendMessage (integration points, shared contracts)
  ↓
QA agent verifies cross-boundary consistency after each module TDD completes (if included)
  ↓
Reviewer reviews each module (QA report included in Gate 2 review material)
  ↓
Leader merges results, verifies cross-module consistency
```

**TDD isolation preserved in team mode**: Team communication is for module-level coordination only. `tdd-test-writer` still MUST NOT read implementation code, even via `SendMessage`. The implementer agent remains the information firewall.

**TDD sub-agents are NOT team members**: `tdd-test-writer`, `tdd-implementer`, `tdd-refactorer` are called via `Agent` tool within each implementer's context. They never receive `SendMessage` and are not part of `TeamCreate`. Team members are: implementers (one per module), reviewer, and optionally qa-agent. TDD sub-agents are nested inside each implementer's execution.

**Intermediate outputs**: Written to `_workspace/` with naming convention `{phase}_{agent}_{artifact}.{ext}`.

#### Hybrid mode:
Follow the orchestrator's per-phase mode specification. Switch between sub-agent and team calls as defined.

### Step 5: Confirm Quality Gate Passage
- Gate 0: TDD compliance (evidence: test files, Red → Green call order)
- Gate 1: Implementation complete (evidence: compile/lint/test output)
- Gate 2: Code review (call reviewer agent → 0 Critical/Major issues)
  - If QA agent is included: QA boundary verification report feeds into Gate 2
  - Boundary mismatches are Critical severity (block commit)
- Gate 3: Tests pass (coverage report)
- Gate 4: Deploy approval (feature passes: true ready)

### Step 6: Code-Doc Sync
Update related documents per the mapping table:
- Source changes → related docs/*.md, sub CLAUDE.md
- Feature complete → feature-list.json (passes: true)
- All changes → PROGRESS.md

### Step 7: Single Commit
Stage only changed code, tests, and docs explicitly — never use `git add .` to avoid accidentally staging sensitive files.
```bash
git add {changed source files} {test files} {doc files} feature-list.json PROGRESS.md
git commit -m "feat(FEAT-XXX): {description}"
```

The PreToolUse hook (pre-tool-doc-sync-check.sh) automatically verifies doc sync and blocks the commit if docs are missing.

### Step 8: Ask About Next Feature
Ask the user whether to continue with the next feature:
```
FEAT-XXX complete. Recorded as passes: true in feature-list.json.
Continue with the next feature? (y/n)
```

- y → Return to Step 3 (select next incomplete feature)
- n → End session with report

## Principles
- **One feature per agent at a time** (key Anthropic lesson). Sub-agent mode: one feature total. Agent Team mode: one feature per team member, multiple in parallel across the team.
- Do not auto-proceed without phase-level user confirmation
- On convergence failure (> 5 iterations), suggest switching to debugger
- Only modify the `passes` field in feature-list.json; never add/delete/modify items

## Escalation Conditions
Stop auto-progression and report to the user when:
- Convergence loop exceeds 5 iterations
- Gate 2 finds a Critical issue
- Doc sync hook keeps blocking (see resolution below)
- Test environment setup fails

### Doc Sync Block Resolution
If the doc-sync hook blocks 3+ consecutive commit attempts:
1. List all source files changed and their mapped doc targets
2. Present the mapping to the user
3. Ask: "Update these docs, or commit with `[skip-doc-sync]` in the message?"

The `[skip-doc-sync]` escape hatch is supported by `pre-tool-doc-sync-check.sh`.
