#!/usr/bin/env python3
"""
upgrade_to_2_3_8.py — harness-boot spec.yaml v2.3.7 → v2.3.8 마이그레이션

사용:
  python3 scripts/upgrade_to_2_3_8.py <path/to/spec.yaml> [--dry-run] [--no-backup]

효과:
  metadata.extensions.* 하위 8 블록을 metadata.* 로 승격:
    command_map / ambient_files / host_binding / drift_catalog /
    versioning_axes / contribution_points / preamble_contract /
    changelog (※ gate_chain 도 같은 규칙으로 승격 — P1 MAY)

  agent_permissions 은 v2.4.0 소관이므로 이관하지 않음 (extensions 에 유지).

  주석과 순서는 ruamel.yaml 의 round-trip 모드로 최대한 보존.
  원본은 <spec>.yaml.bak 로 백업 (--no-backup 시 생략).

근거: design/rfcs/v2.3.8-metadata-extensions-promotion.md §3.3
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

try:
    from ruamel.yaml import YAML
except ImportError:
    sys.stderr.write(
        "ruamel.yaml is required. Install: pip install ruamel.yaml --break-system-packages\n"
    )
    sys.exit(2)


# v2.3.8 로 승격할 블록 목록 (P0 5 + P1 3 + P2 1 = 9 블록)
PROMOTE_BLOCKS = (
    "command_map",
    "ambient_files",
    "host_binding",
    "drift_catalog",
    "versioning_axes",
    "contribution_points",
    "preamble_contract",
    "changelog",
    "gate_chain",
)

# v2.3.8 범위 밖 — v2.4.0 에서 처리
RETAINED_IN_EXTENSIONS = (
    "agent_permissions",
)


def promote(spec_path: Path, *, dry_run: bool, keep_backup: bool) -> dict:
    """
    Perform the in-place promotion. Returns a summary dict:
      {moved: [...], kept_in_extensions: [...], conflicts: [...], extensions_emptied: bool}
    """
    yaml = YAML()
    yaml.preserve_quotes = True
    yaml.width = 4096  # avoid line re-wrapping
    yaml.indent(mapping=2, sequence=4, offset=2)

    with spec_path.open("r", encoding="utf-8") as f:
        doc = yaml.load(f)

    if not isinstance(doc, dict):
        raise SystemExit(f"error: {spec_path} root is not a mapping")

    metadata = doc.get("metadata")
    if metadata is None:
        raise SystemExit(f"error: {spec_path} has no 'metadata' block — nothing to upgrade")

    extensions = metadata.get("extensions")
    if extensions is None:
        return {
            "moved": [],
            "kept_in_extensions": [],
            "conflicts": [],
            "extensions_emptied": False,
            "note": "metadata.extensions absent — already at v2.3.8 or never experimental",
        }

    moved = []
    conflicts = []

    for block in PROMOTE_BLOCKS:
        if block not in extensions:
            continue
        if block in metadata:
            # already exists at top — prefer top-level (per RFC §3.2)
            conflicts.append(block)
            continue
        metadata[block] = extensions.pop(block)
        moved.append(block)

    kept = [b for b in RETAINED_IN_EXTENSIONS if b in extensions]

    # extensions 가 비면 제거 — 아직 남은 키(agent_permissions 등) 있으면 유지
    extensions_emptied = len(extensions) == 0
    if extensions_emptied:
        del metadata["extensions"]

    summary = {
        "path": str(spec_path),
        "moved": moved,
        "kept_in_extensions": kept,
        "conflicts": conflicts,
        "extensions_emptied": extensions_emptied,
    }

    if dry_run:
        summary["dry_run"] = True
        return summary

    if moved or extensions_emptied:
        if keep_backup:
            backup = spec_path.with_suffix(spec_path.suffix + ".bak")
            shutil.copy2(spec_path, backup)
            summary["backup"] = str(backup)
        with spec_path.open("w", encoding="utf-8") as f:
            yaml.dump(doc, f)
        summary["written"] = True
    else:
        summary["written"] = False
        summary["reason"] = "nothing to do"

    return summary


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+", type=Path, help="spec.yaml 경로 (다수 가능)")
    ap.add_argument("--dry-run", action="store_true", help="실제 쓰지 않고 요약만 출력")
    ap.add_argument("--no-backup", action="store_true", help=".yaml.bak 백업 생략")
    args = ap.parse_args()

    exit_code = 0
    for p in args.paths:
        if not p.exists():
            print(f"  SKIP: {p} (does not exist)", file=sys.stderr)
            exit_code = 1
            continue
        try:
            s = promote(p, dry_run=args.dry_run, keep_backup=not args.no_backup)
        except SystemExit as e:
            print(f"  FAIL: {p} — {e}", file=sys.stderr)
            exit_code = 1
            continue
        except Exception as e:  # pragma: no cover — defensive
            print(f"  ERROR: {p} — {type(e).__name__}: {e}", file=sys.stderr)
            exit_code = 1
            continue

        print(f"=== {p} ===")
        print(f"  moved: {s['moved']}")
        if s["kept_in_extensions"]:
            print(f"  kept_in_extensions (v2.4.0 대기): {s['kept_in_extensions']}")
        if s["conflicts"]:
            print(f"  conflicts (top-level 이미 존재 — skip): {s['conflicts']}")
        if s.get("dry_run"):
            print("  [dry-run] — no file changes")
        elif s.get("written"):
            print(f"  wrote: {p}")
            if "backup" in s:
                print(f"  backup: {s['backup']}")
        else:
            print(f"  skipped: {s.get('reason', 'n/a')}")
        print()

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
