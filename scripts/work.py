#!/usr/bin/env python3
"""
work.py — /harness:work (F-004) 피처 개발 사이클. v0.3 핵심.

사용:
  python3 scripts/work.py F-004                       # F-004 활성화 + Gate 실행 준비
  python3 scripts/work.py F-004 --gate gate_0 pass    # 특정 Gate 결과 기록
  python3 scripts/work.py F-004 --complete            # 모든 Gate 통과 후 done 전이
  python3 scripts/work.py --current                   # active_feature 상태 조회
  python3 scripts/work.py F-004 --evidence "test: 19 pass" --kind test
  python3 scripts/work.py F-004 --block "missing DB" --kind blocker

역할 (v0.3 범위):
  - 피처 선택 / 활성화 (state.yaml.session.active_feature_id 설정)
  - Gate 결과 기록 (state.yaml.features[*].gates)
  - Evidence 수집 (state.yaml.features[*].evidence)
  - 상태 전이: planned → in_progress → (blocked|done)

**v0.3 경계**:
  - 실제 TDD 실행 (pytest 구동, 커버리지 계산 등) 은 사용자/CI 가 담당.
    이 명령은 결과를 **기록·전이** 에 집중.
  - Gate 5 (runtime smoke) 자동 감지도 범위 밖 — 사용자가 명시적으로 통과 선언.
  - v0.4 에서 test runner · gate runner 자동화 검토.

CQS 원칙:
  - read-only 옵션 (--current) 은 파일 수정 없음.
  - 전이/기록 옵션 (--gate, --evidence, --complete) 은 events.log 에 추적 append.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:
    print("pyyaml is required", file=sys.stderr)
    sys.exit(1)

_THIS = Path(__file__).resolve().parent
if str(_THIS) not in sys.path:
    sys.path.insert(0, str(_THIS))


# F-061: User-facing display layer. Internal gate identifiers (gate_0..gate_5,
# gate_perf) stay as-is in state.yaml / CLI / function code; this map provides
# friendly labels for messages the user reads. Format is "friendly (gate_X)".
GATE_FRIENDLY: dict[str, str] = {
    "gate_0": "tests",
    "gate_1": "type check",
    "gate_2": "lint",
    "gate_3": "coverage",
    "gate_4": "commit check",
    "gate_5": "smoke run",
    "gate_perf": "performance",
}


def _friendly_gate(gate_name: str) -> str:
    """Render '<friendly> (<gate_id>)' for a known gate, else passthrough."""
    label = GATE_FRIENDLY.get(gate_name)
    return f"{label} ({gate_name})" if label else gate_name

from ceremonies import design_review as _design_review  # noqa: E402
from ceremonies import kickoff as _kickoff  # noqa: E402
from ceremonies import retro as _retro  # noqa: E402
from scan import area_resolver as _area_resolver  # noqa: E402
from scan import chapter_writer as _chapter_writer  # noqa: E402
from scan import structure as _structure_scan  # noqa: E402
from scan import style_fingerprint as _style_fingerprint  # noqa: E402
from core.project_mode import resolve_mode as _resolve_project_mode  # noqa: E402
from core.state import (  # noqa: E402
    IRON_LAW_WINDOW_DAYS,
    State,
    _FEATURE_STATUSES,
    _GATE_RESULTS,
    count_declared_evidence,
)
from gate import runner as gate_runner  # noqa: E402
from ui import dashboard as _dashboard  # noqa: E402
from ui import intent_planner as _intent_planner  # noqa: E402
from ui.lang import resolve_lang as _resolve_lang  # noqa: E402
from ui.messages import t as _t  # noqa: E402


# F-043 — single source moved to scripts/core/gates.py; this alias is kept
# for backward-compat with any external import.
from core.gates import STANDARD_GATES as _STANDARD_GATES  # noqa: E402

# Iron Law (v0.9.3) — minimum declared evidence count per project mode.
# `product` demands 3 independent human signals in the trailing window so that
# a completion claim is backed by genuine verification, not a single checkbox.
# `prototype` lowers to 1 for exploratory work where rigor would be theater.
# Hotfix override (`--hotfix-reason`) collapses product to 1 but records the
# reason in the evidence trail for audit.
_IRON_LAW_REQUIRED: dict[str, int] = {"prototype": 1, "product": 3}

# F-048 — drift × Iron Law gating. complete() 가 차단 대상으로 보는 drift
# kinds. severity="error" 와 결합돼야 차단된다. *진짜 wire 무결성* 위반만
# 골라서 false-positive 환경 의존성을 피한다 (Generated/Anchor 같은 schema-
# validation 류 error 는 build state 에 따라 발생할 수 있어 차단 대상 아님).
_BLOCKING_DRIFT_KINDS: frozenset[str] = frozenset(
    {"Code", "Stale", "AnchorIntegration"}
)


@dataclass
class WorkResult:
    feature_id: str
    action: str            # activated / gate_recorded / evidence_added / completed / blocked / queried
    current_status: str
    gates_passed: list[str]
    gates_failed: list[str]
    evidence_count: int
    message: str = ""
    # F-038 — populated only when action == "activated" so the user can see
    # which agents are routed for the feature without opening kickoff.md.
    routed_agents: list[str] = field(default_factory=list)
    # F-039 — sub-groups of routed_agents that orchestrator may dispatch in
    # parallel via single-message multi tool use. list[list[str]] (not tuple)
    # for JSON serialization symmetry with routed_agents.
    parallel_groups: list[list[str]] = field(default_factory=list)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _append_event(harness_dir: Path, event: dict) -> None:
    log = harness_dir / "events.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")


def _load_spec(harness_dir: Path) -> dict | None:
    """Return parsed spec.yaml or None when missing/unparseable. Silent — autowire relies on absence to no-op."""
    spec_path = harness_dir / "spec.yaml"
    if not spec_path.is_file():
        return None
    try:
        data = yaml.safe_load(spec_path.read_text(encoding="utf-8"))
    except yaml.YAMLError:
        return None
    return data if isinstance(data, dict) else None


def _find_feature(spec: dict, fid: str) -> dict | None:
    for f in spec.get("features") or []:
        if isinstance(f, dict) and f.get("id") == fid:
            return f
    return None


def _autowire_fog_clear(
    harness_dir: Path,
    fid: str,
    *,
    disable: bool = False,
    force: bool = False,
) -> None:
    """F-037 Layer B fog-of-war reconnaissance hook.

    Per-feature reconnaissance of ``feature.modules[]`` paths. Writes one
    chapter file per resolved area into ``.harness/chapters/area-<slug>.md``
    and updates ``.harness/area_index.yaml`` (canonical persistence — kept
    as a side file so spec.yaml stays comment-stable). Emits a single
    ``fog_cleared`` event into events.log.

    Silent-swallows like sibling autowires. Guards (in order):
        1. ``--no-fog`` argument or spec.metadata.fog.disabled == true.
        2. spec.yaml resolves; feature resolves.
        3. feature.modules[] non-empty.
        4. Idempotency: when the previous fog_cleared event for ``fid`` covers
           the same set of area slugs and the chapters are already byte-identical,
           skip emitting a new event.
    """
    try:
        if disable:
            return
        spec = _load_spec(harness_dir)
        if spec is None:
            return
        fog_cfg = (spec.get("metadata") or {}).get("fog") or {}
        if fog_cfg.get("disabled") is True and not force:
            return
        feature = _find_feature(spec, fid)
        if feature is None:
            return
        if not (feature.get("modules") or []):
            return

        project_root = Path(harness_dir).resolve().parent
        structure = _structure_scan.scan_structure(project_root)
        areas = _area_resolver.resolve_areas(
            feature, project_root=project_root, structure=structure
        )
        if not areas:
            return
        style = _style_fingerprint.fingerprint(project_root)

        timestamp = _now_iso()
        for area in areas:
            _chapter_writer.write_chapter(
                harness_dir,
                area=area,
                style=style,
                feature_id=fid,
                timestamp=timestamp,
            )

        slugs = sorted(area.slug for area in areas)
        _update_area_index(harness_dir, areas=areas, timestamp=timestamp)

        if not force and _fog_event_already_emitted(harness_dir, fid, slugs):
            return

        _append_event(
            harness_dir,
            {
                "ts": timestamp,
                "type": "fog_cleared",
                "feature": fid,
                "areas": slugs,
                "modules": [m for area in areas for m in area.modules],
            },
        )
    except Exception:
        return


def _update_area_index(harness_dir: Path, *, areas, timestamp: str) -> None:
    """Idempotently merge ``areas`` into .harness/area_index.yaml side file.

    User-edited entries (``_provenance.confidence == "user"``) are preserved
    verbatim. Generated entries refresh ``last_scanned_ts`` only.
    """
    index_path = Path(harness_dir) / "area_index.yaml"
    existing: dict = {"schema_version": "1.0", "areas": []}
    if index_path.is_file():
        try:
            loaded = yaml.safe_load(index_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                existing = loaded
                existing.setdefault("schema_version", "1.0")
                existing.setdefault("areas", [])
        except yaml.YAMLError:
            pass

    by_slug = {entry.get("slug"): entry for entry in existing.get("areas", []) if isinstance(entry, dict)}

    for area in areas:
        prior = by_slug.get(area.slug)
        if prior and (prior.get("_provenance") or {}).get("confidence") == "user":
            continue
        merged = {
            "slug": area.slug,
            "label": area.label,
            "modules": list(area.modules),
            "paths": list(area.paths),
            "chapter_path": f"chapters/area-{area.slug}.md",
            "last_scanned_ts": timestamp,
            "first_seen_feature_id": prior.get("first_seen_feature_id") if prior else area.feature_id,
            "_provenance": {"confidence": "generated"},
        }
        by_slug[area.slug] = merged

    existing["areas"] = sorted(by_slug.values(), key=lambda entry: entry["slug"])

    index_path.write_text(
        yaml.safe_dump(existing, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )


def _fog_event_already_emitted(harness_dir: Path, fid: str, slugs: list[str]) -> bool:
    log = Path(harness_dir) / "events.log"
    if not log.is_file():
        return False
    try:
        for raw in log.read_text(encoding="utf-8").splitlines():
            if not raw.strip():
                continue
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if event.get("type") != "fog_cleared":
                continue
            if event.get("feature") != fid:
                continue
            if sorted(event.get("areas") or []) == slugs:
                return True
    except OSError:
        return False
    return False


def _autowire_kickoff(harness_dir: Path, fid: str, *, force: bool = False) -> None:
    """Fire kickoff ceremony when spec.yaml + feature resolve. Never raises — activate must not fail on ceremony errors.

    Idempotency (v0.8.2): ``kickoff.generate_kickoff`` returns without
    rewriting when the kickoff.md file already exists. Pass ``force=True``
    (via ``--kickoff`` CLI flag) to explicitly re-generate and overwrite
    any user curation.

    Mode-aware (v0.9.6): passes ``spec.project.mode`` so prototype mode
    renders the slim 1-bullet-per-agent variant.
    """
    spec = _load_spec(harness_dir)
    if spec is None:
        return
    feature = _find_feature(spec, fid)
    if feature is None:
        return
    try:
        shapes = _kickoff.detect_shapes(feature, spec=spec)
        if not shapes:
            return
        style_block = ""
        try:
            style_block = _kickoff._render_style_block(harness_dir, feature)
        except Exception:
            style_block = ""
        _kickoff.generate_kickoff(
            harness_dir,
            feature_id=fid,
            shapes=shapes,
            has_audio=_kickoff.has_audio(feature),
            force=force,
            mode=_resolve_project_mode(spec),
            style_block=style_block,
        )
    except Exception:
        return


def _autowire_retro(harness_dir: Path, fid: str, *, force: bool = False) -> None:
    """Fire retro ceremony after complete. Silent skip when spec.yaml missing (symmetry with kickoff).

    Idempotency (v0.8.7): ``retro.generate_retro`` is idempotent via file-exists
    check. Pass ``force=True`` (via ``--retro`` CLI flag) to explicitly
    re-generate and overwrite any user curation of the retro prose.

    Mode-aware (v0.9.6): prototype renders only machine-extractable sections.
    """
    spec = _load_spec(harness_dir)
    if spec is None:
        return
    try:
        _retro.generate_retro(
            harness_dir,
            feature_id=fid,
            force=force,
            mode=_resolve_project_mode(spec),
        )
    except Exception:
        return


def _autowire_design_review(
    harness_dir: Path,
    fid: str,
    *,
    force: bool = False,
) -> None:
    """Fire design-review ceremony when ux-architect has delivered flows.md (v0.8).

    Four AND conditions for auto-fire:
      1. features[F-N].ui_surface.present == true (design-review has meaning only for UI features).
      2. .harness/_workspace/design/flows.md exists (ux-architect delivered upstream).
      3. .harness/_workspace/design-review/F-N.md does NOT exist (idempotent — once per feature).
      4. ``spec.project.mode != "prototype"`` (v0.9.6 — prototype skips the autowire entirely;
         users can still force generation via ``--design-review``).

    ``force=True`` overrides conditions (3) and (4) for explicit ``--design-review`` flag
    retries. All other checks still apply; no amount of forcing will emit a design-review
    for a feature without UI.

    Silent-swallows exceptions like kickoff/retro autowires — a ceremony glitch must not fail
    activate/record_gate/add_evidence.
    """
    spec = _load_spec(harness_dir)
    if spec is None:
        return
    feature = _find_feature(spec, fid)
    if feature is None:
        return
    ui = feature.get("ui_surface") or {}
    if ui.get("present") is not True:
        return
    flows_path = harness_dir / "_workspace" / "design" / "flows.md"
    if not flows_path.is_file():
        return
    review_path = harness_dir / "_workspace" / "design-review" / f"{fid}.md"
    if review_path.is_file() and not force:
        return
    if _resolve_project_mode(spec) == "prototype" and not force:
        return
    try:
        _design_review.generate_design_review(
            harness_dir,
            feature_id=fid,
            has_audio=_kickoff.has_audio(feature),
        )
    except Exception:
        return


def _format_performance_budget(budget: dict) -> str:
    """Performance budget dict → compact one-line summary for evidence entries (v0.7.3)."""
    if not isinstance(budget, dict) or not budget:
        return ""
    parts: list[str] = []
    standard = ("lcp_ms", "inp_ms", "cls", "bundle_kb", "latency_p95_ms", "memory_rss_mb")
    for key in standard:
        if key in budget:
            parts.append(f"{key}={budget[key]}")
    custom = budget.get("custom") or []
    if isinstance(custom, list):
        for entry in custom:
            if isinstance(entry, dict) and "metric" in entry and "budget" in entry:
                parts.append(f"{entry['metric']}={entry['budget']}")
    return " · ".join(parts)


def _summarize(state: State, fid: str) -> WorkResult:
    f = state.get_feature(fid) or {}
    gates = f.get("gates", {}) or {}
    passed = [g for g, v in gates.items() if isinstance(v, dict) and v.get("last_result") == "pass"]
    failed = [g for g, v in gates.items() if isinstance(v, dict) and v.get("last_result") == "fail"]
    return WorkResult(
        feature_id=fid,
        action="queried",
        current_status=f.get("status", "planned"),
        gates_passed=passed,
        gates_failed=failed,
        evidence_count=len(f.get("evidence", []) or []),
    )


def _warn_if_ghost(harness_dir: Path, fid: str) -> None:
    """spec.yaml 은 있으나 fid 가 그 안에 없으면 stderr 경고 — v0.7.1 UX gap #1."""
    spec = _load_spec(harness_dir)
    if spec is None:
        return
    if _find_feature(spec, fid) is None:
        print(
            f"warn: {fid} not defined in spec.yaml — proceeding as ghost feature. "
            f"Use /harness:spec to register it or `--remove {fid}` to undo.",
            file=sys.stderr,
        )


def _warn_if_concurrent(state: State, fid: str) -> None:
    """다른 피처가 in_progress 인 채로 새 피처 activate 시 경고 — v0.7.1 UX gap #2."""
    others = [f for f in state.features_in_progress() if f != fid]
    if others:
        print(
            f"warn: other feature(s) still in_progress: {', '.join(others)}. "
            f"Finish or block before switching, or ignore to work in parallel.",
            file=sys.stderr,
        )


def activate(harness_dir: Path, fid: str, *, disable_fog: bool = False) -> WorkResult:
    """피처를 active 로 설정 + planned → in_progress 전이.

    ``disable_fog`` (CLI ``--no-fog``) skips the F-037 Layer B reconnaissance
    autowire — useful for greenfield projects or when the user wants a quiet
    activate. Other autowires (kickoff, design-review) are unaffected.
    """
    state = State.load(harness_dir)
    f = state.ensure_feature(fid)
    if f.get("status") == "done":
        res = _summarize(state, fid)
        res.action = "queried"
        res.message = f"{fid} is already done — no re-activation"
        return res

    _warn_if_ghost(harness_dir, fid)
    _warn_if_concurrent(state, fid)

    state.set_active(fid)
    if f.get("status") in (None, "planned"):
        state.set_status(fid, "in_progress")
    state.set_last_command(f"/harness:work {fid}")
    state.save()

    _append_event(
        harness_dir,
        {
            "ts": _now_iso(),
            "type": "feature_activated",
            "feature": fid,
            "status": state.get_feature(fid)["status"],
        },
    )
    _autowire_fog_clear(harness_dir, fid, disable=disable_fog)
    _autowire_kickoff(harness_dir, fid)
    _autowire_design_review(harness_dir, fid)
    res = _summarize(state, fid)
    res.action = "activated"
    res.routed_agents, res.parallel_groups = _resolve_routing(harness_dir, fid)
    return res


def _resolve_routing(harness_dir: Path, fid: str) -> tuple[list[str], list[list[str]]]:
    """F-038 + F-039 — surface the kickoff agent chain and its parallel groups.

    Mirrors what ``_autowire_kickoff`` already computes (so the rendered
    kickoff.md and the user-visible routed list cannot drift). Returns
    ``([], [])`` when spec / feature missing or no shapes match — same silent
    semantics as the autowires.
    """
    spec = _load_spec(harness_dir)
    if spec is None:
        return [], []
    feature = _find_feature(spec, fid)
    if feature is None:
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


def deactivate(harness_dir: Path) -> WorkResult:
    """session.active_feature_id 만 None 으로. 피처 status 는 유지 — v0.7.1."""
    state = State.load(harness_dir)
    fid = state.data["session"].get("active_feature_id")
    if not fid:
        return WorkResult(
            feature_id="",
            action="queried",
            current_status="",
            gates_passed=[],
            gates_failed=[],
            evidence_count=0,
            message="no active feature to deactivate",
        )
    state.set_active(None)
    state.save()
    _append_event(
        harness_dir,
        {
            "ts": _now_iso(),
            "type": "feature_deactivated",
            "feature": fid,
        },
    )
    res = _summarize(state, fid)
    res.action = "deactivated"
    return res


def remove_feature(harness_dir: Path, fid: str) -> WorkResult:
    """state.yaml features[] 에서 항목 삭제. done 피처는 보호 — v0.7.1."""
    state = State.load(harness_dir)
    f = state.get_feature(fid)
    if f is None:
        return WorkResult(
            feature_id=fid,
            action="queried",
            current_status="",
            gates_passed=[],
            gates_failed=[],
            evidence_count=0,
            message=f"{fid} not in state — nothing to remove",
        )
    if f.get("status") == "done":
        res = _summarize(state, fid)
        res.action = "queried"
        res.message = f"cannot remove {fid} — feature is done (audit trail protected)"
        return res
    state.remove_feature(fid)
    state.save()
    _append_event(
        harness_dir,
        {
            "ts": _now_iso(),
            "type": "feature_removed",
            "feature": fid,
            "prior_status": f.get("status"),
        },
    )
    return WorkResult(
        feature_id=fid,
        action="removed",
        current_status="",
        gates_passed=[],
        gates_failed=[],
        evidence_count=0,
        message=f"{fid} removed from state",
    )


def record_gate(
    harness_dir: Path,
    fid: str,
    gate_name: str,
    result: str,
    *,
    note: str = "",
) -> WorkResult:
    if result not in _GATE_RESULTS:
        raise ValueError(f"invalid gate result {result!r}")
    state = State.load(harness_dir)
    state.ensure_feature(fid)
    state.record_gate_result(fid, gate_name, result, note=note)
    state.save()

    _append_event(
        harness_dir,
        {
            "ts": _now_iso(),
            "type": "gate_recorded",
            "feature": fid,
            "gate": gate_name,
            "result": result,
            "note": note,
        },
    )
    _autowire_design_review(harness_dir, fid)
    res = _summarize(state, fid)
    res.action = "gate_recorded"
    return res


def add_evidence(harness_dir: Path, fid: str, kind: str, summary: str) -> WorkResult:
    state = State.load(harness_dir)
    state.add_evidence(fid, kind=kind, summary=summary)
    state.save()

    _append_event(
        harness_dir,
        {
            "ts": _now_iso(),
            "type": "evidence_added",
            "feature": fid,
            "kind": kind,
            "summary": summary,
        },
    )
    _autowire_design_review(harness_dir, fid)
    res = _summarize(state, fid)
    res.action = "evidence_added"
    return res


def block(harness_dir: Path, fid: str, reason: str, *, kind: str = "blocker") -> WorkResult:
    state = State.load(harness_dir)
    state.ensure_feature(fid)
    state.set_status(fid, "blocked")
    state.add_evidence(fid, kind=kind, summary=reason)
    state.save()

    _append_event(
        harness_dir,
        {
            "ts": _now_iso(),
            "type": "feature_blocked",
            "feature": fid,
            "reason": reason,
        },
    )
    res = _summarize(state, fid)
    res.action = "blocked"
    res.message = reason
    return res


def complete(
    harness_dir: Path,
    fid: str,
    *,
    hotfix_reason: str | None = None,
) -> WorkResult:
    """done 전이. Iron Law (v0.9.3) — gate_5 pass + 누적 declared evidence.

    Iron Law (BR-004 강화):
      - ``gate_5.last_result == "pass"`` 필수.
      - 최근 7 일 declared evidence (kind != ``gate_run`` / ``gate_auto_run``)
        개수 ≥ mode-specific 요구치.
        - ``prototype`` mode: 1 개.
        - ``product`` mode (default): 3 개.
      - ``hotfix_reason`` 제공 시: product 모드도 1 개 허용. 사유를 ``kind=
        hotfix`` 로 evidence 에 append 하여 audit trail 에 남김 (이 hotfix
        evidence 자체가 declared 1 개로 카운트 됨).

    Idempotency (v0.8.7): 이미 ``status=done`` 인 피처에 재호출하면 no-op +
    ``queried`` 반환. feature_done event 중복 발화 없음 · retro autowire
    재실행 없음.
    """
    state = State.load(harness_dir)
    f = state.ensure_feature(fid)
    if f.get("status") == "done":
        res = _summarize(state, fid)
        res.action = "queried"
        res.message = f"{fid} is already done — no re-completion"
        return res
    gates = f.get("gates", {}) or {}
    gate5 = gates.get("gate_5", {})
    if not (isinstance(gate5, dict) and gate5.get("last_result") == "pass"):
        res = _summarize(state, fid)
        res.action = "queried"
        res.message = f"cannot complete — {_friendly_gate('gate_5')} is not PASS yet"
        return res

    # F-048 — drift × Iron Law gating. severity="error" 이면서 *진짜 wire
    # 누락* 종류 (Code · Stale · AnchorIntegration) 의 finding 이 1+ 시
    # complete 차단. hotfix_reason 으로 override 가능 (기존 emergency escape
    # hatch 와 같음). prototype/product mode 무관 — wire 무결성은 mode 가
    # 약화시키지 않음.
    #
    # **Why narrow set, not all error severities**: Generated/Spec/Anchor 같은
    # 환경/스키마 검증 error 는 build 환경에 따라 false-positive 가능 (예:
    # harness.yaml 미생성). Code (modules.source 부재) · Stale (done 인데
    # src 어디서도 미참조) · AnchorIntegration (E2E 미통합) 은 "선언된 done
    # 인데 실제 코드 베이스가 그걸 wire 하지 않은" 직접 무결성 위반이라
    # complete 차단의 의미가 명확하다. 다른 kinds 는 `python3 scripts/check.py`
    # 가 보고하지만 차단 X — F-051 (drift severity ranking 정밀화) 에서
    # Critical/High/Medium/Low 4 단계로 일반화.
    #
    # Best-effort: malformed spec / IO 에러 등 check.py 실행 실패 시 silent
    # fallback. gate_5 가 이미 runtime smoke 를 증명했으므로 drift 검증이
    # fragile 한 환경에서 complete 흐름을 막지 않는다.
    if not hotfix_reason:
        try:
            from check import run_check  # local import — work.py / check.py 동거
            drift_report = run_check(harness_dir)
            blocking = [
                d for d in drift_report.findings
                if d.severity == "error" and d.kind in _BLOCKING_DRIFT_KINDS
            ]
            if blocking:
                res = _summarize(state, fid)
                res.action = "queried"
                kinds = sorted({d.kind for d in blocking})
                res.message = (
                    f"cannot complete — {len(blocking)} blocking drift(s) "
                    f"({', '.join(kinds)}). Run "
                    f"`python3 scripts/check.py --harness-dir {harness_dir}` "
                    f"for details, fix, or use `--hotfix-reason` for emergency."
                )
                return res
        except Exception:
            pass

    spec = _load_spec(harness_dir)
    mode = _resolve_project_mode(spec)
    required_default = _IRON_LAW_REQUIRED[mode]
    required = 1 if hotfix_reason else required_default

    # v0.10.3 — product mode strict: any declared gate currently failing blocks
    # completion. cosmic-suika I-008 surfaced that the prior contract
    # (gate_5 pass + declared evidence) let gate_2 (lint) fail slip through.
    # Prototype keeps the lighter contract — recorded fails do not block.
    # hotfix_reason still bypasses, since emergency overrides leave their own
    # audit trail via the `hotfix` evidence kind.
    if mode == "product" and not hotfix_reason:
        failed_gates = sorted(
            g for g, v in gates.items()
            if isinstance(v, dict) and v.get("last_result") == "fail"
        )
        if failed_gates:
            res = _summarize(state, fid)
            res.action = "queried"
            res.message = (
                f"cannot complete — product mode strict: declared gate(s) failing — "
                f"{', '.join(failed_gates)}. Re-run with --run-gate after fixing, "
                f"or use --hotfix-reason for emergency override."
            )
            return res

    # Hotfix evidence is recorded *before* the count so the reason itself
    # contributes toward the 1-declared floor. Without this the caller would
    # need to add a prior evidence entry, defeating the "emergency shortcut"
    # intent. The hotfix kind is declared (not in the automatic set).
    if hotfix_reason and not str(hotfix_reason).strip():
        return WorkResult(
            feature_id=fid,
            action="queried",
            current_status=f.get("status", "planned"),
            gates_passed=[g for g, v in gates.items() if isinstance(v, dict) and v.get("last_result") == "pass"],
            gates_failed=[g for g, v in gates.items() if isinstance(v, dict) and v.get("last_result") == "fail"],
            evidence_count=len(f.get("evidence") or []),
            message="hotfix reason cannot be empty — describe the emergency briefly",
        )
    if hotfix_reason:
        state.add_evidence(fid, kind="hotfix", summary=str(hotfix_reason).strip())
        # Reload the feature dict — add_evidence mutates state in place, but
        # we want count_declared_evidence to see the new entry.
        f = state.get_feature(fid) or f

    declared = count_declared_evidence(
        f, window_days=IRON_LAW_WINDOW_DAYS,
    )
    if declared < required:
        # Keep state.yaml untouched on reject. If hotfix added an entry above
        # we must roll it back so a rejection does not leave noise.
        if hotfix_reason:
            evidence_list = f.get("evidence") or []
            if evidence_list:
                evidence_list.pop()
            state.save()
        res = _summarize(state, fid)
        res.action = "queried"
        reason_suffix = f", hotfix" if hotfix_reason else ""
        res.message = (
            f"cannot complete — Iron Law: {declared}/{required} declared evidence "
            f"in last {IRON_LAW_WINDOW_DAYS} days (mode: {mode}{reason_suffix}). "
            f"Add more with --evidence, or use --hotfix-reason for emergency override."
        )
        return res

    state.set_status(fid, "done")
    # active 해제
    if state.data["session"].get("active_feature_id") == fid:
        state.set_active(None)
    state.save()

    event = {
        "ts": _now_iso(),
        "type": "feature_done",
        "feature": fid,
        "iron_law_mode": mode,
        "declared_count": declared,
        "required": required,
    }
    if hotfix_reason:
        event["hotfix_reason"] = str(hotfix_reason).strip()
    _append_event(harness_dir, event)
    _autowire_retro(harness_dir, fid)
    res = _summarize(state, fid)
    res.action = "completed"
    return res


def archive(
    harness_dir: Path,
    fid: str,
    *,
    superseded_by: str | None = None,
    reason: str | None = None,
) -> WorkResult:
    """v0.10 — done → archived 전이 (two-layer model 의 lifecycle 측면).

    spec 은 additive (피처 절대 삭제 X) · code 는 replacement 자유. 그 사이의
    "이미 shipped 됐지만 더 이상 살아있지 않은" 상태가 archived. ADR
    supersedes 와 동일한 의미적 표기를 features 에도 부여한다.

    조건:
      - 피처는 ``status == "done"`` 이어야 함. 미완료 피처를 archived 로 보낼
        수 없음 (Iron Law audit chain 의 의미 유지).
      - ``superseded_by`` 가 명시되면 spec.yaml features[] 에 실재해야 하고,
        대상 피처가 자기 자신이 아니어야 함.
      - ``reason`` 은 권장. 없으면 events.log 에 빈 reason 기록 (retro 가 약한
        품질 신호로 표시).

    Idempotency: 이미 archived 인 피처는 no-op + ``queried`` 반환. 재실행으로
    중복 이벤트가 생기지 않음.

    Side effects:
      - state.yaml: status → archived
      - events.log: ``{type: feature_archived, feature, superseded_by, reason, ts}``
      - retro autowire (F-028 가 archived 피처를 인식해 "Superseded By" 섹션
        자동 채움)
    """
    state = State.load(harness_dir)
    f = state.ensure_feature(fid)
    current_status = f.get("status")

    if current_status == "archived":
        res = _summarize(state, fid)
        res.action = "queried"
        res.message = f"{fid} is already archived — no re-archive"
        return res

    if current_status != "done":
        res = _summarize(state, fid)
        res.action = "queried"
        res.message = (
            f"cannot archive — {fid}.status={current_status!r}. "
            f"Only 'done' features can be archived (shipped is shipped)."
        )
        return res

    if superseded_by is not None:
        sb = str(superseded_by).strip()
        if not sb:
            res = _summarize(state, fid)
            res.action = "queried"
            res.message = "--superseded-by cannot be empty"
            return res
        if sb == fid:
            res = _summarize(state, fid)
            res.action = "queried"
            res.message = f"--superseded-by cannot reference self ({fid})"
            return res
        spec = _load_spec(harness_dir) or {}
        spec_ids = {
            entry.get("id")
            for entry in (spec.get("features") or [])
            if isinstance(entry, dict)
        }
        if sb not in spec_ids:
            res = _summarize(state, fid)
            res.action = "queried"
            res.message = (
                f"--superseded-by {sb} not found in spec.yaml features[]. "
                f"Add the replacement feature to spec first."
            )
            return res
        superseded_by = sb

    state.set_status(fid, "archived")
    if state.data["session"].get("active_feature_id") == fid:
        state.set_active(None)
    state.save()

    event: dict = {
        "ts": _now_iso(),
        "type": "feature_archived",
        "feature": fid,
    }
    if superseded_by:
        event["superseded_by"] = superseded_by
    if reason:
        event["reason"] = str(reason).strip()
    _append_event(harness_dir, event)
    _autowire_retro(harness_dir, fid, force=True)

    res = _summarize(state, fid)
    res.action = "archived"
    suffix_parts = []
    if superseded_by:
        suffix_parts.append(f"superseded_by={superseded_by}")
    if reason:
        suffix_parts.append(f"reason={str(reason).strip()!r}")
    suffix = f" ({', '.join(suffix_parts)})" if suffix_parts else ""
    res.message = f"{fid} archived{suffix}"
    return res


def current(harness_dir: Path) -> WorkResult | None:
    """현재 active feature 조회. active 없으면 None."""
    state = State.load(harness_dir)
    fid = state.data["session"].get("active_feature_id")
    if not fid:
        return None
    res = _summarize(state, fid)
    res.action = "queried"
    return res


def dashboard_snapshot(harness_dir: Path) -> dict:
    """Build the no-args dashboard snapshot (CQS — read-only).

    v0.9.2 — Returns a dict consumable by ``ui.dashboard.render`` as well as
    JSON callers. Does not touch any file on disk. Used by ``main()`` when
    ``scripts/work.py`` is invoked without a feature id.
    """
    state = State.load(harness_dir)
    spec = _load_spec(harness_dir)
    suggestions = _intent_planner.suggest(state.data, spec)
    return {
        "state": state.data,
        "spec": spec,
        "suggestions": suggestions,
        "counts": state.feature_counts(),
        "active_feature_id": state.data["session"].get("active_feature_id"),
    }


def run_and_record_gate(
    harness_dir: Path,
    fid: str,
    gate_name: str,
    *,
    project_root: Path | None = None,
    override_command: list[str] | None = None,
    timeout_sec: int = 300,
    add_evidence_on_pass: bool = True,
) -> WorkResult:
    """gate_runner 로 Gate 실행 → 결과 + 요약을 state 에 기록 + events.log append.

    project_root: 테스트 러너가 돌 디렉터리. 기본은 harness_dir 의 부모.
    """
    if project_root is None:
        project_root = harness_dir.parent

    run_result = gate_runner.run_gate(
        gate_name,
        project_root,
        override_command=override_command,
        harness_dir=harness_dir,
        timeout_sec=timeout_sec,
    )

    # skipped 도 state 에 기록 — 진행 중 흔적 남기기
    state = State.load(harness_dir)
    state.ensure_feature(fid)
    note = run_result.reason or ("cmd: " + " ".join(run_result.command) if run_result.command else "")
    # 'skipped' 는 state 의 GateResult 값 중 하나 — 그대로 pass 가능
    state.record_gate_result(fid, gate_name, run_result.result, note=note)

    if run_result.result == "pass" and add_evidence_on_pass:
        summary = f"Gate {gate_name} pass ({run_result.duration_sec:.1f}s)"
        if run_result.command:
            summary += " · cmd: " + " ".join(run_result.command)
        if gate_name == "gate_perf":
            spec = _load_spec(harness_dir)
            feature = _find_feature(spec, fid) if spec else None
            budget_summary = _format_performance_budget(
                (feature or {}).get("performance_budget") or {}
            )
            if budget_summary:
                summary += f" · budget: {budget_summary}"
        state.add_evidence(fid, kind="gate_run", summary=summary)

    state.save()

    _append_event(
        harness_dir,
        {
            "ts": _now_iso(),
            "type": "gate_auto_run",
            "feature": fid,
            "gate": gate_name,
            "result": run_result.result,
            "exit_code": run_result.exit_code,
            "duration_sec": round(run_result.duration_sec, 3),
            "reason": run_result.reason,
        },
    )
    _autowire_design_review(harness_dir, fid)

    res = _summarize(state, fid)
    res.action = "gate_auto_run"
    res.message = (
        f"{_friendly_gate(gate_name)} {run_result.result.upper()}"
        + (f" — {run_result.reason}" if run_result.reason else "")
    )
    return res


def _result_to_dict(r: WorkResult) -> dict:
    return {
        "feature_id": r.feature_id,
        "action": r.action,
        "current_status": r.current_status,
        "gates_passed": r.gates_passed,
        "gates_failed": r.gates_failed,
        "evidence_count": r.evidence_count,
        "message": r.message,
        "routed_agents": r.routed_agents,
        "parallel_groups": r.parallel_groups,
    }


def format_human(r: WorkResult, *, lang: str | None = None) -> str:
    """Render WorkResult for the user. F-040 — labels are localized via the
    messages catalog. Pass ``lang`` to override the auto-resolved value (used
    by tests); production callers leave it ``None`` so the resolver picks up
    ``HARNESS_LANG`` / ``spec.project.language`` / system locale.
    """
    if lang is None:
        lang = _resolve_lang()
    lines = [f"🛠  /harness:work · {r.action} · {r.feature_id}", ""]
    lines.append(f"{_t('status', lang=lang)}: {r.current_status}")
    if r.gates_passed:
        lines.append(f"{_t('passed', lang=lang)}: {', '.join(r.gates_passed)}")
    if r.gates_failed:
        lines.append(f"{_t('failed', lang=lang)}: {', '.join(r.gates_failed)}")
    lines.append(_t("evidence", lang=lang, n=r.evidence_count))
    if r.action == "activated" and r.routed_agents:
        chain = _render_agent_chain(r.routed_agents, r.parallel_groups)
        lines.append(f"{_t('routed_agents', lang=lang)}: {chain}")
    if r.message:
        lines.append("")
        lines.append(r.message)
    return "\n".join(lines) + "\n"


# F-043 — _render_agent_chain moved to scripts/ui/render.py for shared
# use across work.py and dashboard.py. This alias preserves backward-compat
# with existing call sites and tests.
from ui.render import render_agent_chain as _render_agent_chain  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="/harness:work (F-004) — feature cycle")
    parser.add_argument("feature", nargs="?", help="feature id (e.g. F-004)")
    parser.add_argument("--harness-dir", type=Path, default=Path.cwd() / ".harness")
    parser.add_argument("--current", action="store_true", help="show active feature")
    parser.add_argument(
        "--gate", nargs=2, metavar=("NAME", "RESULT"), help="record gate result (pass/fail/skipped)"
    )
    parser.add_argument(
        "--run-gate",
        metavar="NAME",
        default=None,
        help="auto-run gate (v0.3.1: gate_0) and record result + evidence",
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=None,
        help="cwd for --run-gate (default: harness-dir parent)",
    )
    parser.add_argument(
        "--override-command",
        default=None,
        help="override gate command (space-separated)",
    )
    parser.add_argument("--timeout", type=int, default=300, help="timeout for --run-gate")
    parser.add_argument("--note", default="", help="note for --gate")
    parser.add_argument(
        "--evidence", default=None, help="add evidence with this summary"
    )
    parser.add_argument(
        "--kind",
        default="generic",
        help=(
            "kind for --evidence or --block (free string; conventional values: "
            "test, manual_check, user_feedback, reviewer_check, blocker, hotfix, "
            "generic, trivial). 'trivial' (v0.10.7, cosmic-suika I-006) marks a "
            "tiny change for the audit reader — does NOT exempt Iron Law, "
            "still counts toward the declared evidence threshold."
        ),
    )
    parser.add_argument(
        "--block", default=None, help="block feature with this reason"
    )
    parser.add_argument(
        "--complete", action="store_true", help="transition to done (requires gate_5 pass + Iron Law declared evidence)"
    )
    parser.add_argument(
        "--hotfix-reason",
        default=None,
        help="Iron Law hotfix override (v0.9.3): collapse product mode to 1 declared evidence. Reason is logged as kind=hotfix evidence. Use for true emergencies only — audit trail records the reason.",
    )
    parser.add_argument(
        "--deactivate",
        action="store_true",
        help="clear session.active_feature_id without changing feature status (v0.7.1)",
    )
    parser.add_argument(
        "--design-review",
        action="store_true",
        help="force re-generate .harness/_workspace/design-review/F-N.md (v0.8 — overrides idempotent skip)",
    )
    parser.add_argument(
        "--kickoff",
        action="store_true",
        help="force re-generate .harness/_workspace/kickoff/F-N.md (v0.8.2 — overrides idempotent skip)",
    )
    parser.add_argument(
        "--retro",
        action="store_true",
        help="force re-generate .harness/_workspace/retro/F-N.md (v0.8.7 — overrides idempotent skip)",
    )
    parser.add_argument(
        "--remove",
        metavar="FID",
        default=None,
        help="delete feature entry from state.yaml (ghost cleanup). done features protected. (v0.7.1)",
    )
    parser.add_argument(
        "--archive",
        action="store_true",
        help="v0.10 — transition a done feature to archived (e.g., when superseded by a pivot). Use --superseded-by F-N + --reason for audit clarity.",
    )
    parser.add_argument(
        "--superseded-by",
        dest="superseded_by",
        default=None,
        help="v0.10 — paired with --archive: feature id (F-N) that replaces this one.",
    )
    parser.add_argument(
        "--reason",
        default=None,
        help="v0.10 — paired with --archive: short reason / pivot summary recorded in events.log.",
    )
    parser.add_argument(
        "--no-fog",
        action="store_true",
        help="F-037 — disable Layer B fog-clear for this activate (no chapter, no event, no kickoff style block).",
    )
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    if not args.harness_dir.is_dir():
        print(f"error: {args.harness_dir} not found", file=sys.stderr)
        return 2

    try:
        if args.current:
            res = current(args.harness_dir)
            if res is None:
                out = {"message": "no active feature"}
                if args.json:
                    json.dump(out, sys.stdout, indent=2)
                    print()
                else:
                    print("no active feature")
                return 0
        elif args.deactivate:
            res = deactivate(args.harness_dir)
        elif args.remove:
            res = remove_feature(args.harness_dir, args.remove)
        elif args.design_review:
            if not args.feature:
                print("error: feature id required with --design-review", file=sys.stderr)
                return 2
            _autowire_design_review(args.harness_dir, args.feature, force=True)
            res = _summarize(State.load(args.harness_dir), args.feature)
            res.action = "design_review_refreshed"
        elif args.kickoff:
            if not args.feature:
                print("error: feature id required with --kickoff", file=sys.stderr)
                return 2
            _autowire_kickoff(args.harness_dir, args.feature, force=True)
            res = _summarize(State.load(args.harness_dir), args.feature)
            res.action = "kickoff_refreshed"
        elif args.retro:
            if not args.feature:
                print("error: feature id required with --retro", file=sys.stderr)
                return 2
            _autowire_retro(args.harness_dir, args.feature, force=True)
            res = _summarize(State.load(args.harness_dir), args.feature)
            res.action = "retro_refreshed"
        elif args.gate:
            if not args.feature:
                print("error: feature id required with --gate", file=sys.stderr)
                return 2
            res = record_gate(
                args.harness_dir, args.feature, args.gate[0], args.gate[1], note=args.note
            )
        elif args.run_gate:
            if not args.feature:
                print("error: feature id required with --run-gate", file=sys.stderr)
                return 2
            override = args.override_command.split() if args.override_command else None
            res = run_and_record_gate(
                args.harness_dir,
                args.feature,
                args.run_gate,
                project_root=args.project_root,
                override_command=override,
                timeout_sec=args.timeout,
            )
        elif args.evidence:
            if not args.feature:
                print("error: feature id required with --evidence", file=sys.stderr)
                return 2
            res = add_evidence(args.harness_dir, args.feature, args.kind, args.evidence)
        elif args.block:
            if not args.feature:
                print("error: feature id required with --block", file=sys.stderr)
                return 2
            res = block(args.harness_dir, args.feature, args.block, kind=args.kind)
        elif args.complete:
            if not args.feature:
                print("error: feature id required with --complete", file=sys.stderr)
                return 2
            res = complete(
                args.harness_dir,
                args.feature,
                hotfix_reason=args.hotfix_reason,
            )
        elif args.archive:
            if not args.feature:
                print("error: feature id required with --archive", file=sys.stderr)
                return 2
            res = archive(
                args.harness_dir,
                args.feature,
                superseded_by=args.superseded_by,
                reason=args.reason,
            )
        else:
            if not args.feature:
                # v0.9.2 — no-args 진입점 = 대시보드 (CQS · 읽기 전용).
                snap = dashboard_snapshot(args.harness_dir)
                if args.json:
                    out = {
                        "active_feature_id": snap["active_feature_id"],
                        "counts": snap["counts"],
                        "suggestions": [
                            {
                                "label": s.label,
                                "action": s.action,
                                "feature_id": s.feature_id,
                                "gate": s.gate,
                            }
                            for s in snap["suggestions"]
                        ],
                    }
                    json.dump(out, sys.stdout, indent=2, ensure_ascii=False)
                    print()
                else:
                    sys.stdout.write(
                        _dashboard.render(
                            snap["state"], snap["spec"], snap["suggestions"]
                        )
                    )
                return 0
            res = activate(args.harness_dir, args.feature, disable_fog=args.no_fog)
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 3

    if args.json:
        json.dump(_result_to_dict(res), sys.stdout, indent=2, ensure_ascii=False)
        print()
    else:
        sys.stdout.write(format_human(res))

    return 0


if __name__ == "__main__":
    sys.exit(main())
