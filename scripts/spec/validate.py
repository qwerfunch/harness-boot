#!/usr/bin/env python3
"""
validate_spec.py — spec.yaml 을 docs/schemas/spec.schema.json 으로 검증.

사용:
  python3 scripts/validate_spec.py <spec.yaml>                # 성공: exit 0, 실패: exit 5
  python3 scripts/validate_spec.py <spec.yaml> --schema PATH  # 스키마 명시
  python3 scripts/validate_spec.py <spec.yaml> --json         # 첫 에러를 JSON 으로

의존성: pyyaml · jsonschema.

단독 CLI 로도 쓰고 sync.py 에서 import 해서도 씀. `docs/schemas/spec.schema.json` 은
이 스크립트 위치에서 ../docs/schemas/spec.schema.json 으로 자동 탐색.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("pyyaml is required", file=sys.stderr)
    sys.exit(1)

try:
    import jsonschema
except ImportError:
    jsonschema = None  # optional


class SpecValidationError(Exception):
    """스펙이 스키마에 부합하지 않음. message + path 포함."""

    def __init__(self, message: str, path: list[str | int], reason: str = ""):
        self.message = message
        self.path = path
        self.reason = reason
        super().__init__(message)


def _default_schema_path() -> Path:
    """repo 루트의 docs/schemas/spec.schema.json 탐색.

    File location is ``scripts/spec/validate.py`` — ``parents[2]`` climbs
    scripts/spec → scripts → repo root. (v0.7.6 relocation fixed here in
    v0.8.4; before that the path resolved to ``scripts/docs/...`` which only
    looked healthy locally when ``jsonschema`` was absent and tests skipped.)
    """
    repo = Path(__file__).resolve().parents[2]
    return repo / "docs" / "schemas" / "spec.schema.json"


def validate(spec: dict, schema_path: Path | None = None) -> None:
    """spec 을 스키마로 검증. 문제 있으면 SpecValidationError.

    jsonschema 미설치 시 silently no-op (경고만).
    """
    if jsonschema is None:
        print(
            "warn: jsonschema not installed — structural validation skipped",
            file=sys.stderr,
        )
        return

    if schema_path is None:
        schema_path = _default_schema_path()
    if not schema_path.is_file():
        raise SpecValidationError(
            f"스키마 파일 없음: {schema_path}",
            path=[],
            reason="missing_schema_file",
        )

    with schema_path.open("r", encoding="utf-8") as f:
        schema = json.load(f)

    try:
        jsonschema.validate(spec, schema)
    except jsonschema.ValidationError as e:
        # path 는 Deque[str|int] — 사람이 읽기 편한 형태로
        path = list(e.absolute_path)
        path_str = ".".join(str(p) for p in path) if path else "(root)"
        raise SpecValidationError(
            message=f"{path_str}: {e.message}",
            path=path,
            reason=e.validator,
        )


def load_spec(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise SpecValidationError(
            f"{path}: top-level YAML must be a mapping", path=[], reason="top_level"
        )
    return data


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate spec.yaml against the JSONSchema")
    parser.add_argument("spec", type=Path)
    parser.add_argument("--schema", type=Path, default=None)
    parser.add_argument("--json", action="store_true", help="emit first error as JSON")
    args = parser.parse_args(argv)

    if not args.spec.is_file():
        print(f"error: {args.spec} not found", file=sys.stderr)
        return 2

    try:
        spec = load_spec(args.spec)
        validate(spec, schema_path=args.schema)
    except SpecValidationError as e:
        if args.json:
            json.dump(
                {"ok": False, "path": e.path, "message": e.message, "reason": e.reason},
                sys.stdout,
                indent=2,
                ensure_ascii=False,
            )
            print()
        else:
            print(f"invalid: {e.message}", file=sys.stderr)
            if e.reason:
                print(f"  reason: {e.reason}", file=sys.stderr)
        return 5

    if args.json:
        json.dump({"ok": True}, sys.stdout, indent=2)
        print()
    else:
        print(f"valid — {args.spec}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
