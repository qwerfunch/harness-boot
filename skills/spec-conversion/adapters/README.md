# Domain Adapters — spec-conversion

**왜 분리하는가**: core SKILL.md 는 범용 원칙(P-1~P-14/P-15~P-21)만 담고,
도메인 특수 체크는 어댑터로 분리. 이유는 두 가지:

1. **프롬프트 경제성** — agent 가 관련 없는 도메인 체크까지 다 로드하면 토큰 낭비
2. **명시적 도메인 인식** — 정찰 단계에서 "이 문서는 어떤 도메인인가" 를
   먼저 판정하고 해당 어댑터를 로드하는 구조가 재현성 ↑

## 로딩 규칙

정찰 1단계 직후:

```
1. plan/architecture 의 deliverable 성격을 식별한다.
   signal → domain:
     "cron/스케줄/큐 컨슈머/ETL"       → worker
     "React/프론트엔드/SaaS/요금제"    → saas
     "게임/FPS/캔버스/스프라이트"       → game
     "라이브러리/SDK/패키지/npm/pypi"  → library
     "APK/native/SAST/Taint"           → security (VAPT 특수)
     "데이터 수집/크롤러"              → worker + data-pipeline
     "플러그인/CLI/slash command/devtool" → meta (v0.0 draft, 단일 샘플 기반)
2. 매칭된 도메인의 adapter .md 를 Read 한다 (core SKILL.md 와 병용)
3. 복수 도메인이 해당되면 모두 로드 (예: VAPT 는 saas + security)
```

## 어댑터 인터페이스

각 어댑터는 다음 섹션을 가진다:

- **1. 도메인 시그널** — 이 어댑터를 언제 활성화할지
- **2. 우선 체크 갭** — 이 도메인에서 빈번한 갭 ID 리스트
- **3. 권장 엔티티 원형** — 이 도메인에서 전형적으로 등장하는 3~7개
- **4. 매핑 힌트** — 도메인 특수 섹션 → spec 필드 매핑 추가
- **5. 흔한 함정** — 이 도메인에서 반복되는 실수
- **6. 체크리스트 확장** — core 체크리스트에 더할 항목

## 어댑터 버전 관리

어댑터도 SemVer. SKILL.md 의 `compatible_adapters` 섹션에서 버전 범위 선언.
