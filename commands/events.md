---
description: events.log 조회 — 시간·종류·피처 필터 (F-007). 읽기 전용 (CQS).
allowed-tools: [Read, Bash]
argument-hint: "[--kind TYPE] [--feature F-ID] [--since ISO8601] [--all | --limit N] [--json]"
---

# /harness:events — 이벤트 로그 조회 (F-007)

`.harness/events.log` (JSONL) 을 필터해서 최근 활동을 봄.

**CQS 불변조건**: events.log **읽기만**. mtime 불변.

## Preamble (출력 맨 앞 3 줄)

```
📜 /harness:events · <filter 요약 또는 N events> · <근거 5~10 단어>
NO skip: 모든 JSONL 줄 파싱 시도 (깨진 줄은 조용히 건너뛰되 전체 순회)
NO shortcut: events.log 읽기 전용 (CQS · mtime 불변 · BR-012/013)
```

**1 줄**: 이모지 · 명령 · filter/count · 근거.
**2-3 줄 (Anti-rationalization, BR-014)**: 부분 스캔 · 쓰기 시도를 명시 거부.

예: `📜 /harness:events · 4 events · F-099 활성화 ~ done 사이클`.

## 실행

```bash
python3 "$PLUGIN_ROOT/scripts/events.py" --harness-dir "$(pwd)/.harness" --json
```

### 주요 플래그

| 플래그 | 의미 |
|---|---|
| `--kind sync_completed` | 타입 필터 |
| `--feature F-004` | 피처 필터 |
| `--since 2026-04-23T05:00:00Z` | ts >= 이 시각 |
| `--all` | 제한 없음 |
| `--limit 50` | 기본값 (default 50) |
| `--json` | 기계 파싱용 |

조합 가능 — 예: `--kind gate_recorded --feature F-004 --since 2026-04-23`.

## 전형 사용

```
/harness:events --kind sync_completed
→ 최근 sync 이력.

/harness:events --feature F-004
→ F-004 관련 모든 이벤트 (activated / gate_recorded / evidence_added / done).

/harness:events --since 2026-04-23T00:00:00Z
→ 오늘 이후.
```

## 주요 이벤트 타입

- `harness_initialized` — /harness:init 완료 시.
- `sync_completed` — /harness:sync 성공.
- `sync_failed` — /harness:sync 의 스키마 검증 실패.
- `feature_activated` / `feature_done` / `feature_blocked` — /harness:work 전이.
- `gate_recorded` — /harness:work --gate 기록.
- `evidence_added` — /harness:work --evidence.
- `include_expand_failed` — /harness:sync 의 $include 전개 실패.

## 참조

- `scripts/events.py`.
- BR-012 (CQS) · BR-013 (append-only 로그).
