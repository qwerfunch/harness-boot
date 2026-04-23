"""Tests for scripts/explain_spec.py (Mode E — CQS read-only)."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import explain_spec as es  # noqa: E402


SAMPLE_SPEC = {
    "version": "2.3.8",
    "project": {"name": "demo-project", "summary": "짧은 설명"},
    "domain": {
        "entities": [{"name": "User"}, {"name": "Order"}],
        "business_rules": [{"id": "BR-1", "statement": "x"}, {"id": "BR-2", "statement": "y"}],
    },
    "features": [
        {"id": "F-001", "name": "skeleton", "status": "done", "release_target": "v0.1"},
        {"id": "F-003", "name": "sync", "status": "done", "release_target": "v0.2"},
        {"id": "F-009", "name": "include", "status": "done", "release_target": "v0.2"},
    ],
    "metadata": {
        "release_plan": {
            "v0.1": {"shipped": True, "features": ["F-001"]},
            "v0.2": {"shipped": "partial", "features": ["F-003", "F-009"]},
        }
    },
}


class OverviewTests(unittest.TestCase):
    def test_overview_structure(self):
        r = es.explain_overview(SAMPLE_SPEC)
        self.assertEqual(r["project"]["name"], "demo-project")
        self.assertEqual(r["domain"]["entities"], ["User", "Order"])
        self.assertEqual(r["domain"]["business_rules"], 2)
        self.assertEqual(len(r["features"]), 3)
        self.assertEqual(r["features"][0]["id"], "F-001")

    def test_overview_includes_release_plan(self):
        r = es.explain_overview(SAMPLE_SPEC)
        self.assertIn("v0.1", r["release_plan"])
        self.assertIn("v0.2", r["release_plan"])

    def test_overview_empty_domain(self):
        spec = {"version": "2.3", "project": {"name": "x"}, "domain": {}, "features": []}
        r = es.explain_overview(spec)
        self.assertEqual(r["domain"]["entities"], [])
        self.assertEqual(r["domain"]["business_rules"], 0)


class FeatureLookupTests(unittest.TestCase):
    def test_feature_found(self):
        f = es.explain_feature(SAMPLE_SPEC, "F-003")
        self.assertEqual(f["name"], "sync")

    def test_feature_not_found(self):
        with self.assertRaises(LookupError):
            es.explain_feature(SAMPLE_SPEC, "F-999")


class EntityLookupTests(unittest.TestCase):
    def test_entity_found(self):
        e = es.explain_entity(SAMPLE_SPEC, "User")
        self.assertEqual(e["name"], "User")

    def test_entity_not_found(self):
        with self.assertRaises(LookupError):
            es.explain_entity(SAMPLE_SPEC, "Nonexistent")


class FormatOverviewTests(unittest.TestCase):
    def test_markdown_format(self):
        r = es.explain_overview(SAMPLE_SPEC)
        out = es.format_overview(r)
        self.assertIn("# demo-project", out)
        self.assertIn("F-001", out)
        self.assertIn("F-003", out)
        self.assertIn("Release plan", out)
        # v0.1 = shipped ✅, v0.2 = partial 🛠
        self.assertIn("✅", out)
        self.assertIn("🛠", out)


class CQSTests(unittest.TestCase):
    """Mode E 의 핵심 불변조건: 파일 **어떤 것도** 수정되지 않음."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.spec_path = self.tmp / "spec.yaml"
        self.spec_path.write_text(
            yaml.safe_dump(SAMPLE_SPEC, sort_keys=False, allow_unicode=True),
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_load_does_not_modify_mtime(self):
        before_mtime = self.spec_path.stat().st_mtime_ns
        spec = es.load_spec(self.spec_path)
        # 최소 라운드트립 작업 수행
        es.explain_overview(spec)
        es.explain_feature(spec, "F-001")
        es.explain_entity(spec, "User")
        after_mtime = self.spec_path.stat().st_mtime_ns
        self.assertEqual(before_mtime, after_mtime)

    def test_no_new_files_created(self):
        before = set(self.tmp.iterdir())
        spec = es.load_spec(self.spec_path)
        es.explain_overview(spec)
        after = set(self.tmp.iterdir())
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
