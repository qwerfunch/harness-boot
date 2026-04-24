#!/usr/bin/env python3
"""conversion_diff.py — spec-conversion 결과의 의미 단위 diff.

YAML 주석·key 순서·들여쓰기 차이는 무시하고 다음 **구조 집합**을 비교:
- features[].id, entities[].name, business_rules[].id, stakeholders[].role
- deliverable.type, constraints.prototype_mode
- unrepresentable.md 의 gap ID (G-* / NEW-*)

사용:
    python3 scripts/conversion_diff.py \\
        --golden tests/regression/conversion-goldens/url-shortener \\
        --candidate design/samples/url-shortener

    python3 scripts/conversion_diff.py --all

종료 코드:
    0 — PASS (R-1 HARD 위반 없음, R-2 HARD 위반 없음)
    1 — FAIL (HARD 위반)
    2 — WARN (SOFT 위반만)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("ERROR: PyYAML required. pip install PyYAML", file=sys.stderr)
    sys.exit(3)


REPO_ROOT = Path(__file__).resolve().parents[2]  # v0.8.4: scripts/spec/ → repo root needs [2]
GOLDENS = REPO_ROOT / "tests" / "regression" / "conversion-goldens"
SAMPLES = REPO_ROOT / "design" / "samples"

GAP_ID_RE = re.compile(r"\b(G-\d{2}|NEW-\d{2})\b")


# ─── Extraction ──────────────────────────────────────────────────────────────


@dataclass
class SpecSignature:
    """의미적 동치성 비교용 spec.yaml 요약."""

    features: set[str] = field(default_factory=set)
    entities: set[str] = field(default_factory=set)
    business_rules: set[str] = field(default_factory=set)
    stakeholders: set[str] = field(default_factory=set)
    deliverable_type: str | None = None
    prototype_mode: bool | None = None
    skeleton_feature: str | None = None   # type=skeleton 인 feature id

    @classmethod
    def from_yaml(cls, path: Path) -> "SpecSignature":
        doc = yaml.safe_load(path.read_text())
        sig = cls()
        for f in (doc.get("features") or []):
            fid = f.get("id")
            if fid:
                sig.features.add(fid)
            if f.get("type") == "skeleton":
                sig.skeleton_feature = fid
        domain = doc.get("domain") or {}
        for e in (domain.get("entities") or []):
            if e.get("name"):
                sig.entities.add(e["name"])
        for br in (domain.get("business_rules") or []):
            if br.get("id"):
                sig.business_rules.add(br["id"])
        for sh in ((doc.get("project") or {}).get("stakeholders") or []):
            if sh.get("role"):
                sig.stakeholders.add(sh["role"])
        sig.deliverable_type = (doc.get("deliverable") or {}).get("type")
        sig.prototype_mode = (doc.get("constraints") or {}).get("prototype_mode")
        return sig


@dataclass
class GapSignature:
    gap_ids: set[str] = field(default_factory=set)

    @classmethod
    def from_md(cls, path: Path) -> "GapSignature":
        if not path.exists():
            return cls()
        text = path.read_text()
        return cls(gap_ids=set(GAP_ID_RE.findall(text)))


# ─── Diff ────────────────────────────────────────────────────────────────────


@dataclass
class DiffReport:
    sample: str
    hard_violations: list[str] = field(default_factory=list)
    soft_violations: list[str] = field(default_factory=list)
    info: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.hard_violations

    @property
    def clean(self) -> bool:
        return self.ok and not self.soft_violations


def _set_diff(
    label: str, golden: set[str], candidate: set[str], report: DiffReport, hard: bool
) -> None:
    missing = golden - candidate
    extra = candidate - golden
    if missing:
        msg = f"{label}: MISSING {sorted(missing)} (골든에 있었으나 후보에 없음)"
        (report.hard_violations if hard else report.soft_violations).append(msg)
    if extra:
        # 확장은 SOFT 로 본다 — 스키마가 더 담게 되는 방향은 긍정
        report.soft_violations.append(
            f"{label}: EXTRA   {sorted(extra)} (후보에서 새로 추가됨)"
        )


def diff_sample(golden_dir: Path, candidate_dir: Path, sample: str) -> DiffReport:
    r = DiffReport(sample=sample)

    g_spec_path = golden_dir / "spec.yaml"
    c_spec_path = candidate_dir / "spec.yaml"
    if not g_spec_path.exists():
        r.hard_violations.append(f"golden spec.yaml 없음: {g_spec_path}")
        return r
    if not c_spec_path.exists():
        r.hard_violations.append(f"candidate spec.yaml 없음: {c_spec_path}")
        return r

    g = SpecSignature.from_yaml(g_spec_path)
    c = SpecSignature.from_yaml(c_spec_path)

    # R-1 HARD
    _set_diff("features",       g.features,       c.features,       r, hard=True)
    _set_diff("entities",       g.entities,       c.entities,       r, hard=True)
    _set_diff("business_rules", g.business_rules, c.business_rules, r, hard=True)

    # R-2 HARD — 카디널리티 감소 금지
    if len(c.stakeholders) < len(g.stakeholders):
        r.hard_violations.append(
            f"stakeholders 수 감소 {len(g.stakeholders)} → {len(c.stakeholders)}"
        )
    if len(c.entities) < len(g.entities):
        r.hard_violations.append(
            f"entities 수 감소 {len(g.entities)} → {len(c.entities)}"
        )
    if len(c.features) < len(g.features):
        r.hard_violations.append(
            f"features 수 감소 {len(g.features)} → {len(c.features)}"
        )

    # Skeleton 불변식
    if g.skeleton_feature and c.skeleton_feature != g.skeleton_feature:
        r.soft_violations.append(
            f"skeleton feature 변경 {g.skeleton_feature} → {c.skeleton_feature}"
        )
    if not c.skeleton_feature:
        r.hard_violations.append("후보에 features[0].type=skeleton 이 없음")

    # Deliverable type
    if g.deliverable_type != c.deliverable_type:
        r.soft_violations.append(
            f"deliverable.type 변경 {g.deliverable_type} → {c.deliverable_type}"
        )

    # Prototype mode
    if g.prototype_mode != c.prototype_mode:
        r.soft_violations.append(
            f"prototype_mode 변경 {g.prototype_mode} → {c.prototype_mode}"
        )

    # R-1 HARD — gap ID 집합
    g_gaps = GapSignature.from_md(golden_dir / "unrepresentable.md")
    c_gaps = GapSignature.from_md(candidate_dir / "unrepresentable.md")
    missing_gaps = g_gaps.gap_ids - c_gaps.gap_ids
    extra_gaps = c_gaps.gap_ids - g_gaps.gap_ids
    if missing_gaps:
        r.hard_violations.append(
            f"gap IDs MISSING {sorted(missing_gaps)} (회귀 — 기존 갭 탐지 실패)"
        )
    if extra_gaps:
        r.info.append(f"gap IDs EXTRA {sorted(extra_gaps)} (신규 갭 발견 — 긍정)")

    r.info.append(
        f"counts  features={len(c.features)} entities={len(c.entities)} "
        f"BR={len(c.business_rules)} stakeholders={len(c.stakeholders)} "
        f"gaps={len(c_gaps.gap_ids)}"
    )

    return r


# ─── Main ────────────────────────────────────────────────────────────────────


def _print(report: DiffReport) -> None:
    status = "PASS" if report.clean else ("WARN" if report.ok else "FAIL")
    print(f"\n[{status}] {report.sample}")
    for line in report.info:
        print(f"   info : {line}")
    for line in report.soft_violations:
        print(f"   warn : {line}")
    for line in report.hard_violations:
        print(f"   FAIL : {line}")


def main() -> int:
    ap = argparse.ArgumentParser(description="spec-conversion semantic diff")
    ap.add_argument("--golden", type=Path, help="골든 폴더 (단일 샘플)")
    ap.add_argument("--candidate", type=Path, help="후보 폴더 (단일 샘플)")
    ap.add_argument("--all", action="store_true",
                    help="tests/regression/conversion-goldens/ vs design/samples/ 전체 비교")
    ap.add_argument("--json", action="store_true", help="JSON 출력")
    args = ap.parse_args()

    reports: list[DiffReport] = []

    if args.all:
        for g in sorted(p for p in GOLDENS.iterdir() if p.is_dir()):
            c = SAMPLES / g.name
            if c.exists():
                reports.append(diff_sample(g, c, g.name))
            else:
                r = DiffReport(sample=g.name)
                r.hard_violations.append(f"후보 폴더 없음: {c}")
                reports.append(r)
    elif args.golden and args.candidate:
        sample = args.candidate.name
        reports.append(diff_sample(args.golden, args.candidate, sample))
    else:
        ap.error("--all 또는 --golden/--candidate 필요")

    if args.json:
        print(json.dumps([{
            "sample": r.sample,
            "status": "PASS" if r.clean else ("WARN" if r.ok else "FAIL"),
            "hard": r.hard_violations,
            "soft": r.soft_violations,
            "info": r.info,
        } for r in reports], ensure_ascii=False, indent=2))
    else:
        for r in reports:
            _print(r)

    # 집계
    hard_fails = sum(1 for r in reports if not r.ok)
    soft_warns = sum(1 for r in reports if r.ok and r.soft_violations)
    cleans = sum(1 for r in reports if r.clean)

    print(f"\n총 {len(reports)} 샘플 | PASS {cleans} | WARN {soft_warns} | FAIL {hard_fails}")

    if hard_fails:
        return 1
    if soft_warns:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
