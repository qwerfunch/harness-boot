"""Stopword lists for the Mode B BM25 tokenizer.

Three frozensets are exported:

- ``STOP_EN`` — English filler words + spec-conversion meta-noise
  (``plan``/``section``/``figure`` and similar structural tokens).
- ``STOP_KR`` — Korean particles, pronouns, and common fillers.
- ``KR_PARTICLES_SUFFIX`` — terminal particles stripped by the Porter-lite
  Korean tokenizer before BM25 scoring.

Lists are deliberately compact. Bringing in ``nltk`` or a morphological
analyzer was rejected for Phase 1 to keep the Mode B pipeline zero-dep.
Upgrade path: a KoNLPy-backed tokenizer slot-in at
``scripts.spec.mode_b.extract`` with the same ``tokenize()`` contract.
"""

from __future__ import annotations

# English — compact NLTK-like list (common words + spec-conversion specific)
STOP_EN = frozenset("""
a an and any are as at be been being but by can could did do does doing done
for from had has have having he her hers him his how i if in into is it its
me more most much my myself no nor not of on once only or other our ours out
over same she should so some such than that the their them then there these
they this those through to too under until up us very was we were what when
where which while who whom why will with would you your yours yourself
plan doc document section chapter example note notes figure table
""".split())

# Korean — common particles + pronouns + fillers
STOP_KR = frozenset("""
것 수 때 등 및 혹은 또는 그리고 이것 저것 각각 모든 예를들어
같이 위해 통해 경우 대해 관련 대한 때문 하지만 그러나 다만 또한
있다 없다 된다 한다 이다 아니다 되는 하는 있는 없는
""".split())

# Korean postpositional particles — stripped as token-suffix via tokenizer.
# (list referenced by mode_b_extract.py, not used directly as stopwords)
KR_PARTICLES_SUFFIX = (
    "으로부터", "에서", "에게", "으로", "까지", "부터",
    "와", "과", "는", "은", "이", "가", "을", "를", "의", "에", "도", "만", "로",
)
# Order matters: longer suffixes tried first (greedy strip).
