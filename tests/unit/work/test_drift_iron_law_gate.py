"""F-048 — drift × Iron Law gating tests (mock target updated by F-072).

scripts/work.py:complete() invokes the drift fast path
(check.run_blocking_check, F-072) right after the gate_5 pass check,
and rejects when severity='error' findings appear. F-048's gate
semantics (kinds × severity) are unchanged; F-072 only narrowed the
detector surface. Tests patch the call site (run_blocking_check) so
they exercise the same wiring complete() actually goes through.

mock 으로 drift report 주입 — check.py 의 실제 detector 동작과 분리하여
결합 로직 자체만 시험. detector 동작은 tests/unit/test_check*.py 에서 별도 검증.

5 + 1 시나리오:
- AC-1: drift 0 → complete 통과 (기존 동작 유지)
- AC-2: error-severity drift 1+ → 거부 + kinds 메시지
- AC-2': 여러 findings 의 unique kinds 메시지
- AC-3: warn-only drift → 통과 (binary blocking)
- AC-4: hotfix override → drift 무시하고 진행
- AC-5: check.py 실행 실패 → silent fallback (best-effort)
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import yaml

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import work  # noqa: E402
from check import CheckReport, DriftFinding  # noqa: E402


class DriftIronLawScratch:
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.harness = self.tmp / ".harness"
        self.harness.mkdir()
        spec = {
            "version": "2.3.8",
            "project": {"name": "sample", "mode": "prototype"},
            "features": [{"id": "F-1", "name": "test"}],
        }
        (self.harness / "spec.yaml").write_text(
            yaml.safe_dump(spec, allow_unicode=True), encoding="utf-8"
        )

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def _seed_precondition(self, fid: str, n_evidence: int = 1) -> None:
        work.activate(self.harness, fid)
        work.record_gate(self.harness, fid, "gate_5", "pass")
        for i in range(n_evidence):
            work.add_evidence(self.harness, fid, "manual_check", f"v{i}")


class DriftFreeCompleteTests(DriftIronLawScratch, unittest.TestCase):
    """AC-1 — drift 0 인 경우 complete 통과."""

    def test_complete_passes_when_no_drift(self):
        empty = CheckReport(findings=[], checked=[])
        with patch("check.run_blocking_check", return_value=empty):
            self._seed_precondition("F-1")
            res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "completed")


class ErrorDriftBlocksTests(DriftIronLawScratch, unittest.TestCase):
    """AC-2 — error-severity drift 1+ 시 거부."""

    def test_single_error_blocks(self):
        report = CheckReport(
            findings=[DriftFinding("Code", "F-1", "module file missing", "error")],
            checked=["Code"],
        )
        with patch("check.run_blocking_check", return_value=report):
            self._seed_precondition("F-1")
            res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "queried")
        self.assertIn("blocking drift", res.message)
        self.assertIn("Code", res.message)
        self.assertIn("--hotfix-reason", res.message)

    def test_message_lists_unique_kinds(self):
        report = CheckReport(
            findings=[
                DriftFinding("Code", "F-1", "x", "error"),
                DriftFinding("Code", "F-2", "y", "error"),
                DriftFinding("Stale", "F-3", "z", "error"),
            ],
            checked=["Code", "Stale"],
        )
        with patch("check.run_blocking_check", return_value=report):
            self._seed_precondition("F-1")
            res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "queried")
        self.assertIn("3 blocking drift", res.message)
        self.assertIn("Code", res.message)
        self.assertIn("Stale", res.message)

    def test_non_blocking_kind_error_does_not_block(self):
        # Anchor / Generated 등 schema-validation 류 error 는 차단 대상 아님
        # (false-positive 가능 — 환경 의존). Wire 무결성 (Code/Stale/
        # AnchorIntegration) 만 차단.
        report = CheckReport(
            findings=[
                DriftFinding("Anchor", "F-1", "duplicate id", "error"),
                DriftFinding("Generated", "harness.yaml", "missing", "error"),
            ],
            checked=["Anchor", "Generated"],
        )
        with patch("check.run_blocking_check", return_value=report):
            self._seed_precondition("F-1")
            res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "completed")


class WarnOnlyDoesNotBlockTests(DriftIronLawScratch, unittest.TestCase):
    """AC-3 — severity='warn' 만 있을 때는 통과 (binary blocking)."""

    def test_warn_findings_do_not_block(self):
        report = CheckReport(
            findings=[
                DriftFinding("Doc", "x.md", "minor", "warn"),
                DriftFinding("Anchor", "F-1", "minor", "warn"),
            ],
            checked=["Doc", "Anchor"],
        )
        with patch("check.run_blocking_check", return_value=report):
            self._seed_precondition("F-1")
            res = work.complete(self.harness, "F-1")
        self.assertEqual(res.action, "completed")


class HotfixOverridesDriftTests(DriftIronLawScratch, unittest.TestCase):
    """AC-4 — hotfix_reason 제공 시 drift 검증 스킵."""

    def test_hotfix_bypasses_error_drift(self):
        report = CheckReport(
            findings=[DriftFinding("Code", "F-1", "module file missing", "error")],
            checked=["Code"],
        )
        # hotfix_reason 시 drift 분기 자체가 스킵되므로 mock 호출 여부와 무관.
        # 명시적으로 patch 하여 결과 영향 없음을 시각화.
        with patch("check.run_blocking_check", return_value=report):
            work.activate(self.harness, "F-1")
            work.record_gate(self.harness, "F-1", "gate_5", "pass")
            res = work.complete(
                self.harness, "F-1", hotfix_reason="emergency rollback",
            )
        self.assertEqual(res.action, "completed")


class CheckFailureGracefulTests(DriftIronLawScratch, unittest.TestCase):
    """AC-5 — check.py 실행 실패 시 silent fallback (complete 진행)."""

    def test_check_exception_does_not_block(self):
        with patch(
            "check.run_blocking_check",
            side_effect=RuntimeError("simulated check failure"),
        ):
            self._seed_precondition("F-1")
            res = work.complete(self.harness, "F-1")
        # silent fallback — Iron Law (declared evidence) 흐름으로 진행.
        # prototype + 1 evidence + gate_5 pass → completed.
        self.assertEqual(res.action, "completed")


if __name__ == "__main__":
    unittest.main()
