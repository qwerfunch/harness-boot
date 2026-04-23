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


if __name__ == "__main__":
    unittest.main()
