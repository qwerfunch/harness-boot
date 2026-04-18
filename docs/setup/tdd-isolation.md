# TDD Sub-Agent Context Isolation

When TDD is performed in a single context, the test writer's analysis leaks to the implementer.
Separating Red/Green/Refactor into distinct sub-agents prevents this.

| Sub-Agent | Phase | Rules | Model |
|-----------|-------|-------|-------|
| `tdd-test-writer` | Red / State-Test (for `tdd` / `state-verification`) | Write tests from interfaces only, without reading implementation code | sonnet |
| `tdd-implementer` | Green / Implement (for `tdd` / `state-verification`) | Write only the minimal code needed to pass tests. Apply Comment Rules (see `code-style.md#comment-rules`) | sonnet |
| `tdd-refactorer` | Refactor (all TDD strategies) | No behavior changes allowed. Verify and supplement Comment Rules compliance | sonnet |
| `tdd-bundler` | Bundled Red→Green (for `bundled-tdd` only) | Write failing test first, commit it, run and capture red output, then write minimal implementation and commit. MUST NOT edit test content once green phase starts | sonnet |

> `tdd-bundler` is a speed-oriented alternative to the three-agent isolation. It trades strict context separation (test-writer never sees impl) for a lighter 1-2 sub-agent cycle. To counter the co-drift risk, it enforces a 2-commit sequence (`[bundled-tdd:red]` → `[bundled-tdd:green]`) that the reviewer and Gate 0 verify via git log — the red commit's test file must remain byte-identical in the green commit.

## Sub-Agent Frontmatter Examples

```markdown
---
name: tdd-test-writer
description: TDD Red phase only. Writes failing tests. Does not read implementation code.
tools: Read, Glob, Grep, Write, Bash
model: sonnet
---
# TDD Test Writer (Red Phase)

## Rules
- **Do not read** existing implementation code (prevents context contamination)
- Write tests referencing only interfaces/type definitions
- Required cases: happy path, boundary, error
- Return: test file paths + expected failure count
```

```markdown
---
name: tdd-implementer
description: TDD Green phase only. Writes minimal code to pass failing tests.
tools: Read, Glob, Grep, Write, Edit, Bash
model: sonnet
effort: medium
---
# TDD Implementer (Green Phase)

## Rules
- Read tests first to understand expected behavior
- Write only the **minimal** code to pass tests
- No over-abstraction
- **Apply Comment Rules** (see `code-style.md#comment-rules`): file header for new files, JSDoc for public functions, why-comments for non-obvious logic
- Return: implementation file paths + test results
```

```markdown
---
name: tdd-refactorer
description: TDD Refactor phase only. Improves code quality while tests remain passing.
tools: Read, Glob, Grep, Write, Edit, Bash
model: sonnet
effort: low
---
# TDD Refactorer (Refactor Phase)

## Rules
- Run tests before refactoring → confirm all pass before starting
- No behavior changes (tests must continue to pass)
- **Verify Comment Rules compliance** (see `code-style.md#comment-rules`): check file headers, JSDoc, key constant/type descriptions. Supplement missing comments during refactoring
- Return: changed file list + test results
```

```markdown
---
name: tdd-bundler
description: Bundled TDD (Red→Green) for features with test_strategy "bundled-tdd". Writes failing test, commits it, then writes minimal implementation. Produces a 2-commit red→green sequence.
tools: Read, Glob, Grep, Write, Edit, Bash
model: sonnet
effort: medium
---
# TDD Bundler (Bundled Red→Green Phase)

## Rules
- **Test-first output ordering is mandatory**: write the complete test file first; run the test suite to capture failing output; commit tests only with a message starting `[bundled-tdd:red]`. Only then write the implementation.
- **Test file is frozen once committed**: during the green step, do NOT edit the test file. If the test turns out to be wrong, abort the cycle and restart (counts toward the 5-iteration limit).
- Write **minimal** implementation to pass the tests. Apply Comment Rules (see `code-style.md#comment-rules`).
- Commit the implementation with a message starting `[bundled-tdd:green]`. Both commits share the same feature ID in their body.
- Return: two commit SHAs (red, green) + test results + list of files changed in each commit.

## Forbidden
- Starting implementation work before the red commit is recorded
- Editing the test file in the green commit (reviewer and Gate 0 verify byte-identity via `git diff <red-sha> <green-sha> -- <test-file>`)
- Squashing the two commits into one (breaks the red→green evidence chain)
```

## File Classification for tdd-test-writer <!-- anchor: file-classification-for-tdd-test-writer -->

The "do not read implementation code" rule applies to:
- **Forbidden**: `src/**/*.{ts,js,py,go,...}` (domain logic files — excluding type/interface definitions)
- **Allowed**: type definition files (`*.d.ts`, `*.types.ts`, `*.interface.ts`), test files (`*.test.*`, `*.spec.*`), config files, documentation

The implementer agent must pass the allowed file list to tdd-test-writer's prompt.

## Implementer's TDD Orchestration Flow

```
# test_strategy = "tdd" (strict 3-agent isolation)
Plan → Red(tdd-test-writer) → Green(tdd-implementer) → Refactor(tdd-refactorer)
  → Verify(full test suite + feature verification) → on failure, return to Green/Red (max 5 iterations)
  → Doc Sync → single feature commit (code + tests + docs)

# test_strategy = "bundled-tdd" (speed-oriented, 1-2 sub-agents)
Plan → BundledRedGreen(tdd-bundler)
        ├─ write test → commit [bundled-tdd:red] with failing output captured
        └─ write impl  → commit [bundled-tdd:green] with passing output captured
  → Refactor(tdd-refactorer) — optional, skip if impl is already clean
  → Verify(full test suite + feature verification) → on failure, restart cycle (max 5 iterations)
  → Doc Sync → final feature commit squashes/amends as needed so Gate 4 sees one logical feature commit containing both red and green internal commits (see Gate 4 Rollback note)
```

> **Gate 4 rollback compatibility for `bundled-tdd`**: the two internal commits (`[bundled-tdd:red]` and `[bundled-tdd:green]`) together form one logical feature unit. Per the per-feature commit discipline, the implementer performs `git rebase --interactive` or `git reset --soft + git commit` before Gate 4 to fold them into a single `feat(FEAT-XXX): ...` commit — but keeps the red→green evidence as commit trailers (`red-sha: <sha>`, `green-sha: <sha>`) so Gate 0 reviewers can still verify. No other strategy needs this step.

## Context Window Limits

Sub-agents have independent context windows. If a sub-agent's context fills (large test suites, many files):
- The implementer should split the feature's tdd_focus into smaller batches
- Each batch runs a full Red-Green-Refactor cycle independently
- This is an escalation condition: report to user if a single tdd_focus function cannot fit in one sub-agent context
