"""F-036 — deterministic manifest reconnaissance.

Tests for `scripts.scan.manifest` — extracts tech_stack and project name
from package.json / pyproject.toml / Cargo.toml / go.mod manifests.
"""

from __future__ import annotations

import unittest
from pathlib import Path

from scripts.scan.manifest import extract_project_name, extract_tech_stack


FIXTURES = Path(__file__).parent.parent.parent / "fixtures" / "brownfield-repos"


class TestExtractTechStackNode(unittest.TestCase):
    def setUp(self) -> None:
        self.root = FIXTURES / "node-react"

    def test_runtime_is_node(self) -> None:
        stack = extract_tech_stack(self.root)
        self.assertEqual(stack["runtime"], "node")

    def test_language_is_typescript_when_devdep_present(self) -> None:
        stack = extract_tech_stack(self.root)
        self.assertEqual(stack["language"], "typescript")

    def test_test_runner_detected_vitest(self) -> None:
        stack = extract_tech_stack(self.root)
        self.assertEqual(stack["test"], "vitest")

    def test_min_version_from_engines(self) -> None:
        stack = extract_tech_stack(self.root)
        self.assertIn("min_version", stack)
        self.assertIn("20", stack["min_version"])


class TestExtractTechStackPython(unittest.TestCase):
    def setUp(self) -> None:
        self.root = FIXTURES / "python-fastapi"

    def test_runtime_is_python(self) -> None:
        stack = extract_tech_stack(self.root)
        self.assertEqual(stack["runtime"], "python")

    def test_language_is_python(self) -> None:
        stack = extract_tech_stack(self.root)
        self.assertEqual(stack["language"], "python")

    def test_test_runner_detected_pytest(self) -> None:
        stack = extract_tech_stack(self.root)
        self.assertEqual(stack["test"], "pytest")

    def test_min_version_from_requires_python(self) -> None:
        stack = extract_tech_stack(self.root)
        self.assertIn("min_version", stack)
        self.assertIn("3.11", stack["min_version"])


class TestExtractTechStackRust(unittest.TestCase):
    def setUp(self) -> None:
        self.root = FIXTURES / "rust-cli"

    def test_runtime_is_rust(self) -> None:
        stack = extract_tech_stack(self.root)
        self.assertEqual(stack["runtime"], "rust")

    def test_language_is_rust(self) -> None:
        stack = extract_tech_stack(self.root)
        self.assertEqual(stack["language"], "rust")

    def test_test_runner_default_cargo(self) -> None:
        stack = extract_tech_stack(self.root)
        self.assertEqual(stack["test"], "cargo")

    def test_min_version_from_rust_version_field(self) -> None:
        stack = extract_tech_stack(self.root)
        self.assertEqual(stack["min_version"], "1.75")


class TestExtractTechStackEmpty(unittest.TestCase):
    def test_empty_repo_returns_empty_stack(self) -> None:
        root = FIXTURES / "empty-repo"
        stack = extract_tech_stack(root)
        self.assertEqual(stack, {})


class TestExtractProjectName(unittest.TestCase):
    def test_package_json_name_wins(self) -> None:
        root = FIXTURES / "node-react"
        self.assertEqual(extract_project_name(root), "sample-todo-app")

    def test_pyproject_toml_name(self) -> None:
        root = FIXTURES / "python-fastapi"
        self.assertEqual(extract_project_name(root), "sample-api")

    def test_cargo_toml_name(self) -> None:
        root = FIXTURES / "rust-cli"
        self.assertEqual(extract_project_name(root), "sample-cli")

    def test_basename_fallback_when_no_manifest(self) -> None:
        root = FIXTURES / "empty-repo"
        self.assertEqual(extract_project_name(root), "empty-repo")


if __name__ == "__main__":
    unittest.main()
