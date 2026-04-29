"""F-044 — feature archive flow.

Activates the F-029 (v0.10.6) `archived_at` / `archive_reason` schema
fields. Mark a feature as archived without removing it from the spec —
the entry stays where it is so blame, history, and `git log -p` keep
working; the marker tells dashboards and check.py to treat it as a
sealed lifecycle stage rather than active work.

Distinct from `work.py --remove`: that one deletes the `state.yaml`
entry (ghost cleanup). This one **adds metadata** to the `spec.yaml`
entry so the lifecycle decision is auditable.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import yaml


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def archive_feature(
    spec_path: Path,
    feature_id: str,
    reason: str,
    *,
    timestamp: Optional[str] = None,
) -> dict:
    """Mark ``feature_id`` archived in ``spec_path`` (in-place edit).

    Returns the modified feature dict (for the caller to log / audit).
    Raises ``KeyError`` when the feature is not present, ``ValueError``
    when ``reason`` is empty.
    """
    if not reason or not reason.strip():
        raise ValueError("archive_reason cannot be empty")

    spec_path = Path(spec_path)
    text = spec_path.read_text(encoding="utf-8")
    data = yaml.safe_load(text)
    if not isinstance(data, dict):
        raise ValueError(f"{spec_path} is not a YAML mapping")

    features = data.get("features") or []
    target: Optional[dict] = None
    for feature in features:
        if isinstance(feature, dict) and feature.get("id") == feature_id:
            target = feature
            break
    if target is None:
        raise KeyError(f"{feature_id} not in spec")

    target["archived_at"] = timestamp or _now_iso()
    target["archive_reason"] = reason.strip()

    spec_path.write_text(
        yaml.safe_dump(data, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    return target


def is_archived(feature: dict) -> bool:
    """True when the feature has an ``archived_at`` marker."""
    return bool(feature.get("archived_at"))


__all__ = ["archive_feature", "is_archived"]
