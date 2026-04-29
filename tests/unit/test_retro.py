"""v0.6 PR-ε — retro.py events 분석 + 템플릿 검증."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "legacy" / "scripts"))

from ceremonies import retro as rt  # noqa: E402


FIXED_TS = "2026-04-24T14:00:00Z"


def _write_events(harness: Path, events: list[dict]) -> None:
    log = harness / "events.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a", encoding="utf-8") as f:
        for e in events:
            f.write(json.dumps(e) + "\n")


class AnalyzeTests(unittest.TestCase):
    def test_completion_detection(self):
        events = [
            {"type": "feature_activated", "feature": "F-1"},
            {"type": "feature_done", "feature": "F-1"},
        ]
        a = rt.analyze(events, "F-1")
        self.assertTrue(a["completed"])

    def test_no_completion(self):
        events = [{"type": "feature_activated", "feature": "F-1"}]
        self.assertFalse(rt.analyze(events, "F-1")["completed"])

    def test_first_gate_fail_returns_first_only(self):
        events = [
            {"type": "gate_recorded", "feature": "F-1", "gate": "gate_0", "result": "pass"},
            {"type": "gate_recorded", "feature": "F-1", "gate": "gate_2", "result": "fail", "note": "lint"},
            {"type": "gate_recorded", "feature": "F-1", "gate": "gate_3", "result": "fail", "note": "cov"},
        ]
        fgf = rt.analyze(events, "F-1")["first_gate_fail"]
        self.assertEqual(fgf["gate"], "gate_2")

    def test_ceremony_flags(self):
        events = [
            {"type": "kickoff_started", "feature": "F-1"},
            {"type": "design_review_opened", "feature": "F-1"},
            {"type": "question_opened", "feature": "F-1"},
            {"type": "question_opened", "feature": "F-1"},
            {"type": "question_answered", "feature": "F-1"},
        ]
        a = rt.analyze(events, "F-1")
        self.assertTrue(a["kickoff_opened"])
        self.assertTrue(a["design_review_opened"])
        self.assertEqual(a["questions_opened"], 2)
        self.assertEqual(a["questions_answered"], 1)

    def test_filters_other_features(self):
        events = [
            {"type": "feature_done", "feature": "F-2"},
            {"type": "feature_activated", "feature": "F-1"},
        ]
        a = rt.analyze(events, "F-1")
        self.assertFalse(a["completed"])


class GenerateRetroTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.harness = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def test_creates_file_at_expected_path(self):
        path = rt.generate_retro(self.harness, feature_id="F-1", timestamp=FIXED_TS)
        self.assertTrue(path.exists())
        self.assertEqual(path.parent, self.harness / "_workspace" / "retro")
        self.assertEqual(path.name, "F-1.md")

    def test_template_required_sections(self):
        rt.generate_retro(self.harness, feature_id="F-1", timestamp=FIXED_TS)
        body = (self.harness / "_workspace" / "retro" / "F-1.md").read_text(encoding="utf-8")
        for heading in (
            "## What Shipped",
            "## First Gate to Fail",
            "## Ceremonies",
            "## Risks Materialized vs plan.md",
            "## Decisions Revised",
            "## Kickoff Predictions That Were Right / Wrong",
            "## Reviewer Reflection",
            "## Copy Polish",
        ):
            self.assertIn(heading, body, f"missing heading: {heading}")

    def test_reviewer_before_tech_writer_in_template(self):
        """reviewer draft → tech-writer polish 순서 명시 (HTML 코멘트 또는 섹션 순서)."""
        rt.generate_retro(self.harness, feature_id="F-1", timestamp=FIXED_TS)
        body = (self.harness / "_workspace" / "retro" / "F-1.md").read_text(encoding="utf-8")
        self.assertLess(
            body.index("## Reviewer Reflection"),
            body.index("## Copy Polish"),
            "reviewer draft 섹션이 tech-writer polish 보다 먼저 와야",
        )
        self.assertIn("reviewer", body.lower())
        self.assertIn("tech-writer", body)

    def test_events_log_append(self):
        _write_events(
            self.harness,
            [
                {"type": "gate_recorded", "feature": "F-1", "gate": "gate_1", "result": "fail", "note": "type"},
                {"type": "feature_done", "feature": "F-1"},
            ],
        )
        rt.generate_retro(self.harness, feature_id="F-1", timestamp=FIXED_TS)
        log_lines = (self.harness / "events.log").read_text(encoding="utf-8").strip().splitlines()
        # Last line should be our feature_retro_written.
        last = json.loads(log_lines[-1])
        self.assertEqual(last["type"], "feature_retro_written")
        self.assertEqual(last["feature"], "F-1")
        self.assertEqual(last["analysis_summary"]["first_gate_fail"], "gate_1")

    def test_first_gate_fail_rendered_in_template(self):
        _write_events(
            self.harness,
            [{"type": "gate_recorded", "feature": "F-1", "gate": "gate_2", "result": "fail", "note": "ruff noise"}],
        )
        rt.generate_retro(self.harness, feature_id="F-1", timestamp=FIXED_TS)
        body = (self.harness / "_workspace" / "retro" / "F-1.md").read_text(encoding="utf-8")
        self.assertIn("gate_2", body)
        self.assertIn("ruff noise", body)

    def test_no_gate_fail_shown_as_none(self):
        rt.generate_retro(self.harness, feature_id="F-1", timestamp=FIXED_TS)
        body = (self.harness / "_workspace" / "retro" / "F-1.md").read_text(encoding="utf-8")
        self.assertIn("없음", body)


class ArchivedRetroSectionTests(unittest.TestCase):
    """v0.10 F-028 — feature_archived 가 retro 에 'Superseded By' 섹션 자동 채움."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.harness = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def test_archived_event_detected_in_analysis(self):
        events = [
            {"type": "feature_done", "feature": "F-1"},
            {
                "type": "feature_archived",
                "feature": "F-1",
                "superseded_by": "F-9",
                "reason": "pivot",
                "ts": "2026-04-25T00:00:00Z",
            },
        ]
        a = rt.analyze(events, "F-1")
        self.assertTrue(a["archived"])
        self.assertEqual(a["archived_event"]["superseded_by"], "F-9")

    def test_section_rendered_when_archived(self):
        _write_events(
            self.harness,
            [
                {"type": "feature_done", "feature": "F-1"},
                {
                    "type": "feature_archived",
                    "feature": "F-1",
                    "superseded_by": "F-9",
                    "reason": "Sun→Earth pivot",
                    "ts": "2026-04-25T00:00:00Z",
                },
            ],
        )
        rt.generate_retro(self.harness, feature_id="F-1", timestamp=FIXED_TS, force=True)
        body = (self.harness / "_workspace" / "retro" / "F-1.md").read_text(encoding="utf-8")
        self.assertIn("## Superseded By", body)
        self.assertIn("F-9", body)
        self.assertIn("Sun→Earth pivot", body)

    def test_section_omitted_when_not_archived(self):
        rt.generate_retro(self.harness, feature_id="F-1", timestamp=FIXED_TS)
        body = (self.harness / "_workspace" / "retro" / "F-1.md").read_text(encoding="utf-8")
        self.assertNotIn("## Superseded By", body)

    def test_section_handles_missing_superseded_by(self):
        """deprecation only — superseded_by 미지정도 유효한 archive."""
        _write_events(
            self.harness,
            [
                {"type": "feature_done", "feature": "F-1"},
                {
                    "type": "feature_archived",
                    "feature": "F-1",
                    "reason": "no longer needed",
                    "ts": "2026-04-25T00:00:00Z",
                },
            ],
        )
        rt.generate_retro(self.harness, feature_id="F-1", timestamp=FIXED_TS, force=True)
        body = (self.harness / "_workspace" / "retro" / "F-1.md").read_text(encoding="utf-8")
        self.assertIn("## Superseded By", body)
        self.assertIn("superseded_by 미지정", body)
        self.assertIn("no longer needed", body)

    def test_section_renders_in_prototype_mode(self):
        _write_events(
            self.harness,
            [
                {"type": "feature_done", "feature": "F-1"},
                {
                    "type": "feature_archived",
                    "feature": "F-1",
                    "superseded_by": "F-9",
                    "reason": "pivot",
                    "ts": "2026-04-25T00:00:00Z",
                },
            ],
        )
        rt.generate_retro(
            self.harness, feature_id="F-1", timestamp=FIXED_TS, force=True, mode="prototype"
        )
        body = (self.harness / "_workspace" / "retro" / "F-1.md").read_text(encoding="utf-8")
        self.assertIn("## Superseded By", body)


if __name__ == "__main__":
    unittest.main()
