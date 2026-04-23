---
name: new-feature
description: >
  Guides implementation of a new feature through the cycle selected by
  feature-list.json test_strategy (lean-tdd / tdd / state-verification /
  integration), with incremental delivery, per-increment verification, and
  mandatory code-doc sync before commit.
  TRIGGER when: user says "new feature", "implement", "add functionality",
  or orchestrator assigns a passes:false feature from feature-list.json.
  DO NOT TRIGGER when: user says "fix", "bug", "refactor", or when modifying
  existing behavior without new acceptance criteria.
metadata:
  author: harness-boot
  version: "1.0"
  category: development
allowed-tools: "Read Glob Grep Write Edit Bash"
---
# New Feature

## Overview
Orchestrates new-feature delivery. Reads the feature's `test_strategy` from
feature-list.json and runs the matching cycle (see each agent's `## TDD Cycles`
embed), then enforces Gate 0 evidence, code-doc sync, and a single
revertable commit per feature.

## When to Use
- **Trigger**: Orchestrator selects a `passes: false` feature, or user asks to
  implement a new, not-yet-existing behavior described by `acceptance_test`.
- **Not when**: Fixing a reproducible defect (use `bug-fix`), changing structure
  without behavior changes (use `refactor`), or touching only configuration.
- **Related skills**: `tdd-workflow` (invoked for `test_strategy: tdd`),
  `api-endpoint` / `db-migration` / `deployment` (layered on top when the
  feature crosses those surfaces).

## TDD Focus
- **Must test**: Every function name listed in the feature's `tdd_focus` —
  happy path, boundary, error case.
- **Test exempt**: Config, static assets, and pure type declarations with no
  runtime logic.
- **Coverage target**: Strategy-dependent. `tdd` = ≥70% line on tdd_focus;
  `lean-tdd` = BDD scenario count ≥ acceptance_test length; `state-verification`
  = state-test file exists per feature; `integration` = ≥60% file coverage on
  the touched boundary.

## Process
### Step 1: Load feature context
Read the feature entry from feature-list.json. Extract `acceptance_test`,
`tdd_focus`, `doc_sync`, and `test_strategy`.

### Step 2: Decompose into increments
Split into the smallest independently verifiable slices. Each slice maps to
1–3 `tdd_focus` functions ordered foundation-first.

### Step 3: Run the strategy's cycle per increment
Dispatch to the cycle matching `test_strategy`. The cycle body lives in each
invoking agent's `## TDD Cycles` section (embedded at Phase 3). Max 5
iterations per increment; escalate past that per the `## Iteration Tracking`
rule.

### Step 4: Gate 0 evidence check
Run the `## Gate 0 Evidence` block for the feature's strategy before Gate 1.
Block the cycle if evidence is missing.

### Step 5: Code-doc sync
Update every file in the feature's `doc_sync` array. The pre-commit doc-sync
hook blocks the commit when exports changed without the mapped docs staged.

### Step 6: Single commit
Stage code + tests/BDD + docs in one commit naming the feature ID. Verify
`git revert <sha>` cleanly undoes the change (the Gate 4 rollback
precondition).

## Common Rationalizations
| Excuse | Rebuttal |
|--------|----------|
| "I'll build the whole feature and add tests after" | The Gate 0 evidence check runs BEFORE Gate 1 — no evidence, no merge. Incremental discovers boundary bugs while they're cheap. |
| "This helper is too trivial to test" | If it appears in `tdd_focus`, it is in scope. "Trivial" functions are where off-by-one and null-case bugs live. |
| "I'll update docs after the code settles" | The PreToolUse doc-sync hook blocks the commit when exports changed without the mapped `doc_sync` files staged. "After" is not a reachable state. |
| "I can squeeze two features into one commit to save a review round" | Gate 4 rollback requires one feature per commit. Two features in one commit breaks `git revert` isolation — reviewer will reject. |

## Red Flags
- Implementation committed before the strategy's Gate 0 evidence exists
- Feature commit lacks any `doc_sync` file when `tdd_focus` changes public exports
- Iteration counter climbs past 3 without any root-cause note in PROGRESS.md
- Multiple `tdd_focus` functions jumped in a single Green/Implement step (hides where a regression entered)

## Verification
- [ ] Every `tdd_focus` function has tests (or BDD scenarios) covering happy / boundary / error (evidence: test file paths)
- [ ] Every `acceptance_test` item has a corresponding passing check (evidence: test runner or BDD output)
- [ ] Gate 0 evidence passes for the feature's `test_strategy` (evidence: strategy-specific artifacts)
- [ ] `doc_sync` targets updated (evidence: `git diff --name-only` contains each path)
- [ ] feature-list.json `passes: true`
- [ ] PROGRESS.md `iteration` reset to 0 and feature moved out of `## Current TDD State`
