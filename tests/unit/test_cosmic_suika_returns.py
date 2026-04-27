"""F-032 — cosmic-suika ISSUES-LOG 환원 검증 (I-003 / I-004 / I-006 / I-007)."""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

import jsonschema


REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO_ROOT / "docs" / "schemas" / "spec.schema.json"
TSCONFIG_TEMPLATE = REPO_ROOT / "docs" / "templates" / "starter" / "tsconfig.json.template"
INIT_MD = REPO_ROOT / "commands" / "init.md"
WORK_MD = REPO_ROOT / "commands" / "work.md"
WORK_PY = REPO_ROOT / "scripts" / "work.py"


def _load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def _minimal_spec(extra_top: dict | None = None, risk: dict | None = None) -> dict:
    spec = {
        "version": "2.3.8",
        "project": {"name": "test", "summary": "minimal"},
        "domain": {"overview": "stub"},
        "features": [
            {"id": "F-001", "type": "skeleton"},
            {"id": "F-002", "type": "feature"},
        ],
    }
    if risk is not None:
        spec["risks"] = [risk]
    if extra_top:
        spec.update(extra_top)
    return spec


class I003TsconfigTemplateTests(unittest.TestCase):
    """I-003: starter/tsconfig.json.template 신설 + 권장값."""

    def test_template_exists(self):
        self.assertTrue(TSCONFIG_TEMPLATE.is_file(), f"missing: {TSCONFIG_TEMPLATE}")

    def test_template_is_valid_json(self):
        # JSON with `//` comments is not strict JSON, but the recommended
        # values must be parseable when comments are stripped. Smoke check
        # by stripping `// ...` lines.
        raw = TSCONFIG_TEMPLATE.read_text(encoding="utf-8")
        # very loose stripper — drops leading `"//":` keys for the smoke load
        stripped = re.sub(r'"//"\s*:\s*"[^"\n]*",?\n', "", raw)
        # Trailing comma after last `//` removal — drop dangling commas before }/]
        stripped = re.sub(r",(\s*[}\]])", r"\1", stripped)
        try:
            json.loads(stripped)
        except json.JSONDecodeError as e:
            self.fail(f"template body is not valid JSON after comment strip: {e}")

    def test_template_has_recommended_options(self):
        raw = TSCONFIG_TEMPLATE.read_text(encoding="utf-8")
        for opt in ("allowImportingTsExtensions", "noEmit", "vitest/globals"):
            self.assertIn(opt, raw, f"recommended option missing: {opt}")

    def test_init_md_references_template(self):
        body = INIT_MD.read_text(encoding="utf-8")
        self.assertIn("tsconfig.json.template", body, "init.md 가 tsconfig 안내 없음")
        self.assertIn("I-003", body, "환원 출처 (I-003) 표기 없음")


class I004RiskIdPatternTests(unittest.TestCase):
    """I-004: risks[].id pattern 이 R-N + RISK-N 양쪽 허용."""

    def setUp(self):
        self.schema = _load_schema()

    def _validate(self, spec: dict) -> None:
        jsonschema.validate(spec, self.schema)

    def _risk(self, rid: str) -> dict:
        return {
            "id": rid,
            "statement": "demo risk",
            "likelihood": "low",
            "impact": "low",
        }

    def test_legacy_r_prefix_still_validates(self):
        self._validate(_minimal_spec(risk=self._risk("R-001")))

    def test_new_risk_prefix_validates(self):
        self._validate(_minimal_spec(risk=self._risk("RISK-001")))

    def test_invalid_prefix_rejected(self):
        with self.assertRaises(jsonschema.ValidationError):
            self._validate(_minimal_spec(risk=self._risk("RISKY-1")))

    def test_pattern_exposes_alternation(self):
        pattern = self.schema["properties"]["risks"]["items"]["properties"]["id"]["pattern"]
        self.assertIn("R", pattern)
        self.assertIn("RISK", pattern)


class I006KindTrivialTests(unittest.TestCase):
    """I-006: kind=trivial 의 공식 의미 문서화 (validation 변경 X)."""

    def test_work_md_mentions_kind_trivial(self):
        body = WORK_MD.read_text(encoding="utf-8")
        self.assertIn("trivial", body, "work.md 에 trivial 언급 없음")
        self.assertIn("I-006", body, "환원 출처 (I-006) 표기 없음")

    def test_work_md_clarifies_no_exemption(self):
        body = WORK_MD.read_text(encoding="utf-8")
        # The doc must clarify that trivial does NOT exempt Iron Law D.
        self.assertIn("Iron Law D 면제 X", body)

    def test_work_py_help_mentions_trivial(self):
        body = WORK_PY.read_text(encoding="utf-8")
        # The --kind argparse help string must mention trivial as a recognized convention.
        self.assertIn("trivial", body)


class I007ChangelogVersionOptionalTests(unittest.TestCase):
    """I-007: metadata.changelog[] 의 version optional."""

    def setUp(self):
        self.schema = _load_schema()

    def _validate(self, spec: dict) -> None:
        jsonschema.validate(spec, self.schema)

    def test_changelog_with_version_validates(self):
        spec = _minimal_spec(
            extra_top={
                "metadata": {
                    "changelog": [
                        {"version": "1.0.0", "date": "2026-01-01", "note": "initial"}
                    ]
                }
            }
        )
        self._validate(spec)

    def test_changelog_without_version_validates(self):
        spec = _minimal_spec(
            extra_top={
                "metadata": {
                    "changelog": [
                        {"date": "2026-04-27", "note": "no version yet"}
                    ]
                }
            }
        )
        # Used to fail (version was required); should now pass.
        self._validate(spec)

    def test_changelog_required_no_longer_includes_version(self):
        cl = self.schema["$defs"]["changelog"]["items"]
        required = cl.get("required", [])
        self.assertNotIn("version", required, "changelog.items.required still demands version")


if __name__ == "__main__":
    unittest.main()
