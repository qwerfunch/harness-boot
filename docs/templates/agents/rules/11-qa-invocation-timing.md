**QA agent invocation points** (only when qa-agent is included per `commands/setup.md` Step 1.6): <!-- anchor: qa-invocation-timing -->

1. **Per-module**: immediately after a module's feature cycle passes Gate 1 and BEFORE Gate 2. The orchestrator calls `qa-agent` with that module's integration-point list (derived from `feature-list.json` `doc_sync` overlaps and cross-module `tdd_focus` references). The QA report is written to `_workspace/qa_qa-agent_{module}-{feature_id}.md` and attached to the Gate 2 review bundle. A QA Critical finding blocks Gate 2.
2. **Session-end sweep**: before any session termination path (auto-pilot queue exhausted, user stop, escalation end), the orchestrator runs one final QA pass over all modules that had any feature completed in this session. Auto-pilot does **not** skip this sweep even when time-pressured; the sweep is cheap because QA reads artifacts, not code. Findings route by severity:
   - **Critical**: for each Critical finding, the orchestrator invokes the `debugger` agent with the QA artifact path and the affected boundary. The debugger writes its decision to `_workspace/qa_debugger_{feature_id}.md` and updates `feature-list.json` via one of two actions:
     1. **Resurrect** — a currently `passes: true` feature owns the boundary (its `tdd_focus` or `doc_sync` covers the affected file) → flip its `passes` back to `false`. The iteration counter in `PROGRESS.md ## Current TDD State` is **preserved** (not reset): a recurring failure on the same feature is divergence and the 5-iteration cap must catch it.
     2. **Create** — no existing feature owns the boundary → append a new `FEAT-FIX-<slug>` entry with `test_strategy: "integration"`, `depends_on: [<features touching the boundary>]`, `tdd_focus: [<boundary files>]`, `doc_sync: []`, `passes: false`.
     After the update, auto-pilot re-enters naturally (the queue is no longer empty). No session-level wave counter, no bounded one-off pass — the only convergence guard is the per-feature 5-iteration cap in `## Iteration Tracking` above. A feature that keeps re-failing escalates to the user through the normal channel.
   - **Major / Minor**: append to `PROGRESS.md ## Incidents` only; do not modify `feature-list.json`.
   - **No findings**: verification sweep passes; proceed to Gate 5 Runtime Smoke (`docs/setup/agents-and-gates.md` anchor `runtime-smoke-gate`).

If qa-agent is NOT included, these invocation points are omitted and boundary verification falls to the reviewer's Gate 2 checklist alone.

