---
name: tdd-workflow
description: >
  The strict TDD subprocess invoked inside each implementer when a feature's
  test_strategy is "tdd". Enforces Red → Green → Refactor sub-agent
  isolation, SHA-based evidence, and the 5-iteration cap before
  escalation.
  TRIGGER when: a feature with `test_strategy: "tdd"` enters Step 4 of
  /start, or the user explicitly asks for strict TDD on a safety-critical
  slice (auth / payment / security / crypto / credential).
  DO NOT TRIGGER when: the feature's `test_strategy` is `lean-tdd`,
  `state-verification`, or `integration` — those have their own cycles
  embedded in the agent bodies.
metadata:
  author: harness-boot
  version: "1.0"
  category: tdd
allowed-tools: "Read Glob Grep Write Edit Bash"
---
# TDD Workflow

## Overview
Strict three-sub-agent isolation (`tdd-test-writer` → `tdd-implementer` →
`tdd-refactorer`). Each sub-agent returns a SHA the orchestrator pins for
Gate 0 evidence. This skill is the procedural companion to the `tdd` cycle
embedded verbatim in each agent's `## TDD Cycles` section.

## When to Use
- **Trigger**: Feature's `test_strategy: "tdd"`. Always the case for
  safety-critical domains (auth / payment / security / crypto / credential);
  opt-in otherwise.
- **Not when**: Feature uses another strategy (the implementer reads its
  embedded cycle for those), or the change is a bug fix — use `bug-fix`.
- **Related skills**: `new-feature` (invokes this skill when the feature's
  strategy is `tdd`), `refactor` (post-Green cleanup while tests remain
  green).

## TDD Focus
- **Must test**: Each function in `tdd_focus` — happy path + boundary + error
  — all written in the Red phase before any implementation exists.
- **Test exempt**: None. If a `tdd_focus` function cannot be tested in
  isolation, restructure the code — that is a design signal, not an
  exemption.
- **Coverage target**: ≥70% line coverage on `tdd_focus`. The coverage-gate
  hook blocks the commit below this bar.

## Process
### Step 1: Sanitize input for tdd-test-writer
Strip implementation hints from `acceptance_test` (algorithm sketches,
internal structure names, "uses X internally") per the TDD Input
Sanitization clause embedded in the implementer agent. Record stripped
lines in `_workspace/red_implementer_{feature_id}-input.md`.

### Step 2: Red — invoke tdd-test-writer
Pass sanitized `tdd_focus` signatures and observable `acceptance_test`
items. Writer produces failing tests (happy/boundary/error) and commits
them. Verify: `<test-cmd>` → every new test FAILS for the expected reason.
Record `red_sha`.

### Step 3: Green — invoke tdd-implementer
Pass `tdd_focus` signatures and the Red test file paths. Implementer writes
the minimum code to turn every new test green. Apply Comment Rules
(file headers / JSDoc / why-comments). Verify: `<test-cmd>` → all PASS.
Record `green_sha`.

### Step 4: Refactor — invoke tdd-refactorer
No behavior change. Clean up duplication, improve naming, supplement
missing JSDoc/headers. Verify: tests remain green. Record `refactor_sha`.

### Step 5: Gate 0 evidence
Run the `tdd` sub-block from the agent's `## Gate 0 Evidence` section:
1. `git log --format=%H red_sha..green_sha` contains `green_sha` exactly (Red→Green order)
2. `git diff red_sha green_sha -- <test-files>` is empty (tests unchanged between Red and Green)
3. `git diff green_sha refactor_sha -- <test-files>` is empty (refactor did not touch tests)

Any failure → cycle restarts with `iteration++`. Five iterations → escalate
per the `## Iteration Tracking` rule.

### Step 6: Hand back to new-feature
Return to `new-feature` for Gate 1+ and the single-feature commit.

## Common Rationalizations
| Excuse | Rebuttal |
|--------|----------|
| "I'll write the test AND the implementation in one pass — it's faster" | The Gate 0 evidence requires distinct SHAs where tests were unchanged between Red and Green. One-pass has no such SHA separation — it will be rejected mechanically. |
| "The acceptance_test already describes the behavior — I don't need to strip implementation hints" | Any hint leaks implementation into the tests, defeating the isolation the `tdd` strategy was chosen for. Safety-critical domains specifically need tests that don't encode the implementation. |
| "Green phase needs an extra test I missed in Red — I'll add it quickly" | Tests added during Green break the `git diff red_sha green_sha -- <tests>` emptiness check. Go back to Red: writer adds the missing test, you re-record `red_sha`. |
| "5 iterations is a soft cap — this feature is tricky, I'll do 6" | The cap is enforced by the implementer's `## Iteration Tracking` embed. Six does not run. Escalate and reshape the feature boundary instead. |

## Red Flags
- Commit reordering such that `green_sha` precedes `red_sha` in `git log`
- A test file modified between `red_sha` and `green_sha` (diff non-empty)
- Any behavior-affecting edit inside the Refactor commit (violates the third Gate 0 check)
- `iteration` climbing past 3 without a root-cause note in PROGRESS.md

## Verification
- [ ] `red_sha`, `green_sha`, `refactor_sha` recorded in `_workspace/` (evidence: artifact paths)
- [ ] Red→Green ordering check passes (evidence: `git log` output)
- [ ] Tests unchanged between Red and Green (evidence: empty `git diff`)
- [ ] Refactor did not touch tests (evidence: empty `git diff`)
- [ ] Coverage on `tdd_focus` ≥ 70% (evidence: coverage report)
- [ ] Iteration counter reset to 0 on feature completion
