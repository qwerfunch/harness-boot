"""F-027 — init/work commands carry the issue-logging section.

Both /harness-boot:init and /harness-boot:work must instruct Claude to
append harness-boot frictions to .harness/_workspace/issues-log.md so
that the maintainer feedback loop (cosmic-suika ISSUES-LOG → v0.10.x
환원 패턴) keeps working.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
COMMANDS_DIR = REPO_ROOT / "commands"


class IssueLogSectionTests(unittest.TestCase):
    """AC-1 + AC-2: section presence + path + template fields."""

    REQUIRED_FIELDS = (
        "Source",
        "Category",
        "Severity",
        "What happened",
    )
    REQUIRED_PATH = ".harness/_workspace/issues-log.md"

    def _read(self, name: str) -> str:
        return (COMMANDS_DIR / name).read_text(encoding="utf-8")

    def test_init_has_issue_log_section(self):
        body = self._read("init.md")
        self.assertIn("Issue logging", body, "## Issue logging 섹션 누락")
        self.assertIn(self.REQUIRED_PATH, body, "issues-log.md 경로 누락")

    def test_init_has_template_fields(self):
        body = self._read("init.md")
        for field in self.REQUIRED_FIELDS:
            self.assertIn(field, body, f"template field '{field}' 누락 (init)")

    def test_work_has_issue_log_section(self):
        body = self._read("work.md")
        self.assertIn("Issue logging", body, "## Issue logging 섹션 누락")
        self.assertIn(self.REQUIRED_PATH, body, "issues-log.md 경로 누락")

    def test_work_has_template_fields(self):
        body = self._read("work.md")
        for field in self.REQUIRED_FIELDS:
            self.assertIn(field, body, f"template field '{field}' 누락 (work)")

    def test_anti_rationalization_preserved(self):
        """BR-014: NO skip / NO shortcut 2 행 규약은 새 섹션 추가 후에도 보존."""
        for name in ("init.md", "work.md"):
            body = self._read(name)
            self.assertTrue(
                re.search(r"^NO skip:", body, re.MULTILINE),
                f"{name}: NO skip 라인 누락",
            )
            self.assertTrue(
                re.search(r"^NO shortcut:", body, re.MULTILINE),
                f"{name}: NO shortcut 라인 누락",
            )


if __name__ == "__main__":
    unittest.main()
