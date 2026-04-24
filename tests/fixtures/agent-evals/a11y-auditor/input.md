# Test input — a11y-auditor

## Assumed domain.md context

Project: Pomodoro timer app for solo musicians.

Stakeholders:
- solo_musician — 장시간 연습으로 피로한 상태, 하드웨어 오디오 인터페이스 사용 중.
- music_teacher — 학생 연습 기록 확인. 일부는 색각 이상 보조 도구 사용.

## Assumed upstream artifacts

- `.harness/_workspace/design/flows.md` — F-003 start-session flow (Space 2회 중단 · 자동 전이 5분 쉼).
- `.harness/_workspace/design/tokens.yaml` — color surface/base `#111` · ink/primary `#eee` · focus-cue `#4f9dff` · accent/action-primary `#ff5f5f`.
- `.harness/_workspace/design/components.yaml` — Timer (display), SessionButton (primary CTA), BreakToast.

## Orchestrator inline payload

feature_id: F-003 (start-session)
AC:
  - AC-1: 25분 세션 시작·완료.
  - AC-2: 세션 종료 직후 5분 쉼 자동 전이.
  - AC-3: 일시정지·재개.
ui_surface:
  present: true
  platforms: [desktop, mobile-ios]
  has_audio: true

## Task

위 산출물을 검사해 `.harness/_workspace/a11y/report.md` 를 작성하라. WCAG 2.2 A/AA 기준 findings 만 포함하고, 각 finding 은 WCAG SC 번호 · severity (BLOCK/WARN/INFO) · 현재 증상 · 수정 권고를 갖추어야 한다. 최소 3 건의 finding 과 하나 이상의 BLOCK 을 포함해야 실제 검사로 판정.
