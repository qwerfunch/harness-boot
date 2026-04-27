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
from .lang import resolve_lang
from .messages import t


_STANDARD_GATES: tuple[str, ...] = (
    "gate_0", "gate_1", "gate_2", "gate_3", "gate_4", "gate_5",
)
_MAX_OTHER_LIST: int = 5
_MAX_PENDING_LIST: int = 5
_MAX_UNREGISTERED_LIST: int = 5


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


def _render_active_block(f: dict, spec: dict | None, lang: str) -> list[str]:
    fid = f.get("id", "?")
    title = _feature_title(fid, spec)
    gates = f.get("gates", {}) or {}
    passed = _count_gates_passed(gates)
    evidence_count = len(f.get("evidence") or [])

    lines = [t("active_feature", lang=lang, title=title)]
    lines.append(
        t(
            "progress_line",
            lang=lang,
            passed=passed,
            total=len(_STANDARD_GATES),
            evidence=evidence_count,
        )
    )
    blocker = _latest_blocker_note(f)
    if blocker:
        lines.append(t("blocker_line", lang=lang, note=blocker))
    agents, groups = _resolve_agent_chain(fid, spec)
    if agents:
        lines.append(f"  {t('agent_chain', lang=lang)}: {_render_chain(agents, groups)}")
    return lines


def _resolve_agent_chain(
    fid: str, spec: dict | None
) -> tuple[list[str], list[list[str]]]:
    """F-038 + F-039 — kickoff routing + parallel groups for dashboard rendering."""
    if not isinstance(spec, dict):
        return [], []
    feature = next(
        (f for f in (spec.get("features") or []) if isinstance(f, dict) and f.get("id") == fid),
        None,
    )
    if feature is None:
        return [], []
    try:
        from scripts.ceremonies import kickoff as _kickoff
    except ImportError:
        try:
            from ceremonies import kickoff as _kickoff  # type: ignore[no-redef]
        except ImportError:
            return [], []
    try:
        shapes = _kickoff.detect_shapes(feature, spec=spec)
        if not shapes:
            return [], []
        has_audio = _kickoff.has_audio(feature)
        agents = list(_kickoff.agents_for_shapes(shapes, has_audio=has_audio))
        groups = [list(g) for g in _kickoff.parallel_groups_for_shapes(shapes, has_audio=has_audio)]
        return agents, groups
    except Exception:
        return [], []


def _render_chain(agents: list[str], groups: list[list[str]]) -> str:
    """Mirror of scripts/work.py::_render_agent_chain (F-039) — kept local so
    dashboard.py stays a pure renderer with no work.py import."""
    if not groups:
        return ", ".join(agents)
    group_sets = [set(g) for g in groups]
    parts: list[str] = []
    i = 0
    while i < len(agents):
        member = agents[i]
        matched = next((gs for gs in group_sets if member in gs), None)
        if matched is None:
            parts.append(member)
            i += 1
            continue
        block: list[str] = []
        while i < len(agents) and agents[i] in matched:
            block.append(agents[i])
            i += 1
        if len(block) >= 2:
            parts.append("(" + " ∥ ".join(block) + ")")
        else:
            parts.append(block[0])
    return " → ".join(parts)


def _render_other_in_progress(
    features: list, active_id: str | None, spec: dict | None, lang: str,
) -> list[str]:
    others = [
        f for f in features
        if isinstance(f, dict)
        and f.get("status") == "in_progress"
        and f.get("id") != active_id
    ]
    if not others:
        return []
    lines = [t("in_progress_others", lang=lang)]
    for f in others[:_MAX_OTHER_LIST]:
        lines.append(f'  "{_feature_title(f.get("id", "?"), spec)}"')
    return lines


def _render_pending(features: list, spec: dict | None, lang: str) -> list[str]:
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
    return [f"{t('pending_label', lang=lang)} {' · '.join(titles)}"]


def _render_unregistered(
    state_features: list, spec: dict | None, lang: str,
) -> tuple[list[str], int]:
    """v0.10.2 — spec 에 정의됐으나 state 에 아직 등록되지 않은 피처들.

    cosmic-suika I-002 대응: 31 개 피처가 spec.yaml 에 있어도 state.yaml 에는
    activate 가 일어난 피처만 들어가므로, 빈 호출 대시보드가 후보를 가시화하지
    못했다. 이 섹션이 spec 의 차집합을 spec 순서로 표시.

    Returns:
        (lines, total_count) — total_count 는 _MAX_UNREGISTERED_LIST 상한 적용
        전 전체 후보 수. lines 는 빈 리스트일 수 있음 (후보 없음).

    면제:
      - spec.feature.status == "archived" (이미 lifecycle 종결)
      - spec.feature.superseded_by 명시 (다른 피처가 대체)
    """
    if not isinstance(spec, dict):
        return [], 0
    spec_features = spec.get("features") or []
    if not isinstance(spec_features, list):
        return [], 0

    registered_ids: set[str] = set()
    for f in state_features:
        if isinstance(f, dict) and isinstance(f.get("id"), str):
            registered_ids.add(f["id"])

    candidates: list[dict] = []
    for f in spec_features:
        if not isinstance(f, dict):
            continue
        fid = f.get("id")
        if not isinstance(fid, str) or not fid:
            continue
        if fid in registered_ids:
            continue
        if f.get("status") == "archived":
            continue
        if f.get("superseded_by"):
            continue
        candidates.append(f)

    if not candidates:
        return [], 0

    titles = [
        f'"{_feature_title(f.get("id", "?"), spec)}"'
        for f in candidates[:_MAX_UNREGISTERED_LIST]
    ]
    header = t("next_candidates", lang=lang, n=len(candidates))
    lines = [header, "  " + " · ".join(titles)]
    if len(candidates) > _MAX_UNREGISTERED_LIST:
        lines.append(
            t("more_after_truncate", lang=lang, n=len(candidates) - _MAX_UNREGISTERED_LIST)
        )
    return lines, len(candidates)


def _render_blocked(
    features: list, active_id: str | None, spec: dict | None, lang: str,
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
    return [f"{t('on_hold_label', lang=lang)} {' · '.join(titles)}"]


def _render_suggestions(suggestions: Sequence[Suggestion], lang: str) -> list[str]:
    if not suggestions:
        return []
    lines = [t("next_actions", lang=lang)]
    marker_text = t("recommended_marker", lang=lang)
    for i, s in enumerate(suggestions, 1):
        marker = f" {marker_text}" if i == 1 else ""
        lines.append(f"  ({i}) {s.label}{marker}")
    lines.append("")
    lines.append(t("enter_hint", lang=lang, n=1))
    return lines


def render(
    state_data: dict,
    spec: dict | None,
    suggestions: Sequence[Suggestion],
    *,
    lang: str | None = None,
) -> str:
    """Render the dashboard as a single string ending with a newline.

    F-040 — labels and headers honor the resolved language. Pass ``lang``
    explicitly for tests; production callers leave it ``None`` so the
    resolver picks up ``HARNESS_LANG`` / ``spec.project.language`` /
    system locale.

    Args:
        state_data: parsed ``state.yaml`` dict.
        spec: parsed ``spec.yaml`` dict (for title lookup) or None.
        suggestions: list from ``intent_planner.suggest``.
        lang: optional language override ("en" or "ko").

    Returns:
        Multi-line string ready to write to stdout.
    """
    if lang is None:
        lang = resolve_lang(spec)

    sections: list[list[str]] = []
    sections.append([f"📊 {t('dashboard_title', lang=lang)}"])

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
        sections.append(_render_active_block(by_id[active_id], spec, lang))

    other_block = _render_other_in_progress(features, active_id, spec, lang)
    if other_block:
        sections.append(other_block)

    blocked_block = _render_blocked(features, active_id, spec, lang)
    if blocked_block:
        sections.append(blocked_block)

    pending_block = _render_pending(features, spec, lang)
    if pending_block:
        sections.append(pending_block)

    unregistered_block, unregistered_count = _render_unregistered(features, spec, lang)
    if unregistered_block:
        sections.append(unregistered_block)

    # Empty-state hint when no features are tracked at all.
    if not by_id and not features and not unregistered_count:
        sections.append([t("no_features", lang=lang)])
    elif (
        (not isinstance(active_id, str) or active_id not in by_id)
        and not other_block
        and not blocked_block
        and not pending_block
        and not unregistered_block
    ):
        done_count = sum(
            1 for f in features
            if isinstance(f, dict) and f.get("status") == "done"
        )
        if done_count:
            sections.append([t("all_done", lang=lang, n=done_count)])
        else:
            sections.append([t("no_active_no_pending", lang=lang)])

    suggestion_block = _render_suggestions(suggestions, lang)
    if suggestion_block:
        sections.append(suggestion_block)

    joined = "\n\n".join("\n".join(block) for block in sections)
    return joined.rstrip() + "\n"


__all__ = ["render"]
