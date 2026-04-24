#!/usr/bin/env python3
"""
include_expander.py — harness-boot $include 전개 엔진 (F-009)

사용:
  python3 scripts/include_expander.py <spec.yaml>                  # 전개 후 stdout 출력
  python3 scripts/include_expander.py <spec.yaml> --chapters DIR   # chapters 디렉터리 지정
  python3 scripts/include_expander.py <spec.yaml> --inplace        # <spec>.yaml.expanded 에 write
  python3 scripts/include_expander.py <spec.yaml> --list           # include 노드 경로만 나열

$include 문법 (spec.yaml 내부):
  project:
    description:
      $include: "chapters/project-description.md"

  ↓ expand 후

  project:
    description: "<chapters/project-description.md 의 전체 내용>"

규칙 (design doc §5.1 + §13.11):
  1. `$include` 키는 mapping 이 단일 키로만 가질 때만 전개 대상 (다른 키와 섞이면 무시).
  2. 값은 상대 경로. 기본 base 는 `<spec 위치>/.harness/chapters/` — 없으면 `<spec 위치>/chapters/`.
  3. **Depth 1 강제**: 전개된 파일 내부에 또 다른 `$include` 가 있어도 그대로 문자열 보존 (재귀 금지).
  4. **🔒 필드 차단**: `id`, `version`, `name`, `type`, `status`, `priority` 등 식별자 필드에는 `$include` 삽입 불가.
  5. 파일 not found · 권한 없음 → 즉시 에러 (Fail-Fast).

외부 의존: PyYAML.

참조: docs/samples/harness-boot-self/spec.yaml F-009.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("pyyaml is required. Install: pip install pyyaml", file=sys.stderr)
    sys.exit(1)


# 🔒 필드명 — 이 이름 바로 아래에 $include 가 있으면 거부.
# 다양한 레벨에서 등장 가능하므로 키 이름만으로 판정.
LOCKED_FIELD_NAMES = frozenset(
    {
        "id",
        "version",
        "name",
        "type",
        "status",
        "priority",
        "schema_version",
    }
)


class IncludeError(Exception):
    """$include 전개 중 일어난 에러 (경로 포함)."""


def _resolve_chapters_dir(spec_path: Path, explicit: Path | None) -> Path:
    """chapters/ 디렉터리 위치 결정.

    우선순위:
      1. 명시된 --chapters 인자
      2. <spec 부모>/.harness/chapters/
      3. <spec 부모>/chapters/
    (3 개 모두 실패해도 에러는 아님 — $include 가 없으면 OK)
    """
    if explicit is not None:
        return explicit
    base = spec_path.parent
    candidate1 = base / ".harness" / "chapters"
    if candidate1.is_dir():
        return candidate1
    candidate2 = base / "chapters"
    if candidate2.is_dir():
        return candidate2
    return candidate1  # 실존 여부와 관계없이 기본


def _is_include_node(value: Any) -> bool:
    """해당 value 가 `{$include: <path>}` 단일-키 mapping 인가?"""
    return (
        isinstance(value, dict)
        and len(value) == 1
        and "$include" in value
        and isinstance(value["$include"], str)
    )


def _find_includes(
    obj: Any,
    *,
    path: tuple = (),
    parent_key: str | None = None,
) -> list[dict]:
    """트리 내 $include 노드 위치 수집.

    각 항목: {"path": (키 경로), "target": <상대 경로>, "parent_key": <부모 키 이름>}
    """
    found: list[dict] = []
    if _is_include_node(obj):
        found.append(
            {
                "path": path,
                "target": obj["$include"],
                "parent_key": parent_key,
            }
        )
        return found  # $include 노드 자체는 더 들어가지 않음 (값이 경로 문자열)

    if isinstance(obj, dict):
        for k, v in obj.items():
            found.extend(_find_includes(v, path=path + (k,), parent_key=k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            found.extend(_find_includes(v, path=path + (i,), parent_key=parent_key))

    return found


def _read_chapter(chapters_dir: Path, rel: str) -> str:
    """chapters_dir 기준으로 파일 읽어 문자열 반환. 보안상 상위 경로 escape 차단."""
    rel_path = Path(rel)
    if rel_path.is_absolute():
        raise IncludeError(f"$include 값은 절대 경로일 수 없음: {rel}")
    # `..` 포함 여부 체크 — chapters_dir 를 escape 하지 못하도록
    target = (chapters_dir / rel_path).resolve()
    try:
        target.relative_to(chapters_dir.resolve())
    except ValueError:
        raise IncludeError(
            f"$include 경로가 chapters 디렉터리를 벗어남: {rel} → {target}"
        )
    if not target.is_file():
        raise IncludeError(f"$include 대상 파일 없음: {target}")
    try:
        return target.read_text(encoding="utf-8")
    except OSError as e:
        raise IncludeError(f"$include 파일 읽기 실패 ({target}): {e}")


def _apply_replacements(obj: Any, replacements: dict[tuple, str]) -> Any:
    """path 키가 있는 위치를 문자열로 교체한 새 객체를 반환 (in-place 변형 없음)."""

    def walk(sub: Any, cur_path: tuple) -> Any:
        if cur_path in replacements:
            return replacements[cur_path]
        if isinstance(sub, dict):
            return {k: walk(v, cur_path + (k,)) for k, v in sub.items()}
        if isinstance(sub, list):
            return [walk(v, cur_path + (i,)) for i, v in enumerate(sub)]
        return sub

    return walk(obj, ())


def expand(
    spec: dict,
    chapters_dir: Path,
    *,
    strict_locked_fields: bool = True,
) -> dict:
    """spec 객체의 $include 를 모두 depth-1 전개한 새 객체 반환.

    - chapters_dir: $include 상대 경로의 base.
    - strict_locked_fields: LOCKED_FIELD_NAMES 하위의 $include 를 거부할지.
    """
    includes = _find_includes(spec)
    if not includes:
        return spec  # no-op

    replacements: dict[tuple, str] = {}
    for item in includes:
        parent_key = item["parent_key"]
        target = item["target"]

        if strict_locked_fields and parent_key in LOCKED_FIELD_NAMES:
            raise IncludeError(
                f"🔒 필드 `{parent_key}` 에는 $include 를 사용할 수 없음 "
                f"(경로: {'.'.join(map(str, item['path']))}, target: {target})"
            )

        content = _read_chapter(chapters_dir, target)
        replacements[item["path"]] = content

    # Depth 1: 치환된 content 는 문자열이므로 다시 트리 재탐색 안 함.
    # 원본 spec 객체는 불변 유지.
    return _apply_replacements(spec, replacements)


def load_spec(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"{path}: top-level YAML 이 mapping 이 아님")
    return data


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="harness-boot $include expander")
    parser.add_argument("spec", type=Path, help="spec.yaml 경로")
    parser.add_argument(
        "--chapters",
        type=Path,
        default=None,
        help="chapters 디렉터리 경로 (기본: <spec>/../.harness/chapters/ or <spec>/../chapters/)",
    )
    parser.add_argument(
        "--inplace",
        action="store_true",
        help="<spec>.expanded 파일로 write (stdout 출력 대신)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="전개하지 않고 $include 노드 경로만 나열",
    )
    parser.add_argument(
        "--allow-locked",
        action="store_true",
        help="🔒 필드에서도 $include 허용 (디버그/우회용)",
    )
    args = parser.parse_args(argv)

    if not args.spec.is_file():
        print(f"error: {args.spec} not found", file=sys.stderr)
        return 2

    spec = load_spec(args.spec)

    if args.list:
        for item in _find_includes(spec):
            print(f"  {'.'.join(map(str, item['path']))} -> {item['target']}")
        return 0

    chapters_dir = _resolve_chapters_dir(args.spec, args.chapters)

    try:
        expanded = expand(
            spec, chapters_dir, strict_locked_fields=not args.allow_locked
        )
    except IncludeError as e:
        print(f"include error: {e}", file=sys.stderr)
        return 3

    output = yaml.safe_dump(
        expanded,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
    )

    if args.inplace:
        out_path = args.spec.with_suffix(args.spec.suffix + ".expanded")
        out_path.write_text(output, encoding="utf-8")
        print(f"wrote {out_path}")
    else:
        sys.stdout.write(output)

    return 0


if __name__ == "__main__":
    sys.exit(main())
