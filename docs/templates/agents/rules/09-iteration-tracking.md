**Iteration tracking** (mandatory, all strategies): <!-- anchor: iteration-tracking -->

The `implementer-<slug>` agent **owns** iteration counter writes for its own feature. Other agents (reviewer, tdd-test-writer, tdd-implementer, tdd-refactorer, bdd-writer, qa-agent, debugger) MUST NOT mutate the `iteration` field — they may only read it.

1. Before each cycle iteration, the implementer reads PROGRESS.md `## Current TDD State` → `iteration` value
2. The implementer increments `iteration` by 1 and writes to PROGRESS.md BEFORE starting the cycle
3. If `iteration > 5`: Do NOT proceed. The implementer logs to PROGRESS.md `## Incidents` table (date, feature ID, type="convergence-failure"). Escalate to user.
4. On feature completion (Step 7), the implementer resets `iteration: 0`
5. When a feature is **resurrected** by the session-terminal sweep (session-end QA Critical, Gate 5 Build/Run failure — see the `qa-invocation-timing` anchor below and `docs/setup/agents-and-gates.md` anchor `runtime-smoke-gate`), its iteration counter is **preserved**. Do NOT reset to 0 at resurrection time: a recurring failure on the same feature is divergence, and the `> 5` cap must trigger so the normal escalation path runs (Step 3 above). Reset only happens again on successful re-completion in step 4.

