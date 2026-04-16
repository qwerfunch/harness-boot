---
description: 하네스 준비 완료 후 실제 개발을 시작합니다. feature-list.json에서 다음 미완료 기능을 선택하여 TDD 사이클로 구현. 반복 실행 가능.
---

# /start — 개발 시작

하네스가 준비된 상태에서 실제 개발 작업을 시작합니다.

## 사전 조건
- `/setup`이 완료되어 있어야 함
- `.claude/settings.json`, `PROGRESS.md`, `feature-list.json`이 존재해야 함

## 실행 절차

### Step 1: 하네스 로드
1. `.claude/agents/orchestrator.md` 로드
2. SessionStart 훅이 제공한 컨텍스트 수신 (PROGRESS.md 요약, 미완료 기능 수, git log 5건)

### Step 2: 모드 판단
- **PROGRESS.md가 비어있거나 태스크 없음** → Initializer 이후 첫 시작
- **PROGRESS.md에 In Progress 태스크 존재** → 중단된 세션 재개
  - In Progress 태스크의 TDD Phase 확인 (Red / Green / Refactor / Verify)
  - 해당 Phase부터 이어서 작업
- **PROGRESS.md에 In Progress 없음** → 신규 기능 진행

### Step 3: 기능 선택
`feature-list.json`에서 `passes: false`인 기능 중 우선순위가 가장 높은 것을 선택.

의존 관계 고려:
- 가장 기초적인 기능부터 (auth > profile > order > payment 순)
- 이미 깨진 기능이 있으면 먼저 수정

선택된 기능을 사용자에게 보고:
```
다음 기능을 작업합니다:
  ID: FEAT-XXX
  카테고리: {category}
  설명: {description}
  TDD Focus: {tdd_focus}
  문서 동기화: {doc_sync}

진행할까요? (y/n)
```

### Step 4: TDD 사이클 실행
implementer 에이전트를 호출하여 TDD 서브에이전트 3분할 실행:

```
Plan (acceptance_criteria 분석)
  ↓
Red: tdd-test-writer 서브에이전트 호출
  - 실패하는 테스트 작성 (happy/boundary/error)
  - 구현 코드를 읽지 않음
  - 검증: 테스트 실행 → 전부 FAIL
  ↓
Green: tdd-implementer 서브에이전트 호출
  - 테스트 통과시키는 최소 구현
  - 검증: 테스트 실행 → 전부 PASS
  ↓
Refactor: tdd-refactorer 서브에이전트 호출
  - 동작 변경 금지
  - 검증: 테스트 여전히 PASS
  ↓
Verify: 전체 테스트 + 기능 검증
  - 실패 시 Green/Red로 복귀 (최대 5회)
  - 5회 초과 시 에스컬레이션
```

### Step 5: 품질 게이트 통과 확인
- Gate 0: TDD 준수 (증거: 테스트 파일, Red→Green 호출 순서)
- Gate 1: 구현 완료 (증거: 컴파일/린트/테스트 출력)
- Gate 2: 코드 리뷰 (reviewer 에이전트 호출 → Critical/Major 0개)
- Gate 3: 테스트 통과 (커버리지 리포트)
- Gate 4: 배포 승인 (feature passes: true 준비)

### Step 6: 코드-문서 동기화
매핑 테이블에 따라 관련 문서 업데이트:
- 소스 변경 → 관련 docs/*.md, 서브 CLAUDE.md
- 기능 완료 → feature-list.json (passes: true)
- 모든 변경 → PROGRESS.md

### Step 7: 원커밋
코드 + 테스트 + 문서를 하나의 커밋으로:
```bash
git add .
git commit -m "feat(FEAT-XXX): {description}"
```

PreToolUse 훅(pre-tool-doc-sync-check.sh)이 문서 동기화를 자동 검증하여 누락 시 커밋 차단.

### Step 8: 다음 기능 진행 여부 확인
사용자에게 다음 기능 계속 진행 여부 질문:
```
FEAT-XXX 완료. feature-list.json에 passes: true로 기록.
다음 기능을 계속 작업할까요? (y/n)
```

- y → Step 3으로 복귀 (다음 미완료 기능 선택)
- n → 세션 종료 보고

## 원칙
- **한 번에 하나의 기능만 작업** (Anthropic 핵심 교훈)
- Phase별 사용자 확인 없이 자동 진행하지 않음
- 수렴 실패(5회 초과) 시 debugger로 전환 제안
- feature-list.json의 `passes` 필드만 변경, 항목 추가/삭제/수정 금지

## 에스컬레이션 조건
다음 상황에서 자동 진행 중단 후 사용자에게 보고:
- 수렴 루프 5회 초과
- Gate 2에서 Critical 이슈 발견
- 문서 동기화 훅이 계속 차단
- 테스트 환경 구성 실패
