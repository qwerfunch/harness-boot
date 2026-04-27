"""F-045 — autowire (kickoff / fog-clear / design-review / retro) entry point.

The four ``_autowire_*`` functions live in ``scripts/work.py`` because
they're called by ``activate()`` / ``record_gate()`` / ``add_evidence()``
in lockstep; they're surfaced here so external test modules and future
refactors can import them under a stable module name without coupling
to the work.py file path.

The exported names match the work.py originals — leading underscore
preserved — so the existing test suite (which imports the underscored
names directly) keeps working.
"""

from __future__ import annotations

from scripts.work import (  # noqa: F401
    _autowire_design_review,
    _autowire_fog_clear,
    _autowire_kickoff,
    _autowire_retro,
)


__all__ = [
    "_autowire_design_review",
    "_autowire_fog_clear",
    "_autowire_kickoff",
    "_autowire_retro",
]
