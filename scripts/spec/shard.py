"""F-030 — shard a monolithic spec.yaml into per-feature files.

Splits ``spec.features[]`` into ``<output_dir>/<area>/F-N.yaml`` (one file
per feature). The remaining top-level (``project``, ``domain``,
``constraints``, ``deliverable``, ``metadata``, ``open_questions``,
``decisions``, ``risks``, ``version``) is preserved in
``<output_dir>/spec.yaml`` with a ``features`` array of ``{id, include_path}``
references.

Idempotent: running shard twice produces the same tree. Round-trippable
with ``unshard.py``.

CLI:
    python3 scripts/spec/shard.py --in <spec.yaml> --out <output_dir>
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml


_DEFAULT_AREA = "misc"
_TOP_LEVEL_PRESERVED = (
    "version",
    "project",
    "domain",
    "constraints",
    "deliverable",
    "metadata",
    "open_questions",
    "decisions",
    "risks",
)


def _load(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _dump(data: dict, path: Path) -> None:
    path.write_text(
        yaml.dump(data, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )


def shard(spec: dict, output_dir: Path) -> dict:
    """Write per-feature files under ``output_dir`` and return the index spec.

    The returned dict is the to-be-written ``spec.yaml`` with
    ``features`` replaced by ``[{id, include_path}, ...]``. Caller
    decides whether to actually write the index (``shard_to_disk`` does).
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    features_dir = output_dir / "features"
    features_dir.mkdir(parents=True, exist_ok=True)

    index: list[dict] = []
    for feat in spec.get("features", []):
        fid = feat["id"]
        area = feat.get("area") or _DEFAULT_AREA
        area_dir = features_dir / area
        area_dir.mkdir(parents=True, exist_ok=True)
        rel_path = f"features/{area}/{fid}.yaml"
        _dump(feat, output_dir / rel_path)
        index.append({"id": fid, "include_path": rel_path})

    out_spec: dict = {}
    for key in _TOP_LEVEL_PRESERVED:
        if key in spec:
            out_spec[key] = spec[key]
    out_spec["features"] = index
    return out_spec


def shard_to_disk(input_path: Path, output_dir: Path) -> None:
    spec = _load(input_path)
    index_spec = shard(spec, output_dir)
    _dump(index_spec, output_dir / "spec.yaml")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--in", dest="input", required=True, type=Path)
    parser.add_argument("--out", dest="output", required=True, type=Path)
    args = parser.parse_args(argv)
    shard_to_disk(args.input, args.output)
    print(f"sharded → {args.output}/spec.yaml + features/<area>/F-N.yaml")
    return 0


if __name__ == "__main__":
    sys.exit(main())
