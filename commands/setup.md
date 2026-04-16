---
description: Reads a detailed plan MD and generates the full harness structure (Phase 1-6). Run once at project start. Usage - /setup path/to/plan.md
argument-hint: <plan-md-path>
---

# /setup — Harness Boot

Reads a detailed plan MD and generates a Claude Code native multi-agent harness.

## Input
- Detailed plan MD path: `$ARGUMENTS`

## Procedure

### Step 0: Pre-check
1. Verify the plan MD file at `$ARGUMENTS` exists
2. If not found, ask the user to confirm the path
3. Load harness guide: `${CLAUDE_PLUGIN_ROOT}/docs/setup-guide.md`
4. Check if PROGRESS.md exists
   - If exists and contains a `last_completed_phase` field: ask "Resume from Phase {N+1}?" or "Overwrite entirely?"
   - If exists without `last_completed_phase`: ask "A harness already exists. Overwrite?"
   - If not: proceed with Initializer Mode

### Step 1: Analyze Plan and Report
Read the plan and report the following to the user:

1. **Tech stack**
   - If specified → adopt as-is
   - If unspecified → present 2-3 recommendations (with pros/cons and fit assessment) → wait for user selection
2. **Sub CLAUDE.md target directories** (e.g., src/api, src/components)
3. **Agent additions/removals needed** (beyond the default 9)
4. **Skill additions/removals needed** (beyond the default 8)
5. **feature-list.json draft** (feature ID + description + tdd_focus; validate no circular dependencies)
6. **Code-doc sync mapping draft**
7. **Hook script project-specific customizations**
8. **Rationalization candidates per skill**
9. **Expected file count per phase**

**Proceed to Step 2 only after user confirmation.**

### Step 2: Phase 1 — Infrastructure
- `.claude/settings.json` (hook configuration)
- `hooks/` 5 scripts (executable bash, shebang + stdin JSON parsing)
- `.claude/environment.md`
- `.claude/security.md`
- `scripts/init-harness.sh`

**Phase 1 completion report → record `last_completed_phase: 1` in PROGRESS.md → user confirmation → Phase 2**

### Step 3: Phase 2 — Core Protocols
- `.claude/protocols/` 5 protocols (tdd-loop, iteration-cycle, code-doc-sync, session-management, message-format)
- `CLAUDE.md` (main, <= 1,500 tokens)
- `.claude/quality-gates.md`

**Phase 2 completion report → record `last_completed_phase: 2` in PROGRESS.md → user confirmation → Phase 3**

### Step 4: Phase 3 — 9 Agents
Each agent YAML frontmatter includes a `model:` field:
- `orchestrator.md` (model: opus)
- `architect.md` (model: opus)
- `reviewer.md` (model: opus)
- `debugger.md` (model: opus)
- `implementer.md` (model: sonnet)
- `tdd-test-writer.md` (model: sonnet)
- `tdd-implementer.md` (model: sonnet)
- `tdd-refactorer.md` (model: sonnet, effort: low)
- `tester.md` (model: sonnet)

**Phase 3 completion report → record `last_completed_phase: 3` in PROGRESS.md → user confirmation → Phase 4**

### Step 5: Phase 4 — 8 Skills
Must follow 6-section anatomy (Overview / When to Use / TDD Focus / Process / Common Rationalizations (>= 3 rows) / Red Flags (>= 2 items) / Verification (with evidence)):
- `new-feature`, `bug-fix`, `refactor`, `tdd-workflow`
- `api-endpoint`, `db-migration`, `deployment`, `context-engineering`

Additional: `.claude/references/`, `.claude/examples/`, `.claude/context-map.md`

**Phase 4 completion report → record `last_completed_phase: 4` in PROGRESS.md → user confirmation → Phase 5**

### Step 6: Phase 5 — Sub CLAUDE.md
Generate sub CLAUDE.md for each target directory identified in Step 1.

**Phase 5 completion report → record `last_completed_phase: 5` in PROGRESS.md → user confirmation → Phase 6**

### Step 7: Phase 6 — State Tracking
- `feature-list.json` (extracted as JSON from the plan, passes: false)
- `PROGRESS.md`
- `CHANGELOG.md`
- `.claude/error-recovery.md`
- `.claude/observability.md`

### Step 8: Verification
Verify the entire generated harness:
1. File completeness: settings.json + 5 hooks + 9 agents + 8 skills + 5 protocols + feature-list.json
2. Runtime guardrails: hook stdin JSON parsing, security-gate exit 2, doc-sync-check commit blocking
3. Skill anatomy: 6 sections + Rationalizations >= 3 rows + Red Flags >= 2 items + Verification evidence types + <= 500 lines
4. Quality gates: Gates 0-4, all checks with evidence types, rationalization defense
5. TDD: 3 sub-agent frontmatters, Red → Green call order
6. Model routing: opus for 4 agents / sonnet for 5 agents via frontmatter model: field
7. Cross-session: bootstrap hook → reads PROGRESS.md + feature-list.json
8. Code-doc sync: triple defense operational, mapping table matches project structure
9. Tokens: CLAUDE.md <= 1,500 tokens, per-task ~3,800 tokens

Report each item as PASS/FAIL. For each FAIL:
1. Identify the specific gap (missing file, missing section, wrong model routing, etc.)
2. Regenerate or patch the specific file — do not re-run the entire phase
3. Re-verify only the failed item
4. If a FAIL persists after 2 fix attempts, report to user with the specific issue

### Step 9: Initial Commit
Stage only the generated harness files explicitly — never use `git add .` to avoid accidentally staging sensitive files.
```bash
git add CLAUDE.md PROGRESS.md CHANGELOG.md feature-list.json .claude/ hooks/ scripts/ src/**/CLAUDE.md
git commit -m "harness: initial setup via harness-boot"
```

### Step 10: Complete
Guide the user to the next step: start development with the `/start` command.

## Principles
- Follow the 4 principles: TDD-First / Iteration Convergence / Code-Doc Sync / Anti-Rationalization
- User confirmation required between each phase (no autonomous progression)
- If tech stack is unspecified, wait for developer selection (no autonomous selection)
- Mark anything not in the plan as `{TODO: needs confirmation}`
