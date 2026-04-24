"""v0.7 PR-α — work.py autowire kickoff on activate · retro on complete.

Contract:
  * activate fires kickoff.generate_kickoff when .harness/spec.yaml resolves
    to the feature with shape signals. Silent skip otherwise.
  * complete fires retro.generate_retro after state transitions to done.
    Silent skip if spec.yaml missing (symmetry with kickoff — autowire is a
    full-harness feature).
  * Existing tests that do not create spec.yaml keep passing.
"""

from __future__ import annotations

import json
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from ceremonies import kickoff as kk  # noqa: E402
import work  # noqa: E402


_SPEC_UI = textwrap.dedent(
    """\
    version: "2.3.8"
    project:
      name: "demo"
    features:
      - id: F-0
        type: skeleton
        title: "Skeleton"
        ui_surface:
          present: true
          platforms: [web]
          has_audio: false
        acceptance_criteria:
          - "AC-1: dev server boots"
        modules:
          - src/main.ts
    """
)


_SPEC_EMPTY_FEATURE = textwrap.dedent(
    """\
    version: "2.3.8"
    project:
      name: "demo"
    features:
      - id: F-0
        type: skeleton
        title: ""
        acceptance_criteria: []
        modules: []
    """
)


_SPEC_AUDIO_UI = textwrap.dedent(
    """\
    version: "2.3.8"
    project:
      name: "demo"
    features:
      - id: F-0
        type: skeleton
        title: "Audio UI"
        ui_surface:
          present: true
          platforms: [web]
          has_audio: true
        acceptance_criteria:
          - "AC-1: sounds play"
        modules:
          - src/audio.ts
    """
)


_SPEC_SENSITIVE = textwrap.dedent(
    """\
    version: "2.3.8"
    project:
      name: "demo"
    domain:
      entities:
        - name: "UserCredential"
          sensitive: true
    features:
      - id: F-0
        type: skeleton
        title: "Login flow"
        acceptance_criteria:
          - "AC-1: UserCredential stored"
        modules:
          - src/auth/login.ts
    """
)


class ScratchHarness:
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.harness = self.tmp / ".harness"
        self.harness.mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _write_spec(self, body: str) -> None:
        (self.harness / "spec.yaml").write_text(body, encoding="utf-8")

    def _events(self) -> list[dict]:
        log = self.harness / "events.log"
        if not log.is_file():
            return []
        return [json.loads(l) for l in log.read_text(encoding="utf-8").splitlines() if l.strip()]


class ShapeDetectionTests(unittest.TestCase):
    def test_baseline_empty_vague_when_all_empty(self):
        f = {"id": "F-0", "title": "", "acceptance_criteria": [], "modules": []}
        self.assertEqual(kk.detect_shapes(f), ["baseline-empty-vague"])

    def test_ui_surface_triggers_shape(self):
        f = {
            "id": "F-1",
            "title": "Login UI",
            "acceptance_criteria": ["AC-1"],
            "modules": ["src/ui.ts"],
            "ui_surface": {"present": True, "platforms": ["web"]},
        }
        shapes = kk.detect_shapes(f)
        self.assertIn("ui_surface.present", shapes)
        self.assertIn("feature_completion", shapes)
        self.assertNotIn("pure_domain_logic", shapes)

    def test_performance_budget_triggers_shape(self):
        f = {
            "id": "F-2",
            "title": "Fast path",
            "acceptance_criteria": ["AC-1"],
            "modules": ["src/fast.ts"],
            "performance_budget": {"lcp_ms": 2500},
        }
        shapes = kk.detect_shapes(f)
        self.assertIn("performance_budget", shapes)

    def test_sensitive_flag_on_feature(self):
        f = {
            "id": "F-3",
            "title": "Secret handler",
            "acceptance_criteria": ["AC-1"],
            "modules": ["src/secret.ts"],
            "sensitive": True,
        }
        self.assertIn("sensitive_or_auth", kk.detect_shapes(f))

    def test_sensitive_entity_reference(self):
        spec = {
            "domain": {"entities": [{"name": "UserCredential", "sensitive": True}]},
        }
        f = {
            "id": "F-4",
            "title": "Login flow",
            "acceptance_criteria": ["AC-1: UserCredential stored"],
            "modules": ["src/auth.ts"],
        }
        shapes = kk.detect_shapes(f, spec=spec)
        self.assertIn("sensitive_or_auth", shapes)

    def test_pure_domain_logic_default(self):
        f = {
            "id": "F-5",
            "title": "Pure calc",
            "acceptance_criteria": ["AC-1"],
            "modules": ["src/calc.ts"],
        }
        shapes = kk.detect_shapes(f)
        self.assertIn("pure_domain_logic", shapes)
        self.assertIn("feature_completion", shapes)

    def test_has_audio_reads_ui(self):
        self.assertTrue(kk.has_audio({"ui_surface": {"has_audio": True}}))
        self.assertFalse(kk.has_audio({"ui_surface": {"has_audio": False}}))
        self.assertFalse(kk.has_audio({}))


class ActivateAutowireTests(ScratchHarness, unittest.TestCase):
    def test_activate_with_spec_fires_kickoff(self):
        self._write_spec(_SPEC_UI)
        work.activate(self.harness, "F-0")
        kickoff_path = self.harness / "_workspace" / "kickoff" / "F-0.md"
        self.assertTrue(kickoff_path.is_file(), "kickoff md should be created")
        types = [e["type"] for e in self._events()]
        self.assertIn("feature_activated", types)
        self.assertIn("kickoff_started", types)
        # activated must precede kickoff_started
        self.assertLess(types.index("feature_activated"), types.index("kickoff_started"))

    def test_kickoff_agents_include_ui_chain(self):
        self._write_spec(_SPEC_UI)
        work.activate(self.harness, "F-0")
        body = (self.harness / "_workspace" / "kickoff" / "F-0.md").read_text("utf-8")
        for agent in ("ux-architect", "visual-designer", "a11y-auditor", "frontend-engineer"):
            self.assertIn(agent, body, f"kickoff md must include {agent}")

    def test_has_audio_flag_propagates(self):
        self._write_spec(_SPEC_AUDIO_UI)
        work.activate(self.harness, "F-0")
        body = (self.harness / "_workspace" / "kickoff" / "F-0.md").read_text("utf-8")
        self.assertIn("audio-designer", body)

    def test_sensitive_entity_brings_security_engineer(self):
        self._write_spec(_SPEC_SENSITIVE)
        work.activate(self.harness, "F-0")
        body = (self.harness / "_workspace" / "kickoff" / "F-0.md").read_text("utf-8")
        self.assertIn("security-engineer", body)

    def test_activate_without_spec_silent_skip(self):
        """Backward compat: existing tests don't create spec.yaml — autowire must stay silent."""
        work.activate(self.harness, "F-0")
        self.assertFalse(
            (self.harness / "_workspace" / "kickoff").exists(),
            "no kickoff dir should be created without spec.yaml",
        )
        types = [e["type"] for e in self._events()]
        self.assertEqual(types, ["feature_activated"])

    def test_activate_with_empty_feature_fires_baseline(self):
        self._write_spec(_SPEC_EMPTY_FEATURE)
        work.activate(self.harness, "F-0")
        body = (self.harness / "_workspace" / "kickoff" / "F-0.md").read_text("utf-8")
        # baseline-empty-vague → researcher + product-planner
        self.assertIn("researcher", body)
        self.assertIn("product-planner", body)


class PerfGateBudgetIntegrationTests(ScratchHarness, unittest.TestCase):
    """v0.7.3 — gate_perf pass 시 feature.performance_budget 이 evidence summary 에 주입."""

    _SPEC_WITH_BUDGET = textwrap.dedent(
        """\
        version: "2.3.8"
        project:
          name: "demo"
        features:
          - id: F-0
            type: skeleton
            title: "Perf-sensitive"
            ui_surface:
              present: true
            performance_budget:
              lcp_ms: 2500
              inp_ms: 200
              bundle_kb: 180
              custom:
                - metric: "api_startup_ms"
                  budget: 300
            acceptance_criteria:
              - "AC-1: boots"
            modules:
              - src/main.ts
        """
    )

    def test_budget_appears_in_pass_evidence(self):
        self._write_spec(self._SPEC_WITH_BUDGET)
        work.activate(self.harness, "F-0")
        res = work.run_and_record_gate(
            self.harness,
            "F-0",
            "gate_perf",
            project_root=self.tmp,
            override_command=["true"],
        )
        self.assertEqual(res.message.split()[1], "PASS")
        # Find the gate_run evidence entry
        from core.state import State as _State
        st = _State.load(self.harness)
        ev = st.get_feature("F-0").get("evidence", [])
        gate_ev = [e for e in ev if e["kind"] == "gate_run"]
        self.assertEqual(len(gate_ev), 1)
        summary = gate_ev[0]["summary"]
        self.assertIn("budget:", summary)
        self.assertIn("lcp_ms=2500", summary)
        self.assertIn("api_startup_ms=300", summary)

    def test_non_perf_gate_has_no_budget_suffix(self):
        self._write_spec(self._SPEC_WITH_BUDGET)
        work.activate(self.harness, "F-0")
        res = work.run_and_record_gate(
            self.harness,
            "F-0",
            "gate_0",
            project_root=self.tmp,
            override_command=["true"],
        )
        from core.state import State as _State
        st = _State.load(self.harness)
        ev = st.get_feature("F-0").get("evidence", [])
        # The most recent gate_run for gate_0 should not include "budget:"
        gate_ev = [e for e in ev if e["kind"] == "gate_run"]
        self.assertTrue(gate_ev)
        self.assertNotIn("budget:", gate_ev[-1]["summary"])


class CompleteAutowireTests(ScratchHarness, unittest.TestCase):
    def _seed_done_precondition(self, fid: str) -> None:
        """Satisfy Iron Law: gate_5 pass + evidence ≥ 1."""
        work.activate(self.harness, fid)
        work.record_gate(self.harness, fid, "gate_5", "pass", note="smoke ok")
        work.add_evidence(self.harness, fid, "test", "smoke passes")

    def test_complete_with_spec_fires_retro(self):
        self._write_spec(_SPEC_UI)
        self._seed_done_precondition("F-0")
        res = work.complete(self.harness, "F-0")
        self.assertEqual(res.action, "completed")
        retro_path = self.harness / "_workspace" / "retro" / "F-0.md"
        self.assertTrue(retro_path.is_file(), "retro md should be created")
        types = [e["type"] for e in self._events()]
        self.assertIn("feature_done", types)
        self.assertIn("feature_retro_written", types)
        self.assertLess(types.index("feature_done"), types.index("feature_retro_written"))

    def test_complete_without_spec_silent_skip(self):
        self._seed_done_precondition("F-0")
        res = work.complete(self.harness, "F-0")
        self.assertEqual(res.action, "completed")
        self.assertFalse(
            (self.harness / "_workspace" / "retro").exists(),
            "no retro dir without spec.yaml",
        )
        types = [e["type"] for e in self._events()]
        self.assertNotIn("feature_retro_written", types)


if __name__ == "__main__":
    unittest.main()
