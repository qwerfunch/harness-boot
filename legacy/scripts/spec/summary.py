"""F-030 — derive a features summary index for LLM-context efficiency.

Produces a YAML file listing only ``id``, ``status`` (from state.yaml if
provided), ``area``, ``digest`` (or ``name`` fallback) per feature. Future
CLAUDE.md template can ``@import`` this summary instead of the full
``spec.yaml`` to stay within context budget at 1000+ features.

CLI:
    python3 scripts/spec/summary.py --spec <spec.yaml> [--state <state.yaml>] --out <summary.yaml>
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml


def _load(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def build_summary(spec: dict, state: dict | None = None) -> dict:
    state_lookup: dict[str, str] = {}
    if state and isinstance(state.get("features"), list):
        for s in state["features"]:
            sid = s.get("id")
            if isinstance(sid, str):
                state_lookup[sid] = s.get("status", "unknown")

    entries: list[dict] = []
    for feat in spec.get("features", []):
        fid = feat.get("id", "")
        digest = feat.get("digest") or feat.get("name") or ""
        entry = {
            "id": fid,
            "status": state_lookup.get(fid, feat.get("status", "planned")),
            "area": feat.get("area", "misc"),
            "digest": digest,
        }
        # Surface archive marker so summary users know what's still active.
        if feat.get("archived_at"):
            entry["archived"] = True
        entries.append(entry)

    return {
        "version": spec.get("version", "unknown"),
        "project_name": (spec.get("project") or {}).get("name", "unknown"),
        "feature_count": len(entries),
        "features": entries,
    }


def write_summary(summary: dict, path: Path) -> None:
    path.write_text(
        yaml.dump(summary, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--spec", required=True, type=Path)
    parser.add_argument("--state", type=Path, default=None)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args(argv)

    spec = _load(args.spec)
    state = _load(args.state) if args.state and args.state.exists() else None
    summary = build_summary(spec, state)
    write_summary(summary, args.out)
    print(f"summary → {args.out} ({summary['feature_count']} features)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
