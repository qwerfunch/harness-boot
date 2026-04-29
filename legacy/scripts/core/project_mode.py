"""Project mode resolver — prototype vs product (v0.9.6).

The ``spec.project.mode`` field is a single switch that tightens or relaxes
several ceremony / quality behaviors at once:

- **Iron Law** (Iron Law of declared evidence) — product requires 3
  declared evidences in the trailing window, prototype requires 1.
  See ``scripts/work.py::complete``.
- **Kickoff template** — product writes a 3-bullet section per matched
  agent. Prototype writes a 1-line section per agent.
- **Retrospective template** — product carries five LLM-driven sections
  (Risks Materialized, Decisions Revised, Kickoff Predictions, Reviewer
  Reflection, Copy Polish). Prototype keeps only "What Shipped" plus
  "First Gate to Fail" plus a Ceremonies summary.
- **Design review autowire** — product autowires when the three triggers
  align (UI feature · flows.md saved · review.md missing). Prototype
  skips the autowire path entirely; users still get explicit
  ``--design-review`` to force regeneration.

This module is pure: spec dict in, mode string out, no I/O. Extracting the
resolver here lets ``scripts/work.py``, ``scripts/ceremonies/*.py``, and
future consumers share one canonical lookup.
"""

from __future__ import annotations

from typing import Literal


Mode = Literal["prototype", "product"]


VALID_MODES: frozenset[str] = frozenset({"prototype", "product"})

# Strict default. Unknown / missing values fall back to ``product`` so that
# misconfiguration never silently relaxes the quality bar.
DEFAULT_MODE: Mode = "product"


def resolve_mode(spec: dict | None) -> Mode:
    """Return the canonical ``Mode`` value for a parsed spec.yaml.

    Args:
        spec: parsed ``spec.yaml`` dict, or None (when the file is absent).

    Returns:
        ``"prototype"`` only if ``spec.project.mode`` is exactly that string.
        Everything else — None spec, missing project block, missing field,
        unknown value — collapses to the strict default ``"product"``.
    """
    if not isinstance(spec, dict):
        return DEFAULT_MODE
    project = spec.get("project")
    if not isinstance(project, dict):
        return DEFAULT_MODE
    mode = project.get("mode")
    if isinstance(mode, str) and mode in VALID_MODES:
        return mode  # type: ignore[return-value]
    return DEFAULT_MODE


__all__ = ["Mode", "DEFAULT_MODE", "VALID_MODES", "resolve_mode"]
