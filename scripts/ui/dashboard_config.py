"""F-043 — dashboard truncation limits, env-overridable.

The dashboard truncates "in progress (others)", "pending", and
"unregistered" feature lists at five entries by default. F-043 lifts
those magic numbers out of ``dashboard.py`` so a project with hundreds
of features can dial them up without touching code.

Overrides via env (each is independent):

- ``HARNESS_DASHBOARD_MAX_OTHER``
- ``HARNESS_DASHBOARD_MAX_PENDING``
- ``HARNESS_DASHBOARD_MAX_UNREGISTERED``

Invalid values (non-int, ≤ 0) silently fall back to the default.
"""

from __future__ import annotations

import os


_DEFAULT_MAX_OTHER = 5
_DEFAULT_MAX_PENDING = 5
_DEFAULT_MAX_UNREGISTERED = 5


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


def max_other_list() -> int:
    """Cap on the "in progress (others)" list."""
    return _env_int("HARNESS_DASHBOARD_MAX_OTHER", _DEFAULT_MAX_OTHER)


def max_pending_list() -> int:
    """Cap on the "pending" list."""
    return _env_int("HARNESS_DASHBOARD_MAX_PENDING", _DEFAULT_MAX_PENDING)


def max_unregistered_list() -> int:
    """Cap on the "unregistered candidates" list."""
    return _env_int("HARNESS_DASHBOARD_MAX_UNREGISTERED", _DEFAULT_MAX_UNREGISTERED)


__all__ = ["max_other_list", "max_pending_list", "max_unregistered_list"]
