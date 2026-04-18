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
   - Include a `Language Settings` prefix in every subagent dispatch — both `Agent` tool task prompts and `SendMessage` / `TaskCreate` payloads — using this block verbatim:
     ```
     Language Settings:
     - conversation_language: <value>
     - comment_language: <value>
     Respond in conversation_language. Write source-code comments in comment_language.
     ```
     This overrides any default English output even when the agent body (generated at Phase 3) already contains its own embedded `## Language Settings` section — the runtime values take precedence. Machine-facing files (`CLAUDE.md`, `PROGRESS.md`, `feature-list.json`, `.claude/**/*.md`, `hooks/*.sh`, `scripts/*.sh`) stay English regardless. User-facing docs (`README.md`, `CHANGELOG.md`) follow `conversation_language`.

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

#### Feature selection
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

**Read the feature's `test_strategy`** from `feature-list.json` (default: `"tdd"`). The cycle varies by strategy.

**Iteration tracking** (mandatory, all strategies):

The `implementer-<slug>` agent **owns** iteration counter writes for its own feature. Other agents (reviewer, tdd-test-writer, tdd-implementer, tdd-refactorer, tdd-bundler, qa-agent, debugger) MUST NOT mutate the `iteration` field — they may only read it.

1. Before each cycle iteration, the implementer reads PROGRESS.md `## Current TDD State` → `iteration` value
2. The implementer increments `iteration` by 1 and writes to PROGRESS.md BEFORE starting the cycle
3. If `iteration > 5`: Do NOT proceed. The implementer logs to PROGRESS.md `## Incidents` table (date, feature ID, type="convergence-failure"). Escalate to user.
4. On feature completion (Step 7), the implementer resets `iteration: 0`

#### TDD sub-agent input sanitization (TDD isolation invariant)

The TDD-First principle relies on `tdd-test-writer` never seeing implementation intent. TDD sub-agents (`tdd-test-writer`, `tdd-implementer`, `tdd-refactorer`, `tdd-bundler`) are invoked via the `Agent` tool inside each implementer's execution context, and the implementer MUST sanitize inputs before forwarding them to `tdd-test-writer`:

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

#### Per-feature cycle by `test_strategy`

Each team member runs the cycle matching its assigned feature's `test_strategy`. Cycles execute inside each `implementer-<slug>`'s context, not at the orchestrator level. Full cycle bodies are embedded in each implementer's agent file at Phase 3 generation (see `commands/setup.md` Phase 3 "Rule text injection"), so the implementer resolves its cycle from its own `## TDD Cycles` section at runtime. Plugin-internal citation (`docs/protocols/tdd-cycles.md`) is the canonical source but is NOT read by subagents at runtime.

| `test_strategy` | Embedded anchor in agent body |
|-----------------|-------------------------------|
| `tdd` (default, strict 3-agent isolation) | `## Cycle: tdd` |
| `bundled-tdd` (single sub-agent, 2-commit red→green evidence) | `## Cycle: bundled-tdd` |
| `state-verification` (rendering / canvas / DOM) | `## Cycle: state-verification` |
| `integration` (wiring / entry points) | `## Cycle: integration` |

All cycles apply Comment Rules in the Green / Implement phase (from the agent's own embedded `## Comment Rules` section) and enforce the 5-iteration convergence limit. `bundled-tdd` trades strict test/impl isolation for fewer sub-agent hops (3 → 1-2) — use only for features with clear specs and low co-drift risk; when in doubt, stay with `tdd`.

#### Team formation and dispatch
Create a team for parallel module development. Each team member runs its own TDD sub-agent cycle (per `test_strategy` above).

**Task prompt contract** — every `TaskCreate` / `SendMessage` call to an implementer MUST include, at minimum:
- `feature_id`
- `test_strategy` (one of `tdd` / `bundled-tdd` / `state-verification` / `integration`) — the implementer selects the matching cycle from the `## TDD Cycles` section embedded in its own agent body (no external file read needed)
- The Language Settings block from Step 1
- `tdd_focus`, `acceptance_test`, `doc_sync` (sanitized per the Step 4 sub-agent input sanitization rules before any further pass-through to `tdd-test-writer`)

The implementer uses `test_strategy` to look up the correct cycle inside its embedded `## TDD Cycles` section — the cycle body travels with the agent, not with the task.

```
# Member names come from .claude/agents/ — one implementer-<slug>.md per
# module (slug from domain-persona.md), plus reviewer and optionally qa-agent.
TeamCreate(members: [implementer-<module-a>, implementer-<module-b>, ..., reviewer, qa-agent?])
  ↓
TaskCreate(FEAT-XXX -> implementer-<module-of-feat-xxx>,
           FEAT-YYY -> implementer-<module-of-feat-yyy>)
  # Task prompt carries feature_id, test_strategy, Language Settings, and sanitized focus/acceptance/doc_sync
  ↓
Each implementer independently runs the cycle matching its feature's test_strategy:
  - "tdd":              Red(tdd-test-writer) → Green(tdd-implementer) → Refactor(tdd-refactorer)
  - "bundled-tdd":      BundledRedGreen(tdd-bundler) → [optional] Refactor(tdd-refactorer)
  - "state-verification": Implement(tdd-implementer) → StateTest(tdd-test-writer) → Refactor
  - "integration":      Implement(tdd-implementer) → IntegrationTest(tester)
  ↓
Members coordinate via SendMessage (integration points, shared contracts)
  ↓
QA agent verifies cross-boundary consistency after each module TDD completes (if included)
  ↓
Reviewer reviews each module (QA report included in Gate 2 review material)
  ↓
Leader merges results, verifies cross-module consistency
```

**TDD isolation preserved in team mode**: Team communication is for module-level coordination only. `tdd-test-writer` still MUST NOT read implementation code, even via `SendMessage`. The implementer agent remains the information firewall.

**TDD sub-agents are NOT team members**: `tdd-test-writer`, `tdd-implementer`, `tdd-refactorer` are called via `Agent` tool within each implementer's context. They never receive `SendMessage` and are not part of `TeamCreate`. Team members are: implementers (one per module), reviewer, and optionally qa-agent. TDD sub-agents are nested inside each implementer's execution.

**Intermediate outputs**: Written to `_workspace/` with naming convention `{phase}_{agent}_{artifact}.{ext}`.

**QA agent invocation points** (only when qa-agent is included per `commands/setup.md` Step 1.6):

1. **Per-module**: immediately after a module's feature cycle passes Gate 1 and BEFORE Gate 2. The orchestrator calls `qa-agent` with that module's integration-point list (derived from `feature-list.json` `doc_sync` overlaps and cross-module `tdd_focus` references). The QA report is written to `_workspace/qa_qa-agent_{module}-{feature_id}.md` and attached to the Gate 2 review bundle. A QA Critical finding blocks Gate 2.
2. **Session-end sweep**: before any session termination path (auto-pilot queue exhausted, user stop, escalation end), the orchestrator runs one final QA pass over all modules that had any feature completed in this session. Auto-pilot does **not** skip this sweep even when time-pressured; the sweep is cheap because QA reads artifacts, not code. Findings feed into PROGRESS.md `## Incidents` if any Critical issue is surfaced.

If qa-agent is NOT included, these invocation points are omitted and boundary verification falls to the reviewer's Gate 2 checklist alone.

### Step 5: Confirm Quality Gate Passage
- **Gate 0**: TDD compliance — evidence: test files + Red→Green call order (verification per `test_strategy` below)
- **Gate 1**: Implementation complete (evidence: compile/lint/test output)
- **Gate 2**: Code review (call reviewer agent → 0 Critical/Major issues)
  - Reviewer MUST verify code-doc sync: if staged diff includes export changes (per the feature's `doc_sync` mapping), every listed doc target must also be staged. Missing targets are **Critical** (block). This is the third defender alongside the prompt protocol (this checklist) and the pre-tool-doc-sync-check hook.
  - If QA agent is included: QA boundary verification report feeds into Gate 2
  - Boundary mismatches are Critical severity (block commit)
- **Gate 3**: Tests pass (coverage report)
- **Gate 4**: Deploy approval (feature passes: true ready)

#### Gate 0 verification by `test_strategy`

Orchestrator runs this check BEFORE Gate 1 using the feature's `tdd_focus` and `doc_sync` from `feature-list.json`. The per-strategy evidence rules (SHA returns, `git log` / `git diff` assertions, structured contracts) are embedded verbatim in the orchestrator's and reviewer's agent bodies under `## Gate 0 Evidence` at Phase 3 generation. The orchestrator / reviewer reads its own embedded section — no external file load.

| `test_strategy` | Embedded sub-anchor in agent body |
|-----------------|-----------------------------------|
| `tdd` | `### tdd` under `## Gate 0 Evidence` |
| `bundled-tdd` | `### bundled-tdd` under `## Gate 0 Evidence` |
| `state-verification` | `### state-verification` under `## Gate 0 Evidence` |
| `integration` | `### integration` under `## Gate 0 Evidence` |

If any check fails, Gate 0 blocks and the cycle restarts (iteration++).

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

1. Run `scripts/update-feature-status.sh FEAT-XXX` to mark `passes: true` in feature-list.json
2. Update PROGRESS.md with completion record
3. Stage only changed code, tests, and docs explicitly — never use `git add .`
```bash
bash scripts/update-feature-status.sh FEAT-XXX
git add {changed source files} {test files} {doc files} feature-list.json PROGRESS.md CHANGELOG.md
git commit -m "feat(FEAT-XXX): {description}"
```

The PreToolUse hooks automatically verify:
- **doc-sync-check**: blocks commit if docs are missing
- **coverage-gate**: blocks commit if any tdd_focus function falls below 70% line coverage

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
If all features complete:
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
- **One feature per agent at a time** (key Anthropic lesson). One feature per team member; multiple features run in parallel across the team when modules are independent. Single-module projects run one feature at a time (team of one).
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

The `[skip-doc-sync]` escape hatch is supported by `pre-tool-doc-sync-check.sh`.

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

#### Stop propagation across the team
Auto-pilot with multiple team members running concurrently under the orchestrator requires graceful stop handling. A `stop`/`pause` input from the user must not abort mid-commit or leave orphaned sub-agent work. The orchestrator enforces the following protocol:

1. On `stop`/`pause` detection, orchestrator calls `TaskUpdate(<child_task>, status: 'cancel-pending')` for every in-flight member task.
2. Each team member checks the cancel flag at every **phase boundary**: end of Red (test-writer done), end of Green (implementer done), end of Refactor (refactorer done), end of Verify. Mid-phase work is never interrupted — phases are atomic.
3. A member that sees `cancel-pending` at a phase boundary:
   - If the member is **before its feature's commit**: finish the current phase, emit a partial-progress report to `_workspace/`, set `status: 'cancelled'`, exit without committing.
   - If the member is **at or after its feature's commit**: complete the commit (single-commit discipline), set `status: 'completed'`, exit.
4. Orchestrator waits for all members to reach a terminal state (`cancelled` or `completed`), then sets `auto_pilot: false` in PROGRESS.md and returns to manual mode at Step 8.
5. Any feature that exited as `cancelled` stays `passes: false`; next `/start` re-selects it per the normal Step 3 dependency gate.

This guarantees: no half-commits, no lost partial work (`_workspace/` artifacts survive), no inconsistent PROGRESS.md / feature-list.json state.
