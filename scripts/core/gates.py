"""F-043 — single source of truth for the standard gate names.

Both ``scripts/work.py`` and ``scripts/ui/dashboard.py`` used to keep their
own hardcoded ``_STANDARD_GATES`` tuple. F-043 consolidates the constant
here so adding or renaming a gate is a one-line change.

The legacy aliases in those modules are kept as ``_STANDARD_GATES = STANDARD_GATES``
to preserve backward compatibility for any external import.
"""

from __future__ import annotations


STANDARD_GATES: tuple[str, ...] = (
    "gate_0",
    "gate_1",
    "gate_2",
    "gate_3",
    "gate_4",
    "gate_5",
)
"""Canonical gate ordering — lint → unit → integration → coverage → clean tree → smoke."""

GATE_PERF: str = "gate_perf"
"""Optional performance-budget gate (v0.7.3+); not part of the BR-004 Iron Law chain."""


__all__ = ["STANDARD_GATES", "GATE_PERF"]
