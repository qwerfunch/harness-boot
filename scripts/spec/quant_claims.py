"""F-077 — extract quantitative claims from feature description / AC text.

Why this exists
---------------
Iron Law (BR-004) ensures procedural completion: ``gate_5 = pass`` plus
``declared_evidence >= mode_threshold``. It does not verify that the
declared evidence content actually matches the spec's quantitative
targets. A field-discovered failure mode: features whose ``description``
promised "13 ChainTemplate" / "74 propagation rule" / "35 Heuristic
tools" reached ``done`` with implementations covering ~38% / ~13% / ~3%
of those targets. The carry-forward bullets noting the gap stayed
buried in retro Deferred sections.

This module is the smallest leverage point in the response chain (F-077):
a static lint that runs at activate time, parses numeric claims out of
prose, and computes mismatches between description-side promises and
AC-side acceptance. The lint is informational only — fail-open at the
activate boundary. Subsequent features build on the same fingerprint:

* F-078 — Coverage drift detector (the 13th drift kind).
* F-079 — Dashboard coverage gauge.

Pattern catalog
---------------
Three regex families, all conservative:

1. ``<int> <counter-noun>`` — "13 ChainTemplate", "74 propagation rule",
   "35개 Heuristic 도구". The counter noun is normalized (lowercased,
   trimmed of trailing 's'; Korean ``개`` is preserved as-is).
2. ``≥|>=` <int>`` — "F1 ≥ 83 percent". The metric token is the next
   word after the number.
3. ``<int>/<int>`` — "5/13 ChainTemplate covered" emits two claims
   (numerator and denominator) under the same metric.

Output schema
-------------
``Claim`` is a NamedTuple ``(metric: str, value: int, span: tuple[int, int])``.
``Mismatch`` is ``(metric: str, description_value: int, ac_value: int)``.
"""

from __future__ import annotations

import re
from typing import NamedTuple


class Claim(NamedTuple):
    metric: str
    value: int
    span: tuple[int, int]


class Mismatch(NamedTuple):
    metric: str
    description_value: int
    ac_value: int


_COUNTER_NOUNS = {
    "rule", "rules",
    "template", "templates",
    "tool", "tools",
    "item", "items",
    "hop", "hops",
    "step", "steps",
    "category", "categories",
    "agent", "agents",
    "feature", "features",
    "test", "tests",
    "case", "cases",
    "field", "fields",
    "line", "lines",
    "stage", "stages",
    "level", "levels",
    "tier", "tiers",
    "screen", "screens",
    "page", "pages",
    "check", "checks",
    "detector", "detectors",
    "kind", "kinds",
    "module", "modules",
    "endpoint", "endpoints",
    "scan", "scans",
    "percent",
    "%",
    "개",  # Korean counter
}


# Pattern grabs the digit and up to three following Latin tokens. The
# resolver then walks the tokens to find the first recognized counter
# noun (rule / template / etc.) or the first TitleCase domain term.
_PATTERN_COUNTER_EN = re.compile(
    r"(\d+)((?:\s+[A-Za-z][A-Za-z_-]{0,40}){1,3})",
    re.UNICODE,
)
_PATTERN_COUNTER_KO = re.compile(r"(\d+)\s*개", re.UNICODE)
_PATTERN_GEQ = re.compile(r"(?:≥|>=)\s*(\d+)\s*([A-Za-z%][A-Za-z%_-]{0,40})?", re.UNICODE)
_PATTERN_FRACTION = re.compile(r"(\d+)\s*[/／]\s*(\d+)\s*([A-Za-z][A-Za-z_-]{1,40})?", re.UNICODE)


def _normalize_metric(token: str) -> str:
    """Lowercase token + strip trailing plural 's' so 'rules' and 'rule'
    collide. Keep Korean tokens (e.g. ``개``) as-is.
    """
    if not token:
        return ""
    t = token.strip().lower()
    if t.endswith("s") and len(t) > 1 and t[:-1] in _COUNTER_NOUNS:
        return t[:-1]
    return t


def extract_numeric_claims(text: str) -> list[Claim]:
    """Pull quantitative claims out of arbitrary prose.

    Conservative: only emits a claim when the digit is followed (or
    preceded for the ``≥`` family) by a recognized counter noun.
    Returns an empty list for empty or digit-free text. Never raises
    on garbage input.
    """
    if not text:
        return []
    claims: list[Claim] = []
    seen_spans: set[tuple[int, int]] = set()

    # 1. Korean ``N개`` — emit metric '개'.
    for m in _PATTERN_COUNTER_KO.finditer(text):
        span = m.span()
        if span in seen_spans:
            continue
        seen_spans.add(span)
        claims.append(Claim(metric="개", value=int(m.group(1)), span=span))

    # 2. ``N <token>+`` — walk up to 3 following tokens and pick the
    #    first recognized counter noun, or the first TitleCase domain
    #    term, whichever comes first. Skips known stop words ('and',
    #    'with', etc.) so phrases like '74 propagation rule' resolve
    #    to metric 'rule' instead of 'propagation'.
    stop_words = {"and", "with", "or", "of", "the", "a", "an", "to", "for", "by"}
    for m in _PATTERN_COUNTER_EN.finditer(text):
        full_span = m.span()
        if any(s[0] <= full_span[0] < s[1] for s in seen_spans):
            continue
        digit_value = int(m.group(1))
        tail_tokens = [t for t in m.group(2).split() if t]
        chosen_metric = ""
        for tok in tail_tokens:
            tok_clean = tok.strip(".,;:")
            if tok_clean.lower() in stop_words:
                continue
            normalized = _normalize_metric(tok_clean)
            if normalized in _COUNTER_NOUNS:
                chosen_metric = normalized
                break
            # TitleCase domain term — accept on first encounter only if
            # no recognized counter follows further in the tail.
            if not chosen_metric and tok_clean[:1].isupper():
                chosen_metric = tok_clean.lower()
        if not chosen_metric:
            continue
        # Use the digit's start span and end at the first-token boundary.
        span = (full_span[0], m.end(1) + len(m.group(2).split(tail_tokens[0])[0]) + len(tail_tokens[0]))
        seen_spans.add(span)
        claims.append(Claim(metric=chosen_metric, value=digit_value, span=span))

    # 3. ``≥ N <metric?>`` — emit when metric tail is recognized; else
    #    emit metric '' (anonymous threshold) so callers that compare by
    #    name will simply skip it.
    for m in _PATTERN_GEQ.finditer(text):
        span = m.span()
        if any(s[0] <= span[0] < s[1] for s in seen_spans):
            continue
        seen_spans.add(span)
        raw = m.group(2) or ""
        metric = _normalize_metric(raw) if raw else ""
        claims.append(Claim(metric=metric, value=int(m.group(1)), span=span))

    # 4. Fraction ``N/M [metric]`` — emit two claims (numerator + denominator).
    for m in _PATTERN_FRACTION.finditer(text):
        span = m.span()
        if any(s[0] <= span[0] < s[1] for s in seen_spans):
            continue
        seen_spans.add(span)
        raw = m.group(3) or ""
        metric = _normalize_metric(raw) if raw else ""
        claims.append(Claim(metric=metric, value=int(m.group(1)), span=span))
        claims.append(Claim(metric=metric, value=int(m.group(2)), span=span))

    return claims


def diff_claims(description: str, ac_texts: list[str]) -> list[Mismatch]:
    """Return mismatches where the description over-promises relative to AC.

    Comparison rule (intentional simplicity for F-077):
        For each metric that appears in BOTH the description and the
        joined AC text, take the maximum value on each side and emit a
        Mismatch when ``description_max > ac_max``. Metrics absent from
        either side are silently skipped — no false-positive 'AC missing'.

    Returns mismatches ordered by metric token (stable). Empty lists in
    either input return ``[]``.
    """
    desc_claims = extract_numeric_claims(description or "")
    ac_combined = "\n".join(ac_texts or [])
    ac_claims = extract_numeric_claims(ac_combined)

    desc_max: dict[str, int] = {}
    for claim in desc_claims:
        if not claim.metric:
            continue
        desc_max[claim.metric] = max(desc_max.get(claim.metric, 0), claim.value)

    ac_max: dict[str, int] = {}
    for claim in ac_claims:
        if not claim.metric:
            continue
        ac_max[claim.metric] = max(ac_max.get(claim.metric, 0), claim.value)

    mismatches: list[Mismatch] = []
    for metric in sorted(desc_max):
        if metric not in ac_max:
            continue
        if desc_max[metric] > ac_max[metric]:
            mismatches.append(
                Mismatch(
                    metric=metric,
                    description_value=desc_max[metric],
                    ac_value=ac_max[metric],
                )
            )
    return mismatches


__all__ = [
    "Claim",
    "Mismatch",
    "extract_numeric_claims",
    "diff_claims",
]
