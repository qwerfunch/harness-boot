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
3. Load harness spec index: `${CLAUDE_PLUGIN_ROOT}/docs/setup/INDEX.md`. Always-on topic files at session start: `${CLAUDE_PLUGIN_ROOT}/docs/setup/philosophy-and-layout.md` and `${CLAUDE_PLUGIN_ROOT}/docs/setup/generation-rules.md`. Pull additional files per the INDEX Phase→Files map as each phase runs — never load the legacy `docs/setup-guide.md` (deprecated).
4. Check if PROGRESS.md exists
   - If exists with `last_completed_phase: N` where N ∈ {1..5} (unambiguous in-progress): **auto-resume from Phase {N+1}**, inform user: "Resuming from Phase {N+1}. (To start over, delete PROGRESS.md and re-run.)" No question.
   - If exists with `last_completed_phase: setup_complete`: ask "Harness is already set up. (1) ★ Exit  (2) Overwrite and regenerate"
   - If exists but `last_completed_phase` is missing/corrupt: ask "A harness exists but its state is unclear. (1) ★ Overwrite  (2) Exit"
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
Conversation language (spinner messages and prompts shown to the user) auto-detects from the system locale and is recorded as `conversation_language` — no question needed. Machine-facing harness files (`CLAUDE.md`, `.claude/**`, `feature-list.json`, `PROGRESS.md`, `hooks/*.sh`, `scripts/*.sh`) are **always English** regardless of locale (parsed by hooks or loaded into LLM context). User-facing docs (`README.md`, `CHANGELOG.md`) follow `conversation_language` — humans only. Code comment language requires an explicit choice:
```
Code comment language (applies to source code comments only — machine-facing harness files are always English; README/CHANGELOG follow conversation language):
(1) ★ {system locale language} — match your environment
(2) English
(3) Custom — type your own
```
Store the selection in `environment.md` as `comment_language`. This setting is referenced by tdd-implementer, tdd-refactorer, and reviewer agents when enforcing Comment Rules (see `${CLAUDE_PLUGIN_ROOT}/docs/setup/code-style.md#comment-rules`).

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

#### Step 1.5: Module Extraction (no question — informational)

Run the **Module Extraction algorithm** (see `${CLAUDE_PLUGIN_ROOT}/docs/setup/domain-persona.md#module-extraction` — seed from Key Entities, merge by Bounded Context and `tdd_focus` overlap, output `module_count` + `modules` slug list). The output feeds Step 1.6 (QA agent decision) and Phase 3 (`implementer-<slug>.md` generation); do not re-derive modules elsewhere.

Report to the user:
```
Module Extraction: {module_count} module(s) detected [{modules}]
```

Execution is always **Agent Team**. Single-module projects (`module_count == 1`) use a team of one implementer + reviewer. Reference: `${CLAUDE_PLUGIN_ROOT}/docs/references/agent-design-patterns.md`.

#### Step 1.6: QA Agent (auto-decided, no question)

Automatically **include** the QA agent when both conditions hold; otherwise **skip**. The decision is surfaced in the Step 1.7 summary (`QA agent: yes/no`) so the user can override it via "Change a decision" if needed.

**Inclusion conditions (both must hold)**:
1. `module_count ≥ 3` (from the Step 1.5 Module Extraction output)
2. `integration_point_pair_count ≥ 2`, where an **integration point** between module pair `(A, B)` is counted when either:
   - `A.doc_sync` and `B.doc_sync` share at least one path, OR
   - Any `tdd_focus` symbol owned by one module is called (by name match in the plan's call graph or feature description) by the other module

   A pair `(A, B)` contributes at most 1 to the count regardless of how many individual integration points it has. The count is the number of module pairs with ≥ 1 integration point.

**Examples**:
- 4 modules, pairs with integration: `(auth, order)` + `(order, billing)` → count = 2 → **include**.
- 3 modules, only `(auth, order)` has integration → count = 1 → **skip**.
- 2 modules (`module_count < 3`) → **skip** regardless of integration density — use in-line reviewer checks instead of a dedicated QA agent.

See `${CLAUDE_PLUGIN_ROOT}/docs/references/qa-agent-guide.md` for the QA agent's review methodology.

#### Step 1.7: Review & Confirm
After all questions answered, show a compact summary of all decisions and auto-derived items:
```
Setup Summary:
  Conversation lang: {auto-detected locale} (spinner/prompts/summaries + README.md/CHANGELOG.md; machine-facing files stay English)
  Comment language:  {selected}
  Tech stack:        {selected}
  Architecture:      {selected}
  QA agent:          {yes/no}
  Features:        {N} features ({M} lean-tdd, {T} tdd, {K} state-verification, {L} integration)
  Agents:          {count} ({additions/removals from default 9})
  Skills:          8 (adapted for {project type})
  Expected files:  ~{N} across 6 phases

(1) ★ Approve — proceed to Phase 1
(2) Change a decision — which one?
```

If the user picks (2), ask a single follow-up question (one question at a time, numbered choices):
```
Which decision to revise?
(1) Conversation language     (2) Comment language
(3) Tech stack                (4) Architecture pattern
(5) Execution mode            (6) QA agent inclusion
```
Re-ask only the selected question, then return to the Step 1.7 summary for re-approval. Do not cascade edits to unrelated decisions.

#### Auto-derived items (computed silently, shown in summary)
These are derived from the plan and user decisions without additional questions:
- Module → layer mapping (for `.claude/context-map.md` in Phase 5)
- feature-list.json draft (with `depends_on` and `test_strategy` classification)
- Code-doc sync mapping draft
- Hook script customizations per tech stack
- Rationalization candidates per skill
- Domain persona draft
- Expected file count per phase

### Step 2: Phase 1 — Infrastructure
- `.claude/settings.json` (hook configuration — see `${CLAUDE_PLUGIN_ROOT}/docs/setup/runtime-guardrails.md`)
- `hooks/` 6 scripts — **copy from `${CLAUDE_PLUGIN_ROOT}/docs/templates/hooks/`** (not LLM-generated):
  - 5 scripts (`session-start-bootstrap.sh`, `pre-tool-security-gate.sh`, `pre-tool-doc-sync-check.sh`, `post-tool-format.sh`, `post-tool-test-runner.sh`) are copied verbatim — they are stack-agnostic (extension-dispatched or language-independent).
  - 1 script (`pre-tool-coverage-gate.sh`) requires substituting `{COVERAGE_COMMAND}` and `{COVERAGE_FILE}` using the row in `${CLAUDE_PLUGIN_ROOT}/docs/templates/stacks.md` matching the selected tech stack.
  - `chmod +x hooks/*.sh` after copying.
  - If the stack is not in `stacks.md`, ask the developer: "What coverage command and output file path do you use?" and record the answer in `.claude/environment.md`.
- `.claude/environment.md`
- `.claude/security.md`
- `.claude/domain-persona.md` (domain context for agents, from Step 1 draft)
- `scripts/update-feature-status.sh` (auto-update feature-list.json passes field after Gate 4)
- `_workspace/.gitkeep` (intermediate outputs directory for Agent Team file-based transfer)
- `.gitignore` (generated from Tech Stack selection — includes .env, IDE files, build outputs, language-specific patterns)

### Step 3: Phase 2 — Core Protocols
- `.claude/protocols/` 5 protocols — **copy from `${CLAUDE_PLUGIN_ROOT}/docs/templates/protocols/`** (not LLM-generated):
  - `tdd-loop.md`, `iteration-cycle.md`, `code-doc-sync.md`, `session-management.md`, `message-format.md`
  - All 5 are stack-agnostic — copy verbatim.
  - Skip `message-format.md` when Step 1.5 resolved to `sub-agent` mode (it is only consumed by Agent Team / Hybrid); keep the other 4 in all modes.
- `CLAUDE.md` (main, <= 1,500 tokens)
- `README.md` (in `conversation_language` — same value Phase 1 writes to `environment.md`; Phase 2 uses the locale detected in Step 1.2 directly, no file read required; content: project name, description, tech stack, getting started, project structure, dev guide, license placeholder)
- `.claude/quality-gates.md`

### Phase 1 + Phase 2 Parallel Execution

**Run Phase 1 and Phase 2 concurrently** — they have no dependencies between them. Issue all file-generation tool calls for both phases in a single message with parallel tool calls (one per file). Dependencies are strictly within-phase (none between phases):
- Phase 1 writes: settings.json, hooks/, environment.md, security.md, domain-persona.md, scripts/*.sh, _workspace/.gitkeep, .gitignore
- Phase 2 writes: .claude/protocols/*.md, CLAUDE.md, README.md, .claude/quality-gates.md

After **both** phases finish, record `last_completed_phase: 2` in PROGRESS.md → auto-proceed to Phase 3. Pause only if any step errors.

> **Resume semantics**: If an earlier interrupted run recorded `last_completed_phase: 1`, treat Phase 1 as done and run Phase 2 alone. The parallel model only applies when both are pending.

### Step 4: Phase 3 — Agents + Execution Mode
Each agent YAML frontmatter includes a `model:` field.

**Default 9 agents:**
- `orchestrator.md` (model: opus)
- `architect.md` (model: opus)
- `reviewer.md` (model: opus)
- `debugger.md` (model: opus)
- `implementer.md` (model: sonnet)
- `tdd-implementer.md` (model: sonnet)
- `tdd-refactorer.md` (model: sonnet, effort: low)
- `bdd-writer.md` (model: sonnet, effort: low) — always generated (lean-tdd is the default strategy). See `${CLAUDE_PLUGIN_ROOT}/docs/setup/tdd-isolation.md` for the full agent definition.
- `tester.md` (model: sonnet)

**Conditional agents (from Step 1 / feature-list.json):**
- `qa-agent.md` (model: opus) — if QA agent inclusion was confirmed
- `tdd-test-writer.md` (model: sonnet) — if `feature-list.json` contains at least one feature with `"test_strategy": "tdd"` or `"test_strategy": "state-verification"`. Skip otherwise (`lean-tdd` uses `bdd-writer`; `integration` uses `tester`).
- **Module-specific implementer agents**:
  - For each slug produced by the **Module Extraction algorithm** (`${CLAUDE_PLUGIN_ROOT}/docs/setup/domain-persona.md#module-extraction`) at Step 1.5, generate `implementer-<module-slug>.md` (model: sonnet). Do not re-derive modules here — use the frozen slug set from Step 1.5.
  - All module implementers are instantiated from the same `implementer.md` body; per-instance overrides live in the YAML frontmatter (`metadata.module: <slug>`, `metadata.allowed-paths: [...]`) and in one inlined "Module scope" block referencing the matching row from `.claude/context-map.md`.
  - The generic `implementer.md` is the template of record; it is not registered as a team member.
  - Count: one per module (minimum 1 for single-module projects — team of one implementer + reviewer).

**Sub-agent input contract**:
- When generating `tdd-test-writer.md` (if emitted), inject the "TDD sub-agent input sanitization" clause from `commands/start.md` Step 4 into the agent prompt body under a `## Inputs` section. The clause lists what fields the writer may read and what implementation hints must be absent; the writer self-checks on receipt and aborts with a note to `_workspace/` if the inputs look contaminated.
- When generating `bdd-writer.md`, inject the parallel "BDD sub-agent input sanitization" clause from `commands/start.md` Step 4 under a `## Inputs` section. The clause lists the allowed input fields (`acceptance_test` array + public type headers only) and explicitly forbids implementation references; the writer self-checks and aborts to `_workspace/` on contamination.

**Rule text injection (inline-embed, MANDATORY)**:

Subagents invoked via the `Agent` tool cannot resolve `${CLAUDE_PLUGIN_ROOT}` paths — their system prompt is the literal body of their agent file. Any rule referenced only as `see ${CLAUDE_PLUGIN_ROOT}/...` is unreadable at runtime. Phase 3 MUST embed the following rule texts verbatim into generated agent files by reading the source and copying the section body (not a link).

1. **Language Settings block** — embed into every generated agent (`orchestrator.md`, all `implementer-*.md`, `reviewer.md`, `qa-agent.md` if included, `architect.md`, `debugger.md`, `tester.md`, `tdd-implementer.md`, `tdd-refactorer.md`, `bdd-writer.md`, `tdd-test-writer.md` if generated). Read `conversation_language` (from the locale detected in Step 1.2) and `comment_language` (from `.claude/environment.md`) and write a `## Language Settings` section at the top of the agent body:
   ```markdown
   ## Language Settings
   - conversation_language: <value>   # user-facing messages, spinner, prompts, summaries
   - comment_language: <value>         # file headers, JSDoc, inline why-comments in source code
   Respond to the user in conversation_language. Write all source-code comments in comment_language. Machine-facing files (CLAUDE.md, .claude/**/*.md, feature-list.json, PROGRESS.md, hooks/*.sh, scripts/*.sh) stay English regardless.
   ```

2. **Comment Rules** — embed into `tdd-implementer.md`, `tdd-refactorer.md`, and `reviewer.md`. Read `${CLAUDE_PLUGIN_ROOT}/docs/setup/code-style.md` and copy the section body starting at the `## Comment Rules <!-- anchor: comment-rules -->` heading through (but not including) the next `## ` heading. Paste it verbatim into the agent body under a `## Comment Rules` section. Do not paraphrase; do not replace with a link.

3. **TDD Cycles + Gate 0 Evidence** — embed into `orchestrator.md`, every `implementer-<slug>.md`, and `reviewer.md`. Read `${CLAUDE_PLUGIN_ROOT}/docs/protocols/tdd-cycles.md` and copy:
   - All four `## Cycle: <strategy>` sections (from each `## Cycle:` heading through the next `## ` heading)
   - The full `## Gate 0 Evidence Verification` section including its four `### <strategy>` sub-blocks
   Paste verbatim under `## TDD Cycles` and `## Gate 0 Evidence` sections in the agent body. This lets the agent route by `test_strategy` at runtime without needing to read the plugin.

4. **File Classification for tdd-test-writer / bdd-writer** — embed into `bdd-writer.md` (always) and `tdd-test-writer.md` (if generated). Read `${CLAUDE_PLUGIN_ROOT}/docs/setup/tdd-isolation.md` and copy the section body under `## File Classification for tdd-test-writer <!-- anchor: file-classification-for-tdd-test-writer -->` verbatim into each agent body under `## File Classification`. `bdd-writer.md` additionally appends one line: `For bdd-writer, the input is further narrowed to the feature's acceptance_test array plus the above-allowed type headers — no other test files are read.`

5. **Feature Selection Algorithm** — embed into `orchestrator.md`. Read `${CLAUDE_PLUGIN_ROOT}/commands/start.md` anchor `<!-- anchor: feature-selection-algorithm -->` and copy the section body (from the `#### Feature selection` anchor heading through the end of Step 3, i.e., up to but not including `### Step 4: Execute Development Cycle`) verbatim into the agent body under `## Feature Selection Algorithm`. The orchestrator's Phase 1 Feature Selection MUST use this algorithm — selecting a single feature is only correct when the independence check or dependency gate rules multi-feature parallel dispatch out; the default for multi-module projects is a parallel wave. Do not paraphrase or collapse to "pick the first unblocked feature."

6. **Message Format Contract** — embed into `orchestrator.md`, every `implementer-<slug>.md`, `reviewer.md`, and `qa-agent.md` (if generated). Read `${CLAUDE_PLUGIN_ROOT}/docs/templates/protocols/message-format.md` anchor `<!-- anchor: core-fields -->` and copy the section body covering the Core fields table, Message kinds table, and Status enum (through the end of the `## Status enum` section, up to but not including `## \`_workspace/\` naming convention`) verbatim into each agent body under `## Message Format`. This guarantees every communicating agent knows the 8 `kind` enum values (`task-assigned`, `artifact-ready`, `review-request`, `review-result`, `qa-report`, `coordinate`, `escalate`, `cancel-pending`) and the 6 `status` enum values without needing to load the external protocol file at runtime.

7. **Coordinate Round-Trip** — embed into every `implementer-<slug>.md`. Read `${CLAUDE_PLUGIN_ROOT}/docs/templates/protocols/message-format.md` anchor `<!-- anchor: coordinate-round-trip -->` and copy the section body (through the end of the `## Coordination across modules` section, up to but not including `## Out of scope`) verbatim into the agent body under `## Coordinate Round-Trip`. This encodes the responder side of the negotiation: receive a `coordinate` message → respond with `status: completed` (accepted) OR `status: blocked` (counter-proposal in a new artifact) → 3 rounds maximum → escalate to orchestrator on unresolved round 3. Implementers that carry only the sending side of coordinate cannot participate in bidirectional contract negotiation.

8. **Workspace Artifact Path Convention** — embed into every `implementer-<slug>.md`, `reviewer.md`, `qa-agent.md` (if generated), `tdd-implementer.md`, `tdd-refactorer.md`, `bdd-writer.md`, and `tdd-test-writer.md` (if generated). Read `${CLAUDE_PLUGIN_ROOT}/docs/templates/protocols/message-format.md` anchor `<!-- anchor: workspace-naming -->` and copy the section body (through the end of the `## \`_workspace/\` naming convention` section, up to but not including `## Example — fan-out and collect`) verbatim into the agent body under `## Artifact Path`. This ensures every agent that writes to `_workspace/` uses the `_workspace/{phase}_{agent}_{artifact}.{ext}` pattern — cross-agent consistency is a precondition for `SendMessage` `artifact_path` correctness.

9. **Iteration Tracking** — embed into every `implementer-<slug>.md` (module-specific). Read `${CLAUDE_PLUGIN_ROOT}/commands/start.md` anchor `<!-- anchor: iteration-tracking -->` and copy the section body covering the four-step iteration counter protocol (read → increment → check `> 5` → escalate/reset) verbatim into the agent body under `## Iteration Tracking`. This is the only convergence-failure guard; module implementers that drop it risk unbounded retry loops. The generic `implementer.md` template is not a substitute — each module implementer must carry its own copy.

10. **Cross-Module Review Stage** — embed into `reviewer.md`. Read `${CLAUDE_PLUGIN_ROOT}/docs/setup/agents-and-gates.md` anchor `<!-- anchor: cross-module-review -->` and copy the section body (through the end of the `### Gate 2: Cross-Module Review Stage` section, up to but not including the next `### ` heading) verbatim into the agent body under `## Cross-Module Review`. This stage is required when a feature's `tdd_focus` or `doc_sync` spans two or more modules; the reviewer reads both sides of each boundary in parallel, folds any `qa-report` as input, and classifies findings as Critical/Major/Minor per the stage's procedure. Reviewers without this section treat cross-module features identically to single-module features and silently miss boundary drift.

11. **QA Invocation Timing** — embed into `orchestrator.md` AND `qa-agent.md` (the latter only when generated). Read `${CLAUDE_PLUGIN_ROOT}/commands/start.md` anchor `<!-- anchor: qa-invocation-timing -->` and copy the section body covering both invocation points (per-module after Gate 1; session-end sweep before any termination path) verbatim into each agent body under `## QA Invocation Timing`. This fixes the most common QA regression: orchestrators that only trigger QA for cross-module features and skip the session-end sweep. Both triggers are mandatory whenever qa-agent is present.

Embedding is done inside the `/setup` slash-command context (top-level), which CAN resolve `${CLAUDE_PLUGIN_ROOT}`. Subagents only ever see the post-embed files.

**Team Communication Protocol integration:**
Add `## Team Communication Protocol` section **only to agents that actually exchange team messages** — orchestrator, module-specific implementers, reviewer, and qa-agent (if included). Non-communicating agents (`architect`, `debugger`, `tester`, `bdd-writer`, and all `tdd-*` sub-agents) **omit the section** to avoid empty-ceremony placeholders. `${CLAUDE_PLUGIN_ROOT}/docs/references/orchestrator-template.md` is a **structural example** for the orchestrator's `TeamCreate`/`SendMessage`/`TaskCreate` workflow only; it is NOT the source of truth for selection, coordination, or QA timing semantics — those come from the inline-embed rules 5, 6, 7, 10, 11 above. Do not restate algorithms from the template; embed from the anchored sources.

**Generate agents in parallel.** Agents do not read each other's file bodies — cross-references are name-based only. Issue all agent-file `Write` tool calls in a single message (one per agent). The agent set (including optional qa-agent and conditional tdd-test-writer) must be resolved before dispatching — decide the set first, then write them all concurrently.

**Phase 3 complete → record `last_completed_phase: 3` in PROGRESS.md → auto-proceed to Phase 4.** Pause only if a step errors.

### Step 5: Phase 4 — 8 Skills (Anthropic Agent Skills Format)
Each skill follows the [Anthropic Agent Skills Specification](https://github.com/anthropics/skills).
Generate as `skill-name/SKILL.md` (uppercase) with optional `references/`, `scripts/`, `assets/` subdirectories.

Refer to `${CLAUDE_PLUGIN_ROOT}/docs/setup/skills-anatomy.md` for complete generation rules — YAML frontmatter schema, 7-section anatomy template, progressive disclosure token budget, description writing guide (TRIGGER/DO NOT TRIGGER pattern), the 8-skill list with triggers, a full `new-feature` example, and the validation checklist at `#validation-checklist`.

Must follow 7-section anatomy (Overview / When to Use / TDD Focus / Process / Common Rationalizations (>= 2 rows, domain-specific) / Red Flags (>= 2 items) / Verification (with evidence)).

YAML frontmatter must include:
- `name` (1-64 chars, lowercase a-z/numbers/hyphens, matches directory name)
- `description` (WHAT + WHEN + TRIGGER + DO NOT TRIGGER, max 1024 chars)
- `metadata` (author, version, category at minimum)
- `allowed-tools` (space-separated tool list)

Skills to generate:
- `new-feature`, `bug-fix`, `refactor`, `tdd-workflow`
- `api-endpoint`, `db-migration`, `deployment`, `context-engineering`

Additional: `.claude/examples/`

**Generate skills in parallel.** Each `SKILL.md` is self-contained (no cross-skill references in bodies). Issue all 8 skill-file `Write` tool calls in a single message. `.claude/examples/` may be written in the same batch. (`.claude/context-map.md` is produced in Phase 5, not here.)

**Phase 4 complete → record `last_completed_phase: 4` in PROGRESS.md → auto-proceed to Phase 5.** Pause only if a step errors.

### Step 6: Phase 5 — Context Map (module → layer mapping)

Generate a single `.claude/context-map.md` that maps modules to their architecture layer/boundary and the dependency rules that apply. **Do not** create per-directory sub `CLAUDE.md` files — layer rules are injected into sub-agent task prompts at dispatch time from this file.

The context-map.md content:
- **Bounded Contexts** table (Context → Owner Module → Key Entities from domain-persona.md)
- **Module → Layer Mapping** table (Module Path → Layer → Allowed Dependencies → Domain Rules IDs)
- **Context Relationships** table (Upstream → Downstream → Integration Pattern) — only if 2+ bounded contexts exist
- If architecture pattern was selected: include the full layer-rule block (dependency direction, disallowed imports, boundary enforcement)

Orchestrator and module-scoped sub-agents read context-map.md at session start; when dispatching a sub-agent for a specific module, the orchestrator inlines the relevant row into the task prompt (no per-directory file lookup required).

**Phase 5 complete → record `last_completed_phase: 5` in PROGRESS.md → auto-proceed to Phase 6.** Pause only if a step errors.

### Step 7: Phase 6 — State Tracking
- `feature-list.json` (extracted as JSON from the plan, all `passes: false`). Include:
  - `depends_on` arrays based on analysis of feature descriptions, shared modules, and tdd_focus overlaps. Validate: (a) no circular dependencies via topological sort, (b) array order respects dependencies.
    - **Auto-approve path** (no prompt): both (a) and (b) pass → log one-line summary (`Dependency graph: {N} features, acyclic, order-valid`) and continue.
    - **Prompt path**: if (a) fails (cycle) or (b) fails (out-of-order) → surface the specific violation and the proposed fix, wait for user confirmation before proceeding.
    - To revise an auto-approved graph later, delete `PROGRESS.md` and re-run `/setup` (error-recovery rebootstraps from Step 1). Step 1.7 runs before Phase 1 and cannot override a Phase 6 decision.
  - `test_strategy` per feature: classify as `"lean-tdd"` (default: TDD-shaped design, post-hoc BDD verification), `"tdd"` (safety-critical opt-in: strict Red/Green/Refactor isolation), `"state-verification"` (rendering/UI/DOM), or `"integration"` (wiring/entry points). Classification rules:
    - If `category` or `description` mentions any of `auth`, `payment`, `security`, `crypto`, `credential` (case-insensitive) → auto-assign `"tdd"`.
    - Rendering / canvas / DOM / UI feature → `"state-verification"`.
    - Wiring / entry-point / multi-module glue feature → `"integration"`.
    - Everything else → `"lean-tdd"`.
    Present the full classification as a single batch summary (all N features at once — this is an intentional exception to the "one question at a time" rule, since per-feature prompting would exceed the Phase 6 confirmation budget) with two numbered choices: `(1) ★ Approve all` or `(2) Revise specific features`. If (2), then ask one follow-up question listing the feature ids and accept a comma-separated list; for each listed feature, ask one question at a time to pick the new strategy.
  - **`acceptance_test` contract validation**: for every feature, verify `acceptance_test.length >= 3` and every entry contains `Given`/`When`/`Then` (case-insensitive). If any feature fails the check, ask the user per-feature (one question at a time, numbered choices): `(1) ★ Auto-draft the missing scenarios from description + tdd_focus` or `(2) Pause — I will rewrite the plan entry`.
- `PROGRESS.md`
- `CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com) format with `## [Unreleased]` section. Initial entry: "Added — Initial project setup via harness-boot, {N} features defined")
- `.claude/error-recovery.md`
- `.claude/observability.md`

### Step 8: Verification
Verify the entire generated harness:
1. File completeness: settings.json + 6 hooks + agents (9 base including `bdd-writer.md`; conditional: qa-agent if included, `tdd-test-writer.md` if any `tdd`/`state-verification` feature, one `implementer-<slug>.md` per module) + 8 skills + 5 protocols + feature-list.json + scripts/update-feature-status.sh
2. Runtime guardrails: hook stdin JSON parsing, security-gate exit 2, doc-sync-check commit blocking, coverage-gate commit blocking
3. Skill anatomy (4 gates — full rules in `${CLAUDE_PLUGIN_ROOT}/docs/setup/skills-anatomy.md#validation-checklist`):
   - **Structural**: `SKILL.md` exists, directory name matches frontmatter `name` field, all 4 required frontmatter fields present (`name`, `description`, `metadata`, `allowed-tools`)
   - **Anatomy**: All 7 body sections present (Overview / When to Use / TDD Focus / Process / Rationalizations / Red Flags / Verification), SKILL.md ≤ 500 lines
   - **Content floor**: Rationalizations ≥ 2 rows (domain-specific), Red Flags ≥ 2 items, Verification section names evidence types (logs / diff / reports / coverage)
   - **References**: File references use relative paths and the referenced files exist
4. Quality gates: Gates 0-4, all checks with evidence types, rationalization defense
5. TDD / BDD sub-agents: `tdd-implementer`, `tdd-refactorer`, `bdd-writer` frontmatters always present; `bdd-writer` asserts it does not read implementation code; `tdd-test-writer` frontmatter present iff any feature uses `"test_strategy": "tdd"` or `"state-verification"`; when present, Red → Green call order is enforced.
6. Model routing: each agent's frontmatter `model:` field matches the canonical assignment in `${CLAUDE_PLUGIN_ROOT}/docs/setup/model-routing.md` (Opus for the 4 judgment agents + qa-agent if included; Sonnet for the 5 execution agents including `bdd-writer`, plus `tdd-test-writer` and module-implementers when present).
7. Cross-session: bootstrap hook → reads PROGRESS.md + feature-list.json
8. Code-doc sync: triple defense operational, mapping table matches project structure
9. Tokens: CLAUDE.md <= 1,500 tokens, per-task ~3,900-4,000 tokens
10. Architecture: If pattern was selected, verify environment.md contains pattern rules, context-map.md contains the Module → Layer mapping, and architect agent includes pattern constraints
11. Domain persona: domain-persona.md exists, contains all 6 sections (Purpose, Key Entities, Domain Rules, Vocabulary, Stakeholder Concerns, Success Criteria), entities table has >= 2 rows, domain rules has >= 2 items
12. Team communication: communicating agents (orchestrator, module implementers, reviewer, qa-agent) have `## Team Communication Protocol` section — non-communicating agents (architect, debugger, tester, tdd-*) do NOT; if QA agent included, qa-agent.md exists with `model: opus`
13. Data transfer: orchestrator specifies data transfer protocols (message/task/file-based); `_workspace/` directory convention documented
14. **Placeholder sweep**: `grep -rEn '\{(COVERAGE_COMMAND|COVERAGE_FILE)\}' .claude/ hooks/ scripts/ 2>/dev/null` → must return zero matches. Any hit means Phase 1 Step 2 substitution was skipped — regenerate the affected hook from `${CLAUDE_PLUGIN_ROOT}/docs/templates/hooks/` with the correct `stacks.md` row, then re-run this check.
15. **Rule embed verification**: every generated agent file under `.claude/agents/` must contain a `## Language Settings` section. In addition:
    - `tdd-implementer.md`, `tdd-refactorer.md`, and `reviewer.md` must contain a `## Comment Rules` section whose body includes the phrase `Let the code say "what," and comments say only` (anchor line from code-style.md).
    - `orchestrator.md`, every `implementer-*.md`, and `reviewer.md` must contain `## TDD Cycles` and `## Gate 0 Evidence` sections; the embedded content must include the `## Cycle: lean-tdd` block and the `### lean-tdd` Gate 0 sub-block.
    - `bdd-writer.md` must contain a `## File Classification` section whose body includes the `acceptance_test`-only narrowing line, and an `## Inputs` section with the BDD sub-agent input sanitization clause.
    - `tdd-test-writer.md` (if generated) must contain a `## File Classification` section.
    - `orchestrator.md` must contain a `## Feature Selection Algorithm` section whose body includes **both** the phrase `module independence` AND the word `parallel`. An orchestrator that mentions only "pick the first" / "first feature" without the independence wording is a regression of the parallel-selection bug and MUST be regenerated from the `feature-selection-algorithm` anchor in `${CLAUDE_PLUGIN_ROOT}/commands/start.md`.
    - `orchestrator.md`, every `implementer-*.md`, `reviewer.md`, and (if present) `qa-agent.md` must contain a `## Message Format` section whose body includes the strings `task-assigned`, `coordinate`, `qa-report`, AND `status` (verifying both the kind catalog and the status enum were embedded). Missing any of the four strings means the message-format contract was truncated during generation.
    - Every `implementer-*.md` (module-specific) must contain a `## Coordinate Round-Trip` section whose body mentions both `3 rounds` (or `3 round`) AND `escalate`. Implementers without the responder-side flow cannot participate in contract negotiation.
    - Every `implementer-*.md`, `reviewer.md`, and (if present) `qa-agent.md`, `tdd-implementer.md`, `tdd-refactorer.md`, `bdd-writer.md`, `tdd-test-writer.md` must contain a `## Artifact Path` section whose body contains the literal pattern `_workspace/{phase}_{agent}_{artifact}`.
    - Every `implementer-*.md` (module-specific) must contain a `## Iteration Tracking` section whose body mentions `iteration > 5` AND either `debugger` or `Incidents`. Missing this section removes the only convergence-failure guard.
    - `reviewer.md` must contain a `## Cross-Module Review` section whose body mentions BOTH `qa-report` AND `boundary`. Reviewers without this stage treat cross-module features as single-module and miss boundary drift.
    - `orchestrator.md` AND (if present) `qa-agent.md` must contain a `## QA Invocation Timing` section whose body mentions both `per-module` AND `session-end`. Orchestrators missing the session-end sweep skip the final boundary verification and can ship undetected integration bugs.
    Any missing section means Phase 3 Step 4 rule injection was skipped — regenerate the affected agent from the source in `${CLAUDE_PLUGIN_ROOT}/docs/setup/`, `docs/protocols/`, `docs/templates/protocols/`, or `commands/start.md` (per the anchor table in the rule) and re-verify.

Report each item as PASS/FAIL. For each FAIL:
1. Identify the specific gap (missing file, missing section, wrong model routing, etc.)
2. Regenerate or patch the specific file — do not re-run the entire phase
3. Re-verify only the failed item
4. If a FAIL persists after 2 fix attempts, report to user with the specific issue

### Step 9: Initial Commit
Stage only the generated harness files explicitly — never use `git add .` to avoid accidentally staging sensitive files.
```bash
git add CLAUDE.md README.md PROGRESS.md CHANGELOG.md feature-list.json .gitignore .claude/ hooks/ scripts/ _workspace/.gitkeep
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
- **Auto-progress after Step 1.7 approval**: Phases 1-6 run without per-phase confirmations. `last_completed_phase` is still recorded in PROGRESS.md at every phase boundary so an interrupted session can auto-resume. Pause for the user only on errors, or when Phase 6 surfaces the dependency graph / test-strategy classification for confirmation.
- Never auto-select tech stack or architecture without developer confirmation
- Mark anything not in the plan as `{TODO: needs confirmation}`
- **Three-tier language policy**:
  1. **Machine-facing files — always English**: `CLAUDE.md`, `.claude/**/*.md` (agents, skills, protocols, domain-persona, context-map, environment, security, quality-gates, error-recovery, observability), `PROGRESS.md`, `feature-list.json`, `hooks/*.sh`, `scripts/*.sh`. These are parsed by hooks, loaded into LLM context at session start, or are executable code — locale variance breaks them.
  2. **User-facing docs — follow `conversation_language`**: `README.md` and `CHANGELOG.md`. Humans only; no hook parses them, no agent loads them for logic. Orchestrator writes CHANGELOG feature-completion entries in `conversation_language`. Keep a Changelog structural headings (`## [Unreleased]`, `### Added`, etc.) remain English as standard format markers.
  3. **Source code comments — follow `comment_language`**: Explicit Step 1.2 choice. Applies inside source files (`.ts`, `.py`, `.go`, etc.), never to `.md` files.
  See `${CLAUDE_PLUGIN_ROOT}/docs/setup/cross-session-state.md#language-settings` for the full rule.
