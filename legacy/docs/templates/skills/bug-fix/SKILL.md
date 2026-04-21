---
name: bug-fix
description: >
  Guides reproducible defect fixing. Requires a failing reproduction test
  before any production code change and leaves it in the suite as a
  regression guard. Enforces single-commit revertability and code-doc
  sync when public behavior shifted.
  TRIGGER when: user says "bug", "fix", "broken", "regression", "wrong
  behavior", or a debugger agent identifies a failing scenario that needs a
  targeted fix.
  DO NOT TRIGGER when: user says "new feature", "refactor", "restructure",
  or when no observable defect exists — use `new-feature` or `refactor`.
metadata:
  author: harness-boot
  version: "1.0"
  category: maintenance
allowed-tools: "Read Glob Grep Write Edit Bash"
---
# Bug Fix

## Overview
A defect is only fixed once the regression is locked in by a test. This skill
enforces "reproduce → fail → fix → pass → keep" as the only path. The
reproduction test stays in the suite permanently.

## When to Use
- **Trigger**: A reproducible defect with a clear "expected vs actual" delta.
- **Not when**: Intended behavior the user dislikes (that is a feature request
  — use `new-feature`), or code quality issues without a behavior bug (use
  `refactor`).
- **Related skills**: `tdd-workflow` (for the Red → Green parts),
  `refactor` (optional post-fix cleanup with tests already in place).

## TDD Focus
- **Must test**: The exact failing scenario from the bug report, plus the
  nearest boundary conditions (one case adjacent to the failure in each
  direction).
- **Test exempt**: Unrelated code paths — bug fix scope is bounded; do not
  opportunistically add tests outside the defect area.
- **Coverage target**: The reproduction test must fail on `HEAD` before the
  fix and pass after. No other coverage target is added by this skill.

## Process
### Step 1: Reproduce
Write or capture the minimal failing test that demonstrates the bug on
current `HEAD`. Run it; confirm it fails for the expected reason (not a
setup error). Commit nothing yet.

### Step 2: Root-cause
Read the failing assertion. Trace to the first function where `actual`
diverges from `expected`. Record the root cause in one sentence inside the
PR/commit message — no ceremony, just the chain.

### Step 3: Fix (smallest safe change)
Modify the smallest surface that turns the reproduction test green without
breaking neighbours. Do NOT bundle unrelated cleanup.

### Step 4: Re-run and widen
Run the reproduction test → PASS. Run the full test suite → all green. If a
new failure appears, the fix was wrong; revert and return to Step 3.

### Step 5: Doc sync (if exports changed)
If the fix modified a function listed in any feature's `doc_sync`, update
the mapped doc files — the pre-commit doc-sync hook will block otherwise.

### Step 6: Single commit
Stage test + fix (+ docs if applicable) in one commit with a "fix:" prefix
and the bug's reproduction summary. Verify `git revert <sha>` cleanly undoes
the fix and the reproduction test fails again on the revert SHA.

## Common Rationalizations
| Excuse | Rebuttal |
|--------|----------|
| "I can see the cause — I'll just fix it, no test needed" | Without the failing test, you have no evidence the "cause" you saw is the actual cause. The reproduction test is the only thing that proves the fix fixed what you think it fixed. |
| "A test for this would be too fiddly to write" | If the scenario is reproducible enough to report as a bug, it is reproducible enough to encode. Fiddly setup is the code smell — fix that first, the test second. |
| "I'll add a test once the fix is in" | Then the test was never failing on `HEAD`, so it proves nothing. The reproduction MUST fail before the fix lands. |
| "The fix also touches an unrelated smell — might as well clean it up" | Bundling dilutes `git revert` precision. Smell goes in a separate commit after the bug-fix commit lands. |

## Red Flags
- Commit message claims "fix X" but the diff contains no new/modified test
- Reproduction test written AFTER the fix (can't demonstrate it ever failed)
- Fix size > 10 lines without an explanation of scope — likely bundled work
- Pre-commit doc-sync hook bypassed with `[skip-doc-sync]` on a bug fix that changed public exports

## Verification
- [ ] Reproduction test existed and failed on the pre-fix SHA (evidence: `git stash pop && <test-cmd>` failing output)
- [ ] Reproduction test passes on the post-fix SHA (evidence: test runner output)
- [ ] Full suite green post-fix (evidence: CI or local runner output)
- [ ] `doc_sync` targets updated if public exports changed (evidence: `git diff --name-only`)
- [ ] `git revert <fix-sha>` runs clean and the reproduction test fails again (Gate 4 rollback evidence)
