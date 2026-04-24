# Test input — audio-designer

## Assumed upstream

- `.harness/_workspace/design/flows.md` — F-003: session-start 시 subtle tick 시작 음 · 25 분 후 soft bell · 휴식 종료 후 wake cue.
- `.harness/_workspace/design/tokens.yaml` — color.accent/action-primary, motion.session-start (duration 200ms ease-out).
- `.harness/domain.md` — Stakeholder solo_musician: 연주자 · 악기와 간섭하지 않는 소리 요구 (악기의 f0 대역 회피). Teacher 는 알림을 분리해 혼선 방지.

## Task

`.harness/_workspace/design/audio.yaml` 를 작성. Earcon 규약 (Gaver 1989) · WAI-ARIA aural 권고 · 음악 간섭 방지 (spectral masking theory) 적용. 각 sound token 은 duration_ms · envelope · freq_range · purpose 4 필드. motion token 과 네이밍 parity: `motion/session-start` ↔ `sound/session-start`. has_audio=true 이므로 a11y-auditor 가 이 산출물도 WCAG 1.4.2 기준으로 감사.

## Constraints

- platforms: [web, desktop-electron] — Web Audio API 사용
- loudness: -18 LUFS (short alerts), -23 LUFS (ambient)
- Reduced Motion 사용자 대응 — `prefers-reduced-motion` 시 sound 도 약화/제거 (WCAG 2.3.3 AAA)
- freq_range 는 악기 f0 영역 (80~1000Hz) 충돌 회피 · high-shelf 사용
