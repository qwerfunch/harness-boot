# 하네스 엔지니어링 가이드

> **전제**: 상세 계획 MD는 이미 존재한다.
> 이 가이드는 상세 계획을 Claude Code 네이티브 멀티 에이전트 실행 체계로 변환하는 설계 명세이다.

---

## 0. 핵심 철학

| 원칙 | 설명 | 강제 메커니즘 |
|------|------|-------------|
| **TDD-First** | 테스트 먼저 → 최소 구현 → 리팩토링. 핵심 로직에만 집중. | Gate 0 + 서브에이전트 컨텍스트 격리 |
| **반복 수렴** | 구현→테스트→검증→피드백→수정 루프. 수렴할 때까지 반복. | 최대 5회 후 에스컬레이션 |
| **코드-문서 동기화** | 코드 변경 시 관련 문서를 같은 커밋에서 함께 업데이트. | PreToolUse 훅으로 **런타임 차단** |
| **Anti-Rationalization** | 에이전트가 단계를 건너뛰는 변명을 사전 차단. | 모든 스킬에 변명-반론 테이블 내장 |

> LLM은 "이 작은 변경에는 테스트가 불필요하다" 같은 코너 커팅 추론에 능숙하다.
> "~하지 마라"보다 **"네가 X라고 말할 것을 안다. 그러나 Y 때문에 틀렸다"**가 더 효과적이다.

---

## 1. 디렉토리 구조

```
프로젝트 루트/
├── CLAUDE.md                              # 메인 엑기스 (<1500 토큰)
├── PROGRESS.md                            # 상태 추적
├── feature-list.json                      # 기능 목록 + 통과 상태 (JSON)
├── CHANGELOG.md                           # 하네스 변경 이력
│
├── .claude/
│   ├── settings.json                      # 훅 설정 (런타임 가드레일)
│   ├── agents/                            # 서브에이전트 9종
│   │   ├── orchestrator.md                #   총괄 (model: opus)
│   │   ├── implementer.md                 #   TDD 오케스트레이션 (model: sonnet)
│   │   ├── tdd-test-writer.md             #   Red 단계 전용 (model: sonnet)
│   │   ├── tdd-implementer.md             #   Green 단계 전용 (model: sonnet)
│   │   ├── tdd-refactorer.md              #   Refactor 단계 전용 (model: sonnet)
│   │   ├── reviewer.md                    #   코드 리뷰 (model: opus)
│   │   ├── tester.md                      #   통합/E2E 테스트 (model: sonnet)
│   │   ├── architect.md                   #   설계 결정 (model: opus)
│   │   └── debugger.md                    #   디버깅 전문 (model: opus)
│   ├── skills/                            # 스킬 8종 (YAML 프론트매터)
│   │   ├── new-feature/skill.md
│   │   ├── bug-fix/skill.md
│   │   ├── refactor/skill.md
│   │   ├── db-migration/skill.md
│   │   ├── api-endpoint/skill.md
│   │   ├── tdd-workflow/skill.md
│   │   ├── context-engineering/skill.md
│   │   └── deployment/skill.md
│   ├── references/                        # 스킬 500줄 초과 시 분리 참조
│   ├── protocols/                         # 프로토콜 5종
│   │   ├── tdd-loop.md
│   │   ├── iteration-cycle.md
│   │   ├── code-doc-sync.md
│   │   ├── session-management.md
│   │   └── message-format.md
│   ├── examples/                          # 골든 샘플 + anti-patterns
│   ├── context-map.md
│   ├── environment.md
│   ├── security.md
│   ├── quality-gates.md
│   ├── error-recovery.md
│   └── observability.md
│
├── hooks/                                 # 실행 가능한 훅 스크립트 5종
│   ├── session-start-bootstrap.sh
│   ├── pre-tool-security-gate.sh
│   ├── pre-tool-doc-sync-check.sh
│   ├── post-tool-format.sh
│   └── post-tool-test-runner.sh
│
├── scripts/
│   ├── init-harness.sh
│   ├── doc-impact-check.sh
│   └── task-decompose.sh
│
└── src/
    ├── CLAUDE.md                          # 서브 CLAUDE.md (디렉토리별)
    └── ...
```

---

## 2. 런타임 가드레일

`.claude/settings.json`으로 훅을 등록하고, `hooks/` 스크립트가 시스템 수준에서 규칙을 강제한다.
exit 2 = 액션 차단 (bypassPermissions에서도 차단됨).

### settings.json

```jsonc
{
  "permissions": {
    "deny": ["Read(./.env)", "Read(./.env.*)", "Write(./.env)", "Write(./.env.*)", "Write(./production.config.*)"]
  },
  "hooks": {
    "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash hooks/session-start-bootstrap.sh", "timeout": 30000 }] }],
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "bash hooks/pre-tool-security-gate.sh", "timeout": 5000 }] },
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "bash hooks/pre-tool-doc-sync-check.sh", "timeout": 10000 }] }
    ],
    "PostToolUse": [
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "bash hooks/post-tool-format.sh", "timeout": 10000 }] },
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "bash hooks/post-tool-test-runner.sh", "timeout": 30000 }] }
    ]
  }
}
```

### 훅 스크립트 스펙

| 훅 | 이벤트 | 동작 | 차단 조건 |
|----|--------|------|----------|
| `session-start-bootstrap.sh` | SessionStart | PROGRESS.md/feature-list.json 확인, git log 5건 출력 | 차단 없음 (컨텍스트 제공) |
| `pre-tool-security-gate.sh` | PreToolUse(Bash) | rm -rf, git push --force, curl\|sh, .env 접근 차단 | exit 2 |
| `pre-tool-doc-sync-check.sh` | PreToolUse(Bash) | git commit 시 소스 변경 있는데 .md 변경 없으면 차단 | exit 2 ([skip-doc-sync] 예외) |
| `post-tool-format.sh` | PostToolUse(Write\|Edit) | 확장자별 포맷터 자동 실행 (prettier/black) | 차단 없음 |
| `post-tool-test-runner.sh` | PostToolUse(Write\|Edit) | 변경된 소스의 대응 테스트 자동 실행 | 차단 없음 (결과 전달) |

---

## 3. 크로스 세션 상태 관리

### Initializer Mode (첫 세션)
PROGRESS.md가 없거나 비어있으면 자동 감지:
1. 상세 계획 MD 로드 → **기술 스택 확정** (아래 규칙)
2. feature-list.json 생성 (모든 기능 `passes: false`)
3. PROGRESS.md 초기 생성
4. init-harness.sh 실행 (환경 검증, 의존성 설치)
5. 첫 커밋 → Coding Mode 전환

### 기술 스택 결정 규칙

| 우선순위 | 조건 | 액션 |
|---------|------|------|
| **1순위** | 상세 계획에 언어/프레임워크가 명시됨 | 그대로 채택. CLAUDE.md + environment.md에 반영. |
| **2순위** | 상세 계획에 명시 없음 | 프로젝트 요구사항을 분석하여 최적 스택을 **추천안 2~3개로 제시**. 개발자가 선택한 후 진행. |

2순위 시 추천 기준:
- 프로젝트 특성 (웹/모바일/CLI/데이터 등)에 맞는 생태계
- 팀 규모 · 유지보수 용이성 · 커뮤니티 성숙도
- 상세 계획의 기능 요구사항과의 적합도 (실시간 → WebSocket 지원, 대용량 → 스트리밍 등)
- 각 추천안에 장단점 + 선택 이유 명시

```
## 기술 스택 추천 (상세 계획에 명시되지 않은 경우)

프로젝트 요구사항 분석 결과:
- {핵심 요구사항 요약}

### 추천안 A: {예: Next.js + TypeScript + Prisma}
- 장점: {이유}
- 단점: {이유}
- 적합도: {왜 이 프로젝트에 맞는가}

### 추천안 B: {예: FastAPI + Python + SQLAlchemy}
- 장점: {이유}
- 단점: {이유}
- 적합도: {왜 이 프로젝트에 맞는가}

→ 개발자 선택을 기다린 후 CLAUDE.md + environment.md에 반영하고 진행.
```

⚠️ **개발자 확인 없이 임의 선택 금지.** 기술 스택은 프로젝트 전체에 영향을 미치는 결정이므로 반드시 개발자가 결정한다.

### Coding Mode (이후 세션)
SessionStart 훅이 자동으로 PROGRESS.md 요약 + 미완료 기능 수 + git log를 제공.
에이전트는 feature-list.json에서 다음 기능 선택 → **한 번에 하나만 작업**.

### feature-list.json

```jsonc
[{
  "id": "FEAT-001",
  "category": "auth",
  "description": "사용자가 이메일/비밀번호로 회원가입할 수 있다",
  "acceptance_test": ["회원가입 폼 입력", "계정 생성 확인", "중복 이메일 에러"],
  "tdd_focus": ["validateSignupInput", "createUser", "hashPassword"],
  "doc_sync": ["docs/api.md", "src/api/CLAUDE.md"],
  "passes": false
}]
```
`passes` 필드만 변경 가능. 항목 추가/삭제/설명 수정 금지.

---

## 4. TDD 서브에이전트 컨텍스트 격리

하나의 컨텍스트에서 TDD를 수행하면 테스트 작성자의 분석이 구현자에게 누출된다.
Red/Green/Refactor를 별도 서브에이전트로 분리하여 이를 방지한다.

| 서브에이전트 | 단계 | 규칙 | model |
|------------|------|------|-------|
| `tdd-test-writer` | Red | 구현 코드를 읽지 않고 인터페이스만으로 테스트 작성 | sonnet |
| `tdd-implementer` | Green | 테스트를 통과시키는 최소한의 코드만 작성 | sonnet |
| `tdd-refactorer` | Refactor | 동작 변경 금지. 테스트가 여전히 통과해야 함 | sonnet |

### 서브에이전트 프론트매터 예시

```markdown
---
name: tdd-test-writer
description: TDD Red 단계 전용. 실패하는 테스트를 작성한다. 구현 코드를 보지 않는다.
tools: Read, Glob, Grep, Write, Bash
model: sonnet
---
# TDD Test Writer (Red Phase)

## 규칙
- 기존 구현 코드를 **읽지 않는다** (컨텍스트 오염 방지)
- 인터페이스/타입 정의만 참조하여 테스트 작성
- 필수 케이스: happy path, boundary, error
- 반환: 테스트 파일 경로 + 예상 실패 수
```

```markdown
---
name: tdd-implementer
description: TDD Green 단계 전용. 실패하는 테스트를 통과시키는 최소 코드를 작성한다.
tools: Read, Glob, Grep, Write, Edit, Bash
model: sonnet
effort: medium
---
# TDD Implementer (Green Phase)

## 규칙
- 테스트를 먼저 읽고 기대 동작을 파악
- 테스트를 통과시키는 **최소한의** 코드만 작성
- 과도한 추상화 금지
- 반환: 구현 파일 경로 + 테스트 실행 결과
```

```markdown
---
name: tdd-refactorer
description: TDD Refactor 단계 전용. 테스트가 통과하는 상태에서 코드 품질을 개선한다.
tools: Read, Glob, Grep, Write, Edit, Bash
model: sonnet
effort: low
---
# TDD Refactorer (Refactor Phase)

## 규칙
- 리팩토링 전 테스트 실행 → 전부 통과 확인 후 시작
- 동작 변경 금지 (테스트는 계속 통과해야 함)
- 반환: 변경 파일 목록 + 테스트 결과
```

### implementer의 TDD 조율 흐름

```
Plan → Red(tdd-test-writer) → Green(tdd-implementer) → Refactor(tdd-refactorer)
  → Verify(전체 테스트+기능 검증) → 실패 시 Green/Red로 복귀 (최대 5회)
  → Doc Sync → 코드+테스트+문서 원커밋
```

---

## 5. 모델 라우팅

추론이 핵심인 에이전트는 Opus, 코드 생성이 핵심인 에이전트는 Sonnet.
프론트매터 `model:` 필드로 지정한다.

```
Opus (판단) ── orchestrator, architect, reviewer, debugger
Sonnet (실행) ── implementer, tdd-×3, tester
```

```markdown
---
name: tdd-implementer
description: TDD Green 단계 전용.
tools: Read, Glob, Grep, Write, Edit, Bash
model: sonnet
effort: medium
---
```

환경변수로 기본값 설정 가능:
```bash
export CLAUDE_CODE_SUBAGENT_MODEL=sonnet  # 기본 Sonnet, Opus 필요한 에이전트만 프론트매터로 오버라이드
```

예상 비용 절감: 실행 에이전트(토큰 ~70%)가 Sonnet으로 내려가므로 **총 30~40% 절감**.

---

## 6. 코드 스타일 · 린트 · 주석 규칙

### 6.1 코드 스타일

**Google Style Guide 준수** — 모든 언어에서 해당 언어의 Google Style Guide를 기본으로 따른다.

**시큐어 코딩** — 사용자 입력 항상 검증, SQL 파라미터화, XSS 이스케이프, eval/innerHTML 금지.

**가독성 우선** — 복잡한 원라이너보다 명확한 여러 줄. 네스팅 최대 3단계. 삼항 중첩 금지.

**리팩토링 트리거**:

| 지표 | 임계값 | 액션 |
|------|--------|------|
| 함수 길이 | > 40줄 | 분할 검토 |
| 파일 길이 | > 300줄 | 모듈 분리 검토 |
| 네스팅 깊이 | > 3단계 | early return / 함수 추출 |
| 파라미터 수 | > 4개 | 객체 파라미터 전환 |
| 순환 복잡도 | > 10 | 반드시 분할 |

### 6.2 주석 규칙

**철학**: 코드가 "무엇을(What)" 말하게 하고, 주석은 **"왜(Why)"**만 말한다.
함수/클래스 단위 JSDoc은 필수. 인라인 주석은 함정(gotcha)에만.

**파일 헤더** (모든 소스 파일에 필수):
```typescript
/* ┌─────────────────────────────────────────────────────────────┐
 * │  Order Calculation Service                                  │
 * │                                                             │
 * │  All monetary calculations for the order pipeline.          │
 * │  Tax: KR regulation (discount applied before tax).          │
 * │                                                             │
 * │  Dependencies: LineItem, PaymentGateway                     │
 * │  Related: docs/api.md, src/api/CLAUDE.md                   │
 * └─────────────────────────────────────────────────────────────┘ */
```

**섹션 구분선**:
```typescript
/* ── Public API ─────────────────────────────────────────────── */

/* ── Internal Helpers ───────────────────────────────────────── */

/* ── Types & Constants ──────────────────────────────────────── */
```

**함수 주석** (필수):
```typescript
/**
 * Calculate total order amount with tax.
 *
 * NOTE: Discount is applied before tax — KR legal requirement.
 *       Do not reorder without legal review.
 */
function calculateTotal(items: LineItem[], taxRate: number, discount = 0): number {
  const subtotal = sumLineItems(items);
  const discounted = Math.max(subtotal - discount, 0); // negative totals break payment gateway
  return roundCurrency(discounted * (1 + taxRate));
}
```

**인라인 주석 — 좋은 예 vs 나쁜 예**:
```typescript
// ✅ "왜" — 함정 경고
await db.query(sql); // ⚠️ 트랜잭션 밖에서 실행됨 — 롤백 불가

// ❌ "무엇" — 코드가 이미 말하고 있음
const total = price * quantity; // 가격에 수량을 곱한다
```

### 6.3 로그 설계 규칙

**철학**: 로그는 프로덕션의 블랙박스 레코더다.
`console.log` / `print` 금지. 프로젝트 기술 스택에 맞는 구조화 로거를 사용한다.
애플리케이션 유형(서버/데스크톱/모바일/CLI)에 따라 세부 전략을 조정하되, 아래 원칙은 공통이다.

#### 어디에 찍는가 (로그 포인트)

모든 함수에 찍지 않는다. **시스템 경계와 상태 전이**에만 찍는다.

**공통 포인트** (모든 애플리케이션):

| 지점 | 레벨 | 필수 포함 정보 |
|------|------|--------------|
| 애플리케이션 시작/종료 | INFO | 버전, 환경, 주요 설정 |
| 외부 경계 호출 (API, DB, 파일 I/O, OS 호출) | DEBUG | 대상, duration_ms, 결과 요약 |
| 비즈니스 이벤트 (상태 전이) | INFO | 엔티티 ID, 상태 변화, 사용자 ID |
| 에러/예외 | ERROR | 에러 메시지, 스택 트레이스, 관련 ID |
| 재시도/폴백 | WARN | 시도 횟수, 원인, 다음 액션 |
| 스케줄러/배치/워커 작업 | INFO | 작업명, 시작/완료, 처리 건수, duration |

**애플리케이션 유형별 추가 포인트**:

| 유형 | 추가 지점 | 비고 |
|------|----------|------|
| **웹/API 서버** | HTTP 요청 진입/완료 (method, path, status, duration) | requestId 필수 |
| **데스크톱 (PC 앱)** | 사용자 액션 (메뉴 클릭, 단축키), 윈도우 생명주기, 자동 업데이트 | 민감 사용자 입력 제외 |
| **모바일 앱** | 화면 전환, 앱 생명주기(foreground/background), 푸시 수신 | 배터리/네트워크 영향 고려, 배치 전송 |
| **CLI 도구** | 명령 실행 시작/완료, 종료 코드, 주요 플래그 | stdout은 결과용, 로그는 stderr 또는 파일로 |
| **백그라운드 워커** | 작업 수신, 큐 상태, 재시도, 데드레터 | 작업 ID로 추적 |

#### 무엇을 담는가 (필수 컨텍스트)

모든 로그에 자동 포함 (child logger / context binding):
- `timestamp` — ISO 8601
- `level` — info/debug/warn/error/fatal
- `service` 또는 `module` — 컴포넌트명
- **추적 ID** — 애플리케이션 유형에 따라:
  - 서버: `requestId` (분산 환경 필수)
  - 데스크톱/모바일: `sessionId` (앱 실행 단위)
  - CLI: `runId` (명령 실행 단위)
  - 워커: `jobId`

비즈니스 로그에 추가: 관련 엔티티 ID (`orderId`, `userId` 등), 상태 전이.

#### 절대 금지

- `console.log` / `print` / `NSLog` (프로덕션 코드에서)
- 비밀번호, API 키, 토큰, 인증 쿠키 등 시크릿 로깅
- 개인정보(PII) 평문 로깅 (이메일, 전화번호, 주민번호 등 — 마스킹 필수)
- 로그 메시지에 사용자 입력 직접 삽입 (로그 인젝션 방지)
- 루프 내부에서 매 반복 로깅 (성능 저하)
- 모바일: 사용자 개인 식별자를 서버로 무단 전송 (개인정보보호법 위반 가능)

#### 레벨 기준

```
FATAL — 애플리케이션 동작 불가. 즉시 알림. (DB 연결 불가, 필수 리소스 없음)
ERROR — 요청/작업 실패. 조치 필요. (결제 실패, 외부 API 5xx, 파일 저장 실패)
WARN  — 자동 복구했지만 주의. (재시도 성공, 캐시 미스 폴백, 네트워크 불안정)
INFO  — 핵심 비즈니스 흐름. 프로덕션에서 이것만 보고 정상 여부를 판단.
DEBUG — 상세 파라미터, 쿼리, 중간 결과. 프로덕션에서는 기본 OFF.
```

**INFO 레벨 설계 테스트**: "프로덕션에서 INFO 로그만 켜고 일정 시간 운영했을 때, 시스템이 정상인지 비정상인지 판단할 수 있는가?" — YES면 적절한 밸런스.

#### 로그 포맷 (환경별 전환)

```
프로덕션: JSON (구조화, 수집기 호환)
  {"level":"info","time":"2026-04-16T09:00:05Z","service":"order","event":"order.created","orderId":"ORD-001","runId":"run-7f4e"}

로컬 개발: Pretty-print (가독성)
  [09:00:05] INFO  order  order.created  orderId=ORD-001  runId=run-7f4e
```

같은 코드, 환경변수(`LOG_FORMAT` 또는 `NODE_ENV`)로 전환. 코드에서 분기하지 않는다.

#### 로그 전송 · 저장 전략 (유형별)

| 유형 | 기본 대상 | 원격 수집 | 주의사항 |
|------|----------|----------|---------|
| **웹/API 서버** | stdout | 즉시 스트리밍 (Loki/ELK/Datadog/CloudWatch) | 고빈도 처리, 비동기 로거 필수 |
| **데스크톱 앱** | 로컬 파일 (OS별 표준 위치) | 크래시 리포트는 필수, 일반 로그는 옵트인 | 사용자 동의 필수, 디스크 용량 관리 |
| **모바일 앱** | 로컬 파일 (앱 샌드박스) | 배치 전송 (Wi-Fi 시 또는 임계값 도달 시) | 배터리·데이터 비용 고려, 오프라인 큐잉 |
| **CLI 도구** | stderr 또는 사용자 지정 파일 | 기본 없음 (로컬만) | `--verbose` 플래그로 레벨 조정 |
| **백그라운드 워커** | stdout | 즉시 스트리밍 | 작업 ID로 요청 상관관계 유지 |

**데스크톱 로그 파일 표준 위치**:
- macOS: `~/Library/Logs/{AppName}/`
- Windows: `%LOCALAPPDATA%\{AppName}\logs\`
- Linux: `~/.local/state/{AppName}/logs/` (XDG)

**모바일 로그 파일 위치**:
- iOS: 앱 샌드박스 내 `Documents/Logs/` 또는 `Library/Caches/Logs/`
- Android: 앱 내부 저장소 `context.getFilesDir()/logs/`

#### 로그 로테이션 · 보관

| 유형 | 로테이션 | 보관 기간 |
|------|---------|----------|
| **서버 (원격 수집)** | 일별 + 100MB | ERROR 90일 / INFO 30일 / DEBUG 7일 |
| **서버 (로컬 파일 폴백)** | 일별 | 7일 |
| **데스크톱 앱** | 크기 기반 (10MB) | 최근 5개 파일 유지 (~50MB 상한) |
| **모바일 앱** | 크기 기반 (2MB) | 최근 3개 파일 유지 (~6MB 상한) |
| **CLI 도구** | 실행별 또는 일별 | 30일 또는 수동 |
| **로컬 개발** | 없음 | 수동 |

스케줄러/배치/워커 로그도 해당 실행 환경의 로테이션을 따른다. 별도 분리하지 않고 `service` 또는 `job` 필드로 필터.

#### Rationalization 방어

| 변명 | 반론 |
|------|------|
| "로그는 나중에 추가" | 로그 없는 코드는 프로덕션에서 블라인드. 기능과 함께 작성. |
| "DEBUG에 다 찍으면 되지" | DEBUG는 프로덕션에서 꺼짐. INFO만으로 시스템 상태를 파악할 수 있어야 함. |
| "에러만 찍으면 충분" | 에러 직전의 맥락(INFO/WARN)이 없으면 원인 분석 불가. |
| "성능에 영향 줄까봐" | 구조화 로거(Pino, structlog 등)는 비동기 처리. 올바른 로거를 쓰면 무시 가능. |
| "모바일은 배터리 때문에 로그 최소화" | 레벨 조정과 배치 전송으로 해결. 로그 자체를 없애면 크래시 원인 추적 불가. |
| "데스크톱 앱은 오프라인이라 원격 수집 불가" | 로컬 로그 필수. 사용자 동의 시 크래시 리포트만 전송해도 충분. |

---

## 7. 스킬 — Claude Code 네이티브 포맷

### 7.1 Skill Anatomy (6섹션 의무)

```markdown
---
name: {skill-name}
description: >
  {트리거 설명}. Trigger: "{트리거1}", "{트리거2}".
  Does NOT trigger for {비트리거}.
---
# {스킬명}

## Overview
{1~2문장}

## When to Use
- {트리거 조건}
- ❌ NOT when: {제외 조건}

## TDD Focus
- ✅ {테스트 필수 대상}
- ❌ {테스트 면제 대상}

## Process
### Step 1~N (구체적 — "npm test 실행" 수준)

## Common Rationalizations
| 변명 | 반론 |
|------|------|
| "이 함수는 단순해서 테스트 불필요" | 단순해도 엣지 케이스 있음. 테스트는 명세 역할. |
| "나중에 문서 업데이트" | "나중"은 오지 않음. 다른 에이전트가 잘못된 문서 참조. |
| {스킬별 추가 3행 이상} | |

## Red Flags
- {이 스킬이 위반되고 있다는 징후 — 최소 2항목}

## Verification
- [ ] {증거와 함께 확인 — 로그/diff/리포트}
- [ ] feature-list.json passes: true
- [ ] PROGRESS.md 업데이트
```

### 7.2 Progressive Disclosure

| 기준 | 규칙 |
|------|------|
| SKILL.md | 500줄 이내. 초과 시 references/ 분리 |
| 인라인 코드 | 50줄 이내. 초과 시 scripts/ 분리 |
| 불필요한 섹션 | 제거해도 에이전트 동작 불변이면 삭제 |

### 7.3 스킬 목록

| 스킬 | 트리거 | TDD Focus | 핵심 Rationalization 차단 |
|------|--------|-----------|-------------------------|
| `new-feature` | "새 기능", "구현" | 비즈니스 로직, 입력 검증 | "한 번에 다 만들겠다" → 점진적으로 |
| `bug-fix` | "버그", "수정" | 재현 테스트 필수 | "원인 알고 있으니 바로 수정" → 재현 테스트 먼저 |
| `refactor` | "리팩토링" | 기존 테스트 100% 보존 | "동작 안 바뀌니 테스트 불필요" → 증명이 테스트 |
| `tdd-workflow` | "TDD", "테스트 먼저" | 전체 TDD 사이클 | "단순해서 테스트 불필요" → 명세 역할 |
| `api-endpoint` | "API" | 요청/응답 검증 | "내부 API라 문서 불필요" → 다음 에이전트가 참조 |
| `db-migration` | "마이그레이션" | 데이터 무결성 | "롤백 필요 없을 것" → 항상 필요 |
| `deployment` | "배포" | 전체 테스트 통과 | "스테이징에서 됐으니" → 환경 차이 |
| `context-engineering` | 세션 시작, 태스크 전환 | N/A | "모든 파일 읽겠다" → 필요한 것만 |

---

## 8. 에이전트 정의

### 8.1 공통 Input/Output

```jsonc
// Input
{ "task_id": "", "type": "feature|bugfix|refactor|test", "description": "",
  "target_files": [], "acceptance_criteria": [],
  "tdd_focus": [], "doc_sync_targets": [], "feature_id": "FEAT-XXX" }

// Output
{ "task_id": "", "status": "success|failure|partial|blocked", "iteration_count": 0,
  "changes": { "code": [], "tests": [], "docs": [] },
  "test_results": { "total": 0, "passed": 0, "failed": 0, "coverage": "" },
  "feature_passes": false, "blockers": [], "notes": "" }
```

### 8.2 에이전트별 역할

| 에이전트 | model | 핵심 역할 |
|---------|-------|----------|
| **orchestrator** | opus | Initializer/Coding 모드 전환, 태스크 분해, tdd_focus/doc_sync 지정, 한 번에 하나만 |
| **implementer** | sonnet | TDD 서브에이전트 3종 순서 호출, 수렴 루프 관리 (최대 5회), 원커밋 |
| **reviewer** | opus | 3단계 리뷰: ①TDD 준수 ②코드 품질 ③문서 동기화. docs 비면 REJECT |
| **tester** | sonnet | 핵심 함수 선별, 피드백 시 기대값 vs 실제값 전달 |
| **architect** | opus | ADR 작성, 영향 문서 목록, 스키마 변경 시 마이그레이션+문서 동시 |
| **debugger** | opus | 근본 원인 분석, 최소 수정, 회귀 테스트 추가 의무 |
| **tdd-test-writer** | sonnet | Red 전용. 구현 코드를 읽지 않음 |
| **tdd-implementer** | sonnet | Green 전용. 최소 구현 |
| **tdd-refactorer** | sonnet | Refactor 전용. 동작 변경 금지 |

---

## 9. 품질 게이트

> "괜찮아 보인다"는 통과 기준이 아니다. 모든 게이트에 **증거**가 필요하다.

| Gate | 체크 | 증거 | 🛡️ Rationalization 방어 |
|------|------|------|------------------------|
| **0: TDD** (전제) | tdd_focus에 테스트 존재, Red→Green 순서, happy/boundary/error | 테스트 파일, 호출 순서 로그 | "단순해서 불필요" → tdd_focus 지정이면 예외 없음 |
| **1: 구현** | 컴파일 0, 린트 0, 테스트 전부 통과, docs 변경 포함 | tsc/eslint/테스트 출력, git diff | "문서는 나중에" → 훅이 커밋 차단 |
| **2: 리뷰** | Critical/Major 0개 | 리뷰어 피드백 (파일/라인/심각도) | "사소한 변경이라 불필요" → 모든 변경은 리뷰 대상 |
| **3: 테스트** | tdd_focus 커버리지 ≥ 목표, 통합 통과, 기능 검증 | 커버리지 리포트, 실행 로그 | — |
| **4: 배포** | Gate 0~3 통과, feature passes: true, 롤백 절차 | sync-docs 통과 로그 | "스테이징에서 됐으니" → 환경 차이 체크 |

⚠️ Gate 0 미충족 시 Gate 1~4 진행 불가.

---

## 10. 코드-문서 동기화

### 3중 방어

| 레이어 | 메커니즘 | 시점 |
|--------|---------|------|
| 프롬프트 | code-doc-sync.md 프로토콜 | 작업 중 |
| 훅 | pre-tool-doc-sync-check.sh | git commit 직전 (차단) |
| 리뷰 | reviewer 3단계 리뷰 | 코드 리뷰 시 |

### 매핑 테이블

```
src/api/**          → docs/api.md, src/api/CLAUDE.md
src/components/**   → docs/components.md, src/components/CLAUDE.md
prisma/**           → docs/schema.md, .claude/environment.md
package.json        → .claude/environment.md
신규 디렉토리       → 해당 서브 CLAUDE.md 생성
.claude/**          → CHANGELOG.md
기능 완료           → feature-list.json (passes: true)
모든 변경           → PROGRESS.md
```

---

## 11. 학습/진화

### 수집 메트릭
태스크별 iteration_count, 서브에이전트별 소요 시간, 테스트 실패 빈도 TOP 10, 문서 누락 빈도, 에스컬레이션 빈도.

### 개선 트리거
- 평균 iteration_count > 3 → 테스트 전략 재검토
- 동일 파일 3회 이상 문서 누락 → 매핑 테이블 추가
- 특정 서브에이전트 실패 빈발 → 프롬프트 개선
- 에스컬레이션 빈발 → 스킬 절차 구체화

---

## 12. 생성 순서

```
Phase 1: 기반 ── settings.json, hooks/ 5종, environment.md, security.md, init-harness.sh
Phase 2: 프로토콜 ── protocols/ 5종, CLAUDE.md, quality-gates.md
Phase 3: 에이전트 ── agents/ 9종 (model: 필드 포함)
Phase 4: 스킬 ── skills/ 8종 (6섹션 Anatomy), references/, examples/, context-map.md
Phase 5: 서브 CLAUDE.md ── 디렉토리별
Phase 6: 상태 ── feature-list.json, PROGRESS.md, CHANGELOG.md, error-recovery.md, observability.md
```

---

## 13. 상세 계획 → 하네스 변환 규칙

| 상세 계획의 내용 | 변환 대상 |
|----------------|----------|
| 프로젝트 목적 | CLAUDE.md 한 줄 요약 |
| 기술 스택 (명시됨) | CLAUDE.md + environment.md → **1순위: 그대로 채택** |
| 기술 스택 (미명시) | 요구사항 분석 → 추천안 2~3개 제시 → **개발자 선택 후 반영** |
| 기능 명세 | **feature-list.json** (JSON, passes: false) |
| 핵심 비즈니스 로직 | 각 feature의 tdd_focus 필드 |
| API 설계 | skills/api-endpoint + src/api/CLAUDE.md |
| DB 스키마 | skills/db-migration + 스키마 문서 |
| 보안 요구사항 | security.md + hooks/security-gate.sh |
| 테스트 전략 | quality-gates.md + tdd-loop.md |
| 코딩 규칙 | CLAUDE.md + 서브 CLAUDE.md |
| 문서화 대상 | code-doc-sync.md 매핑 테이블 |
| 일정 | PROGRESS.md Backlog |

---

## 14. 토큰 예산

| 산출물 | 파일 수 | 파일당 토큰 | 소계 |
|--------|---------|-----------|------|
| 메인 CLAUDE.md | 1 | ~1,200 | 1,200 |
| 서브 CLAUDE.md | 5~8 | ~500 | 3,000 |
| 에이전트 MD | 9 | ~800 | 7,200 |
| 스킬 (6섹션) | 8 | ~800 | 6,400 |
| 프로토콜 | 5 | ~500 | 2,500 |
| 훅 스크립트 | 5 | ~150 | 750 |
| 기타 | 8 | ~400 | 3,200 |
| **합계** | **~52** | | **~24,250** |

**1회 태스크 실제 소비**: CLAUDE.md + 서브 CLAUDE.md + 에이전트 + 스킬 + tdd-loop = **~3,800 토큰**
TDD 서브에이전트는 독립 컨텍스트 윈도우 → 메인 컨텍스트 토큰 추가 소비 없음.
