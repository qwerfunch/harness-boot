"""v0.6 PR-α — schema additive 검증.

spec.schema.json 에 추가된 5 신규 영역:
- top-level `decisions[]` + items.supersedes/superseded_by
- top-level `risks[]`
- features[].performance_budget
- constraints.tech_stack 구조화
- state.yaml.features[].skipped_agents[] (state 는 별도 파일 없으므로 state.py helper 에서 검증)

Why: v0.5.1 에서 deferred 된 스키마 확장 + v0.6 ceremony 에 필요한 구조.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO_ROOT / "docs" / "schemas" / "spec.schema.json"


def _load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


class SchemaParseTests(unittest.TestCase):
    def test_schema_is_valid_json(self):
        schema = _load_schema()
        self.assertIsInstance(schema, dict)
        self.assertIn("$schema", schema)
        self.assertIn("properties", schema)


class DecisionsArrayTests(unittest.TestCase):
    """v0.6 decisions[] additive — ADR 카탈로그."""

    def setUp(self):
        self.schema = _load_schema()

    def test_decisions_is_top_level_array(self):
        self.assertIn("decisions", self.schema["properties"])
        self.assertEqual(self.schema["properties"]["decisions"]["type"], "array")

    def test_decision_item_requires_id_title_decision(self):
        item = self.schema["properties"]["decisions"]["items"]
        self.assertEqual(set(item["required"]), {"id", "title", "decision"})

    def test_decision_id_pattern(self):
        item = self.schema["properties"]["decisions"]["items"]
        self.assertEqual(item["properties"]["id"]["pattern"], r"^ADR-\d+$")

    def test_decision_status_enum(self):
        item = self.schema["properties"]["decisions"]["items"]
        status = item["properties"]["status"]
        self.assertEqual(
            set(status["enum"]),
            {"proposed", "accepted", "deprecated", "superseded"},
        )

    def test_decision_supersedes_and_superseded_by(self):
        """v0.6 — ADR 대체 관계 양방향 연결."""
        item = self.schema["properties"]["decisions"]["items"]
        self.assertIn("supersedes", item["properties"])
        self.assertEqual(item["properties"]["supersedes"]["type"], "array")
        self.assertIn("superseded_by", item["properties"])
        self.assertEqual(item["properties"]["superseded_by"]["type"], "string")

    def test_decision_tags_is_array_of_strings(self):
        item = self.schema["properties"]["decisions"]["items"]
        tags = item["properties"]["tags"]
        self.assertEqual(tags["type"], "array")
        self.assertEqual(tags["items"]["type"], "string")


class RisksArrayTests(unittest.TestCase):
    """v0.6 risks[] additive — qa 의 risk-based testing 입력."""

    def setUp(self):
        self.schema = _load_schema()

    def test_risks_is_top_level_array(self):
        self.assertIn("risks", self.schema["properties"])
        self.assertEqual(self.schema["properties"]["risks"]["type"], "array")

    def test_risk_required_fields(self):
        item = self.schema["properties"]["risks"]["items"]
        self.assertEqual(
            set(item["required"]), {"id", "statement", "likelihood", "impact"}
        )

    def test_risk_likelihood_impact_enum(self):
        item = self.schema["properties"]["risks"]["items"]
        self.assertEqual(
            set(item["properties"]["likelihood"]["enum"]),
            {"low", "medium", "high"},
        )
        self.assertEqual(
            set(item["properties"]["impact"]["enum"]),
            {"low", "medium", "high"},
        )

    def test_risk_status_enum(self):
        item = self.schema["properties"]["risks"]["items"]
        self.assertEqual(
            set(item["properties"]["status"]["enum"]),
            {"open", "mitigated", "materialized", "closed"},
        )


class PerformanceBudgetTests(unittest.TestCase):
    """v0.6 features[].performance_budget — performance-engineer routing key."""

    def setUp(self):
        self.schema = _load_schema()
        features = self.schema["properties"]["features"]
        self.feature_props = features["items"]["properties"]

    def test_performance_budget_exists_on_feature(self):
        self.assertIn("performance_budget", self.feature_props)
        self.assertEqual(self.feature_props["performance_budget"]["type"], "object")

    def test_web_vitals_fields(self):
        props = self.feature_props["performance_budget"]["properties"]
        for field in ("lcp_ms", "inp_ms", "cls", "bundle_kb"):
            self.assertIn(field, props, f"missing perf budget: {field}")

    def test_backend_budget_fields(self):
        props = self.feature_props["performance_budget"]["properties"]
        for field in ("latency_p95_ms", "memory_rss_mb"):
            self.assertIn(field, props, f"missing backend budget: {field}")

    def test_custom_array_schema(self):
        custom = self.feature_props["performance_budget"]["properties"]["custom"]
        self.assertEqual(custom["type"], "array")
        self.assertEqual(
            set(custom["items"]["required"]), {"metric", "budget"}
        )


class ConstraintsTechStackTests(unittest.TestCase):
    """v0.6 constraints.tech_stack 구조화 (이전 free-form object 에서 properties 도입)."""

    def setUp(self):
        self.schema = _load_schema()
        self.constraints = self.schema["properties"]["constraints"]

    def test_constraints_is_structured_object(self):
        self.assertEqual(self.constraints["type"], "object")
        self.assertIn("properties", self.constraints)
        self.assertIn("tech_stack", self.constraints["properties"])

    def test_tech_stack_has_runtime_language_test_build(self):
        stack = self.constraints["properties"]["tech_stack"]
        for field in ("runtime", "min_version", "language", "test", "build"):
            self.assertIn(field, stack["properties"], f"missing: {field}")

    def test_constraints_still_permits_additional(self):
        """스키마 backwards-compat — 기존 free-form 사용자 spec 도 허용."""
        self.assertTrue(self.constraints.get("additionalProperties", False))


class BackwardCompatTests(unittest.TestCase):
    """추가 필드가 **전부 optional** — 기존 v0.5 spec 이 여전히 validate."""

    def test_decisions_not_in_top_required(self):
        schema = _load_schema()
        self.assertNotIn("decisions", schema.get("required", []))

    def test_risks_not_in_top_required(self):
        schema = _load_schema()
        self.assertNotIn("risks", schema.get("required", []))

    def test_feature_item_does_not_require_performance_budget(self):
        schema = _load_schema()
        feature_item = schema["properties"]["features"]["items"]
        self.assertNotIn("performance_budget", feature_item.get("required", []))

    def test_tech_stack_not_required(self):
        schema = _load_schema()
        constraints = schema["properties"]["constraints"]
        self.assertNotIn("tech_stack", constraints.get("required", []))


class ExistingSpecsStillValidateTests(unittest.TestCase):
    """self-spec · .harness/spec.yaml · starter template 이 v0.6 schema 에 여전히 valid."""

    def _validate(self, spec_path: Path) -> None:
        try:
            import yaml
        except ImportError:
            self.skipTest("pyyaml not available")
        try:
            import jsonschema  # type: ignore  # noqa: F401
        except ImportError:
            self.skipTest("jsonschema not installed — skip structural validation")

        import jsonschema  # type: ignore

        data = yaml.safe_load(spec_path.read_text(encoding="utf-8"))
        schema = _load_schema()
        jsonschema.validate(data, schema)  # raises on failure

    def test_self_spec_still_validates(self):
        self._validate(REPO_ROOT / "docs" / "samples" / "harness-boot-self" / "spec.yaml")

    def test_harness_spec_still_validates(self):
        self._validate(REPO_ROOT / ".harness" / "spec.yaml")


if __name__ == "__main__":
    unittest.main()
