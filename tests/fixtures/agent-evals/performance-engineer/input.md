# Test input — performance-engineer

## Assumed upstream

- `.harness/domain.md` — Project: Pomodoro for solo musicians. Stakeholder `solo_musician` 의 reaction-time 민감성 (방해 차단 본능). Platform: web + desktop-electron.
- `.harness/architecture.yaml` — hotpath = `session-start` button click → timer mount → audio cue. Modules: `ui/timer`, `infra/audio`.
- `features[F-003].performance_budget`:
    lcp_ms: 2000
    inp_ms: 100
    bundle_kb: 160
    custom:
      - metric: "session_start_to_tick_ms"
        budget: 50

- Orchestrator payload for F-003 (start-session):
  feature_id: F-003
  ac_summary:
    - AC-1: 25-min 세션 시작·완료
    - AC-2: 종료 후 5-min 휴식 자동 전이
  test_strategy: tdd

## Task

F-003 의 performance budget 준수 여부를 벤치 + 측정으로 검증해 `.harness/_workspace/perf/report.md` 로 보고. 각 지표 (lcp_ms · inp_ms · bundle_kb · session_start_to_tick_ms) 별 현재 수치 · 한계 · 판정 (PASS/WARN/BLOCK). 측정 방법 명시 (Lighthouse · Web Vitals API · custom timer). 2 회 이상 측정 평균 사용. 본 감사는 budget 기반 강제 — overbudget 지표 1 개라도 있으면 BLOCK.

## Constraints

- Lighthouse CI 또는 동등 재현 가능한 측정 도구 가정
- session_start_to_tick_ms 는 custom metric — performance.now() 로 계측
- Electron 과 Web 모두 측정 (plat 간 결과 분리)
- 측정 결과는 `.harness/_workspace/perf/bench/` 에 fixture 저장 (재현성)
