"""F-045 — check.py drift-detector entry point + DRIFT_CHECKS registry.

`scripts/check.py` declares each drift detector as a top-level
``check_*`` function. F-045 surfaces them under a stable module name
and assembles them into a single ``DRIFT_CHECKS`` dict keyed by
drift-kind label, so adding a new drift type becomes a two-line patch
(function + registry entry) rather than threading a new branch
through ``main()``.
"""

from __future__ import annotations

from scripts.check import (  # noqa: F401
    check_adr_supersedes,
    check_anchor,
    check_anchor_integration,
    check_code,
    check_derived,
    check_doc,
    check_evidence,
    check_generated,
    check_includes,
    check_protocol,
    check_spec,
    check_stale,
)


# Registry — maps a human-readable drift kind to its detector function.
# Each detector keeps its existing signature in ``scripts/check.py``;
# external callers who want to iterate "all drift checks" should walk
# this dict instead of hardcoding the list.
DRIFT_CHECKS: dict[str, callable] = {
    "Generated":         check_generated,
    "Derived":            check_derived,
    "Spec":               check_spec,
    "Include":            check_includes,
    "Evidence":           check_evidence,
    "Code":               check_code,
    "Doc":                check_doc,
    "Anchor":             check_anchor,
    "AnchorIntegration":  check_anchor_integration,
    "AdrSupersedes":      check_adr_supersedes,
    "Protocol":           check_protocol,
    "Stale":              check_stale,
}


__all__ = [
    "DRIFT_CHECKS",
    "check_adr_supersedes",
    "check_anchor",
    "check_anchor_integration",
    "check_code",
    "check_derived",
    "check_doc",
    "check_evidence",
    "check_generated",
    "check_includes",
    "check_protocol",
    "check_spec",
    "check_stale",
]
