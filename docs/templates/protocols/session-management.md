# Session Management Protocol

Defines how the harness boots, resumes, and terminates sessions across `/setup` and `/start` invocations. Every session begins by reconciling state; every session ends by persisting state to the same files.

## Persistent state files

| File | Role | Writer | Reader |
|------|------|--------|--------|
| `PROGRESS.md` | Current position: phase, active feature, iteration, metrics | orchestrator, implementer (their feature's counter only) | every agent at session start |
| `feature-list.json` | Feature queue, dependencies, status | `scripts/update-feature-status.sh` (via orchestrator on Gate 4) | orchestrator, implementer, reviewer |
| `CHANGELOG.md` | Release-facing history, `conversation_language` | orchestrator on Gate 4 | human readers |
| `_workspace/` | Agent Team intermediate artifacts (reports, diffs, escalation trails) | any agent that produces an artifact | orchestrator, debugger, qa-agent |

No other file is authoritative session state. Do not invent new state files without extending this table.

## Session start (every `/setup` or `/start` run)

Triggered by the `SessionStart` hook: `hooks/session-start-bootstrap.sh`.

1. **Bootstrap hook output** (stdout, shown to Claude at load):
   - `PROGRESS.md` Status section (last_completed_phase, current_feature, mode, execution_mode)
   - `## Current TDD State` block (feature_id, iteration, phase, auto_pilot)
   - `feature-list.json` counts (total, passing)
   - **Drift detection**: rows where PROGRESS.md and feature-list.json disagree about `passes`
   - Last 5 commits (oneline)

2. **Orchestrator reconciles**:
   - If `last_completed_phase` ∈ {1,2,3,4,5} → resume `/setup` at the next phase
   - If `last_completed_phase == setup_complete` → enter `/start` flow
   - If drift detected → halt, surface to user, require resolution before any new work

3. **Mode detection**:
   - `PROGRESS.md ## Status.mode` = `initializer` → run initialization checklist
   - `= coding` → proceed to feature selection

## Drift resolution

When bootstrap detects `PROGRESS.md.passes != feature-list.json.passes` for any feature:

1. Orchestrator halts before any tool call
2. Emits a summary: which feature, which side says what, last commit touching that feature
3. Asks the user (one question at a time, numbered):
   ```
   (1) ★ Trust feature-list.json (update PROGRESS.md's `## Completed Features`)
   (2) Trust PROGRESS.md (update feature-list.json's `passes` field)
   (3) Investigate — read the last commit manually before deciding
   ```
4. Applies the chosen fix in one commit (subject: `fix(state): resolve drift on FEAT-XXX`)
5. Re-runs the bootstrap hook to confirm drift is cleared

## Session end

A session ends when:

- Auto-pilot exhausts the queue (all features `passes: true`)
- User sends `stop` / `pause` / `end`
- Convergence failure escalates and the user picks "end session"
- Unrecoverable error (hook returns exit 1 repeatedly, unknown tool error)

Actions on session end:

1. Any in-flight phase is allowed to reach its phase boundary before termination (see start.md "Stop propagation in Agent Team mode")
2. Open PROGRESS.md `## Current TDD State` entries for cancelled features are set to `phase: "", auto_pilot: false` (iteration retained)
3. `## Session Metrics.cumulative_tokens` is updated
4. `_workspace/` is preserved (not cleaned) — next session can use it as context

## Session resume guarantees

- No silent re-entry into the same iteration: the bootstrap hook always surfaces `iteration` so the user can see "picking up at iteration 3 of FEAT-042"
- No double-increment: the implementer reads `iteration` from PROGRESS.md and increments exactly once per cycle (see `iteration-cycle.md`)
- Phase boundaries are atomic: if a session was killed mid-phase, the next session treats the work as not-yet-committed and re-runs the phase from the start

## Observability cross-reference

- `_workspace/hook-stderr.log` — every hook's block/warn message (see `.claude/observability.md`)
- PROGRESS.md `## Session Metrics.session_start` — timestamp of current session begin
- `git reflog` — orchestrator can reconstruct session boundaries from git activity if PROGRESS.md is suspected stale
