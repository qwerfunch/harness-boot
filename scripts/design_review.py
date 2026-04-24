#!/usr/bin/env python3
"""design_review.py — v0.6 design review ceremony template generator.

When ux-architect saves `.harness/_workspace/design/flows.md`, orchestrator
fires this to generate `.harness/_workspace/design-review/F-N.md` — a
template with per-reviewer subheadings (visual-designer + frontend-engineer
+ a11y-auditor, plus audio-designer when has_audio=true).

Python templates only; orchestrator fans out prose prompts to each reviewer
("F-N flows.md 에 대한 당신 관점 concern 한 문단").

Usage (CLI):
    python3 scripts/design_review.py --harness-dir .harness \\
        --feature F-1 [--has-audio]
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


# Fixed participant list per plan §Design Review. Max 4 reviewers to avoid thrash.
_CORE_REVIEWERS = ["visual-designer", "frontend-engineer", "a11y-auditor"]
_AUDIO_REVIEWER = "audio-designer"


def reviewers_for(*, has_audio: bool) -> list[str]:
    out = list(_CORE_REVIEWERS)
    if has_audio:
        # Insert audio-designer right before a11y-auditor (parallels kickoff ordering).
        try:
            idx = out.index("a11y-auditor")
        except ValueError:
            out.append(_AUDIO_REVIEWER)
        else:
            out.insert(idx, _AUDIO_REVIEWER)
    return out


def _template(feature_id: str, reviewers: list[str], timestamp: str) -> str:
    lines: list[str] = []
    lines.append(f"# Design Review — {feature_id}")
    lines.append("")
    lines.append(f"> 자동 생성 — {timestamp}")
    lines.append(">")
    lines.append(
        "> `scripts/design_review.py` 가 이 템플릿을 만들고, orchestrator 가 reviewer "
        "별로 `flows.md` 에 대한 concern 을 한 문단씩 수집 → 마지막 Decisions 섹션은 "
        "orchestrator 가 disposition 후 작성."
    )
    lines.append("")
    lines.append(f"## Reviewers ({len(reviewers)})")
    lines.append("")
    for r in reviewers:
        lines.append(f"- `@harness:{r}`")
    lines.append("")
    lines.append("---")
    lines.append("")
    for r in reviewers:
        lines.append(f"## {r} concerns")
        lines.append("")
        lines.append("<!-- orchestrator: 이 reviewer 의 Tier anchor 기반 한 문단 concern -->")
        lines.append("")
        lines.append("_(pending)_")
        lines.append("")
    lines.append("## Decisions")
    lines.append("")
    lines.append("<!-- orchestrator: reviewer concern 을 종합해 수용/연기/기각 판단. 2회 반복 충돌 시 사용자 escalate. -->")
    lines.append("")
    lines.append("_(pending)_")
    lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _append_event(harness_dir: Path, event: dict) -> None:
    log_path = harness_dir / "events.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")


def generate_design_review(
    harness_dir: Path,
    *,
    feature_id: str,
    has_audio: bool = False,
    timestamp: str | None = None,
) -> Path:
    if timestamp is None:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    reviewers = reviewers_for(has_audio=has_audio)
    review_dir = harness_dir / "_workspace" / "design-review"
    review_dir.mkdir(parents=True, exist_ok=True)
    path = review_dir / f"{feature_id}.md"
    path.write_text(_template(feature_id, reviewers, timestamp), encoding="utf-8")
    _append_event(
        harness_dir,
        {
            "ts": timestamp,
            "type": "design_review_opened",
            "feature_id": feature_id,
            "reviewers": reviewers,
            "has_audio": has_audio,
            "path": str(path.relative_to(harness_dir)),
        },
    )
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate design-review template + event")
    parser.add_argument("--harness-dir", type=Path, default=Path(".harness"))
    parser.add_argument("--feature", required=True)
    parser.add_argument("--has-audio", action="store_true")
    parser.add_argument("--timestamp", default=None)
    args = parser.parse_args(argv)
    path = generate_design_review(
        args.harness_dir,
        feature_id=args.feature,
        has_audio=args.has_audio,
        timestamp=args.timestamp,
    )
    print(str(path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
