# Execution Model Divergence from revfactory/harness

> harness-boot is adapted from [revfactory/harness](https://github.com/revfactory/harness) (Apache-2.0).
> This document records where harness-boot intentionally diverges from the upstream execution model,
> and why.

## Summary

| Aspect | revfactory/harness | harness-boot |
|---|---|---|
| Execution modes | Agent Teams (default) + Subagents | Subagent Dispatch only |
| `TeamCreate`/`SendMessage`/`TaskCreate`/`TaskUpdate` | Default (flag-gated experimental) | Not used |
| Inter-agent messaging | `SendMessage` payload (flag required) | File envelopes under `_workspace/handoff/` |
| Shared task list | `TaskCreate` / `TaskUpdate` | `PROGRESS.md` (per-feature) + `_workspace/` (per-phase artifacts) |
| Parallel dispatch | Team members activated together | Multiple `Agent` tool_use blocks in a single response |

## Why the divergence

`TeamCreate` / `SendMessage` / `TaskCreate` / `TaskUpdate` are experimental Claude Code
primitives gated behind `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
(see revfactory's [`docs/experimental-dependency.md`](https://github.com/revfactory/harness/blob/main/docs/experimental-dependency.md)).
Without the flag the runtime silently falls back to single-agent execution — the plugin is
effectively non-functional for most users, and the failure is invisible at generation time.

Validation during harness-boot's own refactor also showed two things:

1. **Real-time `SendMessage` was never actually used.** Every plugin-level interaction is
   a turn-based handoff: the orchestrator dispatches a sub-agent, waits for completion,
   reads the output file, then dispatches the next. No plugin code exchanges messages
   while two agents are simultaneously alive.
2. **revfactory already documents a Subagents mode** — "Direct Agent tool invocation,
   one-off tasks, no inter-agent communication needed." harness-boot converges on this
   mode and expresses all coordination via file envelopes + `PROGRESS.md`.

Put together: the plugin never needed real-time messaging, and the primitives it relied on
are unstable. Removing them and using the universally-available `Agent` dispatch as the
single execution path is both safer and more honest about what the runtime actually does.

## Subagent Dispatch (the adopted model)

- **Dispatch.** The orchestrator calls `Agent(subagent_type=<slug>, prompt=<instructions + context paths>)`.
  The `subagent_type` is the agent definition's `name` field in its frontmatter (e.g.
  `implementer-auth`, `reviewer`, `qa-agent`).
- **Hand-off.** An agent that produces work for a next stage writes to
  `_workspace/handoff/{from}->{to}.md` before exiting. The orchestrator reads that file
  and passes its path into the next `Agent` call's prompt.
- **Parallel dispatch.** When features are independent (no shared `tdd_focus`, no shared
  `doc_sync`, and no depends_on between them), the orchestrator emits multiple `Agent`
  tool_use blocks in a single response — Claude Code's canonical parallel pattern.
- **State.** Per-feature progress lives in `PROGRESS.md`; per-phase artifacts live under
  `_workspace/`. Nothing relies on a runtime-managed "shared task list."

### Preserved architecture patterns

All six patterns from `agent-design-patterns.md` remain expressible:

| Pattern | Subagent Dispatch expression |
|---|---|
| **Pipeline** | Sequential `Agent` calls, each reading the previous stage's handoff file |
| **Fan-out/Fan-in** | N parallel `Agent` tool_use blocks, then a synthesis call |
| **Expert Pool** | `Agent(subagent_type=<expert-for-this-input>)` |
| **Producer-Reviewer** | `Agent(producer)` -> handoff file -> `Agent(reviewer)` -> decision file |
| **Supervisor** | Orchestrator reads progress state, decides next dispatch |
| **Hierarchical** | 2 levels: orchestrator -> specialist-with-`Agent`-tool -> leaf. Matches revfactory's "Keep to 2 levels" guidance. |

## Future work

If Team*/`SendMessage` primitives stabilize (flag becomes GA, or a replacement lands),
adding an opt-in Agent Team mode as a second execution path is tractable — the architecture
patterns are already described in pattern-neutral terms, and agents communicate through
explicit artifacts that can be adapted to either transport. This refactor does not block
that future addition.

Track upstream status via revfactory's `experimental-dependency.md`.
