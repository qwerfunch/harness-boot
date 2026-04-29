"""F-037 — style_fingerprint: project-level style synthesis."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.scan.style_fingerprint import fingerprint


REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURES = REPO_ROOT / "tests" / "fixtures" / "brownfield-repos"


class TestFingerprintHarnessRepo(unittest.TestCase):
    """Harness-boot itself: hybrid Python + TypeScript repo (since F-084).

    The TypeScript migration thread (F-084 → F-110+) introduces
    package.json at the repo root, which the manifest detector
    (`scripts/scan/manifest.py:extract_tech_stack`) prioritises over
    the legacy Python signals. Snake_case naming and pytest test
    patterns still dominate today since most source files remain
    Python; the language field flips first because manifest detection
    is the cheapest, most reliable signal.
    """

    def test_naming_functions_snake_case(self) -> None:
        fp = fingerprint(REPO_ROOT)
        self.assertEqual(fp["naming"]["functions"], "snake_case")

    def test_test_pattern_pytest(self) -> None:
        fp = fingerprint(REPO_ROOT)
        self.assertEqual(fp["test_pattern"], "test_*.py")

    def test_language_typescript_after_f084(self) -> None:
        # F-084 added package.json at repo root for the TS migration.
        # The manifest detector now picks typescript over python.
        # Once the migration completes (F-110+), this becomes the
        # permanent state.
        fp = fingerprint(REPO_ROOT)
        self.assertEqual(fp.get("language"), "typescript")


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


class TestTomllibMissingDegradation(unittest.TestCase):
    """F-081 — when tomllib + tomli are both unavailable, `_pyproject_has`
    must return False instead of raising AttributeError on `tomllib.loads`.
    """

    def test_pyproject_signal_silent_when_tomllib_missing(self) -> None:
        from unittest import mock
        from scripts.scan import style_fingerprint as sf

        with mock.patch.object(sf, "tomllib", None):
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                # Real pyproject.toml — the gate is the missing parser,
                # not a missing file.
                (root / "pyproject.toml").write_text(
                    "[tool.ruff]\nline-length = 100\n", encoding="utf-8"
                )
                result = sf._pyproject_has(root, "tool.ruff")
        self.assertFalse(result)

    def test_fingerprint_does_not_raise_when_tomllib_missing(self) -> None:
        """fingerprint() entry point must not raise even when the repo
        carries a pyproject.toml the parser cannot read.
        """
        from unittest import mock
        from scripts.scan import style_fingerprint as sf

        with mock.patch.object(sf, "tomllib", None):
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                (root / "pyproject.toml").write_text(
                    "[tool.ruff]\nline-length = 100\n", encoding="utf-8"
                )
                sf._fingerprint_cached.cache_clear()
                fp = sf.fingerprint(root)
        self.assertIsInstance(fp, dict)


if __name__ == "__main__":
    unittest.main()
