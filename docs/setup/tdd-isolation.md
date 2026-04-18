# TDD / BDD Sub-Agent Context Isolation

When TDD is performed in a single context, the test writer's analysis leaks to the implementer.
Separating Red/Green/Refactor — and in `lean-tdd`, separating Implement from post-hoc BDD — into distinct sub-agents prevents this.

| Sub-Agent | Phase | Rules | Model |
|-----------|-------|-------|-------|
| `tdd-implementer` | Implement / Green (all strategies) | Write only the minimal code needed to pass tests (or, for `lean-tdd`, to satisfy the design sketch). Apply Comment Rules (see `code-style.md#comment-rules`). MUST NOT write tests under `lean-tdd` | sonnet |
| `tdd-refactorer` | Refactor (all strategies) | No behavior changes allowed. Verify and supplement Comment Rules compliance | sonnet |
| `bdd-writer` | BDD-Verify (for `lean-tdd` only) | Read `acceptance_test` + type headers; implementation code is forbidden. Emit one Given/When/Then block per `acceptance_test` scenario at `{test-dir}/{feature_id}.bdd.{ext}` | sonnet |
| `tdd-test-writer` (conditional) | Red (for `tdd`) / State-Test (for `state-verification`) | Write tests from interfaces only, without reading implementation code. Generated only when feature-list.json has at least one `"tdd"` or `"state-verification"` feature | sonnet |

> `lean-tdd` keeps implementation and verification in separate sub-agent contexts (implementer writes code, `bdd-writer` writes scenarios from the spec) without requiring Red-before-Green ordering. `tdd` preserves the strict three-agent isolation for safety-critical domains.

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
name: bdd-writer
description: BDD verification phase for features with test_strategy "lean-tdd". Writes one Given/When/Then block per acceptance_test scenario after implementation is complete. Does not read implementation code.
tools: Read, Glob, Grep, Write, Bash
model: sonnet
effort: low
---
# BDD Writer (lean-tdd BDD-Verify Phase)

## Rules
- Read ONLY the feature's `acceptance_test` array plus public type headers (`*.d.ts`, `*.types.*`, exported interface files). Implementation files are forbidden — request a type header from the implementer if the public shape is unclear.
- Emit exactly **one Given/When/Then block per `acceptance_test` scenario** (no folding two scenarios into one block). Output file: `{test-dir}/{feature_id}.bdd.{ext}`.
- Use the project's native test runner and a language-agnostic Given/When/Then format — describe blocks or test names, no Cucumber / behave / godog DSLs.
- Run the BDD suite and return: BDD file path, scenario count, suite pass/fail status.

## Forbidden
- Reading implementation source files (breaks the isolation the post-hoc BDD layer is designed to provide)
- Introducing a new BDD framework or feature-file format — native test runner only
- Merging multiple acceptance_test scenarios into one block to "simplify" — Gate 0 counts blocks against `acceptance_test.length`
```

## File Classification for tdd-test-writer <!-- anchor: file-classification-for-tdd-test-writer -->

The "do not read implementation code" rule applies to both `tdd-test-writer` (when generated) and `bdd-writer`:

- **Forbidden**: `src/**/*.{ts,js,py,go,...}` (domain logic files — excluding type/interface definitions)
- **Allowed**: type definition files (`*.d.ts`, `*.types.ts`, `*.interface.ts`), existing test files (`*.test.*`, `*.spec.*`, `*.bdd.*`), config files, documentation

The implementer agent passes the allowed file list to each sub-agent's prompt. For `bdd-writer` the input is narrower: the feature's `acceptance_test` array plus the above-allowed type headers — no other test files are read.

## Implementer's TDD Orchestration Flow

```
# test_strategy = "lean-tdd" (default, 2-3 sub-agent hops)
Design(implementer self) → Implement(tdd-implementer) → BDD-Verify(bdd-writer)
  → Refactor(tdd-refactorer) — optional, skip if impl is already clean
  → Verify(full test suite + feature verification) → on failure:
      (a) scenario malformed → re-invoke bdd-writer
      (b) implementation bug → return to Implement (max 5 iterations)
  → Doc Sync → single feature commit (code + BDD + docs)

# test_strategy = "tdd" (safety-critical opt-in, strict 3-agent isolation)
Plan → Red(tdd-test-writer) → Green(tdd-implementer) → Refactor(tdd-refactorer)
  → Verify(full test suite + feature verification) → on failure, return to Green/Red (max 5 iterations)
  → Doc Sync → single feature commit (code + tests + docs)
```

## Context Window Limits

Sub-agents have independent context windows. If a sub-agent's context fills (large test suites, many files):
- The implementer should split the feature's tdd_focus into smaller batches
- Each batch runs a full Red-Green-Refactor cycle independently
- This is an escalation condition: report to user if a single tdd_focus function cannot fit in one sub-agent context
