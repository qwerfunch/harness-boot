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
    stakeholders = _get(spec, "project.stakeholders", []) or []

    entities = _get(spec, "domain.entities", []) or []
    business_rules = _get(spec, "domain.business_rules", []) or []
    decisions = _get(spec, "decisions", []) or []
    risks = _get(spec, "risks", []) or []
    tech_stack = _get(spec, "constraints.tech_stack", {}) or {}

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

    # Platform — v0.7.4 additive. Tier 1 design agents (visual-designer · a11y-auditor)
    # 는 architecture.yaml 접근 권한이 없으므로 플랫폼 정보가 domain.md 에 있어야 함.
    if isinstance(tech_stack, dict) and tech_stack:
        lines.append("## Platform")
        lines.append("")
        runtime = tech_stack.get("runtime")
        min_version = tech_stack.get("min_version")
        if runtime:
            runtime_line = f"**Runtime**: {runtime}"
            if min_version:
                runtime_line += f" {min_version}+"
            lines.append(runtime_line)
            lines.append("")
        language = tech_stack.get("language")
        if language:
            lines.append(f"**Language**: {language}")
            lines.append("")
        test = tech_stack.get("test")
        if test:
            lines.append(f"**Test**: {test}")
            lines.append("")
        build = tech_stack.get("build")
        if build:
            lines.append(f"**Build**: {build}")
            lines.append("")
        # Anything else (additionalProperties: true) — dump as a plain list
        known = {"runtime", "min_version", "language", "test", "build"}
        extras = [(k, v) for k, v in tech_stack.items() if k not in known]
        if extras:
            lines.append("**Extra**:")
            for k, v in extras:
                lines.append(f"- {k}: {v}")
            lines.append("")

    # Stakeholders — v0.5 expert agent pool 의 단일 참조점 (domain.md SSoT).
    lines.append(f"## Stakeholders ({len(stakeholders)})")
    lines.append("")
    if not stakeholders:
        lines.append("_(정의된 stakeholder 없음 — `spec.yaml` 의 `project.stakeholders[]` 채우기.)_")
        lines.append("")
    else:
        for sh in stakeholders:
            if not isinstance(sh, dict):
                continue
            role = sh.get("role") or sh.get("id") or "(unnamed)"
            count = sh.get("count")
            heading = f"### {role}"
            if count:
                heading += f" ({count})"
            lines.append(heading)
            lines.append("")
            desc = sh.get("description") or sh.get("interest")
            if desc:
                lines.append(_multiline(desc).rstrip())
                lines.append("")
            for list_key, label in (("concerns", "Concerns"), ("wants", "Wants"), ("needs", "Needs")):
                items = sh.get(list_key)
                if items:
                    lines.append(f"**{label}**:")
                    for item in items:
                        if isinstance(item, dict):
                            lines.append(f"- {item.get('text') or item.get('statement') or str(item)}")
                        else:
                            lines.append(f"- {item}")
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

    # Decisions — v0.6 additive. product-planner 의 plan.md ADR 이 여기로 흘러옴.
    lines.append(f"## Decisions ({len(decisions)})")
    lines.append("")
    if not decisions:
        lines.append("_(정의된 ADR 없음 — `spec.yaml` 의 `decisions[]` 또는 plan.md 를 경유해 채우기.)_")
        lines.append("")
    else:
        for d in decisions:
            if not isinstance(d, dict):
                continue
            adr_id = d.get("id", "ADR-???")
            title = d.get("title", "(untitled)")
            status = d.get("status", "accepted")
            tags = d.get("tags") or []
            tag_str = f" · tags: {', '.join(tags)}" if tags else ""
            lines.append(f"### {adr_id} — {title}")
            lines.append("")
            lines.append(f"**Status**: {status}{tag_str}")
            lines.append("")
            context = d.get("context", "")
            decision = d.get("decision", "")
            consequences = d.get("consequences", "")
            if context:
                lines.append("**Context**:")
                lines.append("")
                lines.append(_multiline(context).rstrip())
                lines.append("")
            if decision:
                lines.append("**Decision**:")
                lines.append("")
                lines.append(_multiline(decision).rstrip())
                lines.append("")
            if consequences:
                lines.append("**Consequences**:")
                lines.append("")
                lines.append(_multiline(consequences).rstrip())
                lines.append("")
            supersedes = d.get("supersedes") or []
            superseded_by = d.get("superseded_by", "")
            if supersedes:
                lines.append(f"**Supersedes**: {', '.join(supersedes)}")
                lines.append("")
            if superseded_by:
                lines.append(f"**Superseded by**: {superseded_by}")
                lines.append("")

    # Risks — v0.6 additive. qa-engineer risk-based testing 의 직접 입력.
    lines.append(f"## Risks ({len(risks)})")
    lines.append("")
    if not risks:
        lines.append("_(정의된 risk 없음 — `spec.yaml` 의 `risks[]` 또는 plan.md 를 경유해 채우기.)_")
        lines.append("")
    else:
        for r in risks:
            if not isinstance(r, dict):
                continue
            risk_id = r.get("id", "R-???")
            statement = r.get("statement", "")
            likelihood = r.get("likelihood", "?")
            impact = r.get("impact", "?")
            mitigation = r.get("mitigation", "")
            status = r.get("status", "open")
            tags = r.get("tags") or []
            tag_str = f" · tags: {', '.join(tags)}" if tags else ""
            lines.append(f"### {risk_id}")
            lines.append("")
            if statement:
                lines.append(f"**Statement**: {statement}")
                lines.append("")
            lines.append(f"**Likelihood × Impact**: {likelihood} × {impact} · status: {status}{tag_str}")
            lines.append("")
            if mitigation:
                lines.append(f"**Mitigation**: {mitigation}")
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
