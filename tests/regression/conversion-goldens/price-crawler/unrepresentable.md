# Unrepresentable.md — Price Crawler

**대상**: `plan.md` (Price Crawler v0.2)  
**스키마**: v2.3.7  
**비교 대상**: URL 단축기(G-01~G-10), retro-jumper(G-11~G-13)

---

## 1. 기존 갭의 재현 여부

| ID | 재현 | worker 도메인 구체 양상 |
|----|------|-----------------------|
| G-01 NFR | **재현** | 수집 1시간 목표, 정확도 95%, egress 50 USD, 가용성 93% — 모두 구조적 자리 없음 |
| G-02 API | **재현** | `POST /api/jobs/trigger` — features AC 에 자연어 |
| G-03 Entity attributes | **재현** | 5개 엔티티 모두 필드 목록이 invariants 자연어에 부분만 |
| G-04 UI screens | 부분 재현 | 대시보드는 Grafana 외부이므로 정확히는 "dashboard panels". 내부 UI 없음 → 이 갭은 플랫폼에 따라 "영향 없음"도 가능 |
| G-05 Edge cases | **재현** | 셀렉터 깨짐, 상품 판매 중단, 통화 변경, IP 밴 — 일부 BR, 일부 AC |
| G-06 External deps | **재현** | S3, Redis, Slack webhook, Grafana, Prometheus — modules 이름으로만 암시 |
| G-07 Success metrics | **재현** | 95% 성공률, 알람 클릭율 30%, MD팀 시간 감소 — 전부 누락 |
| G-08 Milestones | **재현** | M1~M4 2.5주 — priority 로만 |
| G-09 Risks/assumptions | **재현** | robots.txt 법무 미해결, 경쟁사 구조 안정성, Turnstile 불가 사이트 — concerns 에 부분 |
| G-10 Open questions | **재현** | 상품 판매 중단 알람, ±5% 임계값, DLQ UI, 법무 시한 — 5개 모두 자리 없음 |
| **G-11 Assets** | 부분 재현 | "CSS 셀렉터 설정 파일" 이 유사 개념. 엄밀한 에셋 아님 |
| **G-12 Tuning constants** | **재현** | ±5% 변동 임계값, 1초 간격, concurrency=1, 3회 재시도 — BR 로 승격되나 수치 튜닝 축 소실 |
| **G-13 Non-goals** | **재현** | "실시간 수집 비포함", "리뷰·재고 비포함", "회색 사이트 제외" — project.vision 자연어로만 |

**재현 매트릭스 (3 샘플 기준)**:

| 갭 | URL단축기 | retro-jumper | price-crawler | **재현율** |
|----|:---------:|:------------:|:--------------:|:----------:|
| G-01 NFR | ✅ | ✅ | ✅ | **3/3** |
| G-02 API | ✅ | ✅ | ✅ | **3/3** |
| G-03 Entity attrs | ✅ | ✅ | ✅ | **3/3** |
| G-04 UI | ✅ | ✅ | ⚠ 부분 | 2.5/3 |
| G-05 Edge cases | ✅ | ✅ | ✅ | **3/3** |
| G-06 External deps | ✅ | ✅ | ✅ | **3/3** |
| G-07 Metrics | ✅ | ✅ | ✅ | **3/3** |
| G-08 Milestones | ✅ | ✅ | ✅ | **3/3** |
| G-09 Risks | ✅ | ✅ | ✅ | **3/3** |
| G-10 Open questions | ✅ | ✅ | ✅ | **3/3** |
| G-11 Assets | - | ✅ | ⚠ | 1.5/3 |
| G-12 Tuning | - | ✅ | ✅ | **2/3** |
| G-13 Non-goals | ⚠ | ✅ | ✅ | **2.5/3** |

**3/3 재현 = 9개 갭** (G-01/02/03/05/06/07/08/09/10) — 도메인 독립적 결핍으로 확정.

---

## 2. worker 도메인 고유 신규 갭

### G-14. 스케줄 / 실행 정책 (Execution Schedule)

**plan.md 인용**:
> - 매일 03:00 KST 시작 (트래픽 낮은 시각)
> - 경쟁사별 딜레이: 1초 간격, 동시 요청 1개 (concurrency 1 per site)
> - k8s CronJob 으로 배포

**현재 스키마**: 자리 없음. `deliverable.entry_points[]` 는 "어떻게 실행하는가"(command)만 있고 "언제·얼마나 자주·제약"이 없음.

**임시 대응**: BR-002(경쟁사별 concurrency/간격)로 일부 승격. 스케줄 표현(`0 3 * * *`) 은 완전 누락.

**제안 (P1)**:

```yaml
deliverable:
  entry_points:
    - name: "crawl-job"
      schedule:                         # 🔒 worker 전용 필드 제안
        type: "cron"                    # 🔒 cron | event | manual
        expression: "0 3 * * *"         # 🔒 cron 식 표준
        timezone: "Asia/Seoul"          # 🔒 IANA tz
      concurrency:                      # 🔒
        max_parallel: 1                 # 전체
        per_key:                        # 키별 제한
          - key: "competitor_id"
            max: 1
            rate: "1/second"
      timeout_seconds: 7200             # 🔒 (기존 health_check.timeout_seconds 와 중복 정비 필요)
```

도메인 확장 가능성: `trigger-api` 같은 이벤트 기반 실행, 단일 인스턴스 워커, 대기열 컨슈머 등에도 공통 모델.

### G-15. 재시도 / 실패 정책 (Retry Policy)

**plan.md 인용**:
> - HTTP 5xx: 3회, exponential backoff 2^n 초
> - HTTP 4xx: 재시도 X, DLQ
> - 파싱 실패: DLQ + 원본 HTML 저장

**현재 스키마**: 자리 없음. BR-003/004/005 로 정책을 자연어로 흘렸으나, **"재시도 전략은 BR 문장으로 쓰면 재사용 불가"** — 공통 재시도 엔진이 이를 기계적으로 읽을 수 없음.

**임시 대응**: 3개 BR 에 정책을 분산 서술. "HTTP 4xx 와 5xx 의 분기"라는 구조는 보존되지 않음.

**제안 (P0 후보)**:

```yaml
failure_policies:                       # 🔒 spec.yaml top-level
  - id: "FP-001"
    scope: "http_fetch"                 # 🔒 정책 적용 범위
    matchers:                           # 🔒 조건 매칭
      - condition: "http_status >= 500 OR timeout"
        action: "retry"
        retry:
          max_attempts: 3
          backoff: "exponential"
          base_seconds: 2
        on_exhausted: "dead_letter"
      - condition: "http_status in [400, 403, 404]"
        action: "dead_letter"
        reason: "http_4xx"
      - condition: "parse_error"
        action: "dead_letter"
        preserve:                       # 🔒 실패 증거 보존
          - "raw_html"
```

**도메인 일반화 근거**: 웹 서비스의 외부 API 콜, 게임의 리더보드 제출, 워커의 수집 — **거의 모든 통합점에서 재시도 정책이 필요**. `failure_policies` 는 최상위 재사용 자원.

### G-16. 관측성 / 메트릭 / 알람 선언 (Observability)

**plan.md 인용**:
> - Grafana: 경쟁사별 수집 성공률, SKU별 시계열, DLQ 적재량
> - Slack: JobRun.failed 즉시, DLQ ≥ 50 일 요약, 가격 변동 ±5% 이상

**현재 스키마**: 자리 없음. F-003/F-004 AC 에 자연어로 흩뿌려짐.

**임시 대응**: "메트릭 소스는 Postgres + Prometheus" 수준의 한 줄만.

**제안 (P1)**:

```yaml
observability:
  metrics:
    - id: "M-001"
      name: "crawl_success_rate"
      type: "ratio"
      numerator: "count(PriceSnapshot where job_run=X)"
      denominator: "count(TrackedSKU where competitor=Y AND active=true)"
      sli: true
  alerts:
    - id: "A-001"
      trigger: "JobRun.status=='failed'"
      channel: "#data-ops"
      urgency: "immediate"
    - id: "A-002"
      trigger: "DLQ_backlog >= 50"
      channel: "#data-ops"
      urgency: "daily_summary"
```

**도메인 일반화 근거**: 모든 프로덕션 시스템은 관측성이 필요. 스키마에 자리가 없어서 AC 에 녹이면 실제 대시보드/알람 코드와 스펙이 드리프트.

---

## 3. 3 샘플 종합 결론

### P0 승격 확정 (3/3 재현)

| ID | 필드 | 영향 |
|----|------|------|
| G-01 | non_functional (perf/avail/scale/retention) | AI 가 벤치마크·부하 테스트 자동 작성 불가 |
| G-02 | api (endpoints) | API 설계 AI 가 features 에서 계약 추출해야 하는 불안정 |
| G-03 | domain.entities[].attributes | DDL/ORM 자동 생성 불가 |
| G-06 | external_dependencies | 모킹 전략·failure policy 소실 |
| G-10 | open_questions | AI 가 "미결정"을 임의로 결정하는 오류 근원 |

### P0 승격 강력 후보 (2~2.5/3 재현)

| ID | 필드 |
|----|------|
| G-13 | non_goals |
| G-15 | failure_policies |

### P1 (도메인 의존적이지만 유용)

| ID | 필드 |
|----|------|
| G-04 | ui.screens |
| G-05 | edge_cases |
| G-07 | success_metrics |
| G-08 | release_plan |
| G-09 | assumptions, risks |
| G-11 | assets |
| G-12 | tuning_constants |
| G-14 | deliverable.entry_points[].schedule / concurrency |
| G-16 | observability (metrics/alerts) |

### v2.3.8 1차 제안 (최소 집합)

**필수 도입 (7개)**: G-01, G-02, G-03, G-06, G-10, G-13, G-15.  
이 7개만 도입해도 구조 커버리지가 ~60% → ~85% 로 상승 전망.

---

## 4. 이번 worker 변환의 특이점

- 데이터 파이프라인이 "상태 기계"에 가까움 → JobRun 상태 전이가 invariants 로 자연스럽게 담김
- 재시도 정책이 BR 로 뭉개진 것이 가장 정보 손실이 큼
- "법무 컨펌 미해결" 같은 blocker 가 plan.md의 여러 곳에 반복되는데 spec 에서는 stakeholders.concerns 한 줄로 축소
- 워커는 **UI 가 없음** → G-04 UI screens 갭이 "영향 없음" 도메인 발견. 필드는 optional 이어야 함
