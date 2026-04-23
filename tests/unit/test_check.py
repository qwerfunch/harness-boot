"""Tests for scripts/check.py (F-006) — drift detection, read-only."""

from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import canonical_hash as ch  # noqa: E402
import check  # noqa: E402
from state import State  # noqa: E402


SPEC_FIXTURE = {
    "version": "2.3",
    "project": {"name": "p", "summary": "s"},
    "domain": {"entities": [], "business_rules": []},
    "features": [
        {
            "id": "F-1",
            "type": "skeleton",
            "title": "t",
            "priority": "P0",
            "test_strategy": "lean-tdd",
            "acceptance_criteria": ["ok"],
            "modules": [],
        }
    ],
}


class HarnessScratch:
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.harness = self.tmp / ".harness"
        self.harness.mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def write_spec(self, data: dict | None = None) -> None:
        (self.harness / "spec.yaml").write_text(
            yaml.safe_dump(data or SPEC_FIXTURE, sort_keys=False, allow_unicode=True),
            encoding="utf-8",
        )

    def write_harness_yaml(self, data: dict) -> None:
        (self.harness / "harness.yaml").write_text(
            yaml.safe_dump(data, sort_keys=False), encoding="utf-8"
        )

    def hash_file(self, path: Path) -> str:
        return hashlib.sha256(path.read_bytes()).hexdigest()


class GeneratedTests(HarnessScratch, unittest.TestCase):
    def test_missing_harness_yaml(self):
        findings = check.check_generated(self.harness, None)
        self.assertTrue(any(f.kind == "Generated" for f in findings))
        self.assertEqual(findings[0].severity, "error")

    def test_missing_required_key(self):
        findings = check.check_generated(self.harness, {"version": "2.3"})
        # generation 키 없음
        self.assertTrue(any("generation" in f.path for f in findings))

    def test_valid_structure(self):
        findings = check.check_generated(
            self.harness, {"version": "2.3", "generation": {}}
        )
        self.assertEqual(findings, [])


class SpecDriftTests(HarnessScratch, unittest.TestCase):
    def test_spec_missing(self):
        findings = check.check_spec(self.harness, {"generation": {"generated_from": {}}})
        self.assertTrue(any(f.severity == "error" for f in findings))

    def test_no_recorded_hash_warns(self):
        self.write_spec()
        findings = check.check_spec(self.harness, {"generation": {"generated_from": {}}})
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].severity, "warn")

    def test_hash_match_no_finding(self):
        self.write_spec()
        expected = ch.canonical_hash(SPEC_FIXTURE)
        findings = check.check_spec(
            self.harness, {"generation": {"generated_from": {"spec_hash": expected}}}
        )
        self.assertEqual(findings, [])

    def test_hash_mismatch_flagged(self):
        self.write_spec()
        findings = check.check_spec(
            self.harness, {"generation": {"generated_from": {"spec_hash": "wrong" * 12}}}
        )
        self.assertEqual(len(findings), 1)
        self.assertIn("sync 필요", findings[0].message)


class DerivedDriftTests(HarnessScratch, unittest.TestCase):
    def test_no_derived_files_ok(self):
        findings = check.check_derived(
            self.harness, {"generation": {"derived_from": {}}}
        )
        self.assertEqual(findings, [])

    def test_file_exists_but_no_hash_warns(self):
        (self.harness / "domain.md").write_text("content", encoding="utf-8")
        findings = check.check_derived(
            self.harness, {"generation": {"derived_from": {"domain_md": {"output_hash": ""}}}}
        )
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].severity, "warn")

    def test_hash_match_ok(self):
        (self.harness / "domain.md").write_text("content", encoding="utf-8")
        h = self.hash_file(self.harness / "domain.md")
        findings = check.check_derived(
            self.harness, {"generation": {"derived_from": {"domain_md": {"output_hash": h}}}}
        )
        self.assertEqual(findings, [])

    def test_hash_mismatch_flagged_as_edit_wins(self):
        (self.harness / "domain.md").write_text("user edited content", encoding="utf-8")
        findings = check.check_derived(
            self.harness, {"generation": {"derived_from": {"domain_md": {"output_hash": "orig" * 16}}}}
        )
        self.assertEqual(len(findings), 1)
        self.assertIn("edit-wins", findings[0].message)

    def test_recorded_but_file_missing_error(self):
        findings = check.check_derived(
            self.harness, {"generation": {"derived_from": {"domain_md": {"output_hash": "x" * 64}}}}
        )
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].severity, "error")


class IncludeDriftTests(HarnessScratch, unittest.TestCase):
    def test_empty_both_ok(self):
        self.write_spec()
        findings = check.check_includes(
            self.harness, {"generation": {"include_sources": []}}
        )
        self.assertEqual(findings, [])

    def test_new_include_flagged(self):
        spec = dict(SPEC_FIXTURE)
        spec["project"] = dict(spec["project"], description={"$include": "desc.md"})
        self.write_spec(spec)
        findings = check.check_includes(
            self.harness, {"generation": {"include_sources": []}}
        )
        self.assertTrue(any("신규 $include" in f.message for f in findings))

    def test_removed_include_flagged(self):
        self.write_spec()  # no includes
        findings = check.check_includes(
            self.harness, {"generation": {"include_sources": ["old.md"]}}
        )
        self.assertTrue(any("사라짐" in f.message for f in findings))

    def test_missing_chapter_file_error(self):
        spec = dict(SPEC_FIXTURE)
        spec["project"] = dict(spec["project"], description={"$include": "missing.md"})
        self.write_spec(spec)
        chapters = self.harness / "chapters"
        chapters.mkdir()
        # missing.md 는 만들지 않음
        findings = check.check_includes(
            self.harness, {"generation": {"include_sources": ["missing.md"]}}
        )
        # 신규도 아니고 없어진 것도 아니지만 파일 미존재 → error
        errors = [f for f in findings if f.severity == "error"]
        self.assertEqual(len(errors), 1)


class EvidenceTests(HarnessScratch, unittest.TestCase):
    def test_no_state_yaml_no_findings(self):
        findings = check.check_evidence(self.harness)
        self.assertEqual(findings, [])

    def test_done_without_evidence_flagged(self):
        st = State.load(self.harness)
        st.set_status("F-1", "done")
        st.save()
        findings = check.check_evidence(self.harness)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].kind, "Evidence")

    def test_done_with_evidence_ok(self):
        st = State.load(self.harness)
        st.set_status("F-1", "done")
        st.add_evidence("F-1", "test", "all green")
        st.save()
        findings = check.check_evidence(self.harness)
        self.assertEqual(findings, [])

    def test_in_progress_no_evidence_ok(self):
        """planned/in_progress 는 아직 증거 없어도 OK."""
        st = State.load(self.harness)
        st.set_status("F-1", "in_progress")
        st.save()
        findings = check.check_evidence(self.harness)
        self.assertEqual(findings, [])


class IntegrationTests(HarnessScratch, unittest.TestCase):
    def test_clean_run_reports_no_findings(self):
        # 정상 시나리오: harness.yaml 있고 spec 해시 맞고 파생 없음 (미파생 상태지만 해시도 기록 안 된 이상 warn 안 나옴)
        self.write_spec()
        spec_hash = ch.canonical_hash(SPEC_FIXTURE)
        self.write_harness_yaml(
            {
                "version": "2.3",
                "generation": {
                    "generated_from": {"spec_hash": spec_hash},
                    "derived_from": {},
                    "include_sources": [],
                },
            }
        )
        report = check.run_check(self.harness)
        self.assertTrue(report.clean, f"expected clean, got {[f.as_dict() for f in report.findings]}")

    def test_dirty_run_has_findings(self):
        """spec 있는데 harness.yaml 없음 → Generated error + Spec check skip (harness_yaml None)."""
        self.write_spec()
        report = check.run_check(self.harness)
        self.assertFalse(report.clean)
        self.assertTrue(any(f.kind == "Generated" for f in report.findings))


class CQSTests(HarnessScratch, unittest.TestCase):
    def test_run_check_doesnt_modify_files(self):
        self.write_spec()
        self.write_harness_yaml({"version": "2.3", "generation": {}})
        (self.harness / "domain.md").write_text("x", encoding="utf-8")

        before_spec = (self.harness / "spec.yaml").stat().st_mtime_ns
        before_h = (self.harness / "harness.yaml").stat().st_mtime_ns
        before_d = (self.harness / "domain.md").stat().st_mtime_ns

        check.run_check(self.harness)
        check.run_check(self.harness)  # idempotent

        self.assertEqual((self.harness / "spec.yaml").stat().st_mtime_ns, before_spec)
        self.assertEqual((self.harness / "harness.yaml").stat().st_mtime_ns, before_h)
        self.assertEqual((self.harness / "domain.md").stat().st_mtime_ns, before_d)


if __name__ == "__main__":
    unittest.main()
