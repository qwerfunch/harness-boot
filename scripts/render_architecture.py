#!/usr/bin/env python3
"""
render_architecture.py — spec → architecture.yaml 렌더러 (F-003 §0.5)

사용:
  python3 scripts/render_architecture.py <spec.yaml>                     # stdout
  python3 scripts/render_architecture.py <spec.yaml> -o architecture.yaml # write

출력 구조:
  version: "2.3"
  generated_at: <timestamp>
  from_spec: <path>
  tech_stack: { ...spec.constraints.tech_stack }
  deliverable: { ...spec.deliverable }
  modules:
    - name: <module_name>
      owners: [<feature_id>, ...]     # 이 모듈을 참조하는 features[]
  contribution_points: [...metadata.contribution_points]  # 있을 때
  host_binding: {...metadata.host_binding}                # 있을 때
  feature_graph:
    - id: <feature_id>
      modules: [...]
      depends_on: [...]               # 있을 때

외부 의존: pyyaml.
"""

from __future__ import annotations

import argparse
import sys
from collections import OrderedDict, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("pyyaml is required", file=sys.stderr)
    sys.exit(1)


def _ordered_dump(data: Any) -> str:
    """YAML dump — 키 순서 보존 + Unicode allow + flow off."""
    class _Dumper(yaml.SafeDumper):
        pass

    def _represent_ordered(dumper, data):
        return dumper.represent_mapping("tag:yaml.org,2002:map", data.items())

    _Dumper.add_representer(OrderedDict, _represent_ordered)
    return yaml.dump(
        data,
        Dumper=_Dumper,
        default_flow_style=False,
        sort_keys=False,
        allow_unicode=True,
    )


def _build_modules_map(features: list) -> list[OrderedDict]:
    """features[*].modules 를 역인덱스해서 module → owning feature 리스트."""
    owners: dict[str, list[str]] = defaultdict(list)
    for f in features:
        if not isinstance(f, dict):
            continue
        fid = f.get("id", "F-?")
        for m in f.get("modules", []) or []:
            if isinstance(m, str):
                owners[m].append(fid)
            elif isinstance(m, dict):
                name = m.get("name")
                if name:
                    owners[name].append(fid)

    result = []
    for name in sorted(owners.keys()):
        result.append(OrderedDict(name=name, owners=owners[name]))
    return result


def _build_feature_graph(features: list) -> list[OrderedDict]:
    """features[*] 의 간단한 id · modules · depends_on 뷰."""
    result = []
    for f in features:
        if not isinstance(f, dict):
            continue
        entry = OrderedDict()
        entry["id"] = f.get("id", "F-?")
        if "name" in f:
            entry["name"] = f["name"]
        mods = f.get("modules", []) or []
        mod_names: list[str] = []
        for m in mods:
            if isinstance(m, str):
                mod_names.append(m)
            elif isinstance(m, dict) and m.get("name"):
                mod_names.append(m["name"])
        if mod_names:
            entry["modules"] = mod_names
        deps = f.get("depends_on", []) or []
        if deps:
            entry["depends_on"] = list(deps)
        status = f.get("status")
        if status:
            entry["status"] = status
        result.append(entry)
    return result


def render(spec: dict, *, timestamp: str | None = None, source_ref: str = "spec.yaml") -> str:
    """spec dict → architecture.yaml 문자열."""
    if timestamp is None:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    out: OrderedDict[str, Any] = OrderedDict()
    out["version"] = spec.get("version", "2.3")
    out["generated_at"] = timestamp
    out["from_spec"] = source_ref

    tech_stack = spec.get("constraints", {}).get("tech_stack") or {}
    if tech_stack:
        out["tech_stack"] = tech_stack

    deliverable = spec.get("deliverable") or {}
    if deliverable:
        out["deliverable"] = deliverable

    features = spec.get("features", []) or []
    modules = _build_modules_map(features)
    if modules:
        out["modules"] = modules

    metadata = spec.get("metadata", {}) or {}
    for key in ("contribution_points", "host_binding", "command_map", "ambient_files"):
        val = metadata.get(key)
        if val:
            out[key] = val

    graph = _build_feature_graph(features)
    if graph:
        out["feature_graph"] = graph

    return _ordered_dump(out)


def load_spec(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"{path}: top-level YAML must be a mapping")
    return data


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Render spec.yaml → architecture.yaml")
    parser.add_argument("spec", type=Path)
    parser.add_argument("-o", "--output", type=Path, default=None)
    parser.add_argument(
        "--timestamp", default=None, help="override generation timestamp (for tests)"
    )
    parser.add_argument(
        "--source-ref", default="spec.yaml", help="path recorded in from_spec"
    )
    args = parser.parse_args(argv)

    if not args.spec.is_file():
        print(f"error: {args.spec} not found", file=sys.stderr)
        return 2

    spec = load_spec(args.spec)
    output = render(spec, timestamp=args.timestamp, source_ref=args.source_ref)

    if args.output:
        args.output.write_text(output, encoding="utf-8")
        print(f"wrote {args.output}")
    else:
        sys.stdout.write(output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
