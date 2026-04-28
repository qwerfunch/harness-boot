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

from pathlib import Path
from typing import Sequence

try:
    import yaml
except ImportError:  # pragma: no cover — pyyaml is a hard runtime dep
    yaml = None  # type: ignore[assignment]

from .intent_planner import Suggestion
from .lang import resolve_lang
from .messages import t


# F-079 — same default as F-078 (scripts/check.py:_DEFAULT_COVERAGE_THRESHOLD).
# Kept duplicated rather than imported to avoid pulling check.py into the
# dashboard import path; if both ever drift, tests for either side will
# surface the inconsistency.
_DEFAULT_COVERAGE_THRESHOLD = 0.80
# Number of below-threshold features that triggers the red alert line.
_DEBT_ALERT_THRESHOLD = 5


# F-043 — single sources of truth moved out:
#   gates → scripts/core/gates.py
#   limits → scripts/ui/dashboard_config.py (env-overridable)
try:
    from scripts.core.gates import STANDARD_GATES as _STANDARD_GATES  # noqa: E402
except ImportError:
    from core.gates import STANDARD_GATES as _STANDARD_GATES  # type: ignore[no-redef]  # noqa: E402
from .dashboard_config import (  # noqa: E402
    max_other_list as _max_other_list,
    max_pending_list as _max_pending_list,
    max_unregistered_list as _max_unregistered_list,
)


def _load_coverage(
    harness_dir: Path | None, fid: str
) -> tuple[float | None, list[dict]]:
    """F-079 — read F-077 fingerprint and compute coverage ratio.

    Returns ``(coverage, mismatches)`` where ``coverage`` is the
    arithmetic mean of ``ac_value / description_value`` across recorded
    mismatches (1.0 when the mismatches list is empty), or ``None`` if
    the fingerprint file is missing / unparseable. ``mismatches`` is
    the raw list passed back so callers can render per-metric detail.
    """
    if harness_dir is None or yaml is None:
        return None, []
    fp_path = harness_dir / "_workspace" / "coverage" / f"{fid}.yaml"
    if not fp_path.is_file():
        return None, []
    try:
        fp = yaml.safe_load(fp_path.read_text(encoding="utf-8")) or {}
    except Exception:
        return None, []
    mismatches = fp.get("mismatches") or []
    if not mismatches:
        return 1.0, []
    ratios: list[float] = []
    detailed: list[dict] = []
    for m in mismatches:
        try:
            d = int(m.get("description_value", 0))
            a = int(m.get("ac_value", 0))
        except (TypeError, ValueError):
            continue
        if d <= 0:
            continue
        ratios.append(a / d)
        detailed.append({"metric": m.get("metric", ""), "ac": a, "desc": d})
    if not ratios:
        return None, []
    return sum(ratios) / len(ratios), detailed


def _format_coverage_line(coverage: float, detailed: list[dict]) -> str:
    pct = int(round(coverage * 100))
    parts = [f"{d['ac']}/{d['desc']} {d['metric']}" for d in detailed]
    detail = ", ".join(parts)
    if detail:
        return f"  coverage: {pct}% ({detail})"
    return f"  coverage: {pct}%"


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


def _render_active_block(
    f: dict, spec: dict | None, lang: str,
    *,
    harness_dir: Path | None = None,
) -> list[str]:
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
    coverage, detailed = _load_coverage(harness_dir, fid)
    if coverage is not None and coverage < 1.0:
        lines.append(_format_coverage_line(coverage, detailed))
    blocker = _latest_blocker_note(f)
    if blocker:
        lines.append(t("blocker_line", lang=lang, note=blocker))
    agents, groups = _resolve_agent_chain(fid, spec)
    if agents:
        lines.append(f"  {t('agent_chain', lang=lang)}: {_render_chain(agents, groups)}")
    return lines


def _render_coverage_debt(
    features: list, harness_dir: Path | None,
    threshold: float, lang: str,
) -> list[str]:
    """F-079 — aggregate "Coverage debt" section.

    Counts features whose F-077 fingerprint has at least one mismatch
    and the subset whose mean ratio falls below the threshold. When the
    below-threshold count exceeds ``_DEBT_ALERT_THRESHOLD``, emits a
    leading alert line so the user sees the backpressure even when
    looking at an unrelated active feature.
    """
    if harness_dir is None:
        return []
    with_mismatches: list[str] = []
    below_threshold: list[str] = []
    for f in features:
        if not isinstance(f, dict):
            continue
        fid = f.get("id")
        if not isinstance(fid, str):
            continue
        coverage, detailed = _load_coverage(harness_dir, fid)
        if coverage is None or coverage >= 1.0:
            continue
        with_mismatches.append(fid)
        if coverage < threshold:
            below_threshold.append(fid)
    if not with_mismatches:
        return []
    block: list[str] = []
    if len(below_threshold) > _DEBT_ALERT_THRESHOLD:
        block.append(
            f"⚠ Coverage debt high — review carry-forward before next feature"
        )
    block.append(
        f"Coverage debt: {len(with_mismatches)} features with mismatches "
        f"({len(below_threshold)} below threshold {threshold:.2f})"
    )
    return block


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


# F-043 — _render_chain consolidated into scripts/ui/render.render_agent_chain.
# This alias keeps dashboard's pre-F-043 callsites and tests stable.
from .render import render_agent_chain as _render_chain  # noqa: E402


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
    for f in others[:_max_other_list()]:
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
        for f in pending[:_max_pending_list()]
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
        # F-044 — F-029's archived_at marker (in-place lifecycle archive)
        # also hides the feature from "next candidates".
        if f.get("archived_at"):
            continue
        candidates.append(f)

    if not candidates:
        return [], 0

    titles = [
        f'"{_feature_title(f.get("id", "?"), spec)}"'
        for f in candidates[:_max_unregistered_list()]
    ]
    header = t("next_candidates", lang=lang, n=len(candidates))
    lines = [header, "  " + " · ".join(titles)]
    if len(candidates) > _max_unregistered_list():
        lines.append(
            t("more_after_truncate", lang=lang, n=len(candidates) - _max_unregistered_list())
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
        for f in blocked[:_max_other_list()]
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
    harness_dir: Path | None = None,
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
        sections.append(
            _render_active_block(
                by_id[active_id], spec, lang, harness_dir=harness_dir,
            )
        )

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

    debt_block = _render_coverage_debt(
        features, harness_dir, _DEFAULT_COVERAGE_THRESHOLD, lang,
    )
    if debt_block:
        sections.append(debt_block)

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
