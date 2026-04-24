# Test input — software-engineer

## Assumed upstream

- `.harness/domain.md` — Project: Pomodoro for solo musicians. Stakeholders + Entities as per ux-architect/researcher fixtures.
- `.harness/architecture.yaml` — layers: ui/domain/platform. component Session owns start_at · duration_min · instrument · status.
- Orchestrator payload for F-003 (start-session):
  feature_id: F-003
  ac_summary:
    - AC-1: 25분 세션 시작·완료
    - AC-2: 세션 종료 직후 5분 쉼 자동 전이
    - AC-3: 일시정지·재개
  modules: [domain/session, app/timer, infra/clock]
  test_strategy: tdd

## Task

F-003 의 domain 층을 TDD red→green 으로 구현하라. `domain/session.ts` 가 `Session` 엔티티와 전이 함수(`startSession`, `pauseSession`, `resumeSession`, `completeSession`)를 제공해야 한다. 먼저 `tests/domain/session.spec.ts` 에 AC 매핑 단위 테스트를 쓰고 (3개 이상), 그 다음 최소 구현으로 green 을 맞춘다. `spec.yaml` 은 직접 읽지 않는다 — 위 payload 가 전부.

## Constraints

- Google Python Style 유사 규약 (TS) — spec ID(F-003·AC-1) 는 **docstring/주석에만**, 함수/클래스 이름은 도메인 의미 (`startSession`, 아니면 `startSessionForF003` 같은 건 금지)
- pure function 으로 유지 — 시간 소스는 주입 (`clock: () => Date`)
- 외부 I/O 금지 (ui/infra 는 다음 피처)
