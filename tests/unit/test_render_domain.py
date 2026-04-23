"""Tests for scripts/render_domain.py."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import render_domain as rd  # noqa: E402


FIXED_TS = "2026-04-23T05:00:00Z"


class DeterminismTests(unittest.TestCase):
    def test_same_input_same_output(self):
        spec = {"project": {"name": "demo"}, "domain": {"entities": [], "business_rules": []}}
        out1 = rd.render(spec, timestamp=FIXED_TS)
        out2 = rd.render(spec, timestamp=FIXED_TS)
        self.assertEqual(out1, out2)

    def test_ends_with_newline(self):
        spec = {"project": {"name": "demo"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertTrue(out.endswith("\n"))


class HeaderTests(unittest.TestCase):
    def test_project_name_in_header(self):
        spec = {"project": {"name": "my-product"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("# my-product — Domain View", out)

    def test_unnamed_fallback(self):
        spec = {"project": {}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("(unnamed)", out)

    def test_timestamp_included(self):
        spec = {"project": {"name": "x"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn(FIXED_TS, out)


class ProjectSectionTests(unittest.TestCase):
    def test_summary_rendered(self):
        spec = {"project": {"name": "x", "summary": "short one"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("**Summary**: short one", out)

    def test_description_and_vision(self):
        spec = {
            "project": {
                "name": "x",
                "description": "multi\nline\ndesc",
                "vision": "big dream",
            },
            "domain": {},
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("multi", out)
        self.assertIn("line", out)
        self.assertIn("big dream", out)

    def test_empty_project_section_ok(self):
        spec = {"project": {"name": "x"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        # 필수 헤더는 있지만 빈 필드는 행 추가 안 함
        self.assertIn("## Project", out)
        self.assertNotIn("**Summary**:", out)


class EntitiesTests(unittest.TestCase):
    def test_entity_count_in_header(self):
        spec = {
            "project": {"name": "x"},
            "domain": {"entities": [{"name": "A"}, {"name": "B"}]},
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("## Entities (2)", out)

    def test_empty_entities_shows_hint(self):
        spec = {"project": {"name": "x"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("정의된 엔티티 없음", out)

    def test_entity_with_invariants(self):
        spec = {
            "project": {"name": "x"},
            "domain": {
                "entities": [
                    {
                        "name": "User",
                        "description": "계정 주체",
                        "invariants": [
                            "email 은 unique",
                            {"statement": "password 는 hash 저장"},
                        ],
                    }
                ]
            },
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("### User", out)
        self.assertIn("계정 주체", out)
        self.assertIn("**Invariants**:", out)
        self.assertIn("email 은 unique", out)
        self.assertIn("password 는 hash 저장", out)

    def test_entity_with_attributes(self):
        spec = {
            "project": {"name": "x"},
            "domain": {
                "entities": [
                    {
                        "name": "Item",
                        "attributes": [
                            {"name": "sku", "type": "string"},
                            "price",
                        ],
                    }
                ]
            },
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("**Attributes**:", out)
        self.assertIn("`sku`: string", out)
        self.assertIn("`price`", out)

    def test_unnamed_entity_uses_id(self):
        spec = {
            "project": {"name": "x"},
            "domain": {"entities": [{"id": "E-1", "description": "desc"}]},
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("### E-1", out)


class BusinessRulesTests(unittest.TestCase):
    def test_empty_br_shows_hint(self):
        spec = {"project": {"name": "x"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("정의된 BR 없음", out)

    def test_br_with_statement_and_rationale(self):
        spec = {
            "project": {"name": "x"},
            "domain": {
                "business_rules": [
                    {
                        "id": "BR-001",
                        "statement": "완료 선언은 증거 필요",
                        "rationale": "Iron Law",
                    }
                ]
            },
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("### BR-001", out)
        self.assertIn("완료 선언은 증거 필요", out)
        self.assertIn("Iron Law", out)

    def test_br_without_id_auto_numbered(self):
        spec = {
            "project": {"name": "x"},
            "domain": {
                "business_rules": [{"statement": "first rule"}, {"statement": "second"}]
            },
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("### BR-001", out)
        self.assertIn("### BR-002", out)

    def test_string_br_supported(self):
        spec = {
            "project": {"name": "x"},
            "domain": {"business_rules": ["naked string rule"]},
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("naked string rule", out)


class RealSpecSmokeTests(unittest.TestCase):
    SPEC = REPO_ROOT / "docs" / "samples" / "harness-boot-self" / "spec.yaml"

    def setUp(self):
        if not self.SPEC.is_file():
            self.skipTest(f"{self.SPEC} not present")

    def test_renders_without_error(self):
        spec = rd.load_spec(self.SPEC)
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("# harness-boot — Domain View", out)
        self.assertIn("Entities (", out)
        self.assertIn("Business Rules (", out)


if __name__ == "__main__":
    unittest.main()
