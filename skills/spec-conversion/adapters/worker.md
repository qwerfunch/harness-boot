# Adapter: worker

**출처 샘플**: price-crawler (v0.2)
**버전**: 0.1

## 1. 도메인 시그널

- "cron", "매일 ##:00", "batch", "큐 컨슈머", "ETL", "수집", "크롤러"
- deliverable 이 장기 실행/스케줄 기반
- UI 없음 또는 외부 대시보드(Grafana)만

## 2. 우선 체크 갭 (priority order)

1. **G-14 schedule/concurrency** — cron·동시성·rate limit
2. **G-15 failure_policies** — 재시도·DLQ·backoff
3. **G-16 observability** — 메트릭·알람·대시보드
4. **G-06 external dependencies** — 데이터 소스·저장소·알람 채널
5. **G-12 tuning_constants** — 간격·동시성 상수

## 3. 권장 엔티티 원형

| 엔티티 | 역할 | 필수 불변식 |
|--------|------|-------------|
| JobRun | 실행 이력 | status 전이 명시 |
| DataSource | 외부 수집 대상 | 활성 플래그, 정책 |
| DataSnapshot | 시점 데이터 | (source, collected_at) 유일 |
| DeadLetter | 실패 레코드 | 원본 보존, 재처리 경로 |
| TrackedItem | 내부 키 ↔ 외부 대상 매핑 | 유니크 쌍 |

## 4. 매핑 힌트

| 원본 패턴 | spec 필드 |
|-----------|----------|
| "매일 03:00 KST" | unrepresentable → NEW-G-14 proposal (`entry_points[].schedule`) |
| "HTTP 5xx 재시도 3회, exponential backoff" | unrepresentable → G-15 `failure_policies[]` |
| "concurrency 1 per source" | unrepresentable → G-14 `concurrency.per_key` |
| "Grafana: 수집 성공률" | unrepresentable → G-16 `observability.metrics[]` |
| "Slack 알람 JobRun.failed" | unrepresentable → G-16 `observability.alerts[]` |
| "DLQ ≥ 50 일 요약" | G-16 alert + G-15 failure_policy 결합 |

## 5. 흔한 함정

- **BR 에 스케줄·재시도·DLQ 를 모두 섞기** — P-13/P-14 위반. 각각 분리.
- **"대시보드는 외부"라고 observability 누락** — 외부여도 어떤 메트릭을
  emit 하는지는 스펙 대상.
- **UI 가 없어서 deliverable.type 을 잘못 선택** — worker 가 맞음, web-service
  아님(프론트엔드가 없는 경우).
- **robots.txt / 법무 이슈를 stakeholder.concerns 한 줄로 축소** — open_question
  으로 구조적 보존.

## 6. 체크리스트 확장

core 체크리스트에 더:

- [ ] `deliverable.type == "worker"` 이고 `entry_points[].kind == "background-job"`
- [ ] 스케줄 표현(cron)이 원본에 있으면 unrepresentable 에 G-14 엔트리 존재
- [ ] "DLQ", "retry", "backoff" 중 하나라도 원본에 있으면 G-15 엔트리 존재
- [ ] 메트릭·알람 언급이 있으면 G-16 엔트리 존재
- [ ] 데이터 소스 벤더 이름이 features[].modules 에 등장 → G-06 으로 승격
