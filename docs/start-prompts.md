# Start Development Prompts

---

## Start Development

```
Harness ready. Start development.

1. Load orchestrator.md
1b. Load domain-persona.md for domain context
2. Check PROGRESS.md → determine Initializer/Coding mode
3. Select highest-priority feature with passes: false from feature-list.json
4. Work on only one feature at a time
5. Implement via 3-way TDD sub-agent split
5a. Max 5 TDD iterations per feature. After 5, escalate to user with failure summary.
6. On completion: passes: true + PROGRESS.md + single commit (code + tests + docs)

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

**Start with Agent Team mode (parallel modules)**:
```
Harness ready. Start development with Agent Team mode.

1. Load orchestrator.md + domain-persona.md
2. Check PROGRESS.md → determine mode
3. Analyze module independence among top-priority passes: false features
4. Select features that can be parallelized (different modules, no shared dependencies)
5. TeamCreate with module-specific implementers + reviewer + QA agent (if included)
6. TaskCreate with feature assignments per implementer
7. Each implementer runs TDD sub-agent cycle independently
8. Members coordinate integration points via SendMessage
9. QA agent verifies cross-boundary consistency after each module completes
10. Reviewer reviews each module, leader verifies cross-module consistency
11. Single commit per feature (code + tests + docs)

Begin.
```

**QA boundary verification**:
```
Run QA agent boundary check on completed module {module_name}. Read both sides of each integration boundary simultaneously. Compare: shape → type → semantics → error paths. Report mismatches with file:line references for both producer and consumer sides.
```
