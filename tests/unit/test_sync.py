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


if __name__ == "__main__":
    unittest.main()
