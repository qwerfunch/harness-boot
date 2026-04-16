# Harness Engineering Start Prompts

---

## Kickoff (Main)

```
You will now perform harness engineering.

## Input
1. Detailed plan: `{plan-md-path}` — a pre-written project detailed plan
2. Harness guide: `${CLAUDE_PLUGIN_ROOT}/docs/setup-guide.md`

## Mission
Decompose the detailed plan into the harness guide's deliverables and generate an executable harness.
All MD files, hook scripts, settings.json, and feature-list.json are generation targets.

## Generation Order
Follow the guide's "12. Generation Order" Phase 1-6, with these specifics:
- Phase 1: Generate hooks/ scripts as executable bash
- Phase 3: Include model: opus/sonnet frontmatter in agents
- Phase 4: All skills must follow 6-section anatomy (Overview/When/TDD Focus/Process/Rationalizations/Red Flags/Verification). Minimum 3 rationalization rows.
- Phase 6: Extract feature-list.json as JSON from the detailed plan

## Four Principles
1. TDD-First — 3-way sub-agent context isolation
2. Iteration Convergence — Max 5 loops, escalate if exceeded
3. Code-Doc Sync — Triple defense (prompt + hook + review)
4. Anti-Rationalization — Excuse-rebuttal tables in every skill

## Constraints
- CLAUDE.md <= 1,500 tokens / SKILL.md <= 500 lines
- Hooks: shebang + stdin JSON parsing
- feature-list.json: only the passes field may be changed
- Uncertain items: {TODO: needs confirmation}
- Quality gate checks must specify evidence types

## Start
Read the detailed plan and report:
1. Tech stack (check if specified → if yes, adopt; if no, present 2-3 recommendations)
2. Sub CLAUDE.md target directories
3. Agent/skill additions or removals needed
4. feature-list.json draft (ID + description + tdd_focus)
5. Code-doc sync mapping draft
6. Hook project-specific customizations
7. Rationalization candidates per skill
8. Expected file count per phase

Report first, then proceed to Phase 1 after confirmation.
```

---

## Phase Confirmation

```
Phase {N} confirmed. {Modifications or "No modifications."}
Proceeding to Phase {N+1}.
```

---

## Verification

```
Verify the entire generated harness.

1. File completeness: settings.json + 5 hooks + 9 agents + 8 skills + 5 protocols + feature-list.json
2. Runtime guardrails: hook stdin JSON parsing, security-gate exit 2, doc-sync-check commit blocking
3. Skill anatomy: 6 sections + Rationalizations >= 3 rows + Red Flags >= 2 items + Verification evidence types + <= 500 lines
4. Quality gates: Gates 0-4 exist, all checks have evidence types, rationalization defense included
5. TDD: 3 sub-agent frontmatters, Red → Green call order, Gate 0 prerequisite
6. Model routing: opus for 4 / sonnet for 5 via frontmatter model: field
7. Cross-session: bootstrap hook → reads PROGRESS.md + feature-list.json
8. Code-doc sync: triple defense operational, mapping table matches project structure
9. Tokens: CLAUDE.md <= 1,500 tokens, per-task ~3,800 tokens
10. Dry run: normal TDD / 3-iteration loop / doc-missing block / 5-iteration escalation / rationalization block

Report each item as PASS/FAIL. Propose fixes for any FAILs.
```

---

## Start Development

```
Harness ready. Start development.

1. Load orchestrator.md
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
