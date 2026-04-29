"""Tests for scripts/render/domain.py (v0.7.5 relocated from scripts/render_domain.py)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "legacy" / "scripts"))

from render import domain as rd  # noqa: E402


FIXED_TS = "2026-04-23T05:00:00Z"


class DeterminismTests(unittest.TestCase):
    def test_same_input_same_output(self):
        spec = {"project": {"name": "demo"}, "domain": {"entities": [], "business_rules": []}}
        out1 = rd.render(spec, timestamp=FIXED_TS)
        out2 = rd.render(spec, timestamp=FIXED_TS)
        self.assertEqual(out1, out2)

    def test_ends_with_newline(self):
        spec = {"project": {"name": "demo"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertTrue(out.endswith("\n"))


class HeaderTests(unittest.TestCase):
    def test_project_name_in_header(self):
        spec = {"project": {"name": "my-product"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("# my-product — Domain View", out)

    def test_unnamed_fallback(self):
        spec = {"project": {}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("(unnamed)", out)

    def test_timestamp_included(self):
        spec = {"project": {"name": "x"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn(FIXED_TS, out)


class ProjectSectionTests(unittest.TestCase):
    def test_summary_rendered(self):
        spec = {"project": {"name": "x", "summary": "short one"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("**Summary**: short one", out)

    def test_description_and_vision(self):
        spec = {
            "project": {
                "name": "x",
                "description": "multi\nline\ndesc",
                "vision": "big dream",
            },
            "domain": {},
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("multi", out)
        self.assertIn("line", out)
        self.assertIn("big dream", out)

    def test_empty_project_section_ok(self):
        spec = {"project": {"name": "x"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        # 필수 헤더는 있지만 빈 필드는 행 추가 안 함
        self.assertIn("## Project", out)
        self.assertNotIn("**Summary**:", out)


class EntitiesTests(unittest.TestCase):
    def test_entity_count_in_header(self):
        spec = {
            "project": {"name": "x"},
            "domain": {"entities": [{"name": "A"}, {"name": "B"}]},
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("## Entities (2)", out)

    def test_empty_entities_shows_hint(self):
        spec = {"project": {"name": "x"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("정의된 엔티티 없음", out)

    def test_entity_with_invariants(self):
        spec = {
            "project": {"name": "x"},
            "domain": {
                "entities": [
                    {
                        "name": "User",
                        "description": "계정 주체",
                        "invariants": [
                            "email 은 unique",
                            {"statement": "password 는 hash 저장"},
                        ],
                    }
                ]
            },
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("### User", out)
        self.assertIn("계정 주체", out)
        self.assertIn("**Invariants**:", out)
        self.assertIn("email 은 unique", out)
        self.assertIn("password 는 hash 저장", out)

    def test_entity_with_attributes(self):
        spec = {
            "project": {"name": "x"},
            "domain": {
                "entities": [
                    {
                        "name": "Item",
                        "attributes": [
                            {"name": "sku", "type": "string"},
                            "price",
                        ],
                    }
                ]
            },
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("**Attributes**:", out)
        self.assertIn("`sku`: string", out)
        self.assertIn("`price`", out)

    def test_unnamed_entity_uses_id(self):
        spec = {
            "project": {"name": "x"},
            "domain": {"entities": [{"id": "E-1", "description": "desc"}]},
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("### E-1", out)


class BusinessRulesTests(unittest.TestCase):
    def test_empty_br_shows_hint(self):
        spec = {"project": {"name": "x"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("정의된 BR 없음", out)

    def test_br_with_statement_and_rationale(self):
        spec = {
            "project": {"name": "x"},
            "domain": {
                "business_rules": [
                    {
                        "id": "BR-001",
                        "statement": "완료 선언은 증거 필요",
                        "rationale": "Iron Law",
                    }
                ]
            },
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("### BR-001", out)
        self.assertIn("완료 선언은 증거 필요", out)
        self.assertIn("Iron Law", out)

    def test_br_without_id_auto_numbered(self):
        spec = {
            "project": {"name": "x"},
            "domain": {
                "business_rules": [{"statement": "first rule"}, {"statement": "second"}]
            },
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("### BR-001", out)
        self.assertIn("### BR-002", out)

    def test_string_br_supported(self):
        spec = {
            "project": {"name": "x"},
            "domain": {"business_rules": ["naked string rule"]},
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("naked string rule", out)


class StakeholdersTests(unittest.TestCase):
    """v0.5 — render_domain 이 project.stakeholders[] 를 domain.md 에 렌더해야.

    Why: 14 expert agent 가 domain.md 만 참조하도록 하려면 페르소나가 여기 있어야.
    """

    def test_empty_shows_hint(self):
        spec = {"project": {"name": "x"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("## Stakeholders (0)", out)
        self.assertIn("정의된 stakeholder 없음", out)

    def test_role_and_description_rendered(self):
        spec = {
            "project": {
                "name": "x",
                "stakeholders": [
                    {"role": "project_initiator", "description": "재현성 · 감사성 · upgrade-safe"}
                ],
            },
            "domain": {},
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("## Stakeholders (1)", out)
        self.assertIn("### project_initiator", out)
        self.assertIn("재현성 · 감사성", out)

    def test_concerns_list_rendered(self):
        spec = {
            "project": {
                "name": "x",
                "stakeholders": [
                    {
                        "role": "ai_implementer",
                        "concerns": ["preamble 3 lines", "tool matrix enforced"],
                    }
                ],
            },
            "domain": {},
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("### ai_implementer", out)
        self.assertIn("**Concerns**:", out)
        self.assertIn("- preamble 3 lines", out)
        self.assertIn("- tool matrix enforced", out)

    def test_unnamed_stakeholder_fallback(self):
        spec = {
            "project": {"name": "x", "stakeholders": [{"description": "anon"}]},
            "domain": {},
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("### (unnamed)", out)

    def test_self_spec_has_five_personas(self):
        spec_path = REPO_ROOT / "docs" / "samples" / "harness-boot-self" / "spec.yaml"
        if not spec_path.is_file():
            self.skipTest(f"{spec_path} absent")
        spec = rd.load_spec(spec_path)
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("## Stakeholders (5)", out)
        for role in (
            "project_initiator",
            "ai_implementer",
            "future_user",
            "plugin_developer",
            "downstream_tooling",
        ):
            self.assertIn(f"### {role}", out)


class DecisionsRisksTests(unittest.TestCase):
    """v0.6 — render_domain 이 decisions[] · risks[] 를 domain.md 에 렌더해야.

    plan.md → Mode B-2 → spec.yaml.decisions/risks → domain.md Decisions/Risks 섹션.
    """

    def test_empty_decisions_shows_hint(self):
        spec = {"project": {"name": "x"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("## Decisions (0)", out)
        self.assertIn("정의된 ADR 없음", out)

    def test_empty_risks_shows_hint(self):
        spec = {"project": {"name": "x"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("## Risks (0)", out)
        self.assertIn("정의된 risk 없음", out)

    def test_decision_rendered_with_all_fields(self):
        spec = {
            "project": {"name": "x"},
            "domain": {},
            "decisions": [
                {
                    "id": "ADR-001",
                    "title": "Matter.js over Rapier",
                    "status": "accepted",
                    "tags": ["stack", "perf"],
                    "context": "물리 엔진 선택 필요.",
                    "decision": "Matter.js 0.20 사용.",
                    "consequences": "CDN 의존 ·Rapier 보다 성능 소폭 낮음.",
                }
            ],
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("## Decisions (1)", out)
        self.assertIn("### ADR-001 — Matter.js over Rapier", out)
        self.assertIn("**Status**: accepted", out)
        self.assertIn("stack, perf", out)
        self.assertIn("**Context**:", out)
        self.assertIn("**Decision**:", out)
        self.assertIn("**Consequences**:", out)

    def test_decision_supersedes_rendered(self):
        spec = {
            "project": {"name": "x"},
            "domain": {},
            "decisions": [
                {
                    "id": "ADR-002",
                    "title": "Switch to Rapier",
                    "decision": "Rapier 로 migration.",
                    "supersedes": ["ADR-001"],
                },
                {
                    "id": "ADR-001",
                    "title": "Use Matter.js",
                    "decision": "Matter.js.",
                    "status": "superseded",
                    "superseded_by": "ADR-002",
                },
            ],
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("**Supersedes**: ADR-001", out)
        self.assertIn("**Superseded by**: ADR-002", out)

    def test_risk_rendered_likelihood_impact(self):
        spec = {
            "project": {"name": "x"},
            "domain": {},
            "risks": [
                {
                    "id": "R-001",
                    "statement": "CDN 장애 시 게임 로드 실패",
                    "likelihood": "low",
                    "impact": "medium",
                    "mitigation": "local vendor + SRI",
                    "tags": ["stack"],
                }
            ],
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("## Risks (1)", out)
        self.assertIn("### R-001", out)
        self.assertIn("**Statement**: CDN 장애 시 게임 로드 실패", out)
        self.assertIn("low × medium", out)
        self.assertIn("**Mitigation**: local vendor + SRI", out)

    def test_risk_status_default_open(self):
        spec = {
            "project": {"name": "x"},
            "domain": {},
            "risks": [
                {
                    "id": "R-002",
                    "statement": "test",
                    "likelihood": "high",
                    "impact": "high",
                }
            ],
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("status: open", out)


class RealSpecSmokeTests(unittest.TestCase):
    SPEC = REPO_ROOT / "docs" / "samples" / "harness-boot-self" / "spec.yaml"

    def setUp(self):
        if not self.SPEC.is_file():
            self.skipTest(f"{self.SPEC} not present")

    def test_renders_without_error(self):
        spec = rd.load_spec(self.SPEC)
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("# harness-boot — Domain View", out)
        self.assertIn("Entities (", out)
        self.assertIn("Business Rules (", out)


class PlatformSectionTests(unittest.TestCase):
    """v0.7.4 — constraints.tech_stack → domain.md 의 ## Platform 섹션.

    Design-tier agents (visual-designer · a11y-auditor 등 Tier 1 only) 가
    플랫폼 맥락에 접근하려면 architecture.yaml(Tier 2) 대신 domain.md 에
    platform 정보가 있어야 한다.
    """

    def test_platform_section_absent_when_no_tech_stack(self):
        spec = {"project": {"name": "demo"}, "domain": {}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertNotIn("## Platform", out)

    def test_platform_section_present_with_tech_stack(self):
        spec = {
            "project": {"name": "demo"},
            "constraints": {
                "tech_stack": {
                    "runtime": "node",
                    "min_version": "20",
                    "language": "ts",
                    "test": "vitest",
                    "build": "vite",
                }
            },
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("## Platform", out)
        self.assertIn("node", out)
        self.assertIn("20", out)
        self.assertIn("vitest", out)
        self.assertIn("vite", out)

    def test_platform_section_before_stakeholders(self):
        """Design-tier agents read top-down — Platform must precede Stakeholders so
        they see target platforms before meeting the personas.
        """
        spec = {
            "project": {"name": "demo", "stakeholders": [{"role": "user"}]},
            "constraints": {"tech_stack": {"runtime": "browser"}},
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertLess(out.index("## Platform"), out.index("## Stakeholders"))

    def test_platform_handles_partial_fields(self):
        spec = {
            "project": {"name": "demo"},
            "constraints": {"tech_stack": {"runtime": "python"}},
        }
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertIn("## Platform", out)
        self.assertIn("python", out)

    def test_empty_tech_stack_skipped(self):
        spec = {"project": {"name": "demo"}, "constraints": {"tech_stack": {}}}
        out = rd.render(spec, timestamp=FIXED_TS)
        self.assertNotIn("## Platform", out)


if __name__ == "__main__":
    unittest.main()
