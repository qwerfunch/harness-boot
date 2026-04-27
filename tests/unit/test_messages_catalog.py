"""F-040 — message catalog tests."""

from __future__ import annotations

import unittest

from scripts.ui.messages import REQUIRED_KEYS, t


class TestCatalogContract(unittest.TestCase):
    def test_required_keys_have_en_translation(self) -> None:
        for key in REQUIRED_KEYS:
            value = t(key, lang="en")
            self.assertIsInstance(value, str)
            self.assertGreater(len(value), 0, msg=f"empty en for {key}")

    def test_required_keys_have_ko_translation(self) -> None:
        for key in REQUIRED_KEYS:
            value = t(key, lang="ko")
            self.assertIsInstance(value, str)
            self.assertGreater(len(value), 0, msg=f"empty ko for {key}")

    def test_required_keys_actually_differ_between_en_and_ko(self) -> None:
        # Catch a translator who copied en into ko by mistake. Brand-name
        # entries (intentionally identical across locales) are exempt.
        identical_by_design = {"dashboard_title"}
        same = [
            k for k in REQUIRED_KEYS
            if k not in identical_by_design and t(k, lang="en") == t(k, lang="ko")
        ]
        self.assertEqual(
            same, [], msg=f"keys with identical en/ko (likely missed): {same}"
        )


class TestLookupBehavior(unittest.TestCase):
    def test_unknown_key_raises(self) -> None:
        with self.assertRaises(KeyError):
            t("definitely-not-a-key", lang="en")

    def test_unknown_lang_falls_back_to_en(self) -> None:
        en_value = t("status", lang="en")
        self.assertEqual(t("status", lang="fr"), en_value)

    def test_default_lang_is_en(self) -> None:
        self.assertEqual(t("status"), t("status", lang="en"))


class TestSpecificCoreLabels(unittest.TestCase):
    def test_status_label(self) -> None:
        self.assertEqual(t("status", lang="en"), "status")
        self.assertEqual(t("status", lang="ko"), "상태")

    def test_evidence_label(self) -> None:
        self.assertIn("evidence", t("evidence", lang="en").lower())
        self.assertIn("근거", t("evidence", lang="ko"))

    def test_routed_agents_label(self) -> None:
        self.assertIn("agent", t("routed_agents", lang="en").lower())
        self.assertIn("팀", t("routed_agents", lang="ko"))


if __name__ == "__main__":
    unittest.main()
