## Core fields <!-- anchor: core-fields -->

Every handoff envelope (`_workspace/handoff/{from}->{to}.md`) is a markdown file whose YAML frontmatter carries these fields:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `from` | string (agent slug) | yes | Must match the sender's agent slug (e.g., `implementer-auth`) |
| `to` | string (agent slug) | yes | Single recipient — `orchestrator`, `reviewer`, `qa-agent`, or `implementer-<slug>`. Fan-out is N separate envelope files |
| `feature_id` | string | yes | `FEAT-XXX` — which feature this pertains to |
| `phase` | enum | yes | `Red`, `Green`, `Refactor`, `Verify`, `Gate2`, `QA`, `Escalate`, or `Coordinate` |
| `kind` | enum | yes | See "Envelope kinds" below |
| `artifact_path` | string | when kind ∈ {`artifact-ready`, `review-request`, `review-result`, `qa-report`, `escalate`} | Path under `_workspace/` |
| `status` | enum | yes | See "Status enum" |
| `blockers` | array<string> | when status ∈ {`blocked`, `failed`} | Human-readable reasons |
| `summary` | string | yes | ≤ 200 chars — the one-line takeaway |

Task assignment is delivered through the orchestrator's `Agent(subagent_type=..., prompt=...)` call, not an envelope — no `task-assigned` kind exists.

## Envelope kinds

| Kind | Sender → Receiver | Meaning |
|------|-------------------|---------|
| `artifact-ready` | implementer-<slug> → reviewer / qa-agent | A `_workspace/` artifact is available for review |
| `review-request` | implementer-<slug> → reviewer | Gate 2 review requested |
| `review-result` | reviewer → implementer-<slug> | Approve / request-changes / critical-reject |
| `qa-report` | qa-agent → orchestrator | Cross-module boundary verification report |
| `coordinate` | implementer-<slug> → orchestrator | Shared-contract decision needed (orchestrator brokers the round-trip) |
| `escalate` | implementer-<slug> → orchestrator | Convergence failure or unrecoverable error |

## Status enum

```
running      — subagent is producing output (transient; rarely written to an envelope)
blocked      — subagent exited while waiting on coordination (envelope carries the blocker)
completed    — work done, evidence in artifact_path
failed       — terminal failure, requires escalation
```

A single `Agent` dispatch resolves to `completed`, `blocked`, or `failed` when the envelope is written at exit. Subagent Dispatch has no live `cancel-pending` — if the orchestrator wants work to stop, it simply does not re-dispatch.
