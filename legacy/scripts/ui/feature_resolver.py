"""User input → feature dict · title fuzzy + @F-N + plain F-N (v0.9.1).

Resolution order (highest priority first):

1. ``@F-N`` prefix (after whitespace strip) — explicit id reference.
   Power-user escape hatch. Never falls through to title matching.
2. Plain ``F-N`` (caps-insensitive) matching ``^F-\\d+$`` — treated as id
   reference for backward compat with existing CLI callers.
3. Title substring fuzzy — case-insensitive, whitespace-normalized. Matches
   any feature whose ``title`` contains the query as substring.

Three possible outcomes wrapped in ``ResolveResult``:

- ``single`` — exactly one feature resolved; ``result.feature`` is that dict.
- ``multiple`` — title fuzzy matched 2+ features; ``result.candidates`` lists
  them. Caller (eventually intent_planner) presents a menu.
- ``none`` — no match.

This module is pure: no I/O, no state mutation. Rest of harness wires it in
v0.9.2 when ``/harness-boot:work`` intent routing arrives.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal


_AT_FORM_RE = re.compile(r"^@(F-\d+)$")
_PLAIN_FN_RE = re.compile(r"^(F-\d+)$", re.IGNORECASE)


ResultKind = Literal["single", "multiple", "none"]


@dataclass(frozen=True)
class ResolveResult:
    """Outcome of resolving user input to a feature.

    Exactly one of ``feature`` or ``candidates`` is populated, per ``kind``.
    """

    kind: ResultKind
    feature: dict | None = None
    candidates: list[dict] | None = None


def _lookup_by_id(fid: str, features: list) -> dict | None:
    for f in features:
        if isinstance(f, dict) and f.get("id") == fid:
            return f
    return None


def _title_matches(query: str, features: list) -> list[dict]:
    q = query.lower()
    out: list[dict] = []
    for f in features:
        if not isinstance(f, dict):
            continue
        title = f.get("title")
        if not isinstance(title, str):
            continue
        if q in title.lower():
            out.append(f)
    return out


def resolve(query: str, spec: dict) -> ResolveResult:
    """Resolve user query against spec features.

    Args:
        query: raw user input. Leading/trailing whitespace stripped.
            Supports ``@F-N`` · plain ``F-N`` · any title substring.
        spec: parsed spec.yaml dict. Expected to have ``features[]``.

    Returns:
        ResolveResult describing the match (single/multiple/none).
    """
    if not isinstance(query, str):
        return ResolveResult(kind="none")
    q = query.strip()
    if not q:
        return ResolveResult(kind="none")

    features = spec.get("features") if isinstance(spec, dict) else None
    if not isinstance(features, list) or not features:
        return ResolveResult(kind="none")

    # 1. @F-N explicit form
    m = _AT_FORM_RE.match(q)
    if m:
        f = _lookup_by_id(m.group(1), features)
        return ResolveResult(kind="single", feature=f) if f else ResolveResult(kind="none")

    # 2. Plain F-N form (case-insensitive for robustness — "f-3" also works)
    m = _PLAIN_FN_RE.match(q)
    if m:
        fid = m.group(1).upper()
        f = _lookup_by_id(fid, features)
        return ResolveResult(kind="single", feature=f) if f else ResolveResult(kind="none")

    # 3. Title substring fuzzy
    matches = _title_matches(q, features)
    if len(matches) == 0:
        return ResolveResult(kind="none")
    if len(matches) == 1:
        return ResolveResult(kind="single", feature=matches[0])
    return ResolveResult(kind="multiple", candidates=matches)
