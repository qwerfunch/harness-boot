# TDD Loop Protocol

Defines the per-feature development cycle by `test_strategy`:
- `lean-tdd` (default): Design → Implement → BDD-Verify → Refactor
- `tdd` (safety-critical opt-in): Red → Green → Refactor
- `state-verification` (UI/rendering): Implement → State-Test → Refactor
- `integration` (wiring / entry points): Implement → Integration-Test

The protocol is executed by the per-module `implementer-<slug>` agent for each feature.

> Single source of authority for per-feature cycle behavior. When `commands/start.md` §5 and this file disagree, start.md wins and this file is the one that gets updated.

## Ownership

- The feature's `implementer-<slug>` agent owns the cycle. Sub-agents (`tdd-implementer`, `tdd-refactorer`, `bdd-writer`, and conditionally `tdd-test-writer`) are called by the implementer and do not own cycle state.
- Iteration counter semantics are defined in `iteration-cycle.md` — this file only describes phase content and transitions.

## Phases by `test_strategy`

### `lean-tdd` (default — TDD mindset, no TDD ceremony)

| Phase | Sub-agent | Entry condition | Exit condition |
|-------|-----------|-----------------|----------------|
| Design | implementer (self) | tdd_focus + acceptance_test (sanitized) | `_workspace/{feature_id}_design.md` written with function sketch, pure boundaries, DI points |
| Implement | `tdd-implementer` | Design exit OK | Compile/lint pass; MUST NOT write tests |
| BDD-Verify | `bdd-writer` | Implement exit OK | `{test-dir}/{feature_id}.bdd.{ext}` exists; Given/When/Then block count ≥ `acceptance_test.length`; BDD suite PASSES |
| Refactor (optional) | `tdd-refactorer` | BDD-Verify OK | No behavior change; BDD suite still PASSES; Comment Rules verified |
| Verify | implementer (self) | Refactor or BDD-Verify exit OK | Quality Gates 0-3 cleared |

BDD failure branches:
- Scenario malformed → re-invoke `bdd-writer` with corrected input (not counted unless repeat-failure).
- Implementation bug → return to Implement, iteration += 1.

### `tdd` (strict, safety-critical opt-in)

| Phase | Sub-agent | Entry condition | Exit condition |
|-------|-----------|-----------------|----------------|
| Red   | `tdd-test-writer` | tdd_focus + acceptance_test (sanitized, see start.md "Sub-agent input sanitization") | All written tests FAIL for the expected reasons |
| Green | `tdd-implementer` | Red exit OK | All feature tests PASS; full suite still PASSES |
| Refactor | `tdd-refactorer` | Green exit OK | No behavior change; suite still PASSES; Comment Rules verified |
| Verify | implementer (self) | Refactor exit OK | Quality Gates 0-3 cleared |

Red failure after Green → return to Red with an incremented iteration (see `iteration-cycle.md`).

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

1. **Retry current phase** (test/scenario assertion wrong, minor impl bug) → same phase, iteration += 1
2. **Step back one phase** (e.g., BDD-Verify reveals a shape mismatch in Implement) → previous phase, iteration += 1
3. **Escalate to `debugger`** (5+ consecutive failures on the same phase, or root cause unclear) — see `iteration-cycle.md` escalation path

The implementer never edits sub-agent artifacts directly. If a BDD scenario is wrong, it re-invokes `bdd-writer` with corrected inputs; if a `tdd` test is wrong, it re-invokes `tdd-test-writer`.

## Sub-agent isolation invariants

- `tdd-implementer` MUST NOT write tests when running under `lean-tdd`; test writing is deferred to `bdd-writer`. Under `tdd`, it reads the test file contents and acceptance criteria but not the test-writing rationale.
- `tdd-refactorer` MUST NOT change behavior; verified by running the suite before and after.
- `bdd-writer` MUST NOT read implementation code. Reads are restricted to the feature's `acceptance_test` array plus public type headers (`*.d.ts`, `*.types.*`, exported interface files).
- `tdd-test-writer` (when generated) MUST NOT read implementation code. Tool list excludes `Edit`; file globs restrict reads to `*.d.ts`, `*.types.*`, test files, and interface headers — the full allowed/forbidden matrix is embedded in `tdd-test-writer.md`'s own `## File Classification` section.

## Definition of done (per feature)

1. For `lean-tdd`: a BDD file exists with ≥ `acceptance_test.length` Given/When/Then blocks, all passing. For `tdd`: every `tdd_focus` function has tests covering the success path and at least one failure path.
2. All Quality Gates (0-4) cleared with evidence captured to `_workspace/`
3. Single commit on the feature branch
4. `feature-list.json` entry updated to `passes: true` via `scripts/update-feature-status.sh`
5. `CHANGELOG.md [Unreleased]` gains one entry in `conversation_language`
