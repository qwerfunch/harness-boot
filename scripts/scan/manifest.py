"""F-036 — deterministic tech_stack and project-name extraction.

Reads package.json / pyproject.toml / Cargo.toml / go.mod when present and
returns a normalized dict keyed by ``runtime`` / ``language`` / ``test`` /
``build`` / ``min_version``.

Pure functions, no I/O outside of reading the listed manifest files.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional

try:
    import tomllib  # Python 3.11+
except ImportError:
    import tomli as tomllib  # Python 3.10 backport


_NODE_TEST_PRIORITY = ("vitest", "jest", "mocha", "ava", "node:test")


def extract_tech_stack(root: Path) -> dict:
    """Return a tech_stack dict for the most prominent manifest under ``root``.

    Detection order: package.json > pyproject.toml > Cargo.toml > go.mod.
    Returns an empty dict when no recognized manifest is present.
    """
    root = Path(root)
    if (root / "package.json").is_file():
        return _detect_node(root)
    if (root / "pyproject.toml").is_file():
        return _detect_python(root)
    if (root / "Cargo.toml").is_file():
        return _detect_rust(root)
    if (root / "go.mod").is_file():
        return _detect_go(root)
    return {}


def extract_project_name(root: Path) -> Optional[str]:
    """Return the declared project name, falling back to the directory basename.

    Priority: package.json:.name > pyproject.toml:[project].name >
    Cargo.toml:[package].name > go.mod module path tail > directory basename.
    Returns ``None`` only if the directory does not exist.
    """
    root = Path(root)
    if not root.exists():
        return None

    pkg = root / "package.json"
    if pkg.is_file():
        try:
            data = json.loads(pkg.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
        if isinstance(data.get("name"), str) and data["name"]:
            return data["name"]

    pyproj = root / "pyproject.toml"
    if pyproj.is_file():
        try:
            data = tomllib.loads(pyproj.read_text(encoding="utf-8"))
        except tomllib.TOMLDecodeError:
            data = {}
        name = data.get("project", {}).get("name")
        if isinstance(name, str) and name:
            return name

    cargo = root / "Cargo.toml"
    if cargo.is_file():
        try:
            data = tomllib.loads(cargo.read_text(encoding="utf-8"))
        except tomllib.TOMLDecodeError:
            data = {}
        name = data.get("package", {}).get("name")
        if isinstance(name, str) and name:
            return name

    gomod = root / "go.mod"
    if gomod.is_file():
        match = re.search(r"^module\s+(\S+)", gomod.read_text(encoding="utf-8"), re.MULTILINE)
        if match:
            return match.group(1).rsplit("/", 1)[-1]

    return root.name


def _detect_node(root: Path) -> dict:
    try:
        data = json.loads((root / "package.json").read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

    deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}

    has_typescript = "typescript" in deps or (root / "tsconfig.json").is_file()
    language = "typescript" if has_typescript else "javascript"

    test_runner = next((name for name in _NODE_TEST_PRIORITY if name in deps), "")

    build = ""
    if "vite" in deps or any((root / f).is_file() for f in ("vite.config.ts", "vite.config.js")):
        build = "vite"
    elif "webpack" in deps or any((root / f).is_file() for f in ("webpack.config.ts", "webpack.config.js")):
        build = "webpack"
    elif "esbuild" in deps:
        build = "esbuild"

    engines_node = data.get("engines", {}).get("node", "")
    min_version = engines_node.lstrip(">=^~ ") if isinstance(engines_node, str) else ""

    stack = {
        "runtime": "node",
        "language": language,
    }
    if test_runner:
        stack["test"] = test_runner
    if build:
        stack["build"] = build
    if min_version:
        stack["min_version"] = min_version
    return stack


def _detect_python(root: Path) -> dict:
    try:
        data = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError:
        return {}

    project = data.get("project", {})
    deps_blob: list[str] = list(project.get("dependencies", []))
    optional = project.get("optional-dependencies", {})
    if isinstance(optional, dict):
        for group in optional.values():
            if isinstance(group, list):
                deps_blob.extend(group)
    extras = data.get("dependency-groups", {})
    if isinstance(extras, dict):
        for group in extras.values():
            if isinstance(group, list):
                deps_blob.extend(group)

    has_pytest = any("pytest" in dep for dep in deps_blob) or "pytest" in data.get("tool", {})
    test_runner = "pytest" if has_pytest else ""

    build_backend = data.get("build-system", {}).get("build-backend", "")
    build = ""
    if "setuptools" in build_backend:
        build = "setuptools"
    elif "poetry" in build_backend:
        build = "poetry"
    elif "hatchling" in build_backend:
        build = "hatch"
    elif "flit" in build_backend:
        build = "flit"

    requires_python = project.get("requires-python", "")
    min_version = requires_python.lstrip(">=^~ ") if isinstance(requires_python, str) else ""

    stack = {
        "runtime": "python",
        "language": "python",
    }
    if test_runner:
        stack["test"] = test_runner
    if build:
        stack["build"] = build
    if min_version:
        stack["min_version"] = min_version
    return stack


def _detect_rust(root: Path) -> dict:
    try:
        data = tomllib.loads((root / "Cargo.toml").read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError:
        return {}

    package = data.get("package", {})
    rust_version = package.get("rust-version", "")

    stack = {
        "runtime": "rust",
        "language": "rust",
        "test": "cargo",
        "build": "cargo",
    }
    if isinstance(rust_version, str) and rust_version:
        stack["min_version"] = rust_version
    return stack


def _detect_go(root: Path) -> dict:
    text = (root / "go.mod").read_text(encoding="utf-8")
    match = re.search(r"^go\s+(\S+)", text, re.MULTILINE)
    min_version = match.group(1) if match else ""

    stack = {
        "runtime": "go",
        "language": "go",
        "test": "go",
        "build": "go",
    }
    if min_version:
        stack["min_version"] = min_version
    return stack
