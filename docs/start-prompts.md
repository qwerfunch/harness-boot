# Start Development Prompts

---

## Start Development

```
Harness ready. Start development.

1. Load orchestrator.md + domain-persona.md
2. Check PROGRESS.md → determine Initializer/Coding mode
3. Select highest-priority feature with passes: false → present numbered choices (include auto-pilot option)
4. On feature start: auto-proceed through the cycle matching the feature's `test_strategy` (`lean-tdd` → Design/Implement/BDD-Verify/Refactor (default), `tdd` → Red/Green/Refactor (safety-critical opt-in), `state-verification` → Implement/State-Test/Refactor, `integration` → Implement/Integration-Test) → quality gates → doc-sync → commit without mid-feature pauses
5. Max 5 cycle iterations per feature. After 5, escalate to user.
6. On completion: run scripts/update-feature-status.mjs → single commit (code + tests + docs + feature-list.json)
7. CRITICAL: One feature per commit. Even if user requests "implement everything", execute sequentially: TDD → gates → commit → next feature.
8. Step 8: ask about next feature (or auto-proceed if auto-pilot mode)

Begin.
```

---

## Situational Prompts

**Resume interrupted session**:
```
Previous session was interrupted. Check PROGRESS.md In Progress TDD phase → check current feature in feature-list.json → check last commit in git log → resume work.
```

**Consecutive test failures**:
```
Switch to debugger agent. Failing test: {path}, Error: {message}. Perform root cause analysis → apply minimal fix → add regression test.
```

**Doc sync audit**:
```
Check last 10 commits in git log → identify commits with code changes but no doc changes → update missing docs → refresh PROGRESS.md.
```

**Progress check**:
```
Based on feature-list.json: total/complete/incomplete counts, completion rate by category, top 3 next priority recommendations.
```

**Resume with auto-pilot**:
```
Previous session had auto-pilot active. Check PROGRESS.md auto_pilot flag → resume auto-pilot from next incomplete feature. Auto-proceed through all steps, pause only on escalation.
```

**Start development**:
```
Harness ready. Start development.

1. Load orchestrator.md + domain-persona.md
2. Check PROGRESS.md → determine session state
3. Analyze module independence among top-priority passes: false features
4. Select features that can be parallelized (different modules, no shared dependencies); single-module projects run one feature at a time
5. Emit parallel Agent(subagent_type="implementer-<slug>", prompt=...) tool_use blocks — one per wave feature — in a single orchestrator response
6. Each implementer runs its test_strategy cycle, invoking tdd-*/bdd-writer sub-agents via Agent inside its own context
7. Implementers write deliverables to _workspace/02_impl_<slug>_<feature>.md and exit with a _workspace/handoff/implementer-<slug>->reviewer.md envelope (or ->orchestrator.md for coordinate/escalate)
8. Shared-contract decisions are orchestrator-brokered: the orchestrator reads coordinate envelopes and dispatches a counterparty implementer in the next round (no live cross-member messaging)
9. If qa-agent is included: Agent(subagent_type="qa-agent") after each module's Gate 1; report written to _workspace/qa_qa-agent_<module>-<feature>.md and attached to Gate 2
10. Agent(subagent_type="reviewer") reads _workspace/02_impl_* + qa reports; writes _workspace/03_reviewer_<feature>.md; on rejection emits _workspace/handoff/reviewer->implementer-<slug>.md and orchestrator re-dispatches
11. Run scripts/update-feature-status.mjs for each completed feature
12. Single commit per feature (code + tests + docs + feature-list.json) — never batch features

Begin.
```

**QA boundary verification**:
```
Run QA agent boundary check on completed module {module_name}. Read both sides of each integration boundary simultaneously. Compare: shape → type → semantics → error paths. Report mismatches with file:line references for both producer and consumer sides.
```
