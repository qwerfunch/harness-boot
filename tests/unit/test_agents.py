"""Plugin-shipped sub-agents — frontmatter contract validation (F-023 AC + F-012)."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

try:
    import yaml
except ImportError:
    raise ImportError("pyyaml required")


REPO_ROOT = Path(__file__).resolve().parents[2]
AGENTS_DIR = REPO_ROOT / "agents"

# Core agents that must ship with v0.4+
_REQUIRED_AGENTS = {"orchestrator", "software-engineer", "reviewer"}

# v0.5 expert pool — 13 agents across Stage D/X/E/Q/I.
_EXPERT_AGENTS = (
    "researcher",
    "product-planner",
    "ux-architect",
    "visual-designer",
    "audio-designer",
    "a11y-auditor",
    "frontend-engineer",
    "backend-engineer",
    "security-engineer",
    "performance-engineer",
    "qa-engineer",
    "integrator",
    "tech-writer",
)

# Stage D (Discovery) agents operate before any domain.md exists,
# so they are exempt from the "spec.yaml direct-read ban" (there IS no
# spec.yaml yet when they run). They still mention domain.md because
# they gracefully read it in update/refine mode.
_DISCOVERY_EXEMPT: set[str] = {"researcher", "product-planner"}

# Permission matrix: allowed tools per agent (F-012 AC-2 contract).
# reviewer is strictly read-only; software-engineer is restricted from
# shared-system mutation; orchestrator is broad.
_REVIEWER_ALLOWED = {"Read", "Grep", "Glob", "Bash"}
_SOFTWARE_ENGINEER_FORBIDDEN = {"Agent"}  # software-engineer shouldn't spawn further agents
# orchestrator has no forbidden tools (coordinator)

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)


def _load_agent(name: str) -> dict:
    path = AGENTS_DIR / f"{name}.md"
    text = path.read_text(encoding="utf-8")
    match = _FRONTMATTER_RE.match(text)
    if not match:
        raise AssertionError(f"{path}: no YAML frontmatter")
    return yaml.safe_load(match.group(1))


class AgentsDirectoryTests(unittest.TestCase):
    """F-023: agents/ 디렉터리 인프라."""

    def test_agents_dir_exists(self):
        self.assertTrue(AGENTS_DIR.is_dir(), f"missing: {AGENTS_DIR}")

    def test_readme_exists(self):
        self.assertTrue((AGENTS_DIR / "README.md").is_file())

    def test_required_agents_shipped(self):
        shipped = {p.stem for p in AGENTS_DIR.glob("*.md") if p.stem != "README"}
        missing = _REQUIRED_AGENTS - shipped
        self.assertFalse(missing, f"missing core agents: {missing}")


class AgentFrontmatterTests(unittest.TestCase):
    """F-023: 각 에이전트 frontmatter 필수 필드 + 형식."""

    def test_each_agent_has_name_and_description(self):
        for name in _REQUIRED_AGENTS:
            fm = _load_agent(name)
            self.assertIn("name", fm, f"{name}: missing 'name'")
            self.assertEqual(
                fm["name"], name,
                f"{name}: frontmatter.name ({fm['name']!r}) != filename stem",
            )
            self.assertIn("description", fm, f"{name}: missing 'description'")
            self.assertIsInstance(fm["description"], str)
            self.assertGreater(
                len(fm["description"].strip()), 40,
                f"{name}: description too short for trigger precision",
            )

    def test_each_agent_declares_tools(self):
        """F-012 AC: tools allow-list must be explicit for permission enforcement."""
        for name in _REQUIRED_AGENTS:
            fm = _load_agent(name)
            self.assertIn("tools", fm, f"{name}: missing 'tools'")
            self.assertIsInstance(fm["tools"], list)
            self.assertGreater(len(fm["tools"]), 0, f"{name}: empty tools list")


class PermissionMatrixTests(unittest.TestCase):
    """F-012 AC-2: 권한 매트릭스가 각 에이전트 declared tools 와 일치."""

    def test_reviewer_is_read_only(self):
        fm = _load_agent("reviewer")
        tools = set(fm["tools"])
        self.assertEqual(
            tools, _REVIEWER_ALLOWED,
            f"reviewer tools {tools} != expected {_REVIEWER_ALLOWED}",
        )
        # 직접 검증: Edit/Write 불포함
        self.assertNotIn("Edit", tools)
        self.assertNotIn("Write", tools)
        self.assertNotIn("NotebookEdit", tools)

    def test_software_engineer_forbids_agent_spawn(self):
        fm = _load_agent("software-engineer")
        tools = set(fm["tools"])
        # software-engineer 는 Agent tool 없음 (multi-step 은 orchestrator 책임)
        for forbidden in _SOFTWARE_ENGINEER_FORBIDDEN:
            self.assertNotIn(forbidden, tools, f"software-engineer has forbidden: {forbidden}")

    def test_software_engineer_has_write_permissions(self):
        fm = _load_agent("software-engineer")
        tools = set(fm["tools"])
        # TDD 수행을 위한 필수 tools
        for required in {"Read", "Write", "Edit", "Bash"}:
            self.assertIn(required, tools, f"software-engineer missing: {required}")

    def test_orchestrator_has_broad_access(self):
        fm = _load_agent("orchestrator")
        tools = set(fm["tools"])
        # orchestrator 는 delegation 이 핵심 → Agent tool 필수
        self.assertIn("Agent", tools)
        self.assertIn("Read", tools)
        self.assertIn("Bash", tools)


class PreambleConventionTests(unittest.TestCase):
    """BR-014: 각 에이전트 본문에 Preamble 3 줄 규약 + anti-rationalization 2 행 명시."""

    def test_each_agent_documents_preamble(self):
        for name in _REQUIRED_AGENTS:
            body = (AGENTS_DIR / f"{name}.md").read_text(encoding="utf-8")
            self.assertIn("## Preamble", body, f"{name}: missing Preamble section")
            self.assertIn("NO skip:", body, f"{name}: missing 'NO skip:' anti-rationalization")
            self.assertIn("NO shortcut:", body, f"{name}: missing 'NO shortcut:'")


class StyleGuideTests(unittest.TestCase):
    """Software-engineer agent 가 Google Python Style + ID-in-docstring 규칙을 문서화해야."""

    def test_software_engineer_references_google_python_style(self):
        body = (AGENTS_DIR / "software-engineer.md").read_text(encoding="utf-8")
        self.assertIn("Google Python Style Guide", body)

    def test_software_engineer_documents_id_in_docstring_rule(self):
        """Spec reference 는 docstring/주석, 이름은 도메인 의미."""
        body = (AGENTS_DIR / "software-engineer.md").read_text(encoding="utf-8")
        # 규칙 문구 존재
        self.assertIn("docstring", body.lower())
        # 반례 (금지 패턴) 가 문서화되어 있음
        self.assertIn("AC1_", body)  # bad-example 로 명시됨
        self.assertRegex(body, r"(금지|❌|avoid|bad)")


class ExpertAgentContractTests(unittest.TestCase):
    """v0.5 — expert pool 공통 계약 (Stage X/E/Q/I).

    - body 에 `## Context` 블록 + domain.md 단일 참조 문구.
    - Preamble 3 줄 + anti-rationalization 2 행 (BR-014).
    - Stage X/E/Q/I 는 spec.yaml 직접 읽기 금지 (Discovery 는 예외).
    """

    def test_each_expert_file_exists(self):
        for name in _EXPERT_AGENTS:
            self.assertTrue(
                (AGENTS_DIR / f"{name}.md").is_file(),
                f"missing expert agent: {name}.md",
            )

    def test_each_expert_has_valid_frontmatter(self):
        for name in _EXPERT_AGENTS:
            fm = _load_agent(name)
            self.assertEqual(fm.get("name"), name)
            self.assertGreater(len(fm.get("description", "").strip()), 40)
            self.assertIsInstance(fm.get("tools"), list)

    def test_each_expert_references_domain_md(self):
        for name in _EXPERT_AGENTS:
            body = (AGENTS_DIR / f"{name}.md").read_text(encoding="utf-8")
            self.assertIn("## Context", body, f"{name}: missing Context section")
            self.assertIn("domain.md", body, f"{name}: must anchor on domain.md")

    def test_each_expert_has_preamble(self):
        for name in _EXPERT_AGENTS:
            body = (AGENTS_DIR / f"{name}.md").read_text(encoding="utf-8")
            self.assertIn("## Preamble", body)
            self.assertIn("NO skip:", body)
            self.assertIn("NO shortcut:", body)

    def test_stage_xeqi_experts_forbid_direct_spec_read(self):
        """Stage X/E/Q/I body must explicitly forbid direct `spec.yaml` reads.

        Accepts the legacy Korean phrasing (`spec.yaml 직접 참조 금지`) and the
        F-041 native-English forms (e.g. ``Don't read spec.yaml directly``).
        Markdown emphasis (`**`/`*`) is stripped before matching.
        """
        for name in _EXPERT_AGENTS:
            if name in _DISCOVERY_EXEMPT:
                continue
            body = (AGENTS_DIR / f"{name}.md").read_text(encoding="utf-8")
            plain = body.replace("**", "").replace("*", "")
            self.assertRegex(
                plain,
                r"(?s)(?:`?spec\.yaml`?\s*직접\s*참조\s*금지"
                r"|(?:[Dd]on't|[Dd]o\s*not|[Nn]o).{0,120}?read.{0,120}?`?spec\.yaml`?"
                r"|`?spec\.yaml`?.{0,120}?(?:[Dd]on't|[Dd]o\s*not|[Nn]o).{0,120}?read)",
                f"{name}: must explicitly forbid direct spec.yaml read",
            )


class TierMappingTests(unittest.TestCase):
    """v0.6 — agent Context 가 자기 Tier 의 anchor 만 언급해야.

    효율성 규약: 모든 agent 가 모든 anchor 를 읽는 건 과도.
    - Tier 1 (domain.md): 모두 필수
    - Tier 2 (architecture.yaml): Engineering + Quality + Integration + Audit 만
    - Tier 3 (plan.md 원본): Docs(tech-writer) + Audit 만
    """

    _TIER_1_ONLY = ("ux-architect", "visual-designer", "audio-designer", "a11y-auditor")
    _TIER_1_PLUS_2 = (
        "software-engineer",
        "frontend-engineer",
        "backend-engineer",
        "security-engineer",
        "performance-engineer",
        "qa-engineer",
        "integrator",
    )
    _TIER_1_PLUS_3 = ("tech-writer",)
    _ALL_TIERS = ("reviewer",)

    def _body(self, name: str) -> str:
        return (AGENTS_DIR / f"{name}.md").read_text(encoding="utf-8")

    def _context_section(self, name: str) -> str:
        """Extract the ## Context block, with markdown emphasis stripped."""
        body = self._body(name)
        start = body.find("## Context")
        if start < 0:
            return ""
        rest = body[start:]
        end = rest.find("\n## ", 10)
        block = rest if end < 0 else rest[:end]
        return block.replace("**", "").replace("*", "")

    # F-041 — exclusion phrases now match Korean ("읽지 않" / "접근 금지") and
    # the native-English equivalents ("don't read" / "no access" / etc.).
    _EXCLUSION_RE = (
        r"(?:읽지\s*않|접근\s*금지"
        r"|[Dd]on't\s+read|[Dd]o\s*not\s+read|[Nn]o\s+(?:read|access)"
        r"|off-limits|out\s+of\s+(?:scope|the\s+allow-list)"
        r"|raw\s+`?architecture\.yaml`?|raw\s+`?plan\.md`?)"
    )

    def _has_exclusion_near(self, ctx: str, target: str) -> bool:
        """True if ``target`` (e.g. plan.md) appears within ~200 chars of an
        exclusion phrase, in either direction. Markdown emphasis already
        stripped; line breaks tolerated since context blocks wrap prose."""
        pre = re.compile(self._EXCLUSION_RE + r".{0,200}?" + re.escape(target), re.DOTALL)
        post = re.compile(re.escape(target) + r".{0,200}?" + self._EXCLUSION_RE, re.DOTALL)
        return bool(pre.search(ctx) or post.search(ctx))

    def test_design_agents_skip_architecture_and_plan(self):
        """Design-stage agents must not pull from architecture.yaml or plan.md.

        Either omit the file from Context entirely, or call out an explicit
        exclusion ("don't read" / "읽지 않음" / "off-limits" / "raw … not
        consumed"), in either direction relative to the filename.
        """
        for name in self._TIER_1_ONLY:
            ctx = self._context_section(name)
            self.assertIn("domain.md", ctx, f"{name}: Tier 1 required")
            if "architecture.yaml" in ctx:
                self.assertTrue(
                    self._has_exclusion_near(ctx, "architecture.yaml"),
                    f"{name}: architecture.yaml mention requires an explicit exclusion (Design stage)",
                )
            if "plan.md" in ctx:
                self.assertTrue(
                    self._has_exclusion_near(ctx, "plan.md"),
                    f"{name}: plan.md mention requires an explicit exclusion (Design stage)",
                )

    def test_engineering_quality_integration_read_architecture(self):
        """Tier 1+2 agents must reference architecture.yaml (positive) and exclude plan.md."""
        for name in self._TIER_1_PLUS_2:
            ctx = self._context_section(name)
            self.assertIn("domain.md", ctx, f"{name}: Tier 1 required")
            self.assertIn("architecture.yaml", ctx, f"{name}: Tier 2 required")
            if "plan.md" in ctx:
                self.assertTrue(
                    self._has_exclusion_near(ctx, "plan.md"),
                    f"{name}: plan.md mention requires an explicit exclusion (Tier 3 excluded)",
                )

    def test_techwriter_reads_plan_md_not_architecture(self):
        """tech-writer 는 Tier 1 + Tier 3."""
        for name in self._TIER_1_PLUS_3:
            ctx = self._context_section(name)
            self.assertIn("domain.md", ctx)
            self.assertIn("plan.md", ctx, f"{name}: Tier 3 required for ADR 원문 인용")

    def test_reviewer_reads_all_tiers(self):
        """reviewer 는 audit 이므로 전 Tier 접근 명시."""
        for name in self._ALL_TIERS:
            ctx = self._context_section(name)
            self.assertIn("domain.md", ctx)
            self.assertIn("architecture.yaml", ctx)
            self.assertIn("plan.md", ctx)

    def test_reviewer_retro_prose_handoff(self):
        """reviewer 는 retro.md 에 직접 write 하지 않음 — prose 반환 후 orchestrator 가 write.

        v0.6.1 정정 — 이전 "write 예외" 설계는 reviewer frontmatter tools 에
        Write 가 없어 enforce 불가 · CQS 위반 충돌. CQS 유지 + orchestrator 가 write.
        """
        body = self._body("reviewer")
        # CQS 엄격 유지 문구 필수
        self.assertIn("CQS", body)
        # retro 관련 설명 존재
        self.assertIn("retro", body)
        # Write 권한이 frontmatter 에 없다는 것도 확인 (핵심 안전장치)
        fm = _load_agent("reviewer")
        self.assertNotIn("Write", set(fm["tools"]))
        self.assertNotIn("Edit", set(fm["tools"]))


class UxArchitectReferenceFixtureTests(unittest.TestCase):
    """PR-D-ref — reference agent 의 fixture I/O 계약."""

    FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "agent-evals" / "ux-architect"

    def test_input_md_exists(self):
        self.assertTrue((self.FIXTURE_DIR / "input.md").is_file())

    def test_expected_structure_yaml_loads(self):
        data = yaml.safe_load(
            (self.FIXTURE_DIR / "expected-structure.yaml").read_text(encoding="utf-8")
        )
        self.assertEqual(data["agent"], "ux-architect")
        self.assertEqual(
            data["output_path"], ".harness/_workspace/design/flows.md"
        )

    def test_required_sections_complete_and_ordered(self):
        data = yaml.safe_load(
            (self.FIXTURE_DIR / "expected-structure.yaml").read_text(encoding="utf-8")
        )
        sections = data["required_sections_in_order"]
        self.assertEqual(len(sections), 6, "ux-architect must declare 6 sections")
        self.assertEqual(sections[0], "## Jobs-To-Be-Done")
        self.assertIn("## Heuristic Check", sections)
        self.assertIn("## a11y Prereq", sections)

    def test_forbidden_phrases_protect_downstream_agents(self):
        """forbidden_phrases 에 visual-designer 영역 키워드 포함되어야."""
        data = yaml.safe_load(
            (self.FIXTURE_DIR / "expected-structure.yaml").read_text(encoding="utf-8")
        )
        forbidden = data.get("forbidden_phrases", [])
        self.assertTrue(
            any("색" in p or "font-size" in p for p in forbidden),
            "ux-architect must forbid visual-designer territory words",
        )


if __name__ == "__main__":
    unittest.main()
