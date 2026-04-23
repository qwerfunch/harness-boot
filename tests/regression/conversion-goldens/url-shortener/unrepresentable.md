# Unrepresentable.md — URL 단축기 샘플 변환 갭 카탈로그

**대상 문서**: `plan.md` (URL 단축기 기획안 v0.3 draft)  
**스키마 기준**: harness-boot spec v2.3.7  
**작성일**: 2026-04-22  
**변환자**: 수동 1차 변환 (claude)

이 문서는 plan.md → spec.yaml 수동 변환 과정에서 **현재 스키마의 구조적(🔒) 필드로 온전히 표현할 수 없어서 spec.yaml에 담지 못한(혹은 억지로 담은) 모든 기획 덩어리**를 기록한다. 각 항목은 v2.3.8+ 스키마 확장 논의의 1차 입력이 된다.

우선순위 표기:
- **P0** — 거의 모든 제품 기획에 나타나며, 누락 시 AI 에이전트가 제품을 완전히 만들 수 없다고 판단되는 필드
- **P1** — 자주 나타나지만 일부 도메인에만 해당
- **P2** — 특정 도메인에만 나타남, `$include` 자유텍스트로 우회 가능

---

## G-01. 정량 비기능 요구사항 (Non-Functional Requirements)

**plan.md §4 인용**:
> - **응답 속도**: 리다이렉트 p95 < 50ms
> - **가용성**: 99.9% (연 8.76시간 다운타임 허용)
> - **확장성**: 초기 1만 클릭/일, 1년 후 100만 클릭/일, 총 링크 10M
> - **데이터 보존**: 클릭 로그 2년 후 집계만 유지

**현재 스키마의 처리**: `constraints.quality.coverage_threshold` 하나만 정량 품질 필드. 나머지는 자리가 없음.

**임시로 어디에 담았나**: F-002(리다이렉트) `acceptance_criteria[]`에 "p95 < 50ms" 문장을 자연어로 삽입. BR-005에 2년 보존을 rationale로 서술. 가용성·확장성 목표는 **완전히 누락**.

**문제점**:
- p95 < 50ms가 "수용 기준"에 자연어로 들어가면, AI가 벤치마크 테스트를 자동 작성할 때 "어떤 툴로? 어떤 분포로?" 를 재추론해야 함
- 가용성 99.9%는 단일 feature의 AC가 아니라 **시스템 차원** 목표인데, 시스템 레벨 제약을 담을 곳이 없음
- 확장성(10M 링크)은 DB 설계·인덱스 전략에 직접 영향을 주는데 힌트가 사라짐

**제안 (P0)**:

```yaml
# spec.yaml top-level
non_functional:
  performance:
    - metric: "p95_latency"          # 🔒
      scope: "GET /:code"             # 🔒 엔드포인트 또는 feature id
      target: 50
      unit: "ms"
      reason: string                  # 🗒 왜 이 수치인가
  availability:
    - scope: "service"                # 🔒
      target: 99.9
      unit: "percent"
      window: "monthly"               # 🔒 monthly | quarterly | annual
  scale:
    - dimension: "clicks_per_day"     # 🔒 자유 문자열
      initial: 10000
      target: 1000000
      target_at: "2027-04"            # 🔒 YYYY-MM
  retention:
    - entity: "Click"                 # 🔒 domain.entities[].name 참조
      hot_duration_days: 730          # 🔒
      after: "aggregate_only"         # 🔒 delete | aggregate_only | archive
      reason: string                  # 🗒
```

---

## G-02. API 수준 선언 (API Surface)

**plan.md §8 인용**:
> - `POST /api/links` — body: {original_url, custom_code?, expires_at?}
> - `GET /api/links?q=&limit=&offset=&sort=`
> - `GET /:code` → 302 redirect (or 410 if expired, or 404 if not found)
> ...

**현재 스키마의 처리**: `deliverable.entry_points[]`는 실행 단위(프로세스 레벨)이고, `features[].acceptance_criteria[]`는 자연어 기준. **엔드포인트-메서드-경로-응답 코드의 기계검증 가능한 선언**을 담을 자리가 없음.

**임시로 어디에 담았나**: F-001~F-008의 acceptance_criteria에 "POST /api/links …" 같은 자연어 문장으로 흩뿌림. 중복·오타 위험.

**문제점**:
- API는 기획 문서의 최대 유통 단위 중 하나인데 구조가 없음
- AI가 OpenAPI 스펙을 생성·검증하려면 이 필드가 있어야 결정적
- 경로 충돌(예: `/:code` vs `/api/*`)은 스펙 레벨에서 감지 가능해야 함

**제안 (P0)**:

```yaml
api:
  base_path: "/api"                   # 🔒
  endpoints:
    - id: "EP-001"                    # 🔒
      method: "POST"                  # 🔒 enum
      path: "/api/links"              # 🔒
      auth: "admin"                   # 🔒 public | admin | owner | service
      request_body_schema: string     # 🔒 JSON Schema 문자열 또는 파일 참조
      responses:
        - status: 201
          description: "생성 성공, short_code 반환"
        - status: 400
          description: "원본 URL이 유효하지 않음"
      implemented_by: ["F-001"]       # 🔒 features[].id 참조
      notes:                          # 🗒
        $include: docs/spec/api/EP-001.md
  path_conventions:                   # 🔒 라우팅 규칙 (예약어·충돌 감지용)
    reserved_prefixes: ["/api", "/health", "/admin"]
    redirect_catchall: "/:code"       # 예약 경로 이외 전부 매칭
```

참고: features[].acceptance_criteria는 **행위 수준**(given/when/then), api는 **계약 수준**. 둘 다 필요.

---

## G-03. 데이터 모델 필드 (Entity Attributes)

**plan.md §7 인용**:
> **Link**
> - id, short_code (unique), original_url, created_by (User.id), custom (boolean), expires_at (nullable), is_active, created_at, updated_at

**현재 스키마의 처리**: `domain.entities[]`는 `name / description / invariants / sensitive` 만 존재. **필드 목록(이름·타입·제약)을 담을 곳 없음**.

**임시로 어디에 담았나**: invariants에 자연어로 "이메일은 유일하다", "short_code는 전역 유일하다" 식으로 일부만 흘려 넣음. 필드 이름·타입은 **완전히 누락**.

**문제점**:
- AI가 DDL / ORM 모델을 만들려면 이 필드 목록이 필수
- `invariants`의 자연어는 관계·타입을 빠르게 잃음 (예: "nullable" 같은 속성)

**제안 (P0)**:

```yaml
domain:
  entities:
    - name: "Link"
      # 기존 필드 유지 ...
      attributes:                     # 🔒 v2.3.8 신설 제안
        - name: "short_code"
          type: "string"              # 🔒 string | integer | uuid | timestamp | enum(...) | ref(Entity)
          nullable: false
          unique: true
          constraints:
            - "length in [6, 8]"
            - "alphanumeric"
        - name: "original_url"
          type: "string"
          nullable: false
          constraints: ["url"]
        - name: "created_by"
          type: "ref(User)"
          nullable: false
        - name: "expires_at"
          type: "timestamp"
          nullable: true
      relations:                      # 🔒 옵션
        - cardinality: "many-to-one"
          target: "User"
          via: "created_by"
```

---

## G-04. UI 화면 목록 (UI Screens / Routes)

**plan.md §9 인용**:
> - Admin:
>   - 로그인 (+ 2FA 입력)
>   - 초대 수락 페이지
>   - 대시보드 (전체 통계 요약)
>   - ...

**현재 스키마의 처리**: 자리 없음.

**임시로 어디에 담았나**: 어느 feature의 modules 에 `admin-ui` 를 얹는 것으로 암시. 개별 화면은 소실.

**문제점**:
- UI 레벨은 피처와 1:1이 아님(여러 화면이 한 피처를 구현, 또는 한 화면이 여러 피처를 집약)
- AI가 페이지별 스켈레톤을 만들 때 힌트가 없음
- 와이어프레임 파일 참조도 담을 곳 없음

**제안 (P1)**:

```yaml
ui:
  screens:
    - id: "SC-001"                    # 🔒
      path: "/admin/login"            # 🔒 라우트
      title: "어드민 로그인"
      auth: "public"
      implements: ["F-003"]           # 🔒 features[].id
      description:                    # 🗒
        $include: docs/spec/screens/SC-001.md
      wireframe: "design/wireframes/admin-login.png"  # 🔒 파일 참조 (선택)
```

---

## G-05. 엣지 케이스 / 예외 (Edge Cases)

**plan.md §10 인용**:
> - short_code 충돌: 랜덤 생성 시 중복 나면 재시도. 5번 실패하면 500? 아니면 더 긴 코드?
> - 원본 URL이 우리 도메인으로 다시 오는 무한 루프: 거부
> - 삭제된 유저의 링크는 어떻게? — soft-delete, 링크는 유지하되 owner 없음으로 표시

**현재 스키마의 처리**: `domain.business_rules[]`로 일부 흡수 가능(BR-005~BR-007). 그러나 **"아직 결정 안 된 엣지케이스"**는 business_rules로 쓰기엔 단정적임.

**임시로 어디에 담았나**: BR-005~BR-007로 일부 승격. "5번 실패하면 500?" 같은 미정 항목은 `open_questions`로 가야 하는데 그 필드도 없어서 누락.

**제안 (P1)**:

`edge_cases` 상위 필드 또는 `features[].edge_cases[]` 중 하나.

```yaml
# Option A: features[].edge_cases[]  — 피처에 귀속되는 엣지 케이스
features:
  - id: "F-001"
    edge_cases:
      - trigger: "short_code 생성 시 5회 연속 충돌"    # 🔒
        behavior: "500 반환"                           # 🔒 decided | undecided
        status: "decided"                              # 🔒
      - trigger: "원본 URL이 서비스 자기 도메인 참조"
        behavior: "거부"
        status: "decided"

# Option B: 상위 edge_cases[]  — 피처 횡단 엣지
edge_cases:
  - id: "EC-001"
    applies_to: ["F-001"]
    trigger: string
    behavior: string
    status: enum  # decided | undecided | deferred
```

두 방식 중 Option A 가 자연스러움(피처 귀속).

---

## G-06. 외부 의존성 (External Dependencies)

**plan.md §11 인용**:
> - Google Safe Browsing API (악성 URL 탐지)
> - SendGrid (초대 메일, 비밀번호 재설정 메일)
> - MaxMind GeoIP DB

**현재 스키마의 처리**: 자리 없음. `constraints.tech_stack` 은 내부 스택(language/runtime/framework) 전용.

**임시로 어디에 담았나**: F-001/F-003 의 modules 에 `safe-browsing-client`, `mail-client` 로 암시. 벤더명·키 관리·SLA·장애 대비책은 소실.

**문제점**:
- AI가 통합 테스트 시 모킹 전략을 결정하려면 이 필드가 있어야 함
- 장애 대비(예: "Safe Browsing 응답 없으면 deny 대신 delay") 같은 정책도 함께 담아야 함
- 비용 모니터링과도 연결됨

**제안 (P0)**:

```yaml
external_dependencies:
  - id: "ED-001"                      # 🔒
    kind: "third_party_api"           # 🔒 third_party_api | saas | db | cache | ...
    name: "Google Safe Browsing"
    purpose: "악성 URL 차단"
    consumed_by: ["F-001"]            # 🔒 features[].id
    auth: "api_key"                   # 🔒 api_key | oauth | none
    failure_policy:                   # 🗒 자유서술 또는 구조
      mode: "fail_closed"             # 🔒 fail_closed | fail_open | retry_then_fail
      retry_count: 2
      reason: string                  # 🗒
    cost_note:                        # 🗒
      $include: docs/spec/deps/ED-001.md
```

---

## G-07. 성공 지표 (Metrics / KPIs)

**plan.md §12 인용**:
> - 내부 전환율: 마케팅팀이 외부 bit.ly 대신 내부 도구를 쓰는 비율 > 80% (3개월 내)
> - WAU > 8명
> - 평균 링크당 클릭 수

**현재 스키마의 처리**: 자리 없음.

**임시로 어디에 담았나**: 아무 곳에도 안 담음(spec.yaml에서 완전 누락).

**문제점**:
- 성공 지표는 제품의 존재 이유와 직결. AI 에이전트가 "이 기능이 정말 필요한가" 판단하려면 필수
- 일부는 이벤트 로깅 스키마 결정에 직접 영향(예: WAU 계산을 위해 어떤 이벤트를 쌓을지)

**제안 (P1)**:

```yaml
success_metrics:
  - id: "KM-001"                      # 🔒
    name: "내부 전환율"
    definition: "내부 링크 / (내부 + bit.ly) 비율"    # 🗒
    target: 80
    unit: "percent"
    window: "3_months_post_launch"
    data_source: "clicks_table + bit.ly_export"
  - id: "KM-002"
    name: "WAU (Admin)"
    target: 8
    unit: "users"
    window: "weekly"
```

---

## G-08. 마일스톤 / 릴리스 계획 (Milestones)

**plan.md §13 인용**:
> - **M1 (4주)**: MVP
> - **M2 (2주)**: 어드민 기능 고도화
> - **M3 (1주)**: 모니터링 / 배포 안정화

**현재 스키마의 처리**: 자리 없음. `features[].priority` 는 순서만 전달.

**임시로 어디에 담았나**: features[].priority 로 순서만 보존. "4주", "2주" 같은 기간·릴리스 단위 구분은 소실.

**문제점**:
- MVP 포함 여부(스켈레톤 이후 V1에 들어가는 피처가 어디까지인가)가 모호해짐
- `/harness:plan` 같은 명령이 "M1 범위에 무엇이 들어가야 하나?"를 답할 수 없음

**제안 (P1)**:

```yaml
release_plan:
  - milestone: "M1"
    title: "MVP"
    duration_weeks: 4
    features: ["F-000", "F-001", "F-002", "F-003"]   # 🔒
    exit_criteria:                                    # 🗒
      - "smoke_scenario SS-001, SS-002 통과"
      - "admin 1명 로그인 가능"
  - milestone: "M2"
    title: "어드민 고도화"
    duration_weeks: 2
    features: ["F-004", "F-005", "F-006"]
```

---

## G-09. 위험 / 가정 (Risks / Assumptions)

**plan.md §14 인용**:
> - 초기 트래픽 가정: 1만 클릭/일
> - 법무 리뷰: 클릭 로그에 IP 저장이 개인정보 이슈 — **미해결**
> - DevOps 지원: 인프라 세팅 도움 필요

**현재 스키마의 처리**: 자리 없음.

**임시로 어디에 담았나**: stakeholders[].concerns 에 일부 정보를 흘림(legal_team, devops_team concerns). 하지만 concerns 는 "역할별 관심사"이지 "리스크/가정"의 일반 정의가 아님.

**문제점**:
- "미해결 리스크"는 제품 런칭 가능성을 좌우하는데 스펙에 전달되지 않음
- AI 에이전트가 "법무 컨펌 필요" 같은 blocker를 자동 감지할 수 없음

**제안 (P1)**:

```yaml
assumptions:
  - id: "AS-001"                      # 🔒
    statement: "초기 트래픽 1만 클릭/일"
    confidence: "medium"              # 🔒 high | medium | low
    source: "marketing_team_estimate" # 🗒

risks:
  - id: "RI-001"                      # 🔒
    statement: "클릭 로그 IP 저장의 개인정보 이슈"
    status: "open"                    # 🔒 open | mitigated | accepted | closed
    owner: "legal_team"
    mitigation: string                # 🗒
    blocker: true                     # 🔒 런칭 차단 여부
```

---

## G-10. 오픈 이슈 / 결정 대기 (Open Questions)

**plan.md §15 인용**:
> 1. 어드민이 링크의 `original_url`을 변경할 수 있게 할지 (bait-and-switch 위험)
> 2. 만료된 링크에 대한 404 vs 410 vs 전용 안내 페이지
> 3. custom_code 예약어 목록 — 개발 시작 전에 확정

**현재 스키마의 처리**: 자리 없음.

**임시로 어디에 담았나**: F-002 AC에 "410 반환 — 결정 필요" 같은 자연어로 흘림. F-006 AC에 "allow_origin_edit 설정 플래그로 제어"로 한쪽 결론을 섣불리 내림(이는 엄밀하게 잘못된 변환).

**문제점**:
- open_questions 는 제품 기획의 **흔한 실상**(실제 기획 문서의 80%에 있음)인데 구조적 자리 없음
- 이 필드가 없으면 AI가 "결정되지 않은 것"을 임의로 결정하는 오류를 유발

**제안 (P0)**:

```yaml
open_questions:
  - id: "OQ-001"                      # 🔒
    topic: "original_url 편집 허용 여부"
    context: string                   # 🗒
    options:                          # 🔒 선택지 목록
      - "allow_with_audit"
      - "allow_for_owner_only"
      - "forbid"
    impact:                           # 🔒 영향 feature
      features: ["F-006"]
    deadline: "2026-05-15"            # 🔒 결정 마감
    status: "open"                    # 🔒 open | decided | deferred
    decided_option: null              # 🔒 결정 시 기록
    decided_reason: string            # 🗒
```

---

## 요약 테이블

| ID | 갭 | 우선순위 | 누락 → spec.yaml 어디에 새어들었나 |
|----|----|----------|------------------------------------|
| G-01 | NFR (p95, availability, scale, retention) | **P0** | 일부 AC, BR-005, 대부분 누락 |
| G-02 | API endpoints | **P0** | features[].AC에 자연어로 산재 |
| G-03 | Entity attributes (필드 목록) | **P0** | invariants 자연어 일부 |
| G-04 | UI screens/routes | P1 | modules: admin-ui 로만 암시 |
| G-05 | Edge cases | P1 | 일부 BR-00x로 승격, 미정은 누락 |
| G-06 | External dependencies | **P0** | modules 에 클라이언트 이름만 암시 |
| G-07 | Success metrics | P1 | 전부 누락 |
| G-08 | Milestones / release plan | P1 | priority 로 순서만 |
| G-09 | Risks / assumptions | P1 | stakeholders.concerns 에 흘림 |
| G-10 | Open questions | **P0** | AC 에 자연어로 흘림(일부 오결정) |

**P0 갭 5개** — 이들이 해결되지 않으면 "AI가 기획을 온전히 이해해서 제품을 완벽히 만든다"는 목표 달성 불가.

## 다음 단계

1. 다른 샘플(게임, worker, 라이브러리, CLI)에서도 **동일 갭이 재현되는지** 확인
   - 만일 재현되면 v2.3.8 우선순위로 승격
   - 특정 도메인에만 나타나면 도메인 프로파일(domain profile) 개념 도입 검토
2. P0 5개를 v2.3.8 1차 후보로 지정하고 스키마 초안 작성
3. `constraints` vs `non_functional` vs `quality` 의 관계 정리 (중복·책임 경계)
4. 이 카탈로그를 skill 지식 베이스 (`skills/spec-conversion/`)에 반영
