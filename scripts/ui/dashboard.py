"""`/harness-boot:work` no-args dashboard renderer (v0.9.2).

Pure renderer: takes a parsed ``state.yaml`` dict, an optional ``spec.yaml``
dict (for title lookup), and a pre-computed suggestion list from
``intent_planner.suggest``. Returns a human-readable Korean string.

CQS — this module reads inputs and returns a string. It performs no disk I/O
and mutates nothing. The caller (``scripts/work.py`` no-args branch) is
responsible for loading state and persisting nothing.

Output shape (illustrative):

    📊 harness-boot

    작업 중: "로그인 흐름"
      진행: 검증 3/6 통과 · 근거 2 개
      차단: 접근성 · Space 키 동작 미정

    진행 중 (다른):
      "대시보드"

    대기: "로그아웃" · "설정"

    다음 할 일:
      (1) 검증 실행: gate_3 (추천)
      (2) 다른 작업으로 전환

    Enter = 1 (추천)
"""

from __future__ import annotations

from typing import Sequence

from .intent_planner import Suggestion


_STANDARD_GATES: tuple[str, ...] = (
    "gate_0", "gate_1", "gate_2", "gate_3", "gate_4", "gate_5",
)
_MAX_OTHER_LIST: int = 5
_MAX_PENDING_LIST: int = 5


def _feature_title(fid: str, spec: dict | None) -> str:
    if not isinstance(spec, dict):
        return fid
    for f in spec.get("features") or []:
        if isinstance(f, dict) and f.get("id") == fid:
            title = f.get("name") or f.get("title")
            if isinstance(title, str) and title.strip():
                return title.strip()
    return fid


def _count_gates_passed(gates: dict) -> int:
    return sum(
        1 for g in _STANDARD_GATES
        if isinstance(gates.get(g), dict)
        and gates[g].get("last_result") == "pass"
    )


def _latest_blocker_note(f: dict) -> str | None:
    """Latest blocker-kind evidence summary, if the most recent evidence is one.

    Walks evidence from the tail and stops at the first non-blocker entry.
    This keeps the dashboard from surfacing stale blockers once the user has
    added follow-up evidence indicating resolution.
    """
    evidence = f.get("evidence") or []
    if not isinstance(evidence, list):
        return None
    for ev in reversed(evidence):
        if not isinstance(ev, dict):
            continue
        if ev.get("kind") == "blocker":
            summary = ev.get("summary")
            return summary.strip() if isinstance(summary, str) and summary.strip() else None
        return None
    return None


def _render_active_block(f: dict, spec: dict | None) -> list[str]:
    fid = f.get("id", "?")
    title = _feature_title(fid, spec)
    gates = f.get("gates", {}) or {}
    passed = _count_gates_passed(gates)
    evidence_count = len(f.get("evidence") or [])

    lines = [f'작업 중: "{title}"']
    lines.append(
        f"  진행: 검증 {passed}/{len(_STANDARD_GATES)} 통과 · 근거 {evidence_count} 개"
    )
    blocker = _latest_blocker_note(f)
    if blocker:
        lines.append(f"  차단: {blocker}")
    return lines


def _render_other_in_progress(
    features: list, active_id: str | None, spec: dict | None,
) -> list[str]:
    others = [
        f for f in features
        if isinstance(f, dict)
        and f.get("status") == "in_progress"
        and f.get("id") != active_id
    ]
    if not others:
        return []
    lines = ["진행 중 (다른):"]
    for f in others[:_MAX_OTHER_LIST]:
        lines.append(f'  "{_feature_title(f.get("id", "?"), spec)}"')
    return lines


def _render_pending(features: list, spec: dict | None) -> list[str]:
    pending = [
        f for f in features
        if isinstance(f, dict) and f.get("status") == "planned"
    ]
    if not pending:
        return []
    titles = [
        f'"{_feature_title(f.get("id", "?"), spec)}"'
        for f in pending[:_MAX_PENDING_LIST]
    ]
    return [f"대기: {' · '.join(titles)}"]


def _render_blocked(
    features: list, active_id: str | None, spec: dict | None,
) -> list[str]:
    blocked = [
        f for f in features
        if isinstance(f, dict)
        and f.get("status") == "blocked"
        and f.get("id") != active_id
    ]
    if not blocked:
        return []
    titles = [
        f'"{_feature_title(f.get("id", "?"), spec)}"'
        for f in blocked[:_MAX_OTHER_LIST]
    ]
    return [f"보류: {' · '.join(titles)}"]


def _render_suggestions(suggestions: Sequence[Suggestion]) -> list[str]:
    if not suggestions:
        return []
    lines = ["다음 할 일:"]
    for i, s in enumerate(suggestions, 1):
        marker = " (추천)" if i == 1 else ""
        lines.append(f"  ({i}) {s.label}{marker}")
    lines.append("")
    lines.append("Enter = 1 (추천)")
    return lines


def render(
    state_data: dict,
    spec: dict | None,
    suggestions: Sequence[Suggestion],
) -> str:
    """Render the dashboard as a single string ending with a newline.

    Args:
        state_data: parsed ``state.yaml`` dict.
        spec: parsed ``spec.yaml`` dict (for title lookup) or None.
        suggestions: list from ``intent_planner.suggest``.

    Returns:
        Multi-line string ready to write to stdout.
    """
    sections: list[list[str]] = []
    sections.append(["📊 harness-boot"])

    features = state_data.get("features") if isinstance(state_data, dict) else None
    if not isinstance(features, list):
        features = []
    session = state_data.get("session") if isinstance(state_data, dict) else None
    active_id = (
        session.get("active_feature_id")
        if isinstance(session, dict) else None
    )
    by_id = {
        f["id"]: f for f in features
        if isinstance(f, dict) and isinstance(f.get("id"), str)
    }

    if isinstance(active_id, str) and active_id in by_id:
        sections.append(_render_active_block(by_id[active_id], spec))

    other_block = _render_other_in_progress(features, active_id, spec)
    if other_block:
        sections.append(other_block)

    blocked_block = _render_blocked(features, active_id, spec)
    if blocked_block:
        sections.append(blocked_block)

    pending_block = _render_pending(features, spec)
    if pending_block:
        sections.append(pending_block)

    # Empty-state hint when no features are tracked at all.
    if not by_id and not features:
        sections.append(["아직 피처가 없습니다."])
    elif (
        (not isinstance(active_id, str) or active_id not in by_id)
        and not other_block
        and not blocked_block
        and not pending_block
    ):
        done_count = sum(
            1 for f in features
            if isinstance(f, dict) and f.get("status") == "done"
        )
        if done_count:
            sections.append([f"모든 피처 완료 — 완료 {done_count} 개."])
        else:
            sections.append(["진행 중 · 대기 피처 없음."])

    suggestion_block = _render_suggestions(suggestions)
    if suggestion_block:
        sections.append(suggestion_block)

    joined = "\n\n".join("\n".join(block) for block in sections)
    return joined.rstrip() + "\n"


__all__ = ["render"]
