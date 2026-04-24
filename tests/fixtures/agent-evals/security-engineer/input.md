# Test input — security-engineer

## Assumed upstream

- `.harness/domain.md` — Project: Pomodoro for solo musicians. Entity `UserCredential` (hash, salt, last_login) marked `sensitive: true`. Stakeholder `music_teacher` distributes session patterns (payment feature deferred).
- `.harness/architecture.yaml` — modules: `api/auth`, `domain/session`, `infra/db`. host_binding: public web app + desktop Electron wrap.
- Orchestrator payload for F-010 (login):
  feature_id: F-010
  ac_summary:
    - AC-1: email+password 인증
    - AC-2: 로그인 실패 5 회 연속 시 계정 5 분 잠금
    - AC-3: 세션 JWT 는 15 분 · refresh 토큰 7 일
  touches_entities: [UserCredential]
  platforms: [web, desktop-electron]

## Task

F-010 에 대한 보안 감사 보고서를 `.harness/_workspace/security/report.md` 로 작성. STRIDE 6 카테고리 전부 커버 (Spoofing · Tampering · Repudiation · Information Disclosure · Denial of Service · Elevation of Privilege). OWASP ASVS L2 해당 항목 매핑. 최소 3 건의 finding · 하나 이상의 BLOCK 이어야 실제 감사로 판정. reviewer 의 결론과 다를 시 security BLOCK 이 veto.

## Constraints

- Desktop Electron 환경 특성 반영 (nodeIntegration · contextIsolation)
- Refresh 토큰 저장 매체 결정 필수 (httpOnly cookie vs secure storage)
- Rate limit 구현 layer 결정 (edge · app)
- read-only 분석 우선 · 보안 가드 코드 직접 편집 금지 (finding 으로만 제안)
