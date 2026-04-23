---
description: events.log 집계 — Feature throughput · lead time · gate pass rate · drift 빈도 (F-008). 읽기 전용 (CQS).
allowed-tools: [Read, Bash]
argument-hint: "[--period 7d|24h|30m] [--since ISO8601] [--format human|json|csv]"
---

# /harness:metrics — 집계 지표 (F-008)

`.harness/events.log` 를 읽어 시간 윈도우 내 활동 지표를 요약. 파일 수정 없음 (CQS).

## Preamble (출력 맨 앞 3 줄)

```
📊 /harness:metrics · <window> · <근거 5~10 단어>
NO skip: events.log 전체 파싱 후 필터링 (원본 수정 없음)
NO shortcut: 측정 실패 시 0/null 반환 — 추정치 삽입 금지
```

**1 줄**: 이모지 · 명령 · 윈도우 · 근거.
**2-3 줄 (Anti-rationalization, BR-014)**: events 원본 수정 · 추정 데이터 삽입 유혹 명시 거부.

예: `📊 /harness:metrics · last 7d · 주간 gate 통과율 확인`.

## 실행

```bash
python3 "$PLUGIN_ROOT/scripts/metrics.py" --harness-dir "$(pwd)/.harness"
python3 "$PLUGIN_ROOT/scripts/metrics.py" --period 7d
python3 "$PLUGIN_ROOT/scripts/metrics.py" --since 2026-04-20T00:00:00Z --format json
python3 "$PLUGIN_ROOT/scripts/metrics.py" --period 24h --format csv
```

### 종료 코드

- `0` — 정상 (데이터 0 건이어도 0)
- `2` — IO / setup / invalid argument

## 지표

| 지표 | 소스 이벤트 | 계산 |
|---|---|---|
| **Total events** | 모든 `type` | 윈도우 내 총 카운트 |
| **Event types** | 모든 `type` | type 별 카운트 |
| **Features activated** | `feature_activated` | 카운트 |
| **Features done** | `feature_done` | 카운트 |
| **Features blocked** | `feature_blocked` | 카운트 |
| **Lead time** | `feature_activated` + `feature_done` | 피처별 (마지막 activated → 첫 done) 초 단위 · min/median/mean/max |
| **Gate stats** | `gate_recorded` · `gate_auto_run` | gate 별 pass/fail/skipped 카운트 + pass_rate (분모는 pass+fail, skipped 제외) |
| **Drift incidents** | `sync_failed` | 카운트 |

**윈도우 선택**:
- `--since ISO8601` (우선) → 해당 시각 이후
- `--period Nd|Nh|Nm|Ns|Nw` → `now - N` 부터 `now` 까지
- 둘 다 없으면 전체 기간

## 출력 포맷

### human (기본)

```
📊 /harness:metrics

Window: last 7d (2026-04-16T00:00:00Z → now)

Total events: 42
  by type:
    feature_activated    3
    feature_done         2
    gate_auto_run       12
    gate_recorded        8
    sync_completed       5

Features: 2 done · 3 activated · 0 blocked
Lead time (n=2): min 1.25h · median 2.50h · mean 2.50h · max 3.75h

Gate stats:
  gate      pass  fail  skip   rate
  gate_0       8     1     0   88.9%
  gate_1       5     0     0   100.0%
  gate_5       0     0     5   —

Drift incidents (sync_failed): 0
```

### json

`--format json` 은 `as_dict()` 출력 — 필드 안정적, CI 가공용.

### csv

`--format csv` 은 `metric,key,value` 3 열 long-format — spreadsheet 붙여넣기 친화.

## CQS 불변

- `events.log` mtime 불변 (단위 테스트 강제).
- `state.yaml` · `harness.yaml` · `spec.yaml` 건드리지 않음.
- 추정/보간 금지. 측정 불가능한 지표는 `null` / `0` 반환.

## 전형 사용

**주간 리뷰**:
```
/harness:metrics --period 7d
→ 지난 주 처리량 · 게이트 통과율 확인.
```

**CI 리포트**:
```
python3 scripts/metrics.py --period 24h --format json > daily-metrics.json
```

**병목 식별**:
```
/harness:metrics --period 30d --format csv | open -a Numbers
→ lead time 분포 · 실패가 쏠리는 gate 파악.
```

## 참조

- `scripts/metrics.py` — 실제 구현.
- `scripts/events.py` — events.log 파서 (재사용).
- BR-012 (CQS): 진단 명령은 파일 수정 금지.
