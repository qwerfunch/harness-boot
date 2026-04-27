"""F-036 — directory shape + entity-candidate detection."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.scan.structure import scan_structure


FIXTURES = Path(__file__).parent.parent / "fixtures" / "brownfield-repos"


class TestTopDirs(unittest.TestCase):
    def test_node_react_lists_src_only(self) -> None:
        result = scan_structure(FIXTURES / "node-react")
        self.assertEqual(result["top_dirs"], ["src"])

    def test_python_fastapi_lists_src_only(self) -> None:
        result = scan_structure(FIXTURES / "python-fastapi")
        self.assertEqual(result["top_dirs"], ["src"])

    def test_ignored_dirs_excluded(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for noisy in (".git", "node_modules", "__pycache__", ".venv", "dist", "build", ".harness"):
                (root / noisy).mkdir()
            (root / "src").mkdir()
            (root / "tests").mkdir()
            result = scan_structure(root)
            self.assertEqual(sorted(result["top_dirs"]), ["src", "tests"])


class TestADRDetect(unittest.TestCase):
    def test_no_adr_dir(self) -> None:
        result = scan_structure(FIXTURES / "node-react")
        self.assertIsNone(result["adr_dir"])

    def test_docs_adr_dir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "docs" / "adr").mkdir(parents=True)
            result = scan_structure(root)
            self.assertEqual(result["adr_dir"], "docs/adr")

    def test_docs_decisions_dir(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "docs" / "decisions").mkdir(parents=True)
            result = scan_structure(root)
            self.assertEqual(result["adr_dir"], "docs/decisions")


class TestEntityCandidates(unittest.TestCase):
    def test_python_models_py_detected(self) -> None:
        result = scan_structure(FIXTURES / "python-fastapi")
        self.assertTrue(
            any(p.endswith("models.py") for p in result["entity_candidate_files"])
        )

    def test_typescript_entity_files_detected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            src = root / "src"
            src.mkdir()
            (src / "user.entity.ts").write_text("export class User {}\n")
            (src / "order.entity.ts").write_text("export class Order {}\n")
            result = scan_structure(root)
            self.assertEqual(len(result["entity_candidate_files"]), 2)


class TestReadmePath(unittest.TestCase):
    def test_readme_md_detected(self) -> None:
        result = scan_structure(FIXTURES / "node-react")
        self.assertEqual(result["readme_path"], "README.md")

    def test_no_readme(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            result = scan_structure(Path(tmp))
            self.assertIsNone(result["readme_path"])


class TestEmptyRepo(unittest.TestCase):
    def test_empty_repo_returns_empty_collections(self) -> None:
        result = scan_structure(FIXTURES / "empty-repo")
        self.assertEqual(result["top_dirs"], [])
        self.assertEqual(result["entity_candidate_files"], [])
        self.assertIsNone(result["adr_dir"])
        self.assertIsNone(result["readme_path"])


if __name__ == "__main__":
    unittest.main()
