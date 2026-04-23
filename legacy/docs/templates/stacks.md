# Tech Stack Substitution Table

Used by `/setup` Phase 1 to substitute placeholders in:
- `docs/templates/hooks/pre-tool-coverage-gate.mjs` — `{COVERAGE_COMMAND}`, `{COVERAGE_FILE}`
- `docs/templates/scripts/update-feature-status.mjs.tmpl` — `{TEST_COMMAND}`

The other 5 hooks are stack-agnostic (extension-dispatched or language-independent) and need no substitution.

## Placeholders

| Token | Consumer | Meaning |
|-------|----------|---------|
| `{COVERAGE_COMMAND}` | coverage-gate hook | Shell command that produces the coverage artifact |
| `{COVERAGE_FILE}` | coverage-gate hook | Project-relative path to the coverage artifact (must be JSON with Istanbul-compatible `fnMap` / `statementMap` / `s` / `f` keys — or the post-processing step below) |
| `{TEST_COMMAND}` | update-feature-status script | Full shell command that runs the project's test suite; non-zero exit blocks the status update |

## Stack → Substitution

| Stack | `{COVERAGE_COMMAND}` | `{COVERAGE_FILE}` | `{TEST_COMMAND}` | Output Format |
|-------|----------------------|-------------------|------------------|---------------|
| **Node.js — Vitest** | `npx vitest run --coverage --reporter=json` | `coverage/coverage-final.json` | `npx vitest run` | Istanbul JSON (native) |
| **Node.js — Jest** | `npx jest --coverage --coverageReporters=json` | `coverage/coverage-final.json` | `npx jest` | Istanbul JSON (native) |
| **Python — pytest** | `pytest --cov --cov-report=json` | `coverage.json` | `pytest -q` | coverage.py JSON; requires post-processing to Istanbul shape (see below) |
| **Go** | `go test -coverprofile=coverage.out ./... && gocov convert coverage.out \| gocov-json > coverage.json` | `coverage.json` | `go test ./...` | Istanbul-compatible via gocov-json (optional tool) |
| **Rust** | `cargo tarpaulin --out Json --output-dir coverage` | `coverage/tarpaulin-report.json` | `cargo test` | tarpaulin JSON; function lookup via `src_files[].covered_lines` (needs custom parser, not Istanbul shape) |
| **Java — Gradle + JaCoCo** | `./gradlew jacocoTestReport` | `build/reports/jacoco/test/jacocoTestReport.xml` | `./gradlew test` | XML; needs custom parser |
| **Java — Maven + JaCoCo** | `mvn -q test jacoco:report` | `target/site/jacoco/jacoco.xml` | `mvn -q test` | XML; needs custom parser |

## Substitution Steps

During `/setup` Phase 1:

1. Copy `docs/templates/hooks/pre-tool-coverage-gate.mjs` → `hooks/pre-tool-coverage-gate.mjs` and `docs/templates/scripts/update-feature-status.mjs.tmpl` → `scripts/update-feature-status.mjs`.
2. Replace `{COVERAGE_COMMAND}` / `{COVERAGE_FILE}` / `{TEST_COMMAND}` with the values from the row matching the selected stack.
3. If the stack is **not Istanbul-compatible** (Rust/Java/Go without gocov-json), generate a minimal adapter script `scripts/coverage-normalize.mjs` that converts the native output into an Istanbul-shaped JSON written to `{COVERAGE_FILE}`. Update `{COVERAGE_COMMAND}` to chain through this adapter.
4. On POSIX, make both files executable (`chmod +x hooks/pre-tool-coverage-gate.mjs scripts/update-feature-status.mjs`). No-op on Windows.

For stacks not listed above, ask the developer three questions (one at a time): "What coverage command do you use?", "Where is the coverage artifact written?", "What command runs the full test suite?" Record all three in `.claude/environment.md`.

## Polyglot Projects

If the project has multiple primary languages (e.g., TypeScript frontend + Python backend), either:
- Pick the stack matching the **majority of `tdd_focus` functions** and note the trade-off; OR
- Generate per-language coverage gates and dispatch based on the current feature's module path.

Prefer the first option unless the project is genuinely split 50/50.
