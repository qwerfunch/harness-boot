#!/usr/bin/env python3
"""
check.py — /harness:check (F-006) drift 탐지. Read-only, CQS.

사용:
  python3 scripts/check.py                     # cwd .harness
  python3 scripts/check.py --harness-dir DIR
  python3 scripts/check.py --json              # 기계 파싱

CQS: 파일 수정 없음. Spec 드리프트 발견 시 자동 수정 제안도 없음 (BR 참조).

v0.7.3 범위 — 10/10 드리프트:
  1. Generated — harness.yaml 자체가 올바른 구조/버전을 유지하는지
  2. Derived   — domain.md/architecture.yaml 의 output_hash 와 현재 파일 해시 비교
  3. Spec      — spec.yaml 의 canonical hash 와 harness.yaml.generation.spec_hash 비교
  4. Include   — harness.yaml.include_sources 의 파일 존재 + 내용 해시 비교
  5. Evidence  — state.yaml 의 done 피처에 evidence 가 기록돼 있는지 (BR-004)
  6. Code      — features[].modules 에 dict 형태로 `source` 필드가 있으면 그 경로가 존재하는지
  7. Doc       — project_root/CLAUDE.md 의 `@` import 타겟이 실제 존재하는지 + derived 파일 비어있지 않은지
  8. Anchor    — features[].id 포맷/유일성 + depends_on 참조가 존재하는 피처 ID 인지
  9. Protocol  — .harness/protocols/*.md 각 파일이 frontmatter.protocol_id == 파일명 stem (F-017 AC-2)
  10. Adr      — decisions[].supersedes 가 가리키는 ADR 의 status 가 'superseded' 인지 (v0.7.3)

종료 코드:
  0 = clean (no drift)
  6 = drift detected
  2 = IO / setup error
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
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

from core import canonical_hash as ch  # noqa: E402
from core.state import State  # noqa: E402
from spec import include_expander as ie  # noqa: E402


DriftKind = str  # "Generated" | "Derived" | "Spec" | "Include" | "Evidence" | "Code" | "Doc" | "Anchor" | "Protocol"

_FEATURE_ID_PATTERN = re.compile(r"^F-\d+$")
_CLAUDE_IMPORT_PATTERN = re.compile(r"^@([^\s]+)", re.MULTILINE)


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


def check_code(harness_dir: Path, spec: dict, project_root: Path | None = None) -> list[DriftFinding]:
    """features[].modules 내 dict 항목의 `source` 필드가 가리키는 파일이 실제 존재하는지.

    **경계**: 모듈이 단순 문자열 ("init_command") 이면 논리 식별자로 보고 skip.
    dict + source 로 명시적 파일 경로를 선언한 경우만 검증 → false positive 최소화.
    경로는 project_root (harness_dir 의 부모) 기준 상대.
    """
    findings: list[DriftFinding] = []
    if project_root is None:
        project_root = harness_dir.parent

    features = spec.get("features") or []
    for f in features:
        if not isinstance(f, dict):
            continue
        fid = f.get("id", "?")
        modules = f.get("modules") or []
        for m in modules:
            if not isinstance(m, dict):
                continue
            src = m.get("source")
            if not isinstance(src, str) or not src.strip():
                continue
            target = (project_root / src).resolve()
            if not target.is_file():
                name = m.get("name", "?")
                findings.append(
                    DriftFinding(
                        "Code",
                        f"{fid}::{name}",
                        f"모듈 '{name}' 의 source 경로 부재: {src}",
                        "error",
                    )
                )
    return findings


def check_doc(harness_dir: Path, project_root: Path | None = None) -> list[DriftFinding]:
    """Doc drift — CLAUDE.md @import 타겟 유효성 + derived 파일 비어있음 감지.

    1. project_root/CLAUDE.md 의 `@<path>` 라인이 존재하는 파일을 가리키는지.
       (없는 타겟은 Claude Code 가 silently ignore 하지만 drift 로 인식.)
    2. harness_dir/domain.md · architecture.yaml 이 존재한다면 0 byte 여서는 안 됨.
    """
    findings: list[DriftFinding] = []
    if project_root is None:
        project_root = harness_dir.parent

    claude_md = project_root / "CLAUDE.md"
    if claude_md.is_file():
        try:
            text = claude_md.read_text(encoding="utf-8")
        except OSError:
            text = ""
        for match in _CLAUDE_IMPORT_PATTERN.finditer(text):
            rel = match.group(1).strip().rstrip(".,;:)")
            if not rel or rel.startswith(("http://", "https://")):
                continue
            target = (project_root / rel).resolve()
            if not target.exists():
                findings.append(
                    DriftFinding(
                        "Doc",
                        f"CLAUDE.md::@{rel}",
                        f"CLAUDE.md @import 타겟 부재: {rel}",
                    )
                )

    for fname in ("domain.md", "architecture.yaml"):
        path = harness_dir / fname
        if path.is_file():
            try:
                size = path.stat().st_size
            except OSError:
                size = 0
            if size == 0:
                findings.append(
                    DriftFinding("Doc", fname, f"{fname} 파일이 비어있음 — sync 재생성 필요", "error")
                )
    return findings


def check_anchor(spec: dict) -> list[DriftFinding]:
    """Anchor drift — feature ID 포맷 · 유일성 · depends_on 참조 유효성.

    - 각 feature 의 `id` 는 F-NNN (숫자 3 자리 이상) 형식.
    - id 중복 금지.
    - depends_on 에 나열된 ID 는 모두 실제 feature 목록에 존재해야 함.
    """
    findings: list[DriftFinding] = []
    features = spec.get("features") or []
    seen: set[str] = set()
    all_ids: set[str] = set()

    for i, f in enumerate(features):
        if not isinstance(f, dict):
            findings.append(DriftFinding("Anchor", f"features[{i}]", "feature 항목이 매핑이 아님", "error"))
            continue
        fid = f.get("id")
        if not isinstance(fid, str) or not fid:
            findings.append(DriftFinding("Anchor", f"features[{i}]", "feature id 누락", "error"))
            continue
        if not _FEATURE_ID_PATTERN.match(fid):
            findings.append(
                DriftFinding("Anchor", fid, f"feature id 가 F-NNN 패턴이 아님 (got: {fid!r})", "error")
            )
        if fid in seen:
            findings.append(DriftFinding("Anchor", fid, f"중복 feature id: {fid}", "error"))
        seen.add(fid)
        all_ids.add(fid)

    for f in features:
        if not isinstance(f, dict):
            continue
        fid = f.get("id", "?")
        deps = f.get("depends_on")
        if deps is None:
            continue
        if not isinstance(deps, list):
            findings.append(DriftFinding("Anchor", fid, "depends_on 이 배열이 아님", "error"))
            continue
        for dep in deps:
            if not isinstance(dep, str):
                findings.append(DriftFinding("Anchor", fid, f"depends_on 항목이 문자열 아님: {dep!r}", "error"))
                continue
            if dep not in all_ids:
                findings.append(
                    DriftFinding(
                        "Anchor",
                        fid,
                        f"depends_on 에 존재하지 않는 피처 참조: {dep}",
                        "error",
                    )
                )
    return findings


def check_adr_supersedes(spec: dict) -> list[DriftFinding]:
    """Adr drift — decisions[].supersedes chain consistency.

    When ADR-B lists ADR-A under `supersedes`, ADR-A's status must be
    `superseded`. Otherwise domain.md renders two "accepted" decisions on
    the same topic (reader has no way to know which applies).

    Also flags supersedes entries that point at ADR ids missing from the
    catalog — those are dangling references.
    """
    findings: list[DriftFinding] = []
    decisions = spec.get("decisions") or []
    if not isinstance(decisions, list) or not decisions:
        return findings

    by_id: dict[str, dict] = {}
    for d in decisions:
        if isinstance(d, dict):
            did = d.get("id")
            if isinstance(did, str):
                by_id[did] = d

    for d in decisions:
        if not isinstance(d, dict):
            continue
        new_id = d.get("id") or "?"
        supersedes = d.get("supersedes") or []
        if not isinstance(supersedes, list):
            continue
        for target in supersedes:
            if not isinstance(target, str):
                continue
            target_d = by_id.get(target)
            if target_d is None:
                findings.append(
                    DriftFinding(
                        "Adr",
                        new_id,
                        f"supersedes 에 존재하지 않는 ADR 참조: {target} (decisions[] 에 없음)",
                        "warn",
                    )
                )
                continue
            status = target_d.get("status")
            if status != "superseded":
                findings.append(
                    DriftFinding(
                        "Adr",
                        target,
                        f"{new_id} 가 {target} 를 supersedes 하나 {target}.status={status!r} — 'superseded' 로 갱신 필요",
                        "warn",
                    )
                )
    return findings


_PROTOCOL_FRONTMATTER = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)


def check_protocol(harness_dir: Path) -> list[DriftFinding]:
    """Protocol drift — `.harness/protocols/*.md` 각 파일의 frontmatter.protocol_id 가 파일명 stem 과 일치하는지 (F-017 AC-2).

    protocols 디렉터리 부재 시 no-op (사용자 프로젝트가 protocol 을 사용하지 않는 것은 정상).
    """
    findings: list[DriftFinding] = []
    proto_dir = harness_dir / "protocols"
    if not proto_dir.is_dir():
        return findings

    for md in sorted(proto_dir.glob("*.md")):
        try:
            text = md.read_text(encoding="utf-8")
        except OSError:
            findings.append(
                DriftFinding("Protocol", str(md.relative_to(harness_dir)), "파일 읽기 실패", "error")
            )
            continue
        match = _PROTOCOL_FRONTMATTER.match(text)
        if not match:
            findings.append(
                DriftFinding(
                    "Protocol",
                    str(md.relative_to(harness_dir)),
                    "YAML frontmatter 부재 — `---` 로 시작/종료되는 블록 필요",
                    "error",
                )
            )
            continue
        try:
            fm = yaml.safe_load(match.group(1)) or {}
        except yaml.YAMLError as e:
            findings.append(
                DriftFinding(
                    "Protocol",
                    str(md.relative_to(harness_dir)),
                    f"frontmatter YAML 파싱 실패: {e}",
                    "error",
                )
            )
            continue
        if not isinstance(fm, dict):
            findings.append(
                DriftFinding(
                    "Protocol",
                    str(md.relative_to(harness_dir)),
                    "frontmatter 가 mapping 이 아님",
                    "error",
                )
            )
            continue
        pid = fm.get("protocol_id")
        if not isinstance(pid, str) or not pid:
            findings.append(
                DriftFinding(
                    "Protocol",
                    str(md.relative_to(harness_dir)),
                    "frontmatter.protocol_id 누락 또는 빈 값",
                    "error",
                )
            )
            continue
        expected = md.stem
        if pid != expected:
            findings.append(
                DriftFinding(
                    "Protocol",
                    str(md.relative_to(harness_dir)),
                    f"protocol_id ({pid!r}) 가 파일명 stem ({expected!r}) 과 불일치 — F-017 AC-2 위반",
                    "error",
                )
            )
    return findings


def run_check(harness_dir: Path, project_root: Path | None = None) -> CheckReport:
    report = CheckReport()
    harness_yaml = _load_yaml(harness_dir / "harness.yaml")
    spec_yaml = _load_yaml(harness_dir / "spec.yaml")

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

    if spec_yaml is not None:
        report.findings.extend(check_code(harness_dir, spec_yaml, project_root))
        report.checked.append("Code")
        report.findings.extend(check_anchor(spec_yaml))
        report.checked.append("Anchor")
        report.findings.extend(check_adr_supersedes(spec_yaml))
        report.checked.append("Adr")

    report.findings.extend(check_doc(harness_dir, project_root))
    report.checked.append("Doc")

    report.findings.extend(check_protocol(harness_dir))
    report.checked.append("Protocol")
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
    parser.add_argument("--project-root", type=Path, default=None, help="default: harness-dir 의 부모")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    if not args.harness_dir.is_dir():
        print(f"error: {args.harness_dir} not found", file=sys.stderr)
        return 2

    report = run_check(args.harness_dir, project_root=args.project_root)

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
