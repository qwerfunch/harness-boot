# Agent Design Patterns

> Reference adapted from [revfactory/harness](https://github.com/revfactory/harness) (Apache-2.0).
> Integrated into harness-boot's TDD-First, Iteration Convergence, Code-Doc Sync, Anti-Rationalization framework.

---

## Execution Modes: Agent Team vs Sub-agent

Two execution modes exist for multi-agent collaboration. The choice impacts how agents communicate, share work products, and coordinate.

### Agent Team — Baseline Default (Recommended for 2+ Independent Modules)

Team leader creates a team with `TeamCreate`. Members are independent Claude Code instances that communicate directly via `SendMessage` and coordinate through shared task lists (`TaskCreate`/`TaskUpdate`).

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
- Higher token cost

**Team Reformation Pattern:**
When different phases need different specialist combinations: save current team's outputs to files -> disband team -> create new team. Previous outputs persist in `_workspace/` for the new team to read.

### Sub-agent — Sequential Fallback (Single-Module or Tightly-Coupled Plans)

Main agent creates sub-agents via `Agent` tool. Sub-agents return results only to the main agent and cannot communicate with each other.

```
[Main] -> [Sub A] -> result
       -> [Sub B] -> result
       -> [Sub C] -> result
```

**Core Tool:**
- `Agent(prompt, subagent_type, run_in_background)`: Create sub-agent

**Strengths:**
- Lightweight and fast
- Results summarized into main context
- Token-efficient

**Constraints:**
- No inter-agent communication
- Main agent handles all coordination
- No real-time collaboration

### Mode Selection Decision Tree

```
Are there 2+ independent modules to develop?
|-- Yes -> Agent Team (default)
|          Parallel development, real-time cross-module coordination.
|          Downgrade to Sub-agent only if modules share so much state that
|          team communication cost would outweigh parallelism benefit.
|
+-- No (single module / tightly coupled / prototype / spike) -> Sub-agent
                         Sequential fallback, no team overhead.
```

> **Core principle:** **Agent Team is the baseline default** for multi-module plans; downgrade to Sub-agent when communication overhead outweighs parallelism benefit (single module, tightly-coupled feature set, prototype/spike with 1-2 features). When choosing Sub-agent over Agent Team, document the reason in the orchestrator's `metadata.execution-mode-rationale` frontmatter field so future maintainers understand the downgrade. See setup-guide.md Section 9.0 for the full decision criteria table.

### Hybrid Mode

Mix modes per phase when phase characteristics differ significantly:

- **Parallel collection (sub) -> Consensus integration (team)**: Sub-agents collect independent data in parallel -> Team discusses and integrates
- **Team creation (team) -> Verification (sub)**: Team produces draft -> Single sub-agent independently verifies
- **Per-phase team reformation**: `TeamDelete` + new `TeamCreate` between phases, with sub-agent calls inserted at transitions

When using hybrid, specify the execution mode at the top of each phase in the orchestrator.

### Hybrid Mode Decision Criteria

Use this decision tree to determine whether Hybrid mode is appropriate, and how to assign modes per phase.

#### When to Choose Hybrid

```
Does the project have phases with fundamentally different parallelism needs?
|
|-- Yes -> Are some phases parallel AND some strictly sequential?
|          |
|          |-- Yes -> Do parallel phases have 3+ independent modules?
|          |          |-- Yes -> Hybrid (team for parallel, sub for sequential)
|          |          +-- No  -> Sub-agent is sufficient for everything
|          |
|          +-- No  -> Single mode (Agent Team or Sub-agent)
|
+-- No  -> Single mode (Agent Team or Sub-agent)
```

#### Concrete Conditions for Hybrid

Choose Hybrid when **all three** conditions are met:

| # | Condition | Example |
|---|-----------|---------|
| 1 | Project has distinct phases with different parallelism profiles | Analysis (sequential) → Implementation (parallel) → Integration testing (sequential) |
| 2 | At least one phase benefits from Agent Team (3+ independent work units) | 4 modules can be implemented in parallel |
| 3 | At least one phase requires strict sequencing (shared state, coordination) | Integration testing must run after all modules complete; DB migration must be sequential |

If only conditions 1+2 are met → Agent Team (team handles sequencing internally).
If only conditions 1+3 are met → Sub-agent (no parallel phase to justify team overhead).

#### Per-Phase Mode Assignment

| Phase Characteristic | Assign Mode | Reason |
|---------------------|-------------|--------|
| Independent module implementation | **Agent Team** | Parallel TDD cycles, real-time cross-module coordination |
| Sequential dependency chain (A → B → C) | **Sub-agent** | No benefit from team; sub-agent is faster and cheaper |
| Gathering independent analyses | **Sub-agent** | No inter-agent communication needed; just collect results |
| Cross-module integration testing | **Agent Team** | QA agent + module owners need real-time communication |
| Final review / merge | **Sub-agent** | Single reviewer, no coordination needed |
| Architecture analysis / planning | **Sub-agent** | Single architect, sequential reasoning |

#### Hybrid Orchestrator Template

The orchestrator must declare the mode per phase explicitly:

```markdown
## Phase Execution Plan

### Phase 1: Architecture Analysis — Mode: Sub-agent
  Agent(architect): Analyze module boundaries, define interfaces

### Phase 2: Parallel Implementation — Mode: Agent Team
  TeamCreate(impl-auth, impl-task, impl-notification, reviewer, qa-agent)
  Each member runs TDD cycle independently

### Phase 3: Integration Testing — Mode: Agent Team
  TeamCreate(qa-agent, impl-auth, impl-task) for cross-boundary verification

### Phase 4: Final Review — Mode: Sub-agent
  Agent(reviewer): Final consolidated review
```

#### Common Hybrid Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|-------------|---------|------------------|
| Team for everything | Wasted tokens on sequential phases | Use sub-agent for analysis, review, planning |
| Sub-agent for everything | Missed parallelism opportunities | Use team when 2+ modules are independent (harness-boot's baseline default) |
| Switching modes within a phase | Coordination overhead, state loss | One mode per phase; switch only at phase boundaries |
| Team with only 2 members | Team overhead exceeds benefit | Sub-agent with background execution is sufficient |

### Phase Transition Mechanism

In Hybrid mode, the orchestrator switches between Sub-agent and Agent Team at phase boundaries. All transitions use `_workspace/` as the state transfer medium.

#### Sub-agent → Agent Team Transition

```
1. Sub-agent writes results to _workspace/
   Agent(architect, prompt="... Write output to _workspace/01_architect_analysis.md")
   → Wait for completion

2. Orchestrator reads results and plans team
   Read _workspace/01_architect_analysis.md
   → Extract module list, dependency map, interface contracts

3. Create team with module-specific members
   TeamCreate("impl-team", members=["impl-auth", "impl-task", "impl-notification", "reviewer"])

4. Assign tasks referencing previous phase output
   TaskCreate(assignee="impl-auth", description="Implement auth module. Read _workspace/01_architect_analysis.md for interface contracts.")
   TaskCreate(assignee="impl-task", description="Implement task module. Read _workspace/01_architect_analysis.md for interface contracts.")
```

#### Agent Team → Sub-agent Transition

```
1. Verify all team tasks are complete
   All TaskUpdate status == "completed"
   All members have written outputs to _workspace/02_impl_*.md

2. Team auto-dissolves (one active team per session)
   No explicit TeamDelete needed — creating a new team or calling Agent() after team completes is sufficient

3. Call sub-agent with references to team outputs
   Agent(reviewer, prompt="Review all module implementations. Read:
     - _workspace/02_impl_auth_code.md
     - _workspace/02_impl_task_code.md
     - _workspace/02_impl_notification_code.md
   Check cross-module consistency.")
```

#### Agent Team → Agent Team Transition (Team Reformation)

```
1. Current team completes all tasks → outputs in _workspace/02_*.md
2. New TeamCreate replaces current team (auto-dissolution)
   TeamCreate("verification-team", members=["qa-agent", "impl-auth", "impl-task"])
3. New team members reference previous outputs:
   TaskCreate(assignee="qa-agent", description="Verify boundaries. Read _workspace/02_impl_*.md")
```

#### State Transfer Rules

| Method | When | Format | Size Limit |
|--------|------|--------|------------|
| `_workspace/` files | Every phase transition (mandatory) | `{NN}_{agent}_{artifact}.{ext}` (NN = phase number) | No hard limit; keep under 10KB per file |
| Agent prompt injection | Lightweight context summary | Plain text, < 500 tokens | Summaries only, not full outputs |
| PROGRESS.md | Session recovery (crash/interrupt) | `current_phase: N, mode: sub-agent\|agent-team` | Updated by orchestrator at each transition |

#### Phase Numbering Convention

Files in `_workspace/` use zero-padded phase numbers to maintain ordering:

```
_workspace/
├── 01_architect_analysis.md        # Phase 1 (Sub-agent)
├── 01_explore_structure.md         # Phase 1 (Sub-agent)
├── 02_impl_auth_code.md            # Phase 2 (Agent Team)
├── 02_impl_task_code.md            # Phase 2 (Agent Team)
├── 02_impl_notification_code.md    # Phase 2 (Agent Team)
├── 03_qa_boundary_report.md        # Phase 3 (Agent Team)
└── 04_reviewer_final_review.md     # Phase 4 (Sub-agent)
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
**Team mode fit:** Limited benefit since work is sequential. Useful when parallel sub-stages exist within a pipeline stage.

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
**Team mode fit:** Most natural pattern for Agent Teams. Members share discoveries in real-time, one member's finding can redirect another's approach. **Always use Agent Team for this pattern.**

### 3. Expert Pool
Route to the appropriate specialist based on input type.

```
[Router] -> { Expert A | Expert B | Expert C }
```

**Best for:** Different processing needed per input type.
**Example:** Code review — security / performance / architecture experts invoked based on change type.
**Team mode fit:** Sub-agent is more suitable. Only needed experts are invoked.

### 4. Producer-Reviewer
Generator and verifier work as a pair.

```
[Produce] -> [Review] -> (issues?) -> [Produce] retry
```

**Best for:** Quality assurance with objective verification criteria.
**Example:** TDD — test-writer produces -> implementer verifies -> reviewer checks.
**Watch out:** Set max retries (2-3) to prevent infinite loops.
**Team mode fit:** Agent Team is useful. `SendMessage` enables real-time producer<->reviewer feedback.

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
**Team mode fit:** Agent Team's shared task list naturally matches the Supervisor pattern. `TaskCreate` for work registration, members self-assign.

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
**Team mode fit:** Agent Teams don't support nesting. Implement level 1 as team, level 2 as sub-agents. Or flatten into a single team.

---

## Composite Patterns

Real projects often combine patterns:

| Composite | Components | Example |
|-----------|-----------|---------|
| **Fan-out + Producer-Reviewer** | Parallel production, each verified | Multi-module dev — parallel module implementation, each with TDD review |
| **Pipeline + Fan-out** | Sequential stages with parallel sub-stages | Analysis (sequential) -> Implementation (parallel modules) -> Integration test (sequential) |
| **Supervisor + Expert Pool** | Supervisor dynamically routes to specialists | Feature development — supervisor assigns features, routes to appropriate domain experts |

### Composite Patterns and Execution Modes

**Default: Agent Team for all composites.** Active inter-member communication is the key quality driver.

| Scenario | Recommended Mode | Reason |
|----------|-----------------|--------|
| **Multi-module parallel dev** | Agent Team | Module teams share discoveries, flag integration issues early |
| **Design + Implement + Review** | Agent Team | Designer<->Implementer<->Reviewer feedback loops |
| **Supervisor + Workers** | Agent Team | Shared task list for dynamic assignment, workers share progress |
| **Produce + Review** | Agent Team | Real-time feedback minimizes rework |

---

## Agent Separation Criteria

| Criterion | Separate | Merge |
|-----------|----------|-------|
| Expertise | Different domains -> separate | Overlapping domains -> merge |
| Parallelism | Can run independently -> separate | Sequential dependency -> consider merging |
| Context | Heavy context burden -> separate | Light and fast -> merge |
| Reusability | Used by other teams -> separate | This team only -> consider merging |

---

## Agent Definition Structure (Team Mode Extension)

When Agent Team mode is selected, the `## Team Communication Protocol` section is added **only to agents that exchange team messages** (orchestrator, module implementers, reviewer, qa-agent). Non-communicating agents (architect, debugger, tester, tdd-*) omit the section — they are invoked via `Agent` tool, not team messaging, so a placeholder would be empty ceremony. The template below shows the section for communicating agents:

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

## Team Communication Protocol (Agent Team mode only)
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

When using Agent Team mode with harness-boot's TDD workflow:

### TDD Isolation Preserved
Agent Teams enable richer collaboration but **TDD context isolation must be maintained**:
- `tdd-test-writer` still MUST NOT read implementation code (even via `SendMessage`)
- Team communication is for coordination (progress, blockers, integration points), not for sharing implementation details with test writers
- The implementer agent acts as the information firewall between test-writer and tdd-implementer

### Multi-Module Parallel TDD
When modules are independent, Agent Team enables parallel TDD cycles:

```
[Orchestrator/Leader]
    |-- TeamCreate(module-a-impl, module-b-impl, reviewer)
    |-- TaskCreate(FEAT-001 for module-a-impl, FEAT-002 for module-b-impl)
    |-- Each implementer runs its own TDD sub-agent cycle independently
    |-- Members share integration points via SendMessage
    |-- Reviewer reviews each module as it completes
    +-- Leader merges results
```

**Constraint:** Each team member's TDD cycle still uses sub-agents (Agent tool) for Red/Green/Refactor isolation. Team communication operates at the module coordination level, not within TDD phases.

### Code-Doc Sync in Team Mode
- Each team member is responsible for doc sync of their assigned modules
- The `pre-tool-doc-sync-check.sh` hook still blocks commits with missing docs
- Leader verifies cross-module doc consistency before final merge
