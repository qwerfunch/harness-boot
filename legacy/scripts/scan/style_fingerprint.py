"""F-037 — project-level style fingerprint synthesis.

Reads top-level config files and a small sample of source files. Cached via
``lru_cache`` (per-process) keyed on absolute root path so repeated calls
within one ``work.activate`` are sub-millisecond.
"""

from __future__ import annotations

import json
import re
from collections import Counter

# F-081 — Python <3.11 systems without the `tomli` backport must still be
# able to import this module. _pyproject_has guards against `tomllib is
# None` so the dashboard / kickoff path keeps working in degraded mode
# (no pyproject signals, but no crash).
try:
    import tomllib  # Python 3.11+
except ImportError:
    try:
        import tomli as tomllib  # Python 3.10 backport
    except ImportError:
        tomllib = None  # type: ignore[assignment]
from functools import lru_cache
from pathlib import Path

try:
    from .manifest import extract_tech_stack
    from .structure import scan_structure
except ImportError:
    from legacy.scripts.scan.manifest import extract_tech_stack
    from legacy.scripts.scan.structure import scan_structure


_PY_FUNC_RE = re.compile(r"^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(", re.MULTILINE)
_TS_FUNC_RE = re.compile(
    r"(?:function\s+|const\s+|let\s+)([A-Za-z_][A-Za-z0-9_]*)\s*[=(]",
)

_NAMING_SAMPLE_LIMIT = 32


def fingerprint(project_root: Path) -> dict:
    """Return a style fingerprint dict for ``project_root``.

    Wraps ``_fingerprint_cached`` so callers can pass any ``Path`` flavor.
    The cache key is the resolved absolute path string.
    """
    return _fingerprint_cached(str(Path(project_root).resolve()))


@lru_cache(maxsize=8)
def _fingerprint_cached(root_str: str) -> dict:
    root = Path(root_str)
    if not root.is_dir():
        return {}

    stack = extract_tech_stack(root)
    structure = scan_structure(root)

    fp: dict = {}

    language = stack.get("language") or _infer_language_from_structure(root, structure)
    if language:
        fp["language"] = language

    if stack.get("test"):
        fp["test_runner"] = stack["test"]

    formatter = _detect_formatter(root)
    if formatter:
        fp["formatter"] = formatter

    linter = _detect_linter(root)
    if linter:
        fp["linter"] = linter

    naming = _detect_naming(root, structure, language)
    if naming:
        fp["naming"] = naming

    test_pattern = _detect_test_pattern(root, language)
    if test_pattern:
        fp["test_pattern"] = test_pattern

    config_files = _list_config_files(root)
    if config_files:
        fp["config_files"] = config_files

    return fp


_LANG_BY_EXT = {
    ".py": "python",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".rs": "rust",
    ".go": "go",
}

_IGNORED_DIRS = {
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    "target",
    ".harness",
    ".claude",
    ".pytest_cache",
}


def _infer_language_from_structure(root: Path, structure: dict) -> str | None:
    counts: Counter[str] = Counter()
    for entry in structure.get("entity_candidate_files", [])[:_NAMING_SAMPLE_LIMIT]:
        suffix = Path(entry).suffix
        if suffix in _LANG_BY_EXT:
            counts[suffix] += 1
    if not counts:
        for top in structure.get("top_dirs", []):
            top_path = root / top
            if not top_path.is_dir():
                continue
            local_count = 0
            for path in top_path.rglob("*"):
                if not path.is_file():
                    continue
                if any(part in _IGNORED_DIRS for part in path.parts):
                    continue
                if path.suffix in _LANG_BY_EXT:
                    counts[path.suffix] += 1
                    local_count += 1
                if local_count >= 64:
                    break
    if counts:
        ext = counts.most_common(1)[0][0]
        return _LANG_BY_EXT.get(ext)
    return None


def _detect_formatter(root: Path) -> str | None:
    if _pyproject_has(root, "tool.ruff"):
        return "ruff"
    if (root / ".ruff.toml").is_file() or (root / "ruff.toml").is_file():
        return "ruff"
    if _pyproject_has(root, "tool.black"):
        return "black"
    pkg = _read_package_json(root)
    devdeps = pkg.get("devDependencies", {}) if pkg else {}
    if "prettier" in devdeps:
        return "prettier"
    return None


def _detect_linter(root: Path) -> str | None:
    if _pyproject_has(root, "tool.ruff.lint") or _pyproject_has(root, "tool.ruff"):
        return "ruff"
    if any((root / f).is_file() for f in (".flake8", "setup.cfg")):
        if (root / ".flake8").is_file():
            return "flake8"
    pkg = _read_package_json(root)
    devdeps = pkg.get("devDependencies", {}) if pkg else {}
    if "eslint" in devdeps or any(
        (root / f).is_file()
        for f in (".eslintrc", ".eslintrc.json", ".eslintrc.js", ".eslintrc.cjs", "eslint.config.js")
    ):
        return "eslint"
    return None


def _detect_naming(root: Path, structure: dict, language: str | None) -> dict:
    if language not in ("python", "typescript", "javascript"):
        return {}

    func_pattern = _PY_FUNC_RE if language == "python" else _TS_FUNC_RE
    file_suffix = ".py" if language == "python" else (".ts", ".tsx", ".js", ".jsx")

    samples = _sample_source_paths(root, structure, file_suffix)
    if not samples:
        return {}

    snake = camel = 0
    for source_path in samples:
        try:
            text = source_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for match in func_pattern.findall(text):
            if "_" in match:
                snake += 1
            elif match[:1].islower() and any(c.isupper() for c in match):
                camel += 1
            elif match[:1].islower():
                snake += 1

    file_name_style = _detect_file_naming(samples)

    if snake == 0 and camel == 0:
        functions = None
    else:
        functions = "snake_case" if snake >= camel else "camelCase"

    naming: dict = {}
    if functions:
        naming["functions"] = functions
    if file_name_style:
        naming["files"] = file_name_style
    return naming


def _detect_file_naming(samples: list[Path]) -> str | None:
    snake = kebab = 0
    for path in samples:
        stem = path.stem
        if "-" in stem:
            kebab += 1
        elif "_" in stem or stem.islower():
            snake += 1
    if snake == 0 and kebab == 0:
        return None
    return "snake_case" if snake >= kebab else "kebab-case"


def _sample_source_paths(root: Path, structure: dict, suffix) -> list[Path]:
    if isinstance(suffix, str):
        suffix_set = {suffix}
    else:
        suffix_set = set(suffix)

    out: list[Path] = []
    for entry in structure.get("entity_candidate_files", []):
        path = root / entry
        if path.is_file() and path.suffix in suffix_set:
            out.append(path)
        if len(out) >= _NAMING_SAMPLE_LIMIT:
            return out

    for top in structure.get("top_dirs", []):
        top_path = root / top
        if not top_path.is_dir():
            continue
        for path in sorted(top_path.rglob("*")):
            if not path.is_file():
                continue
            if path.suffix in suffix_set:
                out.append(path)
                if len(out) >= _NAMING_SAMPLE_LIMIT:
                    return out
    return out


def _detect_test_pattern(root: Path, language: str | None) -> str | None:
    candidates = ("tests", "test", "__tests__", "spec")
    for cand in candidates:
        d = root / cand
        if not d.is_dir():
            continue
        suffixes = Counter()
        for path in d.rglob("*"):
            if not path.is_file():
                continue
            name = path.name
            if name.startswith("test_") and name.endswith(".py"):
                suffixes["test_*.py"] += 1
            elif name.endswith(".test.ts") or name.endswith(".test.tsx"):
                suffixes["*.test.ts"] += 1
            elif name.endswith(".spec.ts") or name.endswith(".spec.tsx"):
                suffixes["*.spec.ts"] += 1
            elif name.endswith(".test.js"):
                suffixes["*.test.js"] += 1
        if suffixes:
            return suffixes.most_common(1)[0][0]
    return None


def _list_config_files(root: Path) -> list[str]:
    candidates = (
        "pyproject.toml",
        ".ruff.toml",
        "ruff.toml",
        ".flake8",
        ".eslintrc",
        ".eslintrc.json",
        ".eslintrc.js",
        ".eslintrc.cjs",
        ".prettierrc",
        ".prettierrc.json",
        ".prettierrc.js",
        "tsconfig.json",
        "package.json",
        "Cargo.toml",
        "go.mod",
        "vitest.config.ts",
        "vitest.config.js",
        "jest.config.ts",
        "jest.config.js",
    )
    return [name for name in candidates if (root / name).is_file()]


def _pyproject_has(root: Path, dotted_path: str) -> bool:
    pyproject = root / "pyproject.toml"
    if not pyproject.is_file():
        return False
    if tomllib is None:
        # F-081 — neither tomllib nor tomli installed; degrade gracefully.
        return False
    try:
        data = tomllib.loads(pyproject.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError:
        return False
    cur = data
    for segment in dotted_path.split("."):
        if not isinstance(cur, dict) or segment not in cur:
            return False
        cur = cur[segment]
    return True


def _read_package_json(root: Path) -> dict:
    pkg = root / "package.json"
    if not pkg.is_file():
        return {}
    try:
        data = json.loads(pkg.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}
