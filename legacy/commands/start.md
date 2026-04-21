---
description: Starts actual development after the harness is ready. Selects the next incomplete feature from feature-list.json and implements it via TDD cycle. Can be run repeatedly.
---

# /start — Start Development

Starts actual development work with the harness in place.

## Prerequisites
- `/setup` must be completed
- `.claude/settings.json`, `.claude/skills/`, `PROGRESS.md`, and `feature-list.json` must exist

## Procedure

### Step 1: Load Harness
1. Load `.claude/agents/orchestrator.md`
2. Receive context provided by SessionStart hook (PROGRESS.md summary, incomplete feature count, last 5 git log entries)
3. Load `.claude/domain-persona.md` for domain context
4. Read `conversation_language` and `comment_language` from `.claude/environment.md`. From this point forward the orchestrator MUST:
   - Respond to the user in `conversation_language` (all spinner messages, numbered-choice prompts, status reports, summaries, and CHANGELOG human-description text under `## [Unreleased]`). Keep a Changelog structural headings (`### Added`, etc.) stay English.
   - Include a `Language Settings` prefix in every `Agent(subagent_type=..., prompt=...)` dispatch, using this block verbatim:
     ```
     Language Settings:
     - conversation_language: <value>
     - comment_language: <value>
     Respond in conversation_language. Write source-code comments in comment_language.
     ```
     This overrides any default English output even when the agent body (generated at Phase 3) already contains its own embedded `## Language Settings` section — the runtime values take precedence. Machine-facing files (`CLAUDE.md`, `PROGRESS.md`, `feature-list.json`, `.claude/**/*.md`, `hooks/*.mjs`, `scripts/*.mjs`) stay English regardless. User-facing docs (`README.md`, `CHANGELOG.md`) follow `conversation_language`.

### Step 2: Determine Session State

> "Session state" = where we are in the overall flow (first run / resume / new feature).

- **PROGRESS.md is empty or has no tasks** → First start after Initializer
- **PROGRESS.md has an In Progress task** → Resume interrupted session
  - Check the TDD phase of the In Progress task (Red / Green / Refactor / Verify)
  - Continue from that phase
- **PROGRESS.md has no In Progress tasks** → Proceed with new feature

### Step 3: Select Feature(s)

#### Dependency gate
Before selecting a feature, validate its `depends_on` array:
1. Read the candidate feature's `depends_on` from `feature-list.json`
2. For each dependency ID, check if that feature has `passes: true`
3. If any dependency has `passes: false`:
   - Report: "Feature {selected} depends on {dep_id} which is not yet complete."
   - Auto-select the earliest unmet dependency instead
   - Inform user of the substitution

#### Feature selection <!-- anchor: feature-selection-algorithm -->
Analyze module independence among top-priority `passes: false` features. If features are in different modules with no dependencies, select multiple features for parallel development. Single-module projects (team of one) always run one feature at a time.

**Pre-flight dependency check** before confirming parallel features:
- No shared `tdd_focus` targets between selected features
- No shared `doc_sync` targets that would cause merge conflicts
- Neither feature appears in the other's `depends_on` (direct or transitive)
- Transitive check: if A depends on C and B depends on C, both can run in parallel only if C has `passes: true`
If any dependency detected, fall back to sequential for the dependent pair.

Consider dependencies:
- Start with the most foundational features (auth > profile > order > payment)
- Fix any broken features first
- Only parallelize features with no shared dependencies

Report the selected feature and ask with numbered choices:
```
Next: {FEAT-XXX} — {description}
  Category: {category} | Strategy: {test_strategy} | Deps: {depends_on or "none"}
  TDD Focus: {tdd_focus}

(1) ★ Start this feature
(2) Skip — pick a different feature
(3) Show details (acceptance tests, doc sync targets)
(4) Auto-pilot — run all remaining features, pause only on errors
```

- Options (1)-(3): Manual mode. Steps 4-7 auto-proceed on success; Step 8 shows choices.
- Option (4): Auto-pilot mode. Set `auto_pilot: true` in PROGRESS.md. Steps 4-8 all auto-proceed. Only escalation conditions cause a pause.

### Step 4: Execute Development Cycle

**Auto-proceed**: Steps 4 through 7 run without pausing for user confirmation when all checks succeed. Only stop on escalation conditions (convergence failure, Gate 2 Critical, doc-sync 3+ blocks, test environment error).

**Read the feature's `test_strategy`** from `feature-list.json` (default: `"lean-tdd"`). The cycle varies by strategy.

**Iteration tracking** (mandatory, all strategies): <!-- anchor: iteration-tracking -->

The `implementer-<slug>` agent **owns** iteration counter writes for its own feature. Other agents (reviewer, tdd-test-writer, tdd-implementer, tdd-refactorer, bdd-writer, qa-agent, debugger) MUST NOT mutate the `iteration` field — they may only read it.

1. Before each cycle iteration, the implementer reads PROGRESS.md `## Current TDD State` → `iteration` value
2. The implementer increments `iteration` by 1 and writes to PROGRESS.md BEFORE starting the cycle
3. If `iteration > 5`: Do NOT proceed. The implementer logs to PROGRESS.md `## Incidents` table (date, feature ID, type="convergence-failure"). Escalate to user.
4. On feature completion (Step 7), the implementer resets `iteration: 0`
5. When a feature is **resurrected** by the session-terminal sweep (session-end QA Critical, Gate 5 Build/Run failure — see the `qa-invocation-timing` anchor below and `docs/setup/agents-and-gates.md` anchor `runtime-smoke-gate`), its iteration counter is **preserved**. Do NOT reset to 0 at resurrection time: a recurring failure on the same feature is divergence, and the `> 5` cap must trigger so the normal escalation path runs (Step 3 above). Reset only happens again on successful re-completion in step 4.

#### TDD / BDD sub-agent input sanitization (isolation invariant) <!-- anchor: sub-agent-input-sanitization -->

The Testable-First principle relies on two isolation barriers: `tdd-test-writer` never seeing implementation intent (under `tdd` / `state-verification`), and `bdd-writer` never seeing implementation code (under `lean-tdd`). Both sub-agents are invoked via the `Agent` tool inside each implementer's execution context, and the implementer MUST sanitize inputs before forwarding.

**TDD sub-agent input sanitization** (for `tdd-test-writer`):

**Allowed to pass through**:
- `feature_id`
- `test_strategy`
- `tdd_focus` — **function signatures only** (name + parameter types + return type). Strip any body comments that hint at algorithm or internal state.
- `acceptance_test` — only the **observable-result** portion: given/when/then phrasing, input-output pairs, error conditions visible to callers. Strip any "the function works by..." or "internally it uses..." sentences.
- `doc_sync` paths — listed so the test writer knows which surface-level behaviors are contracted, not as implementation hints.

**Must be removed before forwarding**:
- Pseudocode or algorithm sketches in `acceptance_test`
- Internal data-structure names (e.g., "uses a linked list" → drop)
- References to existing private helpers
- Implementation-performance hints (complexity targets are OK; "by memoizing X" is not)

If the implementer cannot determine whether a line is safe, it removes the line and adds a brief note to `_workspace/red_implementer_feat-XXX-input.md` documenting what was stripped. This artifact stays in the implementer's context; it is not passed to the test writer.

Tool-level isolation is already enforced: `tdd-test-writer`'s `allowed-tools` list excludes `Edit` (it can only write new files), and read globs are scoped to interface declarations and test files per `${CLAUDE_PLUGIN_ROOT}/docs/setup/tdd-isolation.md#file-classification-for-tdd-test-writer`. Sanitization is the second defender; Phase 3 in `commands/setup.md` writes the sanitization clause into `tdd-test-writer.md`'s generated prompt body so the sub-agent also self-checks on receipt.

**BDD sub-agent input sanitization** (for `bdd-writer`):

**Allowed to pass through**:
- `feature_id`
- `acceptance_test` — the full Given/When/Then array from `feature-list.json`; each entry must already be in Given/When/Then form (Phase 6 validates this during `/setup`).
- Public type-header file paths only (`*.d.ts`, `*.types.*`, exported interface modules). The bdd-writer may Read these; they are the only reads it can make beyond the test directory.
- `doc_sync` paths — informational, so the BDD suite knows the contracted surfaces.

**Must NOT be forwarded**:
- Implementation file paths (`src/**/*.{ts,js,py,go,...}`)
- `tdd_focus` function bodies or private helper names
- Design notes from `_workspace/{feature_id}_design.md` (these are the implementer's internal sketch)
- Any sentence phrased as "the implementation uses..." / "internally we..." — if such a sentence appears in `acceptance_test`, it is a Phase 6 contract violation and should be reported rather than forwarded.

The implementer writes the forwarded payload to `_workspace/bdd_implementer_feat-XXX-input.md` before the Agent call, so post-hoc audit can verify isolation. `bdd-writer.md`'s generated body carries the same sanitization self-check.

#### Per-feature cycle by `test_strategy`

Each dispatched implementer runs the cycle matching its assigned feature's `test_strategy`. Cycles execute inside each `implementer-<slug>`'s context, not at the orchestrator level. Full cycle bodies are embedded in each implementer's agent file at Phase 3 generation (see `commands/setup.md` Phase 3 "Rule text injection"), so the implementer resolves its cycle from its own `## TDD Cycles` section at runtime. Plugin-internal citation (`docs/protocols/tdd-cycles.md`) is the canonical source but is NOT read by subagents at runtime.

| `test_strategy` | Embedded anchor in agent body |
|-----------------|-------------------------------|
| `lean-tdd` (default: Design → Implement → BDD-Verify → Refactor) | `## Cycle: lean-tdd` |
| `tdd` (safety-critical opt-in: strict 3-agent isolation) | `## Cycle: tdd` |
| `state-verification` (rendering / canvas / DOM) | `## Cycle: state-verification` |
| `integration` (wiring / entry points) | `## Cycle: integration` |

All cycles apply Comment Rules in the Implement / Green phase (from the agent's own embedded `## Comment Rules` section) and enforce the 5-iteration convergence limit. `lean-tdd` skips Red-before-Green ordering in favor of post-hoc BDD verification — use for most features. Escalate to `tdd` when invariants are security-sensitive (auth / payment / security / crypto / credential) or when the spec is ambiguous enough that test-first discipline helps pin it down.

#### Parallel dispatch (Subagent Dispatch model)
The orchestrator dispatches one implementer per wave feature in a single response by emitting multiple `Agent` tool_use blocks. Each implementer then invokes its own sub-agent cycle (per `test_strategy` above) within its isolated context. Coordination is turn-based and flows through `_workspace/handoff/` envelope files — there is no live messaging between simultaneously-running subagents. (See `docs/references/execution-model-divergence.md` for why Subagent Dispatch replaces the experimental `TeamCreate` / `SendMessage` / `TaskCreate` path.)

**Dispatch prompt contract** — every `Agent(subagent_type="implementer-<slug>", prompt=...)` call MUST include, at minimum:
- `feature_id`
- `test_strategy` (one of `lean-tdd` / `tdd` / `state-verification` / `integration`) — the implementer selects the matching cycle from the `## TDD Cycles` section embedded in its own agent body (no external file read needed)
- The Language Settings block from Step 1
- `tdd_focus`, `acceptance_test`, `doc_sync` (sanitized per the Step 4 sub-agent input sanitization rules before any further pass-through to `tdd-test-writer` or `bdd-writer`)
- Output path instructions: main artifact at `_workspace/02_impl_<slug>_<feature_id>.md`; Gate 2 handoff at `_workspace/handoff/implementer-<slug>->reviewer.md` when the cycle completes cleanly; coordination or escalation handoff at `_workspace/handoff/implementer-<slug>->orchestrator.md` otherwise

The implementer uses `test_strategy` to look up the correct cycle inside its embedded `## TDD Cycles` section — the cycle body travels with the agent, not with the prompt.

```
# One orchestrator response emits N parallel Agent tool_use blocks.
# Subagent slugs come from .claude/agents/ — one implementer-<slug>.md per
# module (slug from domain-persona.md), plus reviewer and optionally qa-agent.

Agent(subagent_type="implementer-<module-of-feat-xxx>",
      prompt="FEAT-XXX | test_strategy=<strategy> | Language Settings | sanitized focus/acceptance/doc_sync | write _workspace/02_impl_<slug>_FEAT-XXX.md; on Gate 2 ready write _workspace/handoff/implementer-<slug>->reviewer.md")
Agent(subagent_type="implementer-<module-of-feat-yyy>",
      prompt="FEAT-YYY | test_strategy=<strategy> | Language Settings | sanitized focus/acceptance/doc_sync | write _workspace/02_impl_<slug>_FEAT-YYY.md; on Gate 2 ready write _workspace/handoff/implementer-<slug>->reviewer.md")
  ↓
Each implementer independently runs the cycle matching its feature's test_strategy
(sub-agents invoked via Agent tool inside the implementer):
  - "lean-tdd":         Design(self) → Implement(tdd-implementer) → BDD-Verify(bdd-writer) → [optional] Refactor(tdd-refactorer)
  - "tdd":              Red(tdd-test-writer) → Green(tdd-implementer) → Refactor(tdd-refactorer)
  - "state-verification": Implement(tdd-implementer) → StateTest(tdd-test-writer) → Refactor
  - "integration":      Implement(tdd-implementer) → IntegrationTest(tester)
  ↓
Shared-contract decisions travel via _workspace/handoff/implementer-<slug>->orchestrator.md
  (kind=coordinate, status=blocked). The orchestrator brokers a second-round dispatch
  to the counterparty implementer in its next response — no live cross-member messaging.
  ↓
When qa-agent is included, orchestrator dispatches it after each module's Gate 1:
  Agent(subagent_type="qa-agent", prompt="read _workspace/02_impl_*, write _workspace/qa_qa-agent_<module>-<feature_id>.md")
  ↓
Reviewer dispatch (one call per module, or batched):
  Agent(subagent_type="reviewer", prompt="read _workspace/02_impl_*, _workspace/qa_qa-agent_* ; write _workspace/03_reviewer_<feature_id>.md; on rejection write _workspace/handoff/reviewer->implementer-<slug>.md")
  ↓
Orchestrator reads _workspace/handoff/*, re-dispatches rejected implementers with
the envelope path, then proceeds to per-feature commits.
```

**TDD / BDD isolation preserved under parallel dispatch**: Handoff envelopes carry only the fields in `docs/templates/protocols/message-format.md` — `tdd-test-writer` still MUST NOT read implementation code, and `bdd-writer` still MUST NOT read implementation code. The implementer agent remains the information firewall, sanitizing inputs before forwarding.

**TDD / BDD sub-agents are NOT directly dispatched by the orchestrator**: `tdd-implementer`, `tdd-refactorer`, `bdd-writer`, and (when generated) `tdd-test-writer` are called via the `Agent` tool from inside each implementer's execution. The orchestrator only dispatches implementers, reviewer, and (optionally) qa-agent. Sub-agents are nested one level below each implementer — matching revfactory/harness's "keep to 2 levels" guidance.

**Intermediate outputs**: Main deliverables go to `_workspace/{phase}_{agent}_{artifact}.{ext}`. Directed signals go to `_workspace/handoff/{from}->{to}.md`.

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

### Step 5: Confirm Quality Gate Passage
- **Gate 0**: Test evidence — content varies by `test_strategy`: BDD scenario count (`lean-tdd`), Red→Green SHA ordering (`tdd`), state-test files (`state-verification`), integration test files (`integration`). See per-strategy table below.
- **Gate 1**: Implementation complete (evidence: compile/lint/test output)
- **Gate 2**: Code review (call reviewer agent → 0 Critical/Major issues)
  - Reviewer MUST verify code-doc sync: if staged diff includes export changes (per the feature's `doc_sync` mapping), every listed doc target must also be staged. Missing targets are **Critical** (block). This is the third defender alongside the prompt protocol (this checklist) and the pre-tool-doc-sync-check hook.
  - If QA agent is included: QA boundary verification report feeds into Gate 2
  - Boundary mismatches are Critical severity (block commit)
- **Gate 2.5**: Intent verification (plan fidelity, conditional)
  - **Skip condition**: `.claude/environment.md` records `intent_verifier_enabled: false` → log one line to `PROGRESS.md` and proceed to Gate 3.
  - Orchestrator dispatches `Agent(subagent_type="intent-verifier", prompt=...)` with: `feature_id`, path to `.claude/plan-source.md`, the feature entry from `feature-list.json`, BDD/test paths discovered via `git ls-files '*{feature_id}.bdd.*' '*{feature_id}.test.*'`, and the staged diff (`git diff --cached`). See `docs/setup/agents-and-gates.md#intent-verification-gate` for the agent's Process / Severity Contract.
  - Orchestrator reads the handoff envelope at `_workspace/handoff/intent-verifier->orchestrator.md` (`kind: intent-report`). Routing by severity:
    - **Critical** → re-dispatch the module's implementer, **iteration++** (counts against the 5-iteration cap). A recurring Critical on the same feature escalates via the standard debugger route.
    - **Major** → re-dispatch the module's implementer, **iteration unchanged** (single free revision).
    - **Minor** → append one line per finding to `PROGRESS.md ## Incidents`; proceed to Gate 3. Non-blocking.
  - Why this gate exists, not just Gate 2: Gate 2 covers code quality + seam correctness (intra-code axis). Gate 2.5 covers plan fidelity (code ↔ user-intent axis). `intent-verifier` is the only agent that reads `.claude/plan-source.md` — every other agent consumes LLM-derived artifacts, which is why acceptance_test drift can survive Gate 2 undetected.
- **Gate 3**: Tests pass (coverage report)
- **Gate 4**: Deploy approval (feature passes: true ready)

#### Gate 0 verification by `test_strategy`

Orchestrator runs this check BEFORE Gate 1 using the feature's `tdd_focus` and `doc_sync` from `feature-list.json`. The per-strategy evidence rules (SHA returns, `git log` / `git diff` assertions, structured contracts) are embedded verbatim in the orchestrator's and reviewer's agent bodies under `## Gate 0 Evidence` at Phase 3 generation. The orchestrator / reviewer reads its own embedded section — no external file load.

| `test_strategy` | Embedded sub-anchor in agent body |
|-----------------|-----------------------------------|
| `lean-tdd` | `### lean-tdd` under `## Gate 0 Evidence` |
| `tdd` | `### tdd` under `## Gate 0 Evidence` |
| `state-verification` | `### state-verification` under `## Gate 0 Evidence` |
| `integration` | `### integration` under `## Gate 0 Evidence` |

If any check fails, Gate 0 blocks and the cycle restarts (iteration++).

#### Rationalization defense (applies to Gates 0–4)
Gates block for a reason. When one fires, resist severity-downgrade and bypass-token shortcuts. Common excuses and rebuttals — every reviewer / implementer MUST consult this table before overriding a gate:

| Rationalization | Rebuttal |
|---|---|
| "This Critical is really a Major — the fix is trivial." | Severity is measured by scope of failure, not effort to fix. A Critical blocks Gate 2 even if the fix is one line. Fix the issue, do not relabel it. |
| "The doc will be updated in the next feature's commit." | Per-feature commit discipline exists to prevent exactly this. Deferred doc updates do not get backfilled. Stage doc changes now, or use `[skip-doc-sync]` **only** with a one-line justification in the commit body. |
| "One more iteration will converge — it's almost there." | The 5-iteration cap exists because "almost there" is the divergence signature. Route to `debugger` at 6; never mutate the counter to extend the cycle. |
| "Skip Gate 0 evidence just this once — the code clearly works." | Gate 0 enforces Testable-First. 'Clearly works' without evidence is the rationalization the principle exists to defeat. Regenerate the evidence artifact; do not hand-wave. |

### Step 6: Code-Doc Sync
Update related documents per the mapping table:
- Source changes → related docs/*.md, `.claude/context-map.md` (layer rules)
- Feature complete → feature-list.json (passes: true)
- All changes → PROGRESS.md
- Feature complete → CHANGELOG.md: append entry under `## [Unreleased]` with appropriate category:
  - `### Added` — new feature
  - `### Changed` — modification to existing feature
  - `### Fixed` — bug fix
  - `### Removed` — removed functionality
  - Format: `- {FEAT-XXX}: {one-line description}`

### Step 7: Update Feature Status + Single Commit
After all quality gates pass, update feature status and commit:

1. Run `node scripts/update-feature-status.mjs FEAT-XXX` to mark `passes: true` in feature-list.json
2. Update PROGRESS.md with completion record
3. Stage only changed code, tests, and docs explicitly — never use `git add .`
```bash
node scripts/update-feature-status.mjs FEAT-XXX
git add {changed source files} {test files} {doc files} feature-list.json PROGRESS.md CHANGELOG.md
git commit -m "feat(FEAT-XXX): {description}"
```

The PreToolUse hooks automatically verify:
- **doc-sync-check**: blocks commit if docs are missing
- **coverage-gate**: strategy-dependent — blocks on BDD scenario shortfall (`lean-tdd`), per-function line coverage < 70% (`tdd`), missing state-test files (`state-verification`), or overall file coverage < 60% (`integration`)

**This step is mandatory per feature.** Do not batch multiple features — commit each feature individually before proceeding to the next.

### Step 8: Ask About Next Feature

#### Auto-pilot mode (`auto_pilot: true`):
Do not show choices. Emit a status report and auto-proceed to the next feature:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ {FEAT-XXX} complete ({description})     [{completed}/{total} — {percentage}%]
  TDD: {iterations} iterations | Tests: {test_count} pass | Gates: all clear
  Tokens: {cumulative_tokens} | Elapsed: {session_elapsed}
  → Next: {FEAT-YYY} ({next_description})
  Type "stop" to pause auto-pilot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
If all features complete (queue empty), run the **session-terminal verification sweep** BEFORE showing the completion banner. Termination is a fixed point — queue empty AND the sweep produces no new or resurrected features. Order:

1. **Session-end QA sweep** (per the `qa-invocation-timing` anchor above). On Critical: debugger resurrects or creates features, `feature-list.json` is no longer fully `passes: true` → return to Step 3 and let auto-pilot drain the queue again.
2. **Gate 5 Runtime Smoke** (per `docs/setup/agents-and-gates.md` anchor `runtime-smoke-gate`). Build → Run, each stage capable of failing. Any failure routes through the same debugger pipeline as step 1: resurrect the responsible feature OR append a `FEAT-FIX-BUILD-*` / `FEAT-FIX-RUNTIME-*` entry → return to Step 3.

The banner below prints only when both stages either pass or skip and `feature-list.json` is still fully `passes: true`. Convergence across these sweep-driven loops is guaranteed only by the per-feature 5-iteration cap (`iteration-tracking` anchor): a feature that keeps re-failing escalates to the user through the normal channel. No session-level wave counter exists.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
★ AUTO-PILOT COMPLETE                    [{total}/{total} — 100%]
  Session: {total} features, {total_iterations} iterations, {escalation_count} escalations
  Tokens: {cumulative_tokens} | Elapsed: {session_elapsed}
  See PROGRESS.md for details.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### Manual mode (default):
```
✓ {FEAT-XXX} complete — {completed}/{total} features ({percentage}%)
  Tokens: {cumulative_tokens} | Elapsed: {session_elapsed}

(1) ★ Continue — next feature: {FEAT-YYY} ({description})
(2) End session — show progress report
(3) Pick a specific feature
```

- 1 → Return to Step 3 (with pre-selected next feature)
- 2 → End session with report
- 3 → Show remaining features list, let user choose

## Principles
- **One feature per agent at a time** (key Anthropic lesson). One feature per dispatched implementer; multiple features run in parallel when the orchestrator emits multiple `Agent` tool_use blocks in a single response and the features share no `tdd_focus` / `doc_sync` / `depends_on`. Single-module projects dispatch one implementer at a time.
- **One feature per commit** (non-negotiable). Each feature must be committed individually with its tests and docs before proceeding to the next. Never batch multiple features into a single commit — this enables `git revert` per feature and satisfies Gate 4. If the user requests "implement all features at once", still execute them sequentially: TDD cycle → quality gates → commit → next feature. Parallel team execution commits each module's feature independently.
- **Auto-proceed on success**: Steps 4-7 run without mid-feature pauses when all gates pass. Pause only at decision points (Steps 3, 8) and on escalation conditions. Auto-pilot mode also auto-proceeds through Steps 3 and 8.
- On convergence failure (> 5 iterations), suggest switching to debugger
- Only modify the `passes` field in feature-list.json; never add/delete/modify items

## Escalation Conditions
Stop auto-progression and report to the user when:
- Convergence loop exceeds 5 iterations
- Gate 2 finds a Critical issue
- Doc sync hook keeps blocking (see resolution below)
- Test environment setup fails

In auto-pilot mode, escalation pauses with a choice menu:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠ {FEAT-XXX} — AUTO-PILOT PAUSED         [{completed}/{total} — {percentage}%]
  Reason: {escalation reason}
  Tokens: {cumulative_tokens} | Elapsed: {session_elapsed}

(1) Fix and retry
(2) Skip this feature, continue auto-pilot
(3) Exit auto-pilot — return to manual mode
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Doc Sync Block Resolution
If the doc-sync hook blocks 3+ consecutive commit attempts:
1. List all source files changed and their mapped doc targets
2. Present the mapping to the user
3. Ask: "Update these docs, or commit with `[skip-doc-sync]` in the message?"

The `[skip-doc-sync]` escape hatch is supported by `pre-tool-doc-sync-check.mjs`.

## Auto-Pilot Mode

Auto-pilot runs all remaining features end-to-end, pausing only on escalation conditions.

### Activation
- User selects option (4) at Step 3
- `auto_pilot: true` is written to PROGRESS.md `## Current TDD State`

### Behavior
- **Steps 4-7**: Auto-proceed on success (same as manual mode)
- **Step 8**: Skip choices, emit status report, auto-select next highest-priority feature
- **Step 3 (subsequent)**: Skip choices, auto-select next feature after dependency gate

### Exiting Auto-Pilot
- **User types "stop" or "pause"**: Finish the current feature's commit (never leave half-committed), then return to manual mode at Step 8. Set `auto_pilot: false` in PROGRESS.md.
- **Escalation pause**: Option (3) in the escalation menu exits auto-pilot permanently.
- **Session resume**: If `auto_pilot: true` persists from an interrupted session, ask:
  ```
  Auto-pilot was active. Resume?
  (1) ★ Resume auto-pilot
  (2) Continue in manual mode
  ```

#### Stop propagation across parallel implementers
Auto-pilot with a multi-implementer wave requires graceful stop handling. A `stop`/`pause` input from the user must not abort mid-commit or leave orphaned sub-agent work. Because Subagent Dispatch has no live cancel channel into a running `Agent` call (see `docs/references/execution-model-divergence.md`), stop is enforced at wave boundaries rather than mid-wave:

1. The currently in-flight dispatch wave (the N parallel `Agent` calls emitted in the orchestrator's latest response) runs to completion — each implementer is atomic once dispatched. Stops are never injected mid-wave.
2. When all in-flight implementers return their handoff envelopes, the orchestrator checks for `stop`/`pause` before emitting the next dispatch wave.
3. For each feature that completed its cycle in the just-finished wave (handoff `kind=review-request`, `status=completed`): proceed through the reviewer dispatch and per-feature commit normally — single-commit discipline wins over stop latency.
4. For each feature that exited with `kind=escalate` or `kind=coordinate` (`status=blocked`): leave it `passes: false`; do not dispatch the next round.
5. After settling all just-completed features, orchestrator sets `auto_pilot: false` in PROGRESS.md and returns to manual mode at Step 8. Any non-committed feature stays `passes: false`; next `/start` re-selects it per the normal Step 3 dependency gate.

This guarantees: no half-commits, no lost partial work (`_workspace/` artifacts and handoff envelopes survive), no inconsistent PROGRESS.md / feature-list.json state. Stop latency is bounded by the longest-running implementer in the current wave — typically one feature's cycle.
