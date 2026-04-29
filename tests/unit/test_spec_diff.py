"""Tests for scripts/spec_diff.py (F-002 Mode A/R helper)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "legacy" / "scripts"))

from spec import diff as sd  # noqa: E402


class UnifiedTextDiffTests(unittest.TestCase):
    def test_no_change_yields_empty(self):
        out = sd.unified_text_diff("a\nb\n", "a\nb\n", from_label="x", to_label="y")
        self.assertEqual(out, "")

    def test_simple_change_shows_plus_minus(self):
        out = sd.unified_text_diff("a\nb\n", "a\nc\n", from_label="x", to_label="y")
        self.assertIn("-b", out)
        self.assertIn("+c", out)


class CanonicalYamlDiffTests(unittest.TestCase):
    def test_formatting_only_change_is_invisible(self):
        """같은 데이터, 다른 YAML 표기 — canonical diff 결과 빈 문자열."""
        old_text = "a: 1\nb: 2\n"
        new_text = "b: 2\na: 1\n"  # 순서 다름
        import yaml as _y
        old_obj = _y.safe_load(old_text)
        new_obj = _y.safe_load(new_text)
        out = sd.canonical_yaml_diff(old_obj, new_obj, from_label="x", to_label="y")
        self.assertEqual(out, "")

    def test_real_change_still_shows(self):
        import yaml as _y
        old = _y.safe_load("a: 1\nb: 2\n")
        new = _y.safe_load("a: 1\nb: 3\n")
        out = sd.canonical_yaml_diff(old, new, from_label="x", to_label="y")
        self.assertIn("-b: 2", out)
        self.assertIn("+b: 3", out)


class SectionStatTests(unittest.TestCase):
    def test_all_same_no_changes(self):
        s = {"version": "2.3", "features": []}
        self.assertEqual(sd.section_stat(s, s), {})

    def test_section_modified(self):
        old = {"version": "2.3", "project": {"name": "a"}}
        new = {"version": "2.3", "project": {"name": "b"}}
        stats = sd.section_stat(old, new)
        self.assertEqual(stats["project"], "modified")

    def test_section_added(self):
        old = {"version": "2.3"}
        new = {"version": "2.3", "deliverable": {"type": "cli"}}
        stats = sd.section_stat(old, new)
        self.assertEqual(stats["deliverable"], "added")

    def test_section_removed(self):
        old = {"version": "2.3", "deliverable": {"type": "cli"}}
        new = {"version": "2.3"}
        stats = sd.section_stat(old, new)
        self.assertEqual(stats["deliverable"], "removed")

    def test_feature_level_changes(self):
        old = {"features": [{"id": "F-1"}, {"id": "F-2"}]}
        new = {"features": [{"id": "F-1", "name": "updated"}, {"id": "F-3"}]}
        stats = sd.section_stat(old, new)
        fc = stats["feature_changes"]
        self.assertEqual(fc["F-1"], "modified")
        self.assertEqual(fc["F-2"], "removed")
        self.assertEqual(fc["F-3"], "added")

    def test_no_feature_changes_excluded(self):
        spec = {"features": [{"id": "F-1"}]}
        stats = sd.section_stat(spec, spec)
        self.assertNotIn("feature_changes", stats)

    def test_version_field_tracked(self):
        old = {"version": "2.3.7"}
        new = {"version": "2.3.8"}
        stats = sd.section_stat(old, new)
        self.assertEqual(stats["version"], "modified")


class IntegrationTests(unittest.TestCase):
    """실제 파일 읽어서 diff."""

    def setUp(self) -> None:
        import tempfile
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_unified_diff_on_files(self):
        old_path = self.tmp / "old.yaml"
        new_path = self.tmp / "new.yaml"
        old_path.write_text("version: '2.3'\nproject:\n  name: old\n", encoding="utf-8")
        new_path.write_text("version: '2.3'\nproject:\n  name: new\n", encoding="utf-8")
        old_text = old_path.read_text(encoding="utf-8")
        new_text = new_path.read_text(encoding="utf-8")
        diff = sd.unified_text_diff(old_text, new_text, from_label="old", to_label="new")
        self.assertIn("-  name: old", diff)
        self.assertIn("+  name: new", diff)


if __name__ == "__main__":
    unittest.main()
