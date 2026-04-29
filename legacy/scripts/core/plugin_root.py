#!/usr/bin/env python3
"""
plugin_root.py — harness-boot 플러그인 루트 경로 해석 (NEW-37 + NEW-44)

`commands/init.md §2` 의 4-전략 체인을 Python 함수로 재사용 가능하게 추출.
sync.py · work.py 등 다른 스크립트에서 플러그인 내부 자산을 찾을 때 공통 사용.

사용:
  python3 scripts/plugin_root.py                  # 경로 1 줄 출력
  python3 scripts/plugin_root.py --json           # 전략 추적 JSON
  python3 scripts/plugin_root.py --plugin harness # 기본값 "harness"

전략 (첫 성공이 이김):
  A. $PATH 에서 `/plugins/.*/bin$` 패턴 찾아 역산 + plugin.json.name 매칭
  B. ~/.claude/plugins/installed_plugins.json 의 installPath (실존 시)
  C. ~/.claude/settings.json 의 extraKnownMarketplaces.<mp>.source.path + marketplace.json 의 plugin source
  D. 실패 시 PluginRootError

외부 의존: pyyaml (선택 — marketplace.json 이 yaml 일 경우).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


class PluginRootError(Exception):
    """플러그인 루트 해석 실패."""


@dataclass
class Resolution:
    """성공한 해석 결과 + 어떤 전략이 맞았는지 추적."""

    root: Path
    strategy: str
    attempts: list[str] = field(default_factory=list)


def _load_plugin_json(root: Path) -> dict | None:
    manifest = root / ".claude-plugin" / "plugin.json"
    if not manifest.is_file():
        return None
    try:
        with manifest.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def _strategy_path_bin(plugin_name: str) -> Path | None:
    """전략 A — $PATH 에서 /plugins/<dir>/bin 조각을 찾아 부모 디렉터리를 반환.

    plugin.json.name 이 plugin_name 과 매칭되는 것만 채택.
    """
    path_env = os.environ.get("PATH", "")
    for entry in path_env.split(os.pathsep):
        if not entry:
            continue
        # /plugins/ 를 포함하고 /bin 으로 끝나는 항목
        if "/plugins/" not in entry or not entry.rstrip("/").endswith("/bin"):
            continue
        candidate = Path(entry).parent
        try:
            resolved = candidate.resolve()
        except (OSError, RuntimeError):
            continue
        manifest = _load_plugin_json(resolved)
        if manifest and manifest.get("name") == plugin_name:
            return resolved
    return None


def _strategy_registry(plugin_name: str) -> Path | None:
    """전략 B — installed_plugins.json 의 installPath 가 실존할 때."""
    registry = Path.home() / ".claude" / "plugins" / "installed_plugins.json"
    if not registry.is_file():
        return None
    try:
        with registry.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None
    plugins = data.get("plugins", {}) if isinstance(data, dict) else {}
    for key, entries in plugins.items():
        if not key.startswith(f"{plugin_name}@"):
            continue
        if not isinstance(entries, list) or not entries:
            continue
        install_path = entries[0].get("installPath")
        if not install_path:
            continue
        path = Path(os.path.expanduser(install_path))
        if path.is_dir():
            return path.resolve()
    return None


def _strategy_marketplace_source(plugin_name: str) -> Path | None:
    """전략 C — directory-type marketplace 의 source.path 에서 plugin source 결합.

    NEW-44: installPath 가 실존하지 않을 때의 fallback.
    """
    settings = Path.home() / ".claude" / "settings.json"
    if not settings.is_file():
        return None
    try:
        with settings.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None

    marketplaces = data.get("extraKnownMarketplaces", {})
    if not isinstance(marketplaces, dict):
        return None

    for mp_name, mp_def in marketplaces.items():
        if not isinstance(mp_def, dict):
            continue
        src = mp_def.get("source", {})
        if src.get("source") != "directory":
            continue
        path_str = src.get("path")
        if not path_str:
            continue
        mp_root = Path(os.path.expanduser(path_str))
        if not mp_root.is_dir():
            continue
        mp_manifest = mp_root / ".claude-plugin" / "marketplace.json"
        if not mp_manifest.is_file():
            continue
        try:
            with mp_manifest.open("r", encoding="utf-8") as f:
                mp_data = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        for plugin_entry in mp_data.get("plugins", []):
            if plugin_entry.get("name") != plugin_name:
                continue
            plugin_src = plugin_entry.get("source", "./")
            if not isinstance(plugin_src, str):
                continue  # 원격 source 는 skip
            candidate = (mp_root / plugin_src).resolve()
            if candidate.is_dir():
                return candidate
    return None


def resolve(plugin_name: str = "harness") -> Resolution:
    """4-전략 체인으로 플러그인 루트 해석. 실패 시 PluginRootError."""
    attempts: list[str] = []

    root = _strategy_path_bin(plugin_name)
    attempts.append(f"A path-bin: {'hit' if root else 'miss'}")
    if root:
        return Resolution(root=root, strategy="A:path-bin", attempts=attempts)

    root = _strategy_registry(plugin_name)
    attempts.append(f"B registry: {'hit' if root else 'miss'}")
    if root:
        return Resolution(root=root, strategy="B:registry", attempts=attempts)

    root = _strategy_marketplace_source(plugin_name)
    attempts.append(f"C mp-source: {'hit' if root else 'miss'}")
    if root:
        return Resolution(
            root=root, strategy="C:marketplace-source", attempts=attempts
        )

    raise PluginRootError(
        f"플러그인 '{plugin_name}' 루트 해석 실패 — "
        f"attempts: {', '.join(attempts)}"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Resolve the harness-boot plugin root using the 4-strategy chain"
    )
    parser.add_argument("--plugin", default="harness", help="plugin name (default: harness)")
    parser.add_argument(
        "--json", action="store_true", help="emit JSON with strategy trace"
    )
    args = parser.parse_args(argv)

    try:
        result = resolve(args.plugin)
    except PluginRootError as e:
        print(f"error: {e}", file=sys.stderr)
        return 4

    if args.json:
        json.dump(
            {
                "root": str(result.root),
                "strategy": result.strategy,
                "attempts": result.attempts,
            },
            sys.stdout,
            indent=2,
            ensure_ascii=False,
        )
        print()
    else:
        print(result.root)
    return 0


if __name__ == "__main__":
    sys.exit(main())
