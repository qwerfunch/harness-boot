"""F-030 — reverse of ``shard.py``: assemble per-feature files into one spec.yaml.

Reads the index ``spec.yaml`` (with ``features: [{id, include_path}, ...]``)
plus each referenced per-feature file under the same root, and writes a
single monolithic ``output_path``.

Round-trip guarantee: ``shard(spec) → unshard()`` yields the same parsed
dict as the original ``spec`` (key order may differ; YAML 의미는 보존).

CLI:
    python3 scripts/spec/unshard.py --in <output_dir>/spec.yaml --out <restored.yaml>
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml


def _load(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def _dump(data: dict, path: Path) -> None:
    path.write_text(
        yaml.dump(data, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )


def unshard(index_path: Path) -> dict:
    """Return the assembled monolithic spec dict.

    ``index_path`` 의 부모 디렉터리를 base 로 ``include_path`` 를 해석.
    """
    index_spec = _load(index_path)
    base = index_path.parent

    assembled_features: list[dict] = []
    for entry in index_spec.get("features", []):
        if "include_path" in entry:
            full = base / entry["include_path"]
            assembled_features.append(_load(full))
        else:
            # Inline feature (sharding 안 된 항목 — passthrough).
            assembled_features.append(entry)

    out: dict = {k: v for k, v in index_spec.items() if k != "features"}
    out["features"] = assembled_features
    return out


def unshard_to_disk(index_path: Path, output_path: Path) -> None:
    spec = unshard(index_path)
    _dump(spec, output_path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--in", dest="input", required=True, type=Path)
    parser.add_argument("--out", dest="output", required=True, type=Path)
    args = parser.parse_args(argv)
    unshard_to_disk(args.input, args.output)
    print(f"unsharded → {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
