# Iteration Cycle Protocol

Defines how the TDD iteration counter is incremented, reset, and escalated. One counter per feature.

## Canonical schema

The authoritative schema for iteration state lives in `setup-guide.md` §11 ("PROGRESS.md File Structure Spec") in the `## Current TDD State` table. Do not duplicate it here — always read from there. This file describes **flow**, not storage.

## Ownership

- The feature's `implementer-<slug>` agent is the **sole writer** of its own feature's iteration counter. Other agents MUST NOT mutate `iteration`.
- Each feature has its own counter. Parallel features each track their own counter in the same PROGRESS.md `## Current TDD State` section — the `feature_id` field disambiguates.

## Counter lifecycle

```
feature start:      iteration = 0
cycle start:        read → increment → write (before any sub-agent call)
cycle success:      cycle passes Gates 0-3, proceed to Gate 4
feature complete:   reset iteration to 0 on feature commit (Gate 4)
```

## Bounds

- Soft limit: **5 iterations per feature**
- On cycle start, the implementer checks `iteration` BEFORE incrementing. If the value is already ≥ 5, do NOT start another cycle; go to escalation.
- Escalation never increments further.

## Escalation flow

When iteration ≥ 5:

1. Implementer stops the cycle. No sub-agent calls.
2. Append a row to PROGRESS.md `## Incidents`:
   - `date` (ISO-8601 UTC)
   - `feature` (feature_id)
   - `type` = `convergence-failure`
   - `resolution` = `pending user input`
3. Emit a summary artifact to `_workspace/{feature_id}_escalation.md` (what was tried, why each attempt failed, last sub-agent outputs)
4. Orchestrator surfaces the escalation to the user with three options (one question at a time, numbered):
   ```
   (1) ★ Invoke debugger agent to analyze root cause
   (2) Skip this feature for now (mark `passes: false` in feature-list.json with a blocker note)
   (3) End session — user fixes manually and re-runs /start
   ```
5. On (1), the `debugger` agent reads the escalation artifact + PROGRESS.md `## Incidents` history for this feature. It produces a root-cause report at `_workspace/{feature_id}_debug.md` and recommends ONE concrete change (not a rewrite).
6. If the user accepts the debugger's recommendation, the implementer applies it and resets `iteration = 0` (treated as a fresh cycle). The `## Incidents` row is updated with `resolution = debugger:{one-line-summary}`.
7. If the second escalation on the same feature happens, the orchestrator does not offer (1) again — it only offers (2) or (3).

## Reset rules

- On Gate 4 success (feature committed), reset `iteration = 0` for that feature.
- On feature skip (option 2 above), leave the counter as-is and add a `skipped` annotation in the `## Incidents` row. If the feature is retried later, the counter restarts at 0.
- Never reset mid-cycle.

## Concurrency

Parallel features run concurrently across module implementers. Because each feature's counter lives under its own `feature_id` scope in `## Current TDD State`, there is no shared mutable field — the only shared resource is the PROGRESS.md file itself.

- Writers append/update their own feature_id's row; the orchestrator serializes PROGRESS.md writes when multiple implementers finish a phase at the same tick.
- If two implementers attempt to write simultaneously, the orchestrator's `TaskUpdate` dispatch queue is the single serialization point. Members MUST NOT bypass the orchestrator to write PROGRESS.md directly.

## Observability

Every increment, reset, and escalation is observable via:
- PROGRESS.md itself (current value)
- PROGRESS.md `## Metrics.total_iterations` (cumulative count)
- PROGRESS.md `## Incidents` (escalations)
- `_workspace/{feature_id}_escalation.md` (full trail)

See `.claude/observability.md` for cross-signal cross-references.
