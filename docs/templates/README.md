# harness-boot Templates

Pre-built, production-ready scaffolding that `/setup` Phase 1 copies into target projects. Replaces per-project LLM generation with deterministic file copy + minimal substitution.

## Why

Most harness files are deterministic — they don't vary by project. Generating them with LLM calls is slow and introduces drift. These templates are the source of truth; Phase 1 copies them verbatim (or with one or two placeholder substitutions) and moves on.

## Layout

```
docs/templates/
├── README.md                     # This file
├── stacks.md                     # Stack → placeholder substitution table
└── hooks/                        # 6 hook scripts
    ├── session-start-bootstrap.sh   (stack-agnostic — copy verbatim)
    ├── pre-tool-security-gate.sh    (stack-agnostic — copy verbatim)
    ├── pre-tool-doc-sync-check.sh   (stack-agnostic — copy verbatim)
    ├── pre-tool-coverage-gate.sh    (2 placeholders — substitute per stacks.md)
    ├── post-tool-format.sh          (extension-dispatched — copy verbatim)
    └── post-tool-test-runner.sh     (extension-dispatched — copy verbatim)
```

## Usage in `/setup` Phase 1

1. Copy all 6 files from `${CLAUDE_PLUGIN_ROOT}/docs/templates/hooks/` to the target project's `hooks/` directory.
2. For `pre-tool-coverage-gate.sh`, substitute `{COVERAGE_COMMAND}` and `{COVERAGE_FILE}` using the row in `stacks.md` matching the selected tech stack.
3. `chmod +x hooks/*.sh`.
4. Generate `.claude/settings.json` referencing these hooks (see setup-guide.md §2 for the settings.json shape).

That's it — no LLM generation for hook bodies.

## Contract

- Templates MUST remain stack-agnostic where possible (extension-dispatch inside the script, not per-stack variants).
- Placeholders MUST use `{UPPER_SNAKE_CASE}` braces so substitution is grep-safe.
- All templates MUST pass `shellcheck` and run under `set -euo pipefail`.
- Any behavior change to these templates requires updating setup-guide.md §2 (the spec) AND a regression check against the sample plans in `tests/fixtures/`.
