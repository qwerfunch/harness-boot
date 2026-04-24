#!/usr/bin/env python3
"""
sync.py — /harness:sync 의 Python 오케스트레이터 (F-003 Phase 0)

역할:
  1. spec.yaml 로드 + 스키마 검증 (선택, jsonschema 있을 때)
  2. $include 전개 (include_expander)
  3. canonical hash (canonical_hash)
  4. edit-wins 감지 후 domain.md · architecture.yaml 렌더링 (render_domain/architecture)
  5. harness.yaml 의 generation 해시트리 갱신
  6. events.log append

사용:
  python3 scripts/sync.py                         # cwd 기준 .harness/ 처리
  python3 scripts/sync.py --harness-dir DIR       # 명시 지정
  python3 scripts/sync.py --dry-run               # 변경 없이 plan 만 출력
  python3 scripts/sync.py --force                 # edit-wins 무시하고 덮어쓰기

출력: stdout 에 사람이 읽을 요약 + --json 시 JSON 객체.

환경 제약:
  - repo .harness/ 에 실행 금물 (CLAUDE.md §7). 별도 워크스페이스에서만.
  - 이 스크립트는 순수 Python — /harness:sync LLM 명령 (commands/sync.md) 이 이를 Bash 로 invoke.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("pyyaml is required", file=sys.stderr)
    sys.exit(1)

# 같은 scripts/ 디렉터리의 형제 모듈들 — 직접 import.
_THIS = Path(__file__).resolve().parent
if str(_THIS) not in sys.path:
    sys.path.insert(0, str(_THIS))

import canonical_hash as ch  # noqa: E402
import plugin_root as pr  # noqa: E402
import validate_spec as vs  # noqa: E402
from render import architecture as ra  # noqa: E402
from render import domain as rd  # noqa: E402
from spec import include_expander as ie  # noqa: E402


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _file_sha256(path: Path) -> str:
    """파일 내용의 SHA-256 — edit-wins 감지용 (rendered 바이트 동일 비교)."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _load_yaml_file(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data if isinstance(data, dict) else {}


def _dump_yaml_file(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as f:
        yaml.safe_dump(
            data,
            f,
            sort_keys=False,
            allow_unicode=True,
            default_flow_style=False,
        )


def edit_wins(
    output_path: Path,
    previous_output_hash: str | None,
) -> bool:
    """output_path 가 존재하고 previous_output_hash 와 다르면 사용자 수정 간주 → 덮지 않음.

    - 파일 없음 → False (신규 생성 허용)
    - 이전 해시 없음 (처음 sync) → False (신규 생성 허용)
    - 해시 일치 → False (우리가 쓴 그대로 — 덮어쓰기 OK)
    - 해시 불일치 → True (사용자가 편집 — skip)
    """
    if not output_path.is_file():
        return False
    if not previous_output_hash:
        return False
    current = _file_sha256(output_path)
    return current != previous_output_hash


def _append_event(events_log: Path, event: dict) -> None:
    """events.log 에 1 줄 JSON append (fail-safe)."""
    events_log.parent.mkdir(parents=True, exist_ok=True)
    with events_log.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")


def _script_repo_version() -> str | None:
    """Strategy 0 — __file__ 기준. 이 sync.py 가 속한 repo 의 plugin.json 조회.

    실제 사용자가 CC 플러그인으로 설치한 버전이 실행할 때도 `__file__` 은
    설치된 cache 디렉터리를 가리키므로 그 버전이 나옴. Dev 에서 repo 직접 실행 시엔
    dev 버전이 나옴. 가장 신뢰 높은 fallback 우선순위.
    """
    script_repo = Path(__file__).resolve().parent.parent
    manifest = script_repo / ".claude-plugin" / "plugin.json"
    if manifest.is_file():
        try:
            with manifest.open("r", encoding="utf-8") as f:
                return json.load(f).get("version")
        except (OSError, json.JSONDecodeError):
            pass
    return None


def _plugin_version(harness_dir: Path) -> str:
    """harness.yaml 에 기록할 plugin_version. 실패 시 'unknown'.

    해석 전략 (NEW-50 — 2026-04-23 dogfood 관찰 반영):
      0. `_script_repo_version()` — __file__ 기준 가장 신뢰 높음.
      1. cwd · harness_dir.parent 방향으로 .claude-plugin/plugin.json 탐색.
      2. `plugin_root.resolve()` 4-전략 체인 (NEW-37/44 재사용).
      3. 모두 실패 시 'unknown'.
    """
    v = _script_repo_version()
    if v:
        return v

    # 전략 1: parent search
    for parent in [harness_dir.parent, Path.cwd(), *Path.cwd().parents]:
        manifest = parent / ".claude-plugin" / "plugin.json"
        if manifest.is_file():
            try:
                with manifest.open("r", encoding="utf-8") as f:
                    return json.load(f).get("version", "unknown")
            except (OSError, json.JSONDecodeError):
                continue

    # 전략 2: plugin_root fallback
    try:
        root = pr.resolve().root
        manifest = root / ".claude-plugin" / "plugin.json"
        if manifest.is_file():
            with manifest.open("r", encoding="utf-8") as f:
                return json.load(f).get("version", "unknown")
    except (pr.PluginRootError, OSError, json.JSONDecodeError):
        pass

    return "unknown"


def run(
    harness_dir: Path,
    *,
    force: bool = False,
    dry_run: bool = False,
    timestamp: str | None = None,
    skip_validation: bool = False,
    schema_path: Path | None = None,
) -> dict:
    """Phase 0 전체 실행. 반환값 = 요약 dict (JSON 직렬화 가능).

    skip_validation=True 면 스키마 검증 건너뜀 (테스트 fixture 가 최소화된 경우).
    """
    ts = timestamp or _now_iso()

    spec_path = harness_dir / "spec.yaml"
    harness_yaml_path = harness_dir / "harness.yaml"
    domain_path = harness_dir / "domain.md"
    arch_path = harness_dir / "architecture.yaml"
    events_log = harness_dir / "events.log"
    chapters_dir = harness_dir / "chapters"

    if not spec_path.is_file():
        raise FileNotFoundError(
            f"{spec_path} 가 없음 — 먼저 /harness:init 또는 수동 생성 필요"
        )
    if not harness_yaml_path.is_file():
        # harness.yaml 초기값 생성
        harness_yaml = {
            "version": "2.3",
            "hash_protocol_version": "1",
            "generation": {
                "generated_from": {"spec_hash": "", "subtrees": {}},
                "derived_from": {
                    "domain_md": {
                        "source_hash": "",
                        "output_hash": "",
                        "user_edit_detected": False,
                    },
                    "architecture_yaml": {
                        "source_hash": "",
                        "output_hash": "",
                        "user_edit_detected": False,
                    },
                },
                "include_sources": [],
                "drift_status": "clean",
            },
            "policies": {"prose_polish": False},
        }
    else:
        harness_yaml = _load_yaml_file(harness_yaml_path)

    # 1. spec load + schema validate (Gate 0~1)
    raw_spec = _load_yaml_file(spec_path)

    if not skip_validation:
        try:
            vs.validate(raw_spec, schema_path=schema_path)
        except vs.SpecValidationError as e:
            # 이벤트 로그에는 실패 기록 남기되, 파생 렌더링은 건너뜀
            if not dry_run:
                _append_event(
                    events_log,
                    {
                        "ts": ts,
                        "type": "sync_failed",
                        "reason": "schema_validation",
                        "path": ".".join(str(p) for p in e.path) if e.path else "(root)",
                        "message": e.message,
                        "validator": e.reason,
                    },
                )
            raise

    # 2. $include expand (depth=1)
    includes_found = ie._find_includes(raw_spec)
    if includes_found:
        expanded_spec = ie.expand(raw_spec, chapters_dir)
    else:
        expanded_spec = raw_spec

    # 3. canonical hash — raw + expanded 둘 다
    hash_raw = ch.canonical_hash(raw_spec)
    hash_expanded = ch.canonical_hash(expanded_spec) if includes_found else hash_raw
    subtree_hashes = ch.subtree_hashes(expanded_spec)
    merkle = ch.merkle_root(subtree_hashes)

    # 4. edit-wins + render
    gen = harness_yaml.setdefault("generation", {})
    derived = gen.setdefault("derived_from", {})
    d_entry = derived.setdefault(
        "domain_md", {"source_hash": "", "output_hash": "", "user_edit_detected": False}
    )
    a_entry = derived.setdefault(
        "architecture_yaml",
        {"source_hash": "", "output_hash": "", "user_edit_detected": False},
    )

    domain_skipped = False
    arch_skipped = False

    # domain.md
    if edit_wins(domain_path, d_entry.get("output_hash")) and not force:
        domain_skipped = True
        d_entry["user_edit_detected"] = True
    else:
        rendered = rd.render(expanded_spec, timestamp=ts)
        if not dry_run:
            domain_path.parent.mkdir(parents=True, exist_ok=True)
            domain_path.write_text(rendered, encoding="utf-8")
        d_entry["source_hash"] = hash_expanded
        d_entry["output_hash"] = hashlib.sha256(rendered.encode("utf-8")).hexdigest()
        d_entry["user_edit_detected"] = False

    # architecture.yaml
    if edit_wins(arch_path, a_entry.get("output_hash")) and not force:
        arch_skipped = True
        a_entry["user_edit_detected"] = True
    else:
        rendered = ra.render(expanded_spec, timestamp=ts, source_ref=str(spec_path.name))
        if not dry_run:
            arch_path.write_text(rendered, encoding="utf-8")
        a_entry["source_hash"] = hash_expanded
        a_entry["output_hash"] = hashlib.sha256(rendered.encode("utf-8")).hexdigest()
        a_entry["user_edit_detected"] = False

    # 5. harness.yaml 갱신
    gen["generated_from"] = {
        "spec_hash": hash_raw,
        "spec_hash_expanded": hash_expanded if includes_found else None,
        "merkle_root": merkle,
        "subtrees": subtree_hashes,
    }
    gen["include_sources"] = [item["target"] for item in includes_found]
    drift = []
    if domain_skipped:
        drift.append("domain.md")
    if arch_skipped:
        drift.append("architecture.yaml")
    gen["drift_status"] = "derived_edited" if drift else "clean"

    if not dry_run:
        _dump_yaml_file(harness_yaml_path, harness_yaml)

    # 6. events.log
    event = {
        "ts": ts,
        "type": "sync_completed",
        "plugin_version": _plugin_version(harness_dir),
        "phase": "0",
        "spec_hash": hash_raw,
        "merkle_root": merkle,
        "derived": [p.name for p, skipped in [(domain_path, domain_skipped), (arch_path, arch_skipped)] if not skipped],
        "skipped": drift,
        "dry_run": dry_run,
    }
    if not dry_run:
        _append_event(events_log, event)

    return {
        "ok": True,
        "spec_hash": hash_raw,
        "merkle_root": merkle,
        "include_count": len(includes_found),
        "domain_skipped": domain_skipped,
        "arch_skipped": arch_skipped,
        "dry_run": dry_run,
        "drift_status": gen["drift_status"],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="harness-boot /sync orchestrator")
    parser.add_argument(
        "--harness-dir",
        type=Path,
        default=Path.cwd() / ".harness",
        help="target .harness/ directory (default: ./.harness)",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true", help="ignore edit-wins, overwrite")
    parser.add_argument("--json", action="store_true", help="emit JSON summary")
    parser.add_argument("--timestamp", default=None, help="override UTC timestamp (tests)")
    parser.add_argument("--skip-validation", action="store_true", help="skip JSONSchema check")
    parser.add_argument("--schema", type=Path, default=None, help="path to spec.schema.json")
    args = parser.parse_args(argv)

    if not args.harness_dir.is_dir():
        print(f"error: {args.harness_dir} not found", file=sys.stderr)
        return 2

    try:
        summary = run(
            args.harness_dir,
            force=args.force,
            dry_run=args.dry_run,
            timestamp=args.timestamp,
            skip_validation=args.skip_validation,
            schema_path=args.schema,
        )
    except FileNotFoundError as e:
        print(f"sync error: {e}", file=sys.stderr)
        return 3
    except ie.IncludeError as e:
        print(f"include error: {e}", file=sys.stderr)
        return 4
    except vs.SpecValidationError as e:
        print(f"schema error at {'.'.join(str(p) for p in e.path) or '(root)'}: {e.message}", file=sys.stderr)
        if e.reason:
            print(f"  validator: {e.reason}", file=sys.stderr)
        return 5

    if args.json:
        json.dump(summary, sys.stdout, indent=2, ensure_ascii=False)
        print()
    else:
        print(f"spec_hash     {summary['spec_hash']}")
        print(f"merkle_root   {summary['merkle_root']}")
        print(f"include_count {summary['include_count']}")
        print(f"drift_status  {summary['drift_status']}")
        if summary["domain_skipped"]:
            print("SKIP domain.md (edit-wins — 사용자 수정 감지)")
        if summary["arch_skipped"]:
            print("SKIP architecture.yaml (edit-wins)")
        if summary["dry_run"]:
            print("(dry-run — 파일 변경 없음)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
