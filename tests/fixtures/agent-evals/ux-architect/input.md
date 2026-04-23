# Test input — ux-architect

## Assumed domain.md context

Project: Pomodoro timer app for solo musicians.

Stakeholders:
- solo_musician — 악기 솔로 연습자. 방해받지 않고 25분 집중을 원함.
- music_teacher — 학생들에게 연습 패턴을 배포하는 강사.

Entities:
- Session (start_at, duration_min, instrument, status)
- Break (duration_min, is_skipped)

Business Rules:
- BR-001: 세션 중에는 시스템 알림 전부 묵음.
- BR-002: 세션 중단은 "스페이스 2회" 로만 (오타 방지).

## Orchestrator inline payload

feature_id: F-003 (start-session)
AC:
  - AC-1: 사용자가 25분 세션을 시작·완료할 수 있다.
  - AC-2: 세션 종료 직후 5분 쉼으로 자동 전이한다.
  - AC-3: 세션 중 일시정지·재개가 가능하다.
modules: [ui/timer, domain/session, a11y/keyboard]
test_strategy: tdd
ui_surface:
  present: true
  platforms: [desktop, mobile-ios]
  has_audio: true

## Task

위 context 에서 F-003 의 UX 를 설계하라. `.harness/_workspace/design/flows.md`
하나에 전체 산출을 담고, agents/ux-architect.md 의 "필수 섹션 6개" 를 모두
포함해야 한다.
