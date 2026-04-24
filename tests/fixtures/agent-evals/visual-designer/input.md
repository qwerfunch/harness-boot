# Test input — visual-designer

## Upstream — flows.md (excerpt)

`.harness/_workspace/design/flows.md` 의 요약:

- F-003 start-session: Timer 중앙 큰 숫자, Drop/Start 버튼 하단. 낙하 대신 세션 타이머 톱니 회전.
- States: idle · running · paused · break.
- Motion 요구: idle→running 전이 200ms ease-out. break 전환은 1 초 fade.

## Task

`.harness/_workspace/design/tokens.yaml` 를 작성하라. 도메인 semantic 으로 이름을 짓고 (예: `surface/base`, `ink/primary`, `accent/action-primary`, `focus/cue`, `motion/session-start`), Tailwind/Material 카피 금지. 색 페어는 WCAG 2.2 contrast (4.5:1 text, 3:1 UI) 를 tokens.yaml 주석에 명시. 모든 motion token 은 duration + ease + purpose 3 필드 필수.

## Constraints

- platforms: [desktop, mobile-ios] — iOS 시스템 폰트 고려
- has_audio: true — audio-designer 의 audio.yaml 과 token 네이밍 규약 공유 (`cue/session-start` 는 visual, `sound/session-start` 는 audio)
- F-003 범위만 — extrapolation 금지
