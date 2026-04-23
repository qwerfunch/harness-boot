#!/usr/bin/env python3
"""
spec_diff.py — /harness:spec Mode A/R 의 diff 렌더러.

사용:
  python3 scripts/spec_diff.py <old.yaml> <new.yaml>       # unified diff
  python3 scripts/spec_diff.py <old.yaml> <new.yaml> --yaml # canonical YAML diff
  python3 scripts/spec_diff.py <spec.yaml> --git-head       # HEAD 와 비교
  python3 scripts/spec_diff.py <old> <new> --stat           # section-level summary
  python3 scripts/spec_diff.py <old> <new> --json           # JSON diff tree

스타일:
  기본은 `difflib.unified_diff` — 단순 텍스트 비교 (YAML 텍스트 그대로).
  --yaml 플래그 시 YAML 을 canonical form 으로 정규화 후 diff — 주석/순서 차이 무시.
  --stat 플래그 시 어떤 섹션이 바뀌었는지 high-level 요약.

Mode A/R 에서 사용자가 diff 를 리뷰한 뒤 승인하면 spec.yaml 을 write.
"""

from __future__ import annotations

import argparse
import difflib
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("pyyaml is required", file=sys.stderr)
    sys.exit(1)

# Optional: canonical_hash module for structural diff
_THIS = Path(__file__).resolve().parent
if str(_THIS) not in sys.path:
    sys.path.insert(0, str(_THIS))


def unified_text_diff(old_text: str, new_text: str, *, from_label: str, to_label: str) -> str:
    """기본 텍스트 unified diff."""
    diff = difflib.unified_diff(
        old_text.splitlines(keepends=True),
        new_text.splitlines(keepends=True),
        fromfile=from_label,
        tofile=to_label,
        lineterm="",
    )
    return "".join(diff)


def canonical_yaml_diff(old_obj: Any, new_obj: Any, *, from_label: str, to_label: str) -> str:
    """canonical YAML 로 정규화 후 diff — 주석/순서 무시."""
    old_canon = yaml.safe_dump(old_obj, sort_keys=True, allow_unicode=True, default_flow_style=False)
    new_canon = yaml.safe_dump(new_obj, sort_keys=True, allow_unicode=True, default_flow_style=False)
    return unified_text_diff(old_canon, new_canon, from_label=from_label, to_label=to_label)


_TOP_LEVEL_KEYS = ("project", "domain", "constraints", "deliverable", "features", "metadata", "version")


def section_stat(old: dict, new: dict) -> dict:
    """top-level section 별 변경 요약."""
    result: dict[str, str] = {}
    for key in _TOP_LEVEL_KEYS:
        o = old.get(key)
        n = new.get(key)
        if o == n:
            continue
        if o is None:
            result[key] = "added"
        elif n is None:
            result[key] = "removed"
        else:
            result[key] = "modified"

    # features 단위 상세
    old_features = {f.get("id"): f for f in (old.get("features") or []) if isinstance(f, dict)}
    new_features = {f.get("id"): f for f in (new.get("features") or []) if isinstance(f, dict)}
    feature_changes: dict[str, str] = {}
    for fid in sorted(set(old_features) | set(new_features)):
        if fid not in old_features:
            feature_changes[fid] = "added"
        elif fid not in new_features:
            feature_changes[fid] = "removed"
        elif old_features[fid] != new_features[fid]:
            feature_changes[fid] = "modified"

    if feature_changes:
        result["feature_changes"] = feature_changes
    return result


def git_head_version(spec_path: Path) -> str | None:
    """git 이 있고 repo 안이면 HEAD 버전의 spec 텍스트 반환, 아니면 None."""
    try:
        repo_root = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=spec_path.parent,
            stderr=subprocess.DEVNULL,
        ).decode().strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None

    rel = spec_path.resolve().relative_to(Path(repo_root))
    try:
        result = subprocess.run(
            ["git", "show", f"HEAD:{rel}"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout
    except subprocess.CalledProcessError:
        return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Render diff between two spec.yaml versions")
    parser.add_argument("old", type=Path, help="old spec path (or current spec if --git-head)")
    parser.add_argument("new", type=Path, nargs="?", default=None, help="new spec path")
    parser.add_argument("--git-head", action="store_true", help="compare old against its git HEAD")
    parser.add_argument("--yaml", action="store_true", help="canonical YAML diff (ignore formatting)")
    parser.add_argument("--stat", action="store_true", help="section-level summary only")
    parser.add_argument("--json", action="store_true", help="emit stat as JSON")
    args = parser.parse_args(argv)

    # old text + new text 결정
    if args.git_head:
        if args.new is not None:
            print("error: --git-head 는 new 인자와 함께 쓸 수 없음", file=sys.stderr)
            return 2
        head_text = git_head_version(args.old)
        if head_text is None:
            print(f"error: {args.old} 에 대한 git HEAD 조회 실패", file=sys.stderr)
            return 3
        old_text = head_text
        new_text = args.old.read_text(encoding="utf-8")
        from_label = f"HEAD:{args.old.name}"
        to_label = f"working:{args.old.name}"
    else:
        if args.new is None:
            print("error: new 인자가 필요 (또는 --git-head)", file=sys.stderr)
            return 2
        old_text = args.old.read_text(encoding="utf-8")
        new_text = args.new.read_text(encoding="utf-8")
        from_label = str(args.old)
        to_label = str(args.new)

    if args.stat or args.json:
        old_obj = yaml.safe_load(old_text) or {}
        new_obj = yaml.safe_load(new_text) or {}
        stats = section_stat(old_obj, new_obj)
        if args.json:
            json.dump(stats, sys.stdout, indent=2, ensure_ascii=False)
            print()
        else:
            if not stats:
                print("no changes at section level")
            else:
                for k, v in stats.items():
                    if k == "feature_changes":
                        print(f"features:")
                        for fid, op in v.items():
                            print(f"  {op:8} {fid}")
                    else:
                        print(f"{k}: {v}")
        return 0

    # diff 출력
    if args.yaml:
        old_obj = yaml.safe_load(old_text) or {}
        new_obj = yaml.safe_load(new_text) or {}
        diff = canonical_yaml_diff(old_obj, new_obj, from_label=from_label, to_label=to_label)
    else:
        diff = unified_text_diff(old_text, new_text, from_label=from_label, to_label=to_label)

    if not diff:
        print("no changes")
        return 0
    sys.stdout.write(diff)
    return 0


if __name__ == "__main__":
    sys.exit(main())
