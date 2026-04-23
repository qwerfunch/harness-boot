# Agent Design Patterns

> Reference adapted from [revfactory/harness](https://github.com/revfactory/harness) (Apache-2.0).
> Integrated into harness-boot's TDD-First, Iteration Convergence, Code-Doc Sync, Anti-Rationalization framework.

> **Execution model: Subagent Dispatch.** harness-boot dispatches agents via the
> Claude Code `Agent` tool (`Agent(subagent_type=<slug>, prompt=...)`). Coordination
> happens through file envelopes under `_workspace/handoff/` and `PROGRESS.md`, not
> through `TeamCreate` / `SendMessage` / `TaskCreate`. See
> `execution-model-divergence.md` for why we diverged from the upstream Agent Team model.

---

## Subagent Dispatch Execution

The orchestrator agent is the only durable coordination point. For each phase of work it
calls `Agent(subagent_type=<agent-name>, prompt=<instructions + context paths>)`,
reads the resulting artifact from `_workspace/`, and dispatches the next agent with the
artifact path threaded into its prompt.

```
[Orchestrator]
    |-- Agent(subagent_type="implementer-auth",  prompt="FEAT-001 ... read _workspace/...")
    |-- Agent(subagent_type="implementer-task",  prompt="FEAT-002 ... read _workspace/...")
    |        ^ parallel: multiple Agent tool_use blocks in one response
    |
    |-- (both complete, write _workspace/handoff/impl-auth->reviewer.md etc.)
    |
    |-- Agent(subagent_type="reviewer", prompt="Review FEAT-001 & FEAT-002, read _workspace/handoff/*")
    |-- (reviewer writes _workspace/review/{feature}.md)
    |
    +-- Orchestrator reads reviews, updates PROGRESS.md, moves to commit.
```

**Core tools:**
- `Agent(subagent_type=<slug>, prompt=...)`: invoke a subagent by its frontmatter `name` field.
- `Write` / `Read`: produce and consume `_workspace/` artifacts.
- Multiple `Agent` tool_use blocks in a single orchestrator response = parallel dispatch.

**Strengths:**
- Universally available. No experimental flag required.
- Each `Agent` call forks a fresh context, preserving TDD isolation at the tool level.
- All coordination is observable: every handoff is a file in `_workspace/` (audit trail).
- Parallel dispatch is the Claude Code canonical pattern.

**Constraints:**
- Coordination is turn-based (orchestrator -> dispatch -> wait -> read -> dispatch).
  Two subagents cannot exchange messages while both are alive. In practice harness-boot
  never needed that; all plugin handoffs are already turn-based.
- Hierarchical delegation is bounded to 2 levels (orchestrator -> specialist -> leaf),
  matching revfactory's original guidance. Deeper nesting is discouraged; flatten instead.

**Single-module projects** dispatch an `implementer-<module>` then a `reviewer` — the
same dispatch surface as multi-module, just with one implementer call.

### TDD / BDD Sub-agents are Leaf Calls

`tdd-implementer`, `tdd-refactorer`, `bdd-writer`, `tdd-test-writer` (when generated), and
other single-shot specialists (architect, debugger, tester) are **leaf calls** from within
an implementer's execution — they preserve isolation (the test-writer never sees
implementation code; the bdd-writer never sees implementation code). The implementer
itself is dispatched by the orchestrator; it then invokes leaves with its own `Agent` tool.
This is the 2-level hierarchy.

### Phase Handoff via File Envelopes

Artifacts in `_workspace/` use zero-padded phase numbers to maintain ordering:

```
_workspace/
├── 01_architect_analysis.md
├── 02_impl_auth_code.md
├── 02_impl_task_code.md
├── 02_impl_notification_code.md
├── 03_qa_boundary_report.md
├── 04_reviewer_final_review.md
└── handoff/
    ├── impl-auth->reviewer.md            # producer writes, reviewer reads
    ├── reviewer->impl-auth.md            # review-result back to producer
    └── qa-agent->orchestrator.md
```

An envelope file starts with YAML frontmatter (`from`, `to`, `feature_id`, `phase`,
`kind`, `status`) and a body. See `docs/templates/agents/rules/06-message-format.md` for
the schema.

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
**Notes:** Most natural pattern for Subagent Dispatch — the orchestrator emits parallel `Agent` tool_use blocks, each subagent writes its findings to `_workspace/`, and a synthesis call reads all of them. If one subagent's finding should redirect another's approach, surface it via the handoff envelope and re-dispatch in a follow-up phase.

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
**Notes:** Producer writes to `_workspace/handoff/{producer}->reviewer.md`; reviewer reads it, writes `_workspace/handoff/reviewer->{producer}.md` with a verdict; orchestrator re-dispatches producer with the verdict path if changes are requested.

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
**Notes:** The orchestrator owns the pending-work queue — typically `feature-list.json` filtered by `passes: false` and satisfied `depends_on`. On each pass it picks the next batch and dispatches. `PROGRESS.md` records what was assigned and its result.

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
**Constraint:** Subagent Dispatch keeps level 1 as orchestrator -> specialist (e.g. `implementer-<module>`), level 2 as `Agent`-tool calls that the specialist issues to its own leaves (e.g. `tdd-test-writer`). Deeper nesting should flatten: hoist leaves to the orchestrator's direct dispatch or restructure the problem.

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

The `## Handoff Protocol` section is added **only to agents that exchange handoff envelopes**
(orchestrator, module implementers, reviewer, qa-agent). Non-communicating leaves
(architect, debugger, tester, tdd-*, bdd-writer) omit the section — they are invoked via
the `Agent` tool and return their result inline or via a single output file, so no envelope
schema applies. The template below shows the section for communicating agents:

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
- Input: [what the orchestrator passes in the prompt, plus `_workspace/...` paths]
- Output: [what to write to `_workspace/<phase>_<artifact>.md` before exiting]
- Format: [envelope schema, body structure]

## Handoff Protocol  # communicating agents only
- Reads from: [which `_workspace/handoff/*->{this-agent}.md` envelopes]
- Writes to: [which `_workspace/handoff/{this-agent}->*.md` envelopes]
- Re-dispatch triggers: [which envelope kinds cause the orchestrator to re-call this agent]

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
Subagent Dispatch preserves TDD context isolation at the tool level — each `Agent` call
forks a fresh context, so leaks are structurally impossible when the dispatch is clean:
- `tdd-test-writer` MUST NOT receive implementation code in its prompt or as a context path
- The implementer agent acts as the information firewall: it composes prompts for its
  `tdd-*` leaves and decides what paths to include
- Handoff envelopes between implementer and reviewer carry artifact references, not raw
  implementation snippets, so even reviewer comments flowing back do not leak to leaves

### Multi-Module Parallel TDD
When modules are independent (no shared `tdd_focus`, no shared `doc_sync`, no depends_on between them),
the orchestrator dispatches implementers in parallel:

```
[Orchestrator]
    |-- Single response containing multiple Agent tool_use blocks:
    |     Agent(subagent_type="implementer-module-a", prompt="FEAT-001, write to _workspace/02_impl_module-a_*.md")
    |     Agent(subagent_type="implementer-module-b", prompt="FEAT-002, write to _workspace/02_impl_module-b_*.md")
    |
    |-- Each implementer runs its own TDD sub-agent cycle:
    |     Agent(subagent_type="tdd-test-writer", ...)   # leaf
    |     Agent(subagent_type="tdd-implementer", ...)   # leaf
    |     Agent(subagent_type="tdd-refactorer", ...)    # leaf
    |
    |-- Integration points coordinated via handoff envelopes, not mid-execution messages.
    |     If module-a needs an API shape decision from module-b, that is a separate
    |     orchestrator-dispatched coordination round, not a mid-execution exchange.
    |
    +-- Orchestrator dispatches reviewer after all implementers return.
```

**Constraint:** Within an implementer, TDD leaves still run as `Agent`-tool calls for
Red/Green/Refactor isolation. Cross-module coordination happens at orchestrator-dispatch
boundaries, never inside an in-flight agent.

### Code-Doc Sync
- Each implementer is responsible for doc sync of its assigned modules
- The `pre-tool-doc-sync-check.mjs` hook blocks commits with missing docs
- The reviewer verifies cross-module doc consistency in its Gate 2 pass before the final commit
