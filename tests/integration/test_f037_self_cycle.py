"""F-037 — end-to-end fog-clear cycle on a synthetic project.

Activates a feature with module paths pointing into the harness-boot repo
itself, asserts that fog-clear writes a chapter, an area_index, an event,
and that the kickoff body picks up the style block.

Runs outside the default ``tests/unit`` pytest scope (``pytest.ini``).
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[2]


def _seed_project(tmp: Path) -> Path:
    project = tmp / "demo"
    project.mkdir()

    (project / "src").mkdir()
    (project / "src" / "models.py").write_text(
        "class Account:\n    pass\n", encoding="utf-8"
    )

    harness = project / ".harness"
    harness.mkdir()

    spec = {
        "version": "2.3",
        "project": {"name": "demo", "summary": "F-037 e2e fixture", "vision": ""},
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
                "title": "demo",
                "priority": "P1",
                "test_strategy": "tdd",
                "acceptance_criteria": ["AC-1: dummy"],
                "modules": ["src/models.py"],
            },
        ],
        "metadata": {"source": {"origin": "existing_code", "maturity": "implementation"}},
    }
    (harness / "spec.yaml").write_text(yaml.safe_dump(spec, sort_keys=False), encoding="utf-8")
    (harness / "state.yaml").write_text(
        yaml.safe_dump({"session": {"active_feature_id": None, "last_command": None}, "features": []}),
        encoding="utf-8",
    )
    return project


def _run_work(project: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "scripts/work.py", *args, "--harness-dir", str(project / ".harness")],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
    )


class TestSelfCycle(unittest.TestCase):
    def test_activate_emits_fog_chapter_index_event(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project = _seed_project(Path(tmp))
            proc = _run_work(project, "F-200")
            self.assertEqual(proc.returncode, 0, msg=proc.stderr)

            chapters = list((project / ".harness" / "chapters").glob("area-*.md"))
            self.assertEqual(len(chapters), 1)

            index = yaml.safe_load((project / ".harness" / "area_index.yaml").read_text(encoding="utf-8"))
            self.assertEqual(len(index["areas"]), 1)
            self.assertEqual(index["areas"][0]["first_seen_feature_id"], "F-200")

            events = [
                json.loads(line)
                for line in (project / ".harness" / "events.log").read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]
            fog_events = [e for e in events if e.get("type") == "fog_cleared"]
            self.assertEqual(len(fog_events), 1)

            kickoff = (project / ".harness" / "_workspace" / "kickoff" / "F-200.md")
            self.assertTrue(kickoff.is_file())
            self.assertIn("기존 스타일 컨텍스트", kickoff.read_text(encoding="utf-8"))

    def test_no_fog_flag_disables_chapter_and_event(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            project = _seed_project(Path(tmp))
            proc = _run_work(project, "F-200", "--no-fog")
            self.assertEqual(proc.returncode, 0, msg=proc.stderr)

            self.assertFalse((project / ".harness" / "chapters").exists())
            log = (project / ".harness" / "events.log").read_text(encoding="utf-8")
            self.assertNotIn("fog_cleared", log)

            kickoff = (project / ".harness" / "_workspace" / "kickoff" / "F-200.md")
            self.assertTrue(kickoff.is_file())
            self.assertNotIn("기존 스타일 컨텍스트", kickoff.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
