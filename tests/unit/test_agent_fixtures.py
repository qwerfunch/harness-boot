"""v0.7.2 — parametric agent-eval fixture schema check.

Every directory under `tests/fixtures/agent-evals/` must ship:
  - input.md — representative brief the agent receives.
  - expected-structure.yaml — contract declaring the required output shape.

This test does **not** invoke Claude. It ensures the fixtures themselves
stay coherent so a future LLM-backed eval harness can compare real output
against the declared contract without hunting for missing keys.

Adding coverage is as simple as dropping a new fixture directory; the test
auto-discovers. Contract schema below documents what each fixture must
declare.
"""

from __future__ import annotations

import unittest
from pathlib import Path

try:
    import yaml
except ImportError:
    raise ImportError("pyyaml required")


REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_ROOT = REPO_ROOT / "tests" / "fixtures" / "agent-evals"
AGENTS_DIR = REPO_ROOT / "agents"


_COMMON_REQUIRED_KEYS = ("agent", "output_path", "forbidden_phrases")

# Per-producer-type required keys. v0.7.4 — fixtures can declare
# producer_type: markdown (default · fallback for backward compat with v0.7.2
# fixtures that omit the field), yaml, code.
_PRODUCER_KEYS: dict[str, tuple[str, ...]] = {
    "markdown": ("required_sections_in_order",),
    "yaml": ("required_top_keys",),
    "code": ("required_file_patterns",),
}


def _fixture_dirs() -> list[Path]:
    if not FIXTURE_ROOT.is_dir():
        return []
    return sorted(p for p in FIXTURE_ROOT.iterdir() if p.is_dir())


class FixtureDiscoveryTests(unittest.TestCase):
    def test_at_least_one_fixture_present(self):
        """Regression guard — a collapsed fixtures tree should not pass silently."""
        self.assertGreater(
            len(_fixture_dirs()), 0,
            f"expected at least one fixture under {FIXTURE_ROOT}",
        )

    def test_each_fixture_matches_known_agent(self):
        """Fixture directory name must correspond to an actual agent file."""
        agent_files = {p.stem for p in AGENTS_DIR.glob("*.md") if p.stem != "README"}
        for d in _fixture_dirs():
            self.assertIn(
                d.name, agent_files,
                f"fixture {d.name} has no matching agents/{d.name}.md",
            )


class FixtureContractTests(unittest.TestCase):
    def test_every_fixture_has_input_md(self):
        for d in _fixture_dirs():
            self.assertTrue(
                (d / "input.md").is_file(),
                f"{d.name}: missing input.md",
            )

    def test_every_fixture_has_expected_structure_yaml(self):
        for d in _fixture_dirs():
            path = d / "expected-structure.yaml"
            self.assertTrue(path.is_file(), f"{d.name}: missing expected-structure.yaml")
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
            self.assertIsInstance(
                data, dict,
                f"{d.name}: expected-structure.yaml root must be a mapping",
            )

    def test_common_required_keys_present(self):
        for d in _fixture_dirs():
            data = yaml.safe_load((d / "expected-structure.yaml").read_text(encoding="utf-8"))
            for key in _COMMON_REQUIRED_KEYS:
                self.assertIn(
                    key, data,
                    f"{d.name}/expected-structure.yaml: missing common key {key!r}",
                )

    def test_producer_type_specific_keys(self):
        """producer_type 에 따라 요구 키가 다르다 (markdown/yaml/code)."""
        for d in _fixture_dirs():
            data = yaml.safe_load((d / "expected-structure.yaml").read_text(encoding="utf-8"))
            ptype = data.get("producer_type", "markdown")
            self.assertIn(
                ptype, _PRODUCER_KEYS,
                f"{d.name}: producer_type {ptype!r} must be one of {list(_PRODUCER_KEYS)}",
            )
            for key in _PRODUCER_KEYS[ptype]:
                self.assertIn(
                    key, data,
                    f"{d.name} (producer_type={ptype}): missing key {key!r}",
                )

    def test_agent_field_matches_directory(self):
        for d in _fixture_dirs():
            data = yaml.safe_load((d / "expected-structure.yaml").read_text(encoding="utf-8"))
            self.assertEqual(
                data["agent"], d.name,
                f"{d.name}: expected-structure.agent ({data['agent']!r}) mismatch",
            )

    def test_required_sections_nonempty_and_markdown_heading(self):
        """Sections must be H2 or H3 markdown headings. Applies only when producer_type=markdown."""
        for d in _fixture_dirs():
            data = yaml.safe_load((d / "expected-structure.yaml").read_text(encoding="utf-8"))
            if data.get("producer_type", "markdown") != "markdown":
                continue
            sections = data["required_sections_in_order"]
            self.assertIsInstance(sections, list, f"{d.name}: required_sections must be a list")
            self.assertGreater(len(sections), 0, f"{d.name}: empty required_sections")
            for s in sections:
                self.assertTrue(
                    isinstance(s, str) and (s.startswith("## ") or s.startswith("### ")),
                    f"{d.name}: section {s!r} must be markdown H2/H3",
                )

    def test_yaml_top_keys_are_dotted_strings(self):
        """yaml producers: required_top_keys is a list of strings like 'color' or 'space/card'."""
        for d in _fixture_dirs():
            data = yaml.safe_load((d / "expected-structure.yaml").read_text(encoding="utf-8"))
            if data.get("producer_type") != "yaml":
                continue
            keys = data["required_top_keys"]
            self.assertIsInstance(keys, list, f"{d.name}: required_top_keys must be list")
            self.assertGreater(len(keys), 0, f"{d.name}: empty required_top_keys")
            for k in keys:
                self.assertIsInstance(k, str, f"{d.name}: key {k!r} must be string")

    def test_code_patterns_are_glob_strings(self):
        """code producers: required_file_patterns is a list of path patterns (src/... · tests/...)."""
        for d in _fixture_dirs():
            data = yaml.safe_load((d / "expected-structure.yaml").read_text(encoding="utf-8"))
            if data.get("producer_type") != "code":
                continue
            patterns = data["required_file_patterns"]
            self.assertIsInstance(patterns, list, f"{d.name}: required_file_patterns must be list")
            self.assertGreater(len(patterns), 0, f"{d.name}: empty required_file_patterns")
            for p in patterns:
                self.assertIsInstance(p, str, f"{d.name}: pattern {p!r} must be string")
                self.assertTrue(
                    "/" in p or "." in p,
                    f"{d.name}: pattern {p!r} should look like a path",
                )

    def test_forbidden_phrases_list_of_strings(self):
        for d in _fixture_dirs():
            data = yaml.safe_load((d / "expected-structure.yaml").read_text(encoding="utf-8"))
            forbidden = data["forbidden_phrases"]
            self.assertIsInstance(forbidden, list, f"{d.name}: forbidden_phrases must be list")
            for p in forbidden:
                self.assertIsInstance(p, str, f"{d.name}: forbidden_phrases entries must be strings")

    def test_output_path_string_or_null(self):
        for d in _fixture_dirs():
            data = yaml.safe_load((d / "expected-structure.yaml").read_text(encoding="utf-8"))
            val = data["output_path"]
            self.assertTrue(
                val is None or isinstance(val, str),
                f"{d.name}: output_path must be string or null (advisory agents use null)",
            )


if __name__ == "__main__":
    unittest.main()
