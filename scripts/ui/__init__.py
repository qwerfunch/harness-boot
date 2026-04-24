"""UI helpers — user-facing routing, resolution, dashboard, confirmation prompts.

Introduced in v0.9.1. Modules in this subpackage sit between ``/harness-boot:``
slash commands (commands/*.md) and the decision-time ``scripts/work.py`` /
``scripts/sync.py`` / ``scripts/check.py`` logic. They translate user-friendly
input (natural language, title substrings, ``@F-N`` escapes) into the
deterministic F-N references the rest of the system expects.

Current modules:

- ``feature_resolver`` — user input → feature dict (single · multiple · none)

Planned (v0.9.2+):

- ``dashboard`` — ``/harness-boot:work`` no-args state snapshot
- ``intent_planner`` — natural language → proposed action (plan + Y/n)
- ``sync_gate`` — lazy sync detection + user confirmation
- ``confirm`` — risk-tiered confirmation prompts
"""
