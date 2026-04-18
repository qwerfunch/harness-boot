# TDD Loop Protocol

Defines the Red → Green → Refactor cycle for the `tdd` test strategy, and the variant cycles for `bundled-tdd`, `state-verification`, and `integration`. The protocol is executed by the per-module `implementer-<slug>` agent for each feature.

> Single source of authority for per-feature cycle behavior. When `commands/start.md` §5 and this file disagree, start.md wins and this file is the one that gets updated.

## Ownership

- The feature's `implementer-<slug>` agent owns the cycle. Sub-agents (`tdd-test-writer`, `tdd-implementer`, `tdd-refactorer`, `tdd-bundler`) are called by the implementer and do not own cycle state.
- Iteration counter semantics are defined in `iteration-cycle.md` — this file only describes phase content and transitions.

## Phases by `test_strategy`

### `tdd` (strict, default)

| Phase | Sub-agent | Entry condition | Exit condition |
|-------|-----------|-----------------|----------------|
| Red   | `tdd-test-writer` | tdd_focus + acceptance_test (sanitized, see start.md "Sub-agent input sanitization") | All written tests FAIL for the expected reasons |
| Green | `tdd-implementer` | Red exit OK | All feature tests PASS; full suite still PASSES |
| Refactor | `tdd-refactorer` | Green exit OK | No behavior change; suite still PASSES; Comment Rules (from the agent's embedded `## Comment Rules` section) verified |
| Verify | implementer (self) | Refactor exit OK | Quality Gates 0-3 cleared |

Red failure after Green → return to Red with an incremented iteration (see `iteration-cycle.md`).

### `bundled-tdd` (speed-oriented, single sub-agent, 2-commit evidence)

| Phase | Sub-agent | Entry | Exit |
|-------|-----------|-------|------|
| Bundled Red→Green | `tdd-bundler` | tdd_focus + acceptance_test (sanitized) | Two commits: `[bundled-tdd:red]` with failing test output, `[bundled-tdd:green]` with passing output. Test files byte-identical between the two commits. |
| Refactor (optional) | `tdd-refactorer` | bundler exit OK | No behavior change |
| Verify | implementer | Refactor or bundler exit OK | Gate 0 verified via `git diff <red-sha> <green-sha> -- <test-files>` empty |

Gate 0 failure (test files changed between red and green) → abort and restart the bundled cycle. The test-freeze self-check in start.md must catch this before the green commit is created.

### `state-verification` (UI/rendering)

| Phase | Sub-agent | Entry | Exit |
|-------|-----------|-------|------|
| Implement | `tdd-implementer` | tdd_focus + acceptance_test | Compile/lint pass |
| State-Test | `tdd-test-writer` | Implement exit OK | State tests PASS (positions, sizes, call counts — not pixel-level) |
| Refactor | `tdd-refactorer` | State-Test OK | No behavior change |
| Verify | implementer | Refactor OK | Gates 0-3 (Gate 3 = test files exist per module category) |

### `integration` (wiring / entry points)

| Phase | Sub-agent | Entry | Exit |
|-------|-----------|-------|------|
| Implement | `tdd-implementer` | integration points identified | Modules wired |
| Integration-Test | `tester` | Implement OK | End-to-end integration tests PASS |
| Verify | implementer | Integration-Test OK | Gates 0-3 (Gate 3 = 60% file coverage) |

## Failure → Re-entry

A phase failure returns control to the implementer with the failure evidence. The implementer decides:

1. **Retry current phase** (test assertion wrong, minor impl bug) → same phase, iteration += 1
2. **Step back one phase** (e.g., Green reveals the test was wrong) → previous phase, iteration += 1
3. **Escalate to `debugger`** (5+ consecutive failures on the same phase, or root cause unclear) — see `iteration-cycle.md` escalation path

The implementer never edits sub-agent artifacts directly. If a test is wrong, it re-invokes `tdd-test-writer` with corrected inputs.

## Sub-agent isolation invariants

- `tdd-test-writer` MUST NOT read implementation code. Tool list excludes `Edit`; file globs restrict reads to `*.d.ts`, `*.types.*`, test files, and interface headers — the full allowed/forbidden matrix is embedded in `tdd-test-writer.md`'s own `## File Classification` section.
- `tdd-implementer` MUST NOT read test-writing rationale; only the test file contents and acceptance criteria.
- `tdd-refactorer` MUST NOT change behavior; verified by running the suite before and after.
- `tdd-bundler` replaces the 3-sub-agent split with a single controlled flow — isolation is structural (2 commits), not contextual.

## Definition of done (per feature)

1. Feature's `tdd_focus` functions all have tests that cover the success and at least one failure path
2. All Quality Gates (0-4) cleared with evidence captured to `_workspace/`
3. Single commit (or rebased pair for bundled-tdd) on the feature branch
4. `feature-list.json` entry updated to `passes: true` via `scripts/update-feature-status.sh`
5. `CHANGELOG.md [Unreleased]` gains one entry in `conversation_language`
