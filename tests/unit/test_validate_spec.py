"""Tests for scripts/validate_spec.py."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import validate_spec as vs  # noqa: E402


class BasicValidationTests(unittest.TestCase):
    """jsonschema 가 설치돼 있을 때의 기본 동작."""

    def setUp(self) -> None:
        if vs.jsonschema is None:
            self.skipTest("jsonschema not installed")

    def test_valid_spec_passes(self):
        spec = {
            "version": "2.3",
            "project": {"name": "p", "summary": "test"},
            "domain": {"entities": [{"id": "E-1", "name": "E"}], "business_rules": []},
            "features": [
                {
                    "id": "F-0",
                    "type": "skeleton",
                    "title": "s",
                    "priority": "P0",
                    "test_strategy": "lean-tdd",
                    "acceptance_criteria": ["a"],
                    "modules": [],
                }
            ],
        }
        vs.validate(spec)  # 예외 없으면 통과

    def test_missing_required_top_level(self):
        """features 없음."""
        spec = {
            "version": "2.3",
            "project": {"name": "p", "summary": "test"},
            "domain": {"entities": [], "business_rules": []},
        }
        with self.assertRaises(vs.SpecValidationError) as ctx:
            vs.validate(spec)
        self.assertIn("features", ctx.exception.message)

    def test_invalid_version_format(self):
        spec = {
            "version": "not a semver at all!!",
            "project": {"name": "p", "summary": "test"},
            "domain": {"entities": [], "business_rules": []},
            "features": [],
        }
        with self.assertRaises(vs.SpecValidationError) as ctx:
            vs.validate(spec)
        self.assertIn("version", ctx.exception.path)

    def test_error_path_included(self):
        spec = {
            "version": "2.3",
            "project": {"name": "p", "summary": "test"},
            "domain": {"entities": [], "business_rules": []},
            "features": [
                {
                    "id": 123,  # string 이어야 하는데 정수
                    "type": "skeleton",
                    "title": "s",
                    "priority": "P0",
                    "test_strategy": "lean-tdd",
                    "acceptance_criteria": [],
                    "modules": [],
                }
            ],
        }
        with self.assertRaises(vs.SpecValidationError) as ctx:
            vs.validate(spec)
        # path 에 features.0.id 가 포함
        self.assertEqual(ctx.exception.path[:2], ["features", 0])


class RealSpecTests(unittest.TestCase):
    """실제 harness-boot-self spec 검증 — sanity."""

    SPEC = REPO_ROOT / "docs" / "samples" / "harness-boot-self" / "spec.yaml"

    def setUp(self) -> None:
        if vs.jsonschema is None:
            self.skipTest("jsonschema not installed")
        if not self.SPEC.is_file():
            self.skipTest("self spec not present")

    def test_self_spec_valid(self):
        spec = vs.load_spec(self.SPEC)
        vs.validate(spec)  # 예외 없으면 OK


class SchemaNotFoundTests(unittest.TestCase):
    def setUp(self) -> None:
        if vs.jsonschema is None:
            self.skipTest("jsonschema not installed")

    def test_missing_schema_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            fake_schema = Path(tmp) / "nonexistent.json"
            with self.assertRaises(vs.SpecValidationError) as ctx:
                vs.validate({}, schema_path=fake_schema)
            self.assertIn("스키마 파일 없음", ctx.exception.message)


class OptionalJsonschemaTests(unittest.TestCase):
    """jsonschema 미설치 환경에서도 정상 동작 — 경고만."""

    def test_missing_jsonschema_is_noop(self):
        """module 을 임시로 None 으로 가려보면 — silently no-op."""
        original = vs.jsonschema
        try:
            vs.jsonschema = None
            vs.validate({"anything": "invalid"})  # 예외 안 뜸
        finally:
            vs.jsonschema = original


class LoadSpecTests(unittest.TestCase):
    def test_non_dict_top_level(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "bad.yaml"
            p.write_text("- just\n- a\n- list", encoding="utf-8")
            with self.assertRaises(vs.SpecValidationError) as ctx:
                vs.load_spec(p)
            self.assertIn("top-level", ctx.exception.message)


if __name__ == "__main__":
    unittest.main()
