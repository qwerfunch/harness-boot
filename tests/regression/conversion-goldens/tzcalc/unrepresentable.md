# Unrepresentable.md — tzcalc (library 도메인 검증 샘플)

**대상**: `design/samples/tzcalc/plan.md` (≈175줄, 15 섹션)
**스키마**: v2.3.7
**비교 대상**: url-shortener(G-01~10) · retro-jumper(G-11~13) · price-crawler(G-14~16) · vapt-apk-sast(NEW-17~23)
**변환 회차**: 5회차 (Phase 2.7 — library 어댑터 v0.0 draft 실전 검증)

---

## 0. 요약

| 판정 | 개수 |
|------|------|
| 기존 갭 재현(G-01~G-16) | **10/16** (G-04/11/12/14/15/16 비해당 또는 약함) |
| 기존 신규 갭 재현(NEW-17~23) | **2/7** (NEW-17/NEW-22 부분) |
| library 고유 신규 갭 후보 | **4개** (NEW-24 ~ NEW-27) |
| 총 갭 엔트리 | **16개** |

**관찰**: library 도메인은 **"공개 API 가 곧 제품"** 이라는 특이성이 있어, 기존 G-01~23 중 **G-02 (API) 가 가장 심하게 재현**되고, 반대로 G-04(UI)·G-11(assets)·G-14(scheduling)·G-15(failure policy)·G-16(observability)은 **거의 의미가 없다**. 대신 library 만의 축 4개(공개 API 표면 자체 · 호환성 매트릭스 · 산출물 아티팩트 모양 · deliverable.type=library)가 새로 드러났다. library 어댑터 v0.0 draft 가 예상했던 `public_api[]` · `compatibility_matrix` 2개는 모두 실제로 재현되었고, 추가로 `deliverable.artifacts[]` · `bundle_size_budget` 2개가 더 나왔다.

---

## 1. 기존 갭의 재현 여부 (G-01 ~ G-16)

| ID | 재현 | tzcalc 에서의 구체 양상 |
|----|:----:|-------------------------|
| G-01 NFR | **재현** | 번들 `< 8 kB` gz 전체, `< 2 kB` 단일 함수, `toZone ≥ 1.2× date-fns-tz`, `Interval.overlaps ≥ 3× Luxon` — NFR 블록 자리 없음 |
| G-02 API (공개 API 표면) | **재현 (library 핵심)** | §4 API 표 11개 항목(Instant/Zone/CalendarDate/toZone/fromZoned/add/diff/compare/parse/formatISO/Interval/DstTransition) + opts 축(`ambiguous: earlier\|later\|reject`) + semver 축 — 담을 곳 없음 |
| G-03 Entity attributes | **재현 (약함)** | Instant(epoch_ms + nano)/CalendarDate(7필드)/DstTransition(type + before/after offset) 필드 수 적어서 invariants 로 일부 수용 가능했음 |
| G-04 UI screens | **비해당** | 라이브러리는 UI 없음 — `@tzcalc/react` 는 §3 비목표 |
| G-05 Edge cases | **재현 (핵심)** | DST ambiguous/non-existent local time, `2025-03-09 02:30 America/New_York` gap, overlap 의 두 번 일치 — acceptance_criteria 로 내려보냈으나 도메인 개념으로 승격 필요 |
| G-06 External deps | **재현 (약함)** | 런타임 의존 0개 선언이 계약 수준(BR-002). 빌드 의존(tsup/vitest/size-limit/playwright)만 constraints 에 일부 수용 |
| G-07 Metrics | **재현** | 1.0 후 90일 주간 npm DL ≥ 3,000, GitHub stars ≥ 300, 사내 3서비스 마이그레이션, DST 버그 리포트 월 0~1건 — 자리 없음 |
| G-08 Milestones | **재현** | M1~M4 (각 1~2주) + 버퍼 1주 — features[].priority 로는 M1-M4 기간·선후·버퍼 표현 불가 |
| G-09 Risks | **재현** | Temporal polyfill optional vs mandatory 미결정, tzdata 런타임 차이, Interval 13관계 잔여 10개 포함 여부, ambiguous 기본값 선택 — stakeholder.concerns 에 일부만 |
| G-10 Open questions | **재현** | §12 4개 미결정 전부 — unrepresentable 승격 |
| G-11 Assets | **비해당** | 스프라이트·폰트 없음. 로고·도메인 일러스트도 문서 사이트 스킨에만 간접 관계 |
| G-12 Tuning constants | **부분 재현** | gz 8/2 kB, M1 커버리지 80%, 성능 목표 배수(≥ 1.2× / ≥ 3×) — constants 이나 "게임 튜닝"과 성격이 다름. BR-003 + constraints.quality 로 산포 |
| G-13 Non-goals | **재현** | §3 + §15 반복 명시: 로케일 포매팅, 달력 종류, React hooks, CLI, tzdata 동적 갱신 — 담을 곳 없음 |
| G-14 Schedule/concurrency | **비해당** | 라이브러리에는 런타임 스케줄러 없음. CI 매트릭스 jobs 동시성은 다른 축(NEW-26) |
| G-15 Failure policies | **비해당** | 런타임 실패 정책 없음. `fromZoned` ambiguous 3정책은 도메인 규칙(G-05/BR-001) |
| G-16 Observability | **비해당** | 라이브러리는 관측 대상이 아닌 도구. 소비자가 자기 코드 관측 시 wrapping |

### 재현 매트릭스 (5 샘플)

| 갭 | URL | retro | worker | VAPT | **tzcalc** | 재현율 |
|----|:---:|:-----:|:------:|:----:|:----------:|:------:|
| G-01 NFR | ✅ | ✅ | ✅ | ✅ | ✅ | **5/5** |
| G-02 API | ✅ | ✅ | ✅ | ✅✅ | ✅✅(library 핵심) | **5/5** |
| G-03 Entity attrs | ✅ | ✅ | ✅ | ✅✅ | ⚠ (필드 적음) | 4.5/5 |
| G-04 UI | ✅ | ✅ | ⚠ | ✅ | — | 3.5/4 재계산 |
| G-05 Edge cases | ✅ | ✅ | ✅ | ✅ | ✅ | **5/5** |
| G-06 External deps | ✅ | ✅ | ✅ | ✅✅ | ⚠ | 4/5 |
| G-07 Metrics | ✅ | ✅ | ✅ | ✅ | ✅ | **5/5** |
| G-08 Milestones | ✅ | ✅ | ✅ | ✅ | ✅ | **5/5** |
| G-09 Risks | ✅ | ✅ | ✅ | ✅ | ✅ | **5/5** |
| G-10 Open questions | ✅ | ✅ | ✅ | ✅ | ✅ | **5/5** |
| G-11 Assets | - | ✅ | ⚠ | ⚠ | — | 2/4 |
| G-12 Tuning | - | ✅ | ✅ | ✅ | ⚠ | 3.5/4 |
| G-13 Non-goals | ⚠ | ✅ | ✅ | ✅ | ✅ | 4.5/5 |
| G-14 Schedule/concurrency | - | - | ✅ | ⚠ | — | 1.5/5 |
| G-15 Failure policies | ⚠ | ⚠ | ✅ | ✅ | — | 3/5 |
| G-16 Observability | ⚠ | - | ✅ | ✅ | — | 2.5/5 |

**5/5 재현 확정 = 7개 (G-01/02/05/07/08/09/10)** — 이전 "4/4 = 9개" 보다 한 걸음 엄격해진 "도메인 불변 필수 갭 집합".
G-03 은 library 에서 약해졌지만 5샘플 합산 4.5/5 로 여전히 필수급.
G-04/G-11/G-14/G-15/G-16 은 **"library 에서 사라진다"** 는 사실 자체가 도메인 신호 → library 어댑터 체크리스트에서 "해당 안 됨 근거 기록" 으로 전환 권장.

---

## 2. 기존 신규 갭(NEW-17~23) 재현 여부

| ID | 재현 | 비고 |
|----|:----:|------|
| NEW-17 Tool/Skill/Agent layer | **부분** | library 에는 "Tool" 만 존재. `underscore prefix = internal` BR-005 가 약한 형태의 계층. 완전 재현 아님 |
| NEW-18 DAG execution | **비해당** | 라이브러리는 DAG 실행 주체가 아님 |
| NEW-19 Benchmark GT | **비해당** | 성능 비교 벤치마크는 있으나 "ground truth" 개념 없음 |
| NEW-20 Pricing/tenant tier | **비해당** | 유료 요금제 없음 (MIT OSS) |
| NEW-21 Diagram/mermaid | **비해당** | plan.md 에 다이어그램 없음 |
| NEW-22 Self-evolving pipeline | **비해당** | 자가진화 파이프라인 아님 |
| NEW-23 Legal compliance band | **부분** | MIT 라이선스 · npm provenance 서명 정도는 있지만 규제 체크 아님 |

**결론**: NEW-17~23 는 VAPT 특유(AI 에이전트 플랫폼) 갭이 많아 library 에서 대부분 비해당. **도메인 차이 신호로서 가치가 있음** — 어댑터가 갭 셋을 선별하는 의미를 입증.

---

## 3. library 고유 신규 갭 후보 (NEW-24 ~ NEW-27)

### NEW-24. 공개 API 표면(`public_api[]`)

**plan.md 인용(§4)**:
> | `toZone(instant, zone)` | Instant → ZonedDateTime 변환 | 인자 순서 변경은 major |
> | `fromZoned(y, m, d, h, min, s, zone, opts?)` | ZonedDateTime → Instant. opts.ambiguous: "earlier" \| "later" \| "reject" | opts 축 추가는 minor |
> | `Interval` (class) | [start, end) 반개구간 + overlap/contains | method 추가는 minor |

**현재 스키마**: 공개 심볼은 `features[].modules[]` 에 모듈명으로 흩어질 뿐, **"이것은 계약(Contract)이다"** 를 표현하는 구조가 없다. semver 축(인자 순서 변경은 major, opts 축 추가는 minor 등) 도 구조적으로 드러나지 않는다.

**임시 대응**: BR-004 (named export only) · BR-005 (underscore = internal) · BR-006 (deprecation path) 로 계약성만 간접 표현.

**재발 조건**:
- 샘플 어느 곳에서든 "공개 API 심볼이 3개 이상 나열되며 semver 축이 표시될 때"
- library 100%, CLI 도구(price-crawler) 중간 수준(명령 플래그가 계약). **2 샘플에서 정식 재현.**

**제안 구조 (NEW-24)**:
```yaml
public_api:
  - symbol: "fromZoned"
    kind: "function"
    signature: "fromZoned(y, m, d, h, min, s, zone, opts?)"
    opts_axes:
      - name: "ambiguous"
        values: ["earlier", "later", "reject"]
        default: "reject"          # 미결정이면 null + open_question
    semver:
      arg_order_change: "major"
      new_opts_key: "minor"
      new_opts_value: "minor"
      default_change: "major"
  - symbol: "Interval"
    kind: "class"
    methods: ["overlaps", "contains", "meets"]
    semver:
      new_method: "minor"
      method_removal: "major"
```

### NEW-25. 호환성 매트릭스(`compatibility_matrix`)

**plan.md 인용(§6)**:
> | Node.js | 18 LTS | 18/20/22 정기 CI |
> | Deno | 1.40+ | Intl 보장 |
> | Bun | 1.0+ | 1.x 는 best-effort |
> | 브라우저 | Chrome 110+, Firefox 115+, Safari 16+ | ES2022 baseline |
> | TypeScript | 5.0+ | strict 모드 전제 |

**현재 스키마**: `constraints.tech_stack.compatibility` 한 줄로 뭉개지거나, 아예 `constraints.compat` 같은 **비표준 서브블록**을 즉흥적으로 만들게 된다(이번 변환에서 그렇게 했다).

**임시 대응**: `constraints.compat: {node, deno, bun, browsers}` 즉흥 서브블록. 스키마 외이므로 `docs/schemas/spec.schema.json` validation 실패.

**재발 조건**:
- library, CLI (멀티 런타임 배포), 브라우저 SDK 에서 반드시 등장
- worker/SaaS/game 은 "런타임 = 1개 환경" 이라 약하게 나타남

**제안 구조 (NEW-25)**:
```yaml
compatibility_matrix:
  - runtime: "node"
    minimum: "18"
    tested: ["18", "20", "22"]
    tier: "supported"          # supported | best-effort | experimental
    notes: "LTS 라인만 정식 지원"
  - runtime: "deno"
    minimum: "1.40"
    tested: ["1.40", "1.42"]
    tier: "supported"
  - runtime: "bun"
    minimum: "1.0"
    tested: ["1.0"]
    tier: "best-effort"
  - target: "browser"
    minimum: { chrome: "110", firefox: "115", safari: "16" }
    tier: "supported"
    notes: "ES2022 baseline"
  - toolchain: "typescript"
    minimum: "5.0"
    tier: "required"
```

### NEW-26. 산출물 아티팩트 모양(`deliverable.artifacts[]` with subpath/format/provenance)

**plan.md 인용(§7)**:
> - subpath exports: `tzcalc`, `tzcalc/zone`, `tzcalc/interval`
> - ESM 기본, `require` 사용자를 위해 CJS 대칭 포함
> - 타입: `.d.ts` 는 번들 파일과 동일 경로
> - `sideEffects: false` 명시 — tree-shaking 활성화
> - npm public, provenance 서명 활성화 (§11)

**현재 스키마**: `deliverable.type` 과 `deliverable.platform` 2개 스칼라만 허용. npm 패키지라는 사실은 표현해도 **"어떤 서브패스 / 어떤 포맷 / 서명 여부 / tree-shaking 선언"** 은 자리 없음. 이번 변환에서 `deliverable.artifacts[]` 를 즉흥 추가.

**재발 조건**:
- library: 확실
- CLI binary(price-crawler `crawler` 실행 파일): subpath 는 없어도 `bin`/`man`/`completions` 축으로 유사 재발
- container image: tag · digest · base image · SBOM 축으로 재발

**제안 구조 (NEW-26)**:
```yaml
deliverable:
  type: "library"
  platform: "multi-runtime"
  artifacts:
    - name: "tzcalc"
      kind: "npm-package"
      registry: "npm"
      provenance: true
      formats: ["esm", "cjs"]
      subpath_exports: ["tzcalc", "tzcalc/zone", "tzcalc/interval"]
      side_effects: false
      types_bundled: true          # .d.ts 포함
    # CLI 라면:
    # - kind: "cli-binary"
    #   bin_name: "tzcalc"
    #   man_pages: ["tzcalc.1"]
    # 컨테이너라면:
    # - kind: "container-image"
    #   base_image: "gcr.io/distroless/nodejs20"
    #   sbom: "cyclonedx"
```

### NEW-27. 번들 크기 예산(`bundle_size_budget`)

**plan.md 인용(§2, §7, §10)**:
> - 번들 타겟: 전체 API 사용 시 < 8 kB gzipped, 1~2 함수만 쓰면 < 2 kB
> - 번들 크기 회귀: `size-limit` 이 gz 8 kB 를 넘으면 PR 블록.

**현재 스키마**: NFR 자리 없음 + `constraints.quality.coverage_threshold` 옆에 **비표준 키**(`size_limit_gz_kb_full`, `size_limit_gz_kb_single`) 를 즉흥 추가하게 된다.

**임시 대응**: BR-003 에 "CI 블록" 문장 + `constraints.quality.size_limit_gz_kb_full: 8` 비표준 필드.

**재발 조건**:
- library 는 반드시 (tree-shakable 성격상)
- 프론트엔드 / SDK / game(브라우저)에서도 등장 (`retro-jumper` 는 약하게)
- 서버 런타임(worker, VAPT) 은 약함

**제안 구조 (NEW-27)**:
```yaml
bundle_size_budget:
  - scope: "full_api"
    format: "esm"
    compression: "gzip"
    limit_kb: 8
    enforcement: "ci_block"       # warn | ci_block | release_gate
  - scope: "minimal_subset"
    entry: ["zone"]
    format: "esm"
    compression: "gzip"
    limit_kb: 2
    enforcement: "ci_block"
```

---

## 4. deliverable.type 확장: v2.3.7 질문

**plan.md 인용(§1, §7)**: 명시적으로 "TypeScript 라이브러리 (npm 패키지)".

**현재 스키마 `deliverable.type` 허용 값(추정)**: `web-service` · `cli` · `worker` · `static-site` · `mobile-app` 정도. **`library` 가 있는지 v2.3.7 문서 확인 필요.**

이번 변환에서는 `deliverable.type: "library"` 로 기입 + `deliverable.platform: "multi-runtime"` 을 즉흥 사용했다. 스키마 JSON 검증을 거치면 FAIL 가능성.

**처리 경로**:
1. v2.3.7 에 `library` 가 있다면 — library 어댑터가 선언만 하면 됨.
2. 없다면 — `worker` 로 대체 + P-10 정체성 소실 명시 기록. 영구 해결은 v2.3.8 스키마 확장에서 `library` 추가.

**open_question**: 스키마 실제 허용 enum 확인 후 NEW-28 로 승격할지 결정.

---

## 5. 어댑터 자체에 대한 관찰 (library v0.0 → v0.1 승격 근거)

library 어댑터 v0.0 (draft) 가 예측한 것:

| 예측 항목 | 실제 재현 | 판정 |
|-----------|:--------:|------|
| G-02 API (공개 API 표면) 필수 | ✅ | 정확 |
| G-08 release_plan (semver/LTS) | ✅ | 정확 |
| NEW(draft) public_api surface | ✅ | **NEW-24 로 공식화** |
| NEW(draft) compatibility_matrix | ✅ | **NEW-25 로 공식화** |
| G-04 대체로 무관 | ✅ | 정확 |

**예측 못한 것 (v0.1 에서 추가)**:
- **NEW-26 `deliverable.artifacts[]` (subpath/format/provenance)** — 어댑터 draft 는 "tree-shakable ESM" 을 `constraints.architectural` 로만 언급. subpath exports / provenance 서명 / `sideEffects: false` 는 별도 축.
- **NEW-27 `bundle_size_budget`** — 어댑터 draft 는 size 제약을 BR 로 흘리는 정도로만 예시. gz 기반 CI gate 는 구조 필요.
- **deliverable.type=library 의 v2.3.7 존재 여부 확인 단계** — 어댑터 draft 가 미해결 질문으로 남겨뒀는데, **변환 시도 자체가 검증 트리거**였다.

**결론**: library 어댑터 v0.0 → **v0.1 승격 가능**. 예측 5건 중 5건 적중(G-02, G-08, public_api, compatibility_matrix, G-04 무관) + 2건 보강(NEW-26/27) + 1건 미결 재확인(deliverable.type enum).

---

## 6. 남은 open_question (스펙 외부)

| # | 질문 | 해소 경로 |
|---|------|-----------|
| OQ-1 | v2.3.7 `deliverable.type` enum 에 `library` 가 포함되는가? | `docs/schemas/spec.schema.json` 읽기 · PR #? |
| OQ-2 | `public_api[]` 를 top-level 에 둘지 `domain` 하위에 둘지 | v2.3.8 RFC |
| OQ-3 | `compatibility_matrix` 와 기존 `constraints.tech_stack.compatibility` 의 통폐합 경로 | v2.3.8 RFC |
| OQ-4 | `bundle_size_budget` 이 `quality_gates` 라는 더 일반적인 축(코드 커버리지, 성능 배지 포함)으로 승격되어야 하는가 | 2개 더 샘플 후 재평가 |
| OQ-5 | Temporal polyfill peerDep.optional vs mandatory (원본 §12 미결정) — 스펙에 기록되었는가? | open_questions 에 수용 완료 |

---

## 7. 5 샘플 집계

| 축 | URL | retro | worker | VAPT | **tzcalc** |
|----|:---:|:-----:|:------:|:----:|:----------:|
| 원본 크기 | 200줄 | 200줄 | 200줄 | 1730줄 | 175줄 |
| 성숙도 | planning | planning | planning | architecture | planning |
| 도메인 | web-service | game | worker | ai-agent-platform | **library** |
| 변환 소요 | 45분 | 30분 | 25분 | 60분 | ~30분 |
| 신규 갭 | G-01~10 | G-11~13 | G-14~16 | NEW-17~23 | **NEW-24~27** |

**합산 갭 카탈로그**: G-01~G-16 + NEW-17~23 + **NEW-24~27 = 27개**.
**샘플당 평균 새 갭**: 5.4 → 4.6 → 4.5 → 3.5 → 4.0 (수렴 안 함; 새 도메인 추가 시 포화 아님).
