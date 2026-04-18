# TDD Cycles by `test_strategy`

This file defines the four per-feature development cycles selected by `feature-list.json` `test_strategy` and the Gate 0 evidence rules that verify each cycle's output. `commands/start.md` Step 4 invokes the cycle below matching the feature's strategy; Step 5 runs the Gate 0 checks on the SHAs produced by the cycle.

All cycles execute inside a single `implementer-<slug>`'s context. TDD sub-agents (`tdd-test-writer`, `tdd-implementer`, `tdd-refactorer`, `tdd-bundler`, `tester`) are invoked via the `Agent` tool — they are never team members and never receive `SendMessage`.

---

## Cycle: tdd <!-- anchor: cycle-tdd -->

Strict three-sub-agent isolation. Default when spec is ambiguous or invariants are security-sensitive.

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
  - Apply Comment Rules (see `docs/setup/code-style.md#comment-rules`): file headers, JSDoc, why-comments
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

## Cycle: bundled-tdd <!-- anchor: cycle-bundled-tdd -->

Speed-oriented, single sub-agent. Use when the spec is unambiguous and speed outweighs the co-drift risk of test/impl in one context.

```
Plan (analyze acceptance_test)
  ↓
Bundled Red→Green: call tdd-bundler sub-agent
  - Write failing tests (happy/boundary/error)
  - Run tests → capture red output
  - Commit tests only with subject starting [bundled-tdd:red]
    (body includes the captured failing output)
  - Record frozen test paths: git diff --name-only HEAD~1 HEAD
    → store as <frozen-tests> list (e.g., *.test.*, *.spec.*, tests/**)
  - Self-check before green: for the entire green phase, exclude every
    path in <frozen-tests> from Write/Edit targets
  - Write minimal implementation (MUST NOT edit tests from here on)
  - Run tests → all PASS, capture green output
  - Self-check before commit: re-run git diff --name-only against the
    staged set; if any path in <frozen-tests> reappears, abort and
    restart the cycle (do NOT commit)
  - Commit implementation with subject starting [bundled-tdd:green]
    (body includes the captured passing output)
  ↓
Refactor: call tdd-refactorer sub-agent  (optional — skip if impl is clean)
  - No behavior changes allowed
  - Verify comment quality and supplement missing JSDoc/headers
  - Verify: tests still PASS
  ↓
Verify: full test suite + feature verification
  - Gate 0 check: git diff <red-sha> <green-sha> -- <test-files> must be empty
  - On failure, restart the bundled cycle (max 5 iterations)
  - After 5 iterations, escalate
  ↓
Pre-Gate 4 fold: rebase --interactive or reset --soft to combine the two
  internal commits into one feat(FEAT-XXX) commit. Keep red-sha/green-sha
  as trailers in the commit message body so Gate 0 evidence survives.
```

> `bundled-tdd` trades strict test/impl isolation for fewer sub-agent hops (3 → 1-2). Use only for features with clear specs and low co-drift risk. When in doubt, stay with `tdd`.

## Cycle: state-verification <!-- anchor: cycle-state-verification -->

For features with rendering, canvas, DOM, or visual output where strict TDD is impractical.

```
Plan (analyze acceptance_test, identify testable state vs visual output)
  ↓
Implement: call tdd-implementer sub-agent
  - Build the full feature implementation
  - Apply Comment Rules (see `docs/setup/code-style.md#comment-rules`): file headers, JSDoc, why-comments
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

## Cycle: integration <!-- anchor: cycle-integration -->

For wiring/entry-point features that connect multiple modules.

```
Plan (analyze acceptance_test, identify integration points)
  ↓
Implement: call tdd-implementer sub-agent
  - Build the feature implementation
  - Apply Comment Rules (see `docs/setup/code-style.md#comment-rules`): file headers, JSDoc, why-comments
  - Verify: compile/lint pass
  ↓
Integration-Test: call tester sub-agent
  - Write integration tests covering cross-module interactions
  - Verify: run tests → all PASS
  ↓
Verify: full test suite + feature verification
  - On failure, fix (max 5 iterations)
```

---

## Gate 0 Evidence Verification <!-- anchor: gate-0 -->

The orchestrator runs this check BEFORE Gate 1 using the feature's `tdd_focus` and `doc_sync` from `feature-list.json`.

### `tdd` <!-- anchor: gate-0-tdd -->

Three-sub-agent isolation. Each sub-agent returns its working SHA:

```
red_sha   ← Agent(tdd-test-writer)   # returns SHA after test commit (test files only)
green_sha ← Agent(tdd-implementer)   # returns SHA after impl commit (impl files only)
refactor_sha ← Agent(tdd-refactorer) # returns SHA after refactor (no behavior change)

# Evidence checks:
(1) `git log --format=%H red_sha..green_sha` → contains green_sha exactly (order: red → green)
(2) `git diff red_sha green_sha -- <test-files>` → empty (test files did NOT change between Red and Green)
(3) `git diff green_sha refactor_sha -- <test-files>` → empty (refactor did not touch tests)
```

If any check fails, Gate 0 blocks and the cycle restarts (iteration++).

### `bundled-tdd` <!-- anchor: gate-0-bundled-tdd -->

Single `tdd-bundler` sub-agent. Must return the structured contract:

```
{
  "red_sha":   "<sha after [bundled-tdd:red] commit>",
  "green_sha": "<sha after [bundled-tdd:green] commit>",
  "test_files": ["path/to/test1", "path/to/test2", ...]
}

# Evidence checks:
(1) `git log red_sha^..green_sha --format=%s` → subjects start with [bundled-tdd:red] then [bundled-tdd:green]
(2) `git diff red_sha green_sha -- <test_files>` → empty (tests unchanged between red and green commits)
(3) `git log -1 red_sha --format=%b`  → contains the captured failing output
(4) `git log -1 green_sha --format=%b` → contains the captured passing output
```

Pre-Gate 4 fold preserves `red_sha` / `green_sha` as commit-message trailers so the evidence survives the rebase.

### `state-verification` <!-- anchor: gate-0-state-verification -->

No Red→Green ordering. Gate 0 = "test file exists under the feature's category path" (enforced by `pre-tool-coverage-gate.sh` state-verification branch). The orchestrator additionally confirms at least one assertion file lives alongside the implementation.

### `integration` <!-- anchor: gate-0-integration -->

No Red→Green ordering. Gate 0 = "integration test file exists and exercises at least one cross-module boundary named in the feature's `tdd_focus`".
