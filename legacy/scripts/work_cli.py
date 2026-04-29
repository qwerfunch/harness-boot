"""F-045 — work.py CLI entry under a stable module name.

Mirrors the ``main()`` function in ``scripts/work.py``. The CLI itself
is still invoked via ``python3 scripts/work.py …`` to preserve the
existing user contract; this module exists so programmatic callers
(tests, automation) can import ``main`` from a name that survives a
future internal split.
"""

from __future__ import annotations

from legacy.scripts.work import main  # noqa: F401


__all__ = ["main"]
