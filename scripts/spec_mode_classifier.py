#!/usr/bin/env python3
"""
spec_mode_classifier.py — /harness:spec 의 Mode A/B/R/E 자동 분기 (F-002)

사용 (library):
  from spec_mode_classifier import classify, Mode

  result = classify(
      args=["--explain"],
      spec_exists=True,
  )
  assert result.mode == Mode.EXPLAIN

CLI:
  python3 scripts/spec_mode_classifier.py --args "plan.md" --spec-exists false
  → {"mode": "B", "rationale": "...", "subtype": "baseline-from-plan"}

결정론:
  동일 입력 → 동일 모드. F-002 acceptance_criteria 핵심 제약.

분류 우선순위 (commands/spec.md 와 1:1):
  1. `--explain` 또는 explain 의도 → E
  2. `--mode X` 명시 → X (overrides 모두)
  3. spec 부재 + plan.md 인자 → B-2 (plan 변환)
  4. spec 부재 + 인자 없음 → B-1 (empty baseline)
  5. spec 존재 + add/추가 의도 → A
  6. spec 존재 + 기타 → R (refine, 기본)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Sequence


class Mode(str, Enum):
    ADDITION = "A"
    BASELINE = "B"
    REFINE = "R"
    EXPLAIN = "E"


@dataclass
class Result:
    mode: Mode
    rationale: str
    subtype: str = ""          # B-1 / B-2 같은 세부 구분
    args: tuple = ()


# 간단한 의도 키워드 — 초벌 분류용. 한국어는 word boundary 개념이 다르므로 \b 미사용.
_ADDITION_HINTS = re.compile(
    r"(추가|신규 피처|새 엔티티|\badd\b|\bappend\b|\binsert\b|\badd feature\b|\bnew entity\b)",
    re.IGNORECASE,
)
_EXPLAIN_HINTS = re.compile(
    r"(설명|요약|\bexplain\b|\bshow\b|\bdescribe\b|\bsummary\b)",
    re.IGNORECASE,
)


def classify(
    args: Sequence[str] | None = None,
    *,
    spec_exists: bool = False,
    intent_text: str = "",
) -> Result:
    """인자 + 파일 상태 → Mode 결정.

    args: CLI 인자 리스트. `--explain` · `--mode A/B/R/E` · plan.md 파일명 등.
    spec_exists: .harness/spec.yaml 존재 여부.
    intent_text: 사용자가 자연어로 함께 준 의도 문자열 (힌트).
    """
    args = list(args or [])
    norm = " ".join(args) + " " + (intent_text or "")

    # 1. `--mode X` 명시가 최우선 (explicit overrides heuristics)
    for i, a in enumerate(args):
        if a == "--mode" and i + 1 < len(args):
            val = args[i + 1].upper()
            try:
                return Result(
                    mode=Mode(val),
                    rationale=f"explicit --mode {val}",
                    args=tuple(args),
                )
            except ValueError:
                raise ValueError(f"unknown --mode value: {args[i + 1]} (expected A/B/R/E)")

    # 2. --explain 플래그 또는 explain 의도
    if "--explain" in args or _EXPLAIN_HINTS.search(norm):
        return Result(mode=Mode.EXPLAIN, rationale="explain flag or intent", args=tuple(args))

    # plan.md 같은 파일 인자 감지 — `.md` 또는 `.markdown` 로 끝나면 Mode B-2
    plan_candidate: str | None = None
    for a in args:
        if a.startswith("--"):
            continue
        if a.lower().endswith((".md", ".markdown")):
            plan_candidate = a
            break

    # 3/4. spec 부재
    if not spec_exists:
        if plan_candidate:
            return Result(
                mode=Mode.BASELINE,
                rationale=f"spec missing; plan.md 인자 감지 ({plan_candidate})",
                subtype="baseline-from-plan",
                args=tuple(args),
            )
        return Result(
            mode=Mode.BASELINE,
            rationale="spec missing; 대화형 empty baseline",
            subtype="baseline-empty",
            args=tuple(args),
        )

    # 5. spec 존재 + addition 의도
    if _ADDITION_HINTS.search(norm):
        return Result(
            mode=Mode.ADDITION,
            rationale="spec 존재 · addition 의도 감지",
            args=tuple(args),
        )

    # 6. 기본 — refine
    return Result(
        mode=Mode.REFINE,
        rationale="spec 존재 · 기본 분기 (refine)",
        args=tuple(args),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Classify /harness:spec input into Mode A/B/R/E")
    parser.add_argument("--args", default="", help="space-separated CLI args to /harness:spec")
    parser.add_argument(
        "--spec-exists",
        default="false",
        choices=["true", "false"],
        help="whether .harness/spec.yaml exists",
    )
    parser.add_argument("--intent", default="", help="free-form intent text (optional)")
    cli_args = parser.parse_args(argv)

    try:
        result = classify(
            args=cli_args.args.split() if cli_args.args else [],
            spec_exists=(cli_args.spec_exists == "true"),
            intent_text=cli_args.intent,
        )
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    json.dump(
        {
            "mode": result.mode.value,
            "rationale": result.rationale,
            "subtype": result.subtype,
        },
        sys.stdout,
        indent=2,
        ensure_ascii=False,
    )
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
