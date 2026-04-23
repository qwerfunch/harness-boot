"""Tests for scripts/plugin_root.py (NEW-37 + NEW-44)."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import plugin_root as pr  # noqa: E402


class ScratchHomeMixin:
    """임시 HOME + plugin repo 를 꾸며서 전략들을 격리 테스트."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.home = self.tmp / "home"
        self.home.mkdir()
        (self.home / ".claude" / "plugins").mkdir(parents=True)
        # plugin repo (플러그인 소스 디렉터리)
        self.plugin_dir = self.tmp / "harness-boot-repo"
        (self.plugin_dir / ".claude-plugin").mkdir(parents=True)
        (self.plugin_dir / ".claude-plugin" / "plugin.json").write_text(
            json.dumps({"name": "harness", "version": "0.1.1"}),
            encoding="utf-8",
        )
        (self.plugin_dir / "bin").mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def write_registry(self, mapping: dict) -> None:
        (self.home / ".claude" / "plugins" / "installed_plugins.json").write_text(
            json.dumps(mapping), encoding="utf-8"
        )

    def write_settings(self, data: dict) -> None:
        (self.home / ".claude" / "settings.json").write_text(
            json.dumps(data), encoding="utf-8"
        )

    def write_marketplace(self, mp_root: Path, plugins: list) -> None:
        (mp_root / ".claude-plugin").mkdir(parents=True, exist_ok=True)
        (mp_root / ".claude-plugin" / "marketplace.json").write_text(
            json.dumps({"name": mp_root.name, "owner": {"name": "t"}, "plugins": plugins}),
            encoding="utf-8",
        )


class StrategyATests(ScratchHomeMixin, unittest.TestCase):
    """$PATH 에서 /plugins/.../bin 찾기."""

    def test_path_bin_hit(self):
        # 실제 repo 가 /plugins/ 에 있어야 regex 매칭
        plugin_in_plugins = self.tmp / "plugins" / "harness-boot"
        plugin_in_plugins.parent.mkdir()
        plugin_in_plugins.mkdir()
        (plugin_in_plugins / ".claude-plugin").mkdir()
        (plugin_in_plugins / ".claude-plugin" / "plugin.json").write_text(
            json.dumps({"name": "harness"}), encoding="utf-8"
        )
        (plugin_in_plugins / "bin").mkdir()
        with patch.dict(os.environ, {"PATH": str(plugin_in_plugins / "bin")}):
            root = pr._strategy_path_bin("harness")
            self.assertEqual(root, plugin_in_plugins.resolve())

    def test_path_bin_name_mismatch(self):
        """plugin.json.name 이 다르면 skip."""
        plugin_in_plugins = self.tmp / "plugins" / "other-plugin"
        plugin_in_plugins.parent.mkdir()
        plugin_in_plugins.mkdir()
        (plugin_in_plugins / ".claude-plugin").mkdir()
        (plugin_in_plugins / ".claude-plugin" / "plugin.json").write_text(
            json.dumps({"name": "other"}), encoding="utf-8"
        )
        (plugin_in_plugins / "bin").mkdir()
        with patch.dict(os.environ, {"PATH": str(plugin_in_plugins / "bin")}):
            self.assertIsNone(pr._strategy_path_bin("harness"))

    def test_path_without_plugins_skipped(self):
        """/plugins/ 를 포함하지 않는 PATH 엔트리는 무시."""
        with patch.dict(os.environ, {"PATH": "/usr/bin:/bin:/usr/local/bin"}):
            self.assertIsNone(pr._strategy_path_bin("harness"))


class StrategyBTests(ScratchHomeMixin, unittest.TestCase):
    """installed_plugins.json 의 installPath."""

    def test_registry_hit_with_existing_path(self):
        self.write_registry(
            {
                "version": 2,
                "plugins": {
                    "harness@some-mp": [
                        {"installPath": str(self.plugin_dir), "version": "0.1.1"}
                    ]
                },
            }
        )
        with patch.object(Path, "home", return_value=self.home):
            self.assertEqual(
                pr._strategy_registry("harness"), self.plugin_dir.resolve()
            )

    def test_registry_miss_when_installpath_doesnt_exist(self):
        """NEW-44 — directory-type 이면 installPath 경로 존재 안 할 수 있음."""
        self.write_registry(
            {
                "version": 2,
                "plugins": {
                    "harness@some-mp": [
                        {"installPath": "/nonexistent/path", "version": "0.1.1"}
                    ]
                },
            }
        )
        with patch.object(Path, "home", return_value=self.home):
            self.assertIsNone(pr._strategy_registry("harness"))

    def test_registry_name_mismatch(self):
        self.write_registry(
            {
                "version": 2,
                "plugins": {
                    "other@some-mp": [
                        {"installPath": str(self.plugin_dir)}
                    ]
                },
            }
        )
        with patch.object(Path, "home", return_value=self.home):
            self.assertIsNone(pr._strategy_registry("harness"))

    def test_registry_file_missing(self):
        with patch.object(Path, "home", return_value=self.home):
            self.assertIsNone(pr._strategy_registry("harness"))


class StrategyCTests(ScratchHomeMixin, unittest.TestCase):
    """marketplace source.path 결합 (NEW-44 fallback)."""

    def test_marketplace_source_hit(self):
        mp_root = self.tmp / "local-harness-marketplace"
        mp_root.mkdir()
        # marketplace 에 plugin source = self.plugin_dir 와 매핑되는 상대 경로
        (mp_root / "harness-src").mkdir()
        (mp_root / "harness-src" / ".claude-plugin").mkdir()
        (mp_root / "harness-src" / ".claude-plugin" / "plugin.json").write_text(
            json.dumps({"name": "harness"}), encoding="utf-8"
        )
        self.write_marketplace(
            mp_root,
            [{"name": "harness", "source": "./harness-src"}],
        )
        self.write_settings(
            {
                "extraKnownMarketplaces": {
                    "local-mp": {
                        "source": {"source": "directory", "path": str(mp_root)}
                    }
                }
            }
        )
        with patch.object(Path, "home", return_value=self.home):
            result = pr._strategy_marketplace_source("harness")
            self.assertEqual(result, (mp_root / "harness-src").resolve())

    def test_marketplace_not_directory_type_skipped(self):
        self.write_settings(
            {
                "extraKnownMarketplaces": {
                    "remote-mp": {
                        "source": {"source": "github", "repo": "x/y"}
                    }
                }
            }
        )
        with patch.object(Path, "home", return_value=self.home):
            self.assertIsNone(pr._strategy_marketplace_source("harness"))

    def test_no_marketplaces(self):
        self.write_settings({})
        with patch.object(Path, "home", return_value=self.home):
            self.assertIsNone(pr._strategy_marketplace_source("harness"))


class ChainTests(ScratchHomeMixin, unittest.TestCase):
    """4-전략 순차 적용 확인."""

    def test_full_failure_raises(self):
        with patch.dict(os.environ, {"PATH": "/usr/bin"}):
            with patch.object(Path, "home", return_value=self.home):
                with self.assertRaises(pr.PluginRootError):
                    pr.resolve("harness")

    def test_path_bin_wins_first(self):
        plugin_in_plugins = self.tmp / "plugins" / "harness-boot"
        plugin_in_plugins.parent.mkdir()
        plugin_in_plugins.mkdir()
        (plugin_in_plugins / ".claude-plugin").mkdir()
        (plugin_in_plugins / ".claude-plugin" / "plugin.json").write_text(
            json.dumps({"name": "harness"}), encoding="utf-8"
        )
        (plugin_in_plugins / "bin").mkdir()

        # registry 도 써두고 — 하지만 A 가 먼저 이겨야 함
        self.write_registry(
            {
                "version": 2,
                "plugins": {
                    "harness@mp": [{"installPath": str(self.plugin_dir)}]
                },
            }
        )

        with patch.dict(os.environ, {"PATH": str(plugin_in_plugins / "bin")}):
            with patch.object(Path, "home", return_value=self.home):
                result = pr.resolve("harness")
                self.assertEqual(result.strategy, "A:path-bin")
                self.assertEqual(result.root, plugin_in_plugins.resolve())

    def test_registry_wins_when_path_misses(self):
        self.write_registry(
            {
                "version": 2,
                "plugins": {
                    "harness@mp": [{"installPath": str(self.plugin_dir)}]
                },
            }
        )
        with patch.dict(os.environ, {"PATH": "/usr/bin"}):
            with patch.object(Path, "home", return_value=self.home):
                result = pr.resolve("harness")
                self.assertEqual(result.strategy, "B:registry")

    def test_attempts_tracked(self):
        self.write_registry(
            {
                "version": 2,
                "plugins": {
                    "harness@mp": [{"installPath": str(self.plugin_dir)}]
                },
            }
        )
        with patch.dict(os.environ, {"PATH": "/usr/bin"}):
            with patch.object(Path, "home", return_value=self.home):
                result = pr.resolve("harness")
                self.assertEqual(len(result.attempts), 2)
                self.assertIn("A path-bin: miss", result.attempts[0])
                self.assertIn("B registry: hit", result.attempts[1])


if __name__ == "__main__":
    unittest.main()
