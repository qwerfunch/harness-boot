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

from core import canonical_hash as ch  # noqa: E402
import check  # noqa: E402
from core.state import State  # noqa: E402


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


class CodeDriftTests(HarnessScratch, unittest.TestCase):
    def test_string_modules_are_skipped(self):
        """단순 문자열 modules 는 논리 식별자로 보고 skip — false positive 방지."""
        self.write_spec()  # modules = [] in fixture
        spec = yaml.safe_load((self.harness / "spec.yaml").read_text(encoding="utf-8"))
        spec["features"][0]["modules"] = ["init_command", "install_target_detector"]
        findings = check.check_code(self.harness, spec)
        self.assertEqual(findings, [])

    def test_dict_module_without_source_skipped(self):
        spec = dict(SPEC_FIXTURE)
        spec["features"] = [dict(SPEC_FIXTURE["features"][0], modules=[{"name": "init_command"}])]
        findings = check.check_code(self.harness, spec)
        self.assertEqual(findings, [])

    def test_source_present_and_resolves(self):
        (self.tmp / "scripts").mkdir()
        (self.tmp / "scripts" / "foo.py").write_text("# ok\n", encoding="utf-8")
        spec = dict(SPEC_FIXTURE)
        spec["features"] = [
            dict(
                SPEC_FIXTURE["features"][0],
                modules=[{"name": "foo_mod", "source": "scripts/foo.py"}],
            )
        ]
        findings = check.check_code(self.harness, spec)
        self.assertEqual(findings, [])

    def test_source_missing_is_error(self):
        spec = dict(SPEC_FIXTURE)
        spec["features"] = [
            dict(
                SPEC_FIXTURE["features"][0],
                modules=[{"name": "missing", "source": "scripts/does_not_exist.py"}],
            )
        ]
        findings = check.check_code(self.harness, spec)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].severity, "error")
        self.assertEqual(findings[0].kind, "Code")
        self.assertIn("F-1::missing", findings[0].path)


class DocDriftTests(HarnessScratch, unittest.TestCase):
    def test_no_claude_md_skipped(self):
        findings = check.check_doc(self.harness)
        self.assertEqual(findings, [])

    def test_claude_md_with_resolving_import(self):
        (self.tmp / "CLAUDE.md").write_text("@.harness/spec.yaml\n", encoding="utf-8")
        self.write_spec()
        findings = check.check_doc(self.harness)
        self.assertEqual(findings, [])

    def test_claude_md_with_missing_import(self):
        (self.tmp / "CLAUDE.md").write_text("@.harness/phantom.md\n", encoding="utf-8")
        findings = check.check_doc(self.harness)
        self.assertEqual(len(findings), 1)
        self.assertIn("phantom.md", findings[0].message)

    def test_empty_domain_md_is_error(self):
        (self.harness / "domain.md").write_text("", encoding="utf-8")
        findings = check.check_doc(self.harness)
        errs = [f for f in findings if f.severity == "error"]
        self.assertEqual(len(errs), 1)
        self.assertIn("domain.md", errs[0].path)

    def test_empty_architecture_yaml_is_error(self):
        (self.harness / "architecture.yaml").write_text("", encoding="utf-8")
        findings = check.check_doc(self.harness)
        errs = [f for f in findings if f.severity == "error"]
        self.assertEqual(len(errs), 1)
        self.assertIn("architecture.yaml", errs[0].path)

    def test_http_import_ignored(self):
        (self.tmp / "CLAUDE.md").write_text("@https://example.com/ref\n", encoding="utf-8")
        findings = check.check_doc(self.harness)
        self.assertEqual(findings, [])


class AnchorDriftTests(HarnessScratch, unittest.TestCase):
    def test_valid_ids_no_findings(self):
        spec = {
            "features": [
                {"id": "F-001"},
                {"id": "F-002"},
            ]
        }
        findings = check.check_anchor(spec)
        self.assertEqual(findings, [])

    def test_missing_id_flagged(self):
        spec = {"features": [{"name": "nope"}]}
        findings = check.check_anchor(spec)
        self.assertEqual(len(findings), 1)
        self.assertIn("id 누락", findings[0].message)

    def test_bad_id_pattern_flagged(self):
        spec = {"features": [{"id": "feature-1"}]}
        findings = check.check_anchor(spec)
        self.assertTrue(any("F-NNN" in f.message for f in findings))

    def test_duplicate_id_flagged(self):
        spec = {"features": [{"id": "F-001"}, {"id": "F-001"}]}
        findings = check.check_anchor(spec)
        dups = [f for f in findings if "중복" in f.message]
        self.assertEqual(len(dups), 1)

    def test_depends_on_resolves(self):
        spec = {
            "features": [
                {"id": "F-001"},
                {"id": "F-002", "depends_on": ["F-001"]},
            ]
        }
        findings = check.check_anchor(spec)
        self.assertEqual(findings, [])

    def test_depends_on_broken_flagged(self):
        spec = {"features": [{"id": "F-001", "depends_on": ["F-999"]}]}
        findings = check.check_anchor(spec)
        self.assertEqual(len(findings), 1)
        self.assertIn("F-999", findings[0].message)

    def test_depends_on_not_list_flagged(self):
        spec = {"features": [{"id": "F-001", "depends_on": "F-002"}]}
        findings = check.check_anchor(spec)
        self.assertTrue(any("배열이 아님" in f.message for f in findings))

    def test_non_dict_feature_flagged(self):
        spec = {"features": ["not a dict"]}
        findings = check.check_anchor(spec)
        self.assertTrue(any(f.severity == "error" for f in findings))


class ProtocolDriftTests(HarnessScratch, unittest.TestCase):
    """F-017 AC-2: protocol_id 가 파일명 stem 과 일치해야."""

    def _write_proto(self, name: str, body: str) -> None:
        proto_dir = self.harness / "protocols"
        proto_dir.mkdir(exist_ok=True)
        (proto_dir / name).write_text(body, encoding="utf-8")

    def test_no_protocols_dir_is_clean(self):
        findings = check.check_protocol(self.harness)
        self.assertEqual(findings, [])

    def test_matching_id_clean(self):
        self._write_proto(
            "handoff.md",
            "---\nprotocol_id: handoff\nversion: \"1\"\n---\n\n# body\n",
        )
        findings = check.check_protocol(self.harness)
        self.assertEqual(findings, [])

    def test_mismatched_id_is_error(self):
        self._write_proto(
            "handoff.md",
            "---\nprotocol_id: different-name\nversion: \"1\"\n---\n",
        )
        findings = check.check_protocol(self.harness)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].severity, "error")
        self.assertIn("AC-2", findings[0].message)

    def test_missing_frontmatter_is_error(self):
        self._write_proto("handoff.md", "no frontmatter here\n")
        findings = check.check_protocol(self.harness)
        self.assertEqual(len(findings), 1)
        self.assertIn("frontmatter", findings[0].message)

    def test_missing_protocol_id_is_error(self):
        self._write_proto(
            "handoff.md",
            "---\nversion: \"1\"\n---\n",
        )
        findings = check.check_protocol(self.harness)
        self.assertEqual(len(findings), 1)
        self.assertIn("protocol_id", findings[0].message)

    def test_invalid_yaml_frontmatter_is_error(self):
        self._write_proto("handoff.md", "---\n:: invalid :: yaml ::\n---\n")
        findings = check.check_protocol(self.harness)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].severity, "error")

    def test_non_dict_frontmatter_is_error(self):
        self._write_proto("handoff.md", "---\n- just a list\n---\n")
        findings = check.check_protocol(self.harness)
        self.assertEqual(len(findings), 1)
        self.assertIn("mapping", findings[0].message)


class AdrSupersedesDriftTests(unittest.TestCase):
    """v0.7.3 — ADR supersedes chain consistency. When a new ADR supersedes
    an old one, the old ADR's status must be 'superseded'. Otherwise domain.md
    renders a contradiction (two 'accepted' ADRs on the same decision).
    """

    def test_clean_when_old_marked_superseded(self):
        spec = {
            "decisions": [
                {"id": "ADR-001", "title": "old", "status": "superseded"},
                {"id": "ADR-002", "title": "new", "status": "accepted", "supersedes": ["ADR-001"]},
            ],
        }
        findings = check.check_adr_supersedes(spec)
        self.assertEqual(findings, [])

    def test_warns_when_old_still_accepted(self):
        spec = {
            "decisions": [
                {"id": "ADR-001", "title": "old", "status": "accepted"},
                {"id": "ADR-002", "title": "new", "status": "accepted", "supersedes": ["ADR-001"]},
            ],
        }
        findings = check.check_adr_supersedes(spec)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].kind, "Adr")
        self.assertIn("ADR-001", findings[0].path)
        self.assertIn("ADR-002", findings[0].message)

    def test_warns_when_supersedes_target_missing(self):
        spec = {
            "decisions": [
                {"id": "ADR-002", "title": "new", "status": "accepted", "supersedes": ["ADR-999"]},
            ],
        }
        findings = check.check_adr_supersedes(spec)
        self.assertEqual(len(findings), 1)
        self.assertIn("ADR-999", findings[0].message)

    def test_no_decisions_section_is_clean(self):
        findings = check.check_adr_supersedes({})
        self.assertEqual(findings, [])

    def test_empty_supersedes_is_clean(self):
        spec = {"decisions": [{"id": "ADR-001", "status": "accepted"}]}
        findings = check.check_adr_supersedes(spec)
        self.assertEqual(findings, [])

    def test_chain_of_two_supersedes(self):
        """ADR-003 supersedes ADR-002 which supersedes ADR-001 — all except ADR-003 must be superseded."""
        spec = {
            "decisions": [
                {"id": "ADR-001", "status": "superseded"},
                {"id": "ADR-002", "status": "accepted", "supersedes": ["ADR-001"]},
                {"id": "ADR-003", "status": "accepted", "supersedes": ["ADR-002"]},
            ],
        }
        findings = check.check_adr_supersedes(spec)
        self.assertEqual(len(findings), 1)
        self.assertIn("ADR-002", findings[0].path)


class StaleDriftTests(HarnessScratch, unittest.TestCase):
    """v0.10 — done 피처의 declared module 이 src/ 어디에도 import 안 되면 warn.

    archived OR superseded_by 명시 시 면제. modules 비어 있어도 면제.
    """

    def _write_src(self, files: dict[str, str]) -> Path:
        src = self.tmp / "src"
        src.mkdir(exist_ok=True)
        for rel, content in files.items():
            target = src / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
        return src

    def _spec(self, feature_overrides: dict) -> dict:
        spec = {
            "features": [
                {"id": "F-001", "type": "skeleton"},
                {
                    "id": "F-100",
                    "modules": [{"name": "earth", "source": "src/earth.ts"}],
                    **feature_overrides,
                },
            ]
        }
        return spec

    def test_done_feature_with_orphan_module_warns(self):
        self._write_src({
            "earth.ts": "export const earth = 1;\n",
            "main.ts": "console.log('hi')\n",  # does NOT import earth
        })
        spec = self._spec({"status": "done"})
        findings = check.check_stale(self.harness, spec, project_root=self.tmp)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].kind, "Stale")
        self.assertEqual(findings[0].severity, "warn")
        self.assertIn("earth.ts", findings[0].path)

    def test_done_feature_with_used_module_clean(self):
        self._write_src({
            "earth.ts": "export const earth = 1;\n",
            "main.ts": "import { earth } from './earth';\n",
        })
        spec = self._spec({"status": "done"})
        findings = check.check_stale(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])

    def test_archived_feature_exempted(self):
        self._write_src({"earth.ts": "x", "main.ts": "y"})
        spec = self._spec({"status": "archived"})
        findings = check.check_stale(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])

    def test_superseded_by_feature_exempted(self):
        self._write_src({"earth.ts": "x", "main.ts": "y"})
        spec = self._spec({"status": "done", "superseded_by": "F-200"})
        findings = check.check_stale(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])

    def test_planned_feature_not_checked(self):
        """status != done 은 검사 대상 아님 (아직 ship 안 됨)."""
        self._write_src({"earth.ts": "x", "main.ts": "y"})
        spec = self._spec({"status": "planned"})
        findings = check.check_stale(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])

    def test_no_modules_declared_not_checked(self):
        self._write_src({"main.ts": "y"})
        spec = {
            "features": [
                {"id": "F-001", "type": "skeleton"},
                {"id": "F-100", "status": "done", "modules": []},
            ]
        }
        findings = check.check_stale(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])

    def test_no_src_dir_silent(self):
        spec = self._spec({"status": "done"})
        findings = check.check_stale(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])

    def test_missing_source_file_silent(self):
        """존재하지 않는 source 는 Code drift 가 다룸. Stale 은 무시."""
        self._write_src({"main.ts": "y"})  # earth.ts not created
        spec = self._spec({"status": "done"})
        findings = check.check_stale(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])


class AnchorIntegrationDriftTests(HarnessScratch, unittest.TestCase):
    """v0.10.1 — features[].integration_anchor 가 declarative 통합 wiring 가드.

    done 피처가 anchor 파일들에서 참조 안 되면 warn. anchor 파일 자체 부재는 error.
    archived/superseded_by 면제. anchor 미선언 시 silent.
    """

    def _write_files(self, files: dict[str, str]) -> None:
        for rel, content in files.items():
            target = self.tmp / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")

    def _spec(self, feature_overrides: dict) -> dict:
        return {
            "features": [
                {"id": "F-001", "type": "skeleton"},
                {
                    "id": "F-100",
                    "modules": [{"name": "earth", "source": "src/earth.ts"}],
                    **feature_overrides,
                },
            ]
        }

    def test_anchor_not_declared_silent(self):
        self._write_files({"src/earth.ts": "x", "src/main.ts": "no import"})
        spec = self._spec({"status": "done"})
        findings = check.check_anchor_integration(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])

    def test_anchor_empty_list_silent(self):
        self._write_files({"src/earth.ts": "x", "src/main.ts": "no import"})
        spec = self._spec({"status": "done", "integration_anchor": []})
        findings = check.check_anchor_integration(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])

    def test_module_referenced_by_basename_clean(self):
        self._write_files({
            "src/earth.ts": "export const earth = 1;\n",
            "src/main.ts": "import './earth.ts';\n",
        })
        spec = self._spec({"status": "done", "integration_anchor": ["src/main.ts"]})
        findings = check.check_anchor_integration(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])

    def test_module_referenced_by_path_token_stem_clean(self):
        self._write_files({
            "src/earth.ts": "export const earth = 1;\n",
            "src/main.ts": "import { earth } from './earth';\n",
        })
        spec = self._spec({"status": "done", "integration_anchor": ["src/main.ts"]})
        findings = check.check_anchor_integration(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])

    def test_module_not_referenced_warns(self):
        self._write_files({
            "src/earth.ts": "export const earth = 1;\n",
            "src/main.ts": "console.log('hi')\n",
        })
        spec = self._spec({"status": "done", "integration_anchor": ["src/main.ts"]})
        findings = check.check_anchor_integration(self.harness, spec, project_root=self.tmp)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].kind, "AnchorIntegration")
        self.assertEqual(findings[0].severity, "warn")
        self.assertIn("F-100", findings[0].path)
        self.assertIn("earth.ts", findings[0].path)
        self.assertIn("integration_anchor", findings[0].message)

    def test_anchor_file_missing_is_error(self):
        self._write_files({"src/earth.ts": "x"})  # main.ts 없음
        spec = self._spec({"status": "done", "integration_anchor": ["src/main.ts"]})
        findings = check.check_anchor_integration(self.harness, spec, project_root=self.tmp)
        errors = [f for f in findings if f.severity == "error"]
        self.assertEqual(len(errors), 1)
        self.assertIn("src/main.ts", errors[0].path)

    def test_status_not_done_silent(self):
        self._write_files({"src/earth.ts": "x", "src/main.ts": "no ref"})
        spec = self._spec({"status": "in_progress", "integration_anchor": ["src/main.ts"]})
        findings = check.check_anchor_integration(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])

    def test_archived_silent(self):
        self._write_files({"src/earth.ts": "x", "src/main.ts": "no ref"})
        spec = self._spec({"status": "archived", "integration_anchor": ["src/main.ts"]})
        findings = check.check_anchor_integration(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])

    def test_superseded_by_silent(self):
        self._write_files({"src/earth.ts": "x", "src/main.ts": "no ref"})
        spec = self._spec({
            "status": "done",
            "superseded_by": "F-200",
            "integration_anchor": ["src/main.ts"],
        })
        findings = check.check_anchor_integration(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])

    def test_no_modules_silent(self):
        self._write_files({"src/main.ts": "empty"})
        spec = {
            "features": [
                {"id": "F-001", "type": "skeleton"},
                {
                    "id": "F-100",
                    "status": "done",
                    "modules": [],
                    "integration_anchor": ["src/main.ts"],
                },
            ]
        }
        findings = check.check_anchor_integration(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])

    def test_any_of_anchor_satisfies(self):
        """여러 anchor 중 하나라도 module 참조하면 clean."""
        self._write_files({
            "src/earth.ts": "x",
            "src/main.ts": "no ref",
            "src/bootstrap.ts": "import './earth';\n",
        })
        spec = self._spec({
            "status": "done",
            "integration_anchor": ["src/main.ts", "src/bootstrap.ts"],
        })
        findings = check.check_anchor_integration(self.harness, spec, project_root=self.tmp)
        self.assertEqual(findings, [])

    def test_run_check_includes_anchor_integration(self):
        """run_check 가 AnchorIntegration 카테고리를 checked 에 등록."""
        self.write_spec()
        report = check.run_check(self.harness, project_root=self.tmp)
        self.assertIn("AnchorIntegration", report.checked)


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
