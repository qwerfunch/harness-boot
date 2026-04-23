# /harness:analyze (F-007)

> **doc_sync 대상** — 이 문서는 `src/steps/analyze/**/*.ts` 와
> `commands/analyze.md` 의 변경에 동기화된다 (severity: `error`).  결정
> 매트릭스 · 필수 파일 집합 · 백업 이름 규칙이 바뀌면 본 문서를 함께 갱신해야
> 하며, 그렇지 않으면 `/harness:check` Gate 5 에서 실패한다.

Canonical 6-Step 의 1 단계.  프로젝트 루트의 `spec.yaml` 과 기존 `.harness/`
상태를 4-way 로 판정하고 스켈레톤을 결정적으로 파생한다.  의미 검증은 하지
않으며(=F-011 Gate 5 책임), 파일 시스템의 형태 정합만 다룬다.

---

## 1. 결정 매트릭스

| 상태 | 조건 | 동작 | AC |
|---|---|---|---|
| `missing` | `.harness/` 디렉토리 없음 | 전체 스켈레톤 5 파일 생성 | AC1 |
| `partial` | `.harness/` 있음 + `REQUIRED_FILES` 중 일부 부재 | 누락분만 채움 (기존 보존) | AC2 |
| `new_input` | 모든 필수 파일 존재 + `harness.yaml.generated_from.root_hash ≠ sha256(spec.yaml)` | `_workspace_<YYYYMMDD_HHMMSS>/` 로 백업 후 재생성 | AC3 |
| `idempotent` | 모든 필수 파일 존재 + 해시 일치 | no-op | AC4 |

결정 순서 — `detectState` 는 항상 이 순서로 판정한다:

1. `.harness/` 자체가 없다 → `missing`
2. 필수 파일이 하나라도 없다 → `partial`
3. `harness.yaml` 의 hash 가 다르다 → `new_input`
4. 그 외 → `idempotent`

## 2. 필수 파일 집합

`REQUIRED_FILES` (`src/steps/analyze/types.ts`):

- `.harness/spec.yaml` — 사용자의 spec 본문 복제.  루트 `spec.yaml` 의
  snapshot — 사용자는 편집하지 않는다 (루트 `spec.yaml` 이 SSoT).
- `.harness/harness.yaml` — 결정적 메타. `generated_from.root_hash` ·
  `generated_at` · `runtime.primary=claude-code`.
- `.harness/state.yaml` — gate · feature 상태 캐시 (F-011 가 갱신).
- `.harness/events.log` — append-only 이벤트 로그 (F-013 에서 sha256 체인
  해시로 변조 감지).
- `.harness/hooks/meta.json` — BR-005 확장 sidecar (`hooks: {}` ·
  `allowedEnvVars: []` 초기값).

이 중 하나라도 없으면 `partial` 상태가 된다.

## 3. BR-001 덮어쓰기 금지

모든 쓰기는 `writeFile(..., { flag: 'wx' })` 로 수행한다. 기존 파일이
있으면 `EEXIST` 를 던지며, 이는 로직 오류(= partial 판정이 잘못됨) 를
의미하므로 스택 트레이스를 그대로 노출한다.

`new_input` 에서 "재생성" 은 덮어쓰기가 아니다 — `backupExistingHarness`
가 기존 `.harness/` 를 `rename()` 으로 옮긴 뒤 깨끗한 디렉토리 위에 쓴다.

## 4. 백업 이름 규칙

- 기본 형식: `_workspace_<YYYYMMDD>_<HHMMSS>` (로컬 시간 기준)
- 초 단위 해상도에서 이미 존재하면 `_1` · `_2` · … 숫자 suffix 추가
- `formatTimestamp(now)` 는 `src/steps/analyze/backup.ts` 에서 export —
  이 형식이 바뀌면 기존 워크스페이스를 찾는 다른 도구가 깨질 수 있다

백업은 **영구** 다.  사용자가 원하면 `rm -rf _workspace_*` 로 정리한다.
harness-boot 은 자동 삭제하지 않는다.

## 5. CLI 사용법

```bash
harness-boot analyze             # 실제 쓰기
harness-boot analyze --dry-run   # 상태만 리포트
```

종료 코드:
- `0` — 성공 (idempotent 포함)
- `1` — 예기치 못한 런타임 에러
- `2` — 사용자 입력 문제 (spec.yaml 부재, dist 미빌드 등)

## 6. 공개 API

```ts
import {
  runAnalyze,
  detectState,
  writeSkeleton,
  backupExistingHarness,
  formatTimestamp,
  REQUIRED_FILES,
  HARNESS_DIR,
} from '../../src/steps/analyze/index.js';
```

- `runAnalyze(opts): Promise<AnalyzeResult>` — 오케스트레이터.  주입된
  `now()` 로 테스트 결정성 확보.
- `detectState(opts): Promise<AnalyzeState>` — 순수 (읽기만).
- 나머지는 단위 단위 export — 사용자 코드가 커스텀 조합을 만들 수 있게
  노출.

## 7. 결정성 · 테스트

- `now` 는 옵션으로 주입 — 테스트는 고정 `Date` 를 사용해 타임스탬프를
  단언.
- `sha256(specSource)` 만으로 new_input 판정 — 파일 시스템 mtime · inode ·
  권한 비트에 영향받지 않는다.
- `tests/steps/analyze/analyze.test.ts` 가 tmpdir 픽스처로 4 AC 전수
  커버.

## 8. 포워드 포인터

- **F-008** (`/harness:spec`) — Mode A/B/R/E 대화형 편집이 `.harness/
  spec.yaml` 을 write 한다.  본 피처의 `wx` 보장 하에 충돌이 드러난다.
- **F-011** (`/harness:check`) — `state.yaml` · `events.log` 를 갱신.
  본 피처가 만든 초기 상태 위에 Gate 판정이 쌓인다.
- **F-013** — events.log 에 sha256 체인을 덮는다.  현재는 빈 파일만 만든다.

---

## 참고

- `spec.yaml` F-007 acceptance_criteria · doc_sync 계약.
- BR-001 덮어쓰기 금지 · BR-009 플러그인 ⊃ 사용자 구조 거울.
- 구현: `src/steps/analyze/{types,hash,detect,skeleton,backup,index}.ts`.
