"""F-043 — single source of truth for orchestration routing data.

Holds the data ``scripts/ceremonies/kickoff.py`` used to own outright:

- ``ROUTING_SHAPES``: feature shape → ordered agent list.
- ``PARALLEL_GROUPS``: feature shape → list of agent tuples that the
  orchestrator may dispatch in one Claude Code message.

``kickoff.py`` re-exports both names so existing imports keep working.
A future ``.harness/routing.yaml`` override hook will plug in here.
"""

from __future__ import annotations


ROUTING_SHAPES: dict[str, list[str]] = {
    "baseline-empty-vague": ["researcher", "product-planner"],
    "ui_surface.present": [
        "ux-architect",
        "visual-designer",
        "a11y-auditor",
        "frontend-engineer",
        "software-engineer",
    ],
    "sensitive_or_auth": ["security-engineer", "reviewer"],
    "performance_budget": ["performance-engineer"],
    "pure_domain_logic": ["backend-engineer", "software-engineer"],
    "feature_completion": [
        "qa-engineer",
        "integrator",
        "tech-writer",
        "reviewer",
    ],
}

PARALLEL_GROUPS: dict[str, list[tuple[str, ...]]] = {
    # F-039 — single message multi tool use can run these concurrently.
    # security-engineer and reviewer are both read-only audits; security
    # holds BLOCK veto.
    "sensitive_or_auth": [("security-engineer", "reviewer")],
    # visual-designer and audio-designer both depend on ux-architect's
    # flows.md and write to separate output files (tokens.yaml /
    # audio.yaml). has_audio=False drops audio-designer at the helper
    # level (kickoff.parallel_groups_for_shapes).
    "ui_surface.present": [("visual-designer", "audio-designer")],
}


__all__ = ["ROUTING_SHAPES", "PARALLEL_GROUPS"]
