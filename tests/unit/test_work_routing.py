"""commands/work.md Orchestration Routing 표 파싱 + 계약 검증 (v0.5)."""

from __future__ import annotations

import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
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
