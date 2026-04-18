# Orchestrator Template

> Reference adapted from [revfactory/harness](https://github.com/revfactory/harness) (Apache-2.0).

The orchestrator is generated as an agent (`.claude/agents/orchestrator.md`) that coordinates the entire agent team.

---

## Orchestrator Template

harness-boot uses Agent Team execution. The orchestrator creates a team of module-specific implementers, reviewer, and optional qa-agent; members coordinate in parallel via `SendMessage` and shared tasks. Single-module projects use a team of one.

```yaml
---
name: orchestrator
description: >
  Orchestrates the development workflow. Creates and manages agent teams
  for parallel module development with TDD enforcement.
tools: Read, Glob, Grep, Write, Edit, Bash, Agent, TeamCreate, SendMessage, TaskCreate, TaskUpdate
model: opus
---
```

### Workflow

```
Phase 0: Context Check
  |-- Check _workspace/ existence -> determine initial/follow-up/partial re-run
  |-- Load PROGRESS.md, feature-list.json, domain-persona.md
  |
Phase 1: Planning
  |-- Select features for this session (highest priority passes: false)
  |-- Analyze module independence -> decide parallel vs sequential
  |-- Assign features to team members
  |
Phase 2: Team Formation
  |-- TeamCreate(team_name, members=[implementer-a, implementer-b, reviewer])
  |-- TaskCreate(tasks with dependencies)
  |-- Each member loads their agent definition + assigned feature context
  |
Phase 3: Parallel Execution
  |-- Team members run TDD cycles independently (sub-agents for Red/Green/Refactor)
  |-- SendMessage for integration point coordination
  |-- Leader monitors progress, handles escalations
  |
Phase 4: Integration & Review
  |-- Reviewer agent reviews each module
  |-- Leader verifies cross-module consistency
  |-- Code-doc sync verification
  |
Phase 5: Commit & Cleanup
  |-- Single commit per feature (one feature = one commit)
  |-- Update feature-list.json, PROGRESS.md
  |-- Team cleanup
```

### Data Flow

```
[Orchestrator/Leader]
    |
    |-- TeamCreate(members)
    |-- TaskCreate(feature assignments)
    |
    +-- [Implementer A]                    [Implementer B]
    |   |-- Read task assignment            |-- Read task assignment
    |   |-- Agent(tdd-test-writer)          |-- Agent(tdd-test-writer)
    |   |-- Agent(tdd-implementer)          |-- Agent(tdd-implementer)
    |   |-- Agent(tdd-refactorer)           |-- Agent(tdd-refactorer)
    |   |-- SendMessage(to: B, "API contract for shared endpoint")
    |   |                                   |-- SendMessage(to: A, "Acknowledged, using schema X")
    |   |-- Write results to _workspace/    |-- Write results to _workspace/
    |
    +-- [Reviewer]
        |-- Read _workspace/ outputs
        |-- Review each module (Gate 2)
        |-- SendMessage(to: Leader, "Module A: 0 critical, Module B: 1 major")
```

### Error Handling

| Error Type | Strategy | Fallback |
|-----------|----------|----------|
| Member TDD failure (5 iterations) | Escalate to leader -> leader escalates to user | Pause that feature, continue others |
| Member timeout | Leader reassigns task | If persistent, escalate to user |
| Integration conflict | Members discuss via SendMessage | Leader arbitrates if no consensus in 2 rounds |
| Review rejection | Member fixes, re-submits | After 2 rejections, escalate to user |

---

## Data Transfer Protocols

| Strategy | Method | Best When |
|----------|--------|-----------|
| **Message-based** | `SendMessage` between members | Real-time coordination, lightweight state |
| **Task-based** | `TaskCreate`/`TaskUpdate` | Progress tracking, dependency management |
| **File-based** | Write/Read to agreed paths | Large data, structured outputs, audit trail |

**Recommended combination:** Task-based (coordination) + File-based (outputs) + Message-based (real-time). All three are used together; none is optional.

### File-based Transfer Rules

- Create `_workspace/` under project root for intermediate outputs
- Naming convention: `{phase}_{agent}_{artifact}.{ext}` (e.g., `01_architect_dependencies.md`)
- Only final outputs go to user-specified paths; intermediate files stay in `_workspace/`
- Preserve `_workspace/` for audit trail (do not delete after completion)

---

## Team Size Guidelines

| Project Scale | Recommended Team Size | Tasks per Member |
|--------------|----------------------|-----------------|
| Solo (single module) | 1 implementer + reviewer | all features |
| Small (5-10 tasks) | 2-3 | 3-5 |
| Medium (10-20 tasks) | 3-5 | 4-6 |
| Large (20+ tasks) | 5-7 | 4-5 |

> More members = more coordination overhead. 3 focused members outperform 5 unfocused ones. Single-module projects run with a team of one implementer + reviewer — the team surface is uniform across project sizes.

---

## Orchestrator Description: Follow-up Keywords

Include follow-up trigger keywords in orchestrator description to handle subsequent requests:

Must include:
- "resume", "re-run", "update", "modify", "improve"
- "{domain} {sub-task} only"
- "based on previous results", "improve results"

---

## Context Check Phase (Phase 0)

Every orchestrator starts with context check:

- `_workspace/` exists + user requests partial modification -> **Partial re-run** (re-invoke specific agents only)
- `_workspace/` exists + user provides new input -> **New run** (move existing to `_workspace_prev/`)
- `_workspace/` does not exist -> **Initial run**

---

## Test Scenarios (Required)

Every orchestrator agent must include `## Test Scenarios`:

```markdown
## Test Scenarios

### Normal Flow
1. User runs /start with 3 independent features
2. Orchestrator creates team of 2 implementers + 1 reviewer
3. Implementers run TDD cycles in parallel
4. Reviewer reviews each as completed
5. All features pass -> commit per feature

### Error Flow
1. Implementer A fails TDD convergence after 5 iterations
2. Orchestrator pauses feature A, continues feature B
3. Escalates feature A to user with failure summary
4. User provides guidance, orchestrator re-assigns
```
