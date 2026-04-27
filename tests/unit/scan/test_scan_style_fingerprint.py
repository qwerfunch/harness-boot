"""F-037 — style_fingerprint: project-level style synthesis."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.scan.style_fingerprint import fingerprint


REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURES = REPO_ROOT / "tests" / "fixtures" / "brownfield-repos"


class TestFingerprintHarnessRepo(unittest.TestCase):
    """Harness-boot itself: pyproject-less, snake_case, pytest pattern."""

    def test_naming_functions_snake_case(self) -> None:
        fp = fingerprint(REPO_ROOT)
        self.assertEqual(fp["naming"]["functions"], "snake_case")

    def test_test_pattern_pytest(self) -> None:
        fp = fingerprint(REPO_ROOT)
        self.assertEqual(fp["test_pattern"], "test_*.py")

    def test_language_python(self) -> None:
        fp = fingerprint(REPO_ROOT)
        self.assertEqual(fp.get("language"), "python")


class TestFingerprintNodeReact(unittest.TestCase):
    def setUp(self) -> None:
        self.root = FIXTURES / "node-react"

    def test_language_typescript(self) -> None:
        fp = fingerprint(self.root)
        self.assertEqual(fp["language"], "typescript")

    def test_test_runner_vitest(self) -> None:
        fp = fingerprint(self.root)
        self.assertIn("vitest", fp.get("config_files", []) + [fp.get("test_runner", "")])


class TestFingerprintRuffPyproject(unittest.TestCase):
    def test_formatter_ruff_when_pyproject_has_tool_ruff(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "pyproject.toml").write_text(
                """[project]
name = "demo"
version = "0.1.0"

[tool.ruff]
line-length = 100

[tool.ruff.lint]
select = ["E"]
""",
                encoding="utf-8",
            )
            fp = fingerprint(root)
            self.assertEqual(fp["formatter"], "ruff")
            self.assertEqual(fp["linter"], "ruff")


class TestFingerprintLruCache(unittest.TestCase):
    def test_cached_returns_same_object(self) -> None:
        a = fingerprint(REPO_ROOT)
        b = fingerprint(REPO_ROOT)
        self.assertIs(a, b)


class TestFingerprintEmpty(unittest.TestCase):
    def test_empty_repo_returns_minimal_dict(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            fp = fingerprint(Path(tmp))
        self.assertIsInstance(fp, dict)
        self.assertNotIn("formatter", fp)


if __name__ == "__main__":
    unittest.main()
