# Agent Design Patterns

> Reference adapted from [revfactory/harness](https://github.com/revfactory/harness) (Apache-2.0).
> Integrated into harness-boot's TDD-First, Iteration Convergence, Code-Doc Sync, Anti-Rationalization framework.

---

## Agent Team Execution

harness-boot uses a single execution model: **Agent Team**. The team leader creates a team with `TeamCreate`. Members are independent Claude Code instances that communicate directly via `SendMessage` and coordinate through shared task lists (`TaskCreate`/`TaskUpdate`).

```
[Leader] <-> [Member A] <-> [Member B]
  |              |              |
  +------ Shared Task List ----+
```

**Core Tools:**
- `TeamCreate`: Create team + spawn members
- `SendMessage({to: name})`: Direct message to specific member
- `SendMessage({to: "all"})`: Broadcast (expensive, use sparingly)
- `TaskCreate`/`TaskUpdate`: Shared task list management

**Strengths:**
- Members communicate directly (no leader bottleneck)
- Real-time feedback, challenge, and cross-verification between members
- Self-coordination via shared task list
- Idle members automatically notify leader

**Constraints:**
- One active team per session (but teams can be disbanded and reformed between phases)
- No nested teams (members cannot create their own teams)
- Fixed leader (cannot transfer)

**Single-module projects** use a team of one implementer + reviewer. The team surface (TeamCreate, TaskCreate, file-based transfer) is identical regardless of project size; there is no "solo" variant. `SendMessage` is effectively idle when only one implementer exists, but protocols remain uniform.

### TDD Sub-agents are Nested, Not Team Members

`tdd-test-writer`, `tdd-implementer`, `tdd-refactorer`, `tdd-bundler`, and other `Agent`-tool invocations (architect, debugger, tester) are **not team members**. They are called via the `Agent` tool inside an implementer's execution context to preserve TDD isolation (the test-writer must never see implementation code). Team members are: implementers (one per module), reviewer, and optionally qa-agent.

### Team Reformation Pattern

When different phases need different specialist combinations: save current team's outputs to files -> disband team -> create new team. Previous outputs persist in `_workspace/` for the new team to read.

```
1. Current team completes all tasks → outputs in _workspace/02_*.md
2. New TeamCreate replaces current team (auto-dissolution)
   TeamCreate("verification-team", members=["qa-agent", "impl-auth", "impl-task"])
3. New team members reference previous outputs:
   TaskCreate(assignee="qa-agent", description="Verify boundaries. Read _workspace/02_impl_*.md")
```

### Phase Numbering Convention

Files in `_workspace/` use zero-padded phase numbers to maintain ordering:

```
_workspace/
├── 01_architect_analysis.md
├── 02_impl_auth_code.md
├── 02_impl_task_code.md
├── 02_impl_notification_code.md
├── 03_qa_boundary_report.md
└── 04_reviewer_final_review.md
```

---

## Team Architecture Patterns

### 1. Pipeline
Sequential workflow. Each agent's output feeds the next agent's input.

```
[Analyze] -> [Design] -> [Implement] -> [Verify]
```

**Best for:** Stages with strong sequential dependencies.
**Example:** Feature development — requirements analysis -> architecture -> implementation -> testing.
**Watch out:** Bottleneck in any stage delays the entire pipeline.

### 2. Fan-out/Fan-in
Parallel processing with result aggregation. Independent work on the same input from different perspectives.

```
         +-> [Specialist A] --+
[Split]  +-> [Specialist B] --+-> [Merge]
         +-> [Specialist C] --+
```

**Best for:** Same input analyzed from different domains/perspectives simultaneously.
**Example:** Multi-module development — frontend team + backend team + infra team working in parallel -> integration.
**Watch out:** Merge stage quality determines overall quality.
**Notes:** Most natural pattern for Agent Teams. Members share discoveries in real-time; one member's finding can redirect another's approach.

### 3. Expert Pool
Route to the appropriate specialist based on input type.

```
[Router] -> { Expert A | Expert B | Expert C }
```

**Best for:** Different processing needed per input type.
**Example:** Code review — security / performance / architecture experts invoked based on change type.

### 4. Producer-Reviewer
Generator and verifier work as a pair.

```
[Produce] -> [Review] -> (issues?) -> [Produce] retry
```

**Best for:** Quality assurance with objective verification criteria.
**Example:** TDD — test-writer produces -> implementer verifies -> reviewer checks.
**Watch out:** Set max retries (2-3) to prevent infinite loops.
**Notes:** `SendMessage` enables real-time producer<->reviewer feedback between team members.

### 5. Supervisor
Central agent manages state and dynamically distributes work to workers.

```
         +-> [Worker A]
[Super]  +-> [Worker B]    <- Supervisor monitors and dynamically assigns
         +-> [Worker C]
```

**Best for:** Variable workload or runtime work distribution decisions.
**Example:** Large-scale feature development — supervisor analyzes feature list, assigns batches to workers based on progress.
**Difference from Fan-out:** Fan-out pre-assigns work; Supervisor adjusts dynamically based on progress.
**Notes:** The shared task list naturally matches this pattern. `TaskCreate` for work registration, members self-assign.

### 6. Hierarchical Delegation
Upper agents recursively delegate to lower agents.

```
[Lead] -> [Team Lead A] -> [Worker A1]
                        -> [Worker A2]
       -> [Team Lead B] -> [Worker B1]
```

**Best for:** Problems that naturally decompose hierarchically.
**Example:** Full-stack app — Lead -> Frontend Lead -> (UI/Logic/Tests) + Backend Lead -> (API/DB/Tests).
**Watch out:** Beyond 3 levels, latency and context loss increase. Keep to 2 levels.
**Constraint:** Teams don't nest. Implement level 1 as team, level 2 as `Agent`-tool calls within each member's execution. Or flatten into a single team.

---

## Composite Patterns

Real projects often combine patterns:

| Composite | Components | Example |
|-----------|-----------|---------|
| **Fan-out + Producer-Reviewer** | Parallel production, each verified | Multi-module dev — parallel module implementation, each with TDD review |
| **Pipeline + Fan-out** | Sequential stages with parallel sub-stages | Analysis (sequential) -> Implementation (parallel modules) -> Integration test (sequential) |
| **Supervisor + Expert Pool** | Supervisor dynamically routes to specialists | Feature development — supervisor assigns features, routes to appropriate domain experts |

---

## Agent Separation Criteria

| Criterion | Separate | Merge |
|-----------|----------|-------|
| Expertise | Different domains -> separate | Overlapping domains -> merge |
| Parallelism | Can run independently -> separate | Sequential dependency -> consider merging |
| Context | Heavy context burden -> separate | Light and fast -> merge |
| Reusability | Used by other teams -> separate | This team only -> consider merging |

---

## Agent Definition Structure

The `## Team Communication Protocol` section is added **only to agents that exchange team messages** (orchestrator, module implementers, reviewer, qa-agent). Non-communicating agents (architect, debugger, tester, tdd-*) omit the section — they are invoked via `Agent` tool, not team messaging, so a placeholder would be empty ceremony. The template below shows the section for communicating agents:

```markdown
---
name: agent-name
description: "1-2 sentence role description."
tools: Read, Glob, Grep, Write, Edit, Bash
model: {opus|sonnet}
---

# Agent Name — Role Summary

## Core Role
1. Role 1
2. Role 2

## Working Principles
- Principle 1
- Principle 2

## Input/Output Protocol
- Input: [what from where]
- Output: [what to where]
- Format: [file format, structure]

## Team Communication Protocol  # communicating agents only
- Receive from: [who sends what messages]
- Send to: [who receives what messages]
- Task requests: [what types of tasks from shared task list]

## Error Handling
- [On failure behavior]
- [On timeout behavior]

## Common Rationalizations
| Excuse | Rebuttal |
|--------|----------|
| "..." | ... |
```

---

## Skill <-> Agent Connection

| Method | Implementation | When to Use |
|--------|---------------|-------------|
| **Skill tool call** | Agent prompt says "Call /skill-name via Skill tool" | Skill is an independent workflow, user-callable |
| **Inline in prompt** | Agent definition includes skill content directly | Skill is short (<50 lines) and agent-specific |
| **Reference load** | `Read` skill's references/ files on demand | Skill content is large and conditionally needed |

Recommendation: High reuse -> Skill tool call. Agent-specific -> Inline. Large content -> Reference load.

---

## Integration with harness-boot TDD Framework

### TDD Isolation Preserved
Agent Teams enable richer collaboration but **TDD context isolation must be maintained**:
- `tdd-test-writer` still MUST NOT read implementation code (even via `SendMessage`)
- Team communication is for coordination (progress, blockers, integration points), not for sharing implementation details with test writers
- The implementer agent acts as the information firewall between test-writer and tdd-implementer

### Multi-Module Parallel TDD
When modules are independent, the team runs parallel TDD cycles:

```
[Orchestrator/Leader]
    |-- TeamCreate(module-a-impl, module-b-impl, reviewer)
    |-- TaskCreate(FEAT-001 for module-a-impl, FEAT-002 for module-b-impl)
    |-- Each implementer runs its own TDD sub-agent cycle independently
    |-- Members share integration points via SendMessage
    |-- Reviewer reviews each module as it completes
    +-- Leader merges results
```

**Constraint:** Each team member's TDD cycle still uses sub-agents (`Agent` tool) for Red/Green/Refactor isolation. Team communication operates at the module coordination level, not within TDD phases.

### Code-Doc Sync
- Each team member is responsible for doc sync of their assigned modules
- The `pre-tool-doc-sync-check.sh` hook still blocks commits with missing docs
- Leader verifies cross-module doc consistency before final merge
