#!/usr/bin/env python3
"""
state.py — .harness/state.yaml 의 load/save/mutation 헬퍼 (v0.3 공통 유틸)

사용 (library):
  from state import State
  st = State.load(harness_dir)
  st.set_active("F-004")
  st.record_gate_result("F-004", "gate_0", "pass")
  st.save()

스키마 (v0.3 기준):
  version: "2.3"
  schema_version: "2.3"
  features:
    - id: F-NNN
      status: planned | in_progress | blocked | done | archived
      gates:
        gate_0: { last_result: pass | fail | skipped, ts: "...", note: "..." }
        gate_1: ...
      evidence:
        - { ts, kind, summary }
      started_at: null | iso8601
      completed_at: null | iso8601
  session:
    started_at: null | iso8601
    last_command: ""
    last_gate_passed: null
    active_feature_id: null

외부 의존: pyyaml.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal

try:
    import yaml
except ImportError:
    raise ImportError("pyyaml is required")


GateResult = Literal["pass", "fail", "skipped"]
FeatureStatus = Literal["planned", "in_progress", "blocked", "done", "archived"]

_FEATURE_STATUSES: frozenset[str] = frozenset(
    {"planned", "in_progress", "blocked", "done", "archived"}
)
_GATE_RESULTS: frozenset[str] = frozenset({"pass", "fail", "skipped"})

# Iron Law D (v0.9.3) — evidence kinds produced by machines (gate runner auto-
# emits ``gate_run`` on pass). These do NOT count toward Iron Law D because the
# whole point is that **human-declared signals** (manual checks, reviews, user
# feedback, tests the author chose to record) prove genuine verification.
# Kinds not in this set — including ``test``, ``manual_check``,
# ``user_feedback``, ``reviewer_check``, ``generic``, ``blocker``, ``hotfix``
# — are declared. The taxonomy is kind-based rather than a new field so that
# existing state.yaml files stay forward-compatible with no migration.
_AUTOMATIC_EVIDENCE_KINDS: frozenset[str] = frozenset({"gate_run", "gate_auto_run"})

# Iron Law D — default trailing window (days) for counting declared evidence.
# v0.9.3 hardcodes 7; v0.9.4+ may override via ``.harness/.config.toml``.
IRON_LAW_D_DEFAULT_WINDOW_DAYS: int = 7


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _default_state() -> dict:
    return {
        "version": "2.3",
        "schema_version": "2.3",
        "features": [],
        "session": {
            "started_at": None,
            "last_command": "",
            "last_gate_passed": None,
            "active_feature_id": None,
        },
    }


@dataclass
class State:
    """Mutable state.yaml 뷰. 변경 후 `.save()` 로 파일 반영."""

    path: Path
    data: dict = field(default_factory=_default_state)

    @classmethod
    def load(cls, harness_dir: Path) -> "State":
        """`<harness_dir>/state.yaml` 로드. 없으면 default 스키마로 초기화 (디스크 쓰기는 save 에서만)."""
        path = harness_dir / "state.yaml"
        if path.is_file():
            with path.open("r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or _default_state()
            if not isinstance(data, dict):
                data = _default_state()
        else:
            data = _default_state()
        # session 블록 누락 방지
        data.setdefault("session", _default_state()["session"])
        data.setdefault("features", [])
        return cls(path=path, data=data)

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w", encoding="utf-8") as f:
            yaml.safe_dump(
                self.data,
                f,
                sort_keys=False,
                allow_unicode=True,
                default_flow_style=False,
            )

    # --- feature helpers --------------------------------------------------

    def feature_ids(self) -> list[str]:
        return [f.get("id") for f in self.data["features"] if isinstance(f, dict)]

    def get_feature(self, fid: str) -> dict | None:
        for f in self.data["features"]:
            if isinstance(f, dict) and f.get("id") == fid:
                return f
        return None

    def ensure_feature(self, fid: str) -> dict:
        """features[] 에 id 가 없으면 planned 로 신규 삽입, 있으면 그 항목 반환."""
        existing = self.get_feature(fid)
        if existing is not None:
            return existing
        entry: dict[str, Any] = {
            "id": fid,
            "status": "planned",
            "gates": {},
            "evidence": [],
            "started_at": None,
            "completed_at": None,
        }
        self.data["features"].append(entry)
        return entry

    def set_status(self, fid: str, status: FeatureStatus) -> None:
        if status not in _FEATURE_STATUSES:
            raise ValueError(
                f"invalid status {status!r} (expected one of {sorted(_FEATURE_STATUSES)})"
            )
        f = self.ensure_feature(fid)
        prev = f.get("status")
        f["status"] = status
        ts = _now()
        if status == "in_progress" and f.get("started_at") is None:
            f["started_at"] = ts
        if status == "done" and f.get("completed_at") is None:
            f["completed_at"] = ts
        # planned 로 돌리는 리셋은 허용하지만 started/completed 는 건들지 않음

    def record_gate_result(
        self,
        fid: str,
        gate_name: str,
        result: GateResult,
        *,
        note: str = "",
        ts: str | None = None,
    ) -> None:
        if result not in _GATE_RESULTS:
            raise ValueError(f"invalid gate result {result!r}")
        f = self.ensure_feature(fid)
        gates = f.setdefault("gates", {})
        gates[gate_name] = {
            "last_result": result,
            "ts": ts or _now(),
            "note": note,
        }
        if result == "pass":
            self.data["session"]["last_gate_passed"] = gate_name

    def add_evidence(self, fid: str, kind: str, summary: str, *, ts: str | None = None) -> None:
        f = self.ensure_feature(fid)
        ev = f.setdefault("evidence", [])
        ev.append({"ts": ts or _now(), "kind": kind, "summary": summary})

    def add_skipped_agent(
        self,
        fid: str,
        agent: str,
        reason: str,
        *,
        ts: str | None = None,
    ) -> None:
        """Record that an agent was intentionally skipped for a feature.

        v0.5 routing documented skipped_agents[] but state.py never implemented it —
        orchestrator skip decisions left no trail. v0.7.2 adds the write API; the
        policy (where in the chain skips happen) remains orchestrator business.
        """
        if not agent:
            raise ValueError("agent name required")
        if not reason:
            raise ValueError("reason required — silent skips defeat the audit purpose")
        f = self.ensure_feature(fid)
        skipped = f.setdefault("skipped_agents", [])
        skipped.append({"agent": agent, "reason": reason, "ts": ts or _now()})

    def get_skipped_agents(self, fid: str) -> list[dict]:
        f = self.get_feature(fid)
        if f is None:
            return []
        return list(f.get("skipped_agents") or [])

    # --- session helpers --------------------------------------------------

    def set_active(self, fid: str | None) -> None:
        if fid is not None and self.get_feature(fid) is None:
            # 자동 등록 — status 는 건들지 않음
            self.ensure_feature(fid)
        self.data["session"]["active_feature_id"] = fid

    def remove_feature(self, fid: str) -> bool:
        """state.yaml features[] 에서 해당 항목 제거. 반환: 제거되었으면 True."""
        before = len(self.data["features"])
        self.data["features"] = [
            f for f in self.data["features"]
            if not (isinstance(f, dict) and f.get("id") == fid)
        ]
        removed = len(self.data["features"]) < before
        if removed and self.data["session"].get("active_feature_id") == fid:
            self.data["session"]["active_feature_id"] = None
        return removed

    def features_in_progress(self) -> list[str]:
        """Status == 'in_progress' 인 feature id 목록."""
        out: list[str] = []
        for f in self.data["features"]:
            if isinstance(f, dict) and f.get("status") == "in_progress":
                fid = f.get("id")
                if isinstance(fid, str):
                    out.append(fid)
        return out

    def set_last_command(self, command: str) -> None:
        self.data["session"]["last_command"] = command
        if self.data["session"].get("started_at") is None:
            self.data["session"]["started_at"] = _now()

    # --- summary helpers (for status/check) ------------------------------

    def feature_counts(self) -> dict[str, int]:
        """status 별 피처 수 카운트."""
        counts: dict[str, int] = {s: 0 for s in _FEATURE_STATUSES}
        for f in self.data["features"]:
            if isinstance(f, dict):
                st = f.get("status", "planned")
                if st in counts:
                    counts[st] += 1
        return counts

    def snapshot(self) -> dict:
        """JSON serializable deep copy — `/harness:status --json` 출력용."""
        return copy.deepcopy(self.data)


def is_declared_evidence(ev: Any) -> bool:
    """Return True when an evidence entry counts as a declared signal.

    Declared = human-volition record of verification. Automatic = gate runner
    byproduct. Entries missing ``kind`` are treated as declared (conservative
    — unclassified signals are assumed intentional).

    See ``_AUTOMATIC_EVIDENCE_KINDS`` for the exhaustive automatic list.
    """
    if not isinstance(ev, dict):
        return False
    kind = ev.get("kind")
    if not isinstance(kind, str):
        return True
    return kind not in _AUTOMATIC_EVIDENCE_KINDS


def _parse_ts(value: Any) -> datetime | None:
    """Parse an ISO-8601 ``ts`` field; return None on any failure."""
    if not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def count_declared_evidence(
    feature: dict,
    *,
    window_days: int = IRON_LAW_D_DEFAULT_WINDOW_DAYS,
    now: datetime | None = None,
) -> int:
    """Count declared evidence entries within the trailing time window.

    Iron Law D (v0.9.3): at ``/harness-boot:work --complete`` time, this
    function tallies how many declared signals the feature has accumulated in
    the last ``window_days`` days. Entries with unparseable or missing ``ts``
    are counted as recent (conservative — the absence of a timestamp should
    not penalize the author).

    Args:
        feature: one ``state.yaml.features[]`` dict.
        window_days: trailing window size; defaults to 7.
        now: override clock for tests. Defaults to ``datetime.now(utc)``.

    Returns:
        Integer count of qualifying entries. Always ``>= 0``.
    """
    if not isinstance(feature, dict):
        return 0
    if now is None:
        now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=max(window_days, 0))
    count = 0
    for ev in feature.get("evidence") or []:
        if not is_declared_evidence(ev):
            continue
        ts = _parse_ts(ev.get("ts"))
        if ts is not None and ts < cutoff:
            continue
        count += 1
    return count


__all__ = [
    "State",
    "FeatureStatus",
    "GateResult",
    "is_declared_evidence",
    "count_declared_evidence",
    "IRON_LAW_D_DEFAULT_WINDOW_DAYS",
]
