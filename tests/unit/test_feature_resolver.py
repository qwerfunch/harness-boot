"""v0.9.1 — title fuzzy + @F-N resolver contract.

Goal: user input "login" or "@F-3" or "F-3" maps cleanly to a feature dict
from spec.yaml.features[]. Multiple matches produce a menu, no match is None.

Plan context: replaces mandatory F-N typing so users refer to features by
natural title substring. @F-N prefix is the power-user escape hatch. Final
wiring into work.py CLI happens in v0.9.2.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from ui.feature_resolver import (  # noqa: E402
    ResolveResult,
    resolve,
)


_SPEC = {
    "features": [
        {"id": "F-0", "title": "Walking skeleton"},
        {"id": "F-1", "title": "Login flow"},
        {"id": "F-2", "title": "User registration"},
        {"id": "F-3", "title": "User profile"},
        {"id": "F-4", "title": "Logout"},
        {"id": "F-5", "title": "Session timeout"},
    ]
}


class ExplicitAtFormTests(unittest.TestCase):
    """@F-N prefix — explicit feature id reference."""

    def test_at_form_resolves_existing(self):
        r = resolve("@F-3", _SPEC)
        self.assertEqual(r.kind, "single")
        self.assertEqual(r.feature["id"], "F-3")
        self.assertEqual(r.feature["title"], "User profile")

    def test_at_form_missing_id_is_none(self):
        r = resolve("@F-99", _SPEC)
        self.assertEqual(r.kind, "none")

    def test_at_form_rejects_invalid_pattern(self):
        r = resolve("@X-1", _SPEC)
        self.assertEqual(r.kind, "none")

    def test_at_form_with_whitespace(self):
        r = resolve("  @F-3  ", _SPEC)
        self.assertEqual(r.kind, "single")
        self.assertEqual(r.feature["id"], "F-3")


class PlainFnFormTests(unittest.TestCase):
    """Plain F-N (no @) also resolves — backward compat with existing CLI."""

    def test_plain_fn_resolves(self):
        r = resolve("F-1", _SPEC)
        self.assertEqual(r.kind, "single")
        self.assertEqual(r.feature["id"], "F-1")

    def test_plain_fn_missing_is_none(self):
        r = resolve("F-99", _SPEC)
        self.assertEqual(r.kind, "none")


class TitleFuzzyTests(unittest.TestCase):
    """Substring case-insensitive title match."""

    def test_single_match(self):
        r = resolve("walking", _SPEC)
        self.assertEqual(r.kind, "single")
        self.assertEqual(r.feature["id"], "F-0")

    def test_case_insensitive(self):
        r = resolve("LOGIN", _SPEC)
        self.assertEqual(r.kind, "single")
        self.assertEqual(r.feature["id"], "F-1")

    def test_multiple_matches_returns_menu(self):
        r = resolve("user", _SPEC)
        self.assertEqual(r.kind, "multiple")
        ids = [f["id"] for f in r.candidates]
        self.assertIn("F-2", ids)
        self.assertIn("F-3", ids)
        self.assertEqual(len(ids), 2)

    def test_no_match(self):
        r = resolve("nonexistent feature", _SPEC)
        self.assertEqual(r.kind, "none")

    def test_whitespace_normalized(self):
        r = resolve("  walking  ", _SPEC)
        self.assertEqual(r.kind, "single")
        self.assertEqual(r.feature["id"], "F-0")

    def test_partial_word(self):
        """Partial substring within title word matches."""
        r = resolve("skelet", _SPEC)
        self.assertEqual(r.kind, "single")
        self.assertEqual(r.feature["id"], "F-0")


class EmptyAndEdgeTests(unittest.TestCase):
    def test_empty_query_is_none(self):
        self.assertEqual(resolve("", _SPEC).kind, "none")
        self.assertEqual(resolve("   ", _SPEC).kind, "none")

    def test_empty_features_is_none(self):
        self.assertEqual(resolve("login", {"features": []}).kind, "none")
        self.assertEqual(resolve("@F-0", {"features": []}).kind, "none")

    def test_missing_features_key_is_none(self):
        self.assertEqual(resolve("login", {}).kind, "none")

    def test_feature_without_title_skipped(self):
        spec = {"features": [{"id": "F-0"}, {"id": "F-1", "title": "hello"}]}
        r = resolve("hello", spec)
        self.assertEqual(r.kind, "single")
        self.assertEqual(r.feature["id"], "F-1")


class PriorityTests(unittest.TestCase):
    """@F-N takes priority over title · plain F-N takes priority over title."""

    def test_at_form_wins_over_title(self):
        """If query is @F-N, never attempt title match even if it'd match multiple."""
        r = resolve("@F-2", _SPEC)
        self.assertEqual(r.kind, "single")
        self.assertEqual(r.feature["id"], "F-2")

    def test_plain_fn_wins_over_title(self):
        r = resolve("F-2", _SPEC)
        self.assertEqual(r.kind, "single")
        self.assertEqual(r.feature["id"], "F-2")


class ResolveResultShapeTests(unittest.TestCase):
    """Dataclass contract."""

    def test_single_has_feature_attr(self):
        r = resolve("@F-0", _SPEC)
        self.assertEqual(r.kind, "single")
        self.assertIsNotNone(r.feature)
        self.assertIsNone(r.candidates)

    def test_multiple_has_candidates(self):
        r = resolve("user", _SPEC)
        self.assertEqual(r.kind, "multiple")
        self.assertIsNone(r.feature)
        self.assertIsNotNone(r.candidates)
        self.assertGreater(len(r.candidates), 1)

    def test_none_has_neither(self):
        r = resolve("xxxx", _SPEC)
        self.assertEqual(r.kind, "none")
        self.assertIsNone(r.feature)
        self.assertIsNone(r.candidates)


if __name__ == "__main__":
    unittest.main()
