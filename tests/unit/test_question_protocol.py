"""v0.6 PR-δ — Q&A file-drop inbox (scripts/inbox.py) 검증."""

from __future__ import annotations

import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import inbox as ib  # noqa: E402


def _write_question(
    harness: Path,
    feature_id: str,
    from_agent: str,
    to_agent: str,
    *,
    blocking: bool = False,
    with_answer: bool = False,
) -> Path:
    q_dir = harness / "_workspace" / "questions"
    q_dir.mkdir(parents=True, exist_ok=True)
    path = q_dir / f"{feature_id}--{from_agent}--{to_agent}.md"
    body = textwrap.dedent(f"""\
        ---
        to: {to_agent}
        blocking: {"true" if blocking else "false"}
        needs_reply_by: design-review
        ---
        ## Question (2026-04-25T10:00:00Z · from {from_agent})

        Body of the question.
    """)
    if with_answer:
        body += textwrap.dedent(f"""\

            ## Answer (2026-04-25T10:30:00Z · from {to_agent})

            Resolved.
        """)
    path.write_text(body, encoding="utf-8")
    return path


class ScanInboxTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.harness = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def test_empty_dir_returns_empty_list(self):
        self.assertEqual(ib.scan_inbox(self.harness), [])

    def test_parses_filename_to_triple(self):
        _write_question(self.harness, "F-1", "frontend-engineer", "ux-architect")
        qs = ib.scan_inbox(self.harness)
        self.assertEqual(len(qs), 1)
        q = qs[0]
        self.assertEqual(q.feature_id, "F-1")
        self.assertEqual(q.from_agent, "frontend-engineer")
        self.assertEqual(q.to_agent, "ux-architect")

    def test_ignores_files_not_matching_pattern(self):
        bogus = self.harness / "_workspace" / "questions"
        bogus.mkdir(parents=True, exist_ok=True)
        (bogus / "random.md").write_text("noise")
        (bogus / "F-X--nope.md").write_text("also noise")
        self.assertEqual(ib.scan_inbox(self.harness), [])

    def test_feature_filter_narrows_results(self):
        _write_question(self.harness, "F-1", "a", "b")
        _write_question(self.harness, "F-2", "a", "b")
        qs = ib.scan_inbox(self.harness, feature_id="F-2")
        self.assertEqual(len(qs), 1)
        self.assertEqual(qs[0].feature_id, "F-2")

    def test_has_answer_detected(self):
        _write_question(self.harness, "F-1", "a", "b", with_answer=False)
        _write_question(self.harness, "F-2", "a", "b", with_answer=True)
        qs = {q.feature_id: q for q in ib.scan_inbox(self.harness)}
        self.assertFalse(qs["F-1"].has_answer)
        self.assertTrue(qs["F-2"].has_answer)

    def test_blocking_flag_parsed_from_frontmatter(self):
        _write_question(self.harness, "F-1", "a", "b", blocking=True)
        _write_question(self.harness, "F-2", "a", "b", blocking=False)
        qs = {q.feature_id: q for q in ib.scan_inbox(self.harness)}
        self.assertTrue(qs["F-1"].blocking)
        self.assertFalse(qs["F-2"].blocking)


class OpenQuestionsTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.harness = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def test_open_excludes_answered(self):
        _write_question(self.harness, "F-1", "a", "b", with_answer=False)
        _write_question(self.harness, "F-2", "a", "b", with_answer=True)
        open_qs = ib.open_questions(self.harness)
        self.assertEqual(len(open_qs), 1)
        self.assertEqual(open_qs[0].feature_id, "F-1")

    def test_open_empty_when_all_answered(self):
        _write_question(self.harness, "F-1", "a", "b", with_answer=True)
        self.assertEqual(ib.open_questions(self.harness), [])


if __name__ == "__main__":
    unittest.main()
