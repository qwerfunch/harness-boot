## Core fields <!-- anchor: core-fields -->

Every envelope is a markdown file with YAML frontmatter + a short body:

```yaml
---
from: implementer-auth          # sender agent slug
to: reviewer                    # single recipient agent slug (or `orchestrator`)
feature_id: FEAT-042            # which feature this pertains to
phase: Gate2                    # Red | Green | Refactor | Verify | Gate2 | QA | Escalate | Coordinate
kind: review-request            # see "Envelope kinds" below
status: completed               # see "Status enum"
artifact_path: _workspace/02_impl_auth_feat-042-bundle.md   # required for kinds listed below
blockers: []                    # required when status ∈ {blocked, failed}
summary: Red-Green-Refactor done, ready for review          # ≤ 200 chars
---

<optional body: free-form notes, rationale, links to multiple artifacts>
```

Field rules:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `from` | string | yes | Must match sender's agent slug |
| `to` | string | yes | Single recipient; fan-out uses N separate envelope files |
| `feature_id` | string | yes | `FEAT-XXX` |
| `phase` | enum | yes | `Red`, `Green`, `Refactor`, `Verify`, `Gate2`, `QA`, `Escalate`, `Coordinate` |
| `kind` | enum | yes | See "Envelope kinds" |
| `status` | enum | yes | See "Status enum" |
| `artifact_path` | string | when kind ∈ {`artifact-ready`, `review-request`, `review-result`, `qa-report`, `escalate`} | Path under `_workspace/` |
| `blockers` | array<string> | when status ∈ {`blocked`, `failed`} | Human-readable reasons |
| `summary` | string | yes | ≤ 200 chars — the one-line takeaway |

## Envelope kinds

| Kind | Sender → Receiver | Meaning |
|------|-------------------|---------|
| `artifact-ready` | implementer-<slug> → reviewer / qa-agent | A `_workspace/` artifact is available for review |
| `review-request` | implementer-<slug> → reviewer | Gate 2 review requested |
| `review-result` | reviewer → implementer-<slug> | Approve / request-changes / critical-reject |
| `qa-report` | qa-agent → orchestrator | Cross-module boundary verification report |
| `coordinate` | implementer-<slug> → orchestrator | Shared-contract decision needed (orchestrator brokers the round-trip) |
| `escalate` | implementer-<slug> → orchestrator | Convergence failure or unrecoverable error |

> **No real-time messaging.** Subagent Dispatch has no equivalent of `SendMessage` / `cancel-pending` to a live agent. If an agent must stop, the orchestrator simply does not re-dispatch it. Task assignment is delivered through the `Agent` tool's `prompt` parameter, not as an envelope.

## Status enum

```
running      — subagent is producing output (transient state inside an active Agent call)
blocked      — subagent exited while waiting on coordination (envelope carries the blocker)
completed    — work done, evidence in artifact_path
failed       — terminal failure, requires escalation
```

A single `Agent` invocation resolves to `completed`, `blocked`, or `failed` — an envelope is written once at exit. `running` is informational only (for log-shaped artifacts that stream progress).

