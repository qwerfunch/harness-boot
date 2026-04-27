"""F-040 — locale resolver for user-facing output.

Single entry point: ``resolve_lang(spec)`` returns ``"en"`` or ``"ko"``.

Resolution order (first match wins):
    1. ``HARNESS_LANG`` env var (explicit user override).
    2. ``spec.project.language`` (per-project pin) — values ``"en"`` / ``"ko"``
       taken as-is; ``"auto"`` falls through to step 3.
    3. ``LC_ALL`` then ``LANG`` env var — Korean variants (``ko``, ``KR``)
       map to ``"ko"``; everything else maps to ``"en"``.
    4. ``"en"`` fallback (default — protects English-speaking adopters).
"""

from __future__ import annotations

import os
from typing import Optional


_SUPPORTED = ("en", "ko")
_KOREAN_HINTS = ("ko", "kor", "KR")


def resolve_lang(spec: Optional[dict] = None) -> str:
    """Return ``"en"`` or ``"ko"`` for user-facing output."""
    env_value = os.environ.get("HARNESS_LANG")
    if env_value in _SUPPORTED:
        return env_value

    if isinstance(spec, dict):
        project = spec.get("project") or {}
        spec_lang = project.get("language")
        if spec_lang in _SUPPORTED:
            return spec_lang
        # "auto" or any other value falls through to system locale.

    for key in ("LC_ALL", "LANG"):
        locale = os.environ.get(key) or ""
        if any(hint in locale for hint in _KOREAN_HINTS):
            return "ko"
        if locale and "en" in locale.lower():
            return "en"

    return "en"
