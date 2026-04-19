### Gate 2: Cross-Module Review Stage <!-- anchor: cross-module-review -->

When a feature's `tdd_focus` or `doc_sync` paths span **two or more module directories** (as defined in `.claude/context-map.md`), the **reviewer agent** runs an additional Cross-Module Review stage as part of Gate 2. This stage is distinct from the per-file code-quality pass and is required in addition to it.

**Inputs:**
- The implementer's artifact bundle at `_workspace/gate2_implementer-<slug>_{feature_id}-*.md`
- Any `qa-report` written by `qa-agent` to `_workspace/qa_qa-agent_{module}-{feature_id}.md` (when qa-agent is included per `commands/setup.md` Step 1.6)
- Both sides of every integration boundary touched by the feature (producer module source + consumer module source, read simultaneously)

**Procedure:**
1. Enumerate every integration boundary the feature touches. A boundary is any symbol or file path where a producer module in one directory is consumed by another module.
2. For each boundary, read the producer and consumer sides in parallel (never sequentially — sequential reads miss the comparison).
3. Compare in order: **shape → type → semantics → error paths**. Fold all findings from the `qa-report` (if present) into this comparison — do not treat qa-report as an independent artifact.
4. Classify each mismatch by severity:
   - **Critical** — shape or type divergence, missing error path, boundary-crossing invariant violation. Blocks Gate 2.
   - **Major** — semantic ambiguity (e.g., both sides interpret "active" differently), partially handled error path. Must be resolved before commit.
   - **Minor** — naming inconsistency without runtime impact. Logged for follow-up, does not block.

**Outputs:**
- Findings written to `_workspace/gate2_reviewer_{feature_id}-cross-module.md`
- Any Critical finding returns the feature to the implementer with `review-result: critical-reject` (per `docs/templates/protocols/message-format.md#coordinate-round-trip`); this counts toward the 5-iteration convergence limit.

**Rationale:** The reviewer's per-file code-quality pass catches internal mistakes; the Cross-Module Review stage catches **seam** mistakes that only appear when both sides are read together. Without this stage, boundary drift survives Gate 2 and surfaces as integration bugs at runtime.

