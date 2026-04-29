"""F-037 — _autowire_fog_clear hook in scripts/work.py."""

from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

import yaml

from legacy.scripts.work import _autowire_fog_clear, activate


REPO_ROOT = Path(__file__).resolve().parents[3]


def _make_project(tmp: Path, *, with_modules: bool = True, fog_disabled: bool = False) -> Path:
    project = tmp / "demo"
    project.mkdir()
    harness = project / ".harness"
    harness.mkdir()

    (project / "src").mkdir()
    (project / "src" / "models.py").write_text(
        "class Account:\n    pass\n", encoding="utf-8"
    )

    spec = {
        "version": "2.3",
        "project": {"name": "demo", "summary": "fog-clear hook fixture", "vision": ""},
        "domain": {"overview": "", "entities": [], "business_rules": []},
        "constraints": {"tech_stack": {}},
        "deliverable": {"type": "library", "entry_points": [], "smoke_scenarios": []},
        "features": [
            {
                "id": "F-0",
                "type": "skeleton",
                "title": "skel",
                "priority": "P0",
                "test_strategy": "lean-tdd",
                "acceptance_criteria": [],
                "modules": [],
            },
            {
                "id": "F-200",
                "type": "feature",
                "title": "demo feature",
                "priority": "P1",
                "test_strategy": "tdd",
                "acceptance_criteria": ["AC-1: dummy"],
                "modules": ["src/models.py"] if with_modules else [],
            },
        ],
        "metadata": {
            "source": {"origin": "existing_code", "maturity": "implementation"},
        },
    }
    if fog_disabled:
        spec["metadata"]["fog"] = {"disabled": True}

    (harness / "spec.yaml").write_text(yaml.safe_dump(spec, sort_keys=False), encoding="utf-8")
    state = {
        "session": {"active_feature_id": None, "last_command": None},
        "features": [],
    }
    (harness / "state.yaml").write_text(yaml.safe_dump(state), encoding="utf-8")
    return project


class TestSilentSkips(unittest.TestCase):
    def test_no_spec_skips(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            harness = Path(tmp) / ".harness"
            harness.mkdir()
            _autowire_fog_clear(harness, "F-200")
            self.assertFalse((harness / "chapters").exists())

    def test_disabled_via_metadata_fog(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project = _make_project(Path(tmp), fog_disabled=True)
            _autowire_fog_clear(project / ".harness", "F-200")
            self.assertFalse((project / ".harness" / "chapters").exists())

    def test_disabled_via_argument(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project = _make_project(Path(tmp))
            _autowire_fog_clear(project / ".harness", "F-200", disable=True)
            self.assertFalse((project / ".harness" / "chapters").exists())

    def test_no_modules_skips(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project = _make_project(Path(tmp), with_modules=False)
            _autowire_fog_clear(project / ".harness", "F-200")
            self.assertFalse((project / ".harness" / "chapters").exists())


class TestFiresAndPersists(unittest.TestCase):
    def test_chapter_and_index_and_event_appear(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project = _make_project(Path(tmp))
            harness = project / ".harness"
            _autowire_fog_clear(harness, "F-200")

            chapters = list((harness / "chapters").glob("area-*.md"))
            self.assertEqual(len(chapters), 1)

            index = yaml.safe_load((harness / "area_index.yaml").read_text(encoding="utf-8"))
            self.assertIn("areas", index)
            self.assertEqual(len(index["areas"]), 1)
            self.assertEqual(index["areas"][0]["first_seen_feature_id"], "F-200")

            log = (harness / "events.log").read_text(encoding="utf-8").strip().splitlines()
            events = [json.loads(line) for line in log]
            fog = [e for e in events if e.get("type") == "fog_cleared"]
            self.assertEqual(len(fog), 1)
            self.assertEqual(fog[0]["feature"], "F-200")


class TestIdempotency(unittest.TestCase):
    def test_second_call_no_duplicate_event_chapter_byte_stable(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project = _make_project(Path(tmp))
            harness = project / ".harness"
            _autowire_fog_clear(harness, "F-200")
            chapter = next((harness / "chapters").glob("area-*.md"))
            before = chapter.read_bytes()

            _autowire_fog_clear(harness, "F-200")
            after = chapter.read_bytes()
            self.assertEqual(after, before)

            log = (harness / "events.log").read_text(encoding="utf-8").strip().splitlines()
            fog_events = [
                json.loads(line) for line in log if json.loads(line).get("type") == "fog_cleared"
            ]
            self.assertEqual(len(fog_events), 1)


class TestActivateOrdering(unittest.TestCase):
    def test_fog_event_precedes_kickoff_event(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project = _make_project(Path(tmp))
            harness = project / ".harness"
            activate(harness, "F-200")

            log_lines = (harness / "events.log").read_text(encoding="utf-8").strip().splitlines()
            event_types = [json.loads(line).get("type") for line in log_lines]
            self.assertIn("fog_cleared", event_types)
            self.assertIn("feature_activated", event_types)
            fog_idx = event_types.index("fog_cleared")
            activated_idx = event_types.index("feature_activated")
            self.assertGreater(fog_idx, activated_idx)


if __name__ == "__main__":
    unittest.main()
