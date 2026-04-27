"""commands/work.md Orchestration Routing 표 파싱 + 계약 검증 (v0.5)."""

from __future__ import annotations

import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
WORK_MD = REPO_ROOT / "commands" / "work.md"


_ROUTING_HEADER = "| shape_key | agent_chain |"


def _parse_routing_table(body: str) -> list[tuple[str, str]]:
    """Orchestration Routing 표 파싱. [(shape_key, agent_chain), ...]."""
    lines = body.splitlines()
    try:
        start = lines.index(_ROUTING_HEADER)
    except ValueError:
        return []
    rows: list[tuple[str, str]] = []
    for line in lines[start + 2 :]:
        if not line.strip().startswith("|"):
            break
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) >= 2:
            rows.append((cells[0], cells[1]))
    return rows


class RoutingTableShapeTests(unittest.TestCase):
    def setUp(self):
        self.body = WORK_MD.read_text(encoding="utf-8")

    def test_orchestration_section_present(self):
        self.assertIn("## Orchestration Routing", self.body)

    def test_routing_header_present(self):
        self.assertIn(_ROUTING_HEADER, self.body)

    def test_six_rows_parsed(self):
        rows = _parse_routing_table(self.body)
        self.assertEqual(
            len(rows),
            6,
            f"expected 6 routing rows, got {len(rows)}: {[r[0] for r in rows]}",
        )


class RoutingContractTests(unittest.TestCase):
    """각 shape_key 가 예상 전문가를 agent_chain 에 참조."""

    EXPECTED = {
        "baseline-empty-vague": ["researcher", "product-planner"],
        "ui_surface.present": [
            "ux-architect",
            "visual-designer",
            "a11y-auditor",
            "frontend-engineer",
        ],
        "sensitive_or_auth": ["security-engineer", "reviewer"],
        "performance_budget": ["performance-engineer"],
        "pure_domain_logic": ["backend-engineer"],
        "feature_completion": [
            "qa-engineer",
            "integrator",
            "tech-writer",
            "reviewer",
        ],
    }

    def setUp(self):
        self.rows = dict(_parse_routing_table(WORK_MD.read_text(encoding="utf-8")))

    def test_every_expected_shape_key_present(self):
        missing = set(self.EXPECTED.keys()) - set(self.rows.keys())
        self.assertFalse(missing, f"missing shape_keys: {missing}")

    def test_every_chain_mentions_expected_agents(self):
        for shape_key, expected_agents in self.EXPECTED.items():
            chain = self.rows.get(shape_key, "")
            for agent in expected_agents:
                self.assertIn(
                    agent,
                    chain,
                    f"shape={shape_key}: chain missing @harness:{agent} (chain={chain!r})",
                )


class KickoffRoutingShapesParityTests(unittest.TestCase):
    """v0.6.1 — kickoff.py 의 ROUTING_SHAPES 가 commands/work.md 표와 정합해야.

    두 source 가 drift 하면 kickoff 가 잘못된 agent 를 소환하거나 work.md 가 거짓말.
    """

    def setUp(self):
        import sys
        scripts_path = str(REPO_ROOT / "scripts")
        if scripts_path not in sys.path:
            sys.path.insert(0, scripts_path)
        from ceremonies import kickoff as kk  # noqa: E402

        self.kickoff_shapes = kk.ROUTING_SHAPES
        self.work_rows = dict(_parse_routing_table(WORK_MD.read_text(encoding="utf-8")))

    def test_all_kickoff_shapes_appear_in_work_md(self):
        """kickoff.py 가 아는 shape 가 work.md 표에도 있어야."""
        missing = set(self.kickoff_shapes.keys()) - set(self.work_rows.keys())
        self.assertFalse(missing, f"shapes in kickoff.py not in work.md: {missing}")

    def test_work_md_shapes_covered_by_kickoff(self):
        """work.md 표의 모든 shape 가 kickoff.py 에 등록되어야 (역방향 drift 방지)."""
        missing = set(self.work_rows.keys()) - set(self.kickoff_shapes.keys())
        self.assertFalse(missing, f"shapes in work.md not in kickoff.py: {missing}")

    def test_every_kickoff_agent_appears_in_work_md_chain(self):
        """kickoff 의 agent 들이 같은 shape 의 work.md chain 에도 등장해야."""
        for shape, agents in self.kickoff_shapes.items():
            chain = self.work_rows.get(shape, "")
            for agent in agents:
                self.assertIn(
                    agent,
                    chain,
                    f"shape={shape}: agent '{agent}' in kickoff but not in work.md chain",
                )


class ConflictResolutionTests(unittest.TestCase):
    def setUp(self):
        self.body = WORK_MD.read_text(encoding="utf-8")

    def test_security_veto_documented(self):
        self.assertIn("security BLOCK", self.body)
        self.assertRegex(self.body, r"veto|민감성\s*우위")

    def test_a11y_auditor_read_only_documented(self):
        self.assertRegex(self.body, r"a11y-auditor.*read-only|read-only.*a11y")


class PayloadShapeTests(unittest.TestCase):
    def setUp(self):
        self.body = WORK_MD.read_text(encoding="utf-8")

    def test_payload_keys_documented(self):
        for key in ("feature_id", "ac_summary", "modules", "test_strategy"):
            self.assertIn(key, self.body, f"payload must document {key}")


if __name__ == "__main__":
    unittest.main()
