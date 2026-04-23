# Orchestrator Template

> Reference adapted from [revfactory/harness](https://github.com/revfactory/harness) (Apache-2.0).

The orchestrator is generated as an agent (`.claude/agents/orchestrator.md`) that coordinates the entire agent team.

---

## Orchestrator Template

harness-boot uses **Subagent Dispatch** execution (see `execution-model-divergence.md`).
The orchestrator dispatches module-specific implementers, reviewer, and optional qa-agent
via `Agent(subagent_type=<slug>)`. Parallel work uses multiple `Agent` tool_use blocks in a
single response; handoffs go through `_workspace/handoff/` files.

```yaml
---
name: orchestrator
description: >
  Orchestrates the development workflow. Dispatches module-specific implementers,
  reviewer, and qa-agent; coordinates them via _workspace/ file envelopes with TDD
  and quality-gate enforcement.
tools: Read, Glob, Grep, Write, Edit, Bash, Agent
model: opus
---
```

### Workflow

```
Phase 0: Context Check
  |-- Check _workspace/ existence -> determine initial/follow-up/partial re-run
  |-- Load PROGRESS.md, feature-list.json, domain-persona.md
  |
Phase 1: Planning (see `commands/start.md` anchor `feature-selection-algorithm` for the authoritative algorithm)
  |-- Collect all passes:false features whose depends_on is satisfied (every dep has passes:true)
  |-- Drop any pair that shares tdd_focus target OR doc_sync path (merge-conflict risk)
  |-- Drop any pair where one appears in the other's depends_on (direct or transitive)
  |-- What remains is THIS SESSION'S PARALLEL WAVE — not a single feature
  |-- Exception: single-module project (module_count == 1) → one implementer at a time
  |-- Assign each wave feature to its owning module's implementer-<slug>
  |
Phase 2: Parallel Dispatch
  |-- One orchestrator response emits N `Agent` tool_use blocks (one per wave feature):
  |     Agent(subagent_type="implementer-<slug>", prompt="FEAT-xxx ... write to _workspace/02_impl_<slug>_<feature>.md")
  |-- Each implementer has its own prompt context; it invokes its own `Agent` leaves
  |   (tdd-test-writer / tdd-implementer / tdd-refactorer / bdd-writer) for Red/Green/Refactor isolation
  |
Phase 3: Integration Coordination (as needed)
  |-- If a wave feature needs a shared-contract decision, the implementer writes
  |     _workspace/handoff/<from>->orchestrator.md with kind=coordinate and exits
  |-- Orchestrator reads the coordinate envelope and dispatches a second-round call
  |     to the counterparty implementer (or a negotiation round between both)
  |-- No mid-execution messaging between live subagents
  |
Phase 4: Review
  |-- Agent(subagent_type="reviewer", prompt="Gate 2 review ... read _workspace/02_impl_*.md and handoff/*")
  |-- If qa-agent is configured: Agent(subagent_type="qa-agent", prompt="Cross-module boundary verification")
  |-- Reviewer writes _workspace/handoff/reviewer->implementer-<slug>.md per rejection
  |-- Orchestrator re-dispatches rejected implementers with the reviewer's verdict path
  |
Phase 5: Commit & Cleanup
  |-- Single commit per feature (one feature = one commit)
  |-- node scripts/update-feature-status.mjs FEAT-xxx   (flips passes: true)
  |-- Update PROGRESS.md
  |-- _workspace/ is preserved for audit; never deleted during a session
```

### Data Flow

```
[Orchestrator]
    |
    |-- single response with parallel Agent tool_use blocks:
    |     Agent(subagent_type="implementer-a",  prompt="FEAT-001, write _workspace/02_impl_a_*.md")
    |     Agent(subagent_type="implementer-b",  prompt="FEAT-002, write _workspace/02_impl_b_*.md")
    |
    +-- [Implementer A]                          [Implementer B]
    |   |-- Agent(tdd-test-writer)                |-- Agent(tdd-test-writer)
    |   |-- Agent(tdd-implementer)                |-- Agent(tdd-implementer)
    |   |-- Agent(tdd-refactorer)                 |-- Agent(tdd-refactorer)
    |   |-- Write _workspace/02_impl_a_*.md       |-- Write _workspace/02_impl_b_*.md
    |   |   (if API contract needed with B:       |
    |   |    write handoff/impl-a->orchestrator.md
    |   |    with kind=coordinate, exit)          |
    |
    |-- (both return) Orchestrator reads _workspace/, handles coordinate envelopes
    |   with a second-round dispatch if any implementer requested one.
    |
    +-- Agent(subagent_type="reviewer", prompt="Gate 2 ... read _workspace/02_impl_*.md")
        |-- Reviewer writes _workspace/03_reviewer_<feature>.md per module
        |-- For critical-reject: also writes handoff/reviewer->implementer-<slug>.md
        |
    +-- Orchestrator re-dispatches rejected implementers with verdict path;
        updates PROGRESS.md; proceeds to per-feature commits.
```

### Error Handling

| Error Type | Strategy | Fallback |
|-----------|----------|----------|
| Implementer TDD failure (5 iterations) | Implementer writes handoff with kind=escalate; orchestrator escalates to user | Pause that feature, continue others |
| Implementer timeout or stuck leaf | Orchestrator re-dispatches with tightened prompt and explicit blocker | If persistent, escalate to user |
| Integration conflict | Implementer writes handoff with kind=coordinate; orchestrator runs a negotiation round | After 2 rounds without resolution, orchestrator arbitrates |
| Review rejection | Orchestrator re-dispatches implementer with the reviewer envelope path | After 2 rejections, escalate to user |

---

## Data Transfer Protocols

| Channel | Location | Best When |
|---------|----------|-----------|
| **Artifact files** | `_workspace/{phase}_{agent}_{artifact}.{ext}` | Work products (code references, review findings, QA reports) — the main deliverable of each dispatch |
| **Handoff envelopes** | `_workspace/handoff/{from}->{to}.md` | Directed agent-to-agent signals (review verdicts, coordination requests, escalations) |
| **Progress state** | `PROGRESS.md` + `feature-list.json` | Per-feature progress, `passes` flag, iteration counters |

**Rules of combination:**
- Every subagent produces at least one artifact file per dispatch (Phase 2 artifacts live under `{phase}_...`; handoff signals live under `handoff/`).
- An envelope's `from` is always the agent that wrote it; `to` is either another agent slug or `orchestrator`.
- The orchestrator is the only agent that consults `PROGRESS.md` for state decisions — subagents read their inputs from the prompt + referenced files, never by scanning progress state themselves.

### File-based Transfer Rules

- Create `_workspace/` under project root for intermediate outputs
- Artifact naming: `{phase}_{agent}_{artifact}.{ext}` (e.g., `01_architect_dependencies.md`, `02_impl_auth_FEAT-003.md`)
- Handoff naming: `{from}->{to}.md` under `_workspace/handoff/` (e.g., `reviewer->implementer-auth.md`)
- Only final outputs go to user-specified paths; intermediate files stay in `_workspace/`
- Preserve `_workspace/` for audit trail (do not delete after completion)

---

## Parallel Wave Sizing

The orchestrator's parallel wave (Phase 2 — how many implementers dispatched in one
response) is bounded by how many features can safely run together.

| Project Scale | Typical Wave Size | Features per Implementer |
|--------------|-------------------|--------------------------|
| Solo (single module) | 1 implementer, dispatched sequentially | one feature at a time |
| Small (5-10 features) | 2-3 parallel implementers | 3-5 |
| Medium (10-20 features) | 3-5 | 4-6 |
| Large (20+ features) | 5-7 | 4-5 |

> Larger waves cost more in dispatch coordination and re-review churn when one implementer
> fails. 3 focused implementers outperform 5 that step on each other's shared targets.
> Single-module projects dispatch one implementer at a time — the `Agent` dispatch surface
> is uniform across project sizes.

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
2. Orchestrator emits parallel Agent tool_use blocks for 2 implementers, then a reviewer call
3. Implementers run TDD leaves (Red/Green/Refactor as Agent calls) and write _workspace/ artifacts
4. Reviewer reads artifacts, writes review decisions to _workspace/03_reviewer_*.md
5. All features pass -> single commit per feature (one at a time)

### Error Flow
1. Implementer A fails TDD convergence after 5 iterations; writes handoff/implementer-a->orchestrator.md with kind=escalate
2. Orchestrator pauses feature A, continues the remaining features
3. Escalates feature A to user with the envelope's summary
4. User provides guidance, orchestrator re-dispatches implementer-a with the revised prompt
```
