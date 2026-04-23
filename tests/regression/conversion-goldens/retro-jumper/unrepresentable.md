# Unrepresentable.md — Retro Jumper 갭 카탈로그

**대상**: `plan.md` (Retro Jumper v0.2 draft)  
**스키마**: v2.3.7  
**비교 대상**: `design/samples/url-shortener/unrepresentable.md` (G-01~G-10)

이 파일은 URL 단축기 카탈로그 대비 **재현된 갭**(=P0 승격 후보 보강)과 **게임 도메인 고유 신규 갭**을 구분하여 기록한다.

---

## 1. URL 단축기에서 재현된 갭

| ID | 재현 여부 | 게임 도메인에서의 구체 양상 |
|----|-----------|-----------------------------|
| G-01 NFR | **재현** | 60 FPS / 30 FPS 하한, 입력 지연 16ms, 메모리 누수 하한, 로딩 2초. 모두 spec.yaml에 구조적으로 담기지 못함 |
| G-02 API | **재현** | `POST /api/scores`, `GET /api/scores/top?n=10`, `GET /api/scores/around` — features AC에 자연어로 산포 |
| G-03 Entity attributes | **재현** | Score(id/nickname/score/played_at/client_hash), AbuseLog 필드 목록이 invariants 로만 일부 녹음 |
| G-04 UI screens | **재현** | 타이틀/게임/게임오버/리더보드/설정 5개 화면 — modules(game-ui) 로만 암시 |
| G-05 Edge cases | **재현** | 탭 비활성화 처리, 네트워크 단절, 화면 리사이즈 — 일부는 BR로, 대부분 AC 자연어 |
| G-06 External deps | **재현** | Cloudflare Workers, D1, (선택) Cloudflare Analytics — 구조적 자리 없음 |
| G-07 Success metrics | **재현** | 3일간 500 세션, 평균 3판, 제출율 40% — 전부 누락 |
| G-08 Milestones | **재현** | M1~M4 2.5주 — priority 숫자로만 |
| G-09 Risks/assumptions | **재현** | 주니어 역량, 디자이너 투입, 30FPS 보장 — stakeholders.concerns 에 부분 흘림 |
| G-10 Open questions | **재현** | Phaser vs 직접 엔진, 탭 정책, 욕설 필터 수준 등 5개 — 대부분 AC에 녹아 오결정 유발 (예: F-007에서 "세션 내에서만" 이라고 섣불리 결정) |

**재현율 10/10 = 100%.** URL 단축기에서 식별한 모든 갭이 게임 도메인에서도 동일하게 나타남. 이는 **도메인 독립적인 구조 결핍**임을 강하게 시사.

---

## 2. 게임 도메인 고유 신규 갭

### G-11. 에셋 / 리소스 매니페스트

**plan.md §4 인용**:
> - 해상도: 256x144 가상 해상도, 디스플레이는 배율 스케일
> - 팔레트: 16색 고정 (Pico-8 스타일)
> - 스프라이트: 캐릭터 8x8, 장애물 8x16, 배경 타일 8x8
> - BGM: 8-bit 루프. chiptune. 30초 이내 루프.
> - SFX: 점프, 수집, 게임오버 3종 최소.

**현재 스키마 처리**: 자리 없음.

**임시 대응**: 완전 누락. spec.yaml에 표현 시도 흔적 없음.

**제안 (P1, 게임 이외 도메인에서도 발현 가능):**

```yaml
assets:                                 # 🔒 v2.3.8+ 후보
  palette:
    max_colors: 16
    reference: "design/palette.md"
  sprites:
    - id: "SP-001"
      role: "player"
      dimensions: [8, 8]
      source: "assets/sprites/player.png"
  audio:
    - id: "AU-001"
      role: "bgm"
      constraint:
        max_duration_seconds: 30
        loop: true
  budget:                                # 🔒 전체 에셋 용량 상한
    total_size_kb: 500
```

도메인 일반화 근거: 폰트·로고·샘플 데이터 등 "제품에 동봉되는 정적 자원"은 게임이 아니어도 자주 등장 (예: 웹 서비스의 랜딩 페이지 이미지, CLI 의 템플릿 파일). `assets` 네임스페이스는 v2.3.8+ 후보.

### G-12. 튜닝 상수 / 밸런스 테이블

**plan.md 인용**:
> - 난이도: 시간 경과에 따라 스크롤 속도 증가 (초당 10%씩 가속? — 튜닝 필요)
> - k 계수는 설정 파일에서 튜닝 가능 (초기 후보 k=0.01)
> - 무적 3초, 2x 점수 N초 등

**현재 스키마 처리**: 자리 없음. `features[].acceptance_criteria[]` 에 자연어로 "k=0.01" 을 끼워넣는 식.

**임시 대응**: F-002 AC 에 "초기 후보 k=0.01" 같은 수치를 자연어로 녹임. 튜닝 과정이 반복될 때마다 AC 를 고치는 것은 부자연스러움.

**제안 (P1, 특정 도메인에 발현):**

```yaml
tuning_constants:
  - id: "TC-001"
    name: "scroll_speed_acceleration_k"
    description: "스크롤 가속 계수"
    type: "number"
    default: 0.01
    range: [0.0, 0.1]
    unit: "per_second"
    tuned_by: ["F-002"]                 # 🔒 이 상수를 사용하는 feature
    owner: "game-designer"
```

도메인 일반화 근거: 게임의 밸런스·웹 서비스의 rate limit 한도·추천 알고리즘의 가중치 등, "런타임에 튜닝되는 상수"는 여러 도메인에서 공통 등장. 최소한 `configurable_parameters` 수준으로 구조화 고려.

### G-13. 비목표 (Non-Goals / Out-of-Scope)

**plan.md 인용**:
> "운영 품질·수익 모델·확장성은 명시적 비목표."
> "리플레이 기록 저장은 v1 범위 밖 (v2 검토)"
> "키 리매핑 (v1 범위 밖)"

**현재 스키마 처리**: 자리 없음.

**임시 대응**: project.vision 에 "명시적 비목표" 한 문장, 일부 AC 에 "v1 범위 밖" 자연어 주석.

**문제**: 비목표는 **AI 에이전트가 "왜 이건 안 만드는가"를 이해하게 하는 중요한 시그널**. 이게 없으면 에이전트가 "누락된 기능"이라 판단해 추가 구현을 시도할 위험.

**제안 (P0 후보):**

```yaml
non_goals:
  - id: "NG-001"
    statement: "운영 품질·수익 모델은 이 프로젝트 범위 밖"
    reason: "해커톤 데모 타겟"
  - id: "NG-002"
    statement: "리플레이 기록 저장"
    reason: "v1 범위 밖, v2에서 재검토"
    deferred_to: "v2"                   # 🔒
```

**도메인 일반화 근거**: URL 단축기에서도 "API는 v1.5", "abuse report는 v2" 같은 비목표가 있었으나 구조적으로 표현 못함. **비목표는 거의 모든 제품 기획에 존재**하므로 P0 승격 후보.

---

## 3. 이번 변환에서 내린 도메인 고유 판단

### J-1. deliverable.type 에 `game` 없음 → 임시로 `web-service` 사용

- 현재 스키마: `cli | web-service | game | worker | library | static-site` (게임 type 있음!)
- 그러나 type=game 일 때의 `entry_points[].health_check.type` 이 `http-200` 과 `window-open` 중 후자를 권장하는데, 해커톤 데모는 web 기반이라 http-200이 자연스러움
- 판정: **type=web-service** 로 둠. 이는 "게임이 웹 앱인 경우"에 대한 정확한 매핑 규칙이 스키마에 없는 것을 시사
- 제안: `deliverable.type` 을 단일 enum 대신 **primary/secondary** 로 중첩하거나, `platform: browser | native | mobile` 필드 추가

### J-2. prototype_mode=true 적용

- 해커톤 데모라는 맥락에서 **적극적으로 prototype_mode 활성**
- 이 경우 F-000 스켈레톤 요구사항이 완화된다는 규칙이 존재(§5.1 검증규칙 #2)
- 그러나 prototype_mode 를 "얼마나 완화하는가"가 자연어 수준 — 더 정밀한 단계 필요할 수 있음

### J-3. 부정 방지(anti-cheat) 수준은 "기본만" — 이는 어디에?

- plan.md는 명시적으로 "기본만" 이라 적음
- spec.yaml에서는 BR-002/BR-003 으로 BR 승격
- 그러나 "어느 수준까지 방어하는가"는 보안 품질 프로파일(security_profile) 같은 필드가 있으면 자연
- 현재는 `policies.security_gate` 가 harness.yaml 에 있지만 이는 harness 파이프라인 게이트이지 제품의 보안 수준이 아님
- 제안: `constraints.security_profile: minimal | standard | hardened` 같은 필드?

---

## 4. 요약 테이블

| ID | 타입 | 우선순위 | 재현성 (샘플 수) |
|----|------|----------|-----------------|
| G-01 NFR | 재현 | **P0** | 2/2 |
| G-02 API | 재현 | **P0** | 2/2 |
| G-03 Entity attrs | 재현 | **P0** | 2/2 |
| G-04 UI screens | 재현 | P1 | 2/2 |
| G-05 Edge cases | 재현 | P1 | 2/2 |
| G-06 External deps | 재현 | **P0** | 2/2 |
| G-07 Metrics | 재현 | P1 | 2/2 |
| G-08 Milestones | 재현 | P1 | 2/2 |
| G-09 Risks/assumptions | 재현 | P1 | 2/2 |
| G-10 Open questions | 재현 | **P0** | 2/2 |
| **G-11 Assets manifest** | 신규 | P1 | 1/2 |
| **G-12 Tuning constants** | 신규 | P1 | 1/2 |
| **G-13 Non-goals** | 신규 | **P0** | 2/2 (URL 단축기에서도 "v1 범위 밖" 흔적) |

**P0 후보 총 6개** (G-01/02/03/06/10 + G-13 신규).

---

## 5. 다음 샘플에서 검증할 것

- price-crawler(worker)에서 G-11/G-12/G-13 이 재현되는지
- worker 도메인 고유 갭(스케줄 정책, 재시도, DLQ)이 추가로 필요한지
- worker 에서도 "비목표" 가 나타나는지 (예: "실시간 처리는 비목표")
