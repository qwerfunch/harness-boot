# scripts/ — module inventory

> Single-page guide to the responsibilities and dependency direction of each Python module under `scripts/`. New contributors should be able to tell where to add code, and which files belong to the user-facing contract, at a glance.

## Layout

```
scripts/
├── README.md                      ← this file
├── self_check.sh                  ← repo SSoT / derived self-check (bash)
│
├─ root (6 primary command entry points)
│   sync.py · work.py · status.py · check.py · events.py · metrics.py
│   commands/*.md invokes these directly via `$PLUGIN_ROOT/scripts/<name>.py`.
│
├── core/                          ← shared low-level utilities
│   ├── state.py                   ← .harness/state.yaml helper
│   ├── canonical_hash.py          ← YAML → JSON → SHA-256 Merkle (F-010)
│   └── plugin_root.py             ← 4-strategy PLUGIN_ROOT resolver (F-011)
│
├── gate/
│   └── runner.py                  ← gate_0~5 + gate_perf auto-runner
│
├── ceremonies/                    ← four ceremonies (v0.6)
│   ├── kickoff.py                 ← auto-wired from work.activate (v0.7)
│   ├── retro.py                   ← auto-wired from work.complete (v0.7)
│   ├── design_review.py           ← manual (v0.8+ auto-wire candidate)
│   └── inbox.py                   ← Q&A file-drop polling
│
├── spec/                          ← spec.yaml pipeline
│   ├── validate.py                ← JSONSchema 2020-12 validation
│   ├── explain.py                 ← Mode E (read-only explanation)
│   ├── diff.py                    ← semantic diff between two specs (Mode A/R)
│   ├── mode_classifier.py         ← auto-classifier for Mode E/A/R/B
│   ├── mode_b_extract.py          ← Mode B BM25 statistics CLI
│   ├── include_expander.py        ← $include depth=1 expansion (F-009)
│   ├── conversion_diff.py         ← semantic diff across conversion rounds
│   ├── upgrade_to_2_3_8.py        ← migration from older specs
│   └── mode_b/                    ← Mode B BM25 internals
│       ├── axes.py
│       ├── roundtrip.py
│       └── stopwords.py
│
└── render/                        ← spec → derived md/yaml
    ├── domain.py                  ← domain.md (Platform section since v0.7.4)
    └── architecture.py            ← architecture.yaml
```

## Layer responsibilities

| Layer | Responsibility | Direction |
|---|---|---|
| `commands/*.md` | User UI · Preamble · anti-rationalization | calls the root CLI |
| Root `scripts/*.py` | argparse · human/json formatting · exit-code contract | composes subpackages |
| `core/` | low-level utilities; pure | calls nothing else (external dep: pyyaml) |
| `gate/` · `ceremonies/` · `spec/` · `render/` | per-domain logic | calls only `core/` |

Rules:

1. Root CLI files compose subpackage logic only. If complex logic leaks into a root CLI, push it down into a subpackage.
2. Subpackages never call each other. Shared low-level helpers move into `core/`.
3. No reverse dependencies — a subpackage never imports a root CLI.

## Dependency graph

```
                   commands/*.md
                         │ invokes
                         ▼
       ┌─── sync.py ──── check.py ──── work.py ──── status.py ──── events.py ──── metrics.py
       │                     │             │
       ▼                     ▼             ▼
   render/, spec/         spec/       gate/, ceremonies/
                  \         │         /
                   ▼         ▼        ▼
                        core/
```

## Public CLI paths (referenced by commands/*.md)

| Script | Slash command |
|---|---|
| `sync.py` | `/harness:sync` |
| `work.py` | `/harness:work` |
| `status.py` | `/harness:status` |
| `check.py` | `/harness:check` |
| `events.py` | `/harness:events` |
| `metrics.py` | `/harness:metrics` |
| `spec/mode_classifier.py` · `spec/explain.py` · `spec/diff.py` · `spec/validate.py` · `spec/mode_b_extract.py` | delegated by `/harness:spec` per mode |
| `ceremonies/kickoff.py` · `ceremonies/retro.py` | auto-wired from `/harness:work` (v0.7) |
| `ceremonies/design_review.py` · `ceremonies/inbox.py` | orchestrator-driven, manual |
| `gate/runner.py` | invoked through `/harness:work --run-gate` |
| `core/state.py` · `core/plugin_root.py` · `core/canonical_hash.py` | library (imported by other CLIs) |

## Tests

- `tests/unit/test_*.py` — at least one file per module. 1100+ tests.
- `tests/regression/conversion-goldens/` — 8 golden specs + a MANIFEST.
- `scripts/self_check.sh` — SSoT · validate · sync · check · commands convention. Five steps.

## Versioning policy

- **The user-facing contract** is the `/harness:*` slash command surface (the API exposed by commands/*.md). It does not change before a major bump (v1.0+).
- **Internal implementation paths** (`scripts/**/*.py`) move freely on patch bumps — as long as commands/*.md is updated in the same commit and the full test suite stays green. A single `/plugin update` propagates the change to users transparently.
- When a new subpackage is added, update the layout block above.
