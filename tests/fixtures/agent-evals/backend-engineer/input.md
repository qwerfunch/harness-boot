# Test input — backend-engineer

## Assumed upstream

- `.harness/domain.md` — Project: Pomodoro for solo musicians. Entities include `Session` (start_at, duration_min, instrument, status) with invariants "duration_min > 0" and "only one in_progress session per user".
- `.harness/architecture.yaml` — layers: api/domain/infra. module `domain/session` owns Session aggregate. tech_stack: `runtime=node`, `language=ts`, `test=vitest`, `build=vite`.
- Orchestrator payload for F-003 (start-session):
  feature_id: F-003
  ac_summary:
    - AC-1: POST /sessions starts a 25-min session, returns session_id
    - AC-2: GET /sessions/:id returns current status
    - AC-3: starting while another is in_progress returns 409
  modules: [api/sessions, domain/session, infra/clock]
  test_strategy: contract

## Task

F-003 의 API 레이어 + 도메인 로직을 contract-first 로 구현. OpenAPI 3.1 schema 를 먼저 작성 (`docs/api/sessions.yaml`), 그 다음 라우터 · 도메인 서비스 · clock port 를 TDD 로 구현. Session aggregate 의 invariant (duration > 0 · one-in-progress-per-user) 는 단위 테스트로 전부 커버. 외부 DB 호출 금지 — in-memory repo 로 충분 (F-004 에서 Postgres 스위치).

## Constraints

- Google Python Style 유사 규약 TS 포트 — spec ID (F-003·AC-1) 는 **docstring/주석에만**, 함수/클래스 이름은 도메인 의미
- pure domain 층 · infra 주입 (`clock: () => Date`, `repo: SessionRepo`)
- public API 는 OpenAPI schema 를 SSoT 로 — route handler 가 schema 를 import
- schema 변경 = breaking unless additive
