"""Project mode tests (v0.9.6) — prototype vs product ceremony lightening.

Covers:

- ``scripts/core/project_mode.py::resolve_mode`` — strict default, enum
  validation, malformed input handling.
- Kickoff template — 1 bullet per agent in prototype, 3 in product.
- Retro template — machine-only sections in prototype, full LLM-driven
  sections in product. Wire-up event metadata carries mode.
- Design-review autowire — skips prototype unless ``force=True``.
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "legacy" / "scripts"))

import work  # noqa: E402
from ceremonies import kickoff, retro  # noqa: E402
from core.project_mode import (  # noqa: E402
    DEFAULT_MODE,
    VALID_MODES,
    resolve_mode,
)


class ResolveModeTests(unittest.TestCase):
    def test_default_when_spec_none(self):
        self.assertEqual(resolve_mode(None), "product")

    def test_default_is_product(self):
        self.assertEqual(DEFAULT_MODE, "product")

    def test_valid_modes_set(self):
        self.assertEqual(VALID_MODES, frozenset({"prototype", "product"}))

    def test_default_when_no_project_block(self):
        self.assertEqual(resolve_mode({"version": "2.3.8"}), "product")

    def test_default_when_no_mode_field(self):
        spec = {"project": {"name": "x", "summary": "y"}}
        self.assertEqual(resolve_mode(spec), "product")

    def test_explicit_prototype(self):
        spec = {"project": {"name": "x", "summary": "y", "mode": "prototype"}}
        self.assertEqual(resolve_mode(spec), "prototype")

    def test_explicit_product(self):
        spec = {"project": {"name": "x", "summary": "y", "mode": "product"}}
        self.assertEqual(resolve_mode(spec), "product")

    def test_unknown_value_falls_back_to_product(self):
        spec = {"project": {"mode": "experimental"}}
        self.assertEqual(resolve_mode(spec), "product")

    def test_non_string_mode_falls_back(self):
        self.assertEqual(resolve_mode({"project": {"mode": 42}}), "product")
        self.assertEqual(resolve_mode({"project": {"mode": None}}), "product")

    def test_non_dict_project_falls_back(self):
        self.assertEqual(resolve_mode({"project": "string"}), "product")

    def test_non_dict_spec_falls_back(self):
        self.assertEqual(resolve_mode("string"), "product")  # type: ignore[arg-type]
        self.assertEqual(resolve_mode([1, 2]), "product")  # type: ignore[arg-type]


class KickoffLighteningTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.harness = Path(self._tmp.name) / ".harness"
        self.harness.mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _read_kickoff(self, fid: str) -> str:
        return (self.harness / "_workspace" / "kickoff" / f"{fid}.md").read_text(
            encoding="utf-8"
        )

    def _agent_sections(self, body: str) -> list[str]:
        """Split body into per-agent section bodies (text between '의 관점' headers)."""
        parts: list[str] = []
        chunks = body.split("\n## ")
        for chunk in chunks[1:]:  # skip preamble
            if "의 관점" in chunk.split("\n", 1)[0]:
                parts.append(chunk)
        return parts

    def _empty_bullet_count(self, section: str) -> int:
        """Count empty placeholder bullets ('- ' on its own line) within a section."""
        count = 0
        for line in section.splitlines():
            if line == "-" or line == "- ":
                count += 1
        return count

    def test_product_renders_three_bullets_per_agent(self):
        kickoff.generate_kickoff(
            self.harness,
            feature_id="F-1",
            shapes=["pure_domain_logic", "feature_completion"],
            mode="product",
        )
        body = self._read_kickoff("F-1")
        sections = self._agent_sections(body)
        # backend + software + qa + integrator + tech-writer + reviewer = 6
        self.assertEqual(len(sections), 6)
        for section in sections:
            self.assertEqual(self._empty_bullet_count(section), 3)
        self.assertIn("80 단어 내 3 bullet", body)
        self.assertIn("mode: `product`", body)

    def test_prototype_renders_one_bullet_per_agent(self):
        kickoff.generate_kickoff(
            self.harness,
            feature_id="F-1",
            shapes=["pure_domain_logic", "feature_completion"],
            mode="prototype",
        )
        body = self._read_kickoff("F-1")
        sections = self._agent_sections(body)
        self.assertEqual(len(sections), 6)
        for section in sections:
            self.assertEqual(self._empty_bullet_count(section), 1)
        self.assertIn("프로토타입 모드", body)
        self.assertIn("1 줄", body)
        self.assertIn("mode: `prototype`", body)

    def test_default_mode_is_product(self):
        kickoff.generate_kickoff(
            self.harness,
            feature_id="F-1",
            shapes=["pure_domain_logic", "feature_completion"],
        )
        body = self._read_kickoff("F-1")
        self.assertIn("mode: `product`", body)

    def test_mode_recorded_in_event(self):
        kickoff.generate_kickoff(
            self.harness,
            feature_id="F-1",
            shapes=["pure_domain_logic", "feature_completion"],
            mode="prototype",
        )
        events = [
            json.loads(l)
            for l in (self.harness / "events.log").read_text("utf-8").splitlines()
        ]
        kickoff_event = next(e for e in events if e["type"] == "kickoff_started")
        self.assertEqual(kickoff_event["mode"], "prototype")


class RetroLighteningTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.harness = Path(self._tmp.name) / ".harness"
        self.harness.mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _read_retro(self, fid: str) -> str:
        return (self.harness / "_workspace" / "retro" / f"{fid}.md").read_text(
            encoding="utf-8"
        )

    def test_product_renders_full_template(self):
        retro.generate_retro(self.harness, feature_id="F-1", mode="product")
        body = self._read_retro("F-1")
        for section in (
            "## What Shipped",
            "## First Gate to Fail",
            "## Ceremonies",
            "## Risks Materialized vs plan.md",
            "## Decisions Revised",
            "## Kickoff Predictions That Were Right / Wrong",
            "## Reviewer Reflection",
            "## Copy Polish",
        ):
            self.assertIn(section, body, f"missing section in product retro: {section}")

    def test_prototype_renders_only_machine_sections(self):
        retro.generate_retro(self.harness, feature_id="F-1", mode="prototype")
        body = self._read_retro("F-1")
        # Three machine sections present
        for section in (
            "## What Shipped",
            "## First Gate to Fail",
            "## Ceremonies",
        ):
            self.assertIn(section, body)
        # Five LLM sections absent
        for section in (
            "## Risks Materialized vs plan.md",
            "## Decisions Revised",
            "## Kickoff Predictions That Were Right / Wrong",
            "## Reviewer Reflection",
            "## Copy Polish",
        ):
            self.assertNotIn(section, body, f"prototype retro should not include: {section}")
        self.assertIn("프로토타입 모드", body)
        self.assertIn("mode: `prototype`", body)

    def test_default_mode_is_product(self):
        retro.generate_retro(self.harness, feature_id="F-1")
        body = self._read_retro("F-1")
        self.assertIn("Reviewer Reflection", body)

    def test_mode_recorded_in_event(self):
        retro.generate_retro(self.harness, feature_id="F-1", mode="prototype")
        events = [
            json.loads(l)
            for l in (self.harness / "events.log").read_text("utf-8").splitlines()
        ]
        ev = next(e for e in events if e["type"] == "feature_retro_written")
        self.assertEqual(ev["mode"], "prototype")


class DesignReviewSkipTests(unittest.TestCase):
    """Prototype mode skips design-review autowire unless force=True."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.harness = Path(self._tmp.name) / ".harness"
        self.harness.mkdir()
        # Seed flows.md and a UI feature spec — the other autowire conditions.
        flows_dir = self.harness / "_workspace" / "design"
        flows_dir.mkdir(parents=True)
        (flows_dir / "flows.md").write_text("# Flows\n", encoding="utf-8")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _write_spec(self, mode: str | None) -> None:
        spec = {
            "version": "2.3.8",
            "project": {"name": "x", "summary": "y"},
            "features": [
                {
                    "id": "F-1",
                    "name": "ui-feature",
                    "ui_surface": {"present": True},
                }
            ],
        }
        if mode:
            spec["project"]["mode"] = mode
        (self.harness / "spec.yaml").write_text(
            yaml.safe_dump(spec, allow_unicode=True), encoding="utf-8"
        )

    def _review_path(self) -> Path:
        return self.harness / "_workspace" / "design-review" / "F-1.md"

    def test_product_mode_autowires(self):
        self._write_spec(mode="product")
        work.activate(self.harness, "F-1")
        self.assertTrue(self._review_path().is_file())

    def test_prototype_mode_skips_autowire(self):
        self._write_spec(mode="prototype")
        work.activate(self.harness, "F-1")
        self.assertFalse(
            self._review_path().is_file(),
            "prototype mode must not autowire design-review",
        )

    def test_prototype_mode_force_flag_overrides_skip(self):
        self._write_spec(mode="prototype")
        work.activate(self.harness, "F-1")
        # autowire skipped — confirm
        self.assertFalse(self._review_path().is_file())
        # explicit force via --design-review CLI path
        rc = work.main([
            "F-1",
            "--harness-dir", str(self.harness),
            "--design-review",
            "--json",
        ])
        self.assertEqual(rc, 0)
        self.assertTrue(self._review_path().is_file())


if __name__ == "__main__":
    unittest.main()
