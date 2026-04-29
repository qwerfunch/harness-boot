"""F-044 — scripts/spec/archive.py contract tests + dashboard archive filter."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import yaml

from legacy.scripts.spec.archive import archive_feature, is_archived
from legacy.scripts.ui.dashboard import render


class TestArchiveFeature(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.spec_path = Path(self._tmp.name) / "spec.yaml"
        spec = {
            "version": "2.3",
            "project": {"name": "demo", "summary": "x", "vision": ""},
            "domain": {"overview": "", "entities": [], "business_rules": []},
            "constraints": {"tech_stack": {}},
            "deliverable": {"type": "library", "entry_points": [], "smoke_scenarios": []},
            "features": [
                {"id": "F-001", "type": "feature", "title": "first", "priority": "P0",
                 "test_strategy": "tdd", "acceptance_criteria": ["AC-1: x"], "modules": []},
            ],
        }
        self.spec_path.write_text(yaml.safe_dump(spec, sort_keys=False), encoding="utf-8")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_archive_marks_feature(self) -> None:
        feature = archive_feature(self.spec_path, "F-001", "v0.1 era — historical")
        self.assertTrue(feature["archived_at"])
        self.assertEqual(feature["archive_reason"], "v0.1 era — historical")

    def test_archive_persists_to_disk(self) -> None:
        archive_feature(self.spec_path, "F-001", "old", timestamp="2026-04-23T00:00:00Z")
        reloaded = yaml.safe_load(self.spec_path.read_text(encoding="utf-8"))
        f001 = next(f for f in reloaded["features"] if f["id"] == "F-001")
        self.assertEqual(f001["archived_at"], "2026-04-23T00:00:00Z")
        self.assertEqual(f001["archive_reason"], "old")

    def test_unknown_feature_raises(self) -> None:
        with self.assertRaises(KeyError):
            archive_feature(self.spec_path, "F-999", "x")

    def test_empty_reason_raises(self) -> None:
        with self.assertRaises(ValueError):
            archive_feature(self.spec_path, "F-001", "")
        with self.assertRaises(ValueError):
            archive_feature(self.spec_path, "F-001", "   ")


class TestIsArchived(unittest.TestCase):
    def test_archived_at_present_truthy(self) -> None:
        self.assertTrue(is_archived({"archived_at": "2026-04-23T00:00:00Z"}))

    def test_no_marker_falsy(self) -> None:
        self.assertFalse(is_archived({"id": "F-1"}))


class TestDashboardArchiveFilter(unittest.TestCase):
    def _spec(self) -> dict:
        return {
            "version": "2.3",
            "project": {"name": "demo", "summary": "x", "vision": ""},
            "domain": {"overview": "", "entities": [], "business_rules": []},
            "constraints": {"tech_stack": {}},
            "deliverable": {"type": "library", "entry_points": [], "smoke_scenarios": []},
            "features": [
                {"id": "F-0", "type": "skeleton", "title": "skel", "priority": "P0",
                 "test_strategy": "lean-tdd", "acceptance_criteria": [], "modules": []},
                {"id": "F-100", "type": "feature", "title": "active", "priority": "P1",
                 "test_strategy": "tdd", "acceptance_criteria": ["AC-1"], "modules": []},
                {"id": "F-200", "type": "feature", "title": "archived feature", "priority": "P1",
                 "test_strategy": "tdd", "acceptance_criteria": ["AC-1"], "modules": [],
                 "archived_at": "2026-04-23T00:00:00Z",
                 "archive_reason": "v0.1 era"},
            ],
        }

    def test_archived_feature_hidden_from_unregistered(self) -> None:
        state = {"session": {"active_feature_id": None}, "features": []}
        text = render(state, spec=self._spec(), suggestions=[], lang="ko")
        # F-100 is unregistered (in spec, not in state) → should appear
        self.assertIn("active", text)
        # F-200 has archived_at → should NOT appear
        self.assertNotIn("archived feature", text)


if __name__ == "__main__":
    unittest.main()
