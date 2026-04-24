"""v0.6 PR-ε — design_review.py 템플릿 + 이벤트 검증."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import design_review as dr  # noqa: E402


FIXED_TS = "2026-04-24T13:00:00Z"


class ReviewersForTests(unittest.TestCase):
    def test_default_three_reviewers(self):
        self.assertEqual(
            dr.reviewers_for(has_audio=False),
            ["visual-designer", "frontend-engineer", "a11y-auditor"],
        )

    def test_has_audio_inserts_audio_designer_before_a11y(self):
        rs = dr.reviewers_for(has_audio=True)
        self.assertEqual(len(rs), 4)
        self.assertIn("audio-designer", rs)
        self.assertLess(rs.index("audio-designer"), rs.index("a11y-auditor"))


class GenerateDesignReviewTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.harness = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def test_creates_file_at_expected_path(self):
        path = dr.generate_design_review(
            self.harness, feature_id="F-7", timestamp=FIXED_TS
        )
        self.assertTrue(path.exists())
        self.assertEqual(path.parent, self.harness / "_workspace" / "design-review")
        self.assertEqual(path.name, "F-7.md")

    def test_template_has_reviewer_sections_and_decisions(self):
        dr.generate_design_review(self.harness, feature_id="F-7", timestamp=FIXED_TS)
        body = (self.harness / "_workspace" / "design-review" / "F-7.md").read_text(encoding="utf-8")
        self.assertIn("## visual-designer concerns", body)
        self.assertIn("## frontend-engineer concerns", body)
        self.assertIn("## a11y-auditor concerns", body)
        self.assertIn("## Decisions", body)
        self.assertNotIn("## audio-designer concerns", body)

    def test_has_audio_includes_audio_reviewer(self):
        dr.generate_design_review(
            self.harness, feature_id="F-8", has_audio=True, timestamp=FIXED_TS
        )
        body = (self.harness / "_workspace" / "design-review" / "F-8.md").read_text(encoding="utf-8")
        self.assertIn("## audio-designer concerns", body)

    def test_events_log_appended(self):
        dr.generate_design_review(
            self.harness, feature_id="F-9", timestamp=FIXED_TS
        )
        log = (self.harness / "events.log").read_text(encoding="utf-8")
        event = json.loads(log.strip().splitlines()[-1])
        self.assertEqual(event["type"], "design_review_opened")
        self.assertEqual(event["feature_id"], "F-9")
        self.assertEqual(event["reviewers"], ["visual-designer", "frontend-engineer", "a11y-auditor"])


if __name__ == "__main__":
    unittest.main()
