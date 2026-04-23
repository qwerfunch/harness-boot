#!/usr/bin/env python3
"""
check.py — /harness:check (F-006) drift 탐지. Read-only, CQS.

사용:
  python3 scripts/check.py                     # cwd .harness
  python3 scripts/check.py --harness-dir DIR
  python3 scripts/check.py --json              # 기계 파싱

CQS: 파일 수정 없음. Spec 드리프트 발견 시 자동 수정 제안도 없음 (BR 참조).

v0.3 범위 — 8종 드리프트 중 다음 5 종:
  1. Derived   — domain.md/architecture.yaml 의 output_hash 와 현재 파일 해시 비교
  2. Spec      — spec.yaml 의 canonical hash 와 harness.yaml.generation.spec_hash 비교
  3. Include   — harness.yaml.include_sources 의 파일 존재 + 내용 해시 비교
  4. Generated — harness.yaml 자체가 올바른 구조/버전을 유지하는지
  5. Evidence  — state.yaml 의 done 피처에 evidence 가 기록돼 있는지 (BR-004)

v0.4+: Code / Doc / Anchor drift — 스펙·코드·앵커 교차 검증 필요 (더 큰 작업).

종료 코드:
  0 = clean (no drift)
  6 = drift detected
  2 = IO / setup error
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("pyyaml is required", file=sys.stderr)
    sys.exit(1)

_THIS = Path(__file__).resolve().parent
if str(_THIS) not in sys.path:
    sys.path.insert(0, str(_THIS))

import canonical_hash as ch  # noqa: E402
import include_expander as ie  # noqa: E402
from state import State  # noqa: E402


DriftKind = str  # "Derived" | "Spec" | "Include" | "Generated" | "Evidence"


@dataclass
class DriftFinding:
    kind: DriftKind
    path: str              # 대상 파일/필드
    message: str
    severity: str = "warn"  # "warn" | "error"

    def as_dict(self) -> dict:
        return {"kind": self.kind, "path": self.path, "message": self.message, "severity": self.severity}


@dataclass
class CheckReport:
    findings: list[DriftFinding] = field(default_factory=list)
    checked: list[str] = field(default_factory=list)  # 수행한 체크 카테고리

    @property
    def clean(self) -> bool:
        return all(f.severity != "error" for f in self.findings) and not self.findings


def _file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _load_yaml(path: Path) -> dict | None:
    if not path.is_file():
        return None
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data if isinstance(data, dict) else None


def check_derived(harness_dir: Path, harness_yaml: dict) -> list[DriftFinding]:
    """harness.yaml.generation.derived_from.<file>.output_hash 와 실제 파일 해시 비교."""
    findings: list[DriftFinding] = []
    derived = (harness_yaml.get("generation") or {}).get("derived_from") or {}

    mapping = {"domain_md": "domain.md", "architecture_yaml": "architecture.yaml"}
    for key, filename in mapping.items():
        entry = derived.get(key) or {}
        expected = entry.get("output_hash")
        path = harness_dir / filename
        if not path.is_file():
            if expected:
                findings.append(
                    DriftFinding("Derived", filename, f"{filename} 기록된 해시 있으나 파일 없음", "error")
                )
            continue
        if not expected:
            # 파일 있는데 해시 없음 — 첫 sync 전 상태일 수 있음
            findings.append(
                DriftFinding("Derived", filename, f"{filename} 존재하지만 output_hash 미기록 (sync 필요)", "warn")
            )
            continue
        actual = _file_sha256(path)
        if actual != expected:
            findings.append(
                DriftFinding(
                    "Derived",
                    filename,
                    f"{filename} 해시 불일치 (edit-wins 감지) — sync --force 로 재생성 or 수동 수정 reconcile 필요",
                )
            )
    return findings


def check_spec(harness_dir: Path, harness_yaml: dict) -> list[DriftFinding]:
    """spec.yaml 의 canonical hash 와 harness.yaml.generation.spec_hash 비교."""
    findings: list[DriftFinding] = []
    spec_path = harness_dir / "spec.yaml"
    if not spec_path.is_file():
        findings.append(DriftFinding("Spec", "spec.yaml", "spec.yaml 부재", "error"))
        return findings

    expected = (harness_yaml.get("generation") or {}).get("generated_from", {}).get("spec_hash")
    if not expected:
        findings.append(
            DriftFinding("Spec", "spec.yaml", "harness.yaml 에 spec_hash 미기록 (sync 필요)", "warn")
        )
        return findings

    with spec_path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    actual = ch.canonical_hash(data or {})
    if actual != expected:
        findings.append(
            DriftFinding(
                "Spec",
                "spec.yaml",
                f"spec 변경 감지 — sync 필요 (expected={expected[:12]}, actual={actual[:12]})",
            )
        )
    return findings


def check_includes(harness_dir: Path, harness_yaml: dict) -> list[DriftFinding]:
    """harness.yaml.include_sources 목록의 파일 존재 확인 + spec.yaml 의 현재 $include 목록과 비교."""
    findings: list[DriftFinding] = []
    recorded = (harness_yaml.get("generation") or {}).get("include_sources") or []

    spec_path = harness_dir / "spec.yaml"
    if spec_path.is_file():
        with spec_path.open("r", encoding="utf-8") as f:
            spec = yaml.safe_load(f) or {}
        current = [item["target"] for item in ie._find_includes(spec)]
    else:
        current = []

    rec_set = set(recorded)
    cur_set = set(current)
    removed = rec_set - cur_set
    added = cur_set - rec_set
    for item in sorted(added):
        findings.append(DriftFinding("Include", item, f"spec 에 신규 $include 감지 (sync 필요): {item}"))
    for item in sorted(removed):
        findings.append(DriftFinding("Include", item, f"harness.yaml 에 기록된 include 가 spec 에서 사라짐: {item}"))

    chapters = harness_dir / "chapters"
    for target in current:
        if chapters.is_dir() and not (chapters / target).is_file():
            findings.append(
                DriftFinding("Include", target, f"$include 타겟 파일 없음: chapters/{target}", "error")
            )
    return findings


def check_generated(harness_dir: Path, harness_yaml: dict | None) -> list[DriftFinding]:
    """harness.yaml 자체의 구조 검증."""
    findings: list[DriftFinding] = []
    if harness_yaml is None:
        findings.append(DriftFinding("Generated", "harness.yaml", "harness.yaml 부재/로드 실패", "error"))
        return findings
    for key in ("version", "generation"):
        if key not in harness_yaml:
            findings.append(
                DriftFinding("Generated", f"harness.yaml::{key}", f"필수 키 누락: {key}", "error")
            )
    return findings


def check_evidence(harness_dir: Path) -> list[DriftFinding]:
    """state.yaml 의 done 피처는 evidence 최소 1건 기록돼야 한다 (BR 참조)."""
    findings: list[DriftFinding] = []
    st_path = harness_dir / "state.yaml"
    if not st_path.is_file():
        return findings  # state.yaml 없으면 skip (첫 init 직후 정상)

    st = State.load(harness_dir)
    for f in st.data["features"]:
        if not isinstance(f, dict):
            continue
        if f.get("status") == "done" and not f.get("evidence"):
            findings.append(
                DriftFinding(
                    "Evidence",
                    f.get("id", "?"),
                    f"피처 {f.get('id')} 가 done 이지만 evidence 미기록 (BR-004 가이드)",
                )
            )
    return findings


def run_check(harness_dir: Path) -> CheckReport:
    report = CheckReport()
    harness_yaml = _load_yaml(harness_dir / "harness.yaml")

    report.findings.extend(check_generated(harness_dir, harness_yaml))
    report.checked.append("Generated")

    if harness_yaml is not None:
        report.findings.extend(check_derived(harness_dir, harness_yaml))
        report.checked.append("Derived")
        report.findings.extend(check_spec(harness_dir, harness_yaml))
        report.checked.append("Spec")
        report.findings.extend(check_includes(harness_dir, harness_yaml))
        report.checked.append("Include")

    report.findings.extend(check_evidence(harness_dir))
    report.checked.append("Evidence")
    return report


def format_human(report: CheckReport) -> str:
    lines = ["🔍 /harness:check", ""]
    lines.append(f"Checked: {', '.join(report.checked)}")
    lines.append("")
    if not report.findings:
        lines.append("✅ clean — drift 없음")
        return "\n".join(lines) + "\n"
    lines.append(f"Findings ({len(report.findings)}):")
    for f in report.findings:
        marker = "❌" if f.severity == "error" else "⚠️ "
        lines.append(f"  {marker} [{f.kind}] {f.path}: {f.message}")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="/harness:check (F-006) — drift detection (read-only)")
    parser.add_argument("--harness-dir", type=Path, default=Path.cwd() / ".harness")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    if not args.harness_dir.is_dir():
        print(f"error: {args.harness_dir} not found", file=sys.stderr)
        return 2

    report = run_check(args.harness_dir)

    if args.json:
        json.dump(
            {
                "clean": report.clean,
                "checked": report.checked,
                "findings": [f.as_dict() for f in report.findings],
            },
            sys.stdout,
            indent=2,
            ensure_ascii=False,
        )
        print()
    else:
        sys.stdout.write(format_human(report))

    return 0 if report.clean else 6


if __name__ == "__main__":
    sys.exit(main())
