## Core fields <!-- anchor: core-fields -->

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

