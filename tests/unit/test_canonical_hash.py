"""Tests for scripts/canonical_hash.py (F-010).

Run:
  pip install pyyaml pytest
  pytest tests/unit/test_canonical_hash.py

Or via stdlib unittest:
  python -m unittest tests.unit.test_canonical_hash
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from core import canonical_hash as ch  # noqa: E402


class DeterminismTests(unittest.TestCase):
    """같은 입력 → 같은 해시."""

    def test_empty_dict(self):
        self.assertEqual(ch.canonical_hash({}), ch.canonical_hash({}))

    def test_nested_dict(self):
        a = {"project": {"name": "p", "version": "1.0"}}
        b = {"project": {"name": "p", "version": "1.0"}}
        self.assertEqual(ch.canonical_hash(a), ch.canonical_hash(b))


class OrderInvarianceTests(unittest.TestCase):
    """필드 순서가 해시에 영향 없음 (mapping 에 한해)."""

    def test_dict_key_order(self):
        a = {"name": "x", "version": "1"}
        b = {"version": "1", "name": "x"}
        self.assertEqual(ch.canonical_hash(a), ch.canonical_hash(b))

    def test_nested_dict_key_order(self):
        a = {"outer": {"a": 1, "b": 2}}
        b = {"outer": {"b": 2, "a": 1}}
        self.assertEqual(ch.canonical_hash(a), ch.canonical_hash(b))

    def test_list_order_matters(self):
        """반면 배열 순서는 해시에 영향 — 의도된 동작 (features[] 는 순서 있음)."""
        a = [1, 2, 3]
        b = [3, 2, 1]
        self.assertNotEqual(ch.canonical_hash(a), ch.canonical_hash(b))


class UnicodeStabilityTests(unittest.TestCase):
    """한국어 등 Unicode 가 escape 되지 않고 안정적으로 해시됨."""

    def test_korean_field(self):
        data = {"description": "안녕하세요"}
        h1 = ch.canonical_hash(data)
        h2 = ch.canonical_hash({"description": "안녕하세요"})
        self.assertEqual(h1, h2)
        self.assertEqual(len(h1), 64)  # SHA-256 hex

    def test_emoji(self):
        data = {"name": "🧰 harness"}
        h = ch.canonical_hash(data)
        self.assertEqual(len(h), 64)


class DifferentiationTests(unittest.TestCase):
    """서로 다른 데이터는 서로 다른 해시."""

    def test_different_values(self):
        self.assertNotEqual(ch.canonical_hash({"x": 1}), ch.canonical_hash({"x": 2}))

    def test_different_keys(self):
        self.assertNotEqual(ch.canonical_hash({"a": 1}), ch.canonical_hash({"b": 1}))


class SubtreeHashTests(unittest.TestCase):
    """subtree_hashes() 는 top-level 키 중 화이트리스트만 해시."""

    def test_only_known_keys(self):
        spec = {
            "project": {"name": "p"},
            "domain": {"entities": []},
            "unknown_key": {"x": 1},  # 이건 무시
        }
        result = ch.subtree_hashes(spec)
        self.assertIn("project", result)
        self.assertIn("domain", result)
        self.assertNotIn("unknown_key", result)

    def test_missing_keys_skipped(self):
        spec = {"project": {"name": "p"}}
        result = ch.subtree_hashes(spec)
        self.assertEqual(list(result.keys()), ["project"])


class MerkleRootTests(unittest.TestCase):
    """merkle_root 는 subtree 집합의 결합 해시."""

    def test_merkle_is_deterministic(self):
        subtrees = {"project": "a" * 64, "domain": "b" * 64}
        h1 = ch.merkle_root(subtrees)
        h2 = ch.merkle_root(subtrees)
        self.assertEqual(h1, h2)

    def test_merkle_changes_with_subtree(self):
        subtrees_a = {"project": "a" * 64, "domain": "b" * 64}
        subtrees_b = {"project": "a" * 64, "domain": "c" * 64}  # domain 변경
        self.assertNotEqual(ch.merkle_root(subtrees_a), ch.merkle_root(subtrees_b))

    def test_merkle_key_order_independent(self):
        """subtree 맵 삽입 순서가 달라도 merkle 은 같음 (sorted 로 정규화)."""
        a = {"project": "x" * 64, "domain": "y" * 64}
        b = {"domain": "y" * 64, "project": "x" * 64}
        self.assertEqual(ch.merkle_root(a), ch.merkle_root(b))


class RealSpecTests(unittest.TestCase):
    """실제 harness-boot-self 스펙에 대한 smoke."""

    SPEC_PATH = REPO_ROOT / "docs" / "samples" / "harness-boot-self" / "spec.yaml"

    def setUp(self):
        if not self.SPEC_PATH.is_file():
            self.skipTest(f"{self.SPEC_PATH} not present")

    def test_full_bundle_computes(self):
        spec = ch.load_spec(self.SPEC_PATH)
        bundle = ch.compute_all(spec)
        self.assertEqual(len(bundle["spec_hash"]), 64)
        self.assertEqual(len(bundle["merkle_root"]), 64)
        self.assertIn("project", bundle["subtrees"])
        self.assertIn("features", bundle["subtrees"])

    def test_repeatable(self):
        """두 번 계산해도 같은 해시 — SUBTREE_KEYS · canonical 알고리즘 안정."""
        spec = ch.load_spec(self.SPEC_PATH)
        b1 = ch.compute_all(spec)
        b2 = ch.compute_all(spec)
        self.assertEqual(b1, b2)


class CanonicalBytesTests(unittest.TestCase):
    """canonical_bytes 출력 포맷 (separator · escape)."""

    def test_no_whitespace(self):
        out = ch.canonical_bytes({"a": 1, "b": 2})
        self.assertEqual(out, b'{"a":1,"b":2}')

    def test_sorted_keys(self):
        out = ch.canonical_bytes({"z": 1, "a": 2})
        self.assertEqual(out, b'{"a":2,"z":1}')

    def test_korean_not_escaped(self):
        out = ch.canonical_bytes({"x": "안녕"})
        self.assertIn("안녕".encode("utf-8"), out)


if __name__ == "__main__":
    unittest.main()
