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
4. Read `comment_language` from `.claude/environment.md` — use this language for all code comments (file headers, JSDoc, why-comments) throughout the session. Output text follows the system locale.

### Step 2: Determine Mode
- **PROGRESS.md is empty or has no tasks** → First start after Initializer
- **PROGRESS.md has an In Progress task** → Resume interrupted session
  - Check the TDD phase of the In Progress task (Red / Green / Refactor / Verify)
  - Continue from that phase
- **PROGRESS.md has no In Progress tasks** → Proceed with new feature

### Step 3: Select Feature(s)

**Check execution mode** from orchestrator's `metadata.execution-mode` (in `.claude/agents/orchestrator.md`).

#### Dependency gate (all modes):
Before selecting a feature, validate its `depends_on` array:
1. Read the candidate feature's `depends_on` from `feature-list.json`
2. For each dependency ID, check if that feature has `passes: true`
3. If any dependency has `passes: false`:
   - Report: "Feature {selected} depends on {dep_id} which is not yet complete."
   - Auto-select the earliest unmet dependency instead
   - Inform user of the substitution

#### Sub-agent mode (default):
Select the highest-priority feature with `passes: false` from `feature-list.json` (after dependency gate).

#### Agent Team mode:
Analyze module independence among top-priority `passes: false` features. If features are in different modules with no dependencies, select multiple features for parallel development.

**Pre-flight dependency check** before confirming parallel features:
- No shared `tdd_focus` targets between selected features
- No shared `doc_sync` targets that would cause merge conflicts
- Neither feature appears in the other's `depends_on` (direct or transitive)
- Transitive check: if A depends on C and B depends on C, both can run in parallel only if C has `passes: true`
If any dependency detected, fall back to sequential for the dependent pair.

Consider dependencies:
- Start with the most foundational features (auth > profile > order > payment)
- Fix any broken features first
- In Agent Team mode, only parallelize features with no shared dependencies

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
1. Before each cycle iteration, read PROGRESS.md `## Current TDD State` → `iteration` value
2. Increment `iteration` by 1 and write to PROGRESS.md BEFORE starting the cycle
3. If `iteration > 5`: Do NOT proceed. Log to PROGRESS.md `## Incidents` table (date, feature ID, type="convergence-failure"). Escalate to user.
4. On feature completion (Step 7), reset `iteration: 0`

#### Sub-agent mode (default):
Call sub-agents using the Claude Code `Agent` tool with isolated contexts:
- `Agent(implementer)` — orchestrates the cycle
- `Agent(reviewer)` for Gate 2

Pass task input (feature ID, test_strategy, tdd_focus, acceptance_test, doc_sync targets) as the agent's prompt argument.

#### test_strategy = "tdd" (default):

```
Plan (analyze acceptance_test)
  ↓
Red: call tdd-test-writer sub-agent
  - Write failing tests (happy/boundary/error)
  - Do not read implementation code
  - Verify: run tests → all FAIL
  ↓
Green: call tdd-implementer sub-agent
  - Write minimal implementation to pass tests
  - Apply Comment Rules (Section 7.2): file headers, JSDoc, why-comments
  - Verify: run tests → all PASS
  ↓
Refactor: call tdd-refactorer sub-agent
  - No behavior changes allowed
  - Verify comment quality and supplement missing JSDoc/headers
  - Verify: tests still PASS
  ↓
Verify: full test suite + feature verification
  - On failure, return to Green/Red (max 5 iterations)
  - After 5 iterations, escalate
```

#### test_strategy = "state-verification":

For features with rendering, canvas, DOM, or visual output where strict TDD is impractical.

```
Plan (analyze acceptance_test, identify testable state vs visual output)
  ↓
Implement: call tdd-implementer sub-agent
  - Build the full feature implementation
  - Apply Comment Rules (Section 7.2): file headers, JSDoc, why-comments
  - Verify: compile/lint pass
  ↓
State-Test: call tdd-test-writer sub-agent
  - Write state verification tests (NOT pixel-level rendering checks)
  - Test: calculated positions, sizes, colors, call counts, state transitions
  - Example: "after renderFrame(), verify drawFruit called once per body"
  - Verify: run tests → all PASS
  ↓
Refactor: call tdd-refactorer sub-agent
  - No behavior changes allowed
  - Verify comment quality and supplement missing JSDoc/headers
  - Verify: tests still PASS
  ↓
Verify: full test suite + feature verification
  - On failure, fix implementation or tests (max 5 iterations)
```

#### test_strategy = "integration":

For wiring/entry-point features that connect multiple modules.

```
Plan (analyze acceptance_test, identify integration points)
  ↓
Implement: call tdd-implementer sub-agent
  - Build the feature implementation
  - Apply Comment Rules (Section 7.2): file headers, JSDoc, why-comments
  - Verify: compile/lint pass
  ↓
Integration-Test: call tester sub-agent
  - Write integration tests covering cross-module interactions
  - Verify: run tests → all PASS
  ↓
Verify: full test suite + feature verification
  - On failure, fix (max 5 iterations)
```

#### Agent Team mode:
Create a team for parallel module development. Each team member runs its own TDD sub-agent cycle.

```
TeamCreate(members: [implementer-a, implementer-b, reviewer, qa-agent?])
  ↓
TaskCreate(FEAT-XXX -> implementer-a, FEAT-YYY -> implementer-b)
  ↓
Each implementer independently:
  Red(tdd-test-writer) → Green(tdd-implementer) → Refactor(tdd-refactorer)
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

#### Hybrid mode:
Follow the orchestrator's per-phase mode specification. Switch between sub-agent and team calls as defined.

### Step 5: Confirm Quality Gate Passage
- Gate 0: TDD compliance (evidence: test files, Red → Green call order)
- Gate 1: Implementation complete (evidence: compile/lint/test output)
- Gate 2: Code review (call reviewer agent → 0 Critical/Major issues)
  - If QA agent is included: QA boundary verification report feeds into Gate 2
  - Boundary mismatches are Critical severity (block commit)
- Gate 3: Tests pass (coverage report)
- Gate 4: Deploy approval (feature passes: true ready)

### Step 6: Code-Doc Sync
Update related documents per the mapping table:
- Source changes → related docs/*.md, sub CLAUDE.md
- Feature complete → feature-list.json (passes: true)
- All changes → PROGRESS.md

### Step 7: Update Feature Status + Single Commit
After all quality gates pass, update feature status and commit:

1. Run `scripts/update-feature-status.sh FEAT-XXX` to mark `passes: true` in feature-list.json
2. Update PROGRESS.md with completion record
3. Stage only changed code, tests, and docs explicitly — never use `git add .`
```bash
bash scripts/update-feature-status.sh FEAT-XXX
git add {changed source files} {test files} {doc files} feature-list.json PROGRESS.md
git commit -m "feat(FEAT-XXX): {description}"
```

The PreToolUse hooks automatically verify:
- **doc-sync-check**: blocks commit if docs are missing
- **coverage-gate**: blocks commit if tdd_focus functions lack test coverage

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
- **One feature per agent at a time** (key Anthropic lesson). Sub-agent mode: one feature total. Agent Team mode: one feature per team member, multiple in parallel across the team.
- **One feature per commit** (non-negotiable). Each feature must be committed individually with its tests and docs before proceeding to the next. Never batch multiple features into a single commit — this enables `git revert` per feature and satisfies Gate 4. If the user requests "implement all features at once", still execute them sequentially: TDD cycle → quality gates → commit → next feature. Parallel Agent Team mode commits each module's feature independently.
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
