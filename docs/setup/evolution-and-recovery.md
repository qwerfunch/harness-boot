# Code-Doc Sync, Evolution, and Error Recovery

## Code-Doc Sync

### Triple Defense

| Layer | Mechanism | Timing |
|-------|-----------|--------|
| Prompt | code-doc-sync.md protocol | During work |
| Hook | pre-tool-doc-sync-check.mjs | Just before git commit (blocking) |
| Review | Reviewer 3-stage review | During code review |

### Hook Logic (pre-tool-doc-sync-check.mjs)

The doc-sync hook uses a **granular check** rather than blanket "any src → any md" enforcement:

1. Parse staged files as before (detect `git commit` command)
2. For each staged `src/` file, check if the diff contains **export changes**:
   ```bash
   git diff --cached -U0 -- "$SRC_FILE" | grep -qE '^\+.*export|^\-.*export'
   ```
3. **If no export lines changed** → internal refactoring (constants, implementation details). Skip doc requirement. Allow commit.
4. **If export changes detected** → read current feature's `doc_sync` targets from `feature-list.json`. Only require that those specific `.md` files are in the staged set.
5. **If feature has no `doc_sync` targets** (empty array) → fall back to blanket behavior: any `.md` file must be staged if `src/` changed.
6. `[skip-doc-sync]` in commit message → bypass all checks (emergency escape hatch)

> **Why granular?** Blanket "src changed → md required" causes friction on internal refactors, constant tweaks, and implementation optimizations that don't change module interfaces. This leads to `[skip-doc-sync]` overuse, defeating the purpose of the hook. The export-change heuristic catches genuine API changes while allowing internal work to flow freely.

### Mapping Table

The following is an **example** mapping. `/setup` generates a project-specific mapping table based on the plan's directory structure and tech stack. The hook enforces `doc_sync` targets per-feature from `feature-list.json`. The mapping table below is for human reference and reviewer use.

```
# Example (customize per project during /setup)
src/api/**          → docs/api.md, src/api/CLAUDE.md
src/components/**   → docs/components.md, src/components/CLAUDE.md
prisma/**           → docs/schema.md, .claude/environment.md
package.json        → .claude/environment.md

# These rules are always applied regardless of project
new directory       → add row to .claude/context-map.md (module → layer)
.claude/**          → CHANGELOG.md
feature complete    → feature-list.json (passes: true)
all changes         → PROGRESS.md
```

---

## Learning / Evolution

> Harness evolution patterns adapted from [revfactory/harness](https://github.com/revfactory/harness) (Apache-2.0).

### Collected Metrics
Per-task iteration_count, per-sub-agent duration, top 10 test failure frequency, doc-missing frequency, escalation frequency.

### Storage

Metrics are appended to `PROGRESS.md` under a `## Metrics` section:
- Per-feature: `FEAT-XXX: iterations={N}, duration={M}s, escalated={bool}`
- Per-session summary at session end
- The bootstrap hook reads this section to provide trend data at session start

### Improvement Triggers
- Average iteration_count > 3 → review test strategy
- Same file missing docs 3+ times → add to mapping table
- Specific sub-agent failing frequently → improve prompt
- Frequent escalations → make skill procedures more specific

### Harness Evolution

The harness is not a static artifact — it evolves with user feedback.

#### Post-Execution Feedback

After each harness execution, offer the user a feedback opportunity (do not force):
- "Any improvements needed in the results?"
- "Want to change the agent team structure or workflow?"

#### Feedback Routing

| Feedback Type | Modify | Example |
|--------------|--------|---------|
| Output quality | Agent's skill | "Analysis too shallow" → add depth criteria to skill |
| Agent role | Agent definition `.md` | "Need security review too" → add agent |
| Workflow order | Orchestrator agent | "Verification should come first" → reorder phases |
| Team composition | Orchestrator + agents | "Merge these two agents" → consolidate |
| Trigger miss | Skill description | "Doesn't activate on this phrase" → expand description |

#### Change History

All project changes are tracked in CHANGELOG.md using [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Initial project setup via harness-boot
- {N} features defined in feature-list.json

## [0.1.0] - YYYY-MM-DD

### Added
- FEAT-001: {description}
- FEAT-002: {description}

### Changed
- FEAT-003: {description}

### Fixed
- FEAT-004: {description}
```

During `/start`, each feature completion appends an entry under `## [Unreleased]` with the appropriate category (Added/Changed/Fixed/Removed). Category is determined from the feature's description and the nature of the work performed.

**Language**: CHANGELOG.md is a Tier 2 user-facing file (see `cross-session-state.md#language-settings`). The initial entry generated during `/setup` Phase 6 and every per-feature entry appended during `/start` are written in `conversation_language`. The Keep a Changelog structural markers (`## [Unreleased]`, `## [x.y.z]`, `### Added`, `### Changed`, `### Fixed`, `### Removed`) stay English as standard format per the Keep a Changelog spec — only the human description text following each `- ` bullet follows the user's locale.

#### Evolution Triggers

Proactively suggest harness evolution when:
- Same feedback type repeats 2+ times
- An agent fails repeatedly with the same pattern
- User manually bypasses the orchestrator to work directly

---

## Error Recovery Playbook

### Purpose

`.claude/error-recovery.md` must contain **actionable recovery procedures**, not generic advice. The 5 scenarios below cover the most common failure modes in harness-driven development. During `/setup` Phase 6, generate error-recovery.md using these templates, adapted to the project's tech stack.

### Scenario Templates

#### Scenario 1: Gate 2 Consecutive Failure (> 5 iterations)

```markdown
## Gate 2: Consecutive Review Failure

**Trigger**: Reviewer rejects 5+ times on the same feature.

**Symptoms**:
- Same Critical/Major issues reappearing after fixes
- Iteration count reaching max (5) without convergence
- Implementer applying surface-level fixes that don't address root cause

**Recovery**:
1. STOP the TDD cycle. Do not attempt iteration 6+.
2. Save current state: `git stash` or commit with `[wip]` prefix
3. Run debugger agent for root cause analysis:
   - `Agent(debugger)` with prompt: "Analyze Gate 2 rejection history for FEAT-XXX. Identify the recurring pattern."
4. If architectural issue detected:
   - Call architect agent to propose structural fix
   - May require feature decomposition (split into smaller features)
5. If unclear: escalate to user with:
   - Rejection history summary (issue + attempted fix per iteration)
   - Debugger analysis
   - Proposed options (A: restructure, B: simplify scope, C: user decision)

**Prevention (mandatory)**: The orchestrator MUST check PROGRESS.md `iteration` count before dispatching each TDD cycle iteration to sub-agents:
- `iteration >= 3` → WARN: log warning in PROGRESS.md, continue
- `iteration >= 5` → BLOCK: do NOT dispatch. Log to `## Incidents` table (date, feature ID, type="convergence-failure"). Escalate to user immediately.
- On feature completion → reset `iteration: 0` in PROGRESS.md
```

#### Scenario 2: Sub-agent Crash / Context Overflow

```markdown
## Sub-agent Crash or Context Overflow

**Trigger**: TDD sub-agent (test-writer, implementer, refactorer) fails mid-execution.

**Symptoms**:
- Agent returns error or empty response
- Partial file writes (incomplete test/implementation)
- "Context window exceeded" error

**Recovery**:
1. Check for partial writes:
   - `git diff` to identify uncommitted changes
   - If partial: `git checkout -- {partial-files}` to revert incomplete changes
2. Split the tdd_focus batch:
   - Current batch has too many functions → split into 2-3 smaller batches
   - Each batch runs a full Red-Green-Refactor cycle independently
3. Retry with reduced scope:
   - Pass fewer acceptance_test items to the sub-agent
   - Reduce context by referencing only directly relevant type files
4. If crash persists after 2 retries:
   - Log the failure in PROGRESS.md under `## Incidents`
   - Escalate to user: "Sub-agent {name} failing on FEAT-XXX. Possible cause: {context size / complexity}."

**Prevention**: Monitor sub-agent context usage. If tdd_focus has > 5 functions, pre-split before calling sub-agents.
```

#### Scenario 3: Doc-Sync Hook Blocks 3+ Consecutive Commits

```markdown
## Doc-Sync Hook Repeated Block

**Trigger**: pre-tool-doc-sync-check.mjs blocks commit 3+ consecutive times.

**Symptoms**:
- Commit attempt returns exit 2 with "source changed but no .md changes"
- Developer has updated docs but hook still blocks (mapping mismatch)
- Generated mapping targets don't match actual project structure

**Recovery**:
1. List the exact blocking condition:
   - Run `node hooks/pre-tool-doc-sync-check.mjs` manually with the stdin JSON to see which files trigger
2. Check mapping table accuracy:
   - Compare `code-doc-sync.md` mapping paths against actual directory structure
   - Fix any stale paths (renamed/moved directories)
3. If mapping is correct but docs genuinely don't need updating:
   - Use escape hatch: include `[skip-doc-sync]` in commit message
   - Document the reason in the commit body
4. If mapping is wrong:
   - Update `code-doc-sync.md` mapping table
   - Update `.claude/protocols/code-doc-sync.md` if patterns changed
   - Include mapping fix in the same commit
5. Present to user if unclear:
   - "These source files triggered doc-sync: {list}"
   - "Mapped doc targets: {list}"
   - "Options: (A) update docs, (B) fix mapping, (C) commit with [skip-doc-sync]"

**Prevention**: Review mapping table during `/setup` Phase 2. Validate paths exist.
```

#### Scenario 4: Database Migration Failure

```markdown
## Database Migration Failure

**Trigger**: Prisma migrate / Alembic / Flyway fails during feature implementation.

**Symptoms**:
- Migration command exits with error (schema conflict, syntax error, data violation)
- Database in inconsistent state (partial migration applied)
- Tests fail due to schema mismatch

**Recovery**:
1. Check migration status:
   - {STATUS_COMMAND}  # e.g., npx prisma migrate status, alembic current
2. If partial migration applied:
   - Run down-migration: {DOWN_COMMAND}  # e.g., npx prisma migrate reset --force (dev only)
   - Verify clean state: {STATUS_COMMAND}
3. Fix the migration file:
   - Check for syntax errors, type mismatches, constraint violations
   - Verify against domain-persona.md entity invariants
4. Re-run migration:
   - {MIGRATE_COMMAND}  # e.g., npx prisma migrate dev
5. If migration cannot be fixed:
   - Delete the failed migration file
   - Regenerate from schema: {GENERATE_COMMAND}
   - Review generated SQL before applying
6. Update docs:
   - Ensure migration is documented in the commit message
   - Verify down-migration exists (Gate 4 requirement)

**Prevention**: Always create down-migration alongside up-migration. Test migrations against a fresh database before committing.
```

#### Scenario 5: Agent Context Window Limit Reached

```markdown
## Agent Context Window Limit

**Trigger**: Main orchestrator or implementer context fills during a complex feature.

**Symptoms**:
- Agent responses become truncated or lose earlier context
- Agent "forgets" earlier TDD phases or acceptance criteria
- Quality of responses degrades noticeably

**Recovery**:
1. Save progress immediately:
   - Commit current passing state with `[wip] FEAT-XXX: partial implementation`
   - Record current TDD phase in PROGRESS.md: `phase: Green (3/5 tdd_focus complete)`
2. Start a new session:
   - The SessionStart bootstrap hook loads PROGRESS.md context
   - Agent reads the `In Progress` feature and resumes from recorded phase
3. If the feature is too large for a single session:
   - Decompose into sub-features (FEAT-XXX-a, FEAT-XXX-b)
   - Each sub-feature gets its own TDD cycle
   - Note: feature-list.json items cannot be added, so track sub-features in PROGRESS.md only
4. For multi-module teams:
   - Distribute different tdd_focus functions across team members
   - Each member handles a smaller context load

**Prevention**: Monitor feature complexity. If tdd_focus has > 8 functions or acceptance_test has > 10 items, decompose before starting TDD.
```

### Generation Rules

1. Generate `error-recovery.md` during Phase 6 with all 5 scenarios
2. Replace `{STATUS_COMMAND}`, `{DOWN_COMMAND}`, `{MIGRATE_COMMAND}`, `{GENERATE_COMMAND}` placeholders based on tech stack (Prisma/Alembic/Flyway/Diesel)
3. Adapt file paths and tool names per project context
4. Add project-specific scenarios if the plan mentions external APIs, message queues, or other failure-prone integrations

---

## Observability

### Purpose

`.claude/observability.md` documents **what the harness emits, where to find it, and how to read it** — one page that points at every signal a developer or reviewer needs when things go wrong. It is loaded by the orchestrator at session start and surfaced in the escalation flow.

### Required Sections (template skeleton)

```markdown
# Observability

## Metrics tracked in PROGRESS.md
- `## Current TDD State` — feature_id, iteration, phase (Red/Green/Refactor/Verify), auto_pilot flag
- `## Status` — last_completed_phase, in-progress tasks, completed feature count
- `## Incidents` — date | feature_id | type (convergence-failure / gate-block / tool-error) | resolution
- `## Iteration History` — rolling log: feature_id, iteration, outcome (pass/retry/escalate)

## Hook logs
- Pre-tool hooks write block reasons to stderr; the orchestrator captures stderr and appends to `_workspace/hook-stderr.log`
- `pre-tool-coverage-gate.mjs`  — function name, calls count, block/warning level
- `pre-tool-doc-sync-check.mjs` — export-change file list, missing doc_sync targets
- `pre-tool-security-gate.mjs`  — blocked command + matched pattern
- `session-start-bootstrap.mjs` — PROGRESS.md ↔ feature-list.json drift summary
- `post-tool-test-runner.mjs`   — test command invoked, exit code, failing test names
- `post-tool-format.mjs`        — formatter invoked, files touched

## Quality gate evidence
- Gate 0: `git log` range queries (see start.md §5 Gate 0)
- Gate 1: compile/lint/test output captured to `_workspace/{feature}_gate1.txt`
- Gate 2: reviewer report at `_workspace/{feature}_review.md`; QA report at `_workspace/qa-{module}-report.md` when QA agent included
- Gate 3: coverage report at `{COVERAGE_FILE}` (path resolved from stacks.md)
- Gate 4: single commit SHA in CHANGELOG.md entry

## Update cadence
- PROGRESS.md `## Current TDD State` — every phase boundary (orchestrator)
- PROGRESS.md `## Status` — every phase completion (orchestrator)
- PROGRESS.md `## Incidents` — on escalation only
- feature-list.json `passes` field — after Gate 4 via `scripts/update-feature-status.mjs`
- CHANGELOG.md `## [Unreleased]` — after Gate 4, single entry per feature

## Escalation history
- Full escalation trail lives in PROGRESS.md `## Incidents`
- Cross-reference: each incident row cites the relevant `_workspace/` artifact for root-cause review
```

### Generation Rules

1. Generate `.claude/observability.md` during Phase 6 with all five sections above
2. Resolve `{COVERAGE_FILE}` to the concrete path chosen during Phase 1 Step 2 (from stacks.md)
3. Add project-specific signals only when the plan mentions external monitoring tools (Sentry, OpenTelemetry, structured log shipping) — otherwise keep the default set
4. Keep to ≤ 150 lines. Longer observability documentation goes into a referenced runbook, not this file
