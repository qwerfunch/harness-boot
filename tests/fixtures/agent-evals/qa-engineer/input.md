# Test input — qa-engineer

## Assumed upstream

- `.harness/domain.md` — Pomodoro app. Stakeholders include `solo_musician` (reaction time · 방해 차단) + `music_teacher` (원격 세션 패턴 공유).
- `.harness/architecture.yaml` — layers: ui/domain/infra. tech_stack: node/ts/vitest/vite + Playwright for e2e.
- `risks[]` (from plan.md):
    - R-001: Matter.js 비결정성 → smoke 테스트 flaky
    - R-002: Electron/Web 이중 플랫폼 → covering 부족
    - R-003: Teacher 공유 기능 지연 → F-006 risk accumulation
- Orchestrator payload for F-003 (start-session):
  feature_id: F-003
  ac_summary:
    - AC-1: 25분 세션 시작·완료
    - AC-2: 세션 종료 직후 5분 쉼 자동 전이
    - AC-3: 일시정지·재개
  test_strategy: tdd (initial) · contract (F-004+)

## Task

F-003 에 대한 test strategy 문서를 `.harness/_workspace/qa/strategy.md` 로 작성. risk-based testing 으로 R-001~R-003 각 risk 에 대응하는 test type + level 결정. 피라미드 분포 (unit : contract : e2e) · 도구 (vitest · Playwright · vitest-axe) · 외부 의존성 stubbing 정책 · flaky 대응 (R-001). Coverage 목표는 gate_3 threshold 로만 명시 (specific %) — 도구 자체 설정 따르는 게 정책.

## Constraints

- 피라미드 분포 제안 필수 (unit 70% · contract 25% · e2e 5% 같은 비율)
- flaky 방지 — retry policy 는 **명시적 금지** · 대신 seed · fixed timestep 로 결정성 확보
- Playwright headless · 시각 회귀 안 함 (v0.8 밖)
- 벤치는 performance-engineer 영역 (중복 금지)
