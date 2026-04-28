"""Integration tests for scripts/sync.py (F-003 Phase 0)."""

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

import sync  # noqa: E402


FIXED_TS = "2026-04-23T05:00:00Z"

MIN_SPEC = {
    "version": "2.3.8",
    "project": {"name": "scratch-project", "summary": "test"},
    "domain": {
        "entities": [{"name": "User", "invariants": ["email unique"]}],
        "business_rules": [
            {"id": "BR-001", "statement": "요건 하나", "rationale": "testing"}
        ],
    },
    "constraints": {"tech_stack": {"lang": "python"}},
    "deliverable": {"type": "cli", "entry_points": [], "smoke_scenarios": []},
    "features": [
        {
            "id": "F-001",
            "type": "skeleton",
            "name": "skeleton",
            "priority": "P0",
            "test_strategy": "lean-tdd",
            "acceptance_criteria": ["scaffolds basic layout"],
            "modules": ["core"],
        }
    ],
    "metadata": {"source": {"origin": "idea", "maturity": "planning", "revision": "v0.1"}},
}


class SyncScratchMixin:
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.harness = self.tmp / ".harness"
        self.harness.mkdir()
        (self.harness / "spec.yaml").write_text(
            yaml.safe_dump(MIN_SPEC, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self._tmp.cleanup()


class FirstRunTests(SyncScratchMixin, unittest.TestCase):
    def test_first_sync_creates_files(self):
        summary = sync.run(self.harness, timestamp=FIXED_TS)
        self.assertTrue(summary["ok"])
        self.assertFalse(summary["domain_skipped"])
        self.assertFalse(summary["arch_skipped"])
        self.assertTrue((self.harness / "domain.md").is_file())
        self.assertTrue((self.harness / "architecture.yaml").is_file())
        self.assertTrue((self.harness / "harness.yaml").is_file())

    def test_events_log_appended(self):
        sync.run(self.harness, timestamp=FIXED_TS)
        events = (self.harness / "events.log").read_text(encoding="utf-8").strip().split("\n")
        self.assertEqual(len(events), 1)
        evt = json.loads(events[0])
        self.assertEqual(evt["type"], "sync_completed")
        self.assertEqual(evt["phase"], "0")
        self.assertEqual(evt["ts"], FIXED_TS)

    def test_harness_yaml_has_hashes(self):
        sync.run(self.harness, timestamp=FIXED_TS)
        hy = yaml.safe_load((self.harness / "harness.yaml").read_text(encoding="utf-8"))
        self.assertEqual(len(hy["generation"]["generated_from"]["spec_hash"]), 64)
        self.assertIn("merkle_root", hy["generation"]["generated_from"])
        self.assertEqual(hy["generation"]["drift_status"], "clean")

    def test_determinism_of_hash(self):
        s1 = sync.run(self.harness, timestamp=FIXED_TS)
        s2 = sync.run(self.harness, timestamp=FIXED_TS)
        self.assertEqual(s1["spec_hash"], s2["spec_hash"])
        self.assertEqual(s1["merkle_root"], s2["merkle_root"])


class DryRunTests(SyncScratchMixin, unittest.TestCase):
    def test_dry_run_writes_nothing(self):
        summary = sync.run(self.harness, timestamp=FIXED_TS, dry_run=True)
        self.assertTrue(summary["dry_run"])
        self.assertFalse((self.harness / "domain.md").is_file())
        self.assertFalse((self.harness / "architecture.yaml").is_file())
        self.assertFalse((self.harness / "events.log").is_file())
        self.assertFalse((self.harness / "harness.yaml").is_file())


class EditWinsTests(SyncScratchMixin, unittest.TestCase):
    def test_user_edit_skips_overwrite(self):
        # 첫 sync
        sync.run(self.harness, timestamp=FIXED_TS)
        # 사용자가 domain.md 를 직접 편집
        domain_md = self.harness / "domain.md"
        domain_md.write_text("USER EDITED CONTENT\n", encoding="utf-8")
        # 두 번째 sync
        summary = sync.run(self.harness, timestamp=FIXED_TS)
        self.assertTrue(summary["domain_skipped"])
        self.assertEqual(summary["drift_status"], "derived_edited")
        # 편집 내용 유지
        self.assertIn("USER EDITED", domain_md.read_text(encoding="utf-8"))

    def test_force_overrides_edit_wins(self):
        sync.run(self.harness, timestamp=FIXED_TS)
        (self.harness / "domain.md").write_text("USER EDIT", encoding="utf-8")
        summary = sync.run(self.harness, timestamp=FIXED_TS, force=True)
        self.assertFalse(summary["domain_skipped"])
        self.assertNotIn("USER EDIT", (self.harness / "domain.md").read_text(encoding="utf-8"))

    def test_second_sync_without_edit_overwrites(self):
        """두 번째 sync 에서 우리가 쓴 그대로면 hash 일치 → skip 안 함."""
        sync.run(self.harness, timestamp=FIXED_TS)
        # 파일은 그대로 둠 (우리가 쓴 해시와 같음)
        summary = sync.run(self.harness, timestamp=FIXED_TS)
        self.assertFalse(summary["domain_skipped"])
        self.assertFalse(summary["arch_skipped"])


class IncludeExpansionTests(SyncScratchMixin, unittest.TestCase):
    def test_include_expanded_in_output(self):
        # chapters/ 에 설명 파일 추가
        chapters = self.harness / "chapters"
        chapters.mkdir()
        (chapters / "desc.md").write_text("엔티티 세부 설명 본문", encoding="utf-8")

        # spec.yaml 의 entity.description 에 $include 주입
        spec = yaml.safe_load((self.harness / "spec.yaml").read_text(encoding="utf-8"))
        spec["domain"]["entities"][0]["description"] = {"$include": "desc.md"}
        (self.harness / "spec.yaml").write_text(
            yaml.safe_dump(spec, allow_unicode=True, sort_keys=False),
            encoding="utf-8",
        )

        summary = sync.run(self.harness, timestamp=FIXED_TS)
        self.assertEqual(summary["include_count"], 1)
        domain = (self.harness / "domain.md").read_text(encoding="utf-8")
        self.assertIn("엔티티 세부 설명 본문", domain)


class MissingSpecTests(SyncScratchMixin, unittest.TestCase):
    def test_missing_spec_raises(self):
        (self.harness / "spec.yaml").unlink()
        with self.assertRaises(FileNotFoundError):
            sync.run(self.harness, timestamp=FIXED_TS)


class ValidationIntegrationTests(SyncScratchMixin, unittest.TestCase):
    """sync 가 스키마 검증을 거치고 실패 시 파생을 만들지 않음."""

    def setUp(self) -> None:
        super().setUp()
        from spec import validate as vs
        if vs.jsonschema is None:
            self.skipTest("jsonschema not installed")

    def test_invalid_spec_raises_and_no_files_written(self):
        # features 없이 (top-level required 위반)
        bad_spec = {
            "version": "2.3",
            "project": {"name": "bad", "summary": "x"},
            "domain": {"entities": [], "business_rules": []},
            # features 누락
        }
        (self.harness / "spec.yaml").write_text(
            yaml.safe_dump(bad_spec, sort_keys=False), encoding="utf-8"
        )
        from spec import validate as vs
        with self.assertRaises(vs.SpecValidationError):
            sync.run(self.harness, timestamp=FIXED_TS)
        # 파생물은 생성되지 않음
        self.assertFalse((self.harness / "domain.md").is_file())
        self.assertFalse((self.harness / "architecture.yaml").is_file())

    def test_invalid_spec_logs_sync_failed_event(self):
        bad_spec = {"version": "2.3", "project": {"name": "x", "summary": "y"}}
        (self.harness / "spec.yaml").write_text(
            yaml.safe_dump(bad_spec, sort_keys=False), encoding="utf-8"
        )
        from spec import validate as vs
        with self.assertRaises(vs.SpecValidationError):
            sync.run(self.harness, timestamp=FIXED_TS)
        # events.log 에 failure 이벤트 기록
        events_log = self.harness / "events.log"
        self.assertTrue(events_log.is_file())
        line = events_log.read_text(encoding="utf-8").strip()
        evt = json.loads(line)
        self.assertEqual(evt["type"], "sync_failed")
        self.assertEqual(evt["reason"], "schema_validation")

    def test_skip_validation_flag(self):
        """skip_validation=True 면 invalid spec 도 sync 진행 (테스트 fixture 용)."""
        bad_spec = {
            "version": "2.3",
            "project": {"name": "x", "summary": "y"},
            # features 없음 — 검증 skip 시 sync 는 빈 features 로 진행
        }
        (self.harness / "spec.yaml").write_text(
            yaml.safe_dump(bad_spec, sort_keys=False), encoding="utf-8"
        )
        summary = sync.run(self.harness, timestamp=FIXED_TS, skip_validation=True)
        self.assertTrue(summary["ok"])

    def test_dry_run_does_not_log_sync_failed(self):
        """dry-run 중 validation 실패는 events.log 에 기록 안 함 (부작용 회피)."""
        bad_spec = {"version": "2.3", "project": {"name": "x", "summary": "y"}}
        (self.harness / "spec.yaml").write_text(
            yaml.safe_dump(bad_spec, sort_keys=False), encoding="utf-8"
        )
        from spec import validate as vs
        with self.assertRaises(vs.SpecValidationError):
            sync.run(self.harness, timestamp=FIXED_TS, dry_run=True)
        self.assertFalse((self.harness / "events.log").is_file())


class PluginVersionResolutionTests(SyncScratchMixin, unittest.TestCase):
    """NEW-50 회귀 — scratch 워크스페이스에서도 plugin_version 해석.

    `_script_repo_version()` 이 실제 repo 의 0.2.x 를 먼저 찾으므로 모든 테스트에서
    그것을 mock 으로 비활성화. cwd 도 scratch 로 바꿔서 parent search 가
    예기치 않게 실제 repo 를 타지 않게 격리.
    """

    def setUp(self) -> None:
        import os
        from unittest.mock import patch
        super().setUp()
        self._orig_cwd = os.getcwd()
        os.chdir(self.tmp)
        self._script_version_patcher = patch.object(sync, "_script_repo_version", return_value=None)
        self._script_version_patcher.start()

    def tearDown(self) -> None:
        import os
        self._script_version_patcher.stop()
        os.chdir(self._orig_cwd)
        super().tearDown()

    def test_parent_search_finds_plugin_json(self):
        """harness_dir 의 parent 에 plugin.json 있으면 그 값을 읽음."""
        (self.tmp / ".claude-plugin").mkdir()
        (self.tmp / ".claude-plugin" / "plugin.json").write_text(
            '{"name": "harness", "version": "9.9.9-test"}', encoding="utf-8"
        )
        version = sync._plugin_version(self.harness)
        self.assertEqual(version, "9.9.9-test")

    def test_falls_back_to_plugin_root_resolve(self):
        """parent 에 plugin.json 이 없어도 plugin_root.resolve() 로 찾음 (NEW-50)."""
        from core import plugin_root as pr
        from unittest.mock import patch

        self.assertFalse((self.tmp / ".claude-plugin").exists())

        fake_plugin = self.tmp / "fake-plugin"
        fake_plugin.mkdir()
        (fake_plugin / ".claude-plugin").mkdir()
        (fake_plugin / ".claude-plugin" / "plugin.json").write_text(
            '{"name": "harness", "version": "7.7.7-fb"}', encoding="utf-8"
        )
        with patch.object(
            pr,
            "resolve",
            return_value=pr.Resolution(root=fake_plugin, strategy="test"),
        ):
            version = sync._plugin_version(self.harness)
            self.assertEqual(version, "7.7.7-fb")

    def test_returns_unknown_when_all_fail(self):
        """parent search + plugin_root.resolve() 둘 다 실패 → 'unknown'."""
        from core import plugin_root as pr
        from unittest.mock import patch

        with patch.object(pr, "resolve", side_effect=pr.PluginRootError("test")):
            version = sync._plugin_version(self.harness)
            self.assertEqual(version, "unknown")


class EditWinsHelperTests(unittest.TestCase):
    """edit_wins() 단일 함수 행동."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_no_file_returns_false(self):
        self.assertFalse(sync.edit_wins(self.tmp / "none", "abc"))

    def test_no_previous_hash_returns_false(self):
        p = self.tmp / "f.md"
        p.write_text("x", encoding="utf-8")
        self.assertFalse(sync.edit_wins(p, None))
        self.assertFalse(sync.edit_wins(p, ""))

    def test_hash_match_returns_false(self):
        p = self.tmp / "f.md"
        p.write_text("x", encoding="utf-8")
        h = hashlib.sha256(b"x").hexdigest()
        self.assertFalse(sync.edit_wins(p, h))

    def test_hash_mismatch_returns_true(self):
        p = self.tmp / "f.md"
        p.write_text("x", encoding="utf-8")
        self.assertTrue(sync.edit_wins(p, "different" * 8))


class TryInitialSyncTests(SyncScratchMixin, unittest.TestCase):
    """F-076 — sync.try_initial_sync wraps run() with fail-open semantics.

    Shared by work.py autowire (_autowire_initial_sync) and the markdown
    bash blocks in commands/init.md / skills/spec-conversion/SKILL.md
    via the `sync.py --soft` CLI flag. Contract: never raises, always
    returns a status dict with `ok: bool`, `reason: str`, optional
    `skipped: bool`.
    """

    def test_fresh_harness_runs_sync(self):
        result = sync.try_initial_sync(self.harness)
        self.assertTrue(result["ok"])
        self.assertFalse(result.get("skipped", False))
        self.assertTrue((self.harness / "harness.yaml").is_file())
        self.assertTrue((self.harness / "domain.md").is_file())
        self.assertTrue((self.harness / "architecture.yaml").is_file())

    def test_already_synced_skips(self):
        sync.try_initial_sync(self.harness)  # first call populates spec_hash
        result = sync.try_initial_sync(self.harness)
        self.assertTrue(result["ok"])
        self.assertTrue(result.get("skipped"))
        self.assertIn("already", result["reason"])

    def test_missing_spec_returns_no_run(self):
        empty = self.tmp / "empty"
        empty.mkdir()
        result = sync.try_initial_sync(empty)
        self.assertFalse(result["ok"])
        self.assertIn("spec.yaml", result["reason"])
        self.assertFalse((empty / "harness.yaml").exists())

    def test_schema_invalid_spec_soft_fails(self):
        broken = self.tmp / "broken-harness"
        broken.mkdir()
        # Project missing required `summary` field — sync.run will raise.
        (broken / "spec.yaml").write_text(
            "version: \"2.3.8\"\nproject:\n  name: \"x\"\n",
            encoding="utf-8",
        )
        result = sync.try_initial_sync(broken)
        self.assertFalse(result["ok"])
        self.assertNotEqual(result["reason"], "")
        # Did not raise — that is the whole point of try_*

    def test_run_exception_caught(self):
        from unittest import mock

        with mock.patch.object(sync, "run", side_effect=RuntimeError("boom")):
            result = sync.try_initial_sync(self.harness)
        self.assertFalse(result["ok"])
        self.assertIn("RuntimeError", result["reason"])
        self.assertIn("boom", result["reason"])


class SoftCliTests(SyncScratchMixin, unittest.TestCase):
    """F-076 — `python3 scripts/sync.py --soft` always exits 0 and prints status."""

    def test_soft_cli_returns_zero_on_success(self):
        rc = sync.main(["--harness-dir", str(self.harness), "--soft"])
        self.assertEqual(rc, 0)

    def test_soft_cli_returns_zero_on_schema_failure(self):
        broken = self.tmp / "broken"
        broken.mkdir()
        (broken / "spec.yaml").write_text(
            "version: \"2.3.8\"\nproject:\n  name: \"x\"\n",
            encoding="utf-8",
        )
        rc = sync.main(["--harness-dir", str(broken), "--soft"])
        self.assertEqual(rc, 0)

    def test_soft_cli_returns_zero_when_spec_missing(self):
        empty = self.tmp / "empty"
        empty.mkdir()
        rc = sync.main(["--harness-dir", str(empty), "--soft"])
        self.assertEqual(rc, 0)


class MarkdownContractTests(unittest.TestCase):
    """F-076 — init.md and SKILL.md must invoke `sync.py --soft` at finalize."""

    def test_init_md_invokes_soft_sync(self):
        path = REPO_ROOT / "commands" / "init.md"
        body = path.read_text(encoding="utf-8")
        self.assertIn("sync.py", body)
        self.assertIn("--soft", body)

    def test_spec_conversion_skill_invokes_soft_sync(self):
        path = REPO_ROOT / "skills" / "spec-conversion" / "SKILL.md"
        body = path.read_text(encoding="utf-8")
        self.assertIn("sync.py", body)
        self.assertIn("--soft", body)


if __name__ == "__main__":
    unittest.main()
