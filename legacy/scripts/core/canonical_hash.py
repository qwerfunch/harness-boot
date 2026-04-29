#!/usr/bin/env python3
"""
canonical_hash.py — harness-boot canonical hashing (F-010)

사용:
  python3 scripts/canonical_hash.py <path/to/spec.yaml>           # root hash 만
  python3 scripts/canonical_hash.py <path/to/spec.yaml> --subtrees # root + subtree 맵
  python3 scripts/canonical_hash.py <path/to/spec.yaml> --json    # JSON 출력 (harness.yaml 에 merge 용이)

알고리즘 (부록 D 기반):
  1. YAML 을 Python 객체로 파싱 (주석·앵커·순서 무시).
  2. 객체를 **canonical JSON** 으로 직렬화 — sort_keys=True, separators=(',', ':').
     Unicode 는 그대로 (ensure_ascii=False) — 한국어 스펙 필드 해시 안정성.
  3. UTF-8 인코딩 후 SHA-256 → 16진수 64자.

Subtree 해시:
  project · domain · constraints · deliverable · features · metadata
  각각 독립 해시. features 는 배열이라 그대로 해시 (순서 영향 O).

Merkle 결합:
  subtree 해시들을 sorted(key: hash) 배열로 묶어 canonical JSON → SHA-256
  = merkle_hash. Full spec hash 와 다름 (다른 필드 주입 감지 가능).

제약:
  - $include 전개는 이 스크립트 범위 외. 입력은 이미 전개된 spec 을 가정.
  - 두 스펙이 **구조 동등** 하면 (YAML 표기만 다름) 같은 hash. 의도된 동작.
  - 외부 의존: PyYAML (pyyaml). ruamel.yaml 불필요 (canonical 은 순서 무시).

참조:
  - design/harness-boot-design-2.3.7.md 부록 D (원본 명세, gitignore 내부 문서).
  - docs/samples/harness-boot-self/spec.yaml F-010 — acceptance_criteria.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("pyyaml is required. Install: pip install pyyaml", file=sys.stderr)
    sys.exit(1)


def canonical_bytes(obj: Any) -> bytes:
    """객체 → canonical JSON bytes (UTF-8)."""
    return json.dumps(
        obj,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def canonical_hash(obj: Any) -> str:
    """객체 → SHA-256 16진수."""
    return hashlib.sha256(canonical_bytes(obj)).hexdigest()


# 고정 subtree 키 — 스펙 top-level 에서 해시할 것들.
SUBTREE_KEYS = (
    "project",
    "domain",
    "constraints",
    "deliverable",
    "features",
    "metadata",
)


def subtree_hashes(spec: dict) -> dict:
    """각 subtree 의 canonical hash 맵."""
    result = {}
    for key in SUBTREE_KEYS:
        if key in spec:
            result[key] = canonical_hash(spec[key])
    return result


def merkle_root(subtrees: dict) -> str:
    """subtree 해시들을 결합한 merkle root."""
    # sorted by key → 순서 독립적
    combined = [{"key": k, "hash": v} for k, v in sorted(subtrees.items())]
    return canonical_hash(combined)


def compute_all(spec: dict) -> dict:
    """전체 해시 번들. harness.yaml.generation.generated_from 과 매핑 가능."""
    st = subtree_hashes(spec)
    return {
        "spec_hash": canonical_hash(spec),
        "subtrees": st,
        "merkle_root": merkle_root(st),
    }


def load_spec(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"{path}: top-level YAML 이 mapping 이 아님")
    return data


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Compute canonical hash for a harness-boot spec.yaml",
    )
    parser.add_argument("spec", type=Path, help="path to spec.yaml")
    parser.add_argument(
        "--subtrees",
        action="store_true",
        help="print subtree hashes in addition to root",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="emit a JSON object (suitable for piping into jq)",
    )
    args = parser.parse_args(argv)

    if not args.spec.is_file():
        print(f"error: {args.spec} not found", file=sys.stderr)
        return 2

    spec = load_spec(args.spec)
    bundle = compute_all(spec)

    if args.json:
        if not args.subtrees:
            # subtrees 안 보여달라 요청이면 비워서 출력 (merkle 는 유지)
            bundle_out = {k: v for k, v in bundle.items() if k != "subtrees"}
        else:
            bundle_out = bundle
        json.dump(bundle_out, sys.stdout, indent=2, ensure_ascii=False)
        print()  # trailing newline
    else:
        print(f"spec_hash   {bundle['spec_hash']}")
        print(f"merkle_root {bundle['merkle_root']}")
        if args.subtrees:
            print("subtrees:")
            for k, v in bundle["subtrees"].items():
                print(f"  {k:12} {v}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
