# Message Format Protocol

Defines the payload schema for inter-agent communication. Applies to `SendMessage`, `TaskCreate`, `TaskUpdate` tool calls and the `_workspace/` file transfer convention.

## Principles

1. **Structured over free-form** — every message carries named fields, not just a prose blob
2. **Location-only artifacts** — large outputs live in `_workspace/`; messages carry paths, not content
3. **Versioned status enum** — status values are drawn from a fixed set; inventing new values is not allowed without updating this protocol
4. **No implicit broadcast** — every message has a named recipient; team-wide announcements go through the orchestrator

## Core fields

Every `SendMessage` payload carries these fields (JSON-serializable):

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `from` | string (agent name) | yes | Must match the sender's agent slug (e.g., `implementer-auth`) |
| `to` | string (agent name) | yes | Single recipient. Fan-out is N separate messages |
| `feature_id` | string | yes | `FEAT-XXX` — which feature this message pertains to |
| `phase` | enum | yes | `Red`, `Green`, `Refactor`, `Verify`, `Gate2`, `QA`, `Escalate`, or `Coordinate` |
| `kind` | enum | yes | See "Message kinds" below |
| `artifact_path` | string | when kind ∈ {`artifact-ready`, `review-request`, `qa-report`} | Path under `_workspace/` |
| `status` | enum | yes | See "Status enum" |
| `blockers` | array<string> | when status ∈ {`blocked`, `cancel-pending`} | Human-readable reasons |
| `summary` | string | yes | ≤ 200 chars — the one-line takeaway |

## Message kinds

| Kind | Sender → Receiver | Meaning |
|------|-------------------|---------|
| `task-assigned` | orchestrator → implementer-<slug> | A feature is assigned to this implementer |
| `artifact-ready` | implementer-<slug> → reviewer / qa-agent | A _workspace artifact is available for review |
| `review-request` | implementer-<slug> → reviewer | Gate 2 review requested |
| `review-result` | reviewer → implementer-<slug> | Approve / request-changes / critical-reject |
| `qa-report` | qa-agent → orchestrator | Cross-module boundary verification report |
| `coordinate` | implementer-<slug> → implementer-<slug> | Shared-contract negotiation (e.g., API shape) |
| `escalate` | implementer-<slug> → orchestrator | Convergence failure or unrecoverable error |
| `cancel-pending` | orchestrator → any member | Stop at the next phase boundary |

## Status enum

```
queued       — task created, not yet started
running      — member is actively working
blocked      — member stopped waiting for input/coordination
cancel-pending — orchestrator asked to stop; member finishes current phase then exits
completed    — work done, evidence in artifact_path
failed       — terminal failure, requires escalation
```

Transitions are monotonic within a task: `queued → running → (blocked → running)* → (completed | failed | cancel-pending)`. A task cannot go from `completed` back to `running`; start a new task.

## `_workspace/` naming convention

```
_workspace/{phase}_{agent}_{artifact}.{ext}
```

Examples:
- `_workspace/red_tdd-test-writer_feat-042-tests.ts`
- `_workspace/gate2_reviewer_feat-042-report.md`
- `_workspace/qa_qa-agent_module-auth-order-boundary.md`
- `_workspace/escalate_implementer-auth_feat-042-trail.md`

Rules:
- Slugs are lowercase, hyphenated
- One artifact per file — do not concatenate
- Overwrite is permitted for same-phase same-agent retries; the last-write is authoritative
- The orchestrator does not clean `_workspace/` between sessions — artifacts are debugging evidence

## Example — fan-out and collect

Orchestrator assigns two parallel features:

```json
{ "from": "orchestrator", "to": "implementer-auth",  "feature_id": "FEAT-042", "phase": "Red",     "kind": "task-assigned",  "status": "queued", "summary": "Start TDD cycle for FEAT-042" }
{ "from": "orchestrator", "to": "implementer-order", "feature_id": "FEAT-043", "phase": "Red",     "kind": "task-assigned",  "status": "queued", "summary": "Start TDD cycle for FEAT-043" }
```

Each implementer reports back on Gate 2 readiness:

```json
{ "from": "implementer-auth",  "to": "reviewer", "feature_id": "FEAT-042", "phase": "Gate2", "kind": "review-request", "artifact_path": "_workspace/gate2_implementer-auth_feat-042-bundle.md",  "status": "completed", "summary": "Red-Green-Refactor done, ready for review" }
{ "from": "implementer-order", "to": "reviewer", "feature_id": "FEAT-043", "phase": "Gate2", "kind": "review-request", "artifact_path": "_workspace/gate2_implementer-order_feat-043-bundle.md", "status": "completed", "summary": "Red-Green-Refactor done, ready for review" }
```

## Coordination across modules

When two implementers need to agree on a shared contract (e.g., `auth` exposes a function that `order` consumes):

1. Consumer sends `coordinate` with `summary` = proposed shape, `artifact_path` = proposal doc
2. Producer responds `coordinate` with either `status: completed` (accepted) or `status: blocked` (counter-proposal in new artifact_path)
3. Up to 3 rounds. If unresolved, both escalate to orchestrator with `kind: escalate`
4. The orchestrator either rules on the shape (architect consulted) or blocks both features until the plan is revised

## Out of scope

- Binary payloads (images, archives) — not supported; reference a path instead
- Direct agent-to-agent file editing — all writes go through `_workspace/` first, then the receiving agent reads
- Chain-of-thought or reasoning dumps — these stay internal to each agent
