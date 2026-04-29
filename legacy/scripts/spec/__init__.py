"""Internal helpers for spec.yaml processing.

- `include_expander` — depth-1 `$include` expansion (F-009).
- `conversion_diff` — semantic diff between conversion rounds.
- `upgrade_to_2_3_8` — one-shot migration helper for older spec shapes.
- `mode_b/` — Mode B statistical extractor (BM25) subpackage.

Internal — consumers are other scripts (`sync`, `check`, `mode_b_extract`) and
tests; not invoked directly from commands/*.md.
"""
