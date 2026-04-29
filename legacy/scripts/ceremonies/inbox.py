#!/usr/bin/env python3
"""inbox.py — v0.6 Q&A file-drop protocol — open-question polling.

Scans `.harness/_workspace/questions/` for files matching
`F-N--<from>--<to>.md` and returns those with no `## Answer` section —
the "open" inbox for an orchestrator poll at stage boundaries.

Appends `question_opened` when `--record-open` is passed on a fresh
file (first-time scan). Pure read otherwise (CQS-friendly).

Usage:
    python3 scripts/inbox.py --harness-dir .harness
    python3 scripts/inbox.py --harness-dir .harness --feature F-1
    python3 scripts/inbox.py --harness-dir .harness --json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path


_FILENAME_RE = re.compile(r"^(F-\d+)--([\w\-]+)--([\w\-]+)\.md$")
_ANSWER_HEADER_RE = re.compile(r"^##\s+Answer\b", re.MULTILINE)
_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)


@dataclass(frozen=True)
class Question:
    feature_id: str
    from_agent: str
    to_agent: str
    path: str
    blocking: bool
    has_answer: bool


def _parse_frontmatter(text: str) -> dict:
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return {}
    # Lightweight parse — avoid requiring pyyaml at runtime.
    try:
        import yaml
        return yaml.safe_load(m.group(1)) or {}
    except ImportError:
        return {}


def scan_inbox(harness_dir: Path, *, feature_id: str | None = None) -> list[Question]:
    q_dir = harness_dir / "_workspace" / "questions"
    if not q_dir.is_dir():
        return []

    out: list[Question] = []
    for path in sorted(q_dir.iterdir()):
        if not path.is_file():
            continue
        m = _FILENAME_RE.match(path.name)
        if not m:
            continue
        fid, from_a, to_a = m.groups()
        if feature_id and fid != feature_id:
            continue
        body = path.read_text(encoding="utf-8")
        fm = _parse_frontmatter(body)
        has_answer = bool(_ANSWER_HEADER_RE.search(body))
        out.append(
            Question(
                feature_id=fid,
                from_agent=from_a,
                to_agent=to_a,
                path=str(path.relative_to(harness_dir)),
                blocking=bool(fm.get("blocking", False)),
                has_answer=has_answer,
            )
        )
    return out


def open_questions(harness_dir: Path, *, feature_id: str | None = None) -> list[Question]:
    return [q for q in scan_inbox(harness_dir, feature_id=feature_id) if not q.has_answer]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="List open questions in the Q&A inbox")
    parser.add_argument("--harness-dir", type=Path, default=Path(".harness"))
    parser.add_argument("--feature", default=None, help="filter by F-N id")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    parser.add_argument("--all", action="store_true", help="include answered questions")
    args = parser.parse_args(argv)

    scanner = scan_inbox if args.all else open_questions
    qs = scanner(args.harness_dir, feature_id=args.feature)

    if args.json:
        json.dump([asdict(q) for q in qs], sys.stdout, indent=2, ensure_ascii=False)
        print()
    else:
        if not qs:
            print("(no open questions)" if not args.all else "(no questions)")
            return 0
        for q in qs:
            flag = "🔒" if q.blocking else "  "
            status = "✅" if q.has_answer else "❓"
            print(f"{status} {flag} {q.feature_id} · {q.from_agent} → {q.to_agent}  {q.path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
