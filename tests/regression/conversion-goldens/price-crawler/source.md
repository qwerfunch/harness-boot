# Price Crawler — 경쟁사 가격 모니터링 워커

**작성자**: 데이터팀 TL  
**작성일**: 2026-04-18  
**버전**: 0.2 (internal draft)  
**상태**: 엔지니어링 리뷰 대기

---

## 1. 배경

커머스 MD팀이 매일 아침 경쟁사(약 6개 사이트)의 동일 SKU 가격을 수기로 체크하고 있음. 이게 사람이 하기엔 귀찮고 누락이 많음. 자동화된 크롤러로 밤사이 가격 수집 → 아침에 대시보드 + 변동 알람으로 제공하는 것이 목표.

상용 솔루션(예: Prisync, Minderest)도 있으나, 우리 SKU 매핑이 복잡하고 일부 경쟁사는 자바스크립트 렌더링이 필요해서 커스텀이 유리하다고 판단.

## 2. 이해관계자

- **MD팀 (데이터 수요자)**: 매일 아침 대시보드 + Slack 알람 소비
- **데이터팀 (소유팀)**: 크롤러 운영·유지보수
- **법무팀**: robots.txt 준수, 이용약관 검토 — 컨펌 필요
- **인프라팀**: 비용·네트워크 에그레스 관리

## 3. 스코프

### 3.1 포함

- 6개 경쟁사 사이트에서 특정 SKU 리스트(약 1,200개)의 가격 일일 수집
- 가격 변동 감지 (직전 수집 대비 ±N% 변동)
- 대시보드(Grafana) 표시 + Slack 알람
- 실패 재시도, 데드레터 큐

### 3.2 비포함

- 실시간 수집 (최대 일 1회 + 수동 트리거)
- 상품 리뷰·평점·재고 (가격만)
- 법적으로 회색인 사이트 (약관에서 크롤링 명시 금지된 곳은 제외)

## 4. 데이터 모델

**Competitor**
- id, name, base_url, crawler_strategy (static_html | js_rendered), is_active

**TrackedSKU**
- id, internal_sku, competitor_id, external_product_url, last_seen_price, last_seen_at

**PriceSnapshot**
- id, tracked_sku_id, price, currency, collected_at, is_on_sale, raw_html_ref (S3)

**JobRun**
- id, started_at, finished_at, status (running | succeeded | failed | partial), stats_json

**DeadLetter**
- id, job_run_id, tracked_sku_id, reason, payload_json, moved_at

## 5. 실행 플로우

### 5.1 스케줄

- 매일 03:00 KST 시작 (트래픽 낮은 시각)
- 수동 트리거: MD팀이 대시보드에서 "지금 수집" 버튼. owner만 가능
- 경쟁사별 딜레이: 1초 간격, 동시 요청 1개 (concurrency 1 per site)

### 5.2 단계

1. 활성 TrackedSKU 조회
2. 경쟁사별 그룹화
3. 각 경쟁사에 대해 순차 수집
4. 각 SKU: fetch → parse → 가격 추출 → PriceSnapshot 저장
5. 변동 감지: 직전 대비 ±5% 이상이면 알람 후보
6. 완료 → JobRun 상태 업데이트
7. 실패한 SKU: 3회 재시도 후 DeadLetter

### 5.3 재시도 정책

- HTTP 5xx, 네트워크 타임아웃: 재시도 O (3회, exponential backoff 2^n 초)
- HTTP 4xx (404, 403): 재시도 X, 즉시 DLQ
- 파싱 실패(예: 셀렉터 미매칭): 재시도 X, DLQ + 원본 HTML 저장

## 6. 비기능 요구사항

- **처리 시간**: 전체 수집 1시간 이내 (목표), 2시간 내 실패 처리(소프트 SLA)
- **정확도**: 샘플 검증 시 가격 추출 정확도 95% 이상
- **데이터 보존**: PriceSnapshot 1년, 그 후 월별 집계 후 원본 삭제
- **비용**: egress + compute 월 50 USD 이하
- **가용성**: 일 1회 실행 기준 월 28일 이상 성공 (≈93%)

## 7. 모니터링 / 알람

- **Grafana 대시보드**:
  - 경쟁사별 수집 성공률
  - SKU별 시계열 가격 차트
  - DLQ 적재량 추이
- **Slack 알람**:
  - JobRun.status=failed: 즉시 #data-ops
  - DLQ 적재 ≥ 50 건: 1회/일 요약
  - 가격 변동 ±5% 이상: #md-team (SKU 링크 포함)

## 8. 보안 / 컴플라이언스

- robots.txt 존중: 수집 전 disallow 체크, 해당 경로는 스킵
- User-Agent: 공개 식별 포함 (`OurCompany PriceBot (ops@...)`)
- 1초 간격 준수 (과도한 부하 방지)
- raw HTML 보관은 파싱 실패 케이스에 한함 (저장 용량 제어)
- 수집한 데이터 외부 재판매·배포 금지 (내부 MD 의사결정용만)

## 9. 기술 스택

- **언어**: Python 3.12 + asyncio
- **HTTP**: httpx (비동기), playwright (JS 렌더 사이트)
- **파싱**: selectolax (static) + playwright eval (dynamic)
- **DB**: PostgreSQL + S3(raw HTML)
- **스케줄러**: Kubernetes CronJob
- **큐**: Redis + RQ (단순)
- **언어 선정 이유**: playwright 생태계 + 내부 데이터 엔지니어 역량
- **대안**: TypeScript + puppeteer 도 검토했으나 내부 숙련도가 낮음

## 10. 배포 / 운영

- k8s CronJob 으로 배포
- 시크릿: DB 접속 정보, 내부 S3 키 — k8s secret 관리
- 로그: stdout → Fluentd → ELK
- 알람 수신자는 `#data-ops` Slack 채널

## 11. 엣지 케이스

- 경쟁사 사이트 구조 변경(셀렉터 깨짐): DLQ + Slack 알람. 수동 개입 필요
- 상품이 경쟁사에서 판매 중단된 경우: tracked_sku에 `removed_at` 마킹 + 알람 (정책 결정 필요)
- 통화 표기 변경(KRW vs 달러): 파싱 시 통화 기호 포함 저장, 비교는 원본 통화 내에서만
- 환율 변동 처리: v1 에서는 통화 정규화 안 함. 각 통화별로 비교
- 크롤링 차단(IP 밴): 24시간 후 재시도, 지속 시 수동 해결

## 12. 성공 지표

- 크롤링 성공률(SKU 단위) ≥ 95%
- MD팀 "수동 체크 시간" 감소 측정 — 도입 전후 설문
- Slack 가격 변동 알람 클릭율 > 30% (유용성 지표)

## 13. 일정

- **M1 (1주)**: 단일 경쟁사 + 10개 SKU 수집 파이프라인 end-to-end
- **M2 (1주)**: 나머지 5개 경쟁사 확장, JS 렌더 지원, 재시도/DLQ
- **M3 (3일)**: Grafana + Slack 연동
- **M4 (2일)**: 법무 리뷰 대응, 운영 문서화

총 2.5주 + 버퍼 0.5주.

## 14. 가정 / 위험

- 경쟁사 사이트 구조가 6개월 내 대규모 개편되지 않음 (위험: 매달 1~2곳 소폭 변경 가정)
- robots.txt 위반이 없다는 법무 컨펌: **미해결**
- playwright 가 모든 JS 렌더 사이트에서 동작 — 일부 봇 차단 서비스(Cloudflare Turnstile)는 우회 불가. 이 경우 해당 사이트는 제외
- SKU 매핑(우리 SKU ↔ 경쟁사 상품) 은 수작업. 초기 1,200개는 MD팀이 제공.

## 15. 오픈 이슈

1. 상품 판매 중단 시 알람 보낼지 말지
2. 가격 변동 임계값 ±5% 가 적절한지 (카테고리별 조정?)
3. DLQ 재처리 UI 필요성 (당장은 DB 직접 조회)
4. 실패한 JobRun 의 부분 성공 데이터 보존 정책
5. 법무 컨펌 시한 — M3 이전에 확정되어야 런칭 가능

---

*내부 도구. 사용자는 MD팀 7명 + 데이터팀 3명.*
