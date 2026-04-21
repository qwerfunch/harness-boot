# Handoff Envelope Format Protocol

Defines the schema for inter-agent handoff envelopes written to `_workspace/handoff/{from}->{to}.md`. These envelopes are the sole mechanism for directed agent-to-agent signals in Subagent Dispatch — task assignment travels through the `Agent` tool's `prompt` parameter, not through envelopes.

## Principles

1. **Structured over free-form** — every envelope carries named fields in YAML frontmatter, not just a prose blob
2. **Location-only artifacts** — large outputs live in `_workspace/{phase}_{agent}_{artifact}.{ext}`; envelopes carry paths, not content
3. **Versioned status enum** — status values are drawn from a fixed set; inventing new values is not allowed without updating this protocol
4. **Directed, not broadcast** — every envelope has a single named recipient in its filename; fan-out is N separate files

## Envelope location and naming <!-- anchor: envelope-location -->

```
_workspace/handoff/{from}->{to}.md
```

- `{from}` and `{to}` are agent slugs (e.g., `implementer-auth`, `reviewer`, `orchestrator`)
- One envelope per directed pair per round; a later round overwrites the previous file for the same pair
- The orchestrator reads envelopes addressed to itself between dispatch rounds; subagents read envelopes addressed to them via paths passed into their `Agent` prompt

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
| `artifact_path` | string | when kind ∈ {`artifact-ready`, `review-request`, `review-result`, `qa-report`, `intent-report`, `escalate`} | Path under `_workspace/` |
| `blockers` | array<string> | when status ∈ {`blocked`, `failed`} | Human-readable reasons |
| `summary` | string | yes | ≤ 200 chars — the one-line takeaway |

## Envelope kinds

| Kind | Sender → Receiver | Meaning |
|------|-------------------|---------|
| `artifact-ready` | implementer-<slug> → reviewer / qa-agent | A `_workspace/` artifact is available for review |
| `review-request` | implementer-<slug> → reviewer | Gate 2 review requested |
| `review-result` | reviewer → implementer-<slug> | Approve / request-changes / critical-reject |
| `qa-report` | qa-agent → orchestrator | Cross-module boundary verification report |
| `intent-report` | intent-verifier → orchestrator | Gate 2.5 plan-fidelity verdict (Critical/Major/Minor counts + findings) |
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

## `_workspace/` naming convention <!-- anchor: workspace-naming -->

Envelopes live under `_workspace/handoff/`. Main deliverables (the artifact a subagent produced) live at:

```
_workspace/{phase}_{agent}_{artifact}.{ext}
```

Examples:
- `_workspace/01_architect_dependencies.md`
- `_workspace/02_impl_auth_feat-042-bundle.md`
- `_workspace/03_reviewer_feat-042.md`
- `_workspace/qa_qa-agent_module-auth-order-boundary.md`

Rules:
- Slugs are lowercase, hyphenated
- One artifact per file — do not concatenate
- Overwrite is permitted for same-phase same-agent retries; the last-write is authoritative
- The orchestrator does not clean `_workspace/` between sessions — artifacts are debugging evidence

## Example — parallel dispatch and collect

Orchestrator dispatches two parallel implementers in one response (two `Agent` tool_use blocks):

```
Agent(subagent_type="implementer-auth",
      prompt="FEAT-042 ... write _workspace/02_impl_auth_feat-042-bundle.md; on Gate 2 ready write _workspace/handoff/implementer-auth->reviewer.md")
Agent(subagent_type="implementer-order",
      prompt="FEAT-043 ... write _workspace/02_impl_order_feat-043-bundle.md; on Gate 2 ready write _workspace/handoff/implementer-order->reviewer.md")
```

Each implementer, on completion, writes its envelope (example frontmatter shown):

```yaml
# _workspace/handoff/implementer-auth->reviewer.md
---
from: implementer-auth
to: reviewer
feature_id: FEAT-042
phase: Gate2
kind: review-request
status: completed
artifact_path: _workspace/02_impl_auth_feat-042-bundle.md
summary: Red-Green-Refactor done, ready for review
---
```

The orchestrator then dispatches the reviewer with the envelope path in its prompt.

## Coordination across modules <!-- anchor: coordinate-round-trip -->

Subagent Dispatch has no live inter-agent channel, so coordination is always orchestrator-brokered:

1. **Consumer requests.** The consumer implementer writes `_workspace/handoff/implementer-<consumer>->orchestrator.md` with `kind: coordinate`, `status: blocked`, and `artifact_path` pointing to a proposal doc (e.g., proposed function signature).
2. **Orchestrator brokers.** On the next dispatch round, the orchestrator dispatches the producer implementer with a prompt that references the consumer's proposal.
3. **Producer responds.** The producer writes `_workspace/handoff/implementer-<producer>->orchestrator.md` with either `status: completed` (accepted — signature inlined in summary) or `status: blocked` (counter-proposal in a new artifact_path).
4. Up to 3 rounds. If unresolved, both implementers escalate with `kind: escalate`. The orchestrator either rules on the shape (architect consulted) or blocks both features until the plan is revised.

## Out of scope

- Binary payloads (images, archives) — not supported; reference a path instead
- Direct agent-to-agent file editing — all writes go through `_workspace/` first, then the receiving agent reads
- Chain-of-thought or reasoning dumps — these stay internal to each agent
- Real-time messaging between simultaneously-live agents — not supported by Subagent Dispatch; all coordination is turn-based through the orchestrator
