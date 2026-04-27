"""F-036 — brownfield adapter contract tests."""

from __future__ import annotations

import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SKILL_DIR = REPO_ROOT / "skills" / "spec-conversion"


class TestBrownfieldAdapter(unittest.TestCase):
    def test_adapter_file_exists(self) -> None:
        self.assertTrue((SKILL_DIR / "adapters" / "brownfield.md").is_file())

    def test_skill_md_lists_brownfield_in_adapter_table(self) -> None:
        text = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("adapters/brownfield.md", text)

    def test_skill_md_trigger_lists_existing_code(self) -> None:
        text = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("existing_code", text)

    def test_adapter_has_required_sections(self) -> None:
        text = (SKILL_DIR / "adapters" / "brownfield.md").read_text(encoding="utf-8")
        for header in (
            "## 1. 도메인 시그널",
            "## 2. 결정론 정찰",
            "## 3. LLM 정찰 책임",
            "## 4. 매핑 휴리스틱",
            "## 5. 함정",
            "## 6. Draft 마커 규약",
        ):
            self.assertIn(header, text, msg=f"missing section: {header}")

    def test_adapter_references_seed_spec_module(self) -> None:
        text = (SKILL_DIR / "adapters" / "brownfield.md").read_text(encoding="utf-8")
        self.assertIn("scripts/scan/seed_spec", text)


if __name__ == "__main__":
    unittest.main()
