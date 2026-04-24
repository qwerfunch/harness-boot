#!/usr/bin/env python3
"""Mode B Phase 1 — BM25 section-to-axis extractor.

Given a plan.md, split by `##`/`###` headings, tokenize each section,
compute BM25 against each spec-axis query vocabulary, emit JSON with
top-k candidate axes per section and a summary.

LLM calls: 0. Pure statistics.

Usage:
  python3 scripts/mode_b_extract.py <plan.md> [--json out.json]
                                              [--markdown out.md]
                                              [--k1 1.5] [--b 0.75]
                                              [--top 2]
                                              [--thresh-high 0.55] [--thresh-mid 0.35]

References:
  - design/mode-b-phase1-design.md §2-§5
  - harness-boot-design-2.3.6.md §7.3.2
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

# Allow running from repo root without install.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from spec.mode_b.stopwords import STOP_EN, STOP_KR, KR_PARTICLES_SUFFIX  # noqa: E402
from spec.mode_b.axes import AXES  # noqa: E402


# ---------------------------------------------------------------------------
# Tokenizer
# ---------------------------------------------------------------------------

# Porter-lite: only strip the 5 most common English suffixes.
PORTER_LITE_SUFFIXES = ("ing", "ed", "es", "ly", "s")
MIN_STEM_LEN = 3

# Word boundary: letters (ASCII + Hangul + CJK) and digits, nothing else.
_TOKEN_RE = re.compile(r"[A-Za-z0-9\uAC00-\uD7A3\u4E00-\u9FFF]+")

# Strip code blocks and inline code before tokenizing.
_CODEBLOCK_RE = re.compile(r"```.*?```", re.DOTALL)
_INLINECODE_RE = re.compile(r"`[^`]+`")

# Markdown structure markers we drop (outside code blocks).
_MD_MARKER_RE = re.compile(r"[|>*#\-]+\s?")


def _strip_kr_particles(tok: str) -> str:
    """Remove trailing Korean postpositional particles. Greedy longest-first."""
    for suf in KR_PARTICLES_SUFFIX:
        if len(tok) > len(suf) + 1 and tok.endswith(suf):
            return tok[: -len(suf)]
    return tok


def _porter_lite(tok: str) -> str:
    if not tok.isascii():
        return tok
    for suf in PORTER_LITE_SUFFIXES:
        if len(tok) - len(suf) >= MIN_STEM_LEN and tok.endswith(suf):
            return tok[: -len(suf)]
    return tok


def tokenize(text: str) -> list[str]:
    """Produce normalized tokens per §2 of the design note."""
    text = _CODEBLOCK_RE.sub(" ", text)
    text = _INLINECODE_RE.sub(" ", text)
    text = _MD_MARKER_RE.sub(" ", text)
    text = unicodedata.normalize("NFC", text)

    toks: list[str] = []
    for m in _TOKEN_RE.finditer(text):
        raw = m.group(0).lower()
        if raw.isascii():
            t = _porter_lite(raw)
        else:
            t = _strip_kr_particles(raw)
        if len(t) < 2:
            continue
        if t in STOP_EN or t in STOP_KR:
            continue
        toks.append(t)
    return toks


# ---------------------------------------------------------------------------
# Section splitting
# ---------------------------------------------------------------------------

_HEADING_RE = re.compile(r"^(#{2,6})\s+(.+)$", re.MULTILINE)


@dataclass
class Section:
    idx: int
    level: int
    heading: str
    body: str
    tokens: list[str]


def split_sections(md: str) -> list[Section]:
    """Split markdown on ##/###/... headings. First pre-heading block is §0 intro."""
    positions = [(m.start(), m.end(), len(m.group(1)), m.group(2).strip())
                 for m in _HEADING_RE.finditer(md)]
    sections: list[Section] = []

    if not positions:
        sections.append(Section(0, 0, "(whole document)", md, tokenize(md)))
        return sections

    # intro before first heading
    first_start = positions[0][0]
    if first_start > 0:
        intro_body = md[:first_start].strip()
        if intro_body:
            sections.append(
                Section(0, 0, "(intro)", intro_body, tokenize(intro_body))
            )

    for i, (start, end, level, heading) in enumerate(positions):
        next_start = positions[i + 1][0] if i + 1 < len(positions) else len(md)
        body = md[end:next_start].strip()
        full_text = heading + "\n" + body  # include heading text in tokens
        sections.append(
            Section(
                idx=len(sections),
                level=level,
                heading=f"{'#' * level} {heading}",
                body=body,
                tokens=tokenize(full_text),
            )
        )
    return sections


# ---------------------------------------------------------------------------
# BM25
# ---------------------------------------------------------------------------

@dataclass
class BM25Corpus:
    docs: list[list[str]]
    doc_freq: dict[str, int]
    avg_len: float
    k1: float
    b: float

    @classmethod
    def build(cls, docs: list[list[str]], *, k1: float = 1.5, b: float = 0.75) -> "BM25Corpus":
        df: dict[str, int] = {}
        for d in docs:
            for t in set(d):
                df[t] = df.get(t, 0) + 1
        avg_len = (sum(len(d) for d in docs) / len(docs)) if docs else 0.0
        return cls(docs=docs, doc_freq=df, avg_len=avg_len, k1=k1, b=b)

    def _idf(self, term: str) -> float:
        n = len(self.docs)
        df = self.doc_freq.get(term, 0)
        if df == 0:
            return 0.0
        # Robertson-Spärck-Jones IDF variant, floor at 0.
        val = math.log(1.0 + (n - df + 0.5) / (df + 0.5))
        return max(val, 0.0)

    def score(self, doc: list[str], query: list[str]) -> float:
        if not doc or not query or self.avg_len == 0:
            return 0.0
        tf: dict[str, int] = {}
        for t in doc:
            tf[t] = tf.get(t, 0) + 1
        dl = len(doc)
        total = 0.0
        for q in query:
            f = tf.get(q, 0)
            if f == 0:
                continue
            idf = self._idf(q)
            denom = f + self.k1 * (1 - self.b + self.b * dl / self.avg_len)
            total += idf * (f * (self.k1 + 1)) / denom
        return total


# ---------------------------------------------------------------------------
# Extraction pipeline
# ---------------------------------------------------------------------------

def extract(md_text: str, *,
            k1: float, b: float, top_k: int,
            thresh_high: float, thresh_mid: float) -> dict:
    sections = split_sections(md_text)
    docs = [s.tokens for s in sections]
    corpus = BM25Corpus.build(docs, k1=k1, b=b)

    axis_queries = {name: [t.lower() for t in terms] for name, terms in AXES.items()}

    out_sections = []
    counts = {"high": 0, "medium": 0, "low": 0}
    for s in sections:
        scored = []
        for axis_name, q in axis_queries.items():
            sc = corpus.score(s.tokens, q)
            scored.append((axis_name, sc))
        scored.sort(key=lambda kv: kv[1], reverse=True)

        top = scored[:top_k]
        top_axes = []
        for axis_name, sc in top:
            if sc >= thresh_high:
                tier = "high"
            elif sc >= thresh_mid:
                tier = "medium"
            else:
                tier = "low"
            top_axes.append({"axis": axis_name, "score": round(sc, 4), "tier": tier})

        # Summary counts — use the BEST tier of the section.
        best_tier = top_axes[0]["tier"] if top_axes else "low"
        counts[best_tier] += 1

        out_sections.append({
            "idx": s.idx,
            "level": s.level,
            "heading": s.heading,
            "tokens": len(s.tokens),
            "top_axes": top_axes,
        })

    return {
        "sections": out_sections,
        "summary": {
            "sections_total": len(sections),
            "high_sections": counts["high"],
            "medium_sections": counts["medium"],
            "low_sections": counts["low"],
            "avg_tokens": round(corpus.avg_len, 2),
            "k1": k1,
            "b": b,
        },
    }


def to_markdown(result: dict, *, plan_path: str) -> str:
    buf = [f"# Mode B extract — {plan_path}\n"]
    s = result["summary"]
    buf.append(f"- sections: {s['sections_total']} "
               f"(high {s['high_sections']} / medium {s['medium_sections']} / low {s['low_sections']})")
    buf.append(f"- avg tokens/section: {s['avg_tokens']}  |  BM25 k1={s['k1']} b={s['b']}\n")
    buf.append("| idx | level | heading | tokens | top axis 1 | top axis 2 |")
    buf.append("|-----|-------|---------|--------|------------|------------|")
    for sec in result["sections"]:
        a1 = sec["top_axes"][0] if sec["top_axes"] else None
        a2 = sec["top_axes"][1] if len(sec["top_axes"]) > 1 else None
        cell1 = f"{a1['axis']} ({a1['score']}, {a1['tier']})" if a1 else "-"
        cell2 = f"{a2['axis']} ({a2['score']}, {a2['tier']})" if a2 else "-"
        buf.append(f"| {sec['idx']} | H{sec['level']} | {sec['heading'][:60]} | {sec['tokens']} | {cell1} | {cell2} |")
    return "\n".join(buf) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("plan", type=Path, help="plan.md path")
    ap.add_argument("--json", dest="json_out", type=Path, default=None)
    ap.add_argument("--markdown", dest="md_out", type=Path, default=None)
    ap.add_argument("--k1", type=float, default=1.5)
    ap.add_argument("--b", type=float, default=0.75)
    ap.add_argument("--top", type=int, default=2)
    ap.add_argument("--thresh-high", type=float, default=0.55)
    ap.add_argument("--thresh-mid", type=float, default=0.35)
    args = ap.parse_args()

    md_text = args.plan.read_text(encoding="utf-8")
    result = extract(
        md_text,
        k1=args.k1, b=args.b, top_k=args.top,
        thresh_high=args.thresh_high, thresh_mid=args.thresh_mid,
    )
    result["plan_path"] = str(args.plan)

    if args.json_out:
        args.json_out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"wrote {args.json_out}")
    if args.md_out:
        args.md_out.write_text(to_markdown(result, plan_path=str(args.plan)), encoding="utf-8")
        print(f"wrote {args.md_out}")
    if not args.json_out and not args.md_out:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
