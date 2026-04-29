"""F-040 — locale resolver tests."""

from __future__ import annotations

import os
import unittest
from unittest import mock

from legacy.scripts.ui.lang import resolve_lang


class TestEnvOverride(unittest.TestCase):
    @mock.patch.dict(os.environ, {"HARNESS_LANG": "ko"}, clear=False)
    def test_env_ko_wins(self) -> None:
        self.assertEqual(resolve_lang(spec={"project": {"language": "en"}}), "ko")

    @mock.patch.dict(os.environ, {"HARNESS_LANG": "en"}, clear=False)
    def test_env_en_wins(self) -> None:
        self.assertEqual(resolve_lang(spec={"project": {"language": "ko"}}), "en")

    @mock.patch.dict(os.environ, {"HARNESS_LANG": "fr"}, clear=False)
    def test_env_unknown_falls_back_to_en(self) -> None:
        self.assertEqual(resolve_lang(), "en")


class TestSpecLanguage(unittest.TestCase):
    def setUp(self) -> None:
        # Clear HARNESS_LANG to isolate spec branch
        self._patcher = mock.patch.dict(
            os.environ,
            {"LC_ALL": "C", "LANG": "C"},
            clear=False,
        )
        self._patcher.start()
        os.environ.pop("HARNESS_LANG", None)

    def tearDown(self) -> None:
        self._patcher.stop()

    def test_spec_ko(self) -> None:
        self.assertEqual(resolve_lang(spec={"project": {"language": "ko"}}), "ko")

    def test_spec_en(self) -> None:
        self.assertEqual(resolve_lang(spec={"project": {"language": "en"}}), "en")

    def test_spec_auto_falls_through_to_locale(self) -> None:
        # LC_ALL=C → "en" fallback
        self.assertEqual(resolve_lang(spec={"project": {"language": "auto"}}), "en")


class TestSystemLocale(unittest.TestCase):
    def test_lc_all_ko_kr_returns_ko(self) -> None:
        with mock.patch.dict(os.environ, {"LC_ALL": "ko_KR.UTF-8"}, clear=True):
            self.assertEqual(resolve_lang(), "ko")

    def test_lang_ko_kr_returns_ko(self) -> None:
        with mock.patch.dict(os.environ, {"LANG": "ko_KR.UTF-8"}, clear=True):
            self.assertEqual(resolve_lang(), "ko")

    def test_en_us_returns_en(self) -> None:
        with mock.patch.dict(os.environ, {"LC_ALL": "en_US.UTF-8"}, clear=True):
            self.assertEqual(resolve_lang(), "en")

    def test_no_locale_falls_back_to_en(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(resolve_lang(), "en")


class TestSpecMissingProjectLanguage(unittest.TestCase):
    def test_no_spec_uses_env_fallback(self) -> None:
        with mock.patch.dict(os.environ, {"LC_ALL": "ko_KR.UTF-8"}, clear=True):
            self.assertEqual(resolve_lang(), "ko")

    def test_spec_without_language_field_falls_through(self) -> None:
        with mock.patch.dict(os.environ, {"LC_ALL": "ko_KR.UTF-8"}, clear=True):
            self.assertEqual(resolve_lang(spec={"project": {"name": "x"}}), "ko")


if __name__ == "__main__":
    unittest.main()
