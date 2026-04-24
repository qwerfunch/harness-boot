#!/usr/bin/env python3
"""Mode B Phase 1 — round-trip regression.

For each sample:
  1. Run mode_b_extract on plan.md → get section-to-axis classification.
  2. Parse the corresponding golden spec.yaml and extract text per axis.
  3. Compute recall: of the "meaningful" plan sections (tier >= medium),
     how many have token overlap with some spec field text.
  4. Compute precision: of the spec field text blocks, how many have
     a corresponding plan section with token overlap.

"Token overlap" here = at least OVERLAP_MIN shared non-trivial tokens.

Usage:
  python3 scripts/mode_b_roundtrip.py            # default: 6 samples
  python3 scripts/mode_b_roundtrip.py url-shortener
  python3 scripts/mode_b_roundtrip.py --overlap-min 3

Output: table to stdout + JSON to design/mode-b-phase1-results.json.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

# mode_b_extract now lives in the parent package (scripts/spec/). Insert
# scripts/ into sys.path so `spec.mode_b_extract` resolves when run as a
# direct script.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from spec.mode_b_extract import extract, tokenize  # noqa: E402


DEFAULT_SAMPLES = [
    "url-shortener",
    "retro-jumper",
    "price-crawler",
    "tzcalc",
    "vite-bundle-budget",
    "vscode-commit-craft",
]

REPO = Path(__file__).resolve().parent.parent
OVERLAP_MIN_DEFAULT = 5
MIN_SECTION_TOKENS = 15  # skip tiny sections (headings only)


# ---------------------------------------------------------------------------
# spec.yaml text blocks
# ---------------------------------------------------------------------------

def _flatten_strings(node) -> list[str]:
    """Recursively collect string leaves from a YAML mapping/list."""
    out: list[str] = []
    if node is None:
        return out
    if isinstance(node, str):
        s = node.strip()
        if s:
            out.append(s)
    elif isinstance(node, dict):
        for k, v in node.items():
            if isinstance(k, str) and k.startswith("$"):
                # skip $include etc.
                continue
            out.extend(_flatten_strings(v))
    elif isinstance(node, list):
        for v in node:
            out.extend(_flatten_strings(v))
    return out


def spec_blocks(spec_path: Path) -> list[tuple[str, list[str]]]:
    """Return list of (field_label, tokens) pairs from spec.yaml top-level sections."""
    doc = yaml.safe_load(spec_path.read_text(encoding="utf-8"))
    if not isinstance(doc, dict):
        return []
    result = []
    for top_key in ("project", "domain", "constraints", "deliverable", "features", "metadata"):
        if top_key not in doc:
            continue
        strings = _flatten_strings(doc[top_key])
        tokens: list[str] = []
        for s in strings:
            tokens.extend(tokenize(s))
        if tokens:
            result.append((top_key, tokens))
    return result


# ---------------------------------------------------------------------------
# overlap metric
# ---------------------------------------------------------------------------

def overlap_size(a: list[str], b: list[str]) -> int:
    return len(set(a) & set(b))


def evaluate_sample(sample: str, *, overlap_min: int) -> dict:
    plan_path = REPO / "design" / "samples" / sample / "plan.md"
    spec_path = REPO / "design" / "samples" / sample / "spec.yaml"
    if not plan_path.exists() or not spec_path.exists():
        return {"sample": sample, "error": "missing plan.md or spec.yaml"}

    result = extract(
        plan_path.read_text(encoding="utf-8"),
        k1=1.5, b=0.75, top_k=2, thresh_high=0.55, thresh_mid=0.35,
    )
    sections = result["sections"]
    section_tokens = {s["idx"]: tokenize((plan_path.read_text(encoding="utf-8")))
                      for s in sections}  # recompute per section below

    # Re-split once more to get tokens aligned with section idx
    from mode_b_extract import split_sections
    secs = split_sections(plan_path.read_text(encoding="utf-8"))
    token_map = {s.idx: s.tokens for s in secs}
    heading_map = {s.idx: s.heading for s in secs}

    blocks = spec_blocks(spec_path)

    # -------- recall --------
    meaningful = [s for s in sections
                  if s["tokens"] >= MIN_SECTION_TOKENS
                  and s["top_axes"]
                  and s["top_axes"][0]["tier"] in ("high", "medium")]
    covered = 0
    uncovered = []
    for s in meaningful:
        stoks = token_map[s["idx"]]
        hit = False
        for _label, btoks in blocks:
            if overlap_size(stoks, btoks) >= overlap_min:
                hit = True
                break
        if hit:
            covered += 1
        else:
            uncovered.append(heading_map[s["idx"]])
    recall = covered / len(meaningful) if meaningful else 0.0

    # -------- precision --------
    # each spec top-level block: is it traceable to some plan section?
    matched_blocks = 0
    unmatched_block_labels = []
    for label, btoks in blocks:
        hit = False
        for s in sections:
            stoks = token_map[s["idx"]]
            if overlap_size(stoks, btoks) >= overlap_min:
                hit = True
                break
        if hit:
            matched_blocks += 1
        else:
            unmatched_block_labels.append(label)
    precision = matched_blocks / len(blocks) if blocks else 0.0

    return {
        "sample": sample,
        "sections_total": len(sections),
        "meaningful_sections": len(meaningful),
        "recall": round(recall, 3),
        "precision": round(precision, 3),
        "uncovered_sections": uncovered,
        "spec_blocks": [label for label, _ in blocks],
        "unmatched_blocks": unmatched_block_labels,
        "summary": result["summary"],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("samples", nargs="*", default=DEFAULT_SAMPLES)
    ap.add_argument("--overlap-min", type=int, default=OVERLAP_MIN_DEFAULT)
    ap.add_argument("--out", type=Path, default=REPO / "design" / "mode-b-phase1-results.json")
    args = ap.parse_args()

    results = []
    for s in args.samples:
        r = evaluate_sample(s, overlap_min=args.overlap_min)
        results.append(r)

    # --- table ---
    print(f"{'sample':<22} {'sect':>5} {'meaningful':>11} {'recall':>8} {'precision':>10} {'uncovered':>10}")
    print("-" * 72)
    tot_recall = tot_precision = 0.0
    n = 0
    for r in results:
        if "error" in r:
            print(f"{r['sample']:<22} ERROR: {r['error']}")
            continue
        print(f"{r['sample']:<22} {r['sections_total']:>5d} {r['meaningful_sections']:>11d} "
              f"{r['recall']:>8.3f} {r['precision']:>10.3f} {len(r['uncovered_sections']):>10d}")
        tot_recall += r["recall"]
        tot_precision += r["precision"]
        n += 1
    if n:
        print("-" * 72)
        print(f"{'AVG':<22} {'':>5} {'':>11} {tot_recall/n:>8.3f} {tot_precision/n:>10.3f}")

    args.out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nresults written: {args.out.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
