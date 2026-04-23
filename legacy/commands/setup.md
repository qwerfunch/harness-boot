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
3. Load harness spec index: `${CLAUDE_PLUGIN_ROOT}/docs/setup/INDEX.md`. Always-on topic files at session start: `${CLAUDE_PLUGIN_ROOT}/docs/setup/philosophy-and-layout.md` and `${CLAUDE_PLUGIN_ROOT}/docs/setup/generation-rules.md`. Pull additional files per the INDEX Phase→Files map as each phase runs.
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

#### Step 1.1.5: Conversation Language Detection (no question when detection succeeds)
Resolve `conversation_language` by invoking the detection script via the Bash tool, exactly once:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-conversation-language.mjs"
```

The script is the single source of truth; the OS-first contract (OS display language > shell locale > prompt) is summarized at `${CLAUDE_PLUGIN_ROOT}/docs/setup/cross-session-state.md#conversation-language-detection`, and the per-platform stage list (macOS / Linux systemd / WSL / Git Bash / MSYS / Cygwin / pure PowerShell) lives in the script's header JSDoc. Capture stdout as `$lang`.

- **Non-empty `$lang`** (e.g. `ko`, `en`, `ja`): record silently in `environment.md` as `conversation_language: <lang>` and proceed to Step 1.2. This is the normal path — no prompt shown.
- **Empty `$lang`** (every stage returned blank, or only rejected values like `C`/`POSIX`): the system locale is indeterminate. Ask exactly one question, with the ★ default inferred from the language the user has already used in **this session** (if any), otherwise ★ defaults to `en`:
  ```
  Conversation language: could not auto-detect from locale.
  (1) ★ {inferred-from-session} — you've been typing in {language}
  (2) en — English
  (3) Custom — ISO 639-1 code
  ```
  Store the chosen code in `environment.md` as `conversation_language`.

Do NOT re-run the snippet on later sessions — `/start` reads the value from `environment.md`.

#### Step 1.2: Code Comment Language
With `conversation_language` resolved in Step 1.1.5, it now governs spinner messages, prompts, summaries, and `README.md` / `CHANGELOG.md` description text. Machine-facing harness files (`CLAUDE.md`, `.claude/**`, `feature-list.json`, `PROGRESS.md`, `hooks/*.mjs`, `scripts/*.mjs`) are **always English** regardless of locale (parsed by hooks or loaded into LLM context). Code comment language requires an explicit choice; the ★ default is the value resolved in Step 1.1.5:
```
Code comment language (applies to source code comments only — machine-facing harness files are always English; README/CHANGELOG follow conversation language):
(1) ★ {conversation_language from Step 1.1.5} — match your environment
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

Execution is always **Subagent Dispatch** (parallel `Agent(subagent_type=...)` tool_use blocks + `_workspace/handoff/{from}->{to}.md` envelope files). Single-module projects (`module_count == 1`) dispatch one implementer at a time; the surface is uniform across project sizes. Reference: `${CLAUDE_PLUGIN_ROOT}/docs/references/agent-design-patterns.md`.

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
(5) QA agent inclusion
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
  - 5 scripts (`session-start-bootstrap.mjs`, `pre-tool-security-gate.mjs`, `pre-tool-doc-sync-check.mjs`, `post-tool-format.mjs`, `post-tool-test-runner.mjs`) are copied verbatim — they are stack-agnostic (extension-dispatched or language-independent).
  - 1 script (`pre-tool-coverage-gate.mjs`) requires substituting `{COVERAGE_COMMAND}` and `{COVERAGE_FILE}` using the row in `${CLAUDE_PLUGIN_ROOT}/docs/templates/stacks.md` matching the selected tech stack.
  - On POSIX, `chmod +x hooks/*.mjs` after copying (no-op on Windows — the generated settings.json invokes `node hooks/x.mjs` directly).
  - If the stack is not in `stacks.md`, ask the developer: "What coverage command and output file path do you use?" and record the answer in `.claude/environment.md`.
- `.claude/environment.md` — MUST include a `## Runtime Smoke Configuration` section with `build_command`, `run_command`, and `ready_signal` fields (schema and skip rules in `${CLAUDE_PLUGIN_ROOT}/docs/setup/cross-session-state.md#runtime-smoke-configuration`). If the tech stack is not runnable (library-only), set `build_command: null` / `run_command: null` so Gate 5 skips automatically.
- `.claude/security.md`
- `.claude/domain-persona.md` (domain context for agents, from Step 1 draft)
- `scripts/update-feature-status.mjs` — **copy from `${CLAUDE_PLUGIN_ROOT}/docs/templates/scripts/update-feature-status.mjs.tmpl`** (not LLM-generated). Substitute `{TEST_COMMAND}` using the row in `${CLAUDE_PLUGIN_ROOT}/docs/templates/stacks.md` matching the selected tech stack. On POSIX, `chmod +x scripts/update-feature-status.mjs` after copying. Auto-updates `feature-list.json` passes field after Gate 4.
- `_workspace/.gitkeep` (Subagent Dispatch artifact directory: phase files + `handoff/` envelopes)
- `.gitignore` (generated from Tech Stack selection — includes .env, IDE files, build outputs, language-specific patterns)
- `.claude/plan-source.md` — **verbatim copy** of the `$ARGUMENTS` plan MD. Prepend YAML frontmatter with `origin: <original-path>`, `sha256: <sha256 of the original file bytes>`, `captured_at: <ISO-8601 timestamp>`. This file is the single external oracle for Gate 2.5 intent verification; only the `intent-verifier` agent reads it. Do not edit after Phase 1 — drift from the original is treated as an incident.

### Step 3: Phase 2 — Core Protocols
- `.claude/protocols/` 5 protocols — **copy from `${CLAUDE_PLUGIN_ROOT}/docs/templates/protocols/`** (not LLM-generated):
  - `tdd-loop.md`, `iteration-cycle.md`, `code-doc-sync.md`, `session-management.md`, `message-format.md`
  - All 5 are stack-agnostic — copy verbatim. `message-format.md` defines the `_workspace/handoff/` envelope schema used by Subagent Dispatch; it is always required.
- `CLAUDE.md` (main, <= 1,500 tokens)
- `README.md` (in `conversation_language` — same value Phase 1 writes to `environment.md`; Phase 2 uses the locale detected in Step 1.2 directly, no file read required; content: project name, description, tech stack, getting started, project structure, dev guide, license placeholder)
- `.claude/quality-gates.md`

### Phase 1 + Phase 2 Parallel Execution

**Run Phase 1 and Phase 2 concurrently** — they have no dependencies between them. Issue all file-generation tool calls for both phases in a single message with parallel tool calls (one per file). Dependencies are strictly within-phase (none between phases):
- Phase 1 writes: settings.json, hooks/, environment.md, security.md, domain-persona.md, scripts/*.mjs, _workspace/.gitkeep, .gitignore
- Phase 2 writes: .claude/protocols/*.md, CLAUDE.md, README.md, .claude/quality-gates.md

After **both** phases finish, record `last_completed_phase: 2` in PROGRESS.md → auto-proceed to Phase 3. Pause only if any step errors.

> **Resume semantics**: If an earlier interrupted run recorded `last_completed_phase: 1`, treat Phase 1 as done and run Phase 2 alone. The parallel model only applies when both are pending.

### Step 4: Phase 3 — Agents + Execution Mode
Each agent YAML frontmatter includes a `model:` field.

**Default 10 agents:**
- `orchestrator.md` (model: opus)
- `architect.md` (model: opus)
- `reviewer.md` (model: opus)
- `debugger.md` (model: opus)
- `implementer.md` (model: sonnet)
- `tdd-implementer.md` (model: sonnet)
- `tdd-refactorer.md` (model: sonnet, effort: low)
- `bdd-writer.md` (model: sonnet, effort: low) — always generated (lean-tdd is the default strategy). See `${CLAUDE_PLUGIN_ROOT}/docs/setup/tdd-isolation.md` for the full agent definition.
- `tester.md` (model: sonnet)
- `intent-verifier.md` (model: opus) — always generated. Gate 2.5 plan-fidelity judge; the only agent that reads `.claude/plan-source.md`. Full spec in `${CLAUDE_PLUGIN_ROOT}/docs/setup/agents-and-gates.md#intent-verification-gate`.

**Conditional agents (from Step 1 / feature-list.json):**
- `qa-agent.md` (model: opus) — if QA agent inclusion was confirmed
- `tdd-test-writer.md` (model: sonnet) — if `feature-list.json` contains at least one feature with `"test_strategy": "tdd"` or `"test_strategy": "state-verification"`. Skip otherwise (`lean-tdd` uses `bdd-writer`; `integration` uses `tester`).
- **Module-specific implementer agents**:
  - For each slug produced by the **Module Extraction algorithm** (`${CLAUDE_PLUGIN_ROOT}/docs/setup/domain-persona.md#module-extraction`) at Step 1.5, generate `implementer-<module-slug>.md` (model: sonnet). Do not re-derive modules here — use the frozen slug set from Step 1.5.
  - All module implementers are instantiated from the same `implementer.md` body; per-instance overrides live in the YAML frontmatter (`metadata.module: <slug>`, `metadata.allowed-paths: [...]`) and in one inlined "Module scope" block referencing the matching row from `.claude/context-map.md`.
  - The generic `implementer.md` is the template of record; it is not itself a dispatchable subagent — only the generated `implementer-<slug>.md` files are.
  - Count: one per module (minimum 1 for single-module projects — one implementer + reviewer).

**Tier-1 agent body templates (copy-verbatim, MANDATORY)**:

The bodies of the 10 fixed-scope agents live as pre-baked templates under `${CLAUDE_PLUGIN_ROOT}/docs/templates/agents/bodies/<slug>.md.tmpl`. Phase 3 COPIES each template verbatim between the `<!-- AGENT_BODY_START -->` / `<!-- AGENT_BODY_END -->` markers (strip the markers on write) — do NOT model-regenerate the body, do NOT paraphrase, do NOT re-read the original setup docs as body source. The templates are the canonical form. For `tdd-test-writer` and `bdd-writer`, the body's `## Inputs` section is a brief pointer; the normative sanitization contract lives in the Rule 12 fragment appended per the matrix below.

| Agent | Template | Notes |
|-------|----------|-------|
| `orchestrator.md` | `bodies/orchestrator.md.tmpl` | Includes `## Handoff Protocol` in-body |
| `architect.md` | `bodies/architect.md.tmpl` | — |
| `reviewer.md` | `bodies/reviewer.md.tmpl` | Contains `{{DOMAIN_CONTEXT_INLINE}}` placeholder (see below) |
| `debugger.md` | `bodies/debugger.md.tmpl` | — |
| `tdd-implementer.md` | `bodies/tdd-implementer.md.tmpl` | — |
| `tdd-refactorer.md` | `bodies/tdd-refactorer.md.tmpl` | — |
| `bdd-writer.md` | `bodies/bdd-writer.md.tmpl` | `## Inputs` pointer; Rule 12 carries the contract |
| `tdd-test-writer.md` (if generated) | `bodies/tdd-test-writer.md.tmpl` | `## Inputs` pointer; Rule 12 carries the contract |
| `tester.md` | `bodies/tester.md.tmpl` | — |
| `intent-verifier.md` | `bodies/intent-verifier.md.tmpl` | Includes `## Handoff Protocol` in-body |

**Excluded from Tier-1 copy-verbatim** (still LLM-generated per the existing path):
- `implementer-<slug>.md` — module-specific content per Step 1.5 module extraction. Uses `implementer.md` as the body template of record (not a Tier-1 body template file), plus a one-inlined "Module scope" block referencing the matching `.claude/context-map.md` row.
- `qa-agent.md` — conditional on QA inclusion; body follows the QA-agent guide at `${CLAUDE_PLUGIN_ROOT}/docs/references/qa-agent-guide.md`.

**Reviewer placeholder — `{{DOMAIN_CONTEXT_INLINE}}`**: After copying `bodies/reviewer.md.tmpl`, replace the literal `{{DOMAIN_CONTEXT_INLINE}}` line between the `<!-- DOMAIN_CONTEXT_START -->` / `<!-- DOMAIN_CONTEXT_END -->` markers with the per-project Entities + Domain Rules + Vocabulary subset from `.claude/domain-persona.md` (see `${CLAUDE_PLUGIN_ROOT}/docs/setup/domain-persona.md` Agent Domain Views). Do not expand the reviewer template beyond this substitution.

**If a template file is missing**, abort Phase 3 with: `Agent body templates missing — ensure docs/templates/agents/bodies/ is present and re-invoke /setup`.

**Rule text injection (fragment append onto copied body, MANDATORY)**:

Subagents invoked via the `Agent` tool cannot resolve `${CLAUDE_PLUGIN_ROOT}` paths — their system prompt is the literal body of their agent file. Any rule referenced only as `see ${CLAUDE_PLUGIN_ROOT}/...` is unreadable at runtime. Phase 3 embeds the rule texts into each generated agent file.

**Pre-baked fragments** — Rules 2–12 live as single-source-of-truth fragments in `${CLAUDE_PLUGIN_ROOT}/docs/templates/agents/rules/NN-*.md`, regenerated from the anchored sources in `docs/setup/*` / `docs/protocols/*` / `commands/start.md` / `docs/templates/protocols/*` by `scripts/build-rule-fragments.mjs`. Phase 3 READS those fragments and appends them verbatim per the matrix below. Do NOT re-read the original source anchors; do NOT regenerate this text with the model; do NOT paraphrase. The fragments are the derived canonical form.

**Only Rule 1 (Language Settings) is per-project** — it holds the only two values that vary between runs (`conversation_language`, `comment_language`).

**Per-agent fragment matrix** (✓ = append this fragment into the agent body as a top-level `## <section>`):

| Agent | 01 Lang | 02 Comment Rules | 03 TDD Cycles + Gate 0 | 04 File Class | 05 Feature Sel | 06 Message Format | 07 Coord Round-Trip | 08 Workspace | 09 Iter Track | 10 Cross-Review | 11 QA Timing | 12 Input Sanitization |
|-------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `orchestrator.md` | ✓ | — | ✓ | — | ✓ | ✓ | — | — | — | — | ✓ | — |
| `implementer-<slug>.md` (each) | ✓ | — | ✓ | — | — | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `reviewer.md` | ✓ | ✓ | ✓ | — | — | ✓ | — | ✓ | — | ✓ | — | — |
| `qa-agent.md` (if generated) | ✓ | — | — | — | — | ✓ | — | ✓ | — | — | ✓ | — |
| `tdd-implementer.md` | ✓ | ✓ | — | — | — | — | — | ✓ | — | — | — | — |
| `tdd-refactorer.md` | ✓ | ✓ | — | — | — | — | — | ✓ | — | — | — | — |
| `bdd-writer.md` | ✓ | — | — | ✓ | — | — | — | ✓ | — | — | — | ✓ |
| `tdd-test-writer.md` (if generated) | ✓ | — | — | ✓ | — | — | — | ✓ | — | — | — | ✓ |
| `architect.md` | ✓ | — | — | — | — | — | — | — | — | — | — | — |
| `debugger.md` | ✓ | — | — | — | — | — | — | — | — | — | — | — |
| `tester.md` | ✓ | — | — | — | — | — | — | — | — | — | — | — |
| `intent-verifier.md` | ✓ | — | — | — | — | ✓ | — | ✓ | — | — | — | — |

The matrix is authoritative — it replaces the previous per-rule prose targeting.

**Rule 1 — Language Settings (per-project injection)**: Read `conversation_language` (from the locale detected in Step 1.2) and `comment_language` (from `.claude/environment.md`) and prepend a `## Language Settings` section at the top of every generated agent body:
```markdown
## Language Settings
- conversation_language: <value>   # user-facing messages, spinner, prompts, summaries
- comment_language: <value>         # file headers, JSDoc, inline why-comments in source code
Respond to the user in conversation_language. Write all source-code comments in comment_language. Machine-facing files (CLAUDE.md, .claude/**/*.md, feature-list.json, PROGRESS.md, hooks/*.mjs, scripts/*.mjs) stay English regardless.
```

**Rules 2–12 — Fragment append (verbatim, no model regeneration)**:
- **02 Comment Rules** — `docs/templates/agents/rules/02-comment-rules.md`
- **03 TDD Cycles + Gate 0 Evidence** — `docs/templates/agents/rules/03-tdd-cycles.md` (already contains both `## TDD Cycles` and `## Gate 0 Evidence` wrapper headings)
- **04 File Classification** — `docs/templates/agents/rules/04-file-classification.md`. For `bdd-writer.md` only, append one final line after the fragment: `For bdd-writer, the input is further narrowed to the feature's acceptance_test array plus the above-allowed type headers — no other test files are read.`
- **05 Feature Selection Algorithm** — `docs/templates/agents/rules/05-feature-selection.md`
- **06 Message Format Contract** — `docs/templates/agents/rules/06-message-format.md`
- **07 Coordinate Round-Trip** — `docs/templates/agents/rules/07-coordinate-round-trip.md`
- **08 Workspace Artifact Path** — `docs/templates/agents/rules/08-workspace-naming.md`
- **09 Iteration Tracking** — `docs/templates/agents/rules/09-iteration-tracking.md`. Each `implementer-<slug>.md` carries its own copy — the generic `implementer.md` template does NOT substitute for per-module embedding.
- **10 Cross-Module Review** — `docs/templates/agents/rules/10-cross-module-review.md`
- **11 QA Invocation Timing** — `docs/templates/agents/rules/11-qa-invocation-timing.md`. Only when `qa-agent.md` is generated (see Step 1.6 QA criterion) does it also receive this fragment.
- **12 Sub-agent Input Sanitization** — `docs/templates/agents/rules/12-subagent-input-sanitization.md`. Only for `bdd-writer.md` and (when generated) `tdd-test-writer.md`. Carries both the TDD and BDD sanitization clauses as a single block — the `## Inputs` body pointer in each agent delegates to this fragment as the normative contract.

**If a fragment file is missing**, abort Phase 3 with the message: `Rule fragments missing — run scripts/build-rule-fragments.mjs and re-invoke /setup`. Do not attempt to re-derive from source anchors inline; the drift risk is why the fragments exist.

Embedding is done inside the `/setup` slash-command context (top-level), which CAN resolve `${CLAUDE_PLUGIN_ROOT}`. Subagents only ever see the post-embed files.

**Handoff Protocol integration:**
The Tier-1 body templates already include (or correctly omit) a `## Handoff Protocol` section per the communicating-agent rule — orchestrator, reviewer, and intent-verifier carry it in-body; architect, debugger, tester, bdd-writer, and the tdd-* leaves omit it. This instruction therefore applies only to the two non-Tier-1 agents:
- `implementer-<slug>.md` (each) — **add** `## Handoff Protocol` documenting which handoff envelopes the implementer reads and writes for its module.
- `qa-agent.md` (if generated) — **add** `## Handoff Protocol` per `${CLAUDE_PLUGIN_ROOT}/docs/references/qa-agent-guide.md`.

`${CLAUDE_PLUGIN_ROOT}/docs/references/orchestrator-template.md` remains a **structural example** for the orchestrator's Subagent Dispatch workflow only; it is NOT the source of truth for selection, coordination, or QA timing semantics — those come from the inline-embed rules 5, 6, 7, 10, 11 above. Do not restate algorithms from the template; embed from the anchored sources.

**Generate agents in parallel.** Agents do not read each other's file bodies — cross-references are name-based only. Issue all agent-file `Write` tool calls in a single message (one per agent). The agent set (including optional qa-agent and conditional tdd-test-writer) must be resolved before dispatching — decide the set first, then write them all concurrently.

**Phase 3 complete → record `last_completed_phase: 3` in PROGRESS.md → auto-proceed to Phase 4.** Pause only if a step errors.

### Step 5: Phase 4 — 8 Skills (Anthropic Agent Skills Format)
Each skill follows the [Anthropic Agent Skills Specification](https://github.com/anthropics/skills). Generate as `skill-name/SKILL.md` (uppercase) with optional `references/`, `scripts/`, `assets/` subdirectories.

**Skill templates are pre-baked.** `${CLAUDE_PLUGIN_ROOT}/docs/templates/skills/` contains the canonical SKILL.md bodies. Phase 4 copies or fills in these templates — it does NOT model-regenerate the 7-section anatomy from scratch. Refer to `${CLAUDE_PLUGIN_ROOT}/docs/setup/skills-anatomy.md` only for the schema, the validation checklist at `#validation-checklist`, and the Project-Type Adaptation table (`skills-anatomy.md:189`) that governs which 3 skills need adaptation.

**Two skill classes**:

1. **Domain-agnostic (5 skills) — copy-verbatim**: `new-feature`, `bug-fix`, `refactor`, `tdd-workflow`, `context-engineering`. Copy `${CLAUDE_PLUGIN_ROOT}/docs/templates/skills/<skill-name>/SKILL.md` to `.claude/skills/<skill-name>/SKILL.md` unchanged. No placeholders. No model generation.

2. **Project-adapted (3 skills) — template with placeholder injection**: `api-endpoint`, `db-migration`, `deployment`. Read `${CLAUDE_PLUGIN_ROOT}/docs/templates/skills/<skill-name>/SKILL.md.tmpl` and fill the 7 placeholders using the project type detected from tech stack / plan content (see `skills-anatomy.md:185` Project-Type Adaptation table):
   - `{{DESCRIPTION}}` — one sentence naming the surface in this project's vocabulary (e.g., "REST endpoint", "Canvas/Physics module", "CLI command handler")
   - `{{TRIGGER_CONDITIONS}}` — specific trigger keywords for this project type (from the adaptation table)
   - `{{EXCLUSION_CONDITIONS}}` — scenarios that should route to a different skill in this project
   - `{{WHEN_TRIGGER}}` — bullet text for §When to Use → Trigger, with project-specific framing
   - `{{WHEN_NOT}}` — bullet text for §When to Use → Not when, project-specific
   - `{{PROCESS_STEP_1}}` through `{{PROCESS_STEP_4}}` — four project-specific procedural steps. The fifth and sixth steps (doc-sync + single commit) are fixed in the template and need no injection.

   Sections §1 (Overview), §3 (TDD Focus), §5 (Common Rationalizations), §6 (Red Flags), §7 (Verification) are pre-filled and MUST NOT be model-regenerated. Only the placeholders above are written.

   Strip the `.tmpl` extension on write — output filename is `SKILL.md`.

**If a template file is missing**, abort Phase 4 with the message: `Skill templates missing — ensure docs/templates/skills/ is present and re-invoke /setup`.

Additional: `.claude/examples/` (project-specific usage snippets — model-generated here).

**Generate skills in parallel.** Each `SKILL.md` is self-contained. Issue all 8 skill-file `Write` tool calls (5 copies + 3 filled templates) in a single message. `.claude/examples/` may be written in the same batch. (`.claude/context-map.md` is produced in Phase 5, not here.)

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
  - `depends_on` arrays based on analysis of feature descriptions, shared modules, and tdd_focus overlaps.
  - **Dependency ordering is mandatory and mechanical** — after drafting all features and their `depends_on` arrays, apply the algorithm below BEFORE writing the file. Do not rely on source-plan order.
    1. **Cycle detection + topological sort (Kahn's algorithm)**: compute indegree for every feature from its `depends_on`. Repeatedly pick any feature with indegree 0, emit it to the output sequence, and decrement the indegree of every feature that lists it in `depends_on`. If the output sequence length is less than the feature count, a cycle exists — surface the remaining (non-emitted) features as the cycle participants and PROMPT the user for resolution. Do not write the file until the cycle is resolved.
    2. **Tie-breaking during Kahn's pick**: when multiple features have indegree 0 simultaneously, break ties by (a) the order they appeared in the source plan, then (b) alphanumeric `id` ascending. This keeps the output stable across `/setup` re-runs.
    3. **Write features in the emitted order.** Never preserve source-plan order when it conflicts with dependencies.
    4. **Post-sort mechanical verification** — before declaring Step 7 complete, run the canonical check and require zero output (exit 0):
       ```bash
       node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-feature-order.mjs" feature-list.json
       ```
       Any stdout line (exit 2) means the sort was skipped or the write order was wrong — regenerate feature-list.json from the Kahn output and re-run. Only after zero output may you log `Dependency graph: {N} features, acyclic, order-valid` and continue. The script is the single source of truth for this check; Step 8 item 16 re-invokes the same command.
    - To revise an auto-approved graph later, delete `PROGRESS.md` and re-run `/setup` (error-recovery rebootstraps from Step 1). Step 1.7 runs before Phase 1 and cannot override a Phase 6 decision.
  - `test_strategy` per feature: classify as `"lean-tdd"` (default: TDD-shaped design, post-hoc BDD verification), `"tdd"` (safety-critical opt-in: strict Red/Green/Refactor isolation), `"state-verification"` (rendering/UI/DOM), or `"integration"` (wiring/entry points). Classification rules:
    - If `category` or `description` mentions any of `auth`, `payment`, `security`, `crypto`, `credential` (case-insensitive) → auto-assign `"tdd"`.
    - Rendering / canvas / DOM / UI feature → `"state-verification"`.
    - Wiring / entry-point / multi-module glue feature → `"integration"`.
    - Everything else → `"lean-tdd"`.

    **Classification rationalization guard** — when applying the rules above, the classifier MUST NOT downgrade a match to save effort:

    | Rationalization | Rebuttal |
    |---|---|
    | "This payment feature is simple — `lean-tdd` is enough." | Safety-critical invariants require test-first pinning. Simplicity of the feature ≠ simplicity of failure cost. Keep `tdd`. |
    | "UI rendering is visually obvious — I'll eyeball it, set `lean-tdd`." | Rendered-state regressions surface only at runtime and often only in production. State-verification is cheap insurance against debug loops later. |
    | "Auth keyword is incidental (e.g. mentions 'author' in comment) — skip `tdd`." | Keyword matching is intentionally coarse. If the feature genuinely has no auth/security boundary, correct the description (remove the false-positive phrasing), then re-classify. Do not silently strip `tdd`. |
    Present the full classification as a single batch summary (all N features at once — this is an intentional exception to the "one question at a time" rule, since per-feature prompting would exceed the Phase 6 confirmation budget) with two numbered choices: `(1) ★ Approve all` or `(2) Revise specific features`. If (2), then ask one follow-up question listing the feature ids and accept a comma-separated list; for each listed feature, ask one question at a time to pick the new strategy.
  - **Wiring-feature guardrail** (applies when `module_count >= 2` from Step 1.5): after the test_strategy classification resolves, scan the draft `feature-list.json`. If NO feature has `test_strategy: "integration"` AND no feature `description` (case-insensitive) contains any of (`main`, `entry point`, `entry-point`, `bootstrap`, `wiring`, `glue`, `boot`, `launch`, `app init`), synthesize a candidate feature:
    ```jsonc
    {
      "id": "FEAT-MAIN",
      "category": "integration",
      "description": "Application entry-point — wire all modules into a runnable app and verify end-to-end startup",
      "depends_on": [<every other feature id>],
      "test_strategy": "integration",
      "acceptance_test": [<auto-drafted Given/When/Then — see below>],
      "tdd_focus": [<inferred entry file(s) per tech stack — see below>],
      "doc_sync": [],
      "passes": false
    }
    ```
    Present it as a numbered choice (one question at a time, aligning with the Setup "One question at a time" principle):
    ```
    Plan omits a main/wiring feature. Without this, modules will not compose into a runnable app.
    (1) ★ Accept — append FEAT-MAIN with the inferred tdd_focus and auto-drafted acceptance_test
    (2) Edit — tweak tdd_focus / acceptance_test before appending
    (3) Remove — skip; the plan intentionally omits a wiring feature
    ```
    If the user picks (1) or (2), append the feature at the END of the feature-list array (dependency ordering naturally places it last since it depends on every prior feature) and run the acceptance_test contract validation below on it. If (3), leave feature-list.json unchanged.

    **Before picking (3), rationalization check** — orchestrator MUST surface this to the user verbatim when they select (3):

    | Rationalization | Rebuttal |
    |---|---|
    | "Wiring is trivial — the user will figure it out later." | FEAT-MAIN's integration tests are the only check that modules actually compose. Without it, `passes: true` across every module can coexist with a non-runnable app. |
    | "The plan omits it on purpose — I'll respect the spec." | If the plan is a library or a spike, option (3) is correct. If it describes an application, silent omission is a plan gap, not intent — ask the user to confirm library vs. app before accepting (3). |

    **Inferred `tdd_focus` by tech stack** (from Step 1.3):
    - Node / TypeScript / JavaScript: read `package.json` `main` or `module` field if present; fallback `src/main.ts` or `src/index.ts`
    - Go: `cmd/<project>/main.go` or `main.go`
    - Rust: `src/main.rs`
    - Python: `<pkg>/__main__.py` or `__main__.py`
    - Unknown stack: `[]` with an Edit-me marker — the user MUST pick (2) Edit before proceeding.

    **Auto-drafted `acceptance_test`**: at least three Given/When/Then entries derived from the modules list in Step 1.5. Example template for a 3-module project: `"Given all modules are initialized, When the app boots, Then the entry point returns without throwing"`, `"Given a module raises an initialization error, When the app boots, Then the entry point surfaces the error and exits with a non-zero code"`, `"Given the app is running, When the primary interaction loop runs one cycle, Then no unhandled rejection or panic occurs"`.

    **Skip condition** (no prompt, silent): any existing feature already has `test_strategy: "integration"`, OR any feature's description matches the wiring keyword list above. This prevents duplicating wiring the user already specified in the plan MD.
  - **`acceptance_test` contract validation**: for every feature, verify `acceptance_test.length >= 3` and every entry contains `Given`/`When`/`Then` (case-insensitive). If any feature fails the check, ask the user per-feature (one question at a time, numbered choices): `(1) ★ Auto-draft the missing scenarios from description + tdd_focus` or `(2) Pause — I will rewrite the plan entry`.
  - **intent-verifier dry-run** (after contract validation passes for all features): for each feature, dispatch `Agent(subagent_type="intent-verifier", prompt=...)` with `.claude/plan-source.md` + the draft feature entry (no BDD/diff yet — dry-run mode). Collect features that produced Minor-or-higher findings. Features with zero findings continue the auto-progression path silently (no prompt — this preserves the Step 1.7 auto-progress contract). Features with findings route through the **existing per-feature revision prompt** — one question at a time, numbered choices: `(1) ★ Auto-draft from plan findings` or `(2) Pause — I will rewrite the plan entry`. This gate ensures acceptance_test drift from the plan is caught before the harness is committed, not at Gate 2.5 during `/start`. Skip this step when `intent_verifier_enabled: false` is already recorded in `.claude/environment.md`.
- `PROGRESS.md`
- `CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com) format with `## [Unreleased]` section. Initial entry: "Added — Initial project setup via harness-boot, {N} features defined")
- `.claude/error-recovery.md`
- `.claude/observability.md`

### Step 8: Verification
Verify the entire generated harness:
1. File completeness: settings.json + 6 hooks + agents (10 base including `bdd-writer.md` and `intent-verifier.md`; conditional: qa-agent if included, `tdd-test-writer.md` if any `tdd`/`state-verification` feature, one `implementer-<slug>.md` per module) + 8 skills + 5 protocols + feature-list.json + scripts/update-feature-status.mjs + `.claude/plan-source.md`
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
12. Handoff protocol: communicating agents (orchestrator, module implementers, reviewer, qa-agent) have `## Handoff Protocol` section — non-communicating agents (architect, debugger, tester, bdd-writer, tdd-*) do NOT; if QA agent included, qa-agent.md exists with `model: opus`
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
    - `bdd-writer.md` AND (if generated) `tdd-test-writer.md` must contain the heading `#### TDD / BDD sub-agent input sanitization` (the Rule 12 fragment append) AND both of the strings `Allowed to pass through` and `self-check`. Missing any of the three signals means the Rule 12 append was skipped — without it the sub-agent has only the body's pointer paragraph and no normative allowed/forbidden list, which breaks the isolation invariant the Testable-First principle depends on.
    Any missing section means Phase 3 Step 4 fragment concat was skipped — re-run `scripts/build-rule-fragments.mjs` to ensure `docs/templates/agents/rules/*.md` are present, then regenerate the affected agent file(s) by re-appending the ✓-marked fragments per the Step 4 matrix.
16. **Dependency order validation** (feature-list.json): re-run the canonical Phase 6 post-sort check — for every feature at array index `i`, every id in its `depends_on` must appear at an earlier index `j < i`.
    ```bash
    node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-feature-order.mjs" feature-list.json
    ```
    Must exit 0 with zero stdout lines. Any violation (exit 2) means the Phase 6 Kahn sort was skipped or the write order was corrupted by a later patch — reorder features in-place (preserving all other fields) and re-run the check.

17. **Template fragment byte-equality** (Phase 3 + Phase 4 pre-bake): for each agent that received a ✓-marked Rule 2–12 fragment per the Step 4 matrix, confirm the corresponding `## <section>` block in the generated `.claude/agents/<agent>.md` matches `${CLAUDE_PLUGIN_ROOT}/docs/templates/agents/rules/NN-*.md` byte-for-byte (modulo surrounding whitespace). Similarly, for the 5 domain-agnostic skills (`new-feature`, `bug-fix`, `refactor`, `tdd-workflow`, `context-engineering`), confirm `.claude/skills/<skill>/SKILL.md` equals the corresponding `${CLAUDE_PLUGIN_ROOT}/docs/templates/skills/<skill>/SKILL.md` byte-for-byte. A mismatch means the fragment was regenerated or paraphrased by the model instead of copied — re-run the Phase 3/4 copy steps verbatim. For the 3 project-adapted skills (`api-endpoint`, `db-migration`, `deployment`), confirm sections §1/§3/§5/§6/§7 match the `.tmpl` file byte-for-byte; only §description, §When-to-Use bullets, and §Process Step 1–4 may differ.

18. **Intent-verification artifacts**: confirm `.claude/plan-source.md` exists with YAML frontmatter containing `origin`, `sha256`, `captured_at`; the SHA256 must match the current file bytes of the original plan MD at `origin` (if the path is still reachable). Confirm `.claude/agents/intent-verifier.md` exists with `model: opus` and contains `## Role`, `## Inputs`, `## Process`, `## Severity Contract`, `## Output`, `## Handoff Protocol`, and `## Common Rationalizations` sections. Confirm `.claude/environment.md` contains `intent_verifier_enabled:` (default `true`). A missing `plan-source.md` means Phase 1 Step 2 skipped the plan copy — regenerate by reading `$ARGUMENTS` verbatim.

19. **Tier-1 agent body byte-equality** (Phase 3 copy-verbatim): for each of the 10 Tier-1 agents (orchestrator, architect, reviewer, debugger, tdd-implementer, tdd-refactorer, bdd-writer, tdd-test-writer if generated, tester, intent-verifier), confirm the body region between the first `## Role` heading and the last rationalization-table row of `.claude/agents/<slug>.md` matches the content between `<!-- AGENT_BODY_START -->` and `<!-- AGENT_BODY_END -->` in `${CLAUDE_PLUGIN_ROOT}/docs/templates/agents/bodies/<slug>.md.tmpl` byte-for-byte. Exception: `reviewer.md` must have the `{{DOMAIN_CONTEXT_INLINE}}` placeholder replaced with the project-specific Entities+Rules+Vocabulary subset — every other byte of the reviewer body must still match. Run the canonical check:
    ```bash
    node "${CLAUDE_PLUGIN_ROOT}/scripts/verify-agent-bodies.mjs" .claude/agents/
    ```
    Must exit 0 with zero stdout lines. A mismatch means the agent body was regenerated or paraphrased by the model instead of copied from the template — re-run the Phase 3 copy step for that agent verbatim.

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
  1. **Machine-facing files — always English**: `CLAUDE.md`, `.claude/**/*.md` (agents, skills, protocols, domain-persona, context-map, environment, security, quality-gates, error-recovery, observability), `PROGRESS.md`, `feature-list.json`, `hooks/*.mjs`, `scripts/*.mjs`. These are parsed by hooks, loaded into LLM context at session start, or are executable code — locale variance breaks them.
  2. **User-facing docs — follow `conversation_language`**: `README.md` and `CHANGELOG.md`. Humans only; no hook parses them, no agent loads them for logic. Orchestrator writes CHANGELOG feature-completion entries in `conversation_language`. Keep a Changelog structural headings (`## [Unreleased]`, `### Added`, etc.) remain English as standard format markers.
  3. **Source code comments — follow `comment_language`**: Explicit Step 1.2 choice. Applies inside source files (`.ts`, `.py`, `.go`, etc.), never to `.md` files.
  See `${CLAUDE_PLUGIN_ROOT}/docs/setup/cross-session-state.md#language-settings` for the full rule.
