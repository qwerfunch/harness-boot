# Hook Runtime (F-004)

> **doc_sync 대상** — 이 문서는 `src/core/hooks/**/*.ts` 와 `hooks/hooks.json` 의
> 변경에 동기화된다 (severity: `error`).  구현 변경과 함께 본 문서를 업데이트하지
> 않으면 `/harness:check` Gate 5 에서 실패한다.

Claude Code 의 공식 hook 스키마를 day-1 네이티브로 수용하고,
harness-boot 확장 필드(`id`, `description`, `env`)는 별도 sidecar 파일로 분리한다
(BR-005 · C5 해소).  본 문서는 런타임 동작 · 설정 · 에러 분류를 정의한다.

---

## 1. 파일 레이아웃

| 파일 | 역할 | 편집자 |
|---|---|---|
| `hooks/hooks.json` | CC 공식 스키마.  `type/command/async/asyncRewake/shell/timeout/statusMessage/once` + 상위 `matcher`. | 플러그인 제공자 |
| `.harness/hooks/meta.json` | 확장 sidecar — 각 공식 엔트리에 `id`·`description`·`env` 부여, 프로젝트 공통 `allowedEnvVars` 허용 목록. | 프로젝트 소유자 |

두 파일은 `(event, matcher, index)` 튜플로 조인된다.
`index` 는 해당 event 하위의 flat 선언 순서(0-based, matcher block 을 가로질러 평탄화).

## 2. 지원 이벤트

```
PreToolUse · PostToolUse · PreCompact · SessionStart · Stop ·
SessionEnd · UserPromptSubmit
```

`matcher` 정규식은 이벤트에 따라 다른 대상에 매치된다.

| 이벤트 | matcher 매치 대상 |
|---|---|
| `PreToolUse` · `PostToolUse` | `EventContext.toolName` |
| `UserPromptSubmit` | `EventContext.promptText` |
| 그 외 | 무시 (matcher 가 비어 있으면 항상 매치) |

`matcher` 가 `undefined` 또는 `''` 이면 모든 호출에 매치된다.
정규식 컴파일이 실패하면 **닫힌(closed)** 쪽으로 동작 — 매치되지 않음.

## 3. 실행 순서와 동시성

한 이벤트에 대해 `dispatchEvent` 는 다음 규칙으로 실행한다.

1. `selectHooksForEvent` 로 매치되는 hook 목록을 선언 순서대로 얻는다.
2. 각 hook 은 다음 중 하나로 실행된다.
   - `entry.async === true` → 즉시 시작, 이벤트 내 병렬 실행 가능.
   - 그 외 → 직전 hook 완료 후 직렬 실행 (peak concurrency = 1).
3. 모든 hook (sync + async) 이 완료되면 결과 배열을 **선언 순서대로** 반환.

이 시맨틱은 `ConcurrencyProbeRunner` 로 테스트된다 (peak ≥ 2 for async; peak = 1 for sync).

## 4. Timeout

`entry.timeout` 는 **초 단위 양의 정수**이며, 런타임에서 ms 로 환산된다.
미지정 시 기본값은 **10000 ms**.

테스트는 `DispatchOptions.timeoutOverrideMs` 를 통해 결정적으로 timeout 을 주입한다
(실서비스에서는 미설정).  timeout 은 `AbortController` 를 통해 runner 에 전파되어,
잘 구현된 runner 는 abort 시그널을 수신하여 정리 후 reject 한다.

timeout 발생 시
- 결과: `{ ok: false, timedOut: true, error: 'timeout' }`
- 이벤트 로그: `type = 'hook_timeout'`, payload 에 `statusMessage` 포함(설정된 경우)

## 5. `once` 시맨틱

`entry.once === true` 인 hook 은 **성공 1 회** 실행 후 `OnceStore` 에 마킹되며,
이후 동일 id 의 디스패치는 즉시 skipped 결과를 반환하고 runner 를 호출하지 않는다.
skip 시 이벤트 로그는 `type = 'hook_skipped'`, `payload.reason = 'once'` 로 기록된다.

실패(timeout 포함) 한 once hook 은 마킹되지 않으므로 다음 디스패치에서 재시도된다.

## 6. 환경 변수 정책 (`resolveEnv`)

| 입력 | 처리 |
|---|---|
| `hookEnv[KEY]` (meta.json.env) | `allowedEnvVars` 에 있으면 전달, 없으면 `denied` 에 키만 기록 (값 절대 유출 금지) |
| `processEnv[KEY]` | `allowedEnvVars` 에 있을 때만 전달; `undefined` 값은 건너뜀 |
| `processEnv` 에 있지만 허용목록에 없는 키 | 묵시적 차단, `denied` 에 포함하지 않음 |

hookEnv 는 같은 키의 processEnv 값을 덮어쓴다 (의도적 주입 우선).

## 7. 이벤트 로그 계약 (BR-008)

`dispatchEvent` 는 **hook 당 정확히 한 건**의 append-only 엔트리를 작성한다.

| 조건 | `type` |
|---|---|
| 성공 (ok && !timedOut) | `hook_fired` |
| 스킵 (once 재호출) | `hook_skipped` |
| timeout | `hook_timeout` |
| runner ok=false 또는 예상 외 throw | `hook_error` |

payload 공통 필드: `id`, `event`, `ok`, `timedOut`, `durationMs`,
선택 필드로 `exitCode`, `error`, `statusMessage`.

여러 이벤트를 연속 디스패치해도 엔트리는 삽입 순서대로 보관되며, 이는
`InMemoryEventLog` 와 F-013 의 파일 백엔드에서 공통으로 보장된다.

## 8. 설정 에러 분류 (`HooksConfigError`)

```
EVENT_UNKNOWN      — 알 수 없는 이벤트 이름
FIELD_INVALID      — 필수/선택 필드의 타입·범위 위반
DUPLICATE_ID       — meta.json.hooks 에서 id 중복
META_MISSING       — 공식 hook 에 대응하는 meta 엔트리 없음
META_ORPHAN        — meta 엔트리가 공식 hook 을 가리키지 않음
MATCHER_MISMATCH   — 같은 (event, index) 의 matcher 가 두 파일에서 불일치
```

`joinConfig` 는 이 중 `META_MISSING`, `META_ORPHAN`, `MATCHER_MISMATCH` 를 방출하며,
어느 하나라도 발생하면 런타임을 기동하지 않는다.

## 9. 테스트 커버 (tdd_focus)

| focus | 주 테스트 |
|---|---|
| 1. 7 이벤트 라우팅 정확성 | `events.test.ts` — `it.each(HOOK_EVENTS)` |
| 2. timeout · once · async 결합 경계 | `runtime.test.ts` — StallingRunner + ConcurrencyProbeRunner |
| 3. meta ↔ hooks id 매칭 불일치 탐지 | `config.test.ts` — META_MISSING/ORPHAN/MATCHER_MISMATCH |
| 4. env allowedEnvVars 정책 · 비밀 마스킹 | `env.test.ts` — denied 에 값 노출 금지 불변식 |
| 5. hook 실패 시 이벤트 로그 무결성 | `runtime.test.ts` — hook_error + 연속 디스패치 순서 |

Vitest: 4 files, 57 tests.  마지막 갱신 기준 coverage 95.68% statements.

## 10. F-004 이후 연결 지점

- **F-007 (`/harness:analyze`)** — SS-003 smoke 가 `dispatchEvent` 경로를 종단 검증.
- **F-011 (`/harness:check`)** — Gate 5 에서 이 문서와 `src/core/hooks/**` 의
  최신성을 비교, 불일치 시 error 로 실패.
- **F-013 (감사 로그 영속화)** — `InMemoryEventLog` 를 파일 백엔드 +
  sha256 체인 해시로 교체.
