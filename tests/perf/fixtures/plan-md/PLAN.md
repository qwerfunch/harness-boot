# Pomodoro Timer for Solo Musicians

## Vision

A 25/5 minute timer with instrument-specific warmup recommendations
for solo practice sessions.

## Users

- Classical musicians (piano, violin, cello) practicing 1–3 hours/day
- Indie songwriters experimenting with a daily writing habit
- Music students working through a curriculum

## Core features

1. **Session start/stop** — single tap, persists across reload
2. **Round counter** — 4 rounds = 1 long break (15 min)
3. **Instrument warmup** — domain-aware first 5 min of each session
4. **Daily history** — last 30 days, no auth (local-only)

## Acceptance

- Round transition is audible (single chime, 200ms motion)
- Pause/resume preserves elapsed time within ±100ms
- Works offline (PWA, no network calls except for instrument tips)

## Constraints

- Frontend only, no backend account
- Mobile-first; desktop is secondary
- License: MIT
