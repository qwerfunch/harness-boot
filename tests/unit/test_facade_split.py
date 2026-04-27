"""F-045 — facade-preserving split contract tests.

The work and check modules keep their physical shape; the F-045 split
adds sibling modules that re-export the public names so future callers
can migrate gradually. These tests assert the alias surface stays
intact — if anyone removes a public function from work.py or check.py,
the matching sibling import fails loud.
"""

from __future__ import annotations

import unittest


class TestWorkInternalsFacade(unittest.TestCase):
    def test_public_lifecycle_functions_re_exported(self) -> None:
        from scripts import work_internals
        from scripts import work as work_root

        for name in (
            "WorkResult",
            "activate",
            "add_evidence",
            "archive",
            "block",
            "complete",
            "current",
            "deactivate",
            "record_gate",
            "remove_feature",
            "run_and_record_gate",
            "format_human",
        ):
            self.assertIs(
                getattr(work_internals, name),
                getattr(work_root, name),
                msg=f"work_internals.{name} must alias scripts.work.{name}",
            )


class TestWorkAutowireFacade(unittest.TestCase):
    def test_autowire_quartet_re_exported(self) -> None:
        from scripts import work_autowire
        from scripts import work as work_root

        for name in (
            "_autowire_design_review",
            "_autowire_fog_clear",
            "_autowire_kickoff",
            "_autowire_retro",
        ):
            self.assertIs(
                getattr(work_autowire, name),
                getattr(work_root, name),
                msg=f"work_autowire.{name} must alias scripts.work.{name}",
            )


class TestWorkCliFacade(unittest.TestCase):
    def test_main_re_exported(self) -> None:
        from scripts import work_cli
        from scripts import work as work_root

        self.assertIs(work_cli.main, work_root.main)


class TestCheckDetectorsRegistry(unittest.TestCase):
    def test_registry_has_at_least_eight_kinds(self) -> None:
        from scripts.check_detectors import DRIFT_CHECKS

        self.assertGreaterEqual(
            len(DRIFT_CHECKS),
            8,
            msg="DRIFT_CHECKS must hold at least the 8 documented drift kinds",
        )

    def test_registry_values_are_check_callables(self) -> None:
        from scripts.check_detectors import DRIFT_CHECKS

        for kind, fn in DRIFT_CHECKS.items():
            self.assertTrue(callable(fn), msg=f"{kind} → {fn} not callable")
            self.assertTrue(
                fn.__name__.startswith("check_"),
                msg=f"{kind} maps to {fn.__name__} (expected check_*)",
            )

    def test_registry_aliases_work(self) -> None:
        from scripts import check_detectors
        from scripts import check as check_root

        for name in ("check_generated", "check_derived", "check_spec", "check_stale"):
            self.assertIs(
                getattr(check_detectors, name),
                getattr(check_root, name),
                msg=f"check_detectors.{name} must alias scripts.check.{name}",
            )


class TestCheckReportFacade(unittest.TestCase):
    def test_drift_finding_re_exported(self) -> None:
        from scripts import check_report
        from scripts import check as check_root

        self.assertIs(check_report.DriftFinding, check_root.DriftFinding)


if __name__ == "__main__":
    unittest.main()
