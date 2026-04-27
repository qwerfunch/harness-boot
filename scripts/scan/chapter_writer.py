"""F-037 — chapter writer for ``.harness/chapters/area-{slug}.md``.

Writes a deterministic, byte-stable markdown chapter for an ``AreaRecord``.
Preserves user-edit sigil regions across regeneration so user notes survive
the next ``work.activate`` fog-clear.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

try:
    from .area_resolver import AreaRecord
except ImportError:
    from scripts.scan.area_resolver import AreaRecord  # fallback for top-level imports


USER_EDIT_BEGIN = "<!-- harness:user-edit-begin -->"
USER_EDIT_END = "<!-- harness:user-edit-end -->"

_USER_REGION_RE = re.compile(
    re.escape(USER_EDIT_BEGIN) + r".*?" + re.escape(USER_EDIT_END),
    re.DOTALL,
)


def chapter_path_for(harness_dir: Path, slug: str) -> Path:
    return Path(harness_dir) / "chapters" / f"area-{slug}.md"


def write_chapter(
    harness_dir: Path,
    *,
    area: AreaRecord,
    style: dict,
    feature_id: str,
    timestamp: str | None = None,
) -> Path:
    """Render and persist the chapter for ``area``. Returns the file path.

    Idempotency: passing the same area+style+feature_id produces a byte-identical
    file regardless of the wall-clock ``timestamp`` (which lives in the area
    index side file, not in the chapter itself). Preservation: any text inside
    ``USER_EDIT_BEGIN`` / ``USER_EDIT_END`` fences in a previous version is
    appended to the regenerated body.
    """
    del timestamp  # accepted for API symmetry; chapters are timestamp-free
    harness_dir = Path(harness_dir)
    target = chapter_path_for(harness_dir, area.slug)
    target.parent.mkdir(parents=True, exist_ok=True)

    preserved = _extract_user_regions(target)
    body = _render(area=area, style=style, feature_id=feature_id)
    if preserved:
        body = body.rstrip("\n") + "\n\n" + "\n\n".join(preserved) + "\n"

    target.write_text(body, encoding="utf-8")
    return target


def _extract_user_regions(path: Path) -> list[str]:
    if not path.is_file():
        return []
    text = path.read_text(encoding="utf-8")
    return _USER_REGION_RE.findall(text)


def _render(*, area: AreaRecord, style: dict, feature_id: str) -> str:
    fog_state = "clear" if area.paths else "dim"

    lines = [
        "---",
        f"slug: {area.slug}",
        f"label: {area.label}",
        f"first_seen_feature_id: {feature_id}",
        f"fog_state: {fog_state}",
        "_provenance:",
        "  confidence: generated",
        "---",
        "",
        f"# area: {area.label}",
        "",
        "## modules",
        "",
    ]
    if area.modules:
        for module in area.modules:
            lines.append(f"- `{module}`")
    else:
        lines.append("(none)")
    lines.append("")

    lines.append("## paths")
    lines.append("")
    if area.paths:
        for path in area.paths:
            lines.append(f"- `{path}`")
    else:
        lines.append("(unmapped — fog still dim)")
    lines.append("")

    lines.append("## style fingerprint")
    lines.append("")
    lines.extend(_render_style(style))
    lines.append("")

    lines.append("## fog_state")
    lines.append("")
    lines.append(_render_fog_explanation(fog_state))
    lines.append("")

    return "\n".join(lines)


def _render_style(style: dict) -> list[str]:
    if not style:
        return ["(no fingerprint detected)"]
    out: list[str] = []
    for key in ("language", "formatter", "linter", "test_runner", "test_pattern"):
        value = style.get(key)
        if value:
            out.append(f"- {key}: `{value}`")
    naming = style.get("naming") or {}
    if naming:
        for sub in ("functions", "files"):
            if naming.get(sub):
                out.append(f"- naming.{sub}: `{naming[sub]}`")
    config_files = style.get("config_files") or []
    if config_files:
        out.append("- config_files: " + ", ".join(f"`{c}`" for c in config_files))
    return out or ["(no fingerprint detected)"]


def _render_fog_explanation(state: str) -> str:
    return {
        "clear": "이 영역은 정찰 완료 — modules → paths 매핑 + style fingerprint 채워짐.",
        "partial": "일부 modules 만 매핑. 나머지는 다음 activate 에서 다시 시도.",
        "dim": "modules 가 fs 경로로 매핑되지 않음. 사용자가 spec.features[].modules[] 를 정정하거나 새 파일 추가 후 재정찰 필요.",
    }.get(state, state)
