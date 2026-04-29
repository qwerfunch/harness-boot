"""F-037 — kickoff.py style/chapter inject."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import yaml

from legacy.scripts.ceremonies.kickoff import (
    _render_style_block,
    detect_shapes,
    generate_kickoff,
)


def _seed_area_index(harness: Path) -> None:
    index = {
        "schema_version": "1.0",
        "areas": [
            {
                "slug": "scripts-scan",
                "label": "scripts/scan",
                "modules": ["scripts/scan/manifest"],
                "paths": ["scripts/scan"],
                "chapter_path": "chapters/area-scripts-scan.md",
                "last_scanned_ts": "2026-04-27T00:00:00Z",
                "first_seen_feature_id": "F-200",
                "_provenance": {"confidence": "generated"},
            }
        ],
    }
    (harness / "area_index.yaml").write_text(
        yaml.safe_dump(index, sort_keys=False), encoding="utf-8"
    )
    chapters = harness / "chapters"
    chapters.mkdir(exist_ok=True)
    (chapters / "area-scripts-scan.md").write_text(
        "# area: scripts/scan\n\nstub\n", encoding="utf-8"
    )


class TestRenderStyleBlock(unittest.TestCase):
    def test_emits_section_when_feature_modules_overlap_area(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            harness = Path(tmp) / ".harness"
            harness.mkdir()
            _seed_area_index(harness)
            feature = {"id": "F-200", "modules": ["scripts/scan/manifest"]}
            block = _render_style_block(harness, feature)
            self.assertIn("기존 스타일 컨텍스트", block)
            self.assertIn("area-scripts-scan.md", block)

    def test_empty_when_no_area_index(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            harness = Path(tmp) / ".harness"
            harness.mkdir()
            feature = {"id": "F-200", "modules": ["scripts/scan/manifest"]}
            block = _render_style_block(harness, feature)
            self.assertEqual(block, "")

    def test_empty_when_feature_has_no_module_overlap(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            harness = Path(tmp) / ".harness"
            harness.mkdir()
            _seed_area_index(harness)
            feature = {"id": "F-200", "modules": ["completely/unrelated/path"]}
            block = _render_style_block(harness, feature)
            self.assertEqual(block, "")


class TestKickoffIntegration(unittest.TestCase):
    def test_kickoff_includes_style_block_when_provided(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            harness = Path(tmp) / ".harness"
            harness.mkdir()
            _seed_area_index(harness)
            feature = {
                "id": "F-200",
                "modules": ["scripts/scan/manifest"],
                "ui_surface": {"present": False},
                "test_strategy": "tdd",
            }
            shapes = detect_shapes(feature)
            block = _render_style_block(harness, feature)
            kickoff_path = generate_kickoff(
                harness,
                feature_id="F-200",
                shapes=shapes,
                style_block=block,
            )
            text = kickoff_path.read_text(encoding="utf-8")
            self.assertIn("기존 스타일 컨텍스트", text)
            self.assertIn("area-scripts-scan.md", text)

    def test_kickoff_unchanged_when_style_block_empty(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            harness = Path(tmp) / ".harness"
            harness.mkdir()
            feature = {
                "id": "F-200",
                "modules": [],
                "test_strategy": "tdd",
            }
            shapes = detect_shapes(feature)
            kickoff_path = generate_kickoff(
                harness,
                feature_id="F-200",
                shapes=shapes,
                style_block="",
            )
            text = kickoff_path.read_text(encoding="utf-8")
            self.assertNotIn("기존 스타일 컨텍스트", text)


if __name__ == "__main__":
    unittest.main()
