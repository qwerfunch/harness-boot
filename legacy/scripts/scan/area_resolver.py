"""F-037 — feature.modules[] → AreaRecord cluster.

Pure deterministic mapping. Reuses ``structure`` (passed in) to avoid a
second walk of the project tree.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path


_CLUSTER_DEPTH = 2  # group modules sharing the first N path segments
_SOURCE_EXT_CANDIDATES = (".py", ".ts", ".tsx", ".js", ".jsx", ".rs", ".go", ".md")


@dataclass(frozen=True)
class AreaRecord:
    slug: str
    label: str
    paths: tuple[str, ...]
    modules: tuple[str, ...]
    feature_id: str


def resolve_areas(
    feature: dict,
    *,
    project_root: Path,
    structure: dict,
) -> list[AreaRecord]:
    """Return one AreaRecord per cluster of resolvable modules.

    Mapping rules (deterministic):
        1. dotted/slashed module exact match (file or dir).
        2. fall back to module + common source extension (``.py`` / ``.ts`` etc).
        3. bare-name module → prefix-match against ``structure.entity_candidate_files``
           or ``structure.top_dirs``.
        4. unresolvable → yields a single ``unmapped-*`` area (paths empty).
    """
    raw_modules: list[str] = list(feature.get("modules") or [])
    feature_id = str(feature.get("id") or "")
    if not raw_modules:
        return []

    project_root = Path(project_root)

    resolved: list[tuple[str, str]] = []  # (module, resolved_relative_path)
    unmapped: list[str] = []

    top_dirs = set(structure.get("top_dirs") or [])
    candidate_files = list(structure.get("entity_candidate_files") or [])

    for module in raw_modules:
        path = _try_resolve(module, project_root, top_dirs, candidate_files)
        if path:
            resolved.append((module, path))
        else:
            unmapped.append(module)

    clusters: dict[tuple[str, ...], list[tuple[str, str]]] = {}
    for module, path in resolved:
        key = _cluster_key(path)
        clusters.setdefault(key, []).append((module, path))

    areas: list[AreaRecord] = []
    for key in sorted(clusters):
        items = sorted(clusters[key])
        modules_tuple = tuple(m for m, _ in items)
        paths_tuple = tuple(_dedupe_preserve_order(p for _, p in items))
        label = "/".join(key)
        areas.append(
            AreaRecord(
                slug=_slugify(label),
                label=label,
                paths=paths_tuple,
                modules=modules_tuple,
                feature_id=feature_id,
            )
        )

    for module in sorted(unmapped):
        digest = hashlib.sha1(module.encode("utf-8")).hexdigest()[:8]
        areas.append(
            AreaRecord(
                slug=f"unmapped-{digest}",
                label=f"unmapped:{module}",
                paths=(),
                modules=(module,),
                feature_id=feature_id,
            )
        )

    return areas


def _try_resolve(
    module: str,
    project_root: Path,
    top_dirs: set[str],
    candidate_files: list[str],
) -> str | None:
    if not module:
        return None

    if "/" in module or "." in module and not module.startswith("."):
        candidate = (project_root / module)
        if candidate.is_file():
            return module.replace("\\", "/")
        if candidate.is_dir():
            return module.replace("\\", "/")
        for ext in _SOURCE_EXT_CANDIDATES:
            with_ext = project_root / f"{module}{ext}"
            if with_ext.is_file():
                return f"{module}{ext}".replace("\\", "/")
        if "/" in module:
            parent = module.rsplit("/", 1)[0]
            if (project_root / parent).is_dir():
                return parent.replace("\\", "/")

    bare = module.split("/")[-1]
    for entry in candidate_files:
        if Path(entry).stem == bare:
            return entry
    if bare in top_dirs:
        return bare

    return None


def _cluster_key(rel_path: str) -> tuple[str, ...]:
    segments = tuple(rel_path.split("/")[:_CLUSTER_DEPTH])
    return segments


def _slugify(label: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", label).strip("-").lower()
    return slug or "area"


def _dedupe_preserve_order(values):
    seen: set = set()
    out: list = []
    for value in values:
        if value not in seen:
            seen.add(value)
            out.append(value)
    return out
