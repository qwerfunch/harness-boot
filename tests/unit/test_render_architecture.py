"""Tests for scripts/render/architecture.py (v0.7.5 relocated from scripts/render_architecture.py)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "legacy" / "scripts"))

from render import architecture as ra  # noqa: E402


FIXED_TS = "2026-04-23T05:00:00Z"


def parse(output: str) -> dict:
    if yaml is None:
        raise unittest.SkipTest("pyyaml required")
    return yaml.safe_load(output)


class BasicRenderTests(unittest.TestCase):
    def test_minimal_spec(self):
        spec = {"version": "2.3.8", "project": {"name": "p"}, "features": []}
        out = ra.render(spec, timestamp=FIXED_TS)
        d = parse(out)
        self.assertEqual(d["version"], "2.3.8")
        self.assertEqual(d["generated_at"], FIXED_TS)
        self.assertEqual(d["from_spec"], "spec.yaml")

    def test_determinism(self):
        spec = {
            "version": "2.3",
            "features": [
                {"id": "F-1", "modules": ["a", "b"]},
                {"id": "F-2", "modules": ["b", "c"]},
            ],
        }
        out1 = ra.render(spec, timestamp=FIXED_TS)
        out2 = ra.render(spec, timestamp=FIXED_TS)
        self.assertEqual(out1, out2)


class TechStackTests(unittest.TestCase):
    def test_tech_stack_rendered(self):
        spec = {
            "version": "2.3",
            "constraints": {"tech_stack": {"lang": "python", "runtime": "3.11"}},
            "features": [],
        }
        out = ra.render(spec, timestamp=FIXED_TS)
        d = parse(out)
        self.assertEqual(d["tech_stack"], {"lang": "python", "runtime": "3.11"})

    def test_empty_tech_stack_omitted(self):
        spec = {"version": "2.3", "constraints": {"tech_stack": {}}, "features": []}
        out = ra.render(spec, timestamp=FIXED_TS)
        d = parse(out)
        self.assertNotIn("tech_stack", d)


class DeliverableTests(unittest.TestCase):
    def test_deliverable_preserved(self):
        spec = {
            "version": "2.3",
            "deliverable": {"type": "cli", "entry_points": ["bin/x"]},
            "features": [],
        }
        out = ra.render(spec, timestamp=FIXED_TS)
        d = parse(out)
        self.assertEqual(d["deliverable"]["type"], "cli")
        self.assertEqual(d["deliverable"]["entry_points"], ["bin/x"])


class ModulesIndexTests(unittest.TestCase):
    def test_modules_inverted_from_features(self):
        spec = {
            "version": "2.3",
            "features": [
                {"id": "F-1", "modules": ["shared", "only_a"]},
                {"id": "F-2", "modules": ["shared"]},
            ],
        }
        out = ra.render(spec, timestamp=FIXED_TS)
        d = parse(out)
        modules = {m["name"]: m["owners"] for m in d["modules"]}
        self.assertEqual(modules["shared"], ["F-1", "F-2"])
        self.assertEqual(modules["only_a"], ["F-1"])

    def test_sorted_by_module_name(self):
        spec = {
            "version": "2.3",
            "features": [{"id": "F-1", "modules": ["zebra", "alpha", "middle"]}],
        }
        out = ra.render(spec, timestamp=FIXED_TS)
        d = parse(out)
        names = [m["name"] for m in d["modules"]]
        self.assertEqual(names, sorted(names))

    def test_dict_form_module(self):
        spec = {
            "version": "2.3",
            "features": [{"id": "F-1", "modules": [{"name": "x", "kind": "core"}]}],
        }
        out = ra.render(spec, timestamp=FIXED_TS)
        d = parse(out)
        self.assertEqual(d["modules"][0]["name"], "x")


class MetadataPassthroughTests(unittest.TestCase):
    def test_contribution_points(self):
        spec = {
            "version": "2.3",
            "features": [],
            "metadata": {"contribution_points": [{"kind": "command", "id": "init"}]},
        }
        out = ra.render(spec, timestamp=FIXED_TS)
        d = parse(out)
        self.assertEqual(len(d["contribution_points"]), 1)

    def test_host_binding(self):
        spec = {
            "version": "2.3",
            "features": [],
            "metadata": {"host_binding": {"host": "claude-code", "min_version": "2.1"}},
        }
        out = ra.render(spec, timestamp=FIXED_TS)
        d = parse(out)
        self.assertEqual(d["host_binding"]["host"], "claude-code")

    def test_missing_metadata_ok(self):
        spec = {"version": "2.3", "features": []}
        out = ra.render(spec, timestamp=FIXED_TS)
        d = parse(out)
        self.assertNotIn("contribution_points", d)
        self.assertNotIn("host_binding", d)


class FeatureGraphTests(unittest.TestCase):
    def test_graph_preserves_feature_order(self):
        spec = {
            "version": "2.3",
            "features": [
                {"id": "F-1", "modules": ["a"]},
                {"id": "F-2", "modules": ["b"], "depends_on": ["F-1"]},
            ],
        }
        out = ra.render(spec, timestamp=FIXED_TS)
        d = parse(out)
        ids = [x["id"] for x in d["feature_graph"]]
        self.assertEqual(ids, ["F-1", "F-2"])

    def test_depends_on_carried(self):
        spec = {
            "version": "2.3",
            "features": [
                {"id": "F-1"},
                {"id": "F-2", "depends_on": ["F-1"]},
            ],
        }
        out = ra.render(spec, timestamp=FIXED_TS)
        d = parse(out)
        f2 = next(x for x in d["feature_graph"] if x["id"] == "F-2")
        self.assertEqual(f2["depends_on"], ["F-1"])

    def test_status_carried(self):
        spec = {
            "version": "2.3",
            "features": [{"id": "F-1", "status": "done"}],
        }
        out = ra.render(spec, timestamp=FIXED_TS)
        d = parse(out)
        self.assertEqual(d["feature_graph"][0]["status"], "done")


class RealSpecSmokeTests(unittest.TestCase):
    SPEC = REPO_ROOT / "docs" / "samples" / "harness-boot-self" / "spec.yaml"

    def setUp(self):
        if not self.SPEC.is_file():
            self.skipTest(f"{self.SPEC} not present")

    def test_renders_without_error(self):
        spec = ra.load_spec(self.SPEC)
        out = ra.render(spec, timestamp=FIXED_TS)
        d = parse(out)
        self.assertIn("feature_graph", d)
        self.assertIn("host_binding", d)
        self.assertTrue(len(d["feature_graph"]) >= 20)

    def test_modules_include_plugin_root_resolver(self):
        """F-003 은 modules 에 plugin_root_resolver 가 있어야 함 (v0.1.1 smoke findings)."""
        spec = ra.load_spec(self.SPEC)
        out = ra.render(spec, timestamp=FIXED_TS)
        d = parse(out)
        module_names = [m["name"] for m in d["modules"]]
        self.assertIn("plugin_root_resolver", module_names)


if __name__ == "__main__":
    unittest.main()
