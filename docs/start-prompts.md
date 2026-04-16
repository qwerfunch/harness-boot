# 하네스 엔지니어링 시작 프롬프트

---

## 🚀 킥오프 (메인)

```
너는 지금부터 하네스 엔지니어를 수행한다.

## 입력
1. 상세 계획: `{상세계획MD경로}` — 이미 작성된 프로젝트 상세 계획
2. 하네스 가이드: `HARNESS_ENGINEERING_GUIDE.md`

## 임무
상세 계획을 하네스 가이드의 산출물로 분해하여 실행 가능한 하네스를 생성하라.
MD, hooks 스크립트, settings.json, feature-list.json 모두 생성 대상.

## 생성 순서
가이드 "12. 생성 순서" Phase 1~6을 따르되:
- Phase 1: hooks/ 스크립트를 실행 가능한 bash로 생성
- Phase 3: 에이전트에 model: opus/sonnet 프론트매터 포함
- Phase 4: 모든 스킬은 6섹션 Anatomy 준수 (Overview/When/TDD Focus/Process/Rationalizations/Red Flags/Verification). Rationalizations 최소 3행.
- Phase 6: feature-list.json을 상세 계획에서 JSON으로 추출

## 4대 원칙
1. TDD-First — 서브에이전트 3분할 컨텍스트 격리
2. 반복 수렴 — 최대 5회, 초과 시 에스컬레이션
3. 코드-문서 동기화 — 3중 방어 (프롬프트 + 훅 + 리뷰)
4. Anti-Rationalization — 모든 스킬에 변명-반론 테이블

## 제약
- CLAUDE.md ≤ 1,500 토큰 / SKILL.md ≤ 500줄
- hooks: shebang + stdin JSON 파싱
- feature-list.json: passes 필드만 변경 가능
- 불확실한 부분: {TODO: 확인 필요}
- 품질 게이트 체크항목에 증거 유형 명시

## 시작
상세 계획을 읽고 보고하라:
1. 기술 스택 (명시 여부 확인 → 명시됨이면 채택, 미명시면 추천안 2~3개 제시)
2. 서브 CLAUDE.md 대상 디렉토리
3. 에이전트/스킬 추가·제거 필요 여부
4. feature-list.json 초안 (ID + 설명 + tdd_focus)
5. 코드-문서 동기화 매핑 초안
6. hooks 프로젝트별 커스터마이징 사항
7. 스킬별 Rationalization 후보
8. Phase별 예상 파일 수

보고 후 확인을 받고 Phase 1부터 시작하라.
```

---

## 🔄 Phase 확인

```
Phase {N} 확인. {수정사항 또는 "수정 없음."}
Phase {N+1}로 진행.
```

---

## 🧪 검증

```
생성된 하네스 전체를 검증하라.

1. 파일 완전성: settings.json + hooks 5종 + 에이전트 9종 + 스킬 8종 + 프로토콜 5종 + feature-list.json
2. 런타임 가드레일: 훅 stdin JSON 파싱, security-gate exit 2, doc-sync-check 커밋 차단
3. Skill Anatomy: 6섹션 + Rationalizations ≥3행 + Red Flags ≥2항목 + Verification 증거 유형 + ≤500줄
4. 품질 게이트: Gate 0~4 존재, 모든 체크에 증거 유형, Rationalization 방어 포함
5. TDD: 서브에이전트 3종 프론트매터, Red→Green 호출 순서, Gate 0 전제 조건
6. 모델 라우팅: opus 4종 / sonnet 5종 프론트매터 model: 필드
7. 크로스 세션: bootstrap 훅 → PROGRESS.md + feature-list.json 읽기
8. 코드-문서 동기화: 3중 방어 작동, 매핑 테이블 = 프로젝트 구조
9. 토큰: CLAUDE.md ≤1,500 토큰, 1회 태스크 ~3,800 토큰
10. 드라이런: 정상TDD / 3회반복 / 문서누락차단 / 5회에스컬레이션 / Rationalization차단

각 항목 PASS/FAIL. FAIL은 수정 방안 제시.
```

---

## 🚀 개발 시작

```
하네스 준비 완료. 개발 시작.

1. orchestrator.md 로드
2. PROGRESS.md 확인 → Initializer/Coding 모드 판단
3. feature-list.json에서 passes: false 최우선 기능 선택
4. 한 번에 하나의 기능만 작업
5. TDD 서브에이전트 3분할 구현
6. 완료 시: passes: true + PROGRESS.md + 코드+테스트+문서 원커밋

시작하라.
```

---

## 💡 상황별

**중단 재개**:
```
이전 세션 중단. PROGRESS.md의 In Progress TDD Phase 확인 → feature-list.json 현재 기능 확인 → git log 마지막 커밋 확인 → 이어서 작업.
```

**테스트 연속 실패**:
```
debugger 에이전트 전환. 실패 테스트: {경로}, 에러: {메시지}. 근본 원인 분석 → 최소 수정 → 회귀 테스트 추가.
```

**문서 동기화 점검**:
```
git log 최근 10개 커밋 → 코드 변경 있는데 문서 변경 없는 커밋 식별 → 누락 문서 업데이트 → PROGRESS.md 갱신.
```

**진행률 확인**:
```
feature-list.json 기반: 전체/완료/미완료 수, 카테고리별 완성률, 다음 우선순위 3개 추천.
```
