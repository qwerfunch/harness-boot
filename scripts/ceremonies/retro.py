#!/usr/bin/env python3
"""Retrospective ceremony template generator (v0.6 + v0.7 auto-wire).

Fires after ``/harness:work F-N --complete`` succeeds and writes
``.harness/_workspace/retro/F-N.md``.

Responsibility split:

- **Machine-extractable sections** (What Shipped, First Gate to Fail,
  Ceremonies summary) are filled here by scanning ``events.log``.
- **Prose sections** (Risks Materialized, Decisions Revised, Kickoff
  Predictions Right/Wrong, Reviewer Reflection, Copy Polish) are left
  as ``_(pending)_`` placeholders. Orchestrator then invokes
  ``@harness:reviewer`` → ``@harness:tech-writer`` in sequence to fill
  them. reviewer returns prose (CQS — BR-012), orchestrator writes it
  into the Reviewer Reflection section, tech-writer edits the Copy
  Polish section directly.

Event schema contract (must match ``scripts.work`` canonical emitter):

- feature id key is ``feature`` (not ``feature_id``)
- completion type is ``feature_done`` (not ``feature_completed``)

A ``feature_retro_written`` event is appended on success.

Usage:
    python3 scripts/retro.py --harness-dir .harness --feature F-N

See ``commands/work.md`` §Retrospective Ceremony for the full
orchestrator protocol.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def _read_events(harness_dir: Path) -> list[dict]:
    log_path = harness_dir / "events.log"
    if not log_path.is_file():
        return []
    events = []
    for line in log_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return events


def analyze(events: list[dict], feature_id: str) -> dict:
    """Extract machine-readable retro data from events.

    Event key contract mirrors scripts/work.py (canonical emitter):
      - field name is `"feature"` (not "feature_id")
      - completion type is `"feature_done"` (not "feature_completed")
    """
    relevant = [e for e in events if e.get("feature") == feature_id]
    gate_events = [e for e in relevant if e.get("type") == "gate_recorded"]
    first_gate_fail: dict | None = None
    for e in gate_events:
        if e.get("result") == "fail":
            first_gate_fail = e
            break
    completed = any(e.get("type") == "feature_done" for e in relevant)
    kickoff_opened = any(e.get("type") == "kickoff_started" for e in relevant)
    design_review_opened = any(
        e.get("type") == "design_review_opened" for e in relevant
    )
    questions_opened = sum(
        1 for e in relevant if e.get("type") == "question_opened"
    )
    questions_answered = sum(
        1 for e in relevant if e.get("type") == "question_answered"
    )
    return {
        "completed": completed,
        "first_gate_fail": first_gate_fail,
        "kickoff_opened": kickoff_opened,
        "design_review_opened": design_review_opened,
        "questions_opened": questions_opened,
        "questions_answered": questions_answered,
        "gate_events_total": len(gate_events),
        "all_events_total": len(relevant),
    }


def _template(
    feature_id: str,
    analysis: dict,
    timestamp: str,
    *,
    mode: str = "product",
) -> str:
    """Render retro.md.

    ``mode == "prototype"`` keeps only the three machine-extractable sections
    (What Shipped · First Gate to Fail · Ceremonies summary) and drops the
    five LLM-driven sections that need a reviewer→tech-writer pass. Faster
    completion for exploratory work where a full retro would be theater.
    ``"product"`` (default) renders the full template.
    """
    is_prototype = mode == "prototype"
    fgf = analysis["first_gate_fail"]
    if fgf:
        fgf_line = (
            f"- {fgf.get('gate', '?')} failed at {fgf.get('ts', '?')}"
            f"  (reason: {fgf.get('note') or fgf.get('reason') or '?'})"
        )
    else:
        fgf_line = "- 없음 (전 gate 최초에 pass)"

    intro = (
        "프로토타입 모드 — 머신 섹션만 자동 채움. LLM 반성 섹션은 생략."
        if is_prototype
        else (
            "`scripts/retro.py` 가 events.log 를 분석해 머신 섹션을 채우고, "
            "orchestrator 가 reviewer → tech-writer 순차로 Reviewer Reflection · "
            "Copy Polish 섹션을 완성한다."
        )
    )

    lines: list[str] = []
    lines.append(f"# Retrospective — {feature_id}")
    lines.append("")
    lines.append(f"> 자동 생성 — {timestamp} · mode: `{mode}`")
    lines.append(">")
    lines.append(f"> {intro}")
    lines.append("")

    # What Shipped
    lines.append("## What Shipped")
    lines.append("")
    if analysis["completed"]:
        lines.append(f"- {feature_id} — complete 전이 감지.")
    else:
        lines.append(f"- {feature_id} — complete 이벤트 미감지. 수동 확인 필요.")
    lines.append("")

    # First Gate to Fail
    lines.append("## First Gate to Fail")
    lines.append("")
    lines.append(fgf_line)
    lines.append("")

    # Ceremonies
    lines.append("## Ceremonies")
    lines.append("")
    lines.append(f"- Kickoff opened: {'✅' if analysis['kickoff_opened'] else '❌'}")
    lines.append(
        f"- Design Review opened: {'✅' if analysis['design_review_opened'] else '❌ (해당 피처에 미실행)'}"
    )
    lines.append(
        f"- Questions opened: {analysis['questions_opened']} · answered: {analysis['questions_answered']}"
    )
    lines.append("")

    # Prototype mode stops here — the five LLM sections below are product-only.
    if is_prototype:
        return "\n".join(lines).rstrip() + "\n"

    # Risks Materialized vs plan.md — LLM 섹션
    lines.append("## Risks Materialized vs plan.md")
    lines.append("")
    lines.append(
        "<!-- orchestrator via reviewer: plan.md Risks 와 실제 구현 중 발생 사건 diff -->"
    )
    lines.append("")
    lines.append("_(pending)_")
    lines.append("")

    # Decisions Revised — LLM 섹션
    lines.append("## Decisions Revised")
    lines.append("")
    lines.append(
        "<!-- orchestrator via reviewer: 구현 중 새 ADR 또는 status 전이 (superseded 등) -->"
    )
    lines.append("")
    lines.append("_(pending)_")
    lines.append("")

    # Kickoff predictions — LLM 섹션
    lines.append("## Kickoff Predictions That Were Right / Wrong")
    lines.append("")
    lines.append(
        "<!-- orchestrator via reviewer: kickoff/F-N.md 의 bullets vs 실제 결과 -->"
    )
    lines.append("")
    lines.append("_(pending)_")
    lines.append("")

    # Reviewer Reflection
    lines.append("## Reviewer Reflection")
    lines.append("")
    lines.append(
        "<!-- orchestrator invokes @harness:reviewer to produce draft prose."
        " reviewer 는 read-only (CQS) — draft 텍스트만 반환. orchestrator 가 이 섹션에 write. -->"
    )
    lines.append("")
    lines.append("_(pending)_")
    lines.append("")

    # Copy Polish
    lines.append("## Copy Polish")
    lines.append("")
    lines.append(
        "<!-- orchestrator invokes @harness:tech-writer to polish the Reviewer Reflection."
        " tech-writer 가 Write/Edit 으로 직접 이 섹션을 다듬음. -->"
    )
    lines.append("")
    lines.append("_(pending)_")
    lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def _append_event(harness_dir: Path, event: dict) -> None:
    log_path = harness_dir / "events.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")


def generate_retro(
    harness_dir: Path,
    *,
    feature_id: str,
    timestamp: str | None = None,
    force: bool = False,
    mode: str = "product",
) -> Path:
    """Create retro template + event. Returns path to the retro.md.

    Idempotency (v0.8.7): if ``retro/F-N.md`` already exists, no file write
    or event emission happens unless ``force=True``. This mirrors the
    kickoff/design-review pattern and preserves user-curated prose that
    orchestrator filled after ``reviewer → tech-writer`` chain.

    ``mode`` (v0.9.6): ``"prototype"`` renders only the three machine-
    extractable sections (What Shipped · First Gate to Fail · Ceremonies).
    Defaults to ``"product"`` for backward compat.
    """
    if timestamp is None:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    retro_dir = harness_dir / "_workspace" / "retro"
    retro_dir.mkdir(parents=True, exist_ok=True)
    path = retro_dir / f"{feature_id}.md"

    # Idempotent skip — preserve user-curated headings unless force=True
    if path.is_file() and not force:
        return path

    events = _read_events(harness_dir)
    analysis = analyze(events, feature_id)
    path.write_text(
        _template(feature_id, analysis, timestamp, mode=mode),
        encoding="utf-8",
    )
    _append_event(
        harness_dir,
        {
            "ts": timestamp,
            "type": "feature_retro_written",
            "feature": feature_id,
            "mode": mode,
            "analysis_summary": {
                "completed": analysis["completed"],
                "first_gate_fail": (
                    analysis["first_gate_fail"].get("gate")
                    if analysis["first_gate_fail"]
                    else None
                ),
                "questions_opened": analysis["questions_opened"],
            },
            "path": str(path.relative_to(harness_dir)),
        },
    )
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate retro template + events.log analysis")
    parser.add_argument("--harness-dir", type=Path, default=Path(".harness"))
    parser.add_argument("--feature", required=True)
    parser.add_argument("--timestamp", default=None)
    args = parser.parse_args(argv)
    path = generate_retro(
        args.harness_dir, feature_id=args.feature, timestamp=args.timestamp
    )
    print(str(path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
