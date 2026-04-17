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

### Step 1: Analyze Plan — Sequential Interactive Setup

Read the plan, then guide the user through decisions **one question at a time**. Each question must:
- Present **numbered choices** the user can select by number
- Include a **recommended option** (marked with ★)
- Allow free-text input for custom answers
- Wait for the user's response before proceeding to the next question

Do NOT batch multiple questions. Do NOT dump all analysis results at once.

#### Step 1.1: Plan Summary (no question — informational)
Show a brief summary of the analyzed plan:
```
📋 Plan analyzed: {plan title}
   {N} modules, {M} features, {K} integration points
```

#### Step 1.2: Code Comment Language
Output text language auto-detects from the system locale (no question needed). Code comment language requires explicit choice:
```
Code comment language:
(1) ★ {system locale language} — match your environment
(2) English
(3) Custom — type your own
```
Store the selection in `environment.md` as `comment_language`. This setting is referenced by tdd-implementer, tdd-refactorer, and reviewer agents when enforcing Comment Rules (Section 7.2).

#### Step 1.3: Tech Stack
- If plan specifies tech stack → show what was detected, ask to confirm:
  ```
  Detected tech stack: {stack}
  (1) ★ Confirm
  (2) Override — specify different stack
  ```
- If not specified → present 2-3 recommendations:
  ```
  Tech stack not specified. Recommendations:
  (1) ★ {Option A} — {one-line reason}
  (2) {Option B} — {one-line reason}
  (3) {Option C} — {one-line reason}
  (4) Custom — type your own
  ```

#### Step 1.4: Architecture Pattern
- If plan states prototype/PoC/MVP/spike → auto-select Simple Flat, inform user (no question)
- If plan specifies architecture → confirm (same pattern as tech stack)
- If scale assessment triggers (>= 2 of: 8+ features, 3+ categories, cross-cutting concerns):
  ```
  Project scale warrants an architecture pattern.
  (1) ★ {Recommended} — {plain-language, 1 sentence}
  (2) {Alternative} — {plain-language, 1 sentence}
  (3) Simple Layered — traditional layers, simplest option
  (4) Custom — describe your preference
  ```
- If scale does not warrant:
  ```
  Project is small/medium scale.
  (1) ★ Simple Layered (Recommended)
  (2) Choose a pattern anyway
  ```

#### Step 1.5: Execution Mode
```
Execution mode determines how agents work together.
(1) ★ {Recommended based on module analysis} — {reason}
(2) {Alternative} — {reason}

Analysis: {N} modules, {independence assessment}
```
Reference: `${CLAUDE_PLUGIN_ROOT}/docs/references/agent-design-patterns.md`

#### Step 1.6: QA Agent
Only ask if 3+ modules with integration points (per `${CLAUDE_PLUGIN_ROOT}/docs/references/qa-agent-guide.md`). Otherwise auto-skip with note.
```
3+ modules with integration points detected.
(1) ★ Include QA Agent — cross-boundary verification after each module
(2) Skip — rely on reviewer agent only
```

#### Step 1.7: Review & Confirm
After all questions answered, show a compact summary of all decisions and auto-derived items:
```
Setup Summary:
  Output language:   {auto-detected locale}
  Comment language:  {selected}
  Tech stack:        {selected}
  Architecture:      {selected}
  Execution mode:    {selected}
  QA agent:          {yes/no}
  Features:        {N} features ({M} tdd, {K} state-verification, {L} integration)
  Agents:          {count} ({additions/removals from default 9})
  Skills:          8 (adapted for {project type})
  Expected files:  ~{N} across 6 phases

(1) ★ Approve — proceed to Phase 1
(2) Change a decision — which one?
```

#### Auto-derived items (computed silently, shown in summary)
These are derived from the plan and user decisions without additional questions:
- Sub CLAUDE.md target directories
- feature-list.json draft (with `depends_on` and `test_strategy` classification)
- Code-doc sync mapping draft
- Hook script customizations per tech stack
- Rationalization candidates per skill
- Domain persona draft
- Expected file count per phase

### Step 2: Phase 1 — Infrastructure
- `.claude/settings.json` (hook configuration)
- `hooks/` 6 scripts (executable bash, shebang + stdin JSON parsing)
- `.claude/environment.md`
- `.claude/security.md`
- `.claude/domain-persona.md` (domain context for agents, from Step 1 draft)
- `scripts/init-harness.sh`
- `scripts/doc-impact-check.sh`
- `scripts/task-decompose.sh`
- `scripts/update-feature-status.sh` (auto-update feature-list.json passes field after Gate 4)
- `_workspace/.gitkeep` (intermediate outputs directory for Agent Team file-based transfer)

**Phase 1 completion report → record `last_completed_phase: 1` in PROGRESS.md → user confirmation → Phase 2**

### Step 3: Phase 2 — Core Protocols
- `.claude/protocols/` 5 protocols (tdd-loop, iteration-cycle, code-doc-sync, session-management, message-format)
- `CLAUDE.md` (main, <= 1,500 tokens)
- `.claude/quality-gates.md`

**Phase 2 completion report → record `last_completed_phase: 2` in PROGRESS.md → user confirmation → Phase 3**

### Step 4: Phase 3 — Agents + Execution Mode
Each agent YAML frontmatter includes a `model:` field.

**Default 9 agents:**
- `orchestrator.md` (model: opus)
- `architect.md` (model: opus)
- `reviewer.md` (model: opus)
- `debugger.md` (model: opus)
- `implementer.md` (model: sonnet)
- `tdd-test-writer.md` (model: sonnet)
- `tdd-implementer.md` (model: sonnet)
- `tdd-refactorer.md` (model: sonnet, effort: low)
- `tester.md` (model: sonnet)

**Conditional agents (from Step 1):**
- `qa-agent.md` (model: opus) — if QA agent inclusion was confirmed
- Module-specific implementer agents — if Agent Team mode with module specialization

**Execution mode integration:**
- If **Agent Team** mode: Add `## Team Communication Protocol` section to each agent definition (receive/send/task requests). Generate orchestrator agent definition with `TeamCreate`/`SendMessage`/`TaskCreate` workflow per `${CLAUDE_PLUGIN_ROOT}/docs/references/orchestrator-template.md` Template A.
- If **Sub-agent** mode: Current default. Orchestrator uses `Agent` tool calls only. Template B.
- If **Hybrid** mode: Orchestrator specifies execution mode per phase. Template C.

Record execution mode in orchestrator agent's `metadata.execution-mode` frontmatter field (in `.claude/agents/orchestrator.md`).

**Phase 3 completion report → record `last_completed_phase: 3` in PROGRESS.md → user confirmation → Phase 4**

### Step 5: Phase 4 — 8 Skills (Anthropic Agent Skills Format)
Each skill follows the [Anthropic Agent Skills Specification](https://github.com/anthropics/skills).
Generate as `skill-name/SKILL.md` (uppercase) with optional `references/`, `scripts/`, `assets/` subdirectories.

Refer to `${CLAUDE_PLUGIN_ROOT}/docs/setup-guide.md` Section 8 for complete generation rules:
- 8.2: YAML frontmatter schema (field validation rules)
- 8.3: 7-section anatomy template with full example
- 8.4: Progressive disclosure (3-tier token budget)
- 8.5: Description writing guide (TRIGGER/DO NOT TRIGGER pattern)
- 8.6: Skill list with specific triggers per skill
- 8.7: Complete skill example (new-feature)
- 8.8: Validation checklist (10 items)

Must follow 7-section anatomy (Overview / When to Use / TDD Focus / Process / Common Rationalizations (>= 3 rows) / Red Flags (>= 2 items) / Verification (with evidence)).

YAML frontmatter must include:
- `name` (1-64 chars, lowercase a-z/numbers/hyphens, matches directory name)
- `description` (WHAT + WHEN + TRIGGER + DO NOT TRIGGER, max 1024 chars)
- `metadata` (author, version, category at minimum)
- `allowed-tools` (space-separated tool list)

Skills to generate:
- `new-feature`, `bug-fix`, `refactor`, `tdd-workflow`
- `api-endpoint`, `db-migration`, `deployment`, `context-engineering`

Additional: `.claude/examples/`, `.claude/context-map.md`

**Phase 4 completion report → record `last_completed_phase: 4` in PROGRESS.md → user confirmation → Phase 5**

### Step 6: Phase 5 — Sub CLAUDE.md
Generate sub CLAUDE.md for each target directory identified in Step 1.
- If an architecture pattern was selected in Step 1, each sub CLAUDE.md must include an "Architecture Context" section specifying which layer/boundary the directory belongs to and its dependency rules.

**Phase 5 completion report → record `last_completed_phase: 5` in PROGRESS.md → user confirmation → Phase 6**

### Step 7: Phase 6 — State Tracking
- `feature-list.json` (extracted as JSON from the plan, all `passes: false`). Include:
  - `depends_on` arrays based on analysis of feature descriptions, shared modules, and tdd_focus overlaps. Validate: no circular dependencies (topological sort), array order respects dependencies. Present dependency graph to user for confirmation.
  - `test_strategy` per feature: classify as `"tdd"` (pure logic), `"state-verification"` (rendering/UI/DOM), or `"integration"` (wiring/entry points). Default to `"tdd"` when ambiguous. Present classification to user for confirmation.
- `PROGRESS.md`
- `CHANGELOG.md`
- `.claude/error-recovery.md`
- `.claude/observability.md`

### Step 8: Verification
Verify the entire generated harness:
1. File completeness: settings.json + 6 hooks + 9+ agents + 8 skills + 5 protocols + feature-list.json + scripts/update-feature-status.sh
2. Runtime guardrails: hook stdin JSON parsing, security-gate exit 2, doc-sync-check commit blocking, coverage-gate commit blocking
3. Skill anatomy (per setup-guide.md Section 8.8):
   - Directory name matches `name` field (lowercase a-z/numbers/hyphens)
   - File named `SKILL.md` (uppercase)
   - `name` field: 1-64 chars, valid chars, no leading/trailing/consecutive hyphens
   - `description` field: 1-1024 chars, includes WHAT + WHEN + TRIGGER + DO NOT TRIGGER
   - All 7 sections present (Overview/When to Use/TDD Focus/Process/Rationalizations/Red Flags/Verification)
   - Rationalizations >= 3 rows, each rebuttal domain-specific
   - Red Flags >= 2 items
   - Verification includes evidence types (logs/diff/reports/coverage)
   - SKILL.md <= 500 lines
   - File references use relative paths, referenced files exist
4. Quality gates: Gates 0-4, all checks with evidence types, rationalization defense
5. TDD: 3 sub-agent frontmatters, Red → Green call order
6. Model routing: opus for 4+ agents (orchestrator, architect, reviewer, debugger; +qa-agent if included) / sonnet for 5 agents (implementer, tdd-test-writer, tdd-implementer, tdd-refactorer, tester) via frontmatter model: field
7. Cross-session: bootstrap hook → reads PROGRESS.md + feature-list.json
8. Code-doc sync: triple defense operational, mapping table matches project structure
9. Tokens: CLAUDE.md <= 1,500 tokens, per-task ~3,900-4,000 tokens
10. Architecture: If pattern was selected, verify environment.md contains pattern rules, sub CLAUDE.md files reference their layer/boundary, and architect agent includes pattern constraints
11. Domain persona: domain-persona.md exists, contains all 6 sections (Purpose, Key Entities, Domain Rules, Vocabulary, Stakeholder Concerns, Success Criteria), entities table has >= 2 rows, domain rules has >= 2 items
12. Execution mode: orchestrator has `metadata.execution-mode` field; if Agent Team mode, agents have `## Team Communication Protocol` section; if QA agent included, qa-agent.md exists with `model: opus`
13. Data transfer: if Agent Team or Hybrid mode, orchestrator specifies data transfer protocols (message/task/file-based); `_workspace/` directory convention documented

Report each item as PASS/FAIL. For each FAIL:
1. Identify the specific gap (missing file, missing section, wrong model routing, etc.)
2. Regenerate or patch the specific file — do not re-run the entire phase
3. Re-verify only the failed item
4. If a FAIL persists after 2 fix attempts, report to user with the specific issue

### Step 9: Initial Commit
Stage only the generated harness files explicitly — never use `git add .` to avoid accidentally staging sensitive files.
```bash
git add CLAUDE.md PROGRESS.md CHANGELOG.md feature-list.json .claude/ hooks/ scripts/ _workspace/.gitkeep src/**/CLAUDE.md
git commit -m "harness: initial setup via harness-boot"
```

### Step 10: Complete
Show final summary with cumulative metrics:
```
Setup complete — {total_files} files generated across 6 phases
  Tokens: {cumulative_tokens} | Total time: {elapsed}
```
Guide the user to the next step: start development with the `/start` command.

## Principles
- Follow the 5 principles: TDD-First / Iteration Convergence / Code-Doc Sync / Anti-Rationalization / One Question at a Time
- **One question at a time**: Never batch multiple decisions. Present numbered choices with a recommended option (★). Wait for response before next question.
- User confirmation required between each phase (no autonomous progression)
- Never auto-select tech stack, architecture, or execution mode without developer confirmation
- Mark anything not in the plan as `{TODO: needs confirmation}`
