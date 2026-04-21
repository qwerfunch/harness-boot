# QA Agent Design Guide

> Reference adapted from [revfactory/harness](https://github.com/revfactory/harness) (Apache-2.0).
> Based on real-world bug patterns found in production projects.

---

## When to Include a QA Agent

Add a QA agent to the harness when:
- Project has 3+ modules with integration points (API <-> frontend, service <-> service)
- Multiple agents produce outputs that must be consistent with each other

A QA agent is **not** a replacement for the reviewer agent. The reviewer checks individual code quality; the QA agent checks **cross-boundary consistency**.

---

## The Core Problem: Boundary Mismatches

The most dangerous bugs occur at module boundaries — where one agent's output meets another agent's input. Each agent's work may be internally correct but incompatible at the seams.

### Common Boundary Bug Patterns

| Pattern | Example | Root Cause |
|---------|---------|-----------|
| **API shape mismatch** | Backend returns `{ user_name: "..." }` but frontend expects `{ userName: "..." }` | Agents working from different naming conventions |
| **Type drift** | Backend sends `number` but frontend parses as `string` | No shared type contract |
| **Missing error handling** | Backend returns 404 for deleted items but frontend has no 404 handler | Error paths not in acceptance criteria |
| **Stale mock data** | Tests pass with mocked API but fail with real backend | Mock diverged from actual implementation |
| **Event ordering** | Producer emits events A,B,C but consumer expects C,A,B | Implicit ordering assumptions |
| **Partial state** | DB migration adds column but ORM model not updated | Cross-layer change not propagated |
| **Config divergence** | Service A reads `DATABASE_URL` but service B reads `DB_URL` | No shared config schema |

---

## Integration Coherence Verification

The QA agent's core methodology: **"Read Both Sides Simultaneously"**

Instead of checking each side independently, the QA agent reads both sides of every boundary and cross-compares:

```
1. Identify all integration boundaries
2. For each boundary:
   a. Read the producer's output definition (API response, event schema, DB schema)
   b. Read the consumer's input expectation (API call, event handler, query)
   c. Compare shapes, types, field names, error handling
   d. Flag any mismatch
```

### Verification Levels

| Level | What | How |
|-------|------|-----|
| **Shape** | Field names, nesting structure | Compare JSON/type definitions side by side |
| **Type** | Data types per field | Check producer return type vs consumer expected type |
| **Semantics** | Business meaning | Verify both sides interpret values the same way (e.g., "active" means same thing) |
| **Error paths** | Error responses/handling | Verify consumer handles all error codes producer can return |
| **Timing** | Async/event ordering | Verify consumer handles all possible event orderings |

---

## QA Agent Design Principles

### 1. Cross-Comparison, Not Existence Check

**Wrong:** "Does the API endpoint exist?" -> Yes -> PASS
**Right:** "Does the frontend's fetch call match the API endpoint's response shape?" -> Compare both -> PASS/FAIL

The QA agent must always read **both sides** of an interface and compare them.

### 2. Incremental QA, Not Final QA

Don't wait until all modules are complete. Run QA **after each module completes**:

```
Module A complete -> QA: check A's boundaries
Module B complete -> QA: check B's boundaries + A<->B integration
Module C complete -> QA: check C's boundaries + A<->C + B<->C
```

Benefits:
- Bugs caught earlier are cheaper to fix
- Integration issues surface before they cascade
- Each QA run is smaller and more focused

### 3. Use `general-purpose` Type

The QA agent must be `general-purpose` (not `Explore`), because:
- `Explore` is read-only — can't run validation scripts
- QA often needs to execute test commands to verify integration
- QA may need to write verification reports

---

## QA Agent Definition Template

```markdown
---
name: qa-agent
description: >
  Integration coherence verification agent. Checks cross-boundary consistency
  between modules by reading both sides of each interface simultaneously.
  Runs incrementally after each module completion.
tools: Read, Glob, Grep, Bash, Write
model: opus
---
# QA Agent — Integration Coherence Verifier

## Core Role
Cross-boundary consistency verification. Not code quality (reviewer handles that),
but integration correctness between modules/layers/services.

## Working Principles
1. **Always read both sides** — Never verify a boundary by checking only one side
2. **Compare shapes first** — Field names and structure before semantics
3. **Run incrementally** — After each module, not just at the end
4. **Report with evidence** — Show both sides and the specific mismatch

## Verification Process
1. List all integration boundaries for the completed module
2. For each boundary:
   - Read producer's output definition
   - Read consumer's input expectation
   - Compare: shape -> type -> semantics -> error paths
3. Run integration tests if they exist
4. Report findings with file:line references for both sides

## Input/Output Protocol
- Input: Module name, list of boundary files to check
- Output: Verification report in _workspace/qa_{module}_report.md

## Error Handling
- If one side of a boundary doesn't exist yet: note as "pending" (not a failure)
- If types are ambiguous: flag as "needs clarification" with both interpretations

## Common Rationalizations
| Excuse | Rebuttal |
|--------|----------|
| "Both sides pass their own tests" | Unit tests verify internal correctness. Integration bugs live at the seam. |
| "I'll check integration at the end" | Late integration bugs cascade. Incremental QA catches them when the fix is small. |
| "The types are close enough" | `user_name` vs `userName` is a runtime crash. Close enough is not good enough. |
```

---

## Integration Checklist Template (Web App)

For web applications with frontend + backend + database:

```markdown
## Integration Coherence Checklist

### API Layer (Backend <-> Frontend)
- [ ] Every frontend fetch/axios call has a matching backend route
- [ ] Request body shape matches backend's expected schema
- [ ] Response shape matches frontend's type definition
- [ ] All HTTP error codes have frontend handlers
- [ ] Auth token format consistent (header name, token prefix)

### Data Layer (Backend <-> Database)
- [ ] ORM models match current DB schema (post-migration)
- [ ] All query result shapes match the code that processes them
- [ ] Foreign key relationships reflected in application logic
- [ ] Migration up + down both exist and are reversible

### State Layer (Frontend Internal)
- [ ] Global state shape matches component prop expectations
- [ ] Route parameters match page component's expected params
- [ ] Form validation rules match API validation rules

### Config Layer (Cross-cutting)
- [ ] Environment variables consistent across all services
- [ ] Feature flags checked in both frontend and backend
- [ ] External API credentials present in all environments
```

---

## Integrating QA into harness-boot

### In Setup (Phase 3)

When generating agents, if the project has 3+ modules with integration points:
- Add `qa-agent.md` to `.claude/agents/`
- Set model to `opus` (boundary verification requires judgment)
- Add QA step to orchestrator workflow (after each module's TDD cycle)

### In Start (Step 4)

After each module's TDD cycle completes:
1. Call QA agent to verify integration boundaries of the completed module
2. QA report is provided to reviewer as part of Gate 2 review material
3. Boundary mismatches are Critical severity in Gate 2 (block commit)
4. Run remaining quality gates (0-1, 3-4) as normal

### Session-end QA sweep → failure-as-feature routing

When QA runs at session-terminal time (auto-pilot queue is empty and all features `passes: true`), findings do NOT merely log to `PROGRESS.md ## Incidents`. They feed back into the harness loop through the `debugger` agent. See `commands/start.md` anchor `qa-invocation-timing` for the authoritative contract.

The pipeline per severity:

- **Critical** — for each Critical finding, the orchestrator invokes the `debugger` agent with the QA artifact path (`_workspace/qa_*.md`) and the affected boundary (file:line). The debugger writes its decision to `_workspace/qa_debugger_{feature_id}.md` and updates `feature-list.json` via ONE of:
  1. **Resurrect** — an existing feature's `tdd_focus` or `doc_sync` covers the affected file AND its current `passes` is `true` → flip its `passes` back to `false`. The iteration counter in `PROGRESS.md ## Current TDD State` is **preserved** (not reset). A recurring failure on the same feature is divergence, and the per-feature 5-iteration cap must catch it.
  2. **Create** — no existing feature owns the boundary → append a new `FEAT-FIX-<slug>` entry with `test_strategy: "integration"`, `depends_on` set to every feature touching the boundary, `tdd_focus` set to the affected files, `doc_sync: []`, `passes: false`.

  After the update, auto-pilot re-enters naturally. There is no wave counter, no session-level remediation budget; the per-feature 5-cap is the only convergence guard.

- **Major / Minor** — append to `PROGRESS.md ## Incidents` only (existing behavior, unchanged). These do not block termination.

- **No findings** — proceed to Gate 5 Runtime Smoke (per `docs/setup/agents-and-gates.md` anchor `runtime-smoke-gate`).

Gate 5 Build/Run failures route through the same debugger resurrect-or-create decision; the only Gate-5-specific detail is the FIX slug prefix (`FEAT-FIX-BUILD-*` / `FEAT-FIX-RUNTIME-*`) and the log artifact path.

### Quality Gate Integration

Add to Gate 2 (Review):
- Reviewer checks QA report in addition to code quality
- Boundary mismatches are Critical severity (block commit)

### Dispatch Integration

The QA agent is a first-class dispatch target alongside implementers and reviewer:
- Orchestrator invokes `Agent(subagent_type="qa-agent", ...)` after each module's implementer returns, passing the producer + consumer-side paths in the prompt
- QA agent runs incremental boundary verification and writes `_workspace/03_qa_<module>_<feature>.md`
- When findings warrant follow-up, the QA agent writes `_workspace/handoff/qa-agent->orchestrator.md` with the relevant `kind` (e.g. `qa-report`, `critical-reject`) so the orchestrator can re-dispatch implementers or the reviewer
