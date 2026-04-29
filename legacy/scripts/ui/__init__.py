"""UI helpers — user-facing routing, resolution, dashboard, confirmation prompts.

Introduced in v0.9.1. Modules in this subpackage sit between ``/harness-boot:``
slash commands (commands/*.md) and the decision-time ``scripts/work.py`` /
``scripts/sync.py`` / ``scripts/check.py`` logic. They translate user-friendly
input (natural language, title substrings, ``@F-N`` escapes) into the
deterministic F-N references the rest of the system expects.

Current modules:

- ``feature_resolver`` — user input → feature dict (single · multiple · none)
- ``intent_planner`` — state → Top 1-3 suggested actions (deterministic rules)
- ``dashboard`` — no-args ``/harness-boot:work`` state snapshot renderer

Planned (v0.9.3+):

- ``sync_gate`` — lazy sync detection + user confirmation
- ``confirm`` — risk-tiered confirmation prompts
"""
