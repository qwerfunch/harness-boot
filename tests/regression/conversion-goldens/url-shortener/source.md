# URL 단축기 서비스 기획안

**작성자**: PM  
**작성일**: 2026-04-20  
**버전**: 0.3 (draft)  
**상태**: 내부 리뷰용

---

## 1. 배경 및 문제 정의

마케팅팀에서 광고 링크를 공유할 때 URL이 너무 길어서 (쿼리 파라미터가 많아서) SNS나 문자 메시지에 붙이기 어렵다는 피드백이 꾸준히 있었음. 기존에는 bit.ly 같은 외부 서비스를 쓰고 있었는데,

- 브랜드 도메인이 아니라 신뢰도 문제
- 클릭 통계를 외부에 의존 (분석팀이 원본 데이터 접근 불가)
- 유료 플랜 가격이 점점 오름

자체 단축기를 만들어서 `go.ourcompany.com/abc123` 같은 형태로 제공하자는 것이 이번 프로젝트의 목적.

## 2. 타겟 사용자

크게 두 부류:

**A. 내부 사용자 (admin)**: 마케팅팀, 그로스팀. 링크를 만들고 통계를 보는 사람들. 초기에는 10명 이하 예상. 기술에 익숙하진 않지만 엑셀 정도는 잘 다룸.

**B. 방문자 (end-user)**: 단축 링크를 클릭하는 외부 사용자. 이 사람들은 우리 서비스의 존재조차 모르고 그냥 리다이렉트만 빠르게 되면 됨. 로그인 없음.

> 나중에 일반 유저도 회원가입해서 링크 만들 수 있게 할 수 있음 (v2 에서 고려)

## 3. 핵심 기능

### 3.1 URL 단축 (필수)

- 긴 URL을 입력하면 짧은 코드를 반환
- 코드는 6~8자 영문+숫자 (대소문자 구분)
- 같은 URL을 두 번 단축해도 다른 코드가 나와도 괜찮음 (굳이 dedup 안 해도 됨)
- 커스텀 코드도 가능 (`go.ourcompany.com/summer-sale` 처럼)
- 만료일 설정 가능 (선택사항, 기본값은 무제한)

### 3.2 리다이렉트 (필수)

- `GET /:code` 요청이 오면 302로 원본 URL로 리다이렉트
- 만료된 링크는 안내 페이지 표시 (404? 전용 페이지? TBD)
- 클릭 시 로그 기록 (timestamp, user agent, referer, IP 국가 정도)

### 3.3 관리자 대시보드 (필수)

- 로그인 후 링크 목록 보기 (검색, 필터, 정렬)
- 링크 상세: 총 클릭 수, 시간대별 그래프, 국가별 분포, referer top 10
- 링크 편집 (원본 URL 변경 가능? — 보안상 문제될 수 있어서 논의 필요), 삭제, 만료일 변경
- 링크 생성 폼 (벌크 업로드도 있으면 좋음, CSV)

### 3.4 어드민 계정 관리 (필수)

- 이메일 + 비밀번호 로그인
- 2FA (TOTP) — 마케팅팀에서 "꼭 필요해?" 라고 했는데 보안팀에서는 필수라고 함. 일단 필수로 가정.
- 초대 기반 가입 (누구나 가입 불가, 기존 어드민이 이메일 초대)
- role: owner / editor / viewer 정도면 될 듯

### 3.5 QR 코드 (있으면 좋음)

- 링크 상세 페이지에서 QR 다운로드 버튼
- PNG로 내려받기
- 크기 몇 가지 선택 가능하면 좋음

### 3.6 API (나중에)

- 외부 시스템이 programmatic 하게 링크 만들 수 있도록
- API key 발급, rate limit 필요
- v1 범위는 아님 (v1.5 정도)

## 4. 비기능 요구사항 (NFR)

- **응답 속도**: 리다이렉트 p95 < 50ms (이게 느리면 유저가 이탈함). 대시보드는 p95 < 1s 정도면 됨.
- **가용성**: 99.9% (연 8.76시간 다운타임 허용). 리다이렉트는 특히 중요.
- **확장성**: 초기 1만 클릭/일, 1년 후 100만 클릭/일 예상. 총 링크는 10M 개까지 무리없이.
- **데이터 보존**: 클릭 로그는 2년 보관 후 집계 테이블만 남기고 삭제.

## 5. 보안

- 악성 URL 차단: Google Safe Browsing API로 단축 시 체크. 악성이면 거부.
- Rate limiting: 익명 사용자는 초당 N회로 제한. 구체적인 N은 운영하면서 튜닝.
- Admin 2FA 필수 (위 참고)
- HTTPS 강제
- 로그인 실패 5회 시 잠금 (15분?)
- SQL injection, XSS 등 기본 방어는 당연히

> 스팸 링크 문제는 어떻게? 도입 후 운영하며 대응하기로 함. (abuse report 기능은 v2)

## 6. 기술 스택 제안

- **백엔드**: TypeScript + Fastify (Express보다 빠르고 타입 친화적)
- **DB**: PostgreSQL (주 저장소) + Redis (단축 코드 → 원본 URL 캐싱, rate limit)
- **프론트엔드**: Next.js (admin 대시보드). 퍼블릭 랜딩은 간단한 static page.
- **인프라**: AWS (EKS? ECS? — DevOps 팀과 논의). RDS Postgres + ElastiCache Redis.
- **모니터링**: Datadog 또는 Grafana Cloud (사내 표준)
- **CI/CD**: GitHub Actions → ECR → 배포

> Go로 하자는 의견도 있었음. 성능은 좋지만 팀 역량상 TS가 나음.

## 7. 데이터 모델 (초안)

**User**
- id, email, password_hash, role (owner/editor/viewer), totp_secret, invited_by, created_at, last_login_at

**Link**
- id, short_code (unique), original_url, created_by (User.id), custom (boolean), expires_at (nullable), is_active, created_at, updated_at

**Click**
- id, link_id, clicked_at, ip_country, user_agent, referer

**Invitation**
- id, email, token, invited_by, expires_at, accepted_at

> 집계 테이블은 필요해지면 추가. 초기엔 Click에서 직접 쿼리.

## 8. API 설계 (초안)

**Public**
- `GET /:code` → 302 redirect (or 410 if expired, or 404 if not found)
- `GET /health` → 200 OK

**Admin (인증 필요)**
- `POST /api/links` — body: {original_url, custom_code?, expires_at?}
- `GET /api/links?q=&limit=&offset=&sort=`
- `GET /api/links/:id`
- `PATCH /api/links/:id` — 편집
- `DELETE /api/links/:id`
- `GET /api/links/:id/stats?from=&to=&groupBy=day|hour`
- `POST /api/links/:id/qr?size=256` → PNG

**Auth**
- `POST /api/auth/login` — {email, password, totp}
- `POST /api/auth/logout`
- `POST /api/auth/invite` — owner만
- `POST /api/auth/accept-invite` — {token, password, totp_setup}

## 9. UI 화면

- 퍼블릭:
  - 랜딩 페이지 (서비스 설명, 간단)
  - 만료/비활성 링크 안내 페이지
- Admin:
  - 로그인 (+ 2FA 입력)
  - 초대 수락 페이지
  - 대시보드 (전체 통계 요약)
  - 링크 목록 (검색/필터/정렬)
  - 링크 생성 (단일 / 벌크 CSV)
  - 링크 상세 + 통계 + QR
  - 사용자 관리 (owner만)
  - 설정 (비밀번호 변경, 2FA 재설정)

와이어프레임은 디자인팀이 별도 제공 예정. 이 문서에서는 생략.

## 10. 엣지 케이스 / 예외 처리

- short_code 충돌: 랜덤 생성 시 중복 나면 재시도. 5번 실패하면 500? 아니면 더 긴 코드? — 개발 중 결정
- 커스텀 코드가 예약어(`api`, `admin`, `health`, ...)와 겹치면 거부
- 원본 URL이 우리 도메인으로 다시 오는 무한 루프: 거부
- 삭제된 유저의 링크는 어떻게? — soft-delete, 링크는 유지하되 owner 없음으로 표시
- 만료된 링크 클릭: 클릭 통계에는 기록? — 일단 기록 O, 대시보드에서 필터 가능하게
- 동일 IP에서 F5 연타 시 클릭 수 튀는 문제: 1분 내 중복 IP는 1회로 집계 (단, raw log는 다 저장)

## 11. 외부 의존성

- Google Safe Browsing API (악성 URL 탐지)
- SendGrid (초대 메일, 비밀번호 재설정 메일)
- MaxMind GeoIP DB (IP → 국가 매핑, 무료 버전)
- (선택) Sentry (에러 모니터링)

## 12. 성공 지표

- 내부 전환율: 마케팅팀이 외부 bit.ly 대신 내부 도구를 쓰는 비율 > 80% (3개월 내)
- WAU (Weekly Active Admin): > 8명
- 평균 링크당 클릭 수 / 추적 가능한 캠페인 수
- 리다이렉트 p95 latency < 50ms 유지

## 13. 일정 / 마일스톤

- **M1 (4주)**: MVP — 단축 / 리다이렉트 / 최소 대시보드 / 로그인
- **M2 (2주)**: 어드민 기능 고도화 — 통계, 편집, 초대, 2FA
- **M3 (1주)**: 모니터링 / 배포 안정화 / 부하 테스트
- **M4 이후**: QR, 벌크 업로드, API, abuse report

총 7주 + 버퍼 1주 = 8주 목표.

## 14. 위험 요소 / 가정

- 초기 트래픽 가정: 1만 클릭/일. 실제로 더 낮을 수도, 더 높을 수도. (캠페인 시즌 편차 큼)
- 어드민은 1명부터 시작 (initial owner는 PM이 수동 생성하여 부트스트랩)
- 디자인 리소스 확보 가정 (디자이너 0.5 FTE, 4주)
- 법무 리뷰: 클릭 로그에 IP 저장이 개인정보 이슈. 법무팀 컨펌 후 진행 — **미해결**
- DevOps 지원: 인프라 세팅 도움 필요. 일정 조율 필요

## 15. 오픈 이슈 / 논의 필요

1. 어드민이 링크의 `original_url`을 변경할 수 있게 할지 (bait-and-switch 위험)
2. 만료된 링크에 대한 404 vs 410 vs 전용 안내 페이지
3. custom_code 예약어 목록 — 개발 시작 전에 확정
4. 집계 테이블 스키마 — v2에서 결정
5. IP 저장 관련 법무 컨펌
6. 일반 유저 회원가입 로드맵 (v2 타이밍)

---

*이 문서는 초안이며 리뷰 과정에서 변경될 수 있음. 변경 이력은 git log 참고.*
