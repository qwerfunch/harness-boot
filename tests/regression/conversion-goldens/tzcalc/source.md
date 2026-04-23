# tzcalc — timezone-aware 시간 연산 라이브러리 기획

**대상 형태**: TypeScript 라이브러리 (npm 패키지)
**주요 소비자**: Node/Deno/Bun 런타임 및 모던 브라우저에서 동작하는 앱 개발자

## 1. 배경

사내외에서 사용하는 일정·예약·캘린더 기능은 타임존과 DST(일광 절약 시간) 를
정확히 다뤄야 한다. 그러나 기존 대안들에는 각기 공백이 있다.

- **date-fns**: 타임존 지원이 별도 패키지(`date-fns-tz`)로 분리되어 있고, DST
  전이 시점에서 ambiguous/non-existent local time 처리가 일관적이지 않다.
- **dayjs**: 플러그인 아키텍처라 초기 구성에 손이 가고, 타입 정의가 플러그인
  조합에 따라 약화된다.
- **Luxon**: 훌륭하지만 번들 크기가 크고(>70kB gz), tree-shaking 이 어렵다.
- **Temporal (TC39)**: 표준이 되어가나, 2026년 현재도 stage 3 로 런타임 가용성이
  Node 22+ 에서만 실험적이다.

사내 몇 개 서비스에서 이들을 조합해 쓰다가 매번 같은 버그(새벽 3시 → 2시
DST 전이 시점의 이벤트 중복/누락)가 재발해, 가볍고 타입 우선이며 timezone 을
1-class citizen 으로 다루는 자체 라이브러리를 만들기로 결정.

## 2. 목표

- **Timezone 1-class**: 모든 연산이 `Zone` 을 명시적으로 받고, 암묵적 로컬
  변환 금지
- **TypeScript 우선**: 구조적 타입으로 `Instant`·`Zone`·`CalendarDate` 구별
- **0 런타임 의존성** — 브라우저 네이티브 Intl + `Temporal` polyfill 선택 의존
- **번들 타겟**: 전체 API 사용 시 < 8 kB gzipped, 1~2 함수만 쓰면 < 2 kB
- **런타임 호환**: Node 18 LTS 이상, Deno 1.40+, Bun 1.x, evergreen 브라우저
- **듀얼 패키지**: ESM + CJS subpath exports, tree-shakable
- **DST 정확성**: ambiguous/non-existent local time 을 명시적으로 처리(정책을
  사용자가 선택)

## 3. 비목표 (v1 범위 밖)

- 로케일별 포매팅(ko-KR 요일/월) — `Intl.DateTimeFormat` 으로 위임
- 달력 연산 (음력/힌두력) — v2 검토
- React hooks (`useZonedNow`) — 별도 패키지 `@tzcalc/react` 로 분리
- CLI 바이너리 — 라이브러리만 제공
- IANA tzdata 동적 갱신 — 런타임 tzdata 에 의존 (Node ICU, 브라우저 Intl)

## 4. 공개 API (초안, SemVer 대상)

모든 export 는 tree-shaking 가능하도록 named export. default export 없음.

| 함수 / 타입 | 역할 | semver 축 |
|-------------|------|----------|
| `Instant` (type) | UTC 기준 시점(epoch ms + nano) | 구조 변경은 major |
| `Zone` (type) | IANA tz id 래퍼 | 동일 |
| `CalendarDate` (type) | 타임존 없는 달력 날짜 | 동일 |
| `toZone(instant, zone)` | Instant → ZonedDateTime 변환 | 인자 순서 변경은 major |
| `fromZoned(y, m, d, h, min, s, zone, opts?)` | ZonedDateTime → Instant. opts.ambiguous: "earlier" \| "later" \| "reject" | opts 축 추가는 minor |
| `add(instant, duration)` | 기간 가산. duration 은 `{ hours, days, months }` | 동일 |
| `diff(a, b, unit)` | 두 Instant 차이 | 단위 enum 확장은 minor |
| `compare(a, b)` | -1 / 0 / 1 | 동일 |
| `parse(iso, zone?)` | ISO 8601 파싱 | 관대한 파서 도입은 minor |
| `formatISO(instant, zone?)` | ISO 8601 직렬화 | format 바꾸면 major |
| `Interval` (class) | [start, end) 반개구간 + overlap/contains | method 추가는 minor |
| `DstTransition` (type) | DST 전이 정보 | 필드 추가는 minor |

공개되지 않는 내부 유틸(`_normalize`, `_utcTicks`)은 underscore prefix + 빌드
시 마스킹. 바깥에서 import 불가.

## 5. 핵심 엔티티

- **Instant**: UTC epoch + nano. 불변. 연산의 1차 표현.
- **Zone**: IANA id 문자열을 타입으로 감싼 것. `zone("Asia/Seoul")` 팩토리
  로만 생성. 잘못된 id 는 생성 시점에 throw.
- **CalendarDate**: (year, month, day, hour, minute, second, nano). 타임존
  정보 없음. DB 저장이나 사용자 입력 수용용.
- **Interval**: 두 Instant 로 구성된 반개구간. Allen's interval algebra 의
  13 관계 중 `overlaps`, `contains`, `meets` 3개만 v1 에서 지원.
- **ZoneRules**: 내부 전용(API 비노출). Intl 이나 Temporal polyfill 에서
  offset/DST 정보를 런타임마다 다르게 추출.

## 6. 호환성 매트릭스

| 런타임 | 최소 버전 | 비고 |
|--------|-----------|------|
| Node.js | 18 LTS | 18/20/22 정기 CI |
| Deno | 1.40+ | Intl 보장 |
| Bun | 1.0+ | 1.x 는 best-effort |
| 브라우저 | Chrome 110+, Firefox 115+, Safari 16+ | ES2022 baseline |
| TypeScript | 5.0+ | strict 모드 전제 |

tzdata 는 런타임 제공분을 그대로 사용. 런타임별로 최신 tzdata 정책이 다르므로
"이 라이브러리는 IANA tzdata 를 번들하지 않는다" 가 중요한 계약.

## 7. 번들 / 배포

- 패키지 이름: `tzcalc`
- subpath exports:
  - `tzcalc` — 전체 API
  - `tzcalc/zone` — Zone 팩토리만
  - `tzcalc/interval` — Interval 만
- ESM 기본, `require` 사용자를 위해 CJS 대칭 포함
- 타입: `.d.ts` 는 번들 파일과 동일 경로
- `sideEffects: false` 명시 — tree-shaking 활성화

## 8. 버전 정책 (SemVer)

- **major** (예: 1.x → 2.0): 공개 API 시그니처 변경, 기본 DST 정책 변경,
  최소 Node 버전 상승
- **minor**: 새 export 추가, opts 축 확장, 새 unit 허용
- **patch**: 버그 수정, 문서, 내부 성능 개선

**LTS 정책**: 1.x 는 **릴리즈 후 최소 24개월** 심각 보안/정확성 버그 수정만
제공. 새 기능은 2.x 이후로.

**deprecation**: API 제거는 최소 한 번의 minor 릴리즈에서 `@deprecated` JSDoc
와 런타임 `console.warn` (개발 모드만) 을 띄운 뒤에만 major 에서 삭제.

## 9. 개발 마일스톤

- **M1 (2주)**: Instant/Zone/CalendarDate 타입, toZone/fromZoned, 단위 테스트
  80% coverage, Node 18/20/22 CI
- **M2 (2주)**: add/diff/compare, Interval, parse/formatISO, DST 전이 테스트
  매트릭스 (`America/New_York`, `Asia/Seoul`, `Pacific/Chatham`,
  `Australia/Lord_Howe`) 전량
- **M3 (2주)**: 브라우저 CI (Playwright), Deno/Bun CI, 번들 크기 회귀 방지
  (size-limit), 벤치마크 vs date-fns/Luxon
- **M4 (1주)**: 문서 사이트 (Docusaurus), examples/, 1.0 릴리즈
- **버퍼 1주**: 심각 버그 수정 + peer review

## 10. 성능 목표

`bench/` 에서 date-fns-tz, Luxon 과 비교:

- `toZone`: date-fns-tz 대비 ≥ 1.2× (> 1M ops/sec)
- `Interval.overlaps`: Luxon 대비 ≥ 3× (경쟁력 차별화 포인트)
- `fromZoned` ambiguous resolution: 표준 준수만 목표 (성능 경쟁 안 함)

번들 크기 회귀: `size-limit` 이 gz 8 kB 를 넘으면 PR 블록.

## 11. 의존성 / 외부

- **런타임 의존**: 없음 (런타임 네이티브 `Intl`, 선택적 `Temporal` polyfill
  `peerDependencies.optional`)
- **빌드 도구**: `tsup`, `typescript`, `vitest`, `size-limit`, `playwright`,
  `@types/node`
- **문서 도구**: `docusaurus` (별도 repo 구성 검토)
- **레지스트리**: npm public, provenance 서명 활성화

## 12. 리스크 · 미결정

- Temporal polyfill 의존을 optional 로 둘지 mandatory 로 둘지 — v1 직전 결정
- tzdata 런타임 차이로 인한 "Node 20 에서만 실패" 류 엣지 케이스 발견 시,
  CI 매트릭스를 넓히는 것 외의 완화책이 없어 보임. 이를 문서화 수준에서
  멈출지, 폴리필 우회 경로를 제공할지 미결정
- Interval 관계 13종 중 나머지 10개 메서드(`before`, `meets`, `starts` 등)는
  v2 로 미룰지, v1 에 포함시킬지 — 사용자 피드백 대기
- "ambiguous resolution" 기본값이 `"later"` 가 좋을지 `"reject"` 가 좋을지 —
  레퍼런스(`Temporal`) 가 `"reject"` 기본. 우리도 정합성 맞출지 여부 미정

## 13. 성공 지표

- 1.0 릴리즈 후 90일 내 주간 npm 다운로드 ≥ 3,000
- GitHub stars ≥ 300
- 사내 3개 서비스에서 실제 마이그레이션 (date-fns-tz → tzcalc) 완료
- DST 전이 관련 버그 리포트 월 0~1건 이하

## 14. 이해관계자

- **내부 개발팀 (server/web)**: 일정 · 예약 · 캘린더 기능에서 이 라이브러리
  를 소비. DST 버그가 가장 큰 고객 컴플레인 원인이라 품질에 민감.
- **DevEx 팀**: TS 타입의 엄격성, 번들 크기, 문서 품질.
- **Security/Infra**: npm provenance 서명, 공급망 공격 면역, 0-dep 원칙.
- **OSS 커뮤니티**: MIT 라이선스, 이슈/PR 관리, 릴리즈 노트 품질.

## 15. 비포함 (다시 강조)

- 로케일 포매팅·캘린더 종류 확장은 v1 범위 아님
- UI 컴포넌트 / React hooks / Svelte store 는 별도 패키지
- tzdata 번들링은 영구 비목표 (라이브러리 철학)
