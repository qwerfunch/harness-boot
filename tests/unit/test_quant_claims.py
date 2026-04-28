"""Unit tests for scripts/spec/quant_claims.py (F-077).

Contract: extract_numeric_claims pulls quantitative claims from prose
(feature description and AC text) and diff_claims flags mismatches where
the description over-promises relative to AC. The lint is informational
only — fail-open at the activate boundary.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from spec import quant_claims as qc  # noqa: E402


class ExtractNumericClaimsTests(unittest.TestCase):
    """AC-2 — three pattern families: counter-noun · prefix-≥ · fraction."""

    def test_counter_noun_korean_and_english(self):
        claims = qc.extract_numeric_claims("13 ChainTemplate 와 74 propagation rule 적용")
        metrics = [c.metric for c in claims]
        values = [c.value for c in claims]
        self.assertIn("chaintemplate", metrics)
        self.assertIn("rule", metrics)
        self.assertIn(13, values)
        self.assertIn(74, values)

    def test_counter_noun_korean_gae(self):
        claims = qc.extract_numeric_claims("총 35개 Heuristic 도구")
        self.assertEqual(len(claims), 1)
        self.assertEqual(claims[0].metric, "개")
        self.assertEqual(claims[0].value, 35)

    def test_geq_prefix(self):
        claims = qc.extract_numeric_claims("F1 ≥ 83 percent")
        self.assertTrue(any(c.value == 83 for c in claims))

    def test_fraction_pattern(self):
        claims = qc.extract_numeric_claims("5/13 ChainTemplate covered so far")
        # Fraction returns both numerator (covered) and denominator (target)
        values = sorted(c.value for c in claims)
        self.assertIn(5, values)
        self.assertIn(13, values)

    def test_empty_text(self):
        self.assertEqual(qc.extract_numeric_claims(""), [])

    def test_garbage_text(self):
        # No digits → no claims, no exception
        self.assertEqual(qc.extract_numeric_claims("lorem ipsum dolor sit amet"), [])


class DiffClaimsTests(unittest.TestCase):
    """AC-3 — mismatch is description_value > ac_value for the same metric."""

    def test_mismatch_surfaced(self):
        desc = "13 ChainTemplate 풀셋 + 74 propagation rule"
        ac = ["AC-1: 5 ChainTemplate matching regression PASS"]
        diffs = qc.diff_claims(desc, ac)
        # Expect a mismatch on chaintemplate (13 > 5). Rule has no AC counterpart → silent.
        metrics = [d.metric for d in diffs]
        self.assertIn("chaintemplate", metrics)
        chain_diff = next(d for d in diffs if d.metric == "chaintemplate")
        self.assertEqual(chain_diff.description_value, 13)
        self.assertEqual(chain_diff.ac_value, 5)

    def test_matching_values_silent(self):
        desc = "10 rules with 10 covered"
        ac = ["AC-1: 10 rules verified"]
        diffs = qc.diff_claims(desc, ac)
        rule_diffs = [d for d in diffs if d.metric == "rule"]
        self.assertEqual(rule_diffs, [])

    def test_ac_only_metric_silent(self):
        # AC mentions a metric description does not — no mismatch.
        desc = "no numeric claim in description"
        ac = ["AC-1: 5 templates"]
        diffs = qc.diff_claims(desc, ac)
        self.assertEqual(diffs, [])

    def test_description_only_metric_silent(self):
        # Description mentions a metric AC does not — no mismatch (no
        # baseline to compare against; user may intend full carry).
        desc = "13 ChainTemplate"
        ac = ["AC-1: skeleton boots"]
        diffs = qc.diff_claims(desc, ac)
        self.assertEqual(diffs, [])

    def test_diff_order_stable_by_metric_token(self):
        desc = "10 zebra and 5 apple and 7 mango"
        ac = ["AC: 1 zebra, 1 apple, 1 mango"]
        diffs = qc.diff_claims(desc, ac)
        metrics = [d.metric for d in diffs]
        self.assertEqual(metrics, sorted(metrics))


if __name__ == "__main__":
    unittest.main()
