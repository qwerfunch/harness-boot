# TDD Cycles by `test_strategy`

This file defines the four per-feature development cycles selected by `feature-list.json` `test_strategy` and the Gate 0 evidence rules that verify each cycle's output. `commands/start.md` Step 4 invokes the cycle below matching the feature's strategy; Step 5 runs the Gate 0 checks on the SHAs / artifacts produced by the cycle.

All cycles execute inside a single `implementer-<slug>`'s context. TDD / BDD leaves (`tdd-test-writer`, `tdd-implementer`, `tdd-refactorer`, `bdd-writer`, `tester`) are invoked via the `Agent` tool — they are leaves, not coordination participants, and do not read or write `_workspace/handoff/` envelopes.

---

## Cycle: lean-tdd <!-- anchor: cycle-lean-tdd -->

Default strategy. "TDD mindset, no TDD ceremony." Implementer designs the code for testability (separable functions, pure boundaries, DI points) without writing tests during the build, then a post-hoc BDD pass verifies at the feature boundary.

```
Design: implementer (self, no sub-agent)
  - Analyze tdd_focus + acceptance_test
  - Decompose into separable functions / pure boundaries / DI points
  - Produce `_workspace/{feature_id}_design.md` with function sketch + testability notes
  ↓
Implement: call tdd-implementer sub-agent
  - Build the full implementation following the design sketch
  - Apply Comment Rules (see `docs/setup/code-style.md#comment-rules`): file headers, JSDoc, why-comments
  - MUST NOT write tests (tests arrive in the next phase)
  - Verify: compile/lint pass
  ↓
BDD-Verify: call bdd-writer sub-agent
  - Read acceptance_test + type headers ONLY (implementation code is forbidden)
  - Write one Given/When/Then block per acceptance_test scenario
  - Output file: {test-dir}/{feature_id}.bdd.{ext}
  - Verify: run BDD suite → all PASS
  ↓
Refactor: call tdd-refactorer sub-agent  (optional — skip if impl is clean)
  - No behavior changes allowed
  - Verify comment quality and supplement missing JSDoc/headers
  - Verify: BDD suite still PASS
  ↓
Verify: full test suite + feature verification
  - On BDD failure:
    (a) scenario itself wrong → re-invoke bdd-writer with corrected input
    (b) implementation bug → return to Implement (iteration++)
  - After 5 iterations, escalate (see `iteration-cycle.md`)
```

> `lean-tdd` trades strict Red→Green isolation for fewer sub-agent hops (3 → 2) and skipped test-writing during build. Use for most features. When spec is ambiguous or the domain is safety-critical (auth / payment / security / crypto / credential), switch to `tdd`.

## Cycle: tdd <!-- anchor: cycle-tdd -->

Safety-critical opt-in. Strict three-sub-agent isolation. Use when invariants are security-sensitive (auth / payment / security / crypto / credential domains) or when the spec is ambiguous enough that test-first discipline helps pin it down.

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

### `lean-tdd` <!-- anchor: gate-0-lean-tdd -->

No Red→Green ordering. Evidence is the post-hoc BDD artifact produced by `bdd-writer`:

```
bdd_file     ← {test-dir}/{feature_id}.bdd.{ext}
scenarios    ← count of Given/When/Then blocks inside bdd_file
expected     ← length of the feature's acceptance_test array

# Evidence checks:
(1) `bdd_file` exists
(2) `scenarios >= expected` (every acceptance_test scenario covered at least once)
(3) BDD suite execution exits 0 (all scenarios PASS)
```

If any check fails, Gate 0 blocks. The implementer decides between (a) re-invoking `bdd-writer` with a corrected input when a scenario is malformed, or (b) returning to Implement when the failure is an implementation bug (iteration++). The `pre-tool-coverage-gate.mjs` `lean-tdd` branch enforces checks (1) and (2) at commit time.

### `state-verification` <!-- anchor: gate-0-state-verification -->

No Red→Green ordering. Gate 0 = "test file exists under the feature's category path" (enforced by `pre-tool-coverage-gate.mjs` state-verification branch). The orchestrator additionally confirms at least one assertion file lives alongside the implementation.

### `integration` <!-- anchor: gate-0-integration -->

No Red→Green ordering. Gate 0 = "integration test file exists and exercises at least one cross-module boundary named in the feature's `tdd_focus`".
