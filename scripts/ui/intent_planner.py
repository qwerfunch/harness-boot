"""State → Top 1-3 suggested next actions (v0.9.2).

Deterministic rules — no LLM call. Reads a ``state.yaml`` dict + optional
``spec.yaml`` dict, returns ordered list of ``Suggestion``. Caller (dashboard
or ``/harness-boot:work`` router) renders the labels and lets the user choose.

Priority order (first match wins, up to 3 returned):

Active feature present:

1. ``blocked`` status or any recent ``blocker`` evidence → propose unblock.
2. Any gate with ``last_result == "fail"`` → propose analyze + rerun.
3. Any standard gate not yet pass → propose the earliest missing gate run.
4. ``gate_5`` pass + evidence count == 0 → propose evidence entry (BR-004).
5. ``gate_5`` pass + evidence ≥ 1 → propose complete transition.
6. Secondary: offer deactivate so the user can switch.

No active feature:

1. Some feature in_progress elsewhere → propose resume.
2. Some feature planned → propose start.
3. Neither → propose registering a new feature.

The module is pure: no I/O, no state mutation, no side effects. Suggestion
labels are Korean-friendly strings without jargon. ``action`` is the machine
identifier the caller dispatches on.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


_STANDARD_GATES: tuple[str, ...] = (
    "gate_0", "gate_1", "gate_2", "gate_3", "gate_4", "gate_5",
)


Action = Literal[
    "resolve_block",
    "analyze_fail",
    "run_gate",
    "add_evidence",
    "complete",
    "deactivate",
    "resume",
    "start_feature",
    "init_feature",
]


@dataclass(frozen=True)
class Suggestion:
    """One proposed next action.

    ``label`` is the human-readable Korean string for dashboard rendering.
    ``action`` is the machine identifier so the caller can route dispatch
    without parsing the label. ``feature_id`` / ``gate`` are populated when
    the action targets a specific feature or gate.
    """

    label: str
    action: Action
    feature_id: str | None = None
    gate: str | None = None


def _feature_title(fid: str, spec: dict | None) -> str:
    """Look up a feature's title from spec.yaml. Falls back to id."""
    if not isinstance(spec, dict):
        return fid
    for f in spec.get("features") or []:
        if isinstance(f, dict) and f.get("id") == fid:
            title = f.get("name") or f.get("title")
            if isinstance(title, str) and title.strip():
                return title.strip()
    return fid


def _has_recent_blocker(evidence: list) -> bool:
    """Return True when the most recent evidence entry is a blocker.

    We check only the last entry so that once the user adds post-block
    evidence (e.g., "blocker resolved · tests rerun"), the suggestion flips
    back to the normal flow. Looking at all history would keep nagging.
    """
    if not isinstance(evidence, list) or not evidence:
        return False
    last = evidence[-1]
    return isinstance(last, dict) and last.get("kind") == "blocker"


def _suggestions_for_active(f: dict, spec: dict | None) -> list[Suggestion]:
    fid = f.get("id", "?")
    status = f.get("status", "planned")
    gates = f.get("gates", {}) or {}
    evidence = f.get("evidence", []) or []
    title = _feature_title(fid, spec)

    # 1. Blocked — either status transition or recent blocker evidence.
    if status == "blocked" or _has_recent_blocker(evidence):
        return [
            Suggestion(
                label=f'차단 해결 시도: "{title}"',
                action="resolve_block",
                feature_id=fid,
            ),
            Suggestion(label="다른 작업으로 전환", action="deactivate"),
        ]

    # 2. Gate fail — analyze + rerun that gate first.
    failed = [
        name for name, g in gates.items()
        if isinstance(g, dict) and g.get("last_result") == "fail"
    ]
    if failed:
        ordered = [g for g in _STANDARD_GATES if g in failed] or sorted(failed)
        first = ordered[0]
        return [
            Suggestion(
                label=f"실패 원인 분석: {first}",
                action="analyze_fail",
                feature_id=fid,
                gate=first,
            ),
            Suggestion(
                label=f"{first} 재실행",
                action="run_gate",
                feature_id=fid,
                gate=first,
            ),
            Suggestion(label="다른 작업으로 전환", action="deactivate"),
        ]

    # 3. Earliest not-yet-pass gate.
    next_gate: str | None = None
    for gate_name in _STANDARD_GATES:
        g = gates.get(gate_name, {})
        result = g.get("last_result") if isinstance(g, dict) else None
        if result != "pass":
            next_gate = gate_name
            break

    gate5 = gates.get("gate_5", {})
    gate5_pass = isinstance(gate5, dict) and gate5.get("last_result") == "pass"

    # 4-5. All gates pass — decide between add_evidence and complete.
    if gate5_pass and next_gate is None:
        if len(evidence) == 0:
            return [
                Suggestion(
                    label=f'근거 1 건 추가 ("{title}")',
                    action="add_evidence",
                    feature_id=fid,
                ),
                Suggestion(label="다른 작업으로 전환", action="deactivate"),
            ]
        return [
            Suggestion(
                label=f'완료 처리: "{title}"',
                action="complete",
                feature_id=fid,
            ),
            Suggestion(label="다른 작업으로 전환", action="deactivate"),
        ]

    # Still gates to run. If gate_5 already pass but earlier gate missing,
    # fall through here (unusual — user ran gate_5 out of order).
    if next_gate is not None:
        return [
            Suggestion(
                label=f"검증 실행: {next_gate}",
                action="run_gate",
                feature_id=fid,
                gate=next_gate,
            ),
            Suggestion(label="다른 작업으로 전환", action="deactivate"),
        ]

    # Defensive fallback — shouldn't reach here given the cases above.
    return [Suggestion(label="다른 작업으로 전환", action="deactivate")]


def _suggestions_for_idle(
    features: list, spec: dict | None,
) -> list[Suggestion]:
    def _valid(f: object, status: str) -> bool:
        return (
            isinstance(f, dict)
            and f.get("status") == status
            and isinstance(f.get("id"), str)
        )

    in_progress = [f for f in features if _valid(f, "in_progress")]
    planned = [f for f in features if _valid(f, "planned")]

    out: list[Suggestion] = []

    if in_progress:
        first = in_progress[0]
        fid = first.get("id", "?")
        out.append(Suggestion(
            label=f'이어서 작업: "{_feature_title(fid, spec)}"',
            action="resume",
            feature_id=fid,
        ))

    if planned:
        first = planned[0]
        fid = first.get("id", "?")
        out.append(Suggestion(
            label=f'다음 피처 시작: "{_feature_title(fid, spec)}"',
            action="start_feature",
            feature_id=fid,
        ))

    if not out:
        out.append(Suggestion(
            label="새 피처 등록 (spec.yaml 편집)",
            action="init_feature",
        ))

    return out


def suggest(state_data: dict, spec: dict | None = None) -> list[Suggestion]:
    """Return up to 3 suggestions ordered by recommendation strength.

    Args:
        state_data: parsed ``state.yaml`` dict (``State.load(...).data``).
        spec: optional parsed ``spec.yaml`` dict — used for title lookup
            so labels can show the user-friendly name instead of ``F-N``.

    Returns:
        Ordered list of ``Suggestion`` (0 - 3 items). First item is the
        recommended default; caller should treat Enter as "choose index 1".
    """
    if not isinstance(state_data, dict):
        return []

    session = state_data.get("session") or {}
    active_id = session.get("active_feature_id") if isinstance(session, dict) else None
    features = state_data.get("features") or []
    if not isinstance(features, list):
        features = []

    by_id = {
        f["id"]: f for f in features
        if isinstance(f, dict) and isinstance(f.get("id"), str)
    }

    if isinstance(active_id, str) and active_id in by_id:
        out = _suggestions_for_active(by_id[active_id], spec)
    else:
        out = _suggestions_for_idle(features, spec)

    return out[:3]


__all__ = ["Suggestion", "Action", "suggest"]
