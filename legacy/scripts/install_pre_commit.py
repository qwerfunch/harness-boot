"""F-034 (v0.10.9) — install/uninstall the harness-boot pre-commit hook.

The plugin ships ``hooks/pre-commit-phase2.sh``. This installer copies its
contents into ``<repo>/.git/hooks/pre-commit`` so git invokes the Phase 2
discipline check on every commit. Existing hooks are preserved unless
``--force`` is passed.

CLI:
    python3 scripts/install_pre_commit.py --install [--force]
    python3 scripts/install_pre_commit.py --uninstall
    python3 scripts/install_pre_commit.py --status

Bypass (post-install):
    HARNESS_BYPASS_PRE_COMMIT=1 git commit ...
    git commit --no-verify
"""

from __future__ import annotations

import argparse
import os
import shutil
import stat
import sys
from pathlib import Path


_PHASE2_MARKER = "F-034"  # appears in the shipped hook header


def _plugin_root() -> Path:
    # This script lives at <root>/scripts/install_pre_commit.py.
    return Path(__file__).resolve().parents[2]


def _hook_source(plugin_root: Path) -> Path:
    return plugin_root / "hooks" / "pre-commit-phase2.sh"


def _hook_target(repo_root: Path) -> Path:
    return repo_root / ".git" / "hooks" / "pre-commit"


def _is_harness_hook(target: Path) -> bool:
    if not target.is_file():
        return False
    try:
        return _PHASE2_MARKER in target.read_text(encoding="utf-8")
    except OSError:
        return False


def install(repo_root: Path, plugin_root: Path, *, force: bool = False) -> tuple[bool, str]:
    src = _hook_source(plugin_root)
    if not src.is_file():
        return False, f"source missing: {src}"

    git_dir = repo_root / ".git"
    if not git_dir.is_dir():
        return False, f"not a git repo: {repo_root}"

    target = _hook_target(repo_root)
    target.parent.mkdir(parents=True, exist_ok=True)

    if target.exists() and not _is_harness_hook(target) and not force:
        return False, (
            f"existing pre-commit hook at {target} (not harness-boot's). "
            "Pass --force to overwrite or back it up first."
        )

    shutil.copyfile(src, target)
    mode = target.stat().st_mode
    target.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return True, f"installed → {target}"


def uninstall(repo_root: Path) -> tuple[bool, str]:
    target = _hook_target(repo_root)
    if not target.exists():
        return True, f"no pre-commit hook at {target} — nothing to do"
    if not _is_harness_hook(target):
        return False, (
            f"pre-commit at {target} is not harness-boot's "
            "(F-034 marker missing) — leaving it alone"
        )
    target.unlink()
    return True, f"uninstalled {target}"


def status(repo_root: Path) -> tuple[bool, str]:
    target = _hook_target(repo_root)
    if not target.exists():
        return True, "not installed"
    if _is_harness_hook(target):
        return True, f"installed (harness-boot F-034) at {target}"
    return True, f"different pre-commit hook present at {target} — not harness-boot's"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    grp = parser.add_mutually_exclusive_group(required=True)
    grp.add_argument("--install", action="store_true")
    grp.add_argument("--uninstall", action="store_true")
    grp.add_argument("--status", action="store_true")
    parser.add_argument("--force", action="store_true", help="overwrite non-harness pre-commit hook")
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path.cwd(),
        help="target git repo (default: cwd)",
    )
    parser.add_argument(
        "--plugin-root",
        type=Path,
        default=_plugin_root(),
        help="harness-boot plugin root (default: this script's parent's parent)",
    )
    args = parser.parse_args(argv)

    if args.install:
        ok, msg = install(args.repo_root, args.plugin_root, force=args.force)
    elif args.uninstall:
        ok, msg = uninstall(args.repo_root)
    else:
        ok, msg = status(args.repo_root)

    print(msg, file=sys.stderr if not ok else sys.stdout)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
