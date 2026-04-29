#!/usr/bin/env python3
"""
explain_spec.py — /harness:spec Mode E (read-only) 구현.

사용:
  python3 scripts/explain_spec.py <spec.yaml>                      # 전체 요약
  python3 scripts/explain_spec.py <spec.yaml> --feature F-003      # 특정 피처
  python3 scripts/explain_spec.py <spec.yaml> --entity User        # 특정 엔티티
  python3 scripts/explain_spec.py <spec.yaml> --json               # JSON 출력

CQS 불변조건: 파일 **읽기만**. mtime 포함 어떤 부작용도 없어야 함 (테스트 검증).

스펙 안내가 목표 — 구체 값을 사람 눈으로 빠르게 확인할 수 있게 지름길 요약.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("pyyaml is required", file=sys.stderr)
    sys.exit(1)


def explain_overview(spec: dict) -> dict:
    """전체 요약 — 섹션별 개수 + 핵심 항목 이름."""
    project = spec.get("project", {}) or {}
    domain = spec.get("domain", {}) or {}
    features = spec.get("features", []) or []

    feature_summary = []
    for f in features:
        if not isinstance(f, dict):
            continue
        feature_summary.append(
            {
                "id": f.get("id", "?"),
                "name": f.get("name") or f.get("title", ""),
                "status": f.get("status", "planned"),
                "release_target": f.get("release_target", ""),
            }
        )

    return {
        "version": spec.get("version"),
        "project": {
            "name": project.get("name"),
            "summary": project.get("summary"),
        },
        "domain": {
            "entities": [e.get("name") or e.get("id") for e in (domain.get("entities") or []) if isinstance(e, dict)],
            "business_rules": len(domain.get("business_rules") or []),
        },
        "features": feature_summary,
        "release_plan": spec.get("metadata", {}).get("release_plan"),
    }


def explain_feature(spec: dict, feature_id: str) -> dict:
    """한 피처의 상세."""
    features = spec.get("features", []) or []
    for f in features:
        if isinstance(f, dict) and f.get("id") == feature_id:
            return f
    raise LookupError(f"feature {feature_id!r} not found")


def explain_entity(spec: dict, entity_name: str) -> dict:
    entities = (spec.get("domain") or {}).get("entities") or []
    for e in entities:
        if isinstance(e, dict) and (e.get("name") == entity_name or e.get("id") == entity_name):
            return e
    raise LookupError(f"entity {entity_name!r} not found")


def format_overview(overview: dict) -> str:
    lines = []
    lines.append(f"# {overview['project']['name']} ({overview.get('version')})")
    lines.append("")
    if overview["project"].get("summary"):
        lines.append(overview["project"]["summary"])
        lines.append("")
    lines.append(f"**Entities** ({len(overview['domain']['entities'])}): " +
                 ", ".join(overview["domain"]["entities"]) if overview["domain"]["entities"] else "**Entities**: (none)")
    lines.append("")
    lines.append(f"**Business rules**: {overview['domain']['business_rules']}")
    lines.append("")
    lines.append(f"**Features** ({len(overview['features'])}):")
    for f in overview["features"]:
        rt = f" · {f['release_target']}" if f.get("release_target") else ""
        lines.append(f"  - {f['id']:6} [{f['status']:10}] {f['name']}{rt}")
    lines.append("")
    rp = overview.get("release_plan") or {}
    if rp:
        lines.append("**Release plan**:")
        for ver, info in rp.items():
            if isinstance(info, dict):
                shipped = info.get("shipped", False)
                marker = "✅" if shipped is True else ("🛠" if shipped == "partial" else "  ")
                lines.append(f"  {marker} {ver}: {len(info.get('features', []))} features")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def load_spec(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"{path}: top-level must be a mapping")
    return data


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Explain spec.yaml content (Mode E — read-only)")
    parser.add_argument("spec", type=Path)
    parser.add_argument("--feature", default=None)
    parser.add_argument("--entity", default=None)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    if not args.spec.is_file():
        print(f"error: {args.spec} not found", file=sys.stderr)
        return 2

    spec = load_spec(args.spec)

    try:
        if args.feature:
            payload = explain_feature(spec, args.feature)
            kind = "feature"
        elif args.entity:
            payload = explain_entity(spec, args.entity)
            kind = "entity"
        else:
            payload = explain_overview(spec)
            kind = "overview"
    except LookupError as e:
        print(f"error: {e}", file=sys.stderr)
        return 3

    if args.json:
        json.dump({"kind": kind, "data": payload}, sys.stdout, indent=2, ensure_ascii=False)
        print()
    else:
        if kind == "overview":
            sys.stdout.write(format_overview(payload))
        else:
            yaml.safe_dump(payload, sys.stdout, allow_unicode=True, sort_keys=False, default_flow_style=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
