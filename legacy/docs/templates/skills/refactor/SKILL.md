---
name: refactor
description: >
  Restructures existing code with zero observable behavior change. Requires
  the existing test suite (or a freshly added safety net for uncovered code)
  to pass identically before AND after. No behavior diffs — if tests need to
  change, it is not a refactor.
  TRIGGER when: user says "refactor", "restructure", "clean up", "rename",
  "extract", or "DRY up", and the described change does not add or alter
  observable behavior.
  DO NOT TRIGGER when: user says "add", "fix", "implement", or when the
  change alters an input/output, error message, or public contract — use
  `new-feature` or `bug-fix`.
metadata:
  author: harness-boot
  version: "1.0"
  category: maintenance
allowed-tools: "Read Glob Grep Write Edit Bash"
---
# Refactor

## Overview
The test suite is the contract. Refactor means moving, renaming, or
restructuring code such that the contract's shape is unchanged and every
existing assertion still passes without edits. If a test needs to be
rewritten, the change is not a refactor — reclassify as `new-feature` or
`bug-fix` first.

## When to Use
- **Trigger**: Duplication, unclear naming, leaky abstractions, or a
  structural change to prepare for a future feature — all WITHOUT behavior
  change.
- **Not when**: The target surface is untested (add tests first — see Step 1
  below), the request changes observable behavior, or the goal is
  performance with measurable output change.
- **Related skills**: `bug-fix` (use first if the restructure would mask a
  defect), `tdd-workflow` (use first if the untested target area needs a
  pin-down test).

## TDD Focus
- **Must test**: Any target of the refactor currently uncovered — add a
  "pin-down" test before touching the code. The pin-down is an
  executable spec that freezes current behavior.
- **Test exempt**: Code already covered by an existing test whose assertion
  surface does not change.
- **Coverage target**: Post-refactor coverage ≥ pre-refactor coverage on
  touched files. No test deletions without an explicit justification.

## Process
### Step 1: Pin down current behavior (if uncovered)
For any function touched by the refactor that has no existing test,
write a pin-down test that captures current output for representative inputs.
Run; confirm it passes on `HEAD` before any change. Commit pin-down
separately.

### Step 2: Run baseline
Run the full test suite. Record the count of passing tests. This is the
contract you must preserve byte-for-byte.

### Step 3: Perform the smallest mechanical move
Rename, extract, inline, or re-organize. One change kind per step. No
behavior edits sneaked in.

### Step 4: Re-run
Full suite must pass identically — same test count, no renamed assertions,
no modified expectations. If a test's *expected value* needed changing, stop:
you accidentally changed behavior. Revert and reclassify the change.

### Step 5: Doc sync (rare, but)
If the refactor renamed an export or moved a module path that is cited in
`doc_sync` targets, update those docs. The pre-commit hook blocks otherwise.

### Step 6: Single commit
Stage code (+ optional pin-down test from Step 1) as one commit prefixed
`refactor:`. The commit must be revertable cleanly.

## Common Rationalizations
| Excuse | Rebuttal |
|--------|----------|
| "The code was clearly untested, I'll just restructure — I'll add tests later" | Without a pin-down, you have no way to detect that the restructure changed behavior. Step 1 is non-optional. |
| "This is just a rename; surely no test can break" | Renames in dynamic languages or reflective frameworks can silently break consumers. Run the suite anyway. |
| "I changed the structure AND fixed a tiny bug while I was there — it's all one change" | No. The bug fix needs its own reproduction test (see `bug-fix` skill). Bundling defeats `git revert` and hides which change regressed what. |
| "Assertion text updated to match the new naming, tests still pass" | Editing assertions is a behavior change by definition — the contract moved. Stop and reclassify. |

## Red Flags
- A test file's `expected:` values changed in the refactor commit
- Test count dropped between pre- and post-refactor runs
- Refactor commit contains a `// TODO fix` or `// FIXME` that implies behavior change
- Pin-down test was committed in the same commit as the restructure (cannot verify pre-refactor baseline independently)

## Verification
- [ ] Baseline test run captured pre-refactor (evidence: stdout pasted in PR or captured in `_workspace/`)
- [ ] Post-refactor full suite passes with identical test count (evidence: runner output)
- [ ] No `expected:` / `.toBe(...)` / assertion-surface edits in the diff (evidence: `git diff`)
- [ ] Coverage did not decrease on touched files (evidence: coverage report delta)
- [ ] `git revert <sha>` restores the old structure and the suite still passes
