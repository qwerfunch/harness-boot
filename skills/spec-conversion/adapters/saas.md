# Adapter: saas

**출처 샘플**: vapt-apk-sast (v0.2, Phase 2.5 stress test)
**버전**: 0.1

## 1. 도메인 시그널

- "Free/Pro/Enterprise", "\\$/월", "요금제", "billing", "subscription"
- "멀티테넌트", "org/project", "Auth0/Cognito", "SSO"
- "React SPA + FastAPI", "WebSocket 실시간"
- "API Key 관리", "quota", "rate limit per tenant"

## 2. 우선 체크 갭

1. **NEW-20 pricing/quotas** — 요금제 테이블, 플랜별 쿼터, 기능 매트릭스
2. **G-02 API endpoints** — REST + WebSocket 프로토콜 명세
3. **G-04 UI screens** — 화면·컴포넌트·라우팅
4. **NEW-19 llm routing/cost_controls** (LLM 기반 SaaS 에 한함)
5. **G-06 external_dependencies** — auth provider, billing, CDN

## 3. 권장 엔티티 원형

| 엔티티 | 역할 | 필수 불변식 |
|--------|------|-------------|
| Org/Tenant | 다중 테넌트 격리 단위 | 모든 리소스는 org 귀속 |
| User | 인증 주체 | org 가입 상태 + role |
| Plan | 요금제 정의 | 쿼터·기능 집합 |
| Subscription | org → plan 연결 | 유효 기간 + 결제 상태 |
| ApiKey | 프로그램 접근 | 스코프·폐기 가능 |

## 4. 매핑 힌트

| 원본 패턴 | spec 필드 |
|-----------|----------|
| "Free: 월 10회" | unrepresentable → NEW-20 `pricing.plans[].quotas` |
| "Pro \\$49/월: SARIF export" | NEW-20 `pricing.plans[].features[]` |
| "POST /api/scans" | unrepresentable → G-02 `api.endpoints[]` |
| "WebSocket /ws/scans/{id}" | G-02 + G-16 (진행률 스트림) |
| "Upload.tsx 드래그앤드롭" | unrepresentable → G-04 `ui.screens[]` |
| "Auth0 SSO" | spec `constraints.tech_stack.auth_provider` + G-06 |
| "Claude Sonnet / Haiku / Llama 라우팅" | unrepresentable → NEW-19 `llm.routing` |

## 5. 흔한 함정

- **요금제를 stakeholder.concerns 자연어로 흘리기** — P-20 (NEW) 위반. 구조적
  보존 필요.
- **deliverable.type=web-service 로 가며 내부 scan-worker 정체성 소실** —
  P-10 위반. entry_points 다중화로 완화.
- **API 엔드포인트를 features AC 에만 기록** — AI 가 계약을 역추출해야 하는
  불안정. G-02 로 분리.
- **WebSocket 프로토콜을 "실시간 스트림" 한 줄로 축소** — 이벤트 타입·페이로드
  스키마 손실.

## 6. 체크리스트 확장

- [ ] 요금제 언급이 있으면 unrepresentable 에 NEW-20 엔트리
- [ ] HTTP 메서드+경로 패턴이 원본에 N개 이상이면 G-02 엔트리
- [ ] 화면 이름(Upload/Analysis/Dashboard 등)이 나오면 G-04 엔트리
- [ ] 멀티테넌시 언급 시 Org/Tenant 엔티티 후보 존재
- [ ] WebSocket 이벤트 타입이 명시적이면 G-02 하위에 이벤트 프로토콜 섹션
