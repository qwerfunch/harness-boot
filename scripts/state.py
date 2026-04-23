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
from datetime import datetime, timezone
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

    # --- session helpers --------------------------------------------------

    def set_active(self, fid: str | None) -> None:
        if fid is not None and self.get_feature(fid) is None:
            # 자동 등록 — status 는 건들지 않음
            self.ensure_feature(fid)
        self.data["session"]["active_feature_id"] = fid

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


__all__ = ["State", "FeatureStatus", "GateResult"]
