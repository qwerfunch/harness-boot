"""F-030 — shard / unshard round-trip + summary derivation."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import yaml

from legacy.scripts.spec.shard import shard, shard_to_disk
from legacy.scripts.spec.summary import build_summary
from legacy.scripts.spec.unshard import unshard, unshard_to_disk


def _sample_spec() -> dict:
    return {
        "version": "2.3.8",
        "project": {"name": "demo", "summary": "round-trip"},
        "domain": {"overview": "stub"},
        "features": [
            {"id": "F-001", "type": "skeleton", "name": "skel", "area": "core"},
            {"id": "F-002", "type": "feature", "name": "alpha", "area": "auth", "digest": "JWT login"},
            {"id": "F-003", "type": "feature", "name": "beta", "area": "billing"},
            {"id": "F-004", "type": "feature", "name": "gamma"},  # no area → 'misc'
        ],
    }


class ShardLayoutTests(unittest.TestCase):
    """AC-1: per-feature files written under <output>/features/<area>/F-N.yaml."""

    def test_shard_writes_one_file_per_feature(self):
        spec = _sample_spec()
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            shard_to_disk_path = out
            shard(spec, out)
            # Files exist where expected.
            self.assertTrue((out / "features" / "core" / "F-001.yaml").is_file())
            self.assertTrue((out / "features" / "auth" / "F-002.yaml").is_file())
            self.assertTrue((out / "features" / "billing" / "F-003.yaml").is_file())
            self.assertTrue((out / "features" / "misc" / "F-004.yaml").is_file())

    def test_shard_to_disk_writes_index_spec(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            in_path = out / "input.yaml"
            in_path.write_text(yaml.dump(_sample_spec()), encoding="utf-8")
            shard_to_disk(in_path, out / "sharded")
            index = yaml.safe_load((out / "sharded" / "spec.yaml").read_text(encoding="utf-8"))
            # Index has features as include_path refs.
            self.assertEqual(len(index["features"]), 4)
            for entry in index["features"]:
                self.assertIn("id", entry)
                self.assertIn("include_path", entry)


class RoundTripTests(unittest.TestCase):
    """AC-2: shard → unshard yields the same parsed dict."""

    def test_round_trip_preserves_features(self):
        original = _sample_spec()
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            in_path = out / "in.yaml"
            in_path.write_text(yaml.dump(original), encoding="utf-8")
            shard_to_disk(in_path, out / "s")
            restored = unshard(out / "s" / "spec.yaml")
            # Compare via JSON canonicalization (key order ignored).
            self.assertEqual(
                json.dumps(original, sort_keys=True),
                json.dumps(restored, sort_keys=True),
            )

    def test_round_trip_via_disk(self):
        original = _sample_spec()
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            in_path = out / "in.yaml"
            in_path.write_text(yaml.dump(original), encoding="utf-8")
            shard_to_disk(in_path, out / "s")
            unshard_to_disk(out / "s" / "spec.yaml", out / "restored.yaml")
            restored = yaml.safe_load((out / "restored.yaml").read_text(encoding="utf-8"))
            self.assertEqual(
                json.dumps(original, sort_keys=True),
                json.dumps(restored, sort_keys=True),
            )


class SummaryTests(unittest.TestCase):
    """AC-3: summary entries carry id/status/area/digest at minimum."""

    def test_summary_entry_count_matches_features(self):
        spec = _sample_spec()
        summary = build_summary(spec)
        self.assertEqual(summary["feature_count"], 4)
        self.assertEqual(len(summary["features"]), 4)

    def test_summary_uses_digest_when_present_else_name(self):
        spec = _sample_spec()
        summary = build_summary(spec)
        by_id = {e["id"]: e for e in summary["features"]}
        self.assertEqual(by_id["F-002"]["digest"], "JWT login")  # explicit digest
        self.assertEqual(by_id["F-003"]["digest"], "beta")  # name fallback

    def test_summary_status_from_state_overrides_spec(self):
        spec = _sample_spec()
        state = {
            "features": [
                {"id": "F-002", "status": "done"},
                {"id": "F-003", "status": "in_progress"},
            ]
        }
        summary = build_summary(spec, state)
        by_id = {e["id"]: e for e in summary["features"]}
        self.assertEqual(by_id["F-002"]["status"], "done")
        self.assertEqual(by_id["F-003"]["status"], "in_progress")
        # No state entry → 'planned' fallback.
        self.assertEqual(by_id["F-001"]["status"], "planned")

    def test_summary_marks_archived(self):
        spec = _sample_spec()
        spec["features"][2]["archived_at"] = "2026-01-01T00:00:00Z"
        summary = build_summary(spec)
        by_id = {e["id"]: e for e in summary["features"]}
        self.assertTrue(by_id["F-003"].get("archived"))
        self.assertNotIn("archived", by_id["F-002"])


if __name__ == "__main__":
    unittest.main()
