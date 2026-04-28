"""Integration regression — Iron Law substantive coverage gating (F-080).

Reproduces the field-discovered failure mode that motivated F-077 → F-078
→ F-079 (v0.12.0): a feature whose `description` claims more units than
its AC accepts used to reach `done` because Iron Law (BR-004) only
verified `gate_5 = pass` plus declared evidence count.

Walks the full ``activate → gate → evidence → complete`` cycle through
``scripts/work.py`` via ``subprocess`` so the test exercises the same
wiring users hit, not the unit-mocked layer. Three assertions:

  * F-077 — activate emits ``[hint]`` lines on stderr for each numeric
    mismatch and persists ``_workspace/coverage/F-N.yaml``.
  * F-078 — ``complete()`` returns ``action='queried'`` and the message
    contains ``Coverage`` when the fingerprint shows under-coverage.
  * F-048 (preserved by F-078) — ``complete --hotfix-reason`` bypasses
    the Coverage drift like every other blocking kind, transitions to
    ``done``.

The fixture spec mirrors the original symptom: 13 ChainTemplate /
74 propagation rule / 35 Heuristic tools claimed in the description,
with AC accepting only 5 / 10 / 1 respectively. ``mode='prototype'``
keeps the Iron Law evidence threshold at 1 so the test stays compact.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[2]
WORK_PY = REPO_ROOT / "scripts" / "work.py"


_FIXTURE_SPEC = textwrap.dedent(
    """\
    version: "2.3.8"
    project:
      name: "iron-law-replay"
      summary: "v0.12.0 substantive coverage validation fixture"
      mode: "prototype"
    domain:
      overview: "Reproduces the procedural-vs-substantive Iron Law gap surfaced by external dogfood feedback."
      entities:
        - name: "ChainTemplate"
          description: "Attack chain matching template (synthetic replay entity)."
    features:
      - id: "F-1"
        type: "skeleton"
        title: "Tier 3 synthesis (replay)"
        description: |
          Pull set: 13 ChainTemplate · 74 propagation rule · 35 Heuristic tools.
          Reproduces the exact mismatch pattern that motivated F-077 → F-078 → F-079.
        acceptance_criteria:
          - "AC-1: 5 ChainTemplate matching regression PASS"
          - "AC-2: 10 propagation rule verified"
          - "AC-3: 1 Heuristic tool exercised"
        modules:
          - "src/correlator.py"
    """
)


class IronLawSubstantiveReplayTests(unittest.TestCase):
    """End-to-end replay of the v0.12.0 failure mode through scripts/work.py."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.harness = self.tmp / ".harness"
        self.harness.mkdir()
        (self.harness / "spec.yaml").write_text(_FIXTURE_SPEC, encoding="utf-8")

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _work(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [
                sys.executable,
                str(WORK_PY),
                *args,
                "--harness-dir",
                str(self.harness),
            ],
            capture_output=True,
            text=True,
            check=False,
        )

    # ---- F-077 -----------------------------------------------------------

    def test_activate_emits_quant_hint_for_each_mismatch(self) -> None:
        result = self._work("F-1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("[hint]", result.stderr)
        # Each of the three mismatches should surface a numeric pair.
        self.assertIn("13", result.stderr)
        self.assertIn("74", result.stderr)
        self.assertIn("35", result.stderr)

    def test_activate_persists_fingerprint_file(self) -> None:
        self._work("F-1")
        fp = self.harness / "_workspace" / "coverage" / "F-1.yaml"
        self.assertTrue(fp.is_file(), "fingerprint must be written by F-077 autowire")
        data = yaml.safe_load(fp.read_text(encoding="utf-8")) or {}
        mismatches = data.get("mismatches") or []
        self.assertGreaterEqual(
            len(mismatches),
            3,
            "fingerprint must record all three description-vs-AC mismatches",
        )

    # ---- F-078 -----------------------------------------------------------

    def test_complete_rejects_with_coverage_drift(self) -> None:
        self._work("F-1")
        self._work("F-1", "--gate", "gate_5", "pass", "--note", "synthetic smoke ok")
        self._work(
            "F-1", "--evidence", "5 ChainTemplate matched in fixture run",
            "--kind", "manual_check",
        )
        result = self._work("F-1", "--complete")
        combined = result.stdout + result.stderr
        # action='queried' + Coverage in message + --hotfix-reason hint.
        self.assertIn("queried", combined)
        self.assertIn("Coverage", combined)
        self.assertIn("--hotfix-reason", combined)

    # ---- F-048 escape hatch (preserved by F-078) -------------------------

    def test_hotfix_reason_bypasses_coverage_drift(self) -> None:
        self._work("F-1")
        self._work("F-1", "--gate", "gate_5", "pass", "--note", "synthetic smoke ok")
        self._work(
            "F-1", "--evidence", "5 ChainTemplate matched in fixture run",
            "--kind", "manual_check",
        )
        result = self._work(
            "F-1",
            "--complete",
            "--hotfix-reason",
            "intentional carry-forward — original sast pattern reproduction",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("completed", result.stdout)


if __name__ == "__main__":
    unittest.main()
