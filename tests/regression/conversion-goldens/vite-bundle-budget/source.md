# vite-plugin-bundle-budget — 번들 크기 예산 강제 플러그인 기획

**대상 형태**: Vite 플러그인 (npm 패키지 `vite-plugin-bundle-budget`)
**주요 소비자**: Vite 기반 웹 앱·라이브러리를 빌드·배포하는 프론트엔드 팀
**호스트**: Vite 5.x / 6.x (Rollup 4 기반)

## 1. 배경

웹 앱이 커지면 번들 크기가 조용히 증가한다. CI 에 번들 사이즈 회귀 테스트를 붙여
두어도 "어느 chunk 가 왜 커졌는지" 는 사후 분석에 시간이 걸린다. 또한 팀마다
"엔트리 chunk 는 150kB", "라우트 청크는 80kB" 같은 정책을 내부 문서로만 관리
하는 경우가 많아 새 팀원이 규칙을 모른 채 큰 의존성을 추가해버린다.

`size-limit`, `bundlesize`, `vite-plugin-bundle-analyzer` 등이 있으나:

- **size-limit**: CLI 중심. Vite 빌드 산출물과 매칭하려면 glob 을 수동 관리.
  Vite dev 서버 경고 미지원.
- **bundlesize**: 2020년 이후 유지보수가 미미. Vite 7 호환성 미확인.
- **analyzer**: 분석 리포트는 훌륭하나 "예산 강제(budget enforcement)" 는 범위 밖.

이 플러그인은 **정책 파일 + Vite 플러그인 + CLI 서브커맨드** 3종 세트로 "예산
초과 시 빌드 실패" 를 1급 피처로 제공한다.

## 2. 목표

- **Vite 플러그인 1개로 완결**: 설치 → `vite.config.ts` 에 1줄 추가 → 첫 빌드에서
  기본 예산 리포트 출력
- **예산 정의는 1개 파일 (`bundle-budget.config.ts`)** — TS 타입 체크 가능, 주석
  가능, Vite config 와 통합
- **3-tier 정책**: `ok` / `warn` / `fail` — `fail` 이면 `vite build` exit code ≠ 0
- **Dev 서버 인라인 경고**: `vite dev` 시 콘솔에 "route chunk `/dashboard` 가 예산
  80kB 초과 예상 (현재 96kB)" 형태로 실시간 경고
- **CLI 서브커맨드**: `vite bundle-budget report`, `vite bundle-budget init`,
  `vite bundle-budget check`
- **CI 친화**: `--format=json` 출력으로 github action 에서 파싱 가능
- **확장 가능**: 사용자가 분류기(classifier) 를 등록해 chunk → 정책 매핑 커스터마이즈

## 3. 비목표 (v1 범위 밖)

- webpack/esbuild/rspack 지원 — Vite(Rollup) 전용
- gzip 이외의 압축(brotli) 기본 측정 — 사용자가 옵션으로 토글 가능하나 기본은 gzip
- 런타임(브라우저) 성능 측정 — 번들 크기만
- 비주얼 treemap UI — `analyzer` 계열에 위임. 우리는 JSON/text 리포트만
- dependency vulnerability 검사 — `npm audit` 영역

## 4. 공개 인터페이스 (초안)

### 4.1 플러그인 API

```ts
import bundleBudget from 'vite-plugin-bundle-budget';

export default defineConfig({
  plugins: [bundleBudget()],   // bundle-budget.config.ts 자동 로드
  // 또는:
  // plugins: [bundleBudget({ configFile: './budgets.ts' })],
});
```

### 4.2 설정 파일 스키마 (`bundle-budget.config.ts`)

```ts
import { defineBudgets } from 'vite-plugin-bundle-budget/config';

export default defineBudgets({
  defaults: {
    compression: 'gzip',         // 'gzip' | 'brotli' | 'raw'
    onFail: 'error',             // 'error' | 'warn' | 'ignore'
  },
  rules: [
    { match: 'entry/**',          max: '150kB', warnAt: '120kB' },
    { match: 'routes/**',         max:  '80kB', warnAt:  '60kB' },
    { match: 'vendor/**',         max: '250kB', warnAt: '220kB' },
    { match: '**/*.css',          max:  '40kB' },
  ],
  classifiers: [
    // chunk 파일명 → 카테고리 커스텀 매핑 (선택)
    (chunk) => chunk.fileName.startsWith('assets/routes-') ? 'routes' : null,
  ],
});
```

### 4.3 CLI 서브커맨드

`vite` 의 CLI 는 확장 가능. 이 플러그인이 로드된 프로젝트에서는:

| 명령 | 역할 | 빌드 수행 여부 |
|------|------|----------------|
| `vite bundle-budget init` | `bundle-budget.config.ts` 템플릿 생성 | 아니오 |
| `vite bundle-budget report [--format=text\|json]` | 최근 빌드 산출물 분석 리포트 | 아니오 |
| `vite bundle-budget check [--fix-budgets]` | 실제 빌드 후 예산 강제 | 예 |

## 5. 핵심 엔티티

- **Plugin**: Vite 플러그인 인스턴스. `configResolved`, `generateBundle`,
  `buildEnd` 훅 3개에 후킹.
- **BudgetConfig**: `bundle-budget.config.ts` 로부터 로드된 불변 설정 객체.
  `defaults` + `rules[]` + `classifiers[]` 로 구성. zod 스키마로 검증.
- **BudgetRule**: `{ match, max, warnAt?, compression?, onFail? }` 단일 규칙.
  defaults 로부터 빠진 필드 상속.
- **Chunk**: Rollup 이 방출한 청크. `{ fileName, size, gzipSize, brotliSize, category }`.
- **Classifier**: `(chunk) => category | null` 함수. 복수 등록 시 첫 non-null 채택.
- **Verdict**: `{ chunk, rule, observed, limit, level: 'ok'|'warn'|'fail' }`.
  하나의 chunk × rule 평가 결과.
- **Report**: `Verdict[]` 전체 집합 + 요약(`pass/warn/fail` 개수 + 총 크기).
- **Lockfile**: `.vite-budget/last-report.json` — 직전 빌드 결과 캐시. PR diff 에 사용.

## 6. 호환성 매트릭스

| 호스트 도구 | 최소 버전 | 비고 |
|-------------|-----------|------|
| Vite | 5.0 | 5.x/6.x 정기 CI. 7.x 는 release 시 추가 |
| Node.js | 18 LTS | 18/20/22 테스트 |
| Rollup | 4.x | Vite 이식 |
| Vitest | 1.x | 단위 테스트 전용 (플러그인 자체 개발용) |
| TypeScript | 5.0+ | strict |

SSR 모드와 라이브러리 모드(`build.lib`) 모두 지원. CSR/SSR 전환 시 규칙 유효성
재평가는 하지 않음(사용자 책임).

## 7. 번들 / 배포

- 패키지 이름: `vite-plugin-bundle-budget`
- 서브패스 export:
  - `vite-plugin-bundle-budget` — 기본 플러그인 팩토리
  - `vite-plugin-bundle-budget/config` — `defineBudgets` 타입 헬퍼
  - `vite-plugin-bundle-budget/cli` — CLI 확장 진입점 (내부)
- ESM 기본 + CJS 듀얼, `sideEffects: false`
- `.d.ts` 는 `tsup` 으로 생성
- peerDependency: `vite@>=5`

## 8. 버전 정책 (SemVer)

- **major**: BudgetConfig 스키마 breaking (필드 삭제·rename), 최소 Vite 버전 상승
- **minor**: 새 compression 옵션, 새 CLI 서브커맨드, 새 classifier 훅
- **patch**: 버그, 메시지 문구, 문서, 내부 리팩터

최소 2개 minor 전에 `@deprecated` 부착 후 major 에서만 제거.

## 9. 개발 마일스톤

- **M1 (1주)**: 플러그인 뼈대 + `configResolved` 훅에서 BudgetConfig 로드,
  `generateBundle` 에서 chunk 수집. 리포트는 text 만.
- **M2 (1주)**: Verdict 평가 로직 + exit code 연동. 첫 번째 e2e: 샘플 Vite 앱에서
  예산 초과 시 빌드 실패 확인.
- **M3 (1주)**: CLI 서브커맨드 3종 + JSON 포맷. `.vite-budget/last-report.json`
  저장/diff 로직.
- **M4 (1주)**: dev 서버 통합. HMR 중에 예산 초과 예상을 실시간 콘솔 경고.
  Playwright로 dev UX 회귀 테스트.
- **M5 (0.5주)**: 문서, `examples/`, 1.0 릴리즈.

전체 4.5주 + 버퍼 1주.

## 10. 예산 정책 해석 규칙

- Chunk 하나가 복수 rule 에 매치되면 **가장 엄격한 max** 채택
- `warnAt` 미지정 시 `max * 0.9` 를 기본값으로 사용
- `onFail: 'warn'` 이면 exit code 0 유지하되 stdout 에 경고
- 측정 단위는 기본 **압축 후 바이트**. `compression: 'raw'` 로 오버라이드 가능
- CSS chunk 는 JS 와 분리 classifier 로 판정 (`**/*.css` 기본 매칭)

## 11. 의존성 / 외부

- **peer**: `vite@>=5`, `rollup@>=4`
- **런타임**: `zod` (config 스키마), `picomatch` (glob), `picocolors` (터미널 색상),
  `pretty-bytes`
- **개발**: `tsup`, `vitest`, `playwright`, `@types/node`

런타임 의존 총 4개. tree-shaking 중요하므로 named import 강제.

## 12. 리스크 · 미결정

- Vite 7 의 CLI 확장 API 가 현재 5.x/6.x 와 호환 유지될지 불확실. 최악의 경우
  CLI 서브커맨드를 별도 바이너리 `bundle-budget` 로 분리해야 할 수도 있음.
- 라이브러리 모드(`build.lib`) 에서 chunk 분리 규칙이 다르게 동작. 기본 예산이
  앱 모드 가정이므로 lib 모드 전용 프리셋이 필요할지 v1 직전 결정.
- **자체 예산 self-hosting**: 이 플러그인 자체 번들도 이 플러그인으로 검사할까?
  개발 편의상 좋지만 순환 의존 위험이 있어 v1 은 size-limit 을 유지, v2 검토.
- dev 서버 경고 빈도 — 매 HMR 마다 재측정은 비싸므로 debounce + 캐시 필요.
  기준 debounce 값 미정.
- `classifiers[]` 가 서로 충돌할 때의 우선순위 정책 — v1 은 "선언 순서 우선",
  v2 에 우선순위 필드 추가 가능성.

## 13. 성공 지표

- 1.0 릴리즈 후 90일 주간 npm 다운로드 ≥ 1,000
- 사내 5개 Vite 프로젝트에서 이 플러그인이 CI 에 통합
- 평균 **예산 초과로 인한 빌드 실패 → 규칙 조정까지** 중간값 ≤ 30분 (팀 내
  관측)
- GitHub stars ≥ 150, critical bug 월 ≤ 1

## 14. 이해관계자

- **프론트엔드 개발자**: 직접 사용자. 예산 초과 시 왜 실패했는지 즉시 이해
  가능해야 함. 메시지 품질이 핵심 UX.
- **DevEx/빌드팀**: CI 통합 담당. JSON 리포트 포맷 안정성, exit code 계약,
  로그 시그니처가 주 관심.
- **플랫폼팀**: Vite 버전 업그레이드 주관. peer 호환 매트릭스 관리.
- **프로덕트/디자인**: "특정 라우트가 느린 이유 = chunk 가 크다" 를 설명할 때
  리포트를 PR 코멘트로 소환.
- **OSS 커뮤니티**: MIT 라이선스. 외부 classifier 기여 받음.

## 15. 비포함 (다시 강조)

- webpack/esbuild/rspack 지원은 v1 에서 영구 비목표
- 번들 시각화 UI 는 `rollup-plugin-visualizer` 계열에 위임
- 런타임 성능·LCP 측정은 본 플러그인 범위가 아니며, `@lighthouse` 계열과 상호 보완

## 16. 설계 원칙 (요약)

1. **설정 파일 1개 + 플러그인 1줄** 이상 요구하지 않는다
2. **exit code 는 계약이다** — CI 통합의 1급 시민
3. **측정은 gzip 기준 기본값** — raw 는 의식적 선택
4. **경고/실패 경계는 사용자 결정** — 우리는 강제하지 않음
5. **dev 에서 본 경고 = CI 에서 실패** — 놀라움 최소화

## 17. 부록: CLI 사용 예시

```bash
# 첫 도입
$ npm i -D vite-plugin-bundle-budget
$ npx vite bundle-budget init

# 개발 중 (dev 서버에 자동 훅)
$ vite
  [bundle-budget] route chunk "dashboard" 84.2kB > warnAt 60kB

# 빌드 시
$ vite build
  [bundle-budget] FAIL: routes/dashboard-a8f2.js 96.1kB > max 80kB

# CI 리포트 (빌드 후)
$ vite bundle-budget report --format=json > report.json
```
