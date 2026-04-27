#!/usr/bin/env python3
"""kickoff.py — v0.6 F-N kickoff ceremony template generator.

Generates `.harness/_workspace/kickoff/F-N.md` with per-role headings for
the agents matched by the feature shape. This is a **template only** —
Python cannot fan-out to Claude Code agents directly; orchestrator fills
each heading via prose-contract invocations (routing table in
`commands/work.md` §Orchestration Routing).

Also appends a `kickoff_started` event to `.harness/events.log`.

Usage (library):
    from kickoff import generate_kickoff
    generate_kickoff(harness_dir, feature_id="F-1", shapes=["ui_surface.present"])

Usage (CLI):
    python3 scripts/kickoff.py --harness-dir .harness --feature F-1 \\
        --shape ui_surface.present --shape feature_completion
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore[assignment]


# Mirrors commands/work.md §Orchestration Routing table.
# test_ceremony_routing.py (PR-ε) will assert this map stays in sync.
ROUTING_SHAPES: dict[str, list[str]] = {
    "baseline-empty-vague": ["researcher", "product-planner"],
    "ui_surface.present": [
        "ux-architect",
        "visual-designer",
        "a11y-auditor",
        "frontend-engineer",
        "software-engineer",
    ],
    "sensitive_or_auth": ["security-engineer", "reviewer"],
    "performance_budget": ["performance-engineer"],
    "pure_domain_logic": ["backend-engineer", "software-engineer"],
    "feature_completion": [
        "qa-engineer",
        "integrator",
        "tech-writer",
        "reviewer",
    ],
}


def has_audio(feature: dict) -> bool:
    """Feature → has_audio flag. Reads ui_surface.has_audio, default False."""
    ui = feature.get("ui_surface") or {}
    return bool(ui.get("has_audio"))


def _touches_sensitive_entity(feature: dict, spec: dict) -> bool:
    """True if feature text/modules references a domain.entities[].name with sensitive=true."""
    entities = (spec.get("domain") or {}).get("entities") or []
    sensitive_names: list[str] = []
    for e in entities:
        if isinstance(e, dict) and e.get("sensitive") is True:
            name = e.get("name")
            if isinstance(name, str) and name:
                sensitive_names.append(name.lower())
    if not sensitive_names:
        return False
    parts: list[str] = [feature.get("title") or ""]
    parts.extend(feature.get("modules") or [])
    parts.extend(feature.get("acceptance_criteria") or [])
    haystack = " ".join(p for p in parts if isinstance(p, str)).lower()
    return any(name in haystack for name in sensitive_names)


def detect_shapes(feature: dict, *, spec: dict | None = None) -> list[str]:
    """Feature dict → routing shape list at activate time.

    Heuristic order (v0.7 PR-α):
      * empty title · empty AC · empty modules → ["baseline-empty-vague"] (early discovery)
      * else accumulate: ui_surface.present, performance_budget, sensitive_or_auth
      * if none of the specialist shapes apply → "pure_domain_logic"
      * always append "feature_completion" (qa/integrator/tech-writer/reviewer end chain)

    sensitive_or_auth triggers:
      * feature.sensitive == True
      * any domain.entities[].sensitive=true referenced in title/modules/AC text
    """
    title = (feature.get("title") or "").strip()
    ac = feature.get("acceptance_criteria") or []
    modules = feature.get("modules") or []

    if not title and not ac and not modules:
        return ["baseline-empty-vague"]

    shapes: list[str] = []

    ui = feature.get("ui_surface") or {}
    if ui.get("present") is True:
        shapes.append("ui_surface.present")

    if feature.get("performance_budget"):
        shapes.append("performance_budget")

    if feature.get("sensitive") is True:
        shapes.append("sensitive_or_auth")
    elif spec and _touches_sensitive_entity(feature, spec):
        shapes.append("sensitive_or_auth")

    if not shapes:
        shapes.append("pure_domain_logic")

    shapes.append("feature_completion")
    return shapes


PARALLEL_GROUPS: dict[str, list[tuple[str, ...]]] = {
    # F-039 — single message multi tool use 시 병렬 실행 가능한 에이전트 그룹.
    # security-engineer 와 reviewer 둘 다 read-only 감사 (security 는 BLOCK 권한 보유).
    "sensitive_or_auth": [("security-engineer", "reviewer")],
    # visual-designer 와 audio-designer 둘 다 ux-architect.flows.md 의존 + 출력 파일 분리.
    # has_audio=False 면 helper 가 단원 그룹으로 처리하여 drop.
    "ui_surface.present": [("visual-designer", "audio-designer")],
}


def parallel_groups_for_shapes(
    shapes: Iterable[str],
    *,
    has_audio: bool = False,
) -> list[tuple[str, ...]]:
    """F-039 — collect parallel agent groups for the given shape list.

    Filters out ``audio-designer`` when ``has_audio=False`` and drops any
    group that ends up with fewer than two members. Order is preserved by
    shape iteration order, then by group order within a shape.
    """
    groups: list[tuple[str, ...]] = []
    seen: set[tuple[str, ...]] = set()
    for shape in shapes:
        for group in PARALLEL_GROUPS.get(shape, []):
            members = tuple(
                m for m in group if has_audio or m != "audio-designer"
            )
            if len(members) < 2:
                continue
            if members in seen:
                continue
            seen.add(members)
            groups.append(members)
    return groups


def agents_for_shapes(shapes: Iterable[str], *, has_audio: bool = False) -> list[str]:
    """Resolve shape list → deduped, order-preserved agent list."""
    out: list[str] = []
    seen: set[str] = set()
    for shape in shapes:
        for agent in ROUTING_SHAPES.get(shape, []):
            if agent in seen:
                continue
            seen.add(agent)
            out.append(agent)
        if shape == "ui_surface.present" and has_audio:
            if "audio-designer" not in seen:
                seen.add("audio-designer")
                # Insert audio-designer right after visual-designer per plan §Design Review.
                try:
                    idx = out.index("a11y-auditor")
                    out.insert(idx, "audio-designer")
                except ValueError:
                    out.append("audio-designer")
    return out


def _render_style_block(harness_dir: Path, feature: dict) -> str:
    """F-037 — render '기존 스타일 컨텍스트' section for the kickoff body.

    Reads ``.harness/area_index.yaml`` (written by ``_autowire_fog_clear`` in
    work.py) and matches the feature's ``modules[]`` against each area's
    ``modules[]``. Renders bullets for the overlapping areas and links to
    their chapter files. Returns an empty string when there is no overlap or
    when the index file is absent — the kickoff template emits no section
    in that case (zero diff vs pre-F-037 output).
    """
    if yaml is None:
        return ""
    harness_dir = Path(harness_dir)
    index_path = harness_dir / "area_index.yaml"
    if not index_path.is_file():
        return ""

    try:
        loaded = yaml.safe_load(index_path.read_text(encoding="utf-8"))
    except yaml.YAMLError:
        return ""
    areas = []
    if isinstance(loaded, dict):
        areas = loaded.get("areas") or []

    feature_modules = set(feature.get("modules") or [])
    if not feature_modules:
        return ""

    matched: list[dict] = []
    for entry in areas:
        if not isinstance(entry, dict):
            continue
        entry_modules = set(entry.get("modules") or [])
        if entry_modules & feature_modules:
            matched.append(entry)
    if not matched:
        return ""

    lines: list[str] = []
    lines.append("## 기존 스타일 컨텍스트 (auto · F-037)")
    lines.append("")
    lines.append(
        "> 어둠이 걷힌 영역. 아래 chapter 가 implementer / software-engineer / "
        "frontend-engineer 의 기본 컨텍스트."
    )
    lines.append("")
    lines.append("### 관련 area chapter")
    for entry in matched:
        label = entry.get("label", entry.get("slug", "area"))
        chapter_path = entry.get("chapter_path", "")
        lines.append(f"- [{label}](../../{chapter_path})")
    lines.append("")
    return "\n".join(lines) + "\n"


def _template(
    feature_id: str,
    agents: list[str],
    timestamp: str,
    *,
    mode: str = "product",
    style_block: str = "",
) -> str:
    """Render kickoff.md.

    ``mode == "prototype"`` produces a slim variant: one bullet per agent
    instead of three, with a one-line guidance note instead of the standard
    "80 words / 3 bullets" prompt. Cross-role empathy is preserved at lower
    cost. ``"product"`` (default) is the original full template.
    """
    is_prototype = mode == "prototype"
    bullets_per_agent = 1 if is_prototype else 3
    guidance = (
        "이 agent 의 관점에서 가장 큰 우려 1 줄."
        if is_prototype
        else "이 agent 의 Tier anchor 기반 3-bullet 우려 · 80 단어 이내"
    )
    intro = (
        "프로토타입 모드 — 각 agent 가 1 줄씩만 우려를 적는다."
        if is_prototype
        else "orchestrator 가 각 agent 를 소환해 섹션을 채운다 (80 단어 내 3 bullet). cross-role empathy 용."
    )

    lines: list[str] = []
    lines.append(f"# Kickoff — {feature_id}")
    lines.append("")
    lines.append(f"> 자동 생성 — {timestamp} · mode: `{mode}`")
    lines.append(">")
    lines.append(f"> `scripts/kickoff.py` 가 이 템플릿을 만들고, {intro}")
    lines.append("")
    lines.append(f"## 참여 에이전트 ({len(agents)})")
    lines.append("")
    for a in agents:
        lines.append(f"- `@harness:{a}`")
    lines.append("")
    if style_block:
        lines.append(style_block.rstrip())
        lines.append("")
    lines.append("---")
    lines.append("")
    for agent in agents:
        lines.append(f"## {agent} 의 관점")
        lines.append("")
        lines.append(f"<!-- orchestrator: {guidance} -->")
        lines.append("")
        for _ in range(bullets_per_agent):
            lines.append("- ")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _append_event(harness_dir: Path, event: dict) -> None:
    """Append a single JSON line to events.log. Matches scripts/work.py pattern."""
    log_path = harness_dir / "events.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")


def generate_kickoff(
    harness_dir: Path,
    *,
    feature_id: str,
    shapes: Iterable[str],
    has_audio: bool = False,
    timestamp: str | None = None,
    force: bool = False,
    mode: str = "product",
    style_block: str = "",
) -> Path:
    """Create kickoff template + event. Returns path to the kickoff.md.

    Idempotency (v0.8.2): if the kickoff.md already exists, no file write or
    event emission happens unless ``force=True``. This keeps user-curated
    headings intact when state-mutating work.py calls re-evaluate the ceremony
    condition. The ``--kickoff`` CLI flag on ``scripts/work.py`` passes
    ``force=True`` for explicit re-generation.

    ``mode`` (v0.9.6): when ``"prototype"``, the rendered template uses one
    bullet per agent instead of three. The agent list itself is unchanged so
    the cross-role empathy structure stays intact — only the per-agent depth
    is lightened. Defaults to ``"product"`` for backward compat with direct
    callers and the CLI entry point that does not yet read spec mode.
    """
    if timestamp is None:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    agents = agents_for_shapes(shapes, has_audio=has_audio)
    if not agents:
        raise ValueError(
            f"no agents matched for shapes={list(shapes)}; check ROUTING_SHAPES"
        )

    kickoff_dir = harness_dir / "_workspace" / "kickoff"
    kickoff_dir.mkdir(parents=True, exist_ok=True)
    kickoff_path = kickoff_dir / f"{feature_id}.md"

    # Idempotent skip — preserve user-curated headings unless force=True
    if kickoff_path.is_file() and not force:
        return kickoff_path

    kickoff_path.write_text(
        _template(feature_id, agents, timestamp, mode=mode, style_block=style_block),
        encoding="utf-8",
    )

    _append_event(
        harness_dir,
        {
            "ts": timestamp,
            "type": "kickoff_started",
            "feature": feature_id,
            "shapes": list(shapes),
            "agents": agents,
            "mode": mode,
            "path": str(kickoff_path.relative_to(harness_dir)),
        },
    )

    return kickoff_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate kickoff.md template + events.log entry"
    )
    parser.add_argument(
        "--harness-dir", type=Path, default=Path(".harness")
    )
    parser.add_argument("--feature", required=True, help="F-N id")
    parser.add_argument(
        "--shape",
        action="append",
        required=True,
        help="Routing shape (repeatable)",
    )
    parser.add_argument("--has-audio", action="store_true")
    parser.add_argument("--timestamp", default=None)
    args = parser.parse_args(argv)

    try:
        path = generate_kickoff(
            args.harness_dir,
            feature_id=args.feature,
            shapes=args.shape,
            has_audio=args.has_audio,
            timestamp=args.timestamp,
        )
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    print(str(path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
