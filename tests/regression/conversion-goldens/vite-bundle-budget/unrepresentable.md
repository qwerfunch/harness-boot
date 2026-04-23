# Unrepresentable.md — vite-plugin-bundle-budget (meta 도메인 2번째 샘플)

**대상**: `design/samples/vite-bundle-budget/plan.md` (≈220줄, 17 섹션)
**스키마**: v2.3.7
**비교 대상**: url-shortener / retro-jumper / price-crawler / vapt-apk-sast / tzcalc / **harness-boot-self**
**변환 회차**: 7회차 (Phase 2.9 — meta 어댑터 v0.0 → v0.1 승격 준비)
**자기참조**: false (OQ-5 일부 검증 — 자기참조 없는 meta 도구 첫 사례)

---

## 0. 요약

| 판정 | 개수 |
|------|------|
| 기존 갭 재현 (G-01 ~ G-16) | **12/16** (G-04/11/14 비해당, G-15/16 약한 재현) |
| 기존 신규 갭 재현 (NEW-17 ~ NEW-34) | **7/18** (NEW-17/24/26/28/30/32/33 강·부분 재현) |
| meta-플러그인 고유 신규 갭 후보 | **1개** (NEW-35 host_binding) |
| 총 갭 엔트리 | **35개** (16 G + 18 NEW-17~34 + 1 NEW-35) |

**관찰 1 — F-9 가설 HIT**: meta 어댑터 v0.0 §5.2 의 F-9 "빌드 도구는 Config 엔티티 분리" 가설이 재현됨. BudgetConfig / BudgetRule / Classifier 3엔티티로 분해되었고, 특히 **BudgetConfig 는 Spec 엔티티와 독립** — library/cli 도메인에서는 Spec 이 곧 config 였지만 meta 플러그인에서는 "플러그인 코드" 와 "사용자 config" 가 분리된 관심사.

**관찰 2 — 자기참조 부재의 단순화**: harness-boot-self 샘플과 달리 이 플러그인은 자기 자신에 대한 self-consistency 체크가 불필요했음. P-22(자기참조 self-check) 는 meta 도메인 전체의 필수 원칙이 아니라 **self-bootstrap 패턴** 의 특수 원칙임을 확인 → meta 어댑터 v0.1 에서 이를 조건부(conditional)로 표기해야 함.

**관찰 3 — host_binding 이라는 누락 개념**: Vite 플러그인은 "Vite 5/6 을 숙주로 한다" 가 제품 본질의 절반이다. 스키마에 `platform: string` 1필드만 있어 "vite>=5 <7, Vite 7 은 릴리즈 시 재평가" 같은 호스트 버전 전개를 담을 곳이 없음. 이 플러그인 하나에서 deliverable.type="cli-plugin" (vite-plugin 하위타입 부재), entry_points.kind="vite-subcommand" (현 스키마 외), peer vite>=5 제약(constraints.compat 에만) 등 **호스트 바인딩 정보가 3곳에 산포**. NEW-35 로 공식화.

**관찰 4 — NEW-29 비해당 근거**: 이 플러그인은 단일 에이전트(= 플러그인 자체) 라 agent_permissions[] 가 N/A. 그러나 classifier[] 가 "사용자 정의 확장 함수" 라는 점에서 유사한 권한 매트릭스가 잠재 — v2 에 plugin hook 등록 시 필요해질 수 있음. 현재는 "순수 함수 보장" BR-007 로 선언적으로 충분.

---

## 1. 기존 갭(G-01 ~ G-16) 재현 매트릭스

| ID | 재현 | vite-bundle-budget 에서의 구체 양상 |
|----|:----:|-------------------------------------|
| G-01 NFR | **재현** | "plugin 자체가 빌드 시간 증가시키지 않음", e2e scenarios ≥ 4 — NFR 블록 자리 없음 |
| G-02 API | **재현** | plugin factory + defineBudgets 헬퍼 + 3 CLI 서브커맨드. public_api[] 에 담을 곳 없음 (NEW-24 재확증) |
| G-03 Entity attributes | **재현** | BudgetConfig 3필드·BudgetRule 5필드·Chunk 5필드 등 필드셋이 촘촘. entities[].invariants 로 일부 수용 |
| G-04 UI screens | **비해당** | 플러그인은 UI 없음. dev 서버 콘솔 경고가 "유일한 출력 UX" 인데 CLI 범주 |
| G-05 Edge cases | **재현** | chunk 가 복수 rule 매치 / classifier 가 모두 null / lockfile schemaVersion mismatch / HMR 빈도 과다 시 debounce 포화 — BR 과 AC 로 산포 |
| G-06 External deps | **재현** | peer vite 5/6, runtime zod/picomatch/picocolors/pretty-bytes. constraints.compat + architectural 2곳에 분산 |
| G-07 Metrics | **재현** | 90일 내 주간 npm DL ≥ 1,000, 사내 5개 Vite 프로젝트 CI 통합, 빌드 실패→규칙조정 중앙값 ≤ 30분 — 자리 없음 |
| G-08 Milestones | **재현** | M1~M5 (각 0.5~1주) + 버퍼 1주, 총 4.5~5.5주. features[].priority 로는 M 기간 표현 불가 |
| G-09 Risks | **재현** | Vite 7 CLI API 호환, lib 모드 프리셋, 자체 self-hosting 순환, HMR debounce, classifier 우선순위 — open_questions OQ-1~6 으로 일부 흡수 |
| G-10 Open questions | **재현** | §12 리스크 5개 + §4.3 Vite 7 정책 — OQ-1~6 으로 정리 (6개 전부 담음) |
| G-11 Assets | **비해당** | 이미지·폰트·스프라이트 없음 |
| G-12 Tuning constants | **부분** | debounce 500ms, warnAt = max×0.9, gz 기본 측정, size 임계값 — BR-003/006 + OQ-1 로 산포 |
| G-13 Non-goals | **재현** | §3 + §15: webpack/esbuild/rspack/brotli-default/런타임성능/treemap-UI/audit — constraints 에 불재 |
| G-14 Schedule/concurrency | **비해당** | 플러그인 런타임에 스케줄러 없음. CI 매트릭스는 포함되나 별도 축 (NEW-25 성격) |
| G-15 Failure policies | **부분 재현 (meta 변형)** | onFail ∈ {error,warn,ignore} 3정책은 "실패 정책" 이지만 "배포 런타임의 장애 처리" 가 아니라 "빌드 정책". 도메인 변형 |
| G-16 Observability | **부분 재현 (메트릭 이상)** | Report 가 stdout + Lockfile + PR 코멘트 3경로 emit. "플러그인 자체의 관측 계약" 은 meta 도메인에서 매번 재등장 |

### 재현 매트릭스 누적 (7 샘플)

| 갭 | URL | retro | worker | VAPT | tzcalc | self | **vite-bb** | 재현율 |
|----|:---:|:-----:|:------:|:----:|:------:|:----:|:-----------:|:------:|
| G-01 NFR | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **7/7** |
| G-02 API | ✅ | ✅ | ✅ | ✅✅ | ✅✅ | ✅ | ✅ | **7/7** |
| G-03 Entity attrs | ✅ | ✅ | ✅ | ✅✅ | ⚠ | ✅ | ✅ | 6.5/7 |
| G-04 UI | ✅ | ✅ | ⚠ | ✅ | — | — | — | 3.5/7 |
| G-05 Edge cases | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **7/7** |
| G-06 External deps | ✅ | ✅ | ✅ | ✅✅ | ⚠ | ✅ | ✅ | 6.5/7 |
| G-07 Metrics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **7/7** |
| G-08 Milestones | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **7/7** |
| G-09 Risks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **7/7** |
| G-10 Open questions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **7/7** |
| G-11 Assets | - | ✅ | ⚠ | ⚠ | — | — | — | 2/7 |
| G-12 Tuning | - | ✅ | ✅ | ✅ | ⚠ | ⚠ | ⚠ | 4/7 |
| G-13 Non-goals | ⚠ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 5.5/7 |
| G-14 Schedule/concurrency | - | - | ✅ | ⚠ | — | — | — | 1.5/7 |
| G-15 Failure policies | ⚠ | ⚠ | ✅ | ✅ | — | ⚠ | ⚠ | 4/7 |
| G-16 Observability | ⚠ | - | ✅ | ✅ | — | ✅ | ⚠ | 4.5/7 |

**7/7 재현 확정 = 7개** (G-01/02/05/07/08/09/10) — 6샘플 기준 동일. "도메인 불변 필수 갭" 집합 재확증.

**meta 도메인 안정 비해당 = G-04/G-14** (meta 샘플 2건 모두 —). G-11 은 meta 에서는 —/— 지만 library(tzcalc)에서도 — 라 도메인 불변이 아님 (plan.md 에 이미지 없음 = 문서 스타일 신호).

---

## 2. 기존 신규 갭 (NEW-17 ~ NEW-34) 재현 여부

| ID | 재현 | 비고 |
|----|:----:|------|
| NEW-17 Tool/Skill/Agent layer | **부분** | classifier[] 가 "사용자 정의 확장 함수" 로 약한 3계층(플러그인/classifier/Vite) 존재. BR-007 로 일부 흡수 |
| NEW-18 DAG execution | **비해당** | 플러그인 훅은 Vite 의 선형 파이프라인. DAG 아님 |
| NEW-19 Benchmark GT | **비해당** | 플러그인 자체 벤치마크 없음 |
| NEW-20 Pricing/tenant tier | **비해당** | MIT OSS 단일 티어 |
| NEW-21 Diagram/mermaid | **비해당** | plan.md 에 도식 없음 (CLI 예제 코드 블록만) |
| NEW-22 Self-evolving | **비해당** | 자가진화 파이프라인 아님 |
| NEW-23 (security-specific) | **비해당** | VAPT 고유 갭, 여기 해당 없음 |
| NEW-24 public_api[] | **재현 (HIT)** | plugin factory `bundleBudget()` + `defineBudgets()` 2 공개 심볼 + CLI 3 서브커맨드. library 샘플(tzcalc)의 NEW-24 가 meta 에서도 동일 재현 — public_api[] 가 **도메인 초월 필수 후보** 임을 확증 |
| NEW-25 Compatibility matrix | **부분 재현** | Vite 5/6/7, Node 18/20/22, Rollup 4 매트릭스. tzcalc 의 compat 표보다 단순 (peer 중심) |
| NEW-26 deliverable.artifacts[] | **재현 (HIT)** | npm 패키지 (ESM+CJS+.d.ts+3 subpath) + Lockfile(`.vite-budget/last-report.json`) — artifacts[] 가 강하게 재현 |
| NEW-27 (library subtype) | **부분** | tzcalc 고유 갭이었으나 여기서도 재현: `deliverable.type="cli-plugin"` 로 대응했으나 **실제는 "vite-plugin" 하위타입이 더 정확** — NEW-35 와 연동 |
| NEW-28 command_map[] | **재현 (HIT)** | 3 CLI 서브커맨드 + CQS(init=쓰기/report=읽기/check=둘다) + mode(build-with/without). features[F-006~008] 과 deliverable.entry_points[] 양쪽에 중복 발생 — self 샘플의 F-1 함정 재현 |
| NEW-29 agent_permissions[] | **비해당** | 단일 에이전트(플러그인 자체). classifier 확장 API 가 약한 권한 경계지만 "tool matrix" 규모 아님 |
| NEW-30 gate_chain[] | **재현 (HIT)** | ok/warn/fail 3티어 + buildEnd exit code + dev warning 의 4단계 파이프라인이 gate 성격. BR-002/008/F-004 에 산포 |
| NEW-31 drift_catalog[] | **부분** | Lockfile schemaVersion mismatch / classifier 결과 ↔ default 분류 불일치 / config edit vs 재생성 — 3 개 drift 후보가 암묵. self 샘플의 8 drift 보다 적음 |
| NEW-32 versioning_axes[] | **부분 재현** | (a) 플러그인 SemVer, (b) JSON Report 포맷 안정 계약(BR-010), (c) BudgetConfig 스키마 SemVer — 3축이 BR-010 과 SemVer 정책 사이에 분산 |
| NEW-33 ambient_files[] | **재현 (HIT)** | `bundle-budget.config.ts` (SSoT, edit-wins) + `.vite-budget/last-report.json` (파생, overwrite-per-build) + `.vite-budget/` 디렉터리 자체 (gitignore 권장) — authorship/write_policy/on_rerun 3축이 모두 적용되는 meta 도메인 공통 패턴 확증 |
| NEW-34 preamble_contract | **비해당** | 플러그인 자체는 고정 preamble 없음. Report 출력 포맷(`[bundle-budget] ...`)은 prefix 수준 |

### NEW 재현 매트릭스 (VAPT/tzcalc/self/vite-bb 4개 샘플)

| NEW | VAPT | tzcalc | self | vite-bb | 재현율 | 의미 |
|-----|:----:|:------:|:----:|:-------:|:------:|------|
| NEW-17 Tool/Skill/Agent | ✅✅ | ⚠ | ✅ | ⚠ | 3/4 | meta·security 에서 강함 |
| NEW-22 Self-evolving | ⚠ | — | ✅ | — | 1.5/4 | self 고유에 가까움 |
| NEW-24 public_api[] | — | ✅✅ | ✅ | ✅✅ | **3.5/4** | **도메인 초월 필수 후보** |
| NEW-26 deliverable.artifacts[] | ⚠ | ✅✅ | ✅ | ✅✅ | 3.5/4 | library + meta 에서 강함 |
| NEW-28 command_map[] | — | — | ✅✅ | ✅✅ | 2/2 meta | **meta 불변 필수 ★** |
| NEW-30 gate_chain[] | ⚠ | — | ✅✅ | ✅ | 2.5/4 | meta 에서 강함 |
| NEW-33 ambient_files[] | — | — | ✅✅ | ✅✅ | 2/2 meta | **meta 불변 필수 ★** |

**결론**: meta 도메인(self + vite-bb 2샘플) 에서 **NEW-28 · NEW-33 가 2/2 로 불변 필수**. NEW-30 도 강함. NEW-24 는 library + meta 공통이라 **전역 HIGH P0 1순위**. v2.4.0 RFC 의 P0 5 필드 우선순위가 실증됨.

---

## 3. 신규 갭 공식화 — NEW-35

### NEW-35 **host_binding[]** (meta 도메인 플러그인 특이)

**의미**: 메타 도구(플러그인·확장·integrator) 가 **숙주 도구(host)** 에 바인딩될 때의 호환 범위·훅 참여·호스트 버전 전개를 1 블록으로 기술.

**필요성**: 현 v2.3.7 스키마에서 이 정보가 최소 3곳에 산포:
1. `deliverable.type` — 플러그인 하위타입 부재 (vite-plugin vs eslint-plugin 구분 불가)
2. `deliverable.platform` — 문자열 1개라 "vite 5/6, vite 7 은 재평가" 같은 전개 표현 불가
3. `constraints.compat.vite` — peer 버전 범위 (명목상 기술적 제약)
4. 코드(import 문의 `import type {Plugin} from 'vite'`) — 호스트 타입 의존

**재발 조건**: 다른 도구를 숙주로 하는 플러그인·확장·integrator. 예:
- vite-plugin-* (검증됨)
- eslint-plugin-* (OQ-1 예정)
- vscode-extension (OQ-2 예정)
- webpack-plugin, rollup-plugin, babel-plugin
- slack-app, github-action

**제안 필드 (v2.5 후보, v2.4.0 P1 격상 검토)**:
```yaml
host_binding:
  - host: "vite"                       # 숙주 도구 식별자
    version_range: ">=5 <7"
    hooks: ["configResolved", "generateBundle", "buildEnd"]
    subcommand_prefix: "vite bundle-budget"   # CLI 확장
    upgrade_policy: "next-major-on-host-break"
    type_imports: ["Plugin", "Rollup.OutputChunk"]
```

**v2.4.0 RFC 와의 관계**: NEW-35 는 P0 5필드 밖 (P1 후보). 그러나 **NEW-28 command_map[] 에 `surface` 필드가 추가되면 "vite-subcommand" 로 약간 흡수 가능**. 완전한 해결은 v2.5 에서 host_binding[] 도입.

---

## 4. 변환 전/후 매핑 실제 위치

| 원본 섹션 | 이상적 위치 | 실제 위치 (v2.3.7) |
|-----------|-------------|---------------------|
| §2 목표 3축 | project.vision + BR 매트릭스 | BR-001/002/006/008 로 산포 |
| §4.1 플러그인 API | public_api[] + command_map[] | entities.Plugin + deliverable.entry_points[] |
| §4.2 설정 파일 스키마 | entities.Config + config_schema | entities.BudgetConfig/BudgetRule/Classifier + F-002 (zod) |
| §4.3 CLI 서브커맨드 | command_map[] (3 row) | entry_points[] (3 row) + features F-006/007/008 중복 |
| §5 핵심 엔티티 8개 | entities[] 그대로 | entities[] 그대로 ★ 잘 들어맞음 |
| §10 예산 정책 해석 규칙 | verdict_evaluation_rules[] | BR-003/004/006 + F-003 AC |
| §12 리스크·미결정 | open_questions[] + risk_register[] | open_questions[] 로 전환, risk_register 자리 없음 |
| §14 이해관계자 | stakeholders[] | stakeholders[] 그대로 ★ |
| §16 설계 원칙 | design_principles[] | BR-001/002/008 + project.vision 산포 |
| §17 부록 CLI 예시 | examples[] | 자리 없음 — conversion-notes 로 이관 |

**전체 원본 섹션 수 = 17, spec 매핑 성공 ≥ 13** (77% 매핑). `§17 부록 예시` 는 v2.3.7 스키마에 자리가 없어 notes 로 이관. self 샘플의 65% ★★★+ 와 비슷하거나 상회 예상 — backlink-matrix.md 에서 측정.

---

## 5. 결론 및 v2.4.0 RFC 영향

1. **P0 HIGH 5필드 (v2.4.0 RFC) 가 재확증됨**:
   - NEW-24 public_api[] : tzcalc → self → vite-bb 3 샘플 연속 HIT
   - NEW-28 command_map[] : self + vite-bb 2/2 meta 필수
   - NEW-33 ambient_files[] : self + vite-bb 2/2 meta 필수
   - NEW-30 gate_chain[] : self 강 + vite-bb 재현
   - NEW-29 agent_permissions[] : vite-bb 에서는 비해당 확증 → agent 수 ≥ 2 조건부 필수로 RFC 재검토 필요

2. **NEW-35 host_binding[] 추가 제안** (v2.5 후보, 또는 v2.4.0 P1 승격 검토):
   - vite-bb 에서 명확히 드러남
   - 다른 plugin 계열 도구(eslint/webpack/vscode-ext)에서도 재현 예상
   - OQ-2/3/4 로 v0.1 adapter promotion 시 검증

3. **self-consistency(P-22) 의 범위 좁히기**:
   - vite-bb 에서 P-22 자기참조 self-check 가 N/A
   - meta 어댑터 v0.1: "P-22 는 self_reference=true 샘플에만 적용" 으로 명시

4. **F-9 가설 HIT 확정**:
   - BudgetConfig/BudgetRule/Classifier 3엔티티 분리 실제 재현
   - meta 어댑터 §5.2 F-9 를 §5.1 관찰된 함정으로 격상 가능

5. **deliverable.type "vite-plugin" 부재**:
   - 현재 "cli-plugin" 로 근사하였으나 부정확
   - NEW-35 가 해결하면 type 은 "plugin" 단일화 + host_binding 으로 분화 가능
