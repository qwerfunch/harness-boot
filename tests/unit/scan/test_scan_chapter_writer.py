"""F-037 — chapter_writer: byte-stable + user-edit sigil preservation."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from legacy.scripts.scan.area_resolver import AreaRecord
from legacy.scripts.scan.chapter_writer import (
    USER_EDIT_BEGIN,
    USER_EDIT_END,
    chapter_path_for,
    write_chapter,
)


class TestWriteChapterFresh(unittest.TestCase):
    def test_fresh_write_creates_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            harness = Path(tmp) / ".harness"
            harness.mkdir()
            area = AreaRecord(
                slug="scripts-scan",
                label="scripts/scan",
                paths=("scripts/scan",),
                modules=("scripts/scan/manifest",),
                feature_id="F-100",
            )
            path = write_chapter(
                harness,
                area=area,
                style={"formatter": "ruff", "naming": {"functions": "snake_case"}},
                feature_id="F-100",
                timestamp="2026-04-27T00:00:00Z",
            )
            self.assertTrue(path.is_file())
            self.assertIn("# area: scripts/scan", path.read_text(encoding="utf-8"))

    def test_chapter_path_uses_slug(self) -> None:
        path = chapter_path_for(Path("/tmp/.harness"), "scripts-scan")
        self.assertEqual(path.name, "area-scripts-scan.md")


class TestIdempotency(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.harness = Path(self._tmp.name) / ".harness"
        self.harness.mkdir()
        self.area = AreaRecord(
            slug="scripts-scan",
            label="scripts/scan",
            paths=("scripts/scan",),
            modules=("scripts/scan/manifest",),
            feature_id="F-100",
        )
        self.style = {"formatter": "ruff"}
        self.ts = "2026-04-27T00:00:00Z"

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_second_write_byte_identical(self) -> None:
        first = write_chapter(
            self.harness,
            area=self.area,
            style=self.style,
            feature_id="F-100",
            timestamp=self.ts,
        )
        before = first.read_bytes()
        second = write_chapter(
            self.harness,
            area=self.area,
            style=self.style,
            feature_id="F-100",
            timestamp=self.ts,
        )
        self.assertEqual(second.read_bytes(), before)

    def test_user_edit_region_preserved(self) -> None:
        path = write_chapter(
            self.harness,
            area=self.area,
            style=self.style,
            feature_id="F-100",
            timestamp=self.ts,
        )
        text = path.read_text(encoding="utf-8")
        custom = (
            text
            + "\n"
            + USER_EDIT_BEGIN
            + "\n"
            + "사용자가 추가한 내용 — 보존되어야 함.\n"
            + USER_EDIT_END
            + "\n"
        )
        path.write_text(custom, encoding="utf-8")

        write_chapter(
            self.harness,
            area=self.area,
            style={"formatter": "black"},  # different style → autogen would change
            feature_id="F-100",
            timestamp="2026-04-28T00:00:00Z",
        )
        rewritten = path.read_text(encoding="utf-8")
        self.assertIn(USER_EDIT_BEGIN, rewritten)
        self.assertIn("사용자가 추가한 내용", rewritten)
        self.assertIn(USER_EDIT_END, rewritten)


class TestFogState(unittest.TestCase):
    def test_dim_when_paths_empty(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            harness = Path(tmp) / ".harness"
            harness.mkdir()
            area = AreaRecord(
                slug="unmapped-abc",
                label="unmapped:foo",
                paths=(),
                modules=("foo",),
                feature_id="F-100",
            )
            path = write_chapter(
                harness,
                area=area,
                style={},
                feature_id="F-100",
                timestamp="2026-04-27T00:00:00Z",
            )
            self.assertIn("fog_state: dim", path.read_text(encoding="utf-8"))

    def test_clear_when_paths_resolved(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            harness = Path(tmp) / ".harness"
            harness.mkdir()
            area = AreaRecord(
                slug="scripts-scan",
                label="scripts/scan",
                paths=("scripts/scan",),
                modules=("scripts/scan/manifest",),
                feature_id="F-100",
            )
            path = write_chapter(
                harness,
                area=area,
                style={"formatter": "ruff"},
                feature_id="F-100",
                timestamp="2026-04-27T00:00:00Z",
            )
            self.assertIn("fog_state: clear", path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
