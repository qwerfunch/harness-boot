# pure-domain adapter (feature-author skill)

## When to use

The user's idea is **none of the other three shapes**: no
user-visible UI, no sensitive entity, no named performance budget.
Pure logic — calculation, transformation, batch job, CLI helper,
internal API endpoint, validation, parsing, scheduling, queue
processing.

Concrete signal words: "compute", "transform", "parse", "validate",
"convert", "normalize", "aggregate", "schedule", "enqueue",
"dispatch", "batch", "ETL", "import", "export", "pipeline",
"webhook handler", "background job".

Most domain logic in harness-boot itself (canonicalHash, drift
detection, gate runner, ceremony writers) lands here. It's the
default fallback when nothing else matches.

## AC templates

Pure-domain features lean heavily on **input/output contracts**
and **edge cases**. Pick 3-4 (prototype) or 6-8 (product) from the
groups below; mandatory coverage in **contract**, **edge cases**,
**determinism**.

### Contract (the API surface)
- "AC-N: `<function>(<input-shape>) → <output-shape>`. Type signature documented in `<file>.ts`; runtime validated by <validator>."
- "AC-N: Invalid input (<example>) throws `<ErrorClass>` with message starting `<prefix>`; no silent coercion."
- "AC-N: Output is deterministic given input — same input over <runs> consecutive calls yields byte-equal output."

### Edge cases (qa-engineer enforces)
- "AC-N: Empty input (<empty-shape>) returns <documented-empty-output> without throwing."
- "AC-N: Boundary conditions tested: <list> (e.g., zero, one, max-int, max-string-length, unicode)."
- "AC-N: Concurrent invocations on shared state are <safe-or-unsafe>; if unsafe, the function is documented as not thread-safe."

### Determinism / idempotency
- "AC-N: Repeated invocation with the same input produces the same output and the same side effects (idempotent) OR explicitly documented as non-idempotent with reason."
- "AC-N: Output ordering is deterministic — sorted by <key> when iteration order would otherwise be implementation-dependent."

### Performance (lightweight — not a budget)
- "AC-N: Function completes within <ms> ms for <input-size> on the reference dev machine. (No gate_perf — this is a sanity check, not a contract.)"

### Tests
- "AC-N: Unit tests cover <list-of-cases>; gate_0 PASS asserts coverage."
- "AC-N: Property-based test asserts <invariant> over <N> generated inputs (when applicable; e.g., parse/serialize roundtrip)."

## Modules pattern

```
modules:
  - "src/<area>/<feature>.ts"
  - "src/<area>/<feature>.test.ts"
  - "tests/parity/<feature>.test.ts"        # if this is a port from Python
```

## Required block

None. Pure-domain features have no extra spec block — the
description and ACs carry the contract.

## Routing the orchestrator will pick

```
backend-engineer (primary author for service / API logic)
OR software-engineer (for utility / pure-function code)
  → qa-engineer → integrator → tech-writer → reviewer
```

The skill should pick `backend-engineer` if the feature mentions
HTTP, RPC, queue, database, persistence; otherwise
`software-engineer`. The orchestrator will route correctly even if
the skill picks the wrong one — but mentioning the expected agent
in the routing preview helps the user understand why a particular
agent shows up at activate time.
