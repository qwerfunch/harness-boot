# harness-boot Templates

Pre-built, production-ready scaffolding that `/setup` Phase 1 copies into target projects. Replaces per-project LLM generation with deterministic file copy + minimal substitution.

## Why

Most harness files are deterministic — they don't vary by project. Generating them with LLM calls is slow and introduces drift. These templates are the source of truth; Phase 1 copies them verbatim (or with one or two placeholder substitutions) and moves on.

## Layout

```
docs/templates/
├── README.md                             # This file
├── stacks.md                             # Stack → placeholder substitution table (coverage + test commands)
├── hooks/                                # 6 hook scripts (Node.js — cross-platform)
│   ├── session-start-bootstrap.mjs         (stack-agnostic — copy verbatim)
│   ├── pre-tool-security-gate.mjs          (stack-agnostic — copy verbatim)
│   ├── pre-tool-doc-sync-check.mjs         (stack-agnostic — copy verbatim)
│   ├── pre-tool-coverage-gate.mjs          (2 placeholders — substitute per stacks.md)
│   ├── post-tool-format.mjs                (extension-dispatched — copy verbatim)
│   └── post-tool-test-runner.mjs           (extension-dispatched — copy verbatim)
└── scripts/                              # Plugin → target-project scripts
    └── update-feature-status.mjs.tmpl      (1 placeholder {TEST_COMMAND} — substitute per stacks.md)
```

## Usage in `/setup` Phase 1

1. Copy all 6 files from `${CLAUDE_PLUGIN_ROOT}/docs/templates/hooks/` to the target project's `hooks/` directory.
2. Copy `${CLAUDE_PLUGIN_ROOT}/docs/templates/scripts/update-feature-status.mjs.tmpl` to `scripts/update-feature-status.mjs`.
3. Substitute placeholders per `stacks.md`: `{COVERAGE_COMMAND}` / `{COVERAGE_FILE}` in `pre-tool-coverage-gate.mjs`, `{TEST_COMMAND}` in `update-feature-status.mjs`.
4. On POSIX, `chmod +x hooks/*.mjs scripts/update-feature-status.mjs` (no-op on Windows).
5. Generate `.claude/settings.json` referencing these hooks (see `docs/setup/runtime-guardrails.md` for the settings.json shape).

That's it — no LLM generation for hook or script bodies.

## Contract

- Templates MUST remain stack-agnostic where possible (extension-dispatch inside the script, not per-stack variants).
- Placeholders MUST use `{UPPER_SNAKE_CASE}` braces so substitution is grep-safe.
- All templates MUST pass `node --check` (syntax) and run correctly under `node` on macOS / Linux / Windows. No external npm dependencies — stdlib only (`fs`, `path`, `child_process`, `os`, `process`), so target projects run hooks without `npm install`. Top-level try/catch with explicit `process.exit(code)` replaces `set -euo pipefail`; hook exit-code contract is unchanged (0 = proceed, 1 = hook error, 2 = block).
- Any behavior change to these templates requires updating `docs/setup/runtime-guardrails.md` (the spec) AND a regression check against the sample plans in `tests/fixtures/`.

## Docs Size Policy

Applies to every `.md` file under `docs/` in this repository.

- **Hard limit: 500 lines (≈ 1,600 tokens)**. Claude Code slash commands have no include / glob / anchor mechanism — every referenced file is loaded whole, so oversized docs force unnecessary context on every `/setup` invocation.
- A file exceeding 500 lines MUST declare a size exception at the top, e.g. `<!-- size-exception: <reason> -->`. Reviewers reject uncommented over-limit files.
- Preferred remedy is to split by topic under `docs/setup/` (or `docs/protocols/` for runtime references) and register the new file in `docs/setup/INDEX.md`.
- Soft-enforced by `scripts/check-doc-sizes.mjs` (non-blocking — prints over-limit files without exempt comments).
