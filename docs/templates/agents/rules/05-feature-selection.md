#### Feature selection <!-- anchor: feature-selection-algorithm -->
Analyze module independence among top-priority `passes: false` features. If features are in different modules with no dependencies, select multiple features for parallel development. Single-module projects (team of one) always run one feature at a time.

**Pre-flight dependency check** before confirming parallel features:
- No shared `tdd_focus` targets between selected features
- No shared `doc_sync` targets that would cause merge conflicts
- Neither feature appears in the other's `depends_on` (direct or transitive)
- Transitive check: if A depends on C and B depends on C, both can run in parallel only if C has `passes: true`
If any dependency detected, fall back to sequential for the dependent pair.

Consider dependencies:
- Start with the most foundational features (auth > profile > order > payment)
- Fix any broken features first
- Only parallelize features with no shared dependencies

Report the selected feature and ask with numbered choices:
```
Next: {FEAT-XXX} — {description}
  Category: {category} | Strategy: {test_strategy} | Deps: {depends_on or "none"}
  TDD Focus: {tdd_focus}

(1) ★ Start this feature
(2) Skip — pick a different feature
(3) Show details (acceptance tests, doc sync targets)
(4) Auto-pilot — run all remaining features, pause only on errors
```

- Options (1)-(3): Manual mode. Steps 4-7 auto-proceed on success; Step 8 shows choices.
- Option (4): Auto-pilot mode. Set `auto_pilot: true` in PROGRESS.md. Steps 4-8 all auto-proceed. Only escalation conditions cause a pause.

