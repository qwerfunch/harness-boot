"""v0.6 PR-δ — kickoff.py 템플릿 + 이벤트 검증."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from ceremonies import kickoff as kk  # noqa: E402


FIXED_TS = "2026-04-24T12:00:00Z"


class AgentsForShapesTests(unittest.TestCase):
    def test_single_shape_returns_ordered_list(self):
        agents = kk.agents_for_shapes(["feature_completion"])
        self.assertEqual(agents, ["qa-engineer", "integrator", "tech-writer", "reviewer"])

    def test_multi_shape_dedupes_while_preserving_order(self):
        agents = kk.agents_for_shapes(["ui_surface.present", "feature_completion"])
        # software-engineer 는 ui_surface.present 에 먼저 · feature_completion 에 없으니 한 번만.
        # reviewer 도 느리게 등장 (feature_completion 에서 처음).
        self.assertEqual(len(agents), len(set(agents)), "must dedupe")
        self.assertIn("ux-architect", agents)
        self.assertIn("reviewer", agents)

    def test_has_audio_inserts_audio_designer(self):
        agents = kk.agents_for_shapes(["ui_surface.present"], has_audio=True)
        self.assertIn("audio-designer", agents)
        # Should be placed before a11y-auditor (design review order).
        self.assertLess(agents.index("audio-designer"), agents.index("a11y-auditor"))

    def test_has_audio_without_ui_shape_ignored(self):
        agents = kk.agents_for_shapes(["pure_domain_logic"], has_audio=True)
        self.assertNotIn("audio-designer", agents)

    def test_unknown_shape_yields_empty(self):
        self.assertEqual(kk.agents_for_shapes(["nonexistent"]), [])


class RoutingShapesContractTests(unittest.TestCase):
    """ROUTING_SHAPES 가 commands/work.md Orchestration Routing 과 1:1 일치해야 (PR-ε 에서 full parser, 여기선 key 검증)."""

    EXPECTED_KEYS = {
        "baseline-empty-vague",
        "ui_surface.present",
        "sensitive_or_auth",
        "performance_budget",
        "pure_domain_logic",
        "feature_completion",
    }

    def test_all_expected_shapes_present(self):
        self.assertEqual(set(kk.ROUTING_SHAPES.keys()), self.EXPECTED_KEYS)

    def test_discovery_shape_has_researcher_and_planner(self):
        self.assertEqual(
            kk.ROUTING_SHAPES["baseline-empty-vague"],
            ["researcher", "product-planner"],
        )

    def test_feature_completion_ends_with_reviewer(self):
        chain = kk.ROUTING_SHAPES["feature_completion"]
        self.assertEqual(chain[-1], "reviewer")


class GenerateKickoffTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.harness = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def test_generates_file_with_expected_path(self):
        path = kk.generate_kickoff(
            self.harness,
            feature_id="F-1",
            shapes=["ui_surface.present"],
            timestamp=FIXED_TS,
        )
        self.assertTrue(path.exists())
        self.assertEqual(path.name, "F-1.md")
        self.assertEqual(path.parent, self.harness / "_workspace" / "kickoff")

    def test_template_contains_per_role_headings(self):
        kk.generate_kickoff(
            self.harness,
            feature_id="F-1",
            shapes=["feature_completion"],
            timestamp=FIXED_TS,
        )
        body = (self.harness / "_workspace" / "kickoff" / "F-1.md").read_text(encoding="utf-8")
        for agent in ("qa-engineer", "integrator", "tech-writer", "reviewer"):
            self.assertIn(f"## {agent} 의 관점", body)

    def test_template_cites_participating_agents(self):
        kk.generate_kickoff(
            self.harness,
            feature_id="F-2",
            shapes=["sensitive_or_auth"],
            timestamp=FIXED_TS,
        )
        body = (self.harness / "_workspace" / "kickoff" / "F-2.md").read_text(encoding="utf-8")
        self.assertIn("@harness:security-engineer", body)
        self.assertIn("@harness:reviewer", body)

    def test_events_log_appended(self):
        kk.generate_kickoff(
            self.harness,
            feature_id="F-3",
            shapes=["pure_domain_logic"],
            timestamp=FIXED_TS,
        )
        log = (self.harness / "events.log").read_text(encoding="utf-8")
        lines = [json.loads(line) for line in log.strip().splitlines()]
        self.assertEqual(len(lines), 1)
        event = lines[0]
        self.assertEqual(event["type"], "kickoff_started")
        self.assertEqual(event["feature"], "F-3")
        self.assertEqual(event["ts"], FIXED_TS)
        self.assertIn("backend-engineer", event["agents"])

    def test_empty_shapes_raises(self):
        with self.assertRaises(ValueError):
            kk.generate_kickoff(
                self.harness,
                feature_id="F-4",
                shapes=["nonexistent"],
                timestamp=FIXED_TS,
            )


if __name__ == "__main__":
    unittest.main()
