"""v0.7.1 — activate UX gaps + deactivate/remove subcommands.

Gaps surfaced during v0.7.0 smoke test:
  1. `activate` creates ghost features when F-N is not in spec.yaml — should warn.
  2. Activating a new feature while another is still in_progress — no warning.
  3. No subcommand to clear active feature or remove a ghost entry.
"""

from __future__ import annotations

import io
import json
import sys
import tempfile
import textwrap
import unittest
from contextlib import redirect_stderr
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import work  # noqa: E402
from core.state import State  # noqa: E402


_SPEC_WITH_F0 = textwrap.dedent(
    """\
    version: "2.3.8"
    project:
      name: "demo"
    features:
      - id: F-0
        type: skeleton
        title: "Skeleton"
        acceptance_criteria:
          - "AC-1: boots"
        modules:
          - src/main.ts
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


class GhostFeatureWarningTests(ScratchHarness, unittest.TestCase):
    def test_activate_warns_when_feature_not_in_spec(self):
        self._write_spec(_SPEC_WITH_F0)
        buf = io.StringIO()
        with redirect_stderr(buf):
            work.activate(self.harness, "F-99")
        err = buf.getvalue()
        self.assertIn("F-99", err)
        self.assertIn("spec.yaml", err.lower())
        # Still proceeds (backward compat) — feature lands in state
        st = State.load(self.harness)
        self.assertIsNotNone(st.get_feature("F-99"))

    def test_activate_silent_when_feature_in_spec(self):
        self._write_spec(_SPEC_WITH_F0)
        buf = io.StringIO()
        with redirect_stderr(buf):
            work.activate(self.harness, "F-0")
        # No ghost warning when feature is defined
        self.assertNotIn("spec.yaml", buf.getvalue().lower())

    def test_activate_silent_when_spec_absent(self):
        """Backward compat — no spec means we can't check, so no warning."""
        buf = io.StringIO()
        with redirect_stderr(buf):
            work.activate(self.harness, "F-0")
        self.assertNotIn("spec.yaml", buf.getvalue().lower())


class ConcurrentInProgressWarningTests(ScratchHarness, unittest.TestCase):
    def test_activate_warns_when_other_feature_in_progress(self):
        # Prime: F-0 in_progress
        work.activate(self.harness, "F-0")
        buf = io.StringIO()
        with redirect_stderr(buf):
            work.activate(self.harness, "F-1")
        err = buf.getvalue()
        self.assertIn("F-0", err)
        self.assertIn("in_progress", err)

    def test_activate_silent_when_no_other_in_progress(self):
        buf = io.StringIO()
        with redirect_stderr(buf):
            work.activate(self.harness, "F-0")
        # First activation of anything — no concurrent warning
        self.assertNotIn("in_progress", buf.getvalue())


class DeactivateTests(ScratchHarness, unittest.TestCase):
    def test_deactivate_clears_active(self):
        work.activate(self.harness, "F-0")
        st = State.load(self.harness)
        self.assertEqual(st.data["session"]["active_feature_id"], "F-0")

        res = work.deactivate(self.harness)
        self.assertEqual(res.action, "deactivated")
        self.assertEqual(res.feature_id, "F-0")

        st = State.load(self.harness)
        self.assertIsNone(st.data["session"]["active_feature_id"])

    def test_deactivate_preserves_feature_status(self):
        """Status is untouched — only session pointer cleared."""
        work.activate(self.harness, "F-0")
        work.deactivate(self.harness)
        st = State.load(self.harness)
        f = st.get_feature("F-0")
        self.assertEqual(f["status"], "in_progress")

    def test_deactivate_emits_event(self):
        work.activate(self.harness, "F-0")
        work.deactivate(self.harness)
        types = [e["type"] for e in self._events()]
        self.assertIn("feature_deactivated", types)
        # Event preserves which feature was cleared
        ev = next(e for e in self._events() if e["type"] == "feature_deactivated")
        self.assertEqual(ev["feature"], "F-0")

    def test_deactivate_noop_when_no_active(self):
        res = work.deactivate(self.harness)
        self.assertEqual(res.action, "queried")
        # No event appended
        types = [e["type"] for e in self._events()]
        self.assertNotIn("feature_deactivated", types)


class RemoveFeatureTests(ScratchHarness, unittest.TestCase):
    def test_remove_deletes_state_entry(self):
        work.activate(self.harness, "F-99")  # create ghost
        st = State.load(self.harness)
        self.assertIsNotNone(st.get_feature("F-99"))

        res = work.remove_feature(self.harness, "F-99")
        self.assertEqual(res.action, "removed")
        self.assertEqual(res.feature_id, "F-99")

        st = State.load(self.harness)
        self.assertIsNone(st.get_feature("F-99"))

    def test_remove_clears_active_when_matching(self):
        work.activate(self.harness, "F-99")
        work.remove_feature(self.harness, "F-99")
        st = State.load(self.harness)
        self.assertIsNone(st.data["session"]["active_feature_id"])

    def test_remove_preserves_active_when_not_matching(self):
        work.activate(self.harness, "F-0")
        work.activate(self.harness, "F-99")  # F-99 now active, F-0 still in_progress
        work.remove_feature(self.harness, "F-0")
        st = State.load(self.harness)
        # Active was F-99, remove targeted F-0 — active unchanged
        self.assertEqual(st.data["session"]["active_feature_id"], "F-99")

    def test_remove_emits_event(self):
        work.activate(self.harness, "F-99")
        work.remove_feature(self.harness, "F-99")
        types = [e["type"] for e in self._events()]
        self.assertIn("feature_removed", types)

    def test_remove_refuses_done_feature(self):
        """Protect audit trail: done features cannot be removed (use archive later if needed)."""
        work.activate(self.harness, "F-0")
        work.record_gate(self.harness, "F-0", "gate_5", "pass")
        work.add_evidence(self.harness, "F-0", "test", "ok")
        work.complete(self.harness, "F-0")
        res = work.remove_feature(self.harness, "F-0")
        self.assertEqual(res.action, "queried")
        self.assertIn("done", res.message.lower())
        # Still present
        st = State.load(self.harness)
        self.assertIsNotNone(st.get_feature("F-0"))


class CLITests(ScratchHarness, unittest.TestCase):
    def test_deactivate_flag(self):
        work.activate(self.harness, "F-0")
        rc = work.main(["--deactivate", "--harness-dir", str(self.harness), "--json"])
        self.assertEqual(rc, 0)
        st = State.load(self.harness)
        self.assertIsNone(st.data["session"]["active_feature_id"])

    def test_remove_flag_requires_fid(self):
        work.activate(self.harness, "F-99")
        rc = work.main(["--remove", "F-99", "--harness-dir", str(self.harness), "--json"])
        self.assertEqual(rc, 0)
        st = State.load(self.harness)
        self.assertIsNone(st.get_feature("F-99"))


if __name__ == "__main__":
    unittest.main()
