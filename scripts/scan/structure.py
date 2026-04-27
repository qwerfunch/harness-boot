"""F-036 — top-level directory shape + entity-candidate file detection.

Pure read-only walk capped at depth 3 from ``root``. Skips a fixed list of
build / VCS / vendored dirs to keep the LLM input budget bounded.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional


_IGNORED_DIRS = frozenset({
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "env",
    "dist",
    "build",
    "target",
    ".harness",
    ".claude",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".idea",
    ".vscode",
})

_ADR_CANDIDATES = ("docs/adr", "docs/decisions", "adr", "decisions")
_README_CANDIDATES = ("README.md", "README.rst", "README.txt", "readme.md")
_ENTITY_FILE_NAMES = frozenset({"models.py", "schemas.py", "entities.py"})
_ENTITY_DIR_NAMES = frozenset({"models", "schemas", "entities", "domain"})

_MAX_ENTITY_FILES = 24


def scan_structure(root: Path) -> dict:
    """Return a structure summary for ``root``.

    Keys:
        top_dirs (list[str]): immediate subdirectories, sorted, ignoring noise.
        adr_dir (str | None): relative path to a detected ADR directory.
        entity_candidate_files (list[str]): up to 24 relative paths likely to
            contain domain models (capped to bound LLM input).
        readme_path (str | None): relative path to the project README.
    """
    root = Path(root)
    if not root.is_dir():
        return {
            "top_dirs": [],
            "adr_dir": None,
            "entity_candidate_files": [],
            "readme_path": None,
        }

    top_dirs = sorted(
        child.name
        for child in root.iterdir()
        if child.is_dir() and child.name not in _IGNORED_DIRS and not child.name.startswith(".")
    )

    adr_dir = _find_adr_dir(root)
    readme = _find_readme(root)
    entities = _find_entity_candidates(root)

    return {
        "top_dirs": top_dirs,
        "adr_dir": adr_dir,
        "entity_candidate_files": entities,
        "readme_path": readme,
    }


def _find_adr_dir(root: Path) -> Optional[str]:
    for candidate in _ADR_CANDIDATES:
        if (root / candidate).is_dir():
            return candidate
    return None


def _find_readme(root: Path) -> Optional[str]:
    for candidate in _README_CANDIDATES:
        if (root / candidate).is_file():
            return candidate
    return None


def _find_entity_candidates(root: Path) -> list[str]:
    found: list[str] = []
    for path in _walk(root, max_depth=3):
        rel = path.relative_to(root).as_posix()
        if path.is_file():
            if path.name in _ENTITY_FILE_NAMES:
                found.append(rel)
            elif path.suffix == ".ts" and ".entity." in path.name:
                found.append(rel)
        elif path.is_dir() and path.name in _ENTITY_DIR_NAMES:
            for child in sorted(path.rglob("*")):
                if child.is_file() and child.suffix in (".py", ".ts", ".js"):
                    found.append(child.relative_to(root).as_posix())
                if len(found) >= _MAX_ENTITY_FILES:
                    break
        if len(found) >= _MAX_ENTITY_FILES:
            break
    return found[:_MAX_ENTITY_FILES]


def _walk(root: Path, *, max_depth: int):
    stack = [(root, 0)]
    while stack:
        current, depth = stack.pop()
        if depth > max_depth:
            continue
        try:
            children = sorted(current.iterdir())
        except (PermissionError, FileNotFoundError):
            continue
        for child in children:
            if child.name in _IGNORED_DIRS:
                continue
            if child.is_symlink():
                continue
            yield child
            if child.is_dir():
                stack.append((child, depth + 1))
