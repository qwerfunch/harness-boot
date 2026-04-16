---
description: 상세 계획 MD를 읽어 하네스 전체 구조를 생성합니다 (Phase 1~6). 프로젝트 최초 1회 실행. Usage - /setup path/to/plan.md
argument-hint: <상세계획MD경로>
---

# /setup — 하네스 부팅

상세 계획 MD를 읽고 Claude Code 네이티브 멀티 에이전트 하네스를 생성합니다.

## 입력
- 상세 계획 MD 경로: `$ARGUMENTS`

## 실행 절차

### Step 0: 사전 점검
1. `$ARGUMENTS`로 받은 상세 계획 MD 파일 존재 여부 확인
2. 파일이 없으면 사용자에게 경로 재확인 요청
3. 하네스 가이드 로드: `${CLAUDE_PLUGIN_ROOT}/docs/setup-guide.md`
4. PROGRESS.md 존재 여부 확인
   - 있으면: "하네스가 이미 존재합니다. 덮어쓸까요?" 확인 요청
   - 없으면: Initializer Mode 진행

### Step 1: 상세 계획 분석 및 보고
상세 계획을 읽고 다음을 사용자에게 보고:

1. **기술 스택**
   - 명시되어 있으면 → 그대로 채택
   - 미명시이면 → 요구사항 기반 추천안 2~3개 제시 (장단점 + 적합도 포함) → 사용자 선택 대기
2. **서브 CLAUDE.md 대상 디렉토리** (예: src/api, src/components)
3. **에이전트 추가·제거 필요 여부** (기본 9종 외 추가 필요한가)
4. **스킬 추가·제거 필요 여부** (기본 8종 외 추가 필요한가)
5. **feature-list.json 초안** (기능 ID + 설명 + tdd_focus)
6. **코드-문서 동기화 매핑 초안**
7. **hooks 스크립트 프로젝트별 커스터마이징 사항**
8. **스킬별 주요 Rationalization 후보**
9. **Phase별 예상 파일 수**

**사용자 확인을 받은 후 Step 2로 진행.**

### Step 2: Phase 1 — 기반 인프라
- `.claude/settings.json` (hooks 설정)
- `hooks/` 스크립트 5종 (실행 가능한 bash, shebang + stdin JSON 파싱)
- `.claude/environment.md`
- `.claude/security.md`
- `scripts/init-harness.sh`

**Phase 1 완료 리포트 → 사용자 확인 → Phase 2**

### Step 3: Phase 2 — 코어 프로토콜
- `.claude/protocols/` 5종 (tdd-loop, iteration-cycle, code-doc-sync, session-management, message-format)
- `CLAUDE.md` (메인, ≤1,500 토큰)
- `.claude/quality-gates.md`

**Phase 2 완료 리포트 → 사용자 확인 → Phase 3**

### Step 4: Phase 3 — 에이전트 9종
각 에이전트 YAML 프론트매터에 `model:` 필드 포함:
- `orchestrator.md` (model: opus)
- `architect.md` (model: opus)
- `reviewer.md` (model: opus)
- `debugger.md` (model: opus)
- `implementer.md` (model: sonnet)
- `tdd-test-writer.md` (model: sonnet)
- `tdd-implementer.md` (model: sonnet)
- `tdd-refactorer.md` (model: sonnet, effort: low)
- `tester.md` (model: sonnet)

**Phase 3 완료 리포트 → 사용자 확인 → Phase 4**

### Step 5: Phase 4 — 스킬 8종
6섹션 Anatomy 준수 (Overview / When to Use / TDD Focus / Process / Common Rationalizations(≥3행) / Red Flags(≥2항목) / Verification(증거 포함)):
- `new-feature`, `bug-fix`, `refactor`, `tdd-workflow`
- `api-endpoint`, `db-migration`, `deployment`, `context-engineering`

추가: `.claude/references/`, `.claude/examples/`, `.claude/context-map.md`

**Phase 4 완료 리포트 → 사용자 확인 → Phase 5**

### Step 6: Phase 5 — 서브 CLAUDE.md
Step 1에서 식별한 대상 디렉토리별로 서브 CLAUDE.md 생성.

**Phase 5 완료 리포트 → 사용자 확인 → Phase 6**

### Step 7: Phase 6 — 상태 추적
- `feature-list.json` (상세 계획에서 JSON 추출, passes: false)
- `PROGRESS.md`
- `CHANGELOG.md`
- `.claude/error-recovery.md`
- `.claude/observability.md`

### Step 8: 검증
생성된 하네스 전체 검증:
1. 파일 완전성: settings.json + hooks 5종 + 에이전트 9종 + 스킬 8종 + 프로토콜 5종 + feature-list.json
2. 런타임 가드레일: 훅 stdin JSON 파싱, security-gate exit 2, doc-sync-check 커밋 차단
3. Skill Anatomy: 6섹션 + Rationalizations ≥3행 + Red Flags ≥2항목 + Verification 증거 유형 + ≤500줄
4. 품질 게이트: Gate 0~4, 모든 체크에 증거 유형, Rationalization 방어
5. TDD: 서브에이전트 3종 프론트매터, Red→Green 호출 순서
6. 모델 라우팅: opus 4종 / sonnet 5종 프론트매터 model: 필드
7. 크로스 세션: bootstrap 훅 → PROGRESS.md + feature-list.json 읽기
8. 코드-문서 동기화: 3중 방어 작동, 매핑 테이블 = 프로젝트 구조
9. 토큰: CLAUDE.md ≤1,500 토큰, 1회 태스크 ~3,800 토큰

각 항목 PASS/FAIL 보고. FAIL은 수정.

### Step 9: 첫 커밋
```bash
git add .
git commit -m "harness: initial setup via harness-boot"
```

### Step 10: 완료
사용자에게 다음 단계 안내: `/start` 명령어로 개발 시작.

## 원칙
- 4대 원칙 준수: TDD-First / 반복 수렴 / 코드-문서 동기화 / Anti-Rationalization
- Phase별 사용자 확인 필수 (임의 진행 금지)
- 기술 스택 미명시 시 개발자 선택 대기 (임의 선택 금지)
- 상세 계획에 없는 내용은 `{TODO: 확인 필요}`로 표시
