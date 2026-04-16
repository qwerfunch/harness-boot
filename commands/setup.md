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
10. **Architecture pattern**
    - If plan states prototype/PoC/MVP/spike → skip architecture (Simple Flat), inform user
    - If plan specifies architecture → adopt as-is
    - If scale warrants (>= 2 of: 8+ features, 3+ domain categories, cross-cutting concerns present) → present 2-3 recommendations with plain-language explanations, pros/cons, and tech stack fit → wait for user selection
    - If scale does not warrant → "Simple Layered recommended" → ask user to confirm or override
11. **Domain persona draft** (project purpose, key entities with invariants, domain rules, vocabulary, stakeholder concerns, success criteria — extracted from plan MD per setup-guide.md Section 3)
12. **Execution mode recommendation** (per setup-guide.md Section 9.0)
    - Analyze module independence, feature parallelism, integration complexity, domain categories
    - If 3+ independent modules with distinct domains → recommend **Agent Team** (with architecture pattern: Fan-out/Fan-in, Supervisor, etc.)
    - If features are tightly sequential → recommend **Sub-agent** (current default)
    - If mix → recommend **Hybrid** with per-phase mode specification
    - Reference: `${CLAUDE_PLUGIN_ROOT}/docs/references/agent-design-patterns.md`
    - Wait for developer confirmation (never auto-select)
13. **QA agent inclusion** — If 3+ modules with integration points, recommend adding a QA agent for cross-boundary verification (per `${CLAUDE_PLUGIN_ROOT}/docs/references/qa-agent-guide.md`)
14. **CI/CD platform detection** (per setup-guide.md Section 14)
    - Check `git remote get-url origin` → detect GitHub/GitLab/Bitbucket
    - If no remote or unrecognized → ask developer: "GitHub Actions / GitLab CI / None"
    - If "None" → skip CI workflow generation (local hooks still enforce gates)

**Proceed to Step 2 only after user confirmation.**

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
- CI/CD workflow (if platform selected: `.github/workflows/quality-gates.yml` for GitHub, `.gitlab-ci.yml` for GitLab; skipped if "None")

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
- `feature-list.json` (extracted as JSON from the plan, passes: false)
- `PROGRESS.md`
- `CHANGELOG.md`
- `.claude/error-recovery.md`
- `.claude/observability.md`

### Step 8: Verification
Verify the entire generated harness:
1. File completeness: settings.json + 6 hooks + 9+ agents + 8 skills + 5 protocols + feature-list.json + scripts/update-feature-status.sh + CI/CD workflow (if platform selected)
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
14. CI/CD (if platform selected): workflow file exists at correct path (`.github/workflows/` or `.gitlab-ci.yml`), placeholders replaced with tech-stack-specific commands, gates 1-4 jobs present. If "None" selected, verify PROGRESS.md notes "CI/CD: deferred"

Report each item as PASS/FAIL. For each FAIL:
1. Identify the specific gap (missing file, missing section, wrong model routing, etc.)
2. Regenerate or patch the specific file — do not re-run the entire phase
3. Re-verify only the failed item
4. If a FAIL persists after 2 fix attempts, report to user with the specific issue

### Step 9: Initial Commit
Stage only the generated harness files explicitly — never use `git add .` to avoid accidentally staging sensitive files.
```bash
git add CLAUDE.md PROGRESS.md CHANGELOG.md feature-list.json .claude/ hooks/ scripts/ _workspace/.gitkeep src/**/CLAUDE.md
# If CI workflow was generated:
# git add .github/workflows/quality-gates.yml  (GitHub)
# git add .gitlab-ci.yml                       (GitLab)
git commit -m "harness: initial setup via harness-boot"
```

### Step 10: Complete
Guide the user to the next step: start development with the `/start` command.

## Principles
- Follow the 4 principles: TDD-First / Iteration Convergence / Code-Doc Sync / Anti-Rationalization
- User confirmation required between each phase (no autonomous progression)
- If tech stack is unspecified, wait for developer selection (no autonomous selection)
- If architecture pattern is unspecified and project scale warrants it, wait for developer selection (no autonomous selection)
- If execution mode is recommended, wait for developer confirmation (no autonomous selection)
- Mark anything not in the plan as `{TODO: needs confirmation}`
