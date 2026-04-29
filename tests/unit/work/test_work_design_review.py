"""v0.8 PR-α — design-review auto-wire (last of 4 ceremonies).

Fires from any state-mutating work.py call when three AND conditions hold:

1. features[F-N].ui_surface.present == true
2. .harness/_workspace/design/flows.md exists (ux-architect delivered)
3. .harness/_workspace/design-review/F-N.md does NOT exist yet (idempotent)

Mirrors the kickoff/retro autowire pattern. Design-review is a content-driven
ceremony — it can't be tied to a single lifecycle event like activate/complete,
so we check readiness on every state-mutating call. Idempotence via condition
(3) makes repeated calls safe.
"""

from __future__ import annotations

import json
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "legacy" / "scripts"))

import work  # noqa: E402


_SPEC_UI = textwrap.dedent(
    """\
    version: "2.3.8"
    project:
      name: "demo"
    features:
      - id: F-0
        type: skeleton
        title: "UI"
        ui_surface:
          present: true
          platforms: [web]
          has_audio: false
        acceptance_criteria:
          - "AC-1: boots"
        modules:
          - src/main.ts
    """
)


_SPEC_UI_AUDIO = textwrap.dedent(
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
          - "AC-1: sounds"
        modules:
          - src/audio.ts
    """
)


_SPEC_NO_UI = textwrap.dedent(
    """\
    version: "2.3.8"
    project:
      name: "demo"
    features:
      - id: F-0
        type: skeleton
        title: "Pure logic"
        acceptance_criteria:
          - "AC-1: math"
        modules:
          - src/calc.ts
    """
)


class Scratch:
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.harness = self.tmp / ".harness"
        self.harness.mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _write_spec(self, body: str) -> None:
        (self.harness / "spec.yaml").write_text(body, encoding="utf-8")

    def _seed_flows(self, body: str = "# flows\n") -> None:
        flows = self.harness / "_workspace" / "design" / "flows.md"
        flows.parent.mkdir(parents=True, exist_ok=True)
        flows.write_text(body, encoding="utf-8")

    def _events(self) -> list[dict]:
        log = self.harness / "events.log"
        if not log.is_file():
            return []
        return [json.loads(l) for l in log.read_text(encoding="utf-8").splitlines() if l.strip()]

    def _review_path(self, fid: str) -> Path:
        return self.harness / "_workspace" / "design-review" / f"{fid}.md"


class AutoFireConditionsTests(Scratch, unittest.TestCase):
    def test_all_conditions_met_fires_on_activate(self):
        self._write_spec(_SPEC_UI)
        self._seed_flows()
        work.activate(self.harness, "F-0")
        self.assertTrue(self._review_path("F-0").is_file())
        types = [e["type"] for e in self._events()]
        self.assertIn("design_review_opened", types)

    def test_flows_missing_skips(self):
        """flows.md 부재 → design-review 발화 안 함."""
        self._write_spec(_SPEC_UI)
        work.activate(self.harness, "F-0")
        self.assertFalse(self._review_path("F-0").exists())
        types = [e["type"] for e in self._events()]
        self.assertNotIn("design_review_opened", types)

    def test_ui_surface_false_skips(self):
        """ui_surface.present != true → design-review 의미 없음, skip."""
        self._write_spec(_SPEC_NO_UI)
        self._seed_flows()
        work.activate(self.harness, "F-0")
        self.assertFalse(self._review_path("F-0").exists())

    def test_idempotent_on_existing_file(self):
        """design-review/F-N.md 가 이미 있으면 덮어쓰지 않음."""
        self._write_spec(_SPEC_UI)
        self._seed_flows()
        work.activate(self.harness, "F-0")
        self.assertTrue(self._review_path("F-0").is_file())
        stat1 = self._review_path("F-0").stat()

        # Second activate (or any state-mutating call) must not re-write
        work.record_gate(self.harness, "F-0", "gate_0", "pass")
        stat2 = self._review_path("F-0").stat()
        self.assertEqual(stat1.st_mtime_ns, stat2.st_mtime_ns)

        # Only one design_review_opened event emitted
        opens = [e for e in self._events() if e["type"] == "design_review_opened"]
        self.assertEqual(len(opens), 1)

    def test_spec_missing_silent_skip(self):
        """Backward compat: no spec.yaml → autowire silent."""
        self._seed_flows()
        work.activate(self.harness, "F-0")
        self.assertFalse(self._review_path("F-0").exists())


class MultipleTriggerPointsTests(Scratch, unittest.TestCase):
    """State-mutating calls 전부가 readiness 체크 지점이어야 함."""

    def test_fires_on_record_gate_if_conditions_become_ready(self):
        """flows.md 가 activate 시점엔 없었지만 record_gate 시점에 생겼으면 그때 발화."""
        self._write_spec(_SPEC_UI)
        # activate WITHOUT flows.md — no fire
        work.activate(self.harness, "F-0")
        self.assertFalse(self._review_path("F-0").exists())

        # ux-architect delivers flows.md between calls
        self._seed_flows()

        # next state-mutating call → autofire
        work.record_gate(self.harness, "F-0", "gate_0", "pass")
        self.assertTrue(self._review_path("F-0").is_file())

    def test_fires_on_add_evidence(self):
        self._write_spec(_SPEC_UI)
        work.activate(self.harness, "F-0")
        self._seed_flows()
        work.add_evidence(self.harness, "F-0", "test", "smoke ok")
        self.assertTrue(self._review_path("F-0").is_file())

    def test_fires_on_run_and_record_gate(self):
        self._write_spec(_SPEC_UI)
        work.activate(self.harness, "F-0")
        self._seed_flows()
        work.run_and_record_gate(
            self.harness, "F-0", "gate_0",
            project_root=self.tmp, override_command=["true"],
        )
        self.assertTrue(self._review_path("F-0").is_file())


class HasAudioPropagationTests(Scratch, unittest.TestCase):
    def test_has_audio_triggers_audio_designer_in_template(self):
        self._write_spec(_SPEC_UI_AUDIO)
        self._seed_flows()
        work.activate(self.harness, "F-0")
        body = self._review_path("F-0").read_text(encoding="utf-8")
        self.assertIn("audio-designer", body)


class ForceReGenerateFlagTests(Scratch, unittest.TestCase):
    def test_design_review_flag_overwrites_existing(self):
        """CLI --design-review 는 idempotent 를 뚫고 재생성."""
        self._write_spec(_SPEC_UI)
        self._seed_flows()
        work.activate(self.harness, "F-0")
        path = self._review_path("F-0")
        self.assertTrue(path.is_file())

        # Tamper with existing file to verify overwrite
        path.write_text("STALE_CONTENT\n", encoding="utf-8")
        self.assertEqual(path.read_text("utf-8"), "STALE_CONTENT\n")

        # Explicit regenerate via CLI
        rc = work.main([
            "F-0",
            "--harness-dir", str(self.harness),
            "--design-review",
            "--json",
        ])
        self.assertEqual(rc, 0)
        body = path.read_text("utf-8")
        self.assertNotIn("STALE_CONTENT", body)
        self.assertIn("Design Review", body)


if __name__ == "__main__":
    unittest.main()
