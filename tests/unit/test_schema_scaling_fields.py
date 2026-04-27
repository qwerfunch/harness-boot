"""F-029 — features[] additive scaling fields (area · archived_at · archive_reason · digest · include_path).

All five fields are optional and additive — must not break existing
specs that don't carry them, must validate when present, and must
reject malformed values.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

import jsonschema


REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO_ROOT / "docs" / "schemas" / "spec.schema.json"


def _load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def _minimal_spec(extra_feature: dict | None = None) -> dict:
    skeleton = {"id": "F-001", "type": "skeleton"}
    feat = {"id": "F-002", "type": "feature"}
    if extra_feature:
        feat.update(extra_feature)
    return {
        "version": "2.3.8",
        "project": {"name": "test", "summary": "minimal"},
        "domain": {"overview": "stub"},
        "features": [skeleton, feat],
    }


class ScalingFieldsSchemaTests(unittest.TestCase):
    """AC-1: 5 fields registered in features.items.properties."""

    EXPECTED = ("area", "archived_at", "archive_reason", "digest", "include_path")

    def setUp(self):
        self.schema = _load_schema()
        self.feature_props = self.schema["properties"]["features"]["items"]["properties"]

    def test_all_fields_registered(self):
        for field in self.EXPECTED:
            self.assertIn(field, self.feature_props, f"missing schema property: {field}")

    def test_area_is_string(self):
        self.assertEqual(self.feature_props["area"]["type"], "string")

    def test_archived_at_is_date_time_string(self):
        self.assertEqual(self.feature_props["archived_at"]["type"], "string")
        self.assertEqual(self.feature_props["archived_at"]["format"], "date-time")

    def test_archive_reason_is_string(self):
        self.assertEqual(self.feature_props["archive_reason"]["type"], "string")

    def test_digest_is_string(self):
        self.assertEqual(self.feature_props["digest"]["type"], "string")

    def test_include_path_is_string(self):
        self.assertEqual(self.feature_props["include_path"]["type"], "string")


class ScalingFieldsValidationTests(unittest.TestCase):
    """AC-2: validate passes with/without new fields, rejects malformed."""

    def setUp(self):
        self.schema = _load_schema()

    def _validate(self, spec: dict) -> None:
        jsonschema.validate(spec, self.schema)

    def test_spec_without_new_fields_validates(self):
        self._validate(_minimal_spec())

    def test_spec_with_all_fields_validates(self):
        self._validate(
            _minimal_spec(
                {
                    "area": "auth",
                    "archived_at": "2026-04-27T00:00:00Z",
                    "archive_reason": "feature complete · 6mo unreferenced",
                    "digest": "JWT login flow with refresh token rotation",
                    "include_path": "spec/features/auth/F-002.yaml",
                }
            )
        )

    def test_partial_fields_validate(self):
        # area + digest only (sharding not yet active)
        self._validate(_minimal_spec({"area": "billing", "digest": "Stripe checkout"}))

    def test_archived_at_must_be_string_not_int(self):
        with self.assertRaises(jsonschema.ValidationError):
            self._validate(_minimal_spec({"archived_at": 12345}))

    def test_area_must_be_string_not_array(self):
        with self.assertRaises(jsonschema.ValidationError):
            self._validate(_minimal_spec({"area": ["auth", "billing"]}))


if __name__ == "__main__":
    unittest.main()
