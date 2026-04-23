# Unrepresentable.md — APK SAST Harness (VAPT v4.5)

**대상**: `uploads/VAPT_ARCHITECTURE_v4_5.md` (≈1730줄, 28 섹션 + 부록 A~D)
**스키마**: v2.3.7
**비교 대상**: url-shortener(G-01~G-10), retro-jumper(G-11~G-13), price-crawler(G-14~G-16)
**변환 회차**: 4회차 (Phase 2.5 — skill v0.2 real-world stress test)

---

## 0. 요약

| 판정 | 개수 |
|------|------|
| 기존 갭 재현(G-01~G-16) | **15/16** (G-11 부분) |
| 신규 갭 | **7개** (NEW-17 ~ NEW-23) |
| 총 갭 엔트리 | **22개** |

**관찰**: 원본이 "기획"이 아니라 "아키텍처 v4.5"라는 성숙도를 가지고 있어, 단순 누락이 아니라 **의도된 구조 결정이 담길 자리조차 없는 사례**가 다수. v2.3.7 이 커버하는 "도메인 + 피처" 프레임 바깥의 개념(도구 레지스트리·LLM 라우팅·자가진화 파이프라인·벤치마크 GT·요금제 테이블·다이어그램)이 중심적으로 등장.

---

## 1. 기존 갭의 재현 여부 (G-01 ~ G-16)

| ID | 재현 | VAPT 도메인 구체 양상 |
|----|------|----------------------|
| G-01 NFR | **재현** | F1 L1>83%, L2>87%, +20~30%p recall vs MobSF, 비용 L2 \\$0.74/APK, graph 폴백 F1>65%, deep 최대 2h timeout — 전부 구조적 자리 없음 |
| G-02 API | **재현 (대규모)** | REST: POST /api/scans, GET /api/scans/{id}, GET /api/scans/{id}/result, GET /api/scans/{id}/artifacts, GET /api/history, POST /api/keys ; WebSocket: /ws/scans/{id} 이벤트 프로토콜(queued/started/progress/log/completed) |
| G-03 Entity attributes | **재현 (극심)** | Vulnerability 50+ 필드(11개 그룹), ToolDefinition 11필드, ScanResult 다중 서브필드, AgentResult, EscalationFlag, ChainTemplate — 모두 invariants 자연어로만 부분 기술 |
| G-04 UI screens | **재현** | 3개 핵심 화면 + 컴포넌트 트리(SecurityScoreRing, ChainFlow, FileDropzone 등), React 라우팅, WebSocket 통합 — 담을 자리 없음 |
| G-05 Edge cases | **재현** | jadx 실패·unzip 폴백·AXML 깨짐·Kotlin 코루틴·R8 심한 난독화·악성 APK 자체의 분석 환경 공격·Graph 실패 — BR/AC 에 산포 |
| G-06 External deps | **재현 (대규모)** | apktool, jadx, baksmali, dex2jar, bundletool, androguard, yara-python, libsast, igraph, cyclonedx-python-lib, cvss, langgraph, langchain, boto3, python-jose, WeasyPrint, React, Tailwind, react-dropzone, Recharts, Prism.js ; AWS Bedrock(Sonnet4/Haiku4/Llama3.1), Auth0/Cognito, Exodus, VirusTotal(옵션) |
| G-07 Metrics | **재현** | F1 L1>83%/L2>87%, recall·precision·fp_rate, delta_f1 vs MobSF, P50/P95 스캔 시간, per-APK 비용 — 전부 누락 |
| G-08 Milestones | **재현** | Phase 1~7 + Phase 6 세부(Phase 6a/b/c) + §27 개발 순서 — priority 숫자로 축소 불가 |
| G-09 Risks | **재현** | Taint DB 74개 테스트 미흡, Kotlin 코루틴 엔진 미구현, SCA DB 구축 필요, Cold start calibration, Legal compliance 미결 — stakeholders.concerns 에 부분만 |
| G-10 Open questions | **재현** | §C GAP-1~GAP-5(Tracker/도메인/APKiD/VT/인증서), Phase 미정 항목, 미래 확장 후보 다수 — 일부는 AC 에 자연어로 흘림 |
| G-11 Assets | **부분 재현** | Taint propagation rules YAML 74개, chain_templates T001~T013 YAML 13개, lib_fingerprint_db (SHA 인덱스 + LSH), tool_registry JSON — "에셋"보다는 "데이터/구성물" 성격 |
| G-12 Tuning constants | **재현 (대량)** | precision 0.85 (승격 게이트), recall 회귀 알람, confidence [0,1] 구간, 벤치마크 임계, LLM temperature, timeout 2h, concurrency 1 per scan, 도구 실행 초당 제한 — 모두 BR 에 흘림 |
| G-13 Non-goals | **재현** | iOS IPA, DAST(Frida/mitmproxy), Incremental scan, RedTeam agent, SDK 자동 관리 — §28 미래 확장으로 묶였지만 "비목표"로서의 구조 없음 |
| G-14 Schedule/concurrency | **부분** | 주간 MobSF 비교 CI/CD, 스캔 동시성 per-tenant 쿼터, per-scan 동시성, rate limit — worker 만큼 강하진 않지만 유의미 |
| G-15 Failure policies | **재현** | 5단계 graceful degradation(jadx→smali→unzip, Graph→없이, LLM→L1), per-tool timeout, seccomp violation → abort, LLM 비용 초과 → downgrade — §17 내용이지만 분리된 구조 없음 |
| G-16 Observability | **재현** | JSON logging, Prometheus metrics, Grafana 대시보드, SLI/SLO, WebSocket 스트림, 실시간 진행률, scan-level trace — 전부 문서에만 |

### 재현 매트릭스 (4 샘플)

| 갭 | URL | retro | worker | **VAPT** | 재현율 |
|----|:---:|:-----:|:------:|:--------:|:------:|
| G-01 NFR | ✅ | ✅ | ✅ | ✅ | **4/4** |
| G-02 API | ✅ | ✅ | ✅ | ✅ | **4/4** |
| G-03 Entity attrs | ✅ | ✅ | ✅ | ✅✅(극심) | **4/4** |
| G-04 UI | ✅ | ✅ | ⚠ | ✅ | 3.5/4 |
| G-05 Edge cases | ✅ | ✅ | ✅ | ✅ | **4/4** |
| G-06 External deps | ✅ | ✅ | ✅ | ✅✅(대규모) | **4/4** |
| G-07 Metrics | ✅ | ✅ | ✅ | ✅ | **4/4** |
| G-08 Milestones | ✅ | ✅ | ✅ | ✅ | **4/4** |
| G-09 Risks | ✅ | ✅ | ✅ | ✅ | **4/4** |
| G-10 Open questions | ✅ | ✅ | ✅ | ✅ | **4/4** |
| G-11 Assets | - | ✅ | ⚠ | ⚠ | 2/4 |
| G-12 Tuning | - | ✅ | ✅ | ✅ | **3/3 (신규 이후 전수)** |
| G-13 Non-goals | ⚠ | ✅ | ✅ | ✅ | 3.5/4 |
| G-14 Schedule/concurrency | - | - | ✅ | ⚠ | 1.5/4 |
| G-15 Failure policies | ⚠ | ⚠ | ✅ | ✅ | 3/4 |
| G-16 Observability | ⚠ | - | ✅ | ✅ | 2.5/4 |

**4/4 재현 확정 = 9개 (G-01/02/03/05/06/07/08/09/10)** — 도메인 불변 필수 갭 집합 확정.

---

## 2. VAPT 특유의 신규 갭 (NEW-17 ~ NEW-23)

### NEW-17. Tool/Skill/Agent 3-layer meta-architecture

**plan.md 인용(§6)**:
> - **Tool**: 결정론적 실행 단위, LLM 호출 없음
> - **Skill**: Tool 조합 + 간단한 로직, LLM 선택적
> - **Agent**: Skill/Tool 을 조율하는 자율 단위, 대부분 LLM 주도

**현재 스키마**: 자리 없음. `features[].modules[]` 는 평면 리스트라 "이 모듈이 Tool 인가 Skill 인가 Agent 인가"가 소실. Vocabulary 에 용어는 기록했지만 실제 **모듈의 계층 속성**은 드러나지 않는다.

**임시 대응**: modules 이름에 접미사(`..._agent`, `..._tool`, `..._tracer`) 힌트 삽입. 규율 강제 불가.

**제안 (P0 후보 — 메타 아키텍처 제어에 영향 큼)**:

```yaml
features:
  - modules:
      - id: "unpack_agent"
        layer: "agent"            # 🔒 tool | skill | agent
        llm_access: "none"        # 🔒 none | optional | required
      - id: "apktool_runner"
        layer: "tool"
        llm_access: "none"
      - id: "format_detector"
        layer: "tool"
```

**재사용 가능성**: 다른 AI 에이전트 기반 프로젝트(모든 Claude Agent SDK / langgraph 앱)에서 동일 갭 예상. v2.3.8 P1 후보.

---

### NEW-18. Orchestrator DAG / State machine 정의

**plan.md 인용(§7)**:
```python
EXECUTION_DAG = {
    "start": ["unpack"],
    "unpack": ["manifest", "code_phase1", "binary", "sca"],
    "manifest": ["taint"],
    ...
}
```

**현재 스키마**: 자리 없음. `deliverable.entry_points` 는 "실행 시작점"만, `features[]` 는 평면. **피처 간 실행 순서·의존성**을 기계가 읽을 수 없다.

**임시 대응**: feature.description 자연어에 "Tier 0~3", "DAG", "상태머신" 을 흘림. Orchestrator 가 BR-003 으로 "LLM 없는 상태머신"이라는 제약만 기록.

**제안 (P1)**:

```yaml
execution:
  type: "dag"                           # 🔒 dag | sequential | parallel
  nodes:                                # 🔒 feature id 참조
    - id: "unpack"
      feature: "F-002"
      after: []
    - id: "manifest"
      feature: "F-003"
      after: ["unpack"]
    - id: "code"
      feature: "F-004"
      after: ["unpack"]
      parallel_with: ["manifest", "binary", "sca"]
    # ...
  escalation:                           # 🔒 L1→L2 자동 트리거 규칙
    - when: "escalation_flag.reflective_call OR escalation_flag.taint_gap"
      to: "F-012_L2"
```

**재사용 가능성**: 멀티 에이전트 / 파이프라인 제품 전반. 오케스트레이션이 중심인 제품군에서 P0.

---

### NEW-19. LLM 모델 라우팅 & 비용 정책

**plan.md 인용(§18)**:
> AWS Bedrock — Sonnet 4 (deep insight) / Haiku 4 (standard) / Llama 3.1 8B (cheap/fast)
> per-APK 평균: L2 deep \\$0.74 (±0.20)

**현재 스키마**: 자리 없음. `constraints.tech_stack.llm` 을 임시 확장해 넣었지만 **작업 타입별 라우팅 규칙과 비용 상한**은 어디에도 없다.

**임시 대응**: constraints.tech_stack.llm 아래 커스텀 키(models.deep/standard/cheap_fast). 스키마 어긋남.

**제안 (P0 후보 — LLM 기반 제품 전반에 해당)**:

```yaml
llm:
  provider: "aws_bedrock"
  routing:
    - task: "poc_generation"
      model: "claude-sonnet-4"
      temperature: 0.2
    - task: "insight_summarization"
      model: "claude-haiku-4"
    - task: "rule_synthesis"
      model: "meta.llama-3.1-8b-instruct"
  cost_controls:
    per_scan_usd: 5.0              # 🔒 상한 초과 시 downgrade
    per_tenant_daily_usd: 100
    downgrade_strategy: "l2_to_l1_partial"
  fallback:
    on_unavailable: "l1_only"
```

---

### NEW-20. SaaS 요금제 / 쿼터 / 결제

**plan.md 인용(§24)**:
> Free — L1 quick 스캔, 월 10회, 보고서 보존 7일
> Pro \\$49/월 — L1 standard 무제한, L2 deep 월 10회, SARIF 내보내기, API Key 무제한
> Enterprise — SSO, 전담 지원, on-prem 옵션

**현재 스키마**: 자리 없음. stakeholders.concerns 에 흘렸지만 **요금제·쿼터·권한 매트릭스**를 정책으로 선언할 수 없다.

**임시 대응**: saas_customer.concerns 자연어.

**제안 (P1 — SaaS 제품군에서 재발 예상)**:

```yaml
pricing:
  plans:
    - id: "free"
      price_usd: 0
      quotas:
        scans_per_month: 10
        depth_max: "L1_quick"
      features: ["basic_report", "7day_retention"]
    - id: "pro"
      price_usd: 49
      billing: "monthly"
      quotas:
        scans_per_month: unlimited
        l2_deep_per_month: 10
      features: ["sarif_export", "api_keys", "30day_retention"]
    - id: "enterprise"
      price_usd: null   # contact sales
      features: ["sso", "on_prem", "dedicated_support"]
```

---

### NEW-21. Self-Evolution / 자가 진화 파이프라인

**plan.md 인용(§3, §5 lifecycle, 부록 B)**:
> ToolCombiner → RegexGen → LLM 3단계 생성
> experimental → core 승격: 벤치마크 precision ≥ 0.85 + recall 비회귀

**현재 스키마**: 자리 없음. F-010 로 "피처"화 했지만 **생성물의 lifecycle / 승격 규칙 / 회귀 방어 정책** 이 제품 전반의 프레임이 되어야 함에도 한 피처의 AC 로만 축소됨.

**임시 대응**: BR-005 에 승격 게이트 한 줄, F-010 acceptance_criteria.

**제안 (P2 — 자가 진화형 제품에만 해당, 일반성 낮음)**:

```yaml
self_evolution:
  generators:
    - id: "tool_combiner"
      inputs: ["existing_tools"]
      output_status: "experimental"
    - id: "regex_synthesizer"
      output_status: "experimental"
    - id: "llm_tool_writer"
      output_status: "experimental"
  promotion:
    gate:
      precision_min: 0.85
      recall_regression_max: 0.0
    target_status: "core"
  retirement:
    on_regression:
      action: "archive"
      audit: "registry.json"
```

---

### NEW-22. 벤치마크 / Ground Truth 정의

**plan.md 인용(§20)**:
> InsecureBankv2 25개 취약점 전수 분류 (21 must_detect, 4 optional)
> 6개 공격 체인 GT (T001, T002, T005, T007, T009, T011)
> F1 L1>83%, L2>87%, 전체>75%/90%
> MobSF 주간 비교: delta_f1 > 0 PASS, < 0 ALERT

**현재 스키마**: 자리 없음. "테스트 전략"은 `features[].test_strategy` 로 tag 수준. **벤치마크 자산·GT 매트릭스·회귀 게이트**는 구조적으로 소실.

**임시 대응**: acceptance_criteria 에 "InsecureBankv2 must_detect 전량 탐지".

**제안 (P1 — ML/보안 제품에서 공통 필요)**:

```yaml
benchmarks:
  datasets:
    - id: "insecure_bank_v2"
      ground_truth_path: "tests/benchmark/ground_truth/insecure_bank_v2.yaml"
      vuln_count: 25
      must_detect: 21
      attack_chains: 6
  targets:
    - metric: "f1"
      min_value: 0.83
      scope: "L1_standard"
    - metric: "f1"
      min_value: 0.87
      scope: "L2_deep"
  regression:
    on_fail:
      ci_action: "block"
    comparator:
      vs: "mobsf_v4_4"
      ci_schedule: "weekly"
```

---

### NEW-23. 도구 실행 샌드박스 정책 (Security profile)

**plan.md 인용(§5 4-Layer security)**:
> 1단계: AST 검사 (import 화이트리스트)
> 2단계: seccomp + cgroup
> 3단계: 벤치마크 통과 요건
> 4단계: 런타임 모니터링

**현재 스키마**: 자리 없음. BR-006 한 줄로 축소.

**임시 대응**: BR-006 in business_rules.

**제안 (P2 — 플러그인/동적 코드 실행 제품군)**:

```yaml
security_profiles:
  - id: "default_tool_sandbox"
    required_for: ["tool.status=generated", "tool.status=experimental"]
    layers:
      ast_import_allowlist: ["re", "json", "hashlib"]
      seccomp_profile: "docker/seccomp/tool.json"
      cgroup:
        memory_mb: 512
        cpu_percent: 50
      runtime_monitor: "tool_runtime_guard"
```

---

## 3. 누락되어 위험한 결정 사항 (Blind spots)

아래는 "갭 ID 도 안 부여되지만" 스펙 누락 시 AI 에이전트가 잘못 재현할 가능성이 높은 항목:

| # | 항목 | 현 위치 | 위험 |
|----|------|---------|------|
| B-1 | Orchestrator 는 LLM 을 호출하지 않는다는 **구조 제약** | BR-003 한 줄 | 에이전트 생성 시 LLM 가 Orchestrator 내부에 섞여 들어갈 수 있음 |
| B-2 | ScanDB 를 통한 에이전트 간 통신(프롬프트 payload 금지) | BR-004 한 줄 | 토큰 상한/디버깅 악화 유발 |
| B-3 | L2 는 반드시 L1 이 선행 | BR-002 한 줄 | 단독 L2 실행이 합법인 것처럼 설계될 수 있음 |
| B-4 | Dual-Engine Taint (Java 우선, smali 교차검증) | F-005 자연어 | 한쪽만 구현하고 끝낼 위험 |
| B-5 | Generated tool 승격 게이트(precision ≥ 0.85) | BR-005 한 줄 | 오탐 생성 도구가 core 에 승격될 수 있음 |

**→ 원칙 P-15 후보**: "구조적 안전 제약은 BR 만으로 표현 불가한 경우 `invariants:` 블록을 상단에 둘 필요" (skill v0.3 검토).

---

## 4. $include 사용/포기 기록

**포기 결정**: VAPT 는 원본 문서가 매우 커서 `description` 4~8줄로 자를 수 없는 서사 블록이 많았다. 그러나 $include 로 외부 .md 를 끌어오면 **spec.yaml 이 "포인터 컬렉션"이 되어 스펙 해독의 자기 완결성**이 떨어지는 문제가 발생.

- 이번 변환은 **inline 만 사용**. 참조가 필요한 블록은 `metadata.source.source_lines` 에 섹션 번호로 back-link.
- 다음 변환 권장안: description / vision 은 8줄 이하 inline, 그 이상 혹은 다이어그램·표·코드블록이 필요하면 `$include docs/spec/<name>.md` 사용 권장.

---

## 5. v2.3.8 스키마 확장 후보 (VAPT 변환 이후 최신)

**4-sample 기준 P0 확정 (7개 유지)**: G-01, G-02, G-03, G-06, G-10, G-13, G-15.

**P0 승격 강력 후보 신규 2개 (VAPT 기반)**:

| ID | 필드 | 재사용 가능성 |
|----|------|---------------|
| NEW-17 | `features[].modules[].layer` (tool/skill/agent) | 모든 AI 에이전트 제품 |
| NEW-18 | `execution.dag + escalation` | 멀티 에이전트/파이프라인 제품 |

**P1 승격 후보**:

| ID | 필드 | 재사용 가능성 |
|----|------|---------------|
| NEW-19 | `llm.routing + cost_controls` | LLM 기반 제품 |
| NEW-20 | `pricing.plans` | SaaS 제품군 |
| NEW-22 | `benchmarks.datasets + targets` | ML/보안/품질 게이트 제품 |

**P2 (도메인 특수)**:

| ID | 필드 | 재사용 가능성 |
|----|------|---------------|
| NEW-21 | `self_evolution` | 자가 진화형 제품만 |
| NEW-23 | `security_profiles` | 동적 코드 실행 제품만 |

### 도입 시 커버리지 개선 전망

- 4샘플 기준 🔒 구조 커버리지 ~55% → (v2.3.8 P0 7개 도입 시) ~82% → (NEW-17~19 추가 시) ~88%
- **AI 파이프라인 재현성** 0% → (NEW-17,18 도입 시) ~70%

---

## 6. 변환 과정에서 발견된 체크리스트 확장 힌트 (skill v0.3 후보)

1. **"아키텍처 문서"와 "기획 문서"를 구분하는 필드**: `metadata.source.maturity: planning | architecture | implementation` — VAPT 처럼 이미 결정이 내려진 문서는 다른 변환 전략이 필요 (세부 결정 보존 비율을 높이고, non_goals 대신 future_expansion 카탈로그 중시).
2. **도구 인벤토리(83개)가 features/modules 로 들어가지 못함** — P-11 assets 의 확장 개념이 필요.
3. **L1/L2 같은 티어 / 플랜 개념은 deliverable.type 으로 담을 수 없다** — `deliverable.tiers[]` 배열 고려.
4. **모델 라우팅 + 비용 상한 + 다운그레이드** 는 NFR 에서 분리해 llm 섹션으로.
5. **부록(Appendix)이 많은 원본**: spec 으로 담지 말고 항상 $include 로 docs/spec/appendix-\*.md 에 분리 고정.

---

## 7. 이번 VAPT 변환의 특이점

- 원본이 사실상 **"구현 직전 아키텍처 문서"** 수준이라 spec.yaml 은 **역방향 압축**이 됨 (기획→스펙이 아니라 아키텍처→스펙).
- 같은 이유로 **"결정 이유(rationale)"** 가 원본에 풍부하게 있음 — BR.rationale 필드를 적극 활용.
- Tool 인벤토리·rule DB·체인 템플릿처럼 "정적 데이터 에셋"이 제품의 정체성 일부 — 이번 갭 NEW-21(self-evolution)과 G-11(assets)이 결합된 영역.
- MobSF 벤치마크 비교·SARIF 호환성은 **"경쟁·표준"** 제약으로 새 축 → 향후 `interoperability:` 블록 후보.

---

## 8. 결론

- VAPT v4.5 는 **v2.3.7 스키마의 한계를 가장 극명하게 드러낸 사례**. G-01~G-16 중 15개 재현 + NEW-17~23 7개 신규 = **22개 갭**.
- **skill v0.2 는 이만한 복잡도를 훌륭히 감당**했다: 2단계 워크플로, P-7/8/10/11/12/13/14 가 모두 방아쇠를 당겼고, 14개 원칙 중 13개가 실제로 작동했다(P-9 prototype_mode 만 비적용 — 성숙한 아키텍처라 당연).
- **Phase 2.5 의 핵심 교훈**: 3-sample 에서 "8개 샘플쯤이면 스키마가 포화"라고 낙관했지만, VAPT 수준의 "메타 아키텍처 문서"는 한 건만으로 7개 신규 갭을 만들어냈다. **스키마 완성 조건은 "샘플 수"가 아니라 "문서 성숙도 축"을 따라 측정해야 한다** (plan / architecture / implementation).
