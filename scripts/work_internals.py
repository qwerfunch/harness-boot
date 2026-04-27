"""F-045 — work.py public-API entry point under a stable, documented name.

Re-exports the data class, lifecycle functions, and the human/JSON
formatters from ``scripts/work.py``. New callers should import from
this module so the eventual physical split inside work.py doesn't
ripple into them.

The original imports in ``scripts/work.py`` keep working — this is
purely a forward-compatible alias surface, not a behavior change.
"""

from __future__ import annotations

# Re-export the public dataclass + lifecycle functions.
# Importing from work.py reuses its sys.path bootstrap, so callers of
# this module don't need to add 'scripts/' to sys.path themselves.
from scripts.work import (  # noqa: F401
    WorkResult,
    activate,
    add_evidence,
    archive,
    block,
    complete,
    current,
    deactivate,
    record_gate,
    remove_feature,
    run_and_record_gate,
    format_human,
)


__all__ = [
    "WorkResult",
    "activate",
    "add_evidence",
    "archive",
    "block",
    "complete",
    "current",
    "deactivate",
    "record_gate",
    "remove_feature",
    "run_and_record_gate",
    "format_human",
]
