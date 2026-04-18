# Tech Stack Substitution Table

Used by `/setup` Phase 1 to substitute placeholders in `docs/templates/hooks/pre-tool-coverage-gate.sh`.

Only the coverage-gate hook requires stack-specific substitution. The other 5 hooks are stack-agnostic (extension-dispatched or language-independent).

## Placeholders

| Token | Meaning |
|-------|---------|
| `{COVERAGE_COMMAND}` | Shell command that produces the coverage artifact |
| `{COVERAGE_FILE}` | Project-relative path to the coverage artifact (must be JSON with Istanbul-compatible `fnMap` / `statementMap` / `s` / `f` keys — or the post-processing step below) |

## Stack → Substitution

| Stack | `{COVERAGE_COMMAND}` | `{COVERAGE_FILE}` | Output Format |
|-------|----------------------|-------------------|---------------|
| **Node.js — Vitest** | `npx vitest run --coverage --reporter=json` | `coverage/coverage-final.json` | Istanbul JSON (native) |
| **Node.js — Jest** | `npx jest --coverage --coverageReporters=json` | `coverage/coverage-final.json` | Istanbul JSON (native) |
| **Python — pytest** | `pytest --cov --cov-report=json` | `coverage.json` | coverage.py JSON; requires post-processing to Istanbul shape (see below) |
| **Go** | `go test -coverprofile=coverage.out ./... && gocov convert coverage.out \| gocov-json > coverage.json` | `coverage.json` | Istanbul-compatible via gocov-json (optional tool) |
| **Rust** | `cargo tarpaulin --out Json --output-dir coverage` | `coverage/tarpaulin-report.json` | tarpaulin JSON; function lookup via `src_files[].covered_lines` (needs custom parser, not Istanbul shape) |
| **Java — Gradle + JaCoCo** | `./gradlew jacocoTestReport` | `build/reports/jacoco/test/jacocoTestReport.xml` | XML; needs custom parser |
| **Java — Maven + JaCoCo** | `mvn -q test jacoco:report` | `target/site/jacoco/jacoco.xml` | XML; needs custom parser |

## Substitution Steps

During `/setup` Phase 1:

1. Copy `docs/templates/hooks/pre-tool-coverage-gate.sh` to the target project at `hooks/pre-tool-coverage-gate.sh`.
2. Replace `{COVERAGE_COMMAND}` and `{COVERAGE_FILE}` with the values from the row matching the selected stack.
3. If the stack is **not Istanbul-compatible** (Rust/Java/Go without gocov-json), generate a minimal adapter script `scripts/coverage-normalize.sh` that converts the native output into an Istanbul-shaped JSON written to `{COVERAGE_FILE}`. Update `{COVERAGE_COMMAND}` to chain through this adapter.
4. Make the hook executable (`chmod +x hooks/pre-tool-coverage-gate.sh`).

For stacks not listed above, ask the developer: "What coverage command and output file path do you use?" and record the answer in `.claude/environment.md`.

## Polyglot Projects

If the project has multiple primary languages (e.g., TypeScript frontend + Python backend), either:
- Pick the stack matching the **majority of `tdd_focus` functions** and note the trade-off; OR
- Generate per-language coverage gates and dispatch based on the current feature's module path.

Prefer the first option unless the project is genuinely split 50/50.
