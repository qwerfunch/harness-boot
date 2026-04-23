#!/usr/bin/env python3
"""
render_domain.py — spec → domain.md 렌더러 (F-003 §0.4)

사용:
  python3 scripts/render_domain.py <spec.yaml>                # stdout
  python3 scripts/render_domain.py <spec.yaml> -o domain.md   # write

규칙:
  - 입력: 이미 $include 전개된 spec (include_expander 로 preprocess 권장).
  - 출력: `.harness/domain.md` 에 쓸 markdown 한 페이지.
  - 구성: 1) 헤더 + 생성 시각, 2) Project 섹션, 3) Entities, 4) Business Rules.
  - 렌더러는 **순서 결정론적** — 같은 입력 → 같은 바이트. (edit-wins 감지 안정성)

외부 의존: pyyaml.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("pyyaml is required", file=sys.stderr)
    sys.exit(1)


def _get(d: Any, path: str, default: Any = None) -> Any:
    """점 경로로 중첩 dict 값 조회. 중간 키 없으면 default."""
    cur = d
    for part in path.split("."):
        if isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return default
        if cur is None:
            return default
    return cur


def _multiline(text: str | None, prefix: str = "") -> str:
    """단락/여러 줄을 안전하게 렌더 (None/빈 문자열 → 빈 문자열)."""
    if not text:
        return ""
    lines = [prefix + line if line else "" for line in text.splitlines()]
    return "\n".join(lines) + "\n"


def render(spec: dict, *, timestamp: str | None = None) -> str:
    """spec dict → domain.md 문자열.

    timestamp 는 테스트 결정론성을 위해 주입 가능. None 이면 now(UTC).
    """
    if timestamp is None:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    project_name = _get(spec, "project.name", "(unnamed)")
    project_summary = _get(spec, "project.summary", "")
    project_description = _get(spec, "project.description", "")
    project_vision = _get(spec, "project.vision", "")

    entities = _get(spec, "domain.entities", []) or []
    business_rules = _get(spec, "domain.business_rules", []) or []

    lines: list[str] = []

    # 헤더
    lines.append(f"# {project_name} — Domain View")
    lines.append("")
    lines.append(f"> 자동 생성 — {timestamp}")
    lines.append(">")
    lines.append("> 이 파일은 `/harness:sync` 가 `spec.yaml` 에서 파생. 직접 편집 시 edit-wins 보호.")
    lines.append("")

    # Project
    lines.append("## Project")
    lines.append("")
    if project_summary:
        lines.append(f"**Summary**: {project_summary}")
        lines.append("")
    if project_description:
        lines.append("**Description**:")
        lines.append("")
        lines.append(_multiline(project_description).rstrip())
        lines.append("")
    if project_vision:
        lines.append("**Vision**:")
        lines.append("")
        lines.append(_multiline(project_vision).rstrip())
        lines.append("")

    # Entities
    lines.append(f"## Entities ({len(entities)})")
    lines.append("")
    if not entities:
        lines.append("_(정의된 엔티티 없음 — `spec.yaml` 의 `domain.entities[]` 채우기.)_")
        lines.append("")
    else:
        for ent in entities:
            if not isinstance(ent, dict):
                continue
            ent_name = ent.get("name") or ent.get("id") or "(unnamed)"
            ent_desc = ent.get("description") or ent.get("summary")
            invariants = ent.get("invariants") or []
            attrs = ent.get("attributes") or ent.get("fields") or []

            lines.append(f"### {ent_name}")
            lines.append("")
            if ent_desc:
                lines.append(_multiline(ent_desc).rstrip())
                lines.append("")
            if attrs:
                lines.append("**Attributes**:")
                for a in attrs:
                    if isinstance(a, dict):
                        a_name = a.get("name", "?")
                        a_type = a.get("type", "?")
                        lines.append(f"- `{a_name}`: {a_type}")
                    else:
                        lines.append(f"- `{a}`")
                lines.append("")
            if invariants:
                lines.append("**Invariants**:")
                for inv in invariants:
                    if isinstance(inv, dict):
                        lines.append(f"- {inv.get('statement', str(inv))}")
                    else:
                        lines.append(f"- {inv}")
                lines.append("")

    # Business Rules
    lines.append(f"## Business Rules ({len(business_rules)})")
    lines.append("")
    if not business_rules:
        lines.append("_(정의된 BR 없음 — `spec.yaml` 의 `domain.business_rules[]` 채우기.)_")
        lines.append("")
    else:
        for i, br in enumerate(business_rules, 1):
            if isinstance(br, dict):
                br_id = br.get("id", f"BR-{i:03d}")
                statement = br.get("statement") or br.get("name", "")
                rationale = br.get("rationale", "")
                lines.append(f"### {br_id}")
                lines.append("")
                if statement:
                    lines.append(f"**Statement**: {statement}")
                    lines.append("")
                if rationale:
                    lines.append(f"**Rationale**: {rationale}")
                    lines.append("")
            else:
                lines.append(f"- BR-{i:03d}: {br}")
                lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def load_spec(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"{path}: top-level YAML must be a mapping")
    return data


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Render spec.yaml → domain.md")
    parser.add_argument("spec", type=Path)
    parser.add_argument("-o", "--output", type=Path, default=None)
    parser.add_argument(
        "--timestamp", default=None, help="override generation timestamp (for tests)"
    )
    args = parser.parse_args(argv)

    if not args.spec.is_file():
        print(f"error: {args.spec} not found", file=sys.stderr)
        return 2

    spec = load_spec(args.spec)
    output = render(spec, timestamp=args.timestamp)

    if args.output:
        args.output.write_text(output, encoding="utf-8")
        print(f"wrote {args.output}")
    else:
        sys.stdout.write(output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
