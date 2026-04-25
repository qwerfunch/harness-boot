"""v0.10 — features[].supersedes / superseded_by 검증.

Two-layer model 의 supersession metadata 가 schema · check.Anchor drift
양쪽에서 일관되게 다뤄지는지 보장.

- 참조 유효성: supersedes 항목이 실재 feature id.
- 자기참조 금지.
- 순환 감지 (A→B→A · A→B→C→A 등).
- 양방향 일관성: superseded_by 명시 시 대상 피처의 supersedes 에 역참조 존재.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import check  # noqa: E402


def _spec(features: list[dict]) -> dict:
    """Walking Skeleton 으로 시작 — features[0] 은 항상 type=skeleton."""
    skeleton = {"id": "F-001", "type": "skeleton"}
    return {"features": [skeleton] + features}


class FeatureSupersedesValidTests(unittest.TestCase):
    def test_clean_supersedes_no_finding(self):
        spec = _spec([
            {"id": "F-002"},
            {"id": "F-003", "supersedes": ["F-002"]},
        ])
        findings = [f for f in check.check_anchor(spec) if "supersedes" in f.message]
        self.assertEqual(findings, [], f"unexpected findings: {findings}")

    def test_no_supersedes_field_clean(self):
        spec = _spec([{"id": "F-002"}, {"id": "F-003"}])
        self.assertEqual(check.check_anchor(spec), [])


class FeatureSupersedesReferenceTests(unittest.TestCase):
    def test_dangling_supersedes_target(self):
        spec = _spec([{"id": "F-002", "supersedes": ["F-999"]}])
        findings = check.check_anchor(spec)
        msgs = [f.message for f in findings]
        self.assertTrue(
            any("F-999" in m and "존재하지 않는" in m for m in msgs),
            f"expected dangling-ref finding, got: {msgs}",
        )

    def test_dangling_superseded_by(self):
        spec = _spec([{"id": "F-002", "superseded_by": "F-999"}])
        findings = check.check_anchor(spec)
        msgs = [f.message for f in findings]
        self.assertTrue(
            any("F-999" in m and "superseded_by" in m for m in msgs),
            f"expected dangling superseded_by finding, got: {msgs}",
        )

    def test_supersedes_not_array_is_error(self):
        spec = _spec([{"id": "F-002", "supersedes": "F-001"}])
        findings = check.check_anchor(spec)
        self.assertTrue(any("배열이 아님" in f.message for f in findings))

    def test_superseded_by_not_string_is_error(self):
        spec = _spec([{"id": "F-002", "superseded_by": ["F-001"]}])
        findings = check.check_anchor(spec)
        self.assertTrue(
            any("superseded_by" in f.message and "문자열" in f.message for f in findings)
        )


class FeatureSupersedesSelfRefTests(unittest.TestCase):
    def test_self_reference_in_supersedes(self):
        spec = _spec([{"id": "F-002", "supersedes": ["F-002"]}])
        findings = check.check_anchor(spec)
        msgs = [f.message for f in findings]
        self.assertTrue(
            any("자기 자신" in m and "supersedes" in m for m in msgs),
            f"expected self-ref finding, got: {msgs}",
        )

    def test_self_reference_in_superseded_by(self):
        spec = _spec([{"id": "F-002", "superseded_by": "F-002"}])
        findings = check.check_anchor(spec)
        msgs = [f.message for f in findings]
        self.assertTrue(
            any("자기 자신" in m and "superseded_by" in m for m in msgs),
            f"expected self-ref finding, got: {msgs}",
        )


class FeatureSupersedesCycleTests(unittest.TestCase):
    def test_two_node_cycle(self):
        spec = _spec([
            {"id": "F-002", "supersedes": ["F-003"]},
            {"id": "F-003", "supersedes": ["F-002"]},
        ])
        findings = check.check_anchor(spec)
        self.assertTrue(
            any("순환" in f.message for f in findings),
            f"expected cycle finding, got: {[f.message for f in findings]}",
        )

    def test_three_node_cycle(self):
        spec = _spec([
            {"id": "F-002", "supersedes": ["F-003"]},
            {"id": "F-003", "supersedes": ["F-004"]},
            {"id": "F-004", "supersedes": ["F-002"]},
        ])
        findings = check.check_anchor(spec)
        self.assertTrue(any("순환" in f.message for f in findings))

    def test_long_chain_no_cycle(self):
        """A→B→C→D 는 정상."""
        spec = _spec([
            {"id": "F-002"},
            {"id": "F-003", "supersedes": ["F-002"]},
            {"id": "F-004", "supersedes": ["F-003"]},
            {"id": "F-005", "supersedes": ["F-004"]},
        ])
        findings = check.check_anchor(spec)
        cycle_findings = [f for f in findings if "순환" in f.message]
        self.assertEqual(cycle_findings, [])


class FeatureSupersedesBidirectionalTests(unittest.TestCase):
    """superseded_by 가 명시되면 대상 피처의 supersedes 에 역참조가 있어야 함."""

    def test_consistent_bidirectional(self):
        spec = _spec([
            {"id": "F-002", "superseded_by": "F-003"},
            {"id": "F-003", "supersedes": ["F-002"]},
        ])
        findings = check.check_anchor(spec)
        self.assertEqual(
            [f for f in findings if "양방향" in f.message],
            [],
        )

    def test_inconsistent_bidirectional_warns(self):
        """F-002.superseded_by=F-003 인데 F-003.supersedes 에 F-002 없음."""
        spec = _spec([
            {"id": "F-002", "superseded_by": "F-003"},
            {"id": "F-003"},
        ])
        findings = check.check_anchor(spec)
        warns = [f for f in findings if "양방향" in f.message]
        self.assertEqual(len(warns), 1, f"expected 1 bidir warn, got: {[f.message for f in findings]}")
        self.assertEqual(warns[0].severity, "warn")


if __name__ == "__main__":
    unittest.main()
