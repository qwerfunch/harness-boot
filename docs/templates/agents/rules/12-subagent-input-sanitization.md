#### TDD / BDD sub-agent input sanitization (isolation invariant) <!-- anchor: sub-agent-input-sanitization -->

The Testable-First principle relies on two isolation barriers: `tdd-test-writer` never seeing implementation intent (under `tdd` / `state-verification`), and `bdd-writer` never seeing implementation code (under `lean-tdd`). Both sub-agents are invoked via the `Agent` tool inside each implementer's execution context, and the implementer MUST sanitize inputs before forwarding.

**TDD sub-agent input sanitization** (for `tdd-test-writer`):

**Allowed to pass through**:
- `feature_id`
- `test_strategy`
- `tdd_focus` — **function signatures only** (name + parameter types + return type). Strip any body comments that hint at algorithm or internal state.
- `acceptance_test` — only the **observable-result** portion: given/when/then phrasing, input-output pairs, error conditions visible to callers. Strip any "the function works by..." or "internally it uses..." sentences.
- `doc_sync` paths — listed so the test writer knows which surface-level behaviors are contracted, not as implementation hints.

**Must be removed before forwarding**:
- Pseudocode or algorithm sketches in `acceptance_test`
- Internal data-structure names (e.g., "uses a linked list" → drop)
- References to existing private helpers
- Implementation-performance hints (complexity targets are OK; "by memoizing X" is not)

If the implementer cannot determine whether a line is safe, it removes the line and adds a brief note to `_workspace/red_implementer_feat-XXX-input.md` documenting what was stripped. This artifact stays in the implementer's context; it is not passed to the test writer.

Tool-level isolation is already enforced: `tdd-test-writer`'s `allowed-tools` list excludes `Edit` (it can only write new files), and read globs are scoped to interface declarations and test files per this agent's `## File Classification` section. Sanitization is the second defender; Phase 3 in `commands/setup.md` writes the sanitization clause into `tdd-test-writer.md`'s generated prompt body so the sub-agent also self-checks on receipt.

**BDD sub-agent input sanitization** (for `bdd-writer`):

**Allowed to pass through**:
- `feature_id`
- `acceptance_test` — the full Given/When/Then array from `feature-list.json`; each entry must already be in Given/When/Then form (Phase 6 validates this during `/setup`).
- Public type-header file paths only (`*.d.ts`, `*.types.*`, exported interface modules). The bdd-writer may Read these; they are the only reads it can make beyond the test directory.
- `doc_sync` paths — informational, so the BDD suite knows the contracted surfaces.

**Must NOT be forwarded**:
- Implementation file paths (`src/**/*.{ts,js,py,go,...}`)
- `tdd_focus` function bodies or private helper names
- Design notes from `_workspace/{feature_id}_design.md` (these are the implementer's internal sketch)
- Any sentence phrased as "the implementation uses..." / "internally we..." — if such a sentence appears in `acceptance_test`, it is a Phase 6 contract violation and should be reported rather than forwarded.

The implementer writes the forwarded payload to `_workspace/bdd_implementer_feat-XXX-input.md` before the Agent call, so post-hoc audit can verify isolation. `bdd-writer.md`'s generated body carries the same sanitization self-check.

