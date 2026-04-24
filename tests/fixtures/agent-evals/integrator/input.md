# Test input — integrator

## Assumed upstream

- `.harness/architecture.yaml` — modules: `ui/timer`, `domain/session`, `infra/clock`, `infra/audio`. tech_stack: node/ts/vitest/vite. host_binding: web + desktop-electron.
- `.harness/domain.md` — Decisions[tag=ci|deploy|stack]:
    - ADR-001: pnpm workspace (monorepo)
    - ADR-002: Electron 26+ for desktop
    - ADR-003: GitHub Actions CI (matrix web+electron)
- Engineer outputs (이미 delivered):
    - `src/ui/timer.tsx` (frontend-engineer)
    - `src/domain/session.ts` + `src/infra/clock.ts` (backend-engineer)
    - `tests/domain/session.spec.ts` · `tests/ui/timer.spec.tsx`
- state.yaml 의 F-003: gate_0~3 pass · gate_4 (commit) · gate_5 (smoke) 대기중

## Task

F-003 을 실제로 "조립" 해서 end-to-end 실행 가능한 상태로 만들 것. `.harness/_workspace/integration/notes.md` 에 조립 체크리스트 + CI workflow 설계 + gate_5 runtime smoke 커맨드 override 를 작성. package.json scripts 5 종 (dev · build · preview · test · smoke) · Vite base 경로 · Playwright headless smoke · `.github/workflows/ci.yml` matrix · Electron builder config 전부 명시. harness.yaml.gate_commands.gate_5 override 커맨드도 여기서 결정.

## Constraints

- pnpm lockfile 생성 후 CI reproducible install 보장
- matrix: web + electron 양쪽 smoke
- Electron auto-update 는 F-003 범위 밖 — notes 에 "v0.9+ 이연" 명시
- Security engineer 의 finding 중 "Electron contextIsolation: true" 는 반드시 반영
