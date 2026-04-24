"""Scenario contract — "어떻게 말해도 됩니다" (v0.9.4).

Canonical table mapping user-friendly Korean phrases to internal actions. This
is the single source the README documentation and the integration tests share,
so README examples never drift from what the scripts layer actually supports.

How to extend:

1. Add a new ``ScenarioMapping`` tuple to ``SCENARIOS`` below.
2. The ``action`` field must match one of ``Action`` literals — the dispatch
   map in ``scripts/ui/scenarios.py::dispatch_action_name`` translates actions
   to concrete ``scripts/work.py`` function names.
3. Integration tests under ``tests/integration/test_scenario_mappings.py``
   iterate this table; no separate update needed.

The table is **not exhaustive** — users can phrase things many ways and the
LLM running the slash command is expected to interpret freely. These entries
are the **canonical forms** used in documentation and the contract Claude
Code's slash commands implement.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


Action = Literal[
    "dashboard",
    "activate",
    "run_gates",
    "complete",
    "block",
    "deactivate",
    "add_evidence",
    "remove",
    "switch",
]


@dataclass(frozen=True)
class ScenarioMapping:
    """One user phrase family → one internal action.

    ``phrases`` lists the canonical Korean phrasings the user might type.
    ``action`` is the machine identifier — slash command routes here.
    ``description`` is the short human explanation rendered in README.
    ``read_only`` flags actions that must not mutate state (CQS — dashboard
    only as of v0.9.4).
    """

    category: str
    phrases: tuple[str, ...]
    action: Action
    description: str
    read_only: bool


SCENARIOS: tuple[ScenarioMapping, ...] = (
    # === 일상 · 자주 쓰는 표현 ===========================================
    ScenarioMapping(
        category="일상",
        phrases=("", "(빈 호출)"),
        action="dashboard",
        description="현재 상태 + 다음 할 일 추천 1~3 안",
        read_only=True,
    ),
    ScenarioMapping(
        category="일상",
        phrases=("돌려봐", "확인해줘", "테스트", "검증", "돌려"),
        action="run_gates",
        description="모든 검증 자동 실행 (gate_0~5)",
        read_only=False,
    ),
    ScenarioMapping(
        category="일상",
        phrases=("됐어", "끝났어", "완료", "done"),
        action="complete",
        description="완료 전이 — Iron Law D 누적 근거 체크",
        read_only=False,
    ),
    ScenarioMapping(
        category="일상",
        phrases=("막혔어", "보류", "나중에", "block"),
        action="block",
        description="보류 상태로 전환 + 사유 기록",
        read_only=False,
    ),
    ScenarioMapping(
        category="일상",
        phrases=("다른 거 먼저", "잠깐 딴 거", "deactivate"),
        action="deactivate",
        description="현 작업 포인터 해제 — 피처 상태는 유지",
        read_only=False,
    ),
    # === 피처 시작 / 전환 ===============================================
    ScenarioMapping(
        category="시작",
        phrases=("로그인 흐름", "@F-3", "F-3 시작"),
        action="activate",
        description="피처 활성화 — 제목 substring · @F-N · 평문 F-N",
        read_only=False,
    ),
    ScenarioMapping(
        category="시작",
        phrases=("이어서", "계속", "재개"),
        action="activate",
        description="대시보드 추천이 가리키는 피처로 복귀",
        read_only=False,
    ),
    # === 근거 · 수동 기록 ===============================================
    ScenarioMapping(
        category="근거",
        phrases=("확인했어", "수동 확인", "리뷰 받았어"),
        action="add_evidence",
        description="declared evidence 추가 (Iron Law D 카운트)",
        read_only=False,
    ),
    # === 정리 ===========================================================
    ScenarioMapping(
        category="정리",
        phrases=("이건 빼자", "취소해줘", "없던 걸로"),
        action="remove",
        description="planned 피처 삭제 (done 피처는 보호)",
        read_only=False,
    ),
)


# Map canonical action id → ``scripts/work.py`` function name the integration
# tests invoke. Keeping this as data (not a call) lets the tests import the
# name and resolve it lazily; scenarios.py stays free of heavy imports.
_DISPATCH: dict[str, str] = {
    "dashboard": "dashboard_snapshot",
    "activate": "activate",
    "run_gates": "run_and_record_gate",
    "complete": "complete",
    "block": "block",
    "deactivate": "deactivate",
    "add_evidence": "add_evidence",
    "remove": "remove_feature",
    "switch": "deactivate",
}


def dispatch_action_name(action: Action) -> str:
    """Return the ``scripts/work.py`` attribute name for a given action.

    Raises:
        KeyError: when the action is not in the dispatch map. This is an
            implementation bug — ``Action`` literal and ``_DISPATCH`` must
            evolve together.
    """
    return _DISPATCH[action]


def as_readme_rows() -> list[tuple[str, str, str]]:
    """Render the scenario table as ``(category, phrases, description)`` rows.

    Used by the integration test that audits README ↔ scenarios.py drift.
    Phrases are joined with ``·`` for human-readable rendering; empty phrases
    render as ``(빈 호출)`` for clarity.
    """
    out: list[tuple[str, str, str]] = []
    for s in SCENARIOS:
        rendered = " · ".join(
            f'"{p}"' if p else "(빈 호출)" for p in s.phrases
        )
        out.append((s.category, rendered, s.description))
    return out


__all__ = [
    "Action",
    "ScenarioMapping",
    "SCENARIOS",
    "dispatch_action_name",
    "as_readme_rows",
]
