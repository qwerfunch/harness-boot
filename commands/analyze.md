---
description: Detect .harness/ state and write skeleton (Step 1 of Canonical 6-Step)
---

# /harness:analyze

사용자 프로젝트의 `.harness/` 상태를 4-way 로 판정하고 필요한 스켈레톤을 생성한다 (F-007, BR-001 덮어쓰기 금지).

## 결정 매트릭스

| 상태 | 조건 | 동작 |
|---|---|---|
| `missing` | `.harness/` 없음 | 전체 스켈레톤 생성 |
| `partial` | `.harness/` 있음 + 필수 파일 일부 없음 | 누락분만 채움 (기존 보존) |
| `new_input` | `harness.yaml.generated_from.root_hash ≠ sha256(spec.yaml)` | `_workspace_<YYYYMMDD_HHMMSS>/` 로 백업 후 재생성 |
| `idempotent` | 해시 일치 + 필수 파일 전부 존재 | no-op |

## 실행 순서

1. **루트 `spec.yaml` 읽기** — 없으면 종료코드 2 로 실패 (`/harness:spec` 선행 권장).
2. **상태 감지** — `src/core/spec` 의 스키마 검증은 하지 않는다.  본 단계는 파일 시스템 형태만 본다 (의미 검증은 `/harness:check` Gate 5).
3. **상태별 조치** — 결정 매트릭스 대로.  모든 쓰기는 `flag: 'wx'` 로 수행해 기존 파일 절대 덮어쓰지 않는다.
4. **결과 리포트** — stdout 에 한 줄씩 `wrote .harness/...` 또는 `backup → ...` 출력.

## 예시

```bash
$ harness-boot analyze --dry-run
analyze[dry-run] state=missing

$ harness-boot analyze
analyze state=missing
  wrote .harness/spec.yaml
  wrote .harness/harness.yaml
  wrote .harness/state.yaml
  wrote .harness/events.log
  wrote .harness/hooks/meta.json
```

재실행 시:

```bash
$ harness-boot analyze
analyze state=idempotent
```

`spec.yaml` 변경 후:

```bash
$ harness-boot analyze
analyze state=new_input
  backup → _workspace_20260421_123456
  wrote .harness/spec.yaml
  wrote .harness/harness.yaml
  …
```

## 자세한 계약

- 필수 파일: `spec.yaml` · `harness.yaml` · `state.yaml` · `events.log` · `hooks/meta.json`
- 백업 경로 충돌 시 숫자 suffix (`_1`, `_2`, …)
- 구현: `src/steps/analyze/**/*.ts`
- 회귀 테스트: `tests/steps/analyze/analyze.test.ts`
- 전체 계약은 `docs/commands/analyze.md` 참조.
