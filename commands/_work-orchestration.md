# /harness-boot:work — orchestration detail (sidecar of commands/work.md)

Agent-routing operational spec: **conflict resolution · skip policy · feature-context inline payload · routing transparency · parallel-dispatch safety**.

> **Read scope** — the 6-row routing table is the *machine-checkable contract* and stays in `commands/work.md`; this file owns the surrounding operational rules that the orchestrator agent applies during execution. LLMs invoking `/harness-boot:work` do **not** need this file in every input; consult on demand when reasoning about a conflict, an explicit skip, or a parallel-dispatch group decision.

## Conflict resolution (orchestrator's job)

- `security-engineer` vs `reviewer` disagree → security BLOCK is
  **veto** (sensitivity wins).
- `ux-architect` flow vs `visual-designer` tokens → ux-architect is
  authoritative; if the disagreement repeats twice, the orchestrator
  escalates to you.
- `a11y-auditor` is read-only — it only emits BLOCK; it doesn't
  influence other agents' PASS verdicts.

## Skip policy (v0.5.1, made explicit)

- `security-engineer` — skip when the feature has no
  `entities[].sensitive=true` and no auth/payment surface. **Record
  the skip reason** in `.harness/state.yaml` `feature.skipped_agents[]`
  for the audit trail. Example: `"no sensitive entity, static client only"`.
- `performance-engineer` — skip when `features[].performance_budget`
  isn't declared. Same skip-record discipline.
- `audio-designer` — skip when `features[].ui_surface.has_audio=false`.
- `integrator` and `tech-writer` — **don't skip these in the completion
  chain**. Even on a tiny feature, the one-line wire-up and changelog
  entry stay their responsibility. The only allowed skip is on
  doc-only changes (`test_strategy=none`) — and even then, record the
  reason.
- Principle: **explicit skip vs. silent omission are different**. A
  skip leaves a trace in state.yaml; an omission is a bug.

## Feature context payload (orchestrator → expert)

When calling an agent, inline this prose in the prompt. The expert
shouldn't have to dig through spec.yaml.

```
feature_id: F-NNN
ac_summary:
  - AC-1: ...
  - AC-2: ...
modules: [...]
test_strategy: tdd | contract | property | smoke
ui_surface: {present, platforms, has_audio}  # only when present
```

## Routing transparency (F-038, 2026-04-27)

Right after `harness work F-N` activate, the output adds a `routed
agents: <chain>` line, and the no-args dashboard surfaces an `agent
chain:` section for the active feature. **You don't have to open
kickoff.md to know which agents this activate just engaged.**
Machine-checked by `tests/unit/test_work_routed_agents.py` and
`test_dashboard_agent_chain.py`.

## Parallel dispatch safety (F-039, 2026-04-27)

When the orchestrator emits multiple Agent tool calls in a single
message, Claude Code runs them **natively in parallel**. Only safe for
read-only audits or independent-output agents (no write conflict).
The currently declared groups:

- `sensitive_or_auth` →
  `(@harness:security-engineer ∥ @harness:reviewer)` — both are
  read-only audits; security BLOCK vetoes.
- `ui_surface.present` (has_audio=true) →
  `(@harness:visual-designer ∥ @harness:audio-designer)` — both
  depend on ux-architect's `flows.md`, write to separate output
  files (tokens.yaml · audio.yaml).

Routing notation: parallel groups are wrapped `(a ∥ b)`; sequential
steps are joined with `→`. Both the activate `routed agents:` line
and the dashboard `agent chain:` section use the same syntax.
Machine-checked by the `kickoff.PARALLEL_GROUPS` constant +
`parallel_groups_for_shapes()` helper +
`tests/unit/test_kickoff_parallel_groups.py` ·
`test_work_parallel_routing.py` · `test_dashboard_parallel.py`.

**Safety rule**: before adding a new parallel group, audit for write
conflicts — two agents writing the same file create a
last-writer-wins hazard. The orchestrator owns this check.
