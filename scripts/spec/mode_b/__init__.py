"""Mode B statistical extraction helpers (BM25-based plan.md → spec.yaml).

- `axes` — axis-specific scoring (entity, business-rule, etc.).
- `roundtrip` — re-conversion stability diagnostic.
- `stopwords` — language-aware stopword list.

Internal — the public CLI is `scripts.mode_b_extract`, which composes these.
"""
