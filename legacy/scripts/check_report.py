"""F-045 — check.py reporting types + helpers under a stable name.

Re-exports the ``DriftFinding`` dataclass and any reporting utilities
declared in ``scripts/check.py``. The actual rendering still lives in
``check.py``'s ``main()`` for now; this module exists to give
programmatic consumers (tests, integrations) a stable import path.
"""

from __future__ import annotations

from legacy.scripts.check import DriftFinding  # noqa: F401


__all__ = ["DriftFinding"]
