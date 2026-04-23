# harness-boot — 상세 설계 문서

**버전**: 2.3.7 (v2.3.6 위에 `$include` 외부 파일 참조 추가 — 긴 서사 필드를 외부 md 파일로 분리 가능)
**상태**: Draft — Ready-for-Implementation
**작성일**: 2026-04-20
**최종 수정**: 2026-04-22 (v2.3.6 → v2.3.7: "중간언어로서의 spec — yaml vs md" 논의에서 도출된 실용 개선 하나만 도입. 긴 자유 텍스트 필드(🗒)를 외부 `.md` 파일로 분리할 수 있는 `$include` 객체 구문 추가. 스키마는 **additive** — 기존 spec.yaml은 그대로 동작. 주요 변경: (a) §5.1에 `$include` 객체 구문과 대상 필드 10종·경로 제약·크기 제약·순환 금지 규칙 추가, (b) §5.4 `harness.yaml.generation.include_sources[]` 트래킹 필드 추가 — drift 감지용, (c) §7.3.3 Phase 0 맨 앞에 "include 확장" 단계 추가 — 파생·해시·검증 모두 `expanded_spec` 기준, (d) 부록 D.2에 "0단계: include 해석" 추가 — Canonical JSON 변환 이전에 펼침으로써 해시 결정론 유지, (e) §4.3 git 커밋 정책에 include 대상 md 파일 항목 추가, (f) §10.4 Spec drift에 include 파일 변경 포함 명시, (g) §11.1에 `scripts/resolve-includes.mjs` 추가, (h) 부록 A에 `$include`·`expanded_spec` 용어 추가. 원칙·명령 체계·Gate·에이전트 매트릭스 불변. 구현 범위 작고 하위 호환 유지 — v2.3.6의 Ready-for-Implementation 판정 유지)

---

## 목차

1. [배경과 동기](#1-배경과-동기)
2. [핵심 철학](#2-핵심-철학)
3. [시스템 경계](#3-시스템-경계)
4. [파일 구조](#4-파일-구조)
5. [핵심 자산 — `.harness/`](#5-핵심-자산--harness)
6. [Claude Code 어댑터 — `.claude/`](#6-claude-code-어댑터--claude)
7. [명령어 체계](#7-명령어-체계)
8. [데이터 모델과 스키마](#8-데이터-모델과-스키마)
9. [생성 파이프라인](#9-생성-파이프라인)
10. [진화 파이프라인](#10-진화-파이프라인)
11. [플러그인 자체 구조](#11-플러그인-자체-구조)
12. [마이그레이션 전략](#12-마이그레이션-전략)
13. [열린 질문](#13-열린-질문)

**부록**

- [부록 A — 용어 사전](#부록-a--용어-사전)
- [부록 B — 관련 문서](#부록-b--관련-문서)
- [부록 C — 변경 이력](#부록-c--변경-이력)
- [부록 D — 해시 정규화 규약 (Canonical Hashing)](#부록-d--해시-정규화-규약-canonical-hashing--v235-신설-v236-정리)

---

## 1. 배경과 동기

### 1.1 현재 상태

harness-boot v0.x는 `plan.md` 한 장을 입력받아 Claude Code용 멀티 에이전트 하네스를 생성하는 플러그인입니다. Phase 1~6에 걸쳐 약 56개 파일(에이전트 9+, 스킬 8, 훅 6, 프로토콜 5 + 상태/문서 파일)을 자동 생성합니다.

### 1.2 발견된 한계

현재 설계를 분석한 결과 다음 공백이 드러났습니다:

- **입력 경로의 단일성**: 기획문서가 있는 신규 프로젝트만 상정. 아이디어만 있는 상태나 기존 프로젝트는 경로가 없음.
- **plan.md의 느슨함**: 자유 형식 마크다운이라 스키마 검증 불가능. Phase 1의 LLM 파싱이 실패 지점.
- **상태 파일 산재**: PROGRESS.md, feature-list.json, CHANGELOG.md가 프로젝트 루트에 사용자 자산과 섞임.
- **진화 메커니즘 부재**: plan 수정 시 하네스에 전파할 경로가 이분법적(overwrite or exit).
- **브랜드 희석**: 모든 자산이 `.claude/` 아래 섞여 도구의 정체성이 드러나지 않음.

### 1.3 재설계 목표

1. **하나의 명세 언어로 다양한 입력 경로 수렴**: 아이디어·기획문서·레거시(장기) 모두 동일한 `spec.yaml`로 수렴.
2. **사용자 자산과 도구 자산의 명확한 분리**: `.harness/`로 메타 자산 격리.
3. **Claude Code 표준 규약 완전 준수**: `.claude/agents/`, `.claude/skills/`의 표준 위치 유지.
4. **진화를 일급 시민으로**: 생성(`build`)과 동등한 위상의 진화 명령(`evolve`, `audit`, `refine`).
5. **플러그인 자체와 생성물의 구분**: harness-boot 레포 구조와 사용자 프로젝트 구조를 분리.

---

## 2. 핵심 철학

### 2.1 원칙 선언

harness-boot v2는 두 종류의 글을 구분합니다.

> **사고의 글**은 자유로워야 합니다. 프로젝트의 서사·의도·도메인 이해는 사람이 자유롭게 쓰는 문서입니다.
>
> **실행의 글**은 구조화되어야 합니다. 에이전트가 실행하고 훅이 검증하는 계약은 스키마로 검증 가능한 데이터입니다.
>
> 두 글이 어긋날 때 알려주는 것이 harness의 일입니다.

**두 글의 공존 방식** (v2.3.2에서 명시):

두 글은 **물리적으로 분리된 파일**이 아니라 **`spec.yaml` 안에 공존**합니다. 분리는 파일이 아닌 **필드의 성격**으로 이루어집니다.

| 구분 | 자리 | 예 |
|------|------|------|
| **실행의 글** | 구조적 필드 | `features[].id`, `features[].test_strategy`, `constraints.quality.coverage_threshold`, enum 값들 |
| **사고의 글** | 자유 텍스트 필드 | `project.description`, `project.vision`, `domain.overview`, `entities[].description`, `business_rules[].rationale`, `features[].acceptance_criteria` |
| **뷰** | 파생 파일 | `domain.md`, `architecture.yaml` — spec의 사고의 글+실행의 글을 사람·에이전트가 읽기 좋게 렌더링 |

**자유 텍스트 필드의 성격**:

- 길이 제한 없음 (권장 상한만 존재, 초과 시 경고)
- 마크다운 지원 (YAML `|` literal block)
- 스키마는 "이 필드가 비어있지 않아야 한다"만 강제, 내용은 자유
- `/harness:check --deep`이 LLM 기반으로 "서술이 구조적 필드와 일관한가" 검증

**왜 한 파일에 공존시키는가**:

v1.0에서 `plan.md` 하나에 섞었을 때 실패한 이유는 "한 파일"이 아니라 **"구조 없이 섞음"**이었습니다. LLM이 어디까지가 계약이고 어디부터가 서사인지 판별할 수 없었습니다.

v2는 이를 **스키마로 해결**합니다. YAML 구조가 계약의 경계를 명시하고, 그 안의 자유 텍스트 필드가 서사의 자리입니다. 한 파일이어도 경계가 분명합니다. 사용자 관점에서는 "spec.yaml 하나만 쓰면 된다"는 단순함이 유지되면서, 계약과 서사 모두 들어갈 자리가 있습니다.

**의사결정·실험 이력**은 harness-boot이 새로 관리하지 않습니다 — **git 커밋 메시지·PR 설명·ADR 관행**(`docs/adr/` 등)이 수십 년간 이 문제를 해결해왔고, 재발명하지 않습니다.

### 2.2 불변 원칙 (v1에서 유지)

| 원칙 | 구현 |
|------|------|
| Testable-First | lean-tdd 기본, 안전 임계 도메인은 strict tdd |
| Iteration Convergence | 최대 5회 반복 후 에스컬레이션 |
| Code-Doc Sync | PreToolUse 훅으로 실행 시점에 차단 |
| Anti-Rationalization | 모든 스킬에 변명-반박 테이블 필수 2행 |
| One Question at a Time | 번호 선택지 + ★ 추천 옵션 |

> **주**: v1에 있던 "설계는 사용자의 몫 — 도구는 실행을 자동화, 설계는 촉진만" 원칙은 v2.3.6에서 표에서 제외됩니다. v2.2의 "사용자 입력 최소화"·"파생 + 편집 존중"과 v2.3의 "실행 가능성 우선(Walking Skeleton·integrator 강제)"이 구조적 설계의 상당 부분을 도구가 자동 결정하는 방향으로 이동시켰기 때문입니다. 제품 설계(무엇을 만들 것인가 — spec.yaml 필드)의 주도권은 여전히 사용자에게 있지만, 시스템 설계(어떻게 조립할 것인가)는 이제 파생·강제 영역으로 들어왔으므로, "불변 원칙"으로 선언하기엔 결이 어긋납니다.

### 2.3 v2 추가 원칙

**표준 존중 (Standard-First)**: Claude Code가 요구하는 파일은 Claude Code 규약 위치에. 우리만의 자산은 우리 디렉터리에. 규약을 거스르지 않습니다.

**진실의 원천 단일화 (Single Source of Truth)**: 모든 정보는 `.harness/` 안에 한 곳에만 존재합니다. `.claude/` 아래의 파일들은 이 원천에서 **생성된** 어댑터입니다.

**스키마 우선 (Schema-First)**: 구조화된 데이터는 JSON Schema로 검증 가능해야 합니다. v2.2 이후 사용자가 직접 편집하는 구조화 파일은 `spec.yaml` 하나지만, 파생 파일(`architecture.yaml`, `harness.yaml`, `state.yaml`)도 모두 명시적 스키마를 가집니다 (파생 결과 검증 + `/harness:check` 대상).

**사용자 입력 최소화 (User-Minimal Input)** — v2.2 신설, v2.3.2 정제:

사용자가 직접 편집하는 **파일은 `spec.yaml` 단 하나**입니다. spec.yaml은 구조적 계약(실행의 글)과 자유 서술(사고의 글)을 한 파일 안에 담습니다 — 2.1의 원칙이 YAML 구조로 구현됩니다. 파생 파일(`domain.md`, `architecture.yaml`)은 spec에서 렌더링된 **읽기용 뷰**로, 편집 대상이 아닙니다.

이유:

- **인지 부담 감소**: 파일 하나만 알면 됨. description은 서사, features[]는 계약 — 필드별 성격은 스키마가 안내
- **드리프트 방지**: 계약과 서사가 한 파일에 있으므로 서로 어긋날 때 즉시 드러남
- **재발명 회피**: 의사결정·실험 이력은 git과 ADR 관행이 이미 해결한 문제. harness-boot은 spec과 하네스 자체에만 집중

**파생 + 편집 존중 (Derive-first, Respect-edit)** — v2.2 원칙, v2.3.2에서 적용 범위 축소:

파생 파일(`domain.md`, `architecture.yaml`)은 원칙적으로 **편집 대상이 아닙니다** — 읽기용 뷰이기 때문입니다. 다만 드문 예외(architecture.yaml의 AR-100+ 수동 규칙 등)를 위해 edit-wins 규칙을 **안전망**으로 유지합니다.

- 파일이 파생 시점 그대로 → 안전하게 재파생
- 파일이 편집됨 (해시 불일치) → **편집 보존**, spec 변경은 반영되지 않음을 경고만
- 사용자가 편집을 포기하고 재파생을 원하면 명시적 플래그(`--regenerate-derived`)로 강제

**v2.3.2 방침 변경**: 예전에는 domain.md의 "Decision Log"를 사용자 편집 영역으로 허용했으나, **의사결정 이력은 git·ADR 관행으로 대체**하고 domain.md는 순수 뷰로 단순화합니다. 파생 파일 편집은 드문 예외 경로입니다.

3-way merge 대신 edit-wins 이진 규칙을 선택한 이유: 단순함. 머지 도구·충돌 파일이 없고, 사용자 의도가 명확("내가 건드린 건 유지")합니다.

**실행 가능성 우선 (Runtime-Verified First)** — v2.3 신설:

v1.0에서 경험한 "피처 개별로 완료되었지만 실제로 켜보면 메인 함수가 없어 실행 자체가 안 되는" 문제는 **설계가 '기능 단위로 쪼개고 각각 검증'에만 집중하고 '전체가 돌아가는가'는 누구의 책임도 아니었기 때문**에 발생합니다. v2.3은 이를 세 장치로 막습니다.

1. **Walking Skeleton 강제**: 첫 번째 피처는 반드시 `type: skeleton` — 공허하더라도 엔드-투-엔드로 **실행되는** 최소 뼈대. 이후 모든 피처는 이 스켈레톤 위에 얹음.
2. **integrator 에이전트**: 매 피처 완료 시 exports를 메인 조립(main·DI·라우터)에 wire-up하는 책임을 명시적 에이전트에게 부여. "조립 책임 공백"을 제거.
3. **Gate 5 필수화**: 빌드 + 실행 + smoke_scenario 통과 없이는 피처 완료로 마크 불가. 정적 코드 속성(Gate 0~4)을 넘어 **실제 프로세스 기동**을 증거로 요구.

세 장치 모두 "선택 가능한 개선"이 아닌 **기본 활성화**입니다. 명시적 `prototype_mode`로만 완화됩니다.

**투명성 우선 (Transparency-by-Preamble)** — v2.3.1 신설:

v2.1의 명령어 간소화(10개 → 7개)와 v2.2의 내부 모드 자동 판별(Mode A/B/R/E, 전체/델타, edit-wins 등)은 인지 부담을 줄였지만, 대가로 **"지금 뭐가 일어나는지" 투명성을 잃을 위험**을 만들었습니다. 사용자가 `/harness:spec`을 실행했을 때 "Mode R에 들어갔고 그 이유는 completeness=low"를 알 수 없으면, 질문이 왜 오는지 이해하지 못한 채 답하게 됩니다. 이는 잘못된 답변·거짓 승인·장기 불신으로 이어집니다.

**규약**: 모든 `/harness:*` 명령은 **출력 첫 3줄**에 다음을 표시합니다.

```
<이모지> <command> · <mode> · <5~10단어 근거>
<blank line>
<실제 출력>
```

예시:

```
🔍 /harness:spec · Mode R (refine) · completeness=low in domain.business_rules

다음 빈약한 필드를 보완하겠습니다:
1. ...
```

```
🔄 /harness:sync · delta mode · F-003 hash changed since last sync

Phase 0: 파생 파일 동기화
...
```

```
📊 /harness:status · normal · 모든 해시 동기화됨

Progress: 7 / 12 features done (58%)
...
```

**강제 수준**: 모든 새 명령 구현 시 준수 필수. 레거시 shim(v2.0 명령)도 동일하게 preamble에 "shim → 실제 명령" 표시:

```
↪️ /harness:build · shim → /harness:sync --force · v3에서 제거 예정
```

**이벤트 로그 연동**: 모드 판별은 `events.log`에 `auto_mode_selected: { command, mode, reason }`로 기록되어 사후 추적 가능.

---

## 3. 시스템 경계

### 3.1 두 종류의 프로젝트

harness-boot는 두 종류의 프로젝트를 다룹니다.

**A. 플러그인 프로젝트 (harness-boot 자체)**
- Claude Code 플러그인 레포
- 기여자가 편집하는 대상
- 배포 단위

**B. 생성 프로젝트 (사용자 프로젝트)**
- harness-boot이 생성하는 결과물
- 사용자가 개발하는 실제 제품
- `.harness/`를 포함

이 둘은 **완전히 다른 파일 구조**를 가집니다. 이 문서는 B를 중심으로 설계하고, 11장에서 A를 별도 다룹니다.

### 3.2 책임 분담 (v2.2 개편)

사용자가 직접 편집하는 **구조화된 입력은 `spec.yaml` 뿐**입니다. 그 외의 모든 `.harness/` 파일은 도구가 관리하거나 spec에서 파생됩니다.

| 구성 요소 | 역할 | 누가 편집하는가 | 파생 여부 |
|-----------|------|----------------|----------|
| `.harness/spec.yaml` | 제품 명세 (실행의 글 + 사고의 글 공존) | **사용자** | — (원천) |
| `.harness/domain.md` | spec.domain의 렌더링 뷰 | 읽기용 · 예외적 편집만 | **파생 (edit-wins 안전망)** |
| `.harness/architecture.yaml` | spec에서 유도된 아키텍처 선언 | 읽기용 · 예외적 편집만 (AR-100+ 수동 규칙 등) | **파생 (edit-wins 안전망)** |
| `.harness/harness.yaml` | 하네스 구성 계약 | harness-boot | — |
| `.harness/state.yaml` | 진행 상태 | harness-boot | — |
| `.harness/events.log` | 이벤트 스트림 (append only) | harness-boot | — |
| `.harness/hooks/*.mjs` | 훅 스크립트 원본 | harness-boot | — |
| `.harness/protocols/*.md` | 프로토콜 문서 | harness-boot | — |
| `.claude/agents/*.md` | 서브에이전트 정의 | harness-boot (생성) | — |
| `.claude/skills/*/SKILL.md` | Agent Skills | harness-boot (생성) | — |
| `.claude/settings.json` | 훅 구성 (어댑터) | harness-boot (생성) | — |

**"사고의 글의 자리"**: spec.yaml의 자유 텍스트 필드들(`project.description`, `project.vision`, `domain.overview`, `entities[].description`, `business_rules[].rationale`, `features[].acceptance_criteria` 등)이 사고의 글이 거주하는 자리입니다. 스키마는 필드 **존재**만 강제하고 내용은 자유 서술 — 길이 제한 없음, 마크다운 지원.

**"파생 (edit-wins 안전망)"**: 파생 파일은 **원칙적으로 편집 대상이 아닙니다** — spec.yaml의 렌더링 결과이므로. 다만 드문 예외(architecture.yaml에 수동 규칙 AR-100+ 추가 등)를 위해 edit-wins 규칙으로 안전하게 보존됩니다.

---

## 4. 파일 구조

### 4.1 전체 구조

```
user-project/
├── README.md                          # 사용자 자산 (제품 문서)
├── CHANGELOG.md                       # 사용자 자산 (제품 변경 이력)
├── package.json                       # 제품 의존성
├── src/                               # 제품 소스 코드
│
├── .harness/                          # ◆ 하네스 메타 자산
│   ├── spec.yaml                      # ★ 사용자 유일 편집 — 실행의 글 + 사고의 글 공존
│   ├── domain.md                      # 파생 뷰 (spec.domain 렌더링, 읽기용)
│   ├── architecture.yaml              # 파생 뷰 (spec에서, 읽기용. AR-100+만 수동)
│   ├── harness.yaml                   # 하네스 구성 계약 + 파생 추적
│   ├── state.yaml                     # 상태 + 피처 목록
│   ├── events.log                     # 이벤트 스트림 (JSON Lines)
│   │
│   ├── hooks/                         # 훅 스크립트 원본
│   │   ├── pre-tool-security-gate.mjs
│   │   ├── pre-tool-doc-sync-check.mjs
│   │   ├── pre-tool-coverage-gate.mjs
│   │   ├── post-tool-format.mjs
│   │   ├── post-tool-test-runner.mjs
│   │   └── session-start-bootstrap.mjs
│   │
│   ├── protocols/                     # 프로토콜 문서 (에이전트가 Read로 참조)
│   │   ├── tdd-cycles.md
│   │   ├── iteration-convergence.md
│   │   ├── code-doc-sync.md
│   │   ├── session-management.md
│   │   ├── message-format.md
│   │   └── anti-rationalization.md    # 모든 스킬이 참조하는 공통 규칙 (SSoT)
│   │
│   └── _workspace/                    # 에이전트 간 핸드오프 (임시)
│       ├── handoff/                   # 큐 패턴 (동시성 안전)
│       │   ├── inbox/{to}/{ts}-{from}-{seq}.md
│       │   ├── processing/{to}/...
│       │   └── archive/{YYYYMMDD}/{to}/...
│       └── artifacts/                 # 에이전트가 생성한 임시 산출물
│           └── {phase}_{agent}_{artifact}.{ext}
│
├── .claude/                           # ◆ Claude Code 표준 어댑터
│   ├── settings.json                  # 훅 구성 (.harness/hooks를 참조)
│   ├── agents/                        # 서브에이전트 (Claude Code 자동 검색)
│   │   ├── orchestrator.md
│   │   ├── implementer.md
│   │   ├── integrator.md              # Walking Skeleton 통합 검증 (v2.3+)
│   │   ├── tdd-test-writer.md         # 조건부 (tdd/state-verification 사용 시)
│   │   ├── tdd-implementer.md         # 조건부
│   │   ├── tdd-refactorer.md          # 조건부
│   │   ├── bdd-writer.md              # 조건부 (lean-tdd 사용 시)
│   │   ├── reviewer.md
│   │   ├── tester.md
│   │   ├── architect.md
│   │   ├── debugger.md
│   │   └── qa-agent.md                # 조건부
│   │
│   └── skills/                        # 스킬 (Claude Code 자동 검색)
│       ├── new-feature/
│       │   └── SKILL.md
│       ├── bug-fix/
│       ├── refactor/
│       ├── tdd-workflow/
│       ├── api-endpoint/
│       ├── db-migration/
│       ├── context-engineering/
│       └── deployment/
│
└── CLAUDE.md                          # Claude Code 로드용 (1,500 토큰 이하)
                                       # 내용: @.harness/spec.yaml 등을 import
```

### 4.2 디렉터리 결정 근거

**왜 `.harness/`와 `.claude/`를 분리하는가**

Claude Code는 세션 시작 시 `.claude/skills/*/SKILL.md`를 글롭 스캔해 시스템 프롬프트에 주입하고, `.claude/agents/`를 서브에이전트 검색 경로로 사용합니다. 이 경로는 Claude Code 코드에 고정되어 있어 변경할 수 없습니다.

따라서 Claude Code가 요구하는 파일은 `.claude/` 아래 표준 위치에 놓되, harness-boot만 읽는 메타 자산(명세·상태·로그)은 `.harness/` 아래 독립적으로 둡니다.

**왜 훅 스크립트는 `.harness/hooks/`에 두는가**

Claude Code는 `.claude/settings.json`에서 훅을 선언하지만, 훅 스크립트 파일 자체의 위치는 자유입니다. `.claude/settings.json`이 `.harness/hooks/pre-tool-security-gate.mjs` 같은 상대 경로로 참조하는 구조가 가능합니다.

이렇게 하면 훅 스크립트의 원본은 `.harness/` 안에 모이고, `.claude/settings.json`은 **얇은 어댑터**가 됩니다. harness-boot이 관리하는 자산(훅)과 Claude Code가 관리하는 설정(어댑터)의 경계가 명확해집니다.

**왜 프로토콜은 `.harness/protocols/`인가**

프로토콜 문서(`tdd-cycles.md` 등)는 에이전트가 명시적으로 `Read` 도구로 읽는 문서이지, Claude Code가 자동 로드하는 파일이 아닙니다. 따라서 위치에 자유가 있고, 메타 자산으로 분류되므로 `.harness/` 아래 둡니다.

에이전트 프롬프트에서는 다음과 같이 참조합니다:

```markdown
## Process
See `.harness/protocols/tdd-cycles.md#cycle-tdd` for the full cycle definition.
```

**왜 CLAUDE.md는 루트에 남기는가**

Claude Code는 프로젝트 루트의 `CLAUDE.md`를 세션 시작 시 자동으로 로드합니다. 이 위치는 변경할 수 없습니다. v2에서 이 파일은 얇은 import 파일로 축소됩니다:

```markdown
# Project Context

@.harness/spec.yaml
@.harness/domain.md
@.harness/architecture.yaml

See `.harness/harness.yaml` for harness configuration.
```

실제 내용은 모두 `.harness/` 아래에 있고, CLAUDE.md는 Claude Code가 그것들을 자동 로드하도록 import 문만 담습니다.

### 4.3 git 커밋 정책

메타 자산 파일별로 **커밋 대상 여부**가 명시적으로 결정되어야 합니다. 기본 정책은 다음과 같습니다.

| 경로 | 커밋 | 근거 |
|------|------|------|
| `.harness/spec.yaml` | ✅ | **유일한 사용자 입력** (v2.2) |
| `.harness/domain.md` | ✅ | **파생 (edit-wins)** — 재현성을 위해 커밋, 편집 시 보존 |
| `.harness/architecture.yaml` | ✅ | **파생 (edit-wins)** — 재현성을 위해 커밋, 편집 시 보존 |
| `.harness/harness.yaml` | ✅ | 하네스 구성 재현성 + derived_from 추적 |
| `.harness/state.yaml` | ⚠️ **조건부** | 1인 개발: 커밋 / 팀: gitignore (브랜치별 current 충돌 회피) |
| `.harness/events.log` | ❌ | 무한 성장 + 로컬 기록 성격 |
| `.harness/events-*.log.gz` | ❌ | 로테이션 아카이브 |
| `.harness/hooks/*.mjs` | ✅ | 훅 동작 재현성 |
| `.harness/protocols/*.md` | ✅ | 에이전트 실행 근거 |
| `.harness/_workspace/` | ❌ | 세션별 임시 자산 |
| `.claude/settings.json` | ✅ | 훅 구성 어댑터 |
| `.claude/agents/*.md` | ✅ | 생성물이지만 재생성 비용 회피 목적 (edit-wins 적용) |
| `.claude/skills/**/*` | ✅ | 동일 |
| `CLAUDE.md` | ✅ | import 파일 |
| `docs/spec/**/*.md` (또는 `$include`가 가리키는 경로) | ✅ | **`$include` 대상 파일** (v2.3.7) — spec.yaml과 함께 재현성 보장. 누락 시 sync fail-fast |

**기본 `.gitignore`** (init 시 추가):

```gitignore
# harness-boot 생성
.harness/_workspace/
.harness/events.log
.harness/events-*.log.gz
.harness.tmp/
.harness.backup/
.claude.tmp/
```

**state.yaml 정책 선택**: `/harness:init` 실행 시 "단독 개발 / 팀 협업" 선택지를 제시해 gitignore 여부를 결정합니다. 선택 결과는 `harness.yaml.policies.state_git_policy`에 기록되어 `/harness:check`가 일관성을 검증합니다.

**배열 머지 친화성 (feature 파일 분할)**: spec.yaml의 `features[]`가 50개를 초과하면 `.harness/spec/features/F-{id}.yaml`로 파일 분할을 권장합니다. 배열 머지 충돌을 파일 단위로 격리할 수 있습니다. 분할은 `spec.yaml`의 `features:` 필드 대신 `features_from: spec/features/*.yaml` 디렉터리 참조로 선언합니다.

---

## 5. 핵심 자산 — `.harness/`

### 5.1 `spec.yaml` — 제품 명세

**역할**: 이 프로젝트가 무엇을 만드는가에 대한 **단일 진실의 원천**. 도구가 하네스를 생성/진화할 때 참조하는 근거.

**실행의 글 + 사고의 글 공존** (v2.3.2 명시): spec.yaml은 **구조적 계약(실행의 글)과 자유 서술(사고의 글)을 한 파일 안에 담습니다**. YAML 구조가 계약의 경계를 명시하고, 그 안의 자유 텍스트 필드(아래 주석 🗒 표시)가 서사의 자리입니다. v1.0 plan.md의 "구조 없이 섞음" 실패와 달리, 스키마가 두 글의 경계를 보장합니다.

**생명주기**: `/harness:init` 실행 시 빈 스켈레톤으로 생성됨. 이후 `/harness:spec` 명령어로 대화형 채움 (Mode A/B). 이후 같은 명령의 Mode R (refine)·E (edit)로 점진적 보완. 기능 추가/변경 시마다 업데이트.

**구조** (YAML, 스키마 검증 필수):

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/qwerfunch/harness-boot/v2.3.2/docs/schemas/spec.schema.json
# .harness/spec.yaml
version: "2.3.2"

# 범례:
#   🗒 = 자유 텍스트 필드 (사고의 글). 마크다운·멀티라인 허용. 내용은 사용자 자유.
#   🔒 = 구조적 필드 (실행의 글). enum·숫자·ID·참조. 스키마가 형식 강제.

project:
  name: string                          # 🔒 프로젝트명 (식별자 성격)
  summary: string                       # 🗒 한 줄 요약 (160자 권장, 길이 강제 아님)
  description: string                   # 🗒 멀티라인 서술 — 이 프로젝트가 왜 존재하는가, 맥락, 배경
  vision: string                        # 🗒 장기 비전 (선택)
  stakeholders:                         # 🔒 이해관계자 구조
    - role: string                      # 🔒 역할 식별
      concerns: [string, ...]           # 🗒 그 역할이 중요시하는 것들 (자유 서술 항목)

domain:
  overview: string                      # 🗒 도메인 전반 서술 — 자유롭게 길게
  entities:                             # 🔒 도메인 엔티티 구조
    - name: string                      # 🔒 엔티티 이름 (식별자)
      description: string               # 🗒 이 엔티티가 무엇이며 왜 존재하는가 — 자유 서술
      invariants: [string, ...]         # 🗒 불변식 (예: "이메일은 유일하다" — 자연어 OK)
      sensitive: boolean                # 🔒 안전 임계 여부 (test_strategy 추론)
      sensitive_reason: string          # 🗒 sensitive=true일 때 필수 (감사 근거, 서술)
  business_rules:                       # 🔒 비즈니스 규칙 구조
    - id: string                        # 🔒 BR-001 형식
      statement: string                 # 🗒 규칙 진술 (자연어)
      rationale: string                 # 🗒 왜 이 규칙이 있는가 — 맥락·이유 (사고의 글 핵심)
      compliance: [string, ...]         # 🔒 예: ["SOC2", "GDPR"]
  vocabulary:                           # 🔒 도메인 용어집 구조
    - term: string                      # 🔒 용어
      definition: string                # 🗒 정의 (서술)

constraints:
  tech_stack:
    language: string                    # 🔒 예: "TypeScript"
    runtime: string                     # 예: "Node.js 20"
    framework: string                   # 예: "Next.js 14"
    testing: string                     # 예: "Vitest"
  architecture:
    pattern: enum                       # flat | layered | hexagonal | microservices
    reference: string                   # architecture.yaml 경로
  quality:
    coverage_threshold: number          # 0-100, 기본 70
    required_gates: [number, ...]       # 기본 [0,1,2,3,4,5] — Gate 5 포함 (v2.3)
    prototype_mode: boolean             # v2.3 신설. true면 skeleton 강제·Gate 5 완화

deliverable:                            # v2.3 신설, 최상위 필수 (prototype_mode=true 시 선택)
  type: enum                            # cli | web-service | game | worker | library | static-site
  entry_points:                         # 최소 1개 (library 제외)
    - name: string                      # "main", "dev-server", "worker"
      command: string                   # 실행 명령 (예: "npm start", "node dist/main.js")
      build_command: string             # 빌드 명령 (예: "npm run build"). 선택적
      health_check:
        type: enum                      # exit-code-zero | http-200 | port-listen | log-pattern | window-open
        timeout_seconds: number         # 기본 30
        expected: any                   # type별 기대값 (예: http-200이면 {url, status})
  smoke_scenarios:                      # 최소 1개. Walking Skeleton feature가 통과시켜야 할 시나리오
    - id: string                        # SS-001 형식
      description: string
      steps: [string, ...]              # 재현 단계
      success_criteria: string          # 성공 판정 기준 (자연어 + 가능하면 기계 검증 가능한 표현)

features:
  - id: string                          # F-001 형식
    type: enum                          # skeleton | feature (기본 'feature'). 'skeleton'은 Walking Skeleton feature 전용 — Gate 5 smoke 검증 대상이 됨
    title: string
    priority: number                    # 1 = 최우선
    status: enum                        # planned | in_progress | done | deferred
    test_strategy: enum                 # lean-tdd | tdd | state-verification | integration
    test_strategy_reason: string        # 분류 근거
    acceptance_criteria:                # 수용 기준 (인터페이스 힌트 없음)
      - string
    tdd_focus: [string, ...]            # tdd 전략일 때 필수
    depends_on: [string, ...]           # 다른 feature id
    modules: [string, ...]              # 자유 문자열. architecture.yaml의 modules는 이 이름들의 유니온에서 파생됨 (v2.2)
    doc_sync:                           # 구조화된 문서 동기화 선언
      - target: string                  # 예: "docs/api/users.md"
        sections: [string, ...]         # 예: ["#endpoints", "#schema"] (선택)
        watch: [string, ...]            # 감지 대상 glob (예: ["src/users/exports.ts"]) — 이 glob이 변경되면 target 문서 동기화 필요. architecture.yaml.modules[].exports가 비어 있어도 watch는 독립적으로 작동하며, 반대로 exports가 변경되면 해당 경로와 매치되는 watch가 자동 트리거됨
        severity: enum                  # error | warn (기본 error, 훅이 커밋 차단)

metadata:
  source:
    origin: enum                        # idea | planning_doc | reverse_engineered (v2.3.5+ 미지원, 향후 기능 예약). 현재 스키마 검증은 값만 허용하고 파이프라인에선 fallback to 'idea'
    created_at: ISO8601
    refined_at: ISO8601
    source_lines:                       # origin=planning_doc일 때 추출 근거 (LLM 파싱 검증용)
      - field_path: string              # 예: "features[0].acceptance_criteria[1]"
        source_file: string             # 예: "plan.md"
        source_range: [number, number]  # 예: [34, 38]
        confidence: enum                # high | medium | low
  completeness:
    domain: enum                        # high | medium | low
    features: enum
    modules: enum
```

**검증 규칙** (JSON Schema 및 `/harness:check` 강제):

1. **참조 무결성**
   - `features[].depends_on`는 존재하는 feature id (순환 금지, 위상 정렬 가능해야 함)
   - `features[].modules`는 자유 문자열. v2.2부터 architecture.yaml이 파생 결과이므로 이 필드가 원천. 단, `/harness:check`가 오타 감지를 위해 **유사 이름 경고**(예: `authh` → `auth` 같아 보임?) 제공. 판정 기준(v2.3.5): 기존 모듈 이름 집합과의 **Levenshtein 거리 ≤ 2** 이면서 **편집 비율 ≤ 0.34** (len(diff)/max(len(a),len(b))). 둘 다 만족 시 warning. 사용자는 `/harness:check --ignore-similar` 또는 spec 편집으로 해결. 대소문자는 비교 전 소문자화, 공백·`_`·`-`는 정규화 후 비교.
   - `features[].modules`의 값들은 architecture.yaml의 `modules[].name` 유니온과 일치해야 함 (사용자가 architecture.yaml을 편집하지 않은 경우 자동 보장)

2. **Walking Skeleton 강제 규칙** (v2.3 신설)
   - `features[]`의 **첫 번째 요소**(가장 낮은 `priority`)는 `type: skeleton`이어야 함
   - `constraints.quality.prototype_mode: true`일 때만 예외 허용 (skeleton 생략 가능)
   - `type: skeleton` feature의 `acceptance_criteria`에는 "빌드 성공", "entry_points 기동", "최소 1개 smoke_scenario 통과"가 암묵적으로 포함됨 (build·integrator 에이전트가 자동 검증)
   - 다른 feature들은 type 생략 시 `feature`로 기본값 적용
   - 두 번째 이상의 skeleton feature는 금지 (unique 제약)

3. **deliverable 완전성** (v2.3 신설)
   - `deliverable.type`에 따른 필수 필드:
     - `library` → `entry_points` 없어도 됨 (import만 되면 OK, smoke는 public API 호출 테스트)
     - 그 외 → `entry_points` 최소 1개 필수
   - `deliverable.smoke_scenarios` 최소 1개 필수 (skeleton feature 검증용)
   - `entry_points[].health_check.type`이 deliverable.type과 호환되어야 함 (예: `type: game`인데 `health_check: http-200`이면 경고)

4. **sensitive 자동 추론 규칙** (build 시 적용, 사용자 override 가능)
   - 엔티티명이 정규식 `/^(auth|payment|credential|secret|token|password|credit_card|ssn|kyc|billing|session)$/i` 매칭 → `sensitive: true` 제안
   - `sensitive: true` 엔티티를 `modules`로 참조하는 feature는 `test_strategy: tdd` 강제 (경고가 아닌 **error**)
   - 규칙 예외를 원하면 `features[].test_strategy_override: { reason: string, approved_by: string }`를 명시 (감사 로그 기록)

5. **전략별 필수 필드**
   - `test_strategy: tdd` → `tdd_focus` 비어 있지 않아야 함
   - `test_strategy: integration` → `acceptance_criteria` 최소 1개가 e2e 관점 서술이어야 함 (linter 경고)
   - `test_strategy: lean-tdd` → `acceptance_criteria`가 Given/When/Then 구문 가능한 형태 권장

6. **필수 필드 기본값**
   - `tech_stack.framework` 미지정 시 build 거부 (`/harness:spec` Mode R로 유도)
   - `quality.coverage_threshold` 미지정 시 70 적용

**외부 파일 참조 (`$include`, v2.3.7 신설)**:

긴 서사(🗒 자유 텍스트) 필드를 외부 `.md` 파일로 분리할 수 있습니다. YAML 편집기에서 다루기 힘든 수십~수백 줄 단락을 Markdown 네이티브 환경으로 옮겨 편집 UX를 개선하기 위함입니다. 구조(🔒) 필드는 지원하지 않으며 — **참조 무결성과 스키마 검증은 그대로 strict로 유지**됩니다.

**구문**: 문자열 자리에 `$include` 객체를 둡니다.

```yaml
project:
  name: "my-service"
  summary: "짧은 한 줄은 inline"      # 🗒 inline 문자열 (기존 방식)
  description:
    $include: docs/spec/vision.md      # 🗒 외부 md 파일 (v2.3.7)
  vision:
    $include: docs/spec/vision.md      # 같은 파일 재참조 허용

features:
  - id: F-003
    title: "비밀번호 재설정"
    acceptance_criteria:
      - "입력된 이메일로 리셋 링크를 발송한다"           # inline 원소
      - $include: docs/spec/features/F-003-ac-2.md      # 외부 md 원소 (배열 원소에도 허용, v2.3.7)
```

**적용 가능 필드** (🗒 자유 텍스트 필드만):

| 필드 경로 | 비고 |
|----------|------|
| `project.description`, `project.vision`, `project.summary` | — |
| `project.stakeholders[].concerns[]` | 배열 원소 허용 |
| `domain.overview` | — |
| `domain.entities[].description`, `domain.entities[].sensitive_reason` | — |
| `domain.entities[].invariants[]` | 배열 원소 허용 |
| `domain.business_rules[].statement`, `domain.business_rules[].rationale` | — |
| `domain.vocabulary[].definition` | — |
| `features[].acceptance_criteria[]`, `features[].tdd_focus[]` | 배열 원소 허용 |
| `deliverable.smoke_scenarios[].description`, `deliverable.smoke_scenarios[].success_criteria` | — |
| `deliverable.smoke_scenarios[].steps[]` | 배열 원소 허용 |
| `metadata.source.source_lines` 이외의 자유 텍스트 전부 | — |

**구조(🔒) 필드 금지** (예: `features[].id`, `features[].type`, `features[].test_strategy`, `constraints.quality.coverage_threshold`, `deliverable.type`, 모든 enum/number/boolean). 스키마 검증은 `$include` 확장 **이후**에 수행되므로 구조 필드에 include를 쓰면 스키마 위반으로 거부됩니다.

**검증 규칙**:

1. **경로 제약**:
   - **프로젝트 루트 상대 경로만**. 절대 경로(`/...`)와 상위 참조(`..`)는 거부.
   - **허용 디렉터리**: `docs/`, `.harness/spec/` 하위. 그 외는 거부(사용자 자산·제품 코드 혼입 방지).
   - 확장자는 `.md` 전용 (v2.3.7). 다른 확장자는 향후 검토.
2. **크기 제약**:
   - 개별 include 파일: **100KB 이하**.
   - 한 spec.yaml의 include 총합: **1MB 이하** (전개 후 메모리 폭발 방지).
3. **순환·재귀 금지**:
   - include된 md 파일은 **재귀 include 불가** (v2.3.7). md 파일 내부에 YAML 블록이 있어도 그것은 Markdown 텍스트로만 취급.
   - 같은 파일을 여러 필드에서 참조하는 것은 허용(내용은 한 번만 읽어 캐시).
4. **존재 필수**: `$include: <path>`의 파일이 없으면 `/harness:sync`·`/harness:spec`이 에러로 거부.
5. **`$include` 단독 키**: `$include` 객체는 **다른 키와 공존 불가** — `{$include: ..., content_type: ...}` 같은 혼합은 거부. 확장 여지는 v2.4+.
6. **확장 후 타입 일치**: 파일 내용(트리밍된 문자열)이 대상 필드의 타입 계약을 만족해야 함. 예를 들어 `features[].acceptance_criteria[]` 원소에 include된 md 파일은 **하나의 수용 기준 서술**이어야 하며, 불릿 리스트 등을 여러 개 넣으면 원소가 하나로 취급되어 의미가 왜곡됩니다.

**확장 의미**:

- `/harness:sync` Phase 0의 맨 앞에서 `resolve_includes(spec.yaml) → expanded_spec`이 수행됩니다(§7.3.3).
- **이후의 모든 파이프라인 단계**(스키마 검증, 파생, 해시 트리 계산, domain.md/architecture.yaml 생성)는 `expanded_spec`을 기준으로 동작합니다.
- `.harness/spec.yaml` **원본은 편집되지 않습니다**(include 포인터 그대로 유지). 사용자가 다음번 편집할 때도 외부 파일이 원천입니다.

**드리프트 추적**:

`harness.yaml.generation.include_sources[]`에 각 include의 `{path, output_hash, resolved_at}`가 기록됩니다. `/harness:check` Step 1이 파일 해시 변경을 감지하여 Spec drift의 일부로 보고합니다 (§10.4).

**Mode E 편집 보조** (§7.3.2):

사용자가 `/harness:spec` Mode E에서 include된 필드를 수정하려 하면 "이 필드는 `docs/spec/vision.md`에 있습니다. 외부 파일 편집을 원하십니까? (y/n)"을 묻고, 동의 시 편집기 프로세스를 spawn합니다. 거부 시 spec.yaml에서 `$include`를 제거하고 inline으로 전환할지 되물어 선택권을 줍니다.

**왜 `$include`인가(구문 선택 근거)**:

- YAML 사용자 정의 태그(`!include docs/vision.md`)도 후보였으나, 대부분의 lint·schema 도구가 custom tag를 모호하게 처리하므로 **JSON Schema로 표현 가능한 `$include` 객체** 형태 채택.
- JSON Schema 생태계의 `$ref`와 의미가 다르므로(여긴 문자열 값 치환, 저긴 스키마 참조) 이름 충돌 회피 위해 `$include` 선택.
- 모든 YAML 파서가 기본 타입(맵)으로 읽을 수 있어 커스텀 파서 불필요.

**크기 제한**: spec.yaml 본체 1,000 라인 이하 (기존 유지). `$include`로 분리한 외부 파일은 별도 합산.

### 5.2 `domain.md` — 도메인 렌더링 뷰 (파생)

**역할**: `spec.yaml`의 `domain` 섹션을 **사람이 읽기 좋게 렌더링한 읽기용 뷰**. 팀원(사람과 AI 모두)이 도메인을 한눈에 파악할 때 참조합니다.

**본질**: **뷰일 뿐 서사의 원천이 아닙니다** (v2.3.2 명시). 사고의 글(서사·맥락·이유)은 spec.yaml의 자유 텍스트 필드(`description`, `rationale`, `overview` 등)에 이미 존재합니다. domain.md는 그 내용을 다른 형태로 보여주는 창문입니다.

**파생 관계**: harness-boot이 spec.yaml의 `domain` 섹션에서 자동 생성. 사용자는 spec.yaml만 편집하면 됩니다.

**편집 존중 규칙 (edit-wins 안전망)**: 원칙적으로 편집 대상 아닙니다. 그러나 드문 예외를 위해 안전망 유지:

| 현재 파일 해시 vs 저장된 output_hash | 동작 |
|--------------------------------------|------|
| 일치 (또는 파일 없음) | 안전 재파생, output_hash 갱신 |
| 불일치 (사용자 편집) | 편집 보존, spec 변경 사항은 반영 안 됨을 경고 |
| `/harness:sync --regenerate-derived=domain` | 편집본을 `.harness.backup/`으로 이동 후 재파생 |

**파생 알고리즘**:

1. **입력**: `spec.yaml`의 `domain` 섹션 (overview, entities, business_rules, vocabulary)
2. **출력 템플릿** (결정적 렌더링):

```markdown
# Domain Overview

<!-- 이 문서는 spec.yaml의 domain 섹션에서 자동 생성된 뷰입니다.
     서사·의사결정·이유 등은 spec.yaml의 자유 텍스트 필드에 직접 쓰세요.
     의사결정 이력은 git 커밋·PR·ADR(docs/adr/)에 기록하는 것을 권장합니다. -->

{{ spec.domain.overview }}

## Core Concepts

{{#each spec.domain.entities}}
### {{ name }}

{{ description }}

**불변식**:
{{#each invariants}}
- {{ this }}
{{/each}}

{{#if sensitive}}
**⚠️ 안전 임계**: {{ sensitive_reason }}
{{/if}}
{{/each}}

## Business Rules

{{#each spec.domain.business_rules}}
### {{ id }}: {{ statement }}

**근거**: {{ rationale }}

{{#if compliance}}
**관련 규정**: {{ join compliance ", " }}
{{/if}}
{{/each}}

## Glossary

{{#each spec.domain.vocabulary}}
- **{{ term }}**: {{ definition }}
{{/each}}
```

3. **선택적 LLM 프로즈 폴리싱**: 결정적 템플릿 결과를 LLM에 전달해 문체 매끄럽게 다듬기. 옵션 (`harness.yaml.policies.prose_polish: on | off`), 기본 off (비용·재현성).

**v2.3.2 단순화**: 이전 버전의 "Decision Log" 섹션을 제거했습니다. 의사결정 이력은 domain.md에 저장하지 않습니다:

- **단기 결정**: git 커밋 메시지
- **중기 결정**: PR 설명
- **장기 결정**: ADR(`docs/adr/YYYY-MM-DD-topic.md`) — 업계 표준 관행
- **제품 의도/배경**: spec.yaml의 `project.description`, `project.vision`
- **도메인 이유**: spec.yaml의 `business_rules[].rationale`, `entities[].description`

harness-boot은 이 중 어느 것도 재발명하지 않고, 각자의 자리에 있도록 안내만 합니다.

**위치 근거**: Claude Code는 `.harness/domain.md`를 자동 로드하지 않지만, `CLAUDE.md`가 `@.harness/domain.md` import로 세션 시작 시 주입합니다. 에이전트가 `Read` 도구로도 명시 참조 가능.

**크기 제한**: 500 라인 이하. 초과 시 spec.yaml의 domain 섹션이 너무 방대하다는 신호. spec 자체를 검토하고 필요 시 features로 일부 분리.

**왜 파생 뷰인가**:
- spec.yaml에 이미 있는 내용을 두 번 쓰지 않음 (드리프트 방지)
- 렌더링은 포맷 변환일 뿐 새로운 정보가 아님
- 사고의 글(맥락·이유)은 spec.yaml의 자유 텍스트 필드가 이미 담당

### 5.3 `architecture.yaml` — 아키텍처 선언 (파생)

**역할**: 모듈 경계와 레이어 규칙의 **기계 검증 가능한 선언**. 에이전트가 구현 시 지켜야 할 구조적 제약.

**파생 관계 (v2.2 핵심 변경)**: architecture.yaml은 **spec.yaml에서 파생**됩니다. 단, 순수 파생이 불가능한 모호한 케이스는 `/harness:sync` 실행 중 사용자에게 질문합니다 (한 번 답하면 `harness.yaml`에 기록되어 재사용).

**편집 존중 규칙 (edit-wins)**: 5.2와 동일.

**구조** (변경 없음, 파생 대상 + 발견 대상이 공존):

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/qwerfunch/harness-boot/v2.3.2/docs/schemas/architecture.schema.json
# .harness/architecture.yaml
version: "2.3.2"

# 아래 주석은 파생 시 자동 삽입됨
# <!-- harness-boot이 spec.yaml에서 파생. 편집 시 edit-wins 규칙 적용. -->

pattern: enum                           # flat | layered | hexagonal | microservices
                                        # ← spec.yaml의 constraints.architecture.pattern에서 파생

layers:                                 # ← pattern에서 파생 (패턴별 기본값)
  - name: string
    depth: number
    description: string

modules:                                # ← spec.yaml의 features[].modules 수집 + 엔티티 기반 추론
  - name: string
    layer: string                       # ← 이름 휴리스틱·엔티티 매칭·사용자 응답으로 결정
    description: string
    allowed_dependencies: [string, ...] # ← 패턴 + 레이어 규칙에서 파생
    forbidden_dependencies: [string, ...]
    exports:                            # ← 코드에서 **발견** (파생 아님)
      - name: string
        kind: enum
        stability: enum

rules:                                  # ← 패턴 기본 규칙 + 사용자 추가분 보존
  - id: string                          # AR-001 (파생), AR-100+ (사용자 추가)
    statement: string
    enforced_by: enum
    exceptions: [string, ...]

cross_cutting:                          # ← 엔티티의 sensitive 플래그 + 사용자 추가
  - name: string
    applies_to: [string, ...]
```

**각 필드의 파생 원천과 알고리즘**:

**`pattern`**: `spec.yaml.constraints.architecture.pattern` 그대로 복사.

**`layers[]`**: pattern에 따라 사전 정의된 템플릿 적용.
- `flat` → `[{name: "root", depth: 0}]`
- `layered` → `[presentation, application, domain, infrastructure]`
- `hexagonal` → `[adapter_in, application, domain, adapter_out]`
- `microservices` → `[api, service, data]` × N 서비스

**`modules[].name`**: `spec.yaml.features[].modules` 유니온. 중복 제거.

**`modules[].layer` 할당 알고리즘**:
1. **이름 휴리스틱**:
   - `api_*`, `*_controller`, `ui_*` → presentation
   - `*_service`, `*_usecase` → application
   - `auth`, `billing`, 엔티티 이름과 매칭 → domain
   - `db_*`, `*_repository`, `*_client` → infrastructure
2. **엔티티 매칭**: 모듈 이름이 `spec.domain.entities[].name`과 일치하면 domain 레이어 자동 배정
3. **모호한 경우**: 두 개 이상의 레이어에 배정 가능하거나 매칭되지 않으면 사용자에게 번호 선택 질문 (해결된 답변은 `harness.yaml.generation.derived_from.architecture_yaml.layer_assignments`에 기록되어 재실행 시 재사용)

**`modules[].allowed_dependencies`**: 레이어 기반 기본 규칙에서 파생.
- layered: 같은 레이어 내 + 하위 레이어만 허용
- hexagonal: domain은 어떤 것도 허용 안 함 / adapter는 application만 허용
- flat: 모두 허용

**`modules[].forbidden_dependencies`**: `sensitive: true` 엔티티를 다루는 모듈은 외부 HTTP 모듈 직접 의존 금지 등, 안전 규칙 자동 적용.

**`modules[].exports`**: **파생 대상 아님**. 실제 코드가 작성되면서 `/harness:work` 중 에이전트가 정적 분석으로 수집. 첫 파생 시에는 빈 배열.

**`rules[]`**: 패턴별 기본 규칙(`AR-001` ~ `AR-099`)은 템플릿에서 파생. 사용자가 수동 추가한 `AR-100+` 규칙은 edit-wins로 보존.

**`cross_cutting[]`**: `spec.domain.entities[].sensitive: true`인 엔티티에서 `auth`/`audit_log` 같은 횡단 관심사 자동 제안. 사용자 확인 후 반영.

**모호성 질문 (사용자에게 물어보는 시점)**:

`/harness:sync` 실행 중 architecture 파생 단계에서 다음 경우 번호 선택 질문 (v2.1의 "one question at a time" 준수):

1. **레이어 할당 모호**: "`billing` 모듈이 `application` 또는 `domain` 둘 다 해당할 수 있습니다. 어디에 배치하시겠어요?"
2. **새 모듈 등장**: "spec에 `notifications` 모듈이 새로 등장했습니다. 기존 모듈 중 어떤 것과 유사한 위치인가요?"
3. **패턴 변경 감지**: "spec.yaml의 pattern이 layered → hexagonal로 변경되었습니다. 기존 모듈 구조를 수동 재배치하시겠어요, 아니면 자동 매핑을 신뢰하시겠어요?"

질문 답변은 `harness.yaml.generation.derived_from.architecture_yaml.user_decisions`에 누적 저장. 다음 sync에서 같은 상황 재발 시 재질문 없이 재사용.

**검증 규칙** (변경 없음):

- `modules[].allowed_dependencies`가 존재하는 모듈인지 확인
- `forbidden_dependencies`와 `allowed_dependencies`가 겹치지 않음
- 레이어드 패턴에서 하위 레이어가 상위 레이어를 참조 금지
- `/harness:check`가 실제 import 그래프와 이 선언을 대조

**왜 파생인가**:
- 아키텍처의 선언적 부분(pattern, 모듈 목록, 의존 규칙)은 spec에서 **결정 가능**
- 발견적 부분(exports)은 코드 실행 중 수집하는 게 자연스러움
- 사용자가 수동 편집하고 싶은 드문 경우(특수 규칙 AR-100+ 등)는 edit-wins로 보존

### 5.4 `harness.yaml` — 하네스 구성 계약

**역할**: 이 프로젝트에 어떤 하네스가 설치되었는지의 **메타데이터**. 생성 시점 버전, 활성 훅, 정책 설정, **영역별 해시 트리**.

**주로 harness-boot이 관리** (사용자는 제한적으로 편집 가능).

**해시 필드 계산 규약**: 이 절에 등장하는 모든 `*_hash` 필드(`root_hash`, `source_hash`, `output_hash`, `node_hash` 등)는 **부록 D — 해시 정규화 규약**에 따라 계산합니다. 서로 다른 구현 간에도 동일한 해시값이 재현되도록 Canonical JSON 직렬화(D.2) + SHA-256(D.6)을 따르세요.

**구조**:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/qwerfunch/harness-boot/v2.3.2/docs/schemas/harness.schema.json
# .harness/harness.yaml
version: "2.3.2"
harness_boot_version: string            # 생성 시 도구 버전 (예: "0.2.0")

runtime:
  primary: enum                         # claude-code (v2 현재)
  adapters: [string, ...]               # 향후 확장: cursor, opencode

agents:
  - name: string                        # .claude/agents/의 파일명과 매칭
    model: enum                         # opus | sonnet | haiku
    role: string                        # orchestrator, implementer 등
    condition: enum                     # always | has_tdd | has_lean_tdd | has_state_verification | has_integration | has_sensitive_entity
    # DSL 대신 사전 정의된 condition key 사용 (파서 불필요, 검증 용이)

gates:
  - id: number                          # 0~5
    name: string                        # "test_evidence", "compile", "style", "coverage", "commit", "runtime_smoke"
    enforced: boolean
    hook: string                        # 상대 경로 (.harness/hooks/*.mjs)

policies:
  max_iterations: number                # 기본 5
  doc_sync: enum                        # strict | lenient | off
  security_gate: enum                   # standard | paranoid | off
  state_git_policy: enum                # commit | ignore (4.3의 init 선택 결과)
  conversation_language: string         # ISO 639-1
  comment_language: string
  events_log:
    rotation_size_mb: number            # 기본 10
    rotation_owner: enum                # hook | cli | manual (기본 hook: session-start에서 체크)
    retention_days: number              # 기본 90 (이후 삭제 또는 외부 아카이브)

# conversation_language / comment_language 소비 지점 (추적용):
#   - orchestrator 에이전트 시스템 프롬프트 주입
#   - /harness:spec 인터뷰 질문 언어
#   - post-tool-format.mjs의 주석 번역 검사 (선택)
#   - 모든 스킬의 Common Rationalizations 표 언어

generation:
  generated_at: ISO8601
  generated_from:                       # 영역별 해시 트리 (Merkle 스타일, v2.1)
    spec:
      project_hash: string              # sha256(project 섹션)
      tech_stack_hash: string           # sha256(constraints.tech_stack)
      quality_hash: string              # sha256(constraints.quality)
      domain_hash: string               # sha256(domain 섹션)
      features:                         # 피처별 개별 해시
        F-001: string
        F-002: string
      root_hash: string                 # 위 모두의 컴바인드 해시
  derived_from:                         # 파생 파일 추적 (v2.2 신설, edit-wins 판정용)
    domain_md:
      source_hash: string               # 파생 시점 spec.domain 해시
      output_hash: string               # 파생 결과 domain.md 해시
      generated_at: ISO8601
      user_edit_detected: boolean       # /harness:sync가 해시 비교 결과 기록
    architecture_yaml:
      source_hash: string               # 파생 시점 관련 spec 필드들 해시
      output_hash: string               # 파생 결과 architecture.yaml 해시
      generated_at: ISO8601
      user_edit_detected: boolean
      layer_assignments:                # 사용자가 답한 레이어 질문 누적 (재질문 방지)
        billing: application
        notifications: application
      user_decisions:                   # 기타 모호성 답변 누적
        - question: "pattern 변경 시 자동 매핑 여부"
          answer: "trust_automapping"
          answered_at: ISO8601
  include_sources:                      # $include 외부 md 파일 추적 (v2.3.7 신설, drift 감지용)
    - path: string                      # 예: "docs/spec/vision.md" (레포 루트 기준 상대)
      pointer: string                   # 예: "$.project.description" 또는 "$.features[2].acceptance_criteria[1]"
      output_hash: string               # resolve 시점 외부 파일 내용의 sha256
      resolved_at: ISO8601              # Phase 0 include 확장 시각
      byte_size: integer                # 외부 파일 크기 (byte, 제한 검사용)
      user_edit_detected: boolean       # /harness:sync가 외부 파일 해시 재계산 결과 기록
  drift_status: enum                    # synced | spec_changed | derived_diverged | manual_edit_detected | include_changed
  last_check: ISO8601
  last_sync: ISO8601
```

**왜 해시 트리인가 (v2.0 → v2.1 변경)**

v2.0은 `spec_hash` 단일 해시였으나, 이는 "어디가 바뀌었는지"를 판정할 수 없어 `/harness:sync` 델타 모드를 **구현 불가능하게 만드는 설계 결함**이었습니다.

v2.1은 영역별/피처별/모듈별 해시 트리로 다음을 가능하게 합니다:

- **F-003만 바뀜 감지** → F-003 관련 implementer만 재생성 (전체 재빌드 회피)
- **tech_stack 변경 감지** → 모든 skill의 compatibility 필드만 업데이트
- **모듈 auth만 변경** → auth 관련 에이전트 특화 프롬프트만 재생성
- **root_hash**로 고속 동일성 비교 (세부 트리 비교는 root 불일치 시에만)

**왜 `derived_from`이 별도인가 (v2.2 신설)**

`generated_from`은 spec → 하네스 파일(agents/skills/hooks) 파생 추적용. `derived_from`은 spec → 파생 YAML(domain.md, architecture.yaml) 파생 추적용. 둘을 분리하는 이유:

- **책임 분리**: `generated_from`은 구조적 재생성, `derived_from`은 edit-wins 판정
- **질문 답변 보관**: architecture 파생 시 모호성 질문의 답을 누적해 재질문 회피
- **사용자 편집 추적**: `output_hash`와 현재 파일 해시 비교로 편집 감지

**왜 `include_sources`가 별도인가 (v2.3.7 신설)**

`$include`로 참조된 외부 md 파일은 **Spec drift의 한 축**입니다. spec.yaml 자체는 안 바뀌어도 외부 md가 바뀌면 `expanded_spec`이 바뀌고 하네스를 재생성해야 합니다. `generated_from`/`derived_from`만으로는 이 축을 추적할 수 없어 별도 필드가 필요합니다.

- **책임 분리**: `generated_from`은 spec 내부 변경 감지, `derived_from`은 파생 파일 편집 감지, `include_sources`는 **외부 참조 파일 편집 감지**
- **pointer 기록**: 어떤 spec 경로에 매달려 있는지 JSONPath 형식으로 저장 → 역추적 가능 (하나의 md가 어느 필드에 inline 되는가)
- **drift_status에 include_changed 추가**: `/harness:check`가 spec/파생/include 세 축을 모두 판정하도록 상태를 확장
- **크기 추적**: `byte_size` 기록으로 §5.1의 1MB 누적 상한 검사를 매 sync마다 재수행

**왜 `condition:`을 enum으로 바꿨는가**

v2.0의 `conditional: "any_feature.test_strategy == 'tdd'"`는 mini-DSL이라 파서·평가기·오류 처리를 자체 구현해야 했습니다. 사전 정의된 enum은 구현이 단순하고 검증도 선형입니다. 필요한 condition 종류는 실제로 유한합니다 (현재 6개).

### 5.5 `state.yaml` — 상태와 피처 목록

**역할**: 현재 진행 상태의 **스냅샷**. "지금 무엇을 하고 있고, 무엇이 끝났고, 무엇이 남았는가"를 한 파일에서.

**v1의 PROGRESS.md + feature-list.json을 통합**. 두 파일이 항상 함께 읽히고 함께 쓰이므로 같은 트랜잭션 경계에 두는 것이 원자성 보장에 유리.

**SSoT 원칙 준수 (v2.0 → v2.1 변경)**: v2.0은 "가독성"을 이유로 `title`, `priority`, `test_strategy`를 spec.yaml에서 복제했습니다. 이는 단일 진실의 원천 원칙을 정면으로 위반하므로 v2.1에서 **제거**합니다. 표시용 정보는 읽기 시점에 spec.yaml과 조인합니다 (`/harness:status` 같은 뷰 레이어의 책임).

**구조**:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/qwerfunch/harness-boot/v2.3.2/docs/schemas/state.schema.json
# .harness/state.yaml
version: "2.3.2"

current:
  feature_id: string                    # 현재 작업 중인 feature (spec.yaml 참조)
  iteration: number                     # 반복 횟수 (0-5)
  phase: enum                           # design | implement | verify | refactor
  started_at: ISO8601
  last_checkpoint: ISO8601

features:
  # 순수 런타임 상태만 기록. spec.yaml과 조인 시 id로 매칭.
  # title/priority/test_strategy 등은 spec.yaml이 단일 원천.
  - id: string                          # spec.yaml.features[].id 참조
    status: enum                        # pending | in_progress | done | blocked | deferred
    started_at: ISO8601
    completed_at: ISO8601
    gates_passed: [number, ...]
    iterations_used: number
    evidence:                           # 전략별 discriminated union (Gate 0~5 증거)
      strategy: enum                    # 기록 시점의 test_strategy 스냅샷 (spec 변경 추적용)
      artifacts:                        # 전략별 스키마로 분기
        # case test_strategy == 'tdd':
        #   red_sha: string             # Red phase commit
        #   green_sha: string           # Green phase commit
        #   refactor_sha: string        # Refactor phase commit
        #   coverage: number
        #
        # case test_strategy == 'lean-tdd':
        #   bdd_scenarios_count: number
        #   scenarios_ref: string       # BDD 시나리오 파일 경로
        #   coverage: number
        #
        # case test_strategy == 'state-verification':
        #   before_state_ref: string    # 상태 fixture 경로
        #   after_state_ref: string
        #   assertion_count: number
        #   coverage: number
        #
        # case test_strategy == 'integration':
        #   e2e_run_id: string
        #   env_fingerprint: string     # 실행 환경 식별자 (버전·설정 해시)
        #   scenarios_passed: number
        #   scenarios_total: number
      smoke:                            # v2.3 신설. Gate 5 (모든 전략 공통) 증거
        verified_at: ISO8601            # 빌드+실행 검증 시각
        build_sha: string               # 빌드 성공 시점 커밋
        build_command_used: string      # 실제 실행한 빌드 명령 (감사용)
        entry_point: string             # 기동한 entry_point name
        health_check_passed: boolean
        scenarios_passed: [string, ...] # 통과한 smoke_scenario id 목록
        scenarios_total: number
    blocked_reason: string              # blocked 상태일 때

session:
  last_resumed_at: ISO8601
  active_agents: [string, ...]          # 현재 dispatch된 서브에이전트들
  pending_handoffs: [string, ...]       # _workspace/handoff/inbox/ 미처리 파일들
```

**각 전략의 Gate 0 계약** (`.harness/protocols/tdd-cycles.md`에서 정식화, 여기는 요약):

| 전략 | Gate 0 충족 조건 | 필수 evidence.artifacts 필드 |
|------|-----------------|----------------------------|
| `tdd` | Red 테스트가 실제로 실패한 커밋 존재 | `red_sha` (lint 통과 + 테스트 실패) |
| `lean-tdd` | BDD 시나리오가 acceptance_criteria를 덮음 | `bdd_scenarios_count ≥ 1`, `scenarios_ref` |
| `state-verification` | before/after 상태 assertion이 존재 | `before_state_ref`, `after_state_ref`, `assertion_count ≥ 1` |
| `integration` | e2e 실행이 재현 가능한 환경에서 통과 | `e2e_run_id`, `env_fingerprint`, `scenarios_passed/total` |

**Gate 5 계약** (v2.3 신설, 모든 전략 공통):

| 조건 | 판정 |
|------|------|
| 빌드 명령이 exit 0으로 종료 | `evidence.smoke.build_sha` 기록 필수 |
| 활성 entry_point 기동 + health_check 통과 | `health_check_passed: true` |
| deliverable.smoke_scenarios 전부 통과 | `scenarios_passed.length === scenarios_total` |
| 위 셋 중 하나라도 실패 | feature 상태 `blocked`, `blocked_reason: "gate_5_failed: ..."` |

**prototype_mode 완화**: `constraints.quality.prototype_mode: true`일 때 Gate 5 미통과도 done 허용. 단 `evidence.smoke: { skipped: true, reason: "prototype_mode" }`로 명시 기록.

**불변 조건**:

- `current.feature_id`는 spec.yaml의 존재하는 feature id여야 함 (session-start-bootstrap 훅 검증)
- `features[].status == 'done'`인 피처만 `gates_passed`에 spec.yaml의 `constraints.quality.required_gates` 모두 포함
- `features[].iterations_used <= harness.yaml.policies.max_iterations`
- `evidence.strategy`는 기록 시점 spec.yaml의 해당 feature `test_strategy`와 일치 (불일치 시 전략이 바뀌었다는 감사 신호)
- `evidence.artifacts`의 필수 필드는 `strategy` 값에 따라 위 표대로 검증 (JSON Schema의 `oneOf` 분기로 강제)
- **v2.3**: `features[].type == 'skeleton'`인 feature가 done이 아니면 다른 어떤 feature도 in_progress 불가 (prototype_mode 예외)
- **v2.3**: `required_gates`에 5가 포함되면 `evidence.smoke.verified_at`이 `evidence.artifacts`의 마지막 커밋보다 이후여야 함 (신선도)

### 5.6 `events.log` — 이벤트 스트림

**역할**: 하네스 내부에서 발생한 **모든 이벤트의 시계열 기록**. 디버깅, 감사, 진화 분석의 근거.

**형식**: JSON Lines (한 줄 = 한 이벤트).

**왜 state.yaml과 분리하는가**

- **성격이 다름**: state는 스냅샷, events는 스트림
- **크기 특성이 다름**: state는 작게 유지 (~수백 라인), events는 무한 성장
- **접근 패턴이 다름**: state는 핫 패스 (매번 읽음), events는 콜드 (감사 시에만)
- **편집 가능성이 다름**: state는 업데이트, events는 append-only

**구조**:

```jsonl
{"ts":"2026-04-20T10:00:00Z","event":"feature_started","feature_id":"F-001","agent":"orchestrator"}
{"ts":"2026-04-20T10:15:22Z","event":"agent_dispatched","feature_id":"F-001","subagent":"tdd-test-writer"}
{"ts":"2026-04-20T10:20:11Z","event":"gate_passed","feature_id":"F-001","gate":0,"evidence":{"red_sha":"abc123"}}
{"ts":"2026-04-20T10:30:15Z","event":"iteration_increment","feature_id":"F-001","from":1,"to":2,"reason":"test_failure"}
{"ts":"2026-04-20T10:45:00Z","event":"feature_completed","feature_id":"F-001","commit_sha":"def456"}
{"ts":"2026-04-20T11:00:00Z","event":"spec_refined","hash_before":"aaa","hash_after":"bbb","by":"user"}
{"ts":"2026-04-20T11:05:00Z","event":"harness_evolved","changes":["added_feature:F-007","updated_gate:2"]}
```

**이벤트 종류** (초기 설계):

| 이벤트 | 트리거 |
|--------|--------|
| `feature_started` | 피처 작업 시작 |
| `feature_completed` | 피처 Gate 4 통과 + Gate 5 통과 (v2.3: Gate 5 포함) |
| `feature_blocked` | 에스컬레이션 |
| `agent_dispatched` | 서브에이전트 실행 (integrator 포함) |
| `agent_returned` | 서브에이전트 완료 |
| `gate_passed` | Gate 통과 |
| `gate_failed` | Gate 실패 |
| `iteration_increment` | iteration 카운터 증가 |
| `hook_blocked` | 훅이 액션 차단 |
| `spec_refined` | spec.yaml 수정 |
| `harness_evolved` | `/harness:sync` 델타 모드 실행 |
| `audit_completed` | `/harness:check` 완료 |
| `build_committed` | `.claude.tmp/` → `.claude/` 원자 교체 완료 |
| `build_rolled_back` | 빌드 트랜잭션 롤백 |
| `handoff_enqueued` | `_workspace/handoff/inbox/` 메시지 적재 |
| `handoff_processed` | `inbox` → `archive` 이동 |
| `events_log_rotated` | 로테이션 실행 |
| **`build_succeeded`** (v2.3) | integrator가 실행한 `build_command` exit 0 |
| **`build_failed`** (v2.3) | integrator가 실행한 `build_command` 실패 — Gate 5 차단 |
| **`smoke_passed`** (v2.3) | smoke_scenarios 전부 통과 — Gate 5 통과 증거 |
| **`smoke_failed`** (v2.3) | 시나리오 중 하나라도 실패 — feature blocked |

**로테이션**: 파일 크기가 `policies.events_log.rotation_size_mb` 초과 시 `events-{YYYYMMDD-HHMMSS}.log.gz`로 압축.

- **책임 주체**: `session-start-bootstrap.mjs` 훅 (세션 시작 시 크기 체크)
- **보조 트리거**: `/harness:status` 실행 시 크기 체크 (훅 누락 복구용)
- **수동 강제**: `/harness:events --rotate`
- **보존 기간**: `policies.events_log.retention_days` 초과 시 삭제 (기본 90일)
- **실패 정책**: 로테이션 실패는 로그에 `events_log_rotated` 이벤트의 `error` 필드로 기록, 작업 중단하지 않음 (관측은 중요하지만 운영을 막아선 안 됨)

### 5.7 `hooks/` — 훅 스크립트

**역할**: Claude Code의 훅 이벤트에 반응하는 Node.js 스크립트. `.claude/settings.json`이 상대 경로로 참조.

**구성**:

| 파일 | 이벤트 | 목적 |
|------|--------|------|
| `pre-tool-security-gate.mjs` | PreToolUse(Bash) | 위험 명령어 차단 |
| `pre-tool-doc-sync-check.mjs` | PreToolUse(Bash) | export 변경 시 문서 동기화 강제 |
| `pre-tool-coverage-gate.mjs` | PreToolUse(Bash) | 커버리지 미달 시 커밋 차단 |
| `post-tool-format.mjs` | PostToolUse(Write/Edit) | 자동 포매팅 |
| `post-tool-test-runner.mjs` | PostToolUse(Write/Edit) | 관련 테스트 자동 실행 |
| `session-start-bootstrap.mjs` | SessionStart | state.yaml ↔ spec.yaml 일관성 검증 (shallow 범위). 스키마 로드 실패·해시 계산 오류 등은 fail-open(`hook_error` 기록 후 세션 계속). 단 `state.yaml.current.feature_id`가 spec에 부재한 경우는 **경고만 출력**하고 차단하지 않음 — 세션 시작에서 사용자 작업 맥락을 끊지 않기 위함. 실제 차단은 `/harness:work` 진입 시 동일 검증이 다시 수행되어 일어남 |

**I/O 계약**:
- shebang: `#!/usr/bin/env node`
- stdin: JSON (Claude Code 훅 입력)
- exit code: `0` = 통과(경고 포함), `2` = 차단, 기타 = 훅 오류 (통과, 즉 fail-open)
- stderr: 차단 시 이유 메시지 (사용자에게 노출)
- stdout: 구조화 로그 (events.log로 append, JSON Lines)

**실행 환경 계약** (v2.1 신설):
- **Node.js 버전**: `>=20.0.0` (package.json의 `engines.node`에 명시). ESM (`.mjs`) 기본.
- **의존성 원칙**: **zero-dependency** — Node.js 빌트인만 사용 (fs, path, child_process, crypto). 외부 패키지 금지.
  - 예외적 필요 시 `.harness/hooks/package.json`에 명시하고 `npm ci` 단계를 `/harness:init` 흐름에 포함
- **실행 권한**: git은 executable bit를 보존하지 않으므로 shebang에 의존하지 말고 `.claude/settings.json`의 `command`에서 `"node .harness/hooks/xxx.mjs"`로 명시 호출 권장
- **작업 디렉터리**: Claude Code가 프로젝트 루트에서 훅을 실행 (`process.cwd()` === 프로젝트 루트 보장)
- **타임아웃**: 각 훅은 **5초 이내** 종료 권장. 초과 시 Claude Code가 강제 종료 가능
- **병렬성**: 같은 이벤트의 여러 훅은 순차 실행 (race condition 회피)
- **fail-open 원칙**: 훅 자체 버그(exit != 0, 2)는 **작업을 막지 않음** — 운영 중단보다 관측성 상실이 덜 해롭다는 판단. 대신 `hook_error` 이벤트를 로그로 남김

**`.claude/settings.json`에서의 참조 예시**:

```json
{
  "hooks": [
    {
      "event": "PreToolUse",
      "matcher": {"tool_name": "Bash"},
      "command": "node .harness/hooks/pre-tool-security-gate.mjs",
      "timeout_ms": 5000
    },
    {
      "event": "PreToolUse",
      "matcher": {"tool_name": "Bash", "tool_input.command": "^git\\s+commit"},
      "command": "node .harness/hooks/pre-tool-doc-sync-check.mjs",
      "timeout_ms": 5000
    }
  ]
}
```

### 5.8 `protocols/` — 프로토콜 문서

**역할**: TDD 사이클, iteration 규칙, doc-sync 규칙 등 **에이전트가 명시적으로 참조하는 문서**. 에이전트 프롬프트에 이 파일들의 경로와 앵커가 포함됨.

**왜 `.claude/agents/` 안에 포함하지 않는가**

에이전트 정의 파일(`.claude/agents/*.md`)은 Claude Code가 자동 로드하므로 짧게 유지해야 합니다. 상세 프로토콜은 별도 파일로 분리하여 에이전트가 **필요할 때 읽도록** 하는 것이 컨텍스트 효율적입니다. (Anthropic Skills의 progressive disclosure와 같은 원리.)

**구성**:

| 파일 | 내용 |
|------|------|
| `tdd-cycles.md` | lean-tdd, tdd, state-verification, integration 각각의 사이클 정의 + 전략별 Gate 0 계약 |
| `iteration-convergence.md` | 5회 상한, 에스컬레이션 규칙 |
| `code-doc-sync.md` | export 변경 감지 알고리즘, doc_sync 타깃 매칭 규칙 |
| `session-management.md` | 세션 시작/재개, 체크포인트 |
| `message-format.md` | 핸드오프 파일의 envelope 포맷, 큐 패턴 세부 |
| `anti-rationalization.md` | **모든 스킬이 참조하는 공통 변명-반박 규칙** (v2.1 신설, SSoT 준수) |

**앵커 규약** (v2.1 통일): 마크다운 헤딩 앵커만 사용. 에이전트는 `{파일경로}#{heading-slug}` 형식으로 참조.

- 헤딩 텍스트 변경 내성이 필요한 영역은 명시적 ID 속성으로 고정:
  ```markdown
  ## Red Phase Contract {#red-phase-contract}
  ```
- 헤딩 텍스트가 바뀌어도 `#red-phase-contract` 링크는 유지
- HTML 주석 `<!-- anchor: slug -->`는 마크다운 뷰어가 인식하지 못하므로 **폐기** (v2.0 결함 수정)
- `/harness:check`이 "참조된 앵커가 실제 존재하는가"를 검증

---

## 6. Claude Code 어댑터 — `.claude/`

### 6.1 역할

`.claude/` 디렉터리는 **Claude Code 런타임에 대한 어댑터**입니다. `.harness/`의 메타 자산을 Claude Code가 이해할 수 있는 형식으로 노출합니다.

### 6.2 `.claude/settings.json`

훅 구성 파일. `.harness/hooks/*.mjs`를 상대 경로로 참조.

```json
{
  "$schema": "https://code.claude.com/schemas/settings.json",
  "hooks": [
    {
      "event": "SessionStart",
      "command": ".harness/hooks/session-start-bootstrap.mjs"
    },
    {
      "event": "PreToolUse",
      "matcher": {"tool_name": "Bash"},
      "command": ".harness/hooks/pre-tool-security-gate.mjs"
    },
    {
      "event": "PreToolUse",
      "matcher": {"tool_name": "Bash", "tool_input.command": "git\\s+commit"},
      "command": ".harness/hooks/pre-tool-doc-sync-check.mjs"
    },
    {
      "event": "PreToolUse",
      "matcher": {"tool_name": "Bash", "tool_input.command": "git\\s+commit"},
      "command": ".harness/hooks/pre-tool-coverage-gate.mjs"
    },
    {
      "event": "PostToolUse",
      "matcher": {"tool_name": "Write|Edit"},
      "command": ".harness/hooks/post-tool-format.mjs"
    }
  ]
}
```

### 6.3 `.claude/agents/`

서브에이전트 정의 파일. Claude Code가 세션 시작 시 자동 검색 (`.claude/agents/` + `~/.claude/agents/` + 플러그인 + 세션).

**구조 예시** (`.claude/agents/tdd-implementer.md`):

```markdown
---
name: tdd-implementer
description: TDD Green phase only. Writes minimal code to pass failing tests. Does not write new tests.
tools: Read, Glob, Grep, Write, Edit, Bash
model: sonnet
effort: medium
---

# TDD Implementer (Green Phase)

## Context
You are invoked during the Green phase of a TDD cycle. Failing tests already exist.
Your job: write the minimum code to turn every failing test green.

## Rules
- Read tests first to understand expected behavior
- Write only the minimal code to pass tests
- No over-abstraction
- Apply Comment Rules from `.harness/protocols/code-style.md#comment-rules`
- Return: implementation file paths + test results

## Process
See `.harness/protocols/tdd-cycles.md#cycle-tdd` for the full cycle.

## Forbidden
- Writing new tests (that's tdd-test-writer's job)
- Modifying existing tests (breaks Gate 0 evidence)
- Refactoring (that's tdd-refactorer's job)
```

**생성 규칙**:
- 에이전트 파일 본문은 **간결하게** (Claude Code가 자동 로드하므로 컨텍스트 비용)
- 상세 절차는 `.harness/protocols/`에 두고 앵커로 참조
- `description` 필드는 라우팅 키 — "TRIGGER when" 조건 명시
- `model` 필드는 `harness.yaml`의 agent 설정과 일치

#### 6.3.1 에이전트별 Tool 권한 매트릭스 (v2.1 신설)

Tool 권한은 **에이전트의 역할 경계이자 보안 경계**입니다. build 단계에서 아래 표를 기본값으로 사용하며, `harness.yaml.agents[].tools_override`로 조정 가능합니다.

| 에이전트 | Read | Glob | Grep | Write | Edit | Bash | WebFetch | Task (dispatch) | 근거 |
|---------|:----:|:----:|:----:|:-----:|:----:|:----:|:--------:|:---------------:|------|
| `orchestrator` | ✅ | ✅ | ✅ | ❌ | ❌ | ⚠️ | ❌ | ✅ | 조정자. 직접 코드 수정 금지. Bash는 읽기성(`git status`, `ls`)만 `pre-tool-security-gate`로 제한 |
| `architect` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | 설계 문서 작성. 코드 실행 불필요. 외부 참고 자료 조회 허용 |
| `implementer` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | 일반 구현. 커밋까지 수행. 외부 네트워크는 차단해 재현성 보장 |
| `tdd-test-writer` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Red 단계. 테스트 실행으로 실패 확인까지 Bash 필요 |
| `tdd-implementer` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Green 단계. 테스트 실행 필수. **테스트 파일 수정은 Forbidden 규칙으로 차단** |
| `tdd-refactorer` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | Refactor. 테스트 통과 유지 확인 위해 Bash 필요 |
| `bdd-writer` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | 시나리오 작성. 실행 불필요 |
| `tester` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | 테스트 작성·실행. `state-verification`/`integration` 전략 담당 |
| `reviewer` | ✅ | ✅ | ✅ | ❌ | ❌ | ⚠️ | ❌ | ❌ | 리뷰는 **읽기 전용**. Bash는 `git diff`, `git log` 등 읽기성만 허용 |
| `debugger` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | 디버깅 시 코드 수정 및 실행 모두 필요 |
| `qa-agent` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | 품질 검증. 코드 수정 금지, 실행은 허용 |
| **`integrator`** (v2.3) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | **조립 + 빌드 + smoke 실행 책임**. 각 feature 완료 시 exports를 main·DI·라우터에 wire-up. build_command 실행 및 entry_point 기동 필요 → Bash 필수 |

**범례**: ✅ 허용 / ❌ 차단 / ⚠️ 제한적 (`pre-tool-security-gate.mjs`가 allowlist로 세부 필터)

**integrator 에이전트 상세** (v2.3 신설):

```markdown
---
name: integrator
description: Wire-up agent. Called after each feature's Gate 4 to assemble exports into main/DI/router, then build + run + smoke. Blocks the feature if Gate 5 fails.
tools: Read, Glob, Grep, Write, Edit, Bash
model: sonnet
effort: medium
---

# Integrator (Assembly & Runtime Verification)

## Context
You are invoked AFTER a feature passes Gate 4 (commit), BEFORE it can be marked done.
Your job: ensure the feature is actually wired into the application and the whole
thing still runs.

## Process
1. Read the just-committed feature's module exports (from architecture.yaml)
2. Identify assembly points: main entry file, DI container, router, config
3. Wire the new exports in (minimal, idiomatic for the framework)
4. Run `build_command` from spec.deliverable.entry_points[]
   - If fails → emit `build_failed` event, mark feature blocked, explain root cause
5. Start the entry_point, wait for health_check
   - If fails → emit `smoke_failed`, mark blocked
6. Run spec.deliverable.smoke_scenarios
   - Each scenario: execute steps, verify success_criteria
   - If any fails → emit `smoke_failed`, mark blocked
7. On all pass: emit `build_succeeded` + `smoke_passed`, record evidence.smoke

## Forbidden
- Modifying feature code to make smoke pass (that's a cop-out — root cause the issue)
- Skipping smoke_scenarios (prototype_mode is the only legitimate escape)
- Silently ignoring warnings (surface them to the user)
```

**제한적 Bash의 allowlist 규칙** (security gate의 일부):

```javascript
// .harness/hooks/pre-tool-security-gate.mjs 내부 로직 요약
const READ_ONLY_BASH = [
  /^git\s+(status|log|diff|show|branch|remote)\b/,
  /^ls\b/, /^cat\b/, /^grep\b/, /^find\b/, /^wc\b/,
  /^pwd\b/, /^which\b/,
  /^node\s+--version\b/, /^npm\s+(ls|list|view|outdated)\b/,
];
// agent = orchestrator | reviewer 이고 command가 위 패턴과 매칭되지 않으면 exit 2
```

**변경 감사**: `harness.yaml.agents[].tools_override`가 기본값과 달라지면 `/harness:check`이 경고 (보안 경계 완화는 명시적 승인 유도).

### 6.4 `.claude/skills/`

Agent Skills 파일. Anthropic 공식 포맷 준수.

**구조**: 각 스킬은 디렉터리. `SKILL.md` 필수, `references/`·`scripts/`·`assets/` 선택.

**7-섹션 anatomy** (harness-boot v1에서 유지):
1. Overview
2. When to Use
3. TDD Focus (선택)
4. Process
5. Common Rationalizations (필수 2행 이상)
6. Red Flags
7. Verification

### 6.5 CLAUDE.md (프로젝트 루트)

**역할**: Claude Code 세션 시작 시 자동 로드되는 프로젝트 컨텍스트. v2에서 얇은 import 파일로 축소.

**내용**:

```markdown
# Project Context

@.harness/spec.yaml
@.harness/domain.md
@.harness/architecture.yaml

## Harness Configuration

This project is managed by harness-boot v2. Key documents:

- Product spec: `.harness/spec.yaml`
- Domain knowledge: `.harness/domain.md`
- Architecture rules: `.harness/architecture.yaml`
- Current state: `.harness/state.yaml`
- Protocols: `.harness/protocols/`

## Development Flow

1. Start any session with `/harness:status` — shows state + suggested next action
2. Feature work: `/harness:work` (continues current feature or picks next)
3. Follow the `test_strategy` defined per feature in spec.yaml
4. Gates 0-4 (optionally 5) are enforced; see `.harness/protocols/tdd-cycles.md`
5. All changes must pass coverage and doc-sync gates

## Escalation

If iteration count reaches max (see `.harness/harness.yaml`), escalate to the user
with a summary of blockers.
```

**크기 제한**: 1,500 토큰 이하. import 문이 대부분이므로 실제 문자는 적음.

---

## 7. 명령어 체계

### 7.1 설계 원칙 — 학습 장벽 최소화 (v2.0 → v2.1, v2.3.3 보정)

v2.0 초안은 8개 명령(`init`/`spec`/`build`/`start`/`refine`/`audit`/`evolve`/`status`)에 관측 도구 2개를 추가해 총 10개였습니다. 신규 사용자의 학습 부담이 과도하다는 지적이 있었습니다. v2.1은 **사용자 의도 단위로 통합**하는 세 규칙을 따랐습니다.

1. **같은 의도는 하나의 명령**: `spec`·`refine`은 모두 "제품을 설명하는 행위" → `/harness:spec` 하나로 통합. 현재 `.harness/` 상태에 따라 내부 모드가 자동 판별됩니다.
2. **같은 산출물은 하나의 명령**: `build`·`evolve`는 모두 "spec에 맞춰 하네스를 갱신" → `/harness:sync` 하나로 통합. 전체 빌드/델타 업데이트는 해시 트리로 자동 선택.
3. **진단은 별 티어로**: `check`·`events`·`metrics`는 일상 흐름이 아니라 관측 성격이므로 **진단 티어**로 분리. 학습 우선순위에서 뒤로.

**v2.3.3 보정 — `init` 복원**:

v2.1 초안에서 `init`을 `status`에 흡수("상태 기반 자동 init")시켰으나, 이는 **두 원칙을 위반**했습니다:

- **CQS (Command-Query Separation)**: `status`는 조회 명령인데 디렉터리 생성이라는 변경을 수행 → 놀람 요소
- **Transparency-by-Preamble (v2.3.1)**: "status를 쳤는데 몰래 init이 일어남"은 이 원칙이 막으려던 바로 그 안티패턴
- **업계 관행**: `npm init`, `git init`, `cargo new`, `uv init` 등 모든 도구가 명시적 초기화 명령을 가짐. 명시성이 표준

v2.3.3은 `/harness:init`을 **1급 명령으로 복원**합니다. 대신 사용 빈도가 "프로젝트당 1회"이므로 **Tier 1-init**이라는 별도 구분으로 일상 명령과 학습 우선순위를 분리합니다.

결과: **일상 명령 3개 + 일회성 init 1개 + 진단 3개 = 7개**. 학습 총량은 v2.1과 동일(외형상 +1)이지만 **의도와 구현이 일치**하고 **놀람 요소가 제거**됩니다.

### 7.2 명령어 지도

**Tier 1-init — 일회성 (1개)**:

| 명령어 | 사용자 의도 | 실행 빈도 |
|--------|------------|----------|
| `/harness:init` | "새 프로젝트에 하네스 설치" | 프로젝트당 **1회** |

**Tier 1 — 일상 (3개)**:

| 명령어 | 사용자 의도 | 통합된 v2.0 명령 |
|--------|------------|-----------------|
| `/harness:spec` | "제품을 설명한다" | `spec` + `refine` |
| `/harness:sync` | "하네스를 spec에 맞춘다" | `build` + `evolve` |
| `/harness:work` | "피처 개발 사이클 실행" | `start` (이름만 변경) |

**Tier 2 — 진단 (4개, v2.3.3에서 status 이동)**:

| 명령어 | 사용자 의도 |
|--------|------------|
| `/harness:status` | "어디 있지?" — **순수 읽기 전용** (v2.3.3 환원) |
| `/harness:check` | 일관성 검증 (was `audit`) |
| `/harness:events` | 이벤트 로그 조회 |
| `/harness:metrics` | 집계 지표 |

**학습 경로**: 신규 사용자는 처음 딱 한 번 `/harness:init` → 그 후 `/harness:spec` → `/harness:sync` → `/harness:work` 선형 흐름. 진단 명령은 문제가 생겼을 때 비로소 탐색합니다. `status`는 "지금 상태가 어떻지?"를 확인하고 싶을 때 언제든 호출 가능한 읽기 전용 도구입니다.

### 7.3 명령어 상세

#### 7.3.1 `/harness:init` — 하네스 설치 (Tier 1-init, v2.3.3 복원)

**입력**: 없음 | 선택 `--here` (현재 디렉터리 강제, 확인 생략)

**실행 빈도**: 프로젝트당 1회. 이미 `.harness/`가 존재하면 에러로 거부 (사용자 데이터 보호).

**동작**:

1. **선조건 검사**:
   - 현재 디렉터리에 `.harness/`가 존재하면 "이미 설치됨. `/harness:status`로 상태 확인" 에러 후 종료
   - 현재 디렉터리가 프로젝트 루트인지 확인 (git 레포 최상단 권장, `--here`로 강제 가능)

2. **협업 정책 선택지** (번호 선택, one question at a time):
   ```
   🌱 /harness:init · fresh · 빈 프로젝트에 하네스 설치
   
   이 프로젝트의 협업 방식을 선택하세요:
     1. ★ 팀 협업 — state.yaml은 gitignore (브랜치별 current 충돌 회피)
     2. 단독 개발 — state.yaml을 커밋 (작업 이력 추적)
   선택:
   ```
   결과를 `harness.yaml.policies.state_git_policy`에 기록

3. **스켈레톤 파일 생성** (atomic):
   - `.harness/spec.yaml` — 빈 템플릿 (2.1의 `$schema` 지시자 + 각 섹션 placeholder)
   - `.harness/harness.yaml` — 기본 설정 (해시 트리 초기화, policies 입력 반영)
   - `.harness/state.yaml` — 빈 상태 (features: [], current: null)
   - `.harness/events.log` — 빈 파일 + 첫 이벤트 `harness_initialized`
   - `CLAUDE.md` — import 전용 얇은 템플릿 (1,500 토큰 이하)

4. **`.gitignore` 업데이트** (4.3 git 정책 표 반영):
   - 없으면 새로 생성, 있으면 `.harness/_workspace/`, `.harness/events.log` 등 추가
   - `state.yaml`은 2단계 선택에 따라 조건부 추가

5. **완료 안내**:
   ```
   ✅ 하네스 설치 완료
   
   생성된 파일:
     .harness/spec.yaml         (빈 템플릿 — 다음 단계에서 채움)
     .harness/harness.yaml
     .harness/state.yaml
     .harness/events.log
     CLAUDE.md
   
   다음 할 일:
     ★ /harness:spec — 제품 명세 작성 (아이디어 기반 대화형)
       /harness:spec --from plan.md — 기존 기획문서가 있는 경우
   ```

**출력**: 완전히 초기화된 `.harness/` 디렉터리. Phase 0 파생은 수행하지 않음 (spec.yaml이 비어 있으므로 나중에 `/harness:sync`가 담당).

**실패 시 복원**: init은 단일 트랜잭션 — 중간 실패 시 `.harness/` 통째로 제거. 원자성 보장.

#### 7.3.2 `/harness:spec` — 제품 설명 (spec + refine 통합)

**전제 조건**: `/harness:init`이 이미 실행되어 `.harness/` 스켈레톤이 존재해야 함. 없으면 "먼저 `/harness:init`을 실행하세요" 에러.

**입력**: 선택 `--from <path>` (기획문서 경로)

**자동 모드 판별**:

| 현재 상태 | 진입 모드 |
|----------|----------|
| `.harness/` 없음 | **에러** — `/harness:init` 먼저 실행 안내 |
| spec.yaml 최소 스켈레톤 | Mode A (인터뷰) 또는 `--from` 있으면 Mode B |
| spec.yaml 중간 완성 | Mode R (refine — 빈약 필드 우선) |
| spec.yaml 완성 | Mode E (편집 — 수정 영역 질문) |

**Mode A — 아이디어 인터뷰** (`--from` 없음):
1. 대화형 인터뷰 시작 (한 번에 한 질문 원칙)
2. project.name → project.summary → domain.overview → entities → features 순
3. 각 단계에서 spec.yaml에 점진적 기록
4. 사용자가 "충분하다" 선언 시 종료; `metadata.completeness` 기록
5. `metadata.source.origin: idea`

**Mode B — 기획문서 추출** (`--from plan.md`):

LLM 기반 추출은 **환각·누락·잘못된 구조화** 가능성을 피할 수 없습니다. v2.1은 이를 완화하는 다층 검증을 도입:

1. **추출 단계** (LLM 1차 호출):
   - 구조화된 spec.yaml 초안 생성
   - 모든 항목에 **출처 라인 기록** (`metadata.source.source_lines[]`):
     ```yaml
     source_lines:
       - field_path: "features[0].acceptance_criteria[1]"
         source_file: "plan.md"
         source_range: [34, 38]
         confidence: medium
     ```
   - `confidence: high | medium | low` 태깅

2. **Round-trip 검증** (LLM 2차 호출):
   - 생성된 spec으로 plan.md 재구성 → 원본과 **BM25 유사도** 비교
   - 구현 명세 (v2.3.5):
     - 토크나이저: Unicode segmentation (한글·영문·숫자를 단어 단위로), 소문자화, Porter-lite stemming 영문 전용, 한글은 형태소 분석 없이 공백+조사 휴리스틱 분리 (`은/는/이/가/을/를/에/의/로/으로`를 말미에서 제거)
     - 불용어: 영문 NLTK 표준 목록 + 한글 빈용어 (`것, 수, 때, 등, 및`) 제거
     - BM25 파라미터: `k1 = 1.5`, `b = 0.75` (Lucene 기본값)
     - 비교 단위: **섹션 단위**(plan.md의 `##` 헤더로 구분된 블록)
     - 임계값: `0.55 이상 = high`, `0.35 이상 = medium`, `0.35 미만 = low`
   - 임계 미달 섹션은 `confidence: low`로 강등
   - 평가 결과는 `events.log`에 `mode_b_roundtrip_scored` 이벤트로 섹션별 점수와 함께 기록

3. **사용자 확인 큐**:
   - `low`/`medium` 항목 우선 번호 선택 질문
   - 각 질문에 원본 라인 인용 ("plan.md:34-38에서 이렇게 추출했습니다. 맞나요?")
   - `high`만 자동 수용

4. **추출 실패 fallback**:
   - LLM 응답 파싱 불가 → 최대 2회 재시도 (스키마 오류 피드백)
   - 여전히 실패 → Mode A로 자동 전환 + 이유 설명
   - 부분 성공(예: project만 추출)은 부분 기록 + 누락 영역만 Mode A 인터뷰

5. `metadata.source.origin: planning_doc`

**Mode R — Refine** (자동):
1. spec.yaml을 스캔해 빈약한 필드 찾기:
   - `acceptance_criteria`가 1행 이하
   - `domain.business_rules`가 비어 있음
   - `features[].tdd_focus`가 없는데 `test_strategy: tdd`
   - `modules[]`가 비어 있음
   - `completeness: low` 영역
2. 우선순위 높은 빈 곳부터 대화형 질문
3. 답변 반영

**Mode E — Edit** (자동):
1. 현재 spec을 간략히 표시 + "어느 영역을 수정하시겠어요?" 번호 선택
2. 선택된 영역의 대화형 부분 수정

**공통 출력**:
- spec.yaml 갱신 (JSON Schema 검증 통과 강제)
- `events.log`에 `spec_refined` 이벤트 (hash_before/after)
- 완료 시 제안: "spec 변경됨. `/harness:sync` 실행 권장."

#### 7.3.3 `/harness:sync` — 하네스 동기화 (build + evolve 통합)

**해시 의존성**: 이 명령의 모든 델타 판정(변경 감지·편집본 보존·해시 트리 순회)은 **부록 D — 해시 정규화 규약**을 전제로 합니다. 다른 구현과 해시 값이 일치해야 `--dry-run` 결과가 재현 가능합니다.

**입력**: 없음 | 선택:
- `--force` — 델타 감지 무시, 전체 재빌드 (v2.0 `build` 상당)
- `--dry-run` — 변경 계획만 표시, 실제 적용 안 함
- `--only <scope>` — 특정 영역만 (예: `--only features:F-003`, `--only modules:auth`)
- `--regenerate-derived[=domain,architecture]` — 파생 파일을 사용자 편집 무시하고 재생성 (편집본은 backup으로 보관, v2.2 신설)

**전제 조건**:
1. `.harness/spec.yaml`이 스키마 검증 통과
2. **부트스트랩 선조건** (C2 해결):
   - `state.yaml.session.active_agents`가 비어 있음
   - `_workspace/handoff/inbox/`에 미처리 메시지 없음
   - 위반 시 "진행 중인 작업이 있습니다" 에러

**실행 순서** (v2.2): 크게 두 단계.

**Phase 0 — 파생 파일 동기화** (v2.2 신설, 전체 빌드·델타 모드 공통 선행):

사용자가 편집하는 것은 spec.yaml 뿐이므로, **domain.md와 architecture.yaml은 sync 실행 시마다 재파생**됩니다. 단, 편집 존중 규칙에 따라 사용자 편집본은 보존됩니다.

0. **`$include` 확장** (v2.3.7 신설, Phase 0의 맨 앞):
   - `resolve_includes(spec.yaml) → expanded_spec` 수행
   - 처리 순서:
     1. spec.yaml을 파싱 (외부 참조는 아직 `$include` 객체 그대로)
     2. §5.1의 6개 검증 규칙 적용 (경로·크기·존재·standalone·타입 일치)
     3. 각 `$include` 객체를 외부 md 파일 내용으로 치환 (inline string으로 대체)
     4. 확장 결과를 **메모리 내 `expanded_spec` 객체**로 보관 (파일로 쓰지 않음)
     5. 각 include에 대해 다음을 계산:
        - `path`: 외부 md 파일의 상대 경로
        - `pointer`: JSONPath (예: `$.features[2].acceptance_criteria[1]`)
        - `output_hash`: 외부 md 파일 내용의 sha256
        - `byte_size`: 파일 바이트 크기
        - `resolved_at`: 현재 ISO8601
   - **드리프트 판정**:
     - 기존 `harness.yaml.generation.include_sources[]`와 비교
     - 동일 `path`의 `output_hash`가 다르면 → **외부 md 편집 감지**
     - `drift_status: include_changed`로 표시
     - Phase 1의 변경 영역 판정에 포함 (expanded_spec 기반으로 feature/domain/project 해시 재계산)
   - **실패 시**: 검증 규칙 위반은 fail-fast (sync 전체 중단). 에러 메시지에 위반 규칙·경로·크기 포함.
   - **이후 단계 입력**: Phase 0의 나머지 단계(domain.md/architecture.yaml 처리)와 Phase 1의 해시 비교는 모두 `expanded_spec`을 사용합니다. `spec.yaml` 원본은 `$include` 포인터를 보존한 그대로 남습니다.

1. **domain.md 처리**:
   - 현재 파일이 없거나 빈 파일 → 5.2 템플릿으로 파생
   - 현재 파일 해시 == `harness.yaml.derived_from.domain_md.output_hash` → **safe to regenerate**
     - spec.domain에서 재파생
     - 새 output_hash 저장
   - 현재 파일 해시 != output_hash → **사용자 편집 감지**
     - 파일 보존 (덮어쓰지 않음)
     - `derived_from.domain_md.user_edit_detected: true` 기록
     - 경고 출력: "⚠️ domain.md에 수동 편집 감지됨. spec 변경은 반영되지 않습니다. 재파생: `/harness:sync --regenerate-derived=domain`"
     - `events.log`에 `derived_preserved` 이벤트 기록

2. **architecture.yaml 처리**:
   - 기본 동일한 edit-wins 규칙
   - 단, 파생 실행 시 5.3의 **모호성 질문**이 발생할 수 있음:
     - 질문은 이미 답변된 것은 `derived_from.architecture_yaml.layer_assignments` / `user_decisions`에서 재사용
     - 새로운 모호 케이스만 사용자에게 질문
     - 답변은 즉시 `derived_from`에 누적 저장
   - `modules[].exports`는 파생 대상 아니므로 기존 값 보존 (코드 실행 중 발견됨)

3. **--regenerate-derived 플래그 처리**:
   - `--regenerate-derived` (인자 없음) → domain, architecture 모두 강제 재생성
   - `--regenerate-derived=domain` → domain.md만
   - `--regenerate-derived=architecture` → architecture.yaml만
   - 현재 파일 → `.harness.backup/{ts}/` 이동
   - 강제 재파생 실행
   - 출력: "✅ {파일}을 재생성했습니다. 기존 편집본은 `.harness.backup/{ts}/`에 보관되었습니다."

4. **Phase 0 출력 예시**:

```
🔄 /harness:sync · delta · spec.domain 변경 + architecture 편집 감지 + include 1건 변경

Phase 0: 파생 파일 동기화

$include 확장 (v2.3.7):
  ✅ 3개 참조 확장됨 (총 12KB)
  ⚠️ docs/spec/vision.md 변경 감지 (output_hash 상이)
     → $.project.description 재평가 → project 해시 변경

domain.md:
  ✅ 재생성됨 (spec.domain 변경 반영)

architecture.yaml:
  ⚠️ 수동 편집 감지 — 보존됨
  (spec에 F-007이 추가되었으나 architecture.yaml에 반영 안 됨)
  재파생을 원하면: /harness:sync --regenerate-derived=architecture

질문 1개 해결됨:
  Q. "notifications" 모듈을 어느 레이어에 배정할까요?
  → application (layer_assignments에 저장, 차기 sync에서 재질문 없음)

Phase 1로 진행...
```

---

**Phase 1 — 자동 분기** (해시 트리 진단, v2.1):

1. `harness.yaml.generation.generated_from.*.root_hash`와 현재 파일 해시 비교
2. 결과에 따라 분기:
   - **모두 일치** (Phase 0에서 아무것도 안 바뀜) → "이미 동기화됨" 메시지 후 종료 (`--force` 아닐 때)
   - **완전 불일치 또는 harness.yaml 없음** → **전체 빌드 모드**
   - **일부 영역만 불일치** → **델타 모드**

---

**전체 빌드 모드** (v2.0 `/harness:build` 상당):

`.claude/`까지 트랜잭션 범위 확장 (C2 해결):

1. **준비**:
   - 현재 `.harness/`, `.claude/` → `.harness.backup/{ts}/`, `.claude.backup/{ts}/` 보관
   - `.harness.tmp/`, `.claude.tmp/` 생성
2. **tmp에서 생성**:
   - spec.yaml + (Phase 0에서 결정된) architecture.yaml + domain.md 로드
   - `.harness.tmp/harness.yaml` 생성 (해시 트리 + derived_from 갱신, 5.4)
   - `.claude.tmp/agents/` 생성:
     - 공통: orchestrator, implementer, reviewer, tester, architect, debugger
     - 조건부 (`condition` enum 평가):
       - `has_tdd` → tdd-test-writer, tdd-implementer, tdd-refactorer
       - `has_lean_tdd` → bdd-writer
       - `has_sensitive_entity` → qa-agent
     - 모듈 특화 implementer (architecture.yaml의 모듈별)
     - 6.3.1의 tool 권한 매트릭스 적용
   - `.claude.tmp/skills/` 생성 (5종 그대로 복사 + 3종 변수 치환)
   - `.harness.tmp/hooks/` 생성
   - `.harness.tmp/protocols/` 생성 (anti-rationalization.md 포함)
   - `.claude.tmp/settings.json` 작성 (훅 `node <path>` 명시 호출 형식)
3. **검증** (커밋 전):
   - 모든 YAML에 JSON Schema 검증
   - 앵커 참조 무결성 검증 (서브셋 of `/harness:check`)
   - 실패 시 tmp 정리 + 에러 (원본 무손상)
4. **원자 교체** (순서 중요):
   - `.harness/` 교체 먼저 (훅 스크립트 원본이 여기 있으므로)
   - `.claude/` 교체 (settings.json이 훅 경로 참조)
5. **사후**:
   - `events.log`에 `build_committed` 이벤트 + root_hash before/after
   - **세션 재시작 권장 메시지 출력** — Claude Code가 기존 세션에 로드한 에이전트/스킬 정의는 즉시 반영되지 않을 수 있음을 사용자에게 고지

**실패 시 롤백**: `.harness.backup/{ts}/`, `.claude.backup/{ts}/`에서 복원. `build_rolled_back` 이벤트 기록.

---

**델타 모드** (v2.0 `/harness:evolve` 상당, 해시 트리 기반):

1. **변경 감지** — 해시 트리 diff:
   - root_hash 비교로 변경 영역 빠른 판정 (spec 영역만 대상. architecture/domain은 Phase 0에서 이미 처리)
   - 불일치 영역 재귀 순회:
     - `spec.features` 트리 → 추가/삭제/수정된 feature id 집합
     - `tech_stack_hash` 단독 → 전 스킬 compatibility 갱신
     - `domain_hash` 단독 → 도메인 참조 에이전트만 재생성 (domain.md는 Phase 0이 이미 재파생)
     - `pattern_hash` 변경 감지 시 → architecture.yaml의 대규모 재파생 필요 → **전체 빌드 모드로 에스컬레이션** (사용자 확인 필수)

2. **영향 범위 매핑**:

   | 변경 | 재생성 대상 |
   |------|-------------|
   | `features[F-003]` 수정 | F-003 관련 스킬 변수 치환분 / state.yaml 해당 엔트리 evidence 검증 |
   | `features` 추가 | state.yaml pending 엔트리 추가, 필요 시 모듈 특화 implementer 추가 |
   | `features` 삭제 | done이면 archive 이동, 아니면 state 엔트리 제거 |
   | `tech_stack` 변경 | 모든 skill compatibility 갱신 + 관련 hook 재생성 |
   | `modules[auth]` 참조 변화 | Phase 0에서 architecture 업데이트 → auth 특화 implementer 프롬프트 재생성 |
   | `pattern` 변경 | **전체 빌드 경고** → 사용자 확인 후 `--force` 권장 |
   | `domain` 변경 | Phase 0에서 domain.md 재파생됨 → 도메인 참조 에이전트 재생성 |

3. **계획 제시** (번호 선택):
   ```
   변경 3건 감지:
     • F-003 수정 (acceptance_criteria)
     • F-007 추가
     • tech_stack.framework: Next.js 14 → 15
   
   적용 방식:
     1. ★ 모두 적용
     2. 개별 선택
     3. --dry-run 리포트만
     0. 취소
   ```

4. **델타 적용** (트랜잭션 부분 적용):
   - `.harness.tmp/`, `.claude.tmp/`를 현재 상태로 복사 후 **델타 파일만** 덮어씀
   - `.claude/agents/`, `.claude/skills/` 등 **생성물**에 대한 사용자 수동 편집은 **edit-wins 규칙 적용** (v2.2 통일):
     - 파일 해시 == `generated_from`에 기록된 output_hash → 재생성
     - 파일 해시 != output_hash → 보존 + 경고
     - 강제 재생성은 `--force` 또는 `--regenerate-agents` 같은 명시적 플래그

5. **해시 트리 갱신**:
   - 변경된 노드만 재계산 (나머지 불변)
   - root_hash 최종 재계산

6. **원자 교체** (전체 빌드와 동일 절차)

7. `events.log`에 `harness_evolved` 이벤트:
   - 변경 노드 목록
   - 재생성 파일 목록
   - 편집 존중으로 건너뛴 파일 (있다면)

**출력 예시**:
```
🔄 /harness:sync · delta · 3 changes applied

📦 Synced: 3 changes applied

Applied:
  ✅ F-003 updated (.claude/agents/auth-implementer.md 재생성)
  ✅ F-007 added (state.yaml 엔트리, api-endpoint skill)
  ✅ tech_stack.framework (8 skills compatibility 갱신)

Preserved (edit-wins):
  ⏸ .claude/agents/orchestrator.md (사용자 편집 감지)

다음 할 일:
  1. ★ /harness:work — 다음 피처 진행
```

**부분 실패 처리** (v2.3.5 구체화):

델타 적용 중 일부 변경이 검증에 실패한 경우의 복구 알고리즘 — staging 디렉터리(`.harness.tmp/`, `.claude.tmp/`)가 원자 교체 전 모든 중간 상태를 담고 있다는 점을 활용합니다.

1. **스테이징 분리 커밋**: 각 델타 변경은 staging에 **개별 그룹**으로 적용 (한 변경 = 한 그룹의 파일 집합). 그룹 단위로 파일 목록을 `.harness.tmp/_delta_manifest.json`에 기록.
2. **그룹별 검증**: 각 그룹 적용 직후 다음 검증 실행:
   - 스키마 유효성 (해당 그룹이 변경한 YAML에 대해 JSON Schema)
   - 해시 트리 로컬 일관성 (그룹 경로의 서브트리 해시 재계산 결과가 매니페스트와 일치)
   - agents·skills 경로의 파일 존재(재생성이 실제로 수행됨)
3. **성공 그룹 마킹**: `_delta_manifest.json.groups[gid].status = "staged_ok"`.
4. **실패 그룹 롤백**:
   - 해당 그룹이 만들어낸 파일 변경만 staging에서 되돌림 (원본은 `.harness/`, `.claude/`에 그대로 존재, staging에서 restore).
   - `status = "rolled_back"`, `error: {message, path}`를 매니페스트에 기록.
   - 의존 그룹(e.g., A 그룹이 만든 심볼을 B 그룹이 참조)은 "의존자 전파 롤백"을 수행. 매니페스트의 `depends_on` 그래프에서 실패 노드의 역방향 도달 가능 집합을 모두 롤백.
5. **원자 교체 조건**: `status ∈ {staged_ok}` 그룹이 1개 이상이면 원자 교체 진행. 전부 실패면 staging을 통째로 버리고 기존 상태 유지.
6. **사후 기록**: events.log에 `delta_partial_applied` 이벤트 — `{applied_groups: [...], rolled_back_groups: [...], reasons: [...]}`.
7. **재시도 가이드**: 다음 `/harness:sync` 실행 시 `_delta_manifest.json`을 읽어 "이전 실행에서 롤백된 그룹 {gid}가 있습니다. `--retry-group {gid}` 또는 `--force`로 재시도하세요." 안내.
8. **일관성 보증**: 롤백 경로에서도 해시 트리는 **원자적으로만** 갱신(부분 적용된 서브트리 해시는 root_hash에 반영되지 않음). drift 검출이 손상된 중간 상태를 후속에서 정리.

#### 7.3.4 `/harness:work` — 피처 개발 사이클

**입력**: 선택 `--feature <id>` (특정 피처 지정) 또는 `--auto` (자동 진행)

**동작 (v2.3 확장)**:

1. **세션 일관성 검증**: session-start-bootstrap 훅이 state.yaml 일관성 검증 (spec.yaml과 조인)

2. **Walking Skeleton 선조건** (v2.3 신설):
   - 아직 `type: skeleton` feature가 done이 아니면, `--feature`로 명시하지 않는 한 **skeleton feature를 강제 선택**
   - `constraints.quality.prototype_mode: true`일 때만 예외 (이하 본 문서에서 prototype_mode는 항상 이 경로를 가리킴)

3. **피처 선택** (skeleton 완료 이후):
   - `state.yaml.current`가 비어 있으면: `status: pending` + `depends_on` 모두 `done`인 것 중 `priority` 최소
   - 여러 개면 번호 선택지 제시 (auto 모드 아닐 때)

4. **구현 사이클** — 선택된 피처의 `test_strategy`에 맞게:
   - `lean-tdd`: Design → Implement → BDD-Verify → Refactor
   - `tdd`: Red → Green → Refactor
   - `state-verification`: Implement → State-Test → Refactor
   - `integration`: Implement → Integration-Test

5. **Gate 0~4 순차 검증** (기존):
   - 실패 시 `iteration++`, 5회 도달 시 에스컬레이션

6. **integrator 에이전트 dispatch** (v2.3 신설 — Gate 4 통과 직후, Gate 5 직전):
   - integrator가 새 feature의 exports를 조립 (main·DI·라우터)
   - `spec.deliverable.entry_points[].build_command` 실행
     - 성공 → `build_succeeded` 이벤트
     - 실패 → `build_failed` 이벤트, feature `blocked` (root cause 분석 포함)
   - `entry_points[].health_check` 통과 대기 (timeout_seconds 이내)
   - `deliverable.smoke_scenarios` 전체 실행
     - 전부 통과 → `smoke_passed` 이벤트
     - 하나라도 실패 → `smoke_failed`, feature `blocked`

7. **Gate 5 판정**:
   - build_succeeded + smoke_passed 모두 있으면 Gate 5 통과
   - `state.yaml.features[].evidence.smoke` 기록 (verified_at, build_sha, scenarios_passed)
   - `constraints.quality.prototype_mode: true`일 때는 Gate 5 스킵 허용 (`evidence.smoke: { skipped: true, reason: "prototype_mode" }`)

8. **완료 처리**:
   - Gate 0~5 전부 통과 → `state.yaml.features[].status: done` + 단일 커밋 생성
   - `feature_completed` 이벤트

**auto 모드**: Gate 0~5 중 어느 것이 실패하거나 사용자 개입이 필요할 때만 중단. Gate 5 실패는 **자동 진행 중단 + 원인 분석 출력** — 절대 다음 피처로 넘어가지 않음 (v1.0 재발 방지).

**출력 예시** (Gate 5 실패 시):
```
🛠 /harness:work · blocked · F-003 Gate 5 실패 (smoke scenario SS-002)

❌ F-003 blocked at Gate 5

Build: ✅ succeeded
Health check: ✅ passed (http://localhost:3000 → 200)
Smoke scenarios:
  ✅ SS-001 (홈페이지 로드)
  ❌ SS-002 (로그인 → 대시보드 이동)
     Expected: /dashboard URL 도달
     Actual:   500 Internal Server Error
     Cause:    integrator가 AuthService를 DI 컨테이너에 등록했으나
               SessionMiddleware가 등록되지 않음. main.ts:42 참조.

Suggested fix: integrator 재dispatch 또는 F-003 수동 디버깅
Next: /harness:work --feature F-003 (blocked 상태에서 재시도)
```

#### 7.3.5 `/harness:check` — 일관성 검증 (진단)

**입력**: 선택 `--fix` (자동 수정), `--deep` (LLM 기반 의미 검증), `--execute-smoke` (v2.3: 빌드·실행 재수행, 느림)

**동작** — 다층 일관성 검증:

**사전 조건**: architecture.yaml·domain.md이 존재하지 않으면(첫 sync 이전) 해당 레이어 검증은 건너뛰고 "⚠️ 아직 동기화되지 않음. `/harness:sync` 실행 권장" 경고만 표시.

**0. 실행 가능성** (v2.3 신설, **최우선 표시**) — v2.3.5 알고리즘 명시:

   **Preamble 예시** (출력 선두 3행):
   ```
   🔍 /harness:check · shallow · 실행 가능성 최우선
   이유: Gate 5 신선도 판정 → stale 감지 시 다른 모든 결과 상단에 노출
   ```

   **판정 알고리즘** (`last_commit_ts` 계산) — v2.3.6 순서 정정:

   1. 기준 시각 후보 수집:
      ```
      last_smoke_ts = max(state.yaml.features[].evidence.smoke.verified_at)
                      // smoke.verified_at이 없는 feature는 제외
      ```
   2. **None 단락 판정** (git 호출 이전):
      ```
      if last_smoke_ts is None:
         emit("⚠️ smoke 기록 없음 — /harness:work 또는 --execute-smoke 필요")
         return verdict="unknown"     # git log 생략, 여기서 종료
      ```
      이유: `last_smoke_ts`가 없으면 `--since=""`로 git이 호출되어 **전체 히스토리**를 스캔하게 됩니다. 의미도 맞지 않고 비용도 불필요. 반드시 None 가드를 git 호출보다 먼저 둡니다.
   3. "마지막 코드 변경" 판정 — `git` 명령 사용:
      ```
      last_commit_ts = git log -1 --pretty=format:%cI \
                         --since="${last_smoke_ts}" \
                         -- 'src/**' 'lib/**' 'app/**' 'tests/**' \
                         ':!**/*.md' ':!**/CHANGELOG*' ':!.harness/**' ':!.claude/**'
      ```
      - 대상: architecture.yaml의 `modules[].path` 유니온으로 동적 계산 (위 glob은 fallback).
      - 동적 계산 결과가 없거나 파싱 실패 시: 위 fallback glob 사용. `game/mobile/rust` 등 비표준 레이아웃은 `modules[].path`를 통해 커버됨.
      - 제외: 문서·하네스 자산·IDE 설정 등 런타임 무관 파일.
      - 결과 없음 → `last_commit_ts = null` → 신선 (stale 아님).
   4. 신선도 판정:
      ```
      if last_commit_ts is None:
         emit("✅ 실행 검증 신선")
         verdict = "fresh"
      elif last_commit_ts > last_smoke_ts:
         emit(f"⚠️ 실행 검증 stale. smoke={last_smoke_ts}, last_code_change={last_commit_ts}")
         verdict = "stale"
      else:
         emit("✅ 실행 검증 신선")
         verdict = "fresh"
      ```
   5. 판정 결과는 `events.log`에 `check_freshness_evaluated` 이벤트로 기록:
      ```json
      {"type":"check_freshness_evaluated","last_smoke_ts":"...","last_commit_ts":"...","verdict":"stale|fresh|unknown"}
      ```
   6. `--execute-smoke` 플래그 시: 실제로 `smoke.build_command` 재실행 + `smoke_scenarios` 재검증 (느림, 5~60초). 성공 시 `state.yaml.features[skeleton].evidence.smoke.verified_at`을 현재 시각으로 갱신.
   7. Walking Skeleton 미완료(`features[].type == "skeleton"` 항목이 `status != "done"`) 시: "❌ 프로젝트 실행 검증 불가 — skeleton feature 미완료" (critical 수준, 다른 모든 결과보다 우선).

   **근거**: 커밋 기준(`%cI` = committer ISO timestamp)은 로컬 clock skew에 덜 민감하고 rebase 이후에도 일관된 값을 유지합니다. `--since`로 범위를 좁혀 대규모 레포에서도 O(1) 수준으로 응답합니다.

1. **spec ↔ architecture** (v2.2 갱신 — 파생 방향):
   - spec의 `features[].modules` 유니온이 architecture.yaml의 `modules[].name`과 일치하는가? (사용자가 architecture.yaml을 편집하지 않았다면 자동 보장. 편집했다면 불일치 가능 — edit-wins 시 이를 경고로만 표시)
   - 엔티티의 `sensitive: true`가 architecture.yaml의 `cross_cutting` 항목에 반영됐는가?
   - `derived_from.architecture_yaml.source_hash`가 현재 spec의 관련 필드 해시와 일치하는가? (불일치 = "파생 stale")
2. **spec ↔ code**:
   - 각 feature의 acceptance_criteria가 테스트에 반영?
   - doc_sync 타깃 문서가 실제로 존재하는가? (5.1의 구조화된 doc_sync 사용)
3. **architecture ↔ code**:
   - 실제 import 그래프가 `modules[].allowed_dependencies` 준수?
   - `forbidden_dependencies` 위반 검사 (madge/dependency-cruiser 연동)
4. **파생 파일 무결성** (v2.2 신설):
   - domain.md의 현재 해시 vs `derived_from.domain_md.output_hash` → 편집 감지 표시
   - architecture.yaml의 현재 해시 vs `derived_from.architecture_yaml.output_hash` → 편집 감지 표시
   - 편집 감지 시 "사용자 편집 보존 중. spec 변경은 미반영"을 info 수준으로 알림
5. **harness.yaml ↔ 실제 파일** (v2.1 해시 트리):
   - `.claude/agents/`의 파일이 harness.yaml과 일치?
   - 해시 트리 모든 노드가 최신과 일치? (root_hash 먼저, 불일치 시 세부 트리)
6. **state ↔ spec** (v2.1 신설, C1 관련):
   - `state.yaml.features[].id`가 모두 spec.yaml에 존재?
   - `evidence.strategy`가 현재 spec의 해당 feature `test_strategy`와 일치? (불일치 = 전략 변경 감사 신호)
   - `evidence.artifacts` 필수 필드가 전략별 계약(5.5 표) 부합?
7. **프로토콜 앵커 무결성** (v2.1 신설, S4):
   - 에이전트·스킬 파일이 참조하는 `.harness/protocols/*.md#anchor`가 실제 존재?
8. **Tool 권한 감사** (v2.1 신설, G1):
   - `harness.yaml.agents[].tools_override`가 6.3.1 기본값과 다른 경우 경고
9. 위반 사항 목록화 (error/warn/info 심각도)
10. `--fix` 자동 수정:
   - 해시 트리 재계산
   - agents 목록 재동기화 (파일 추가/삭제)
   - 고아 state.yaml 엔트리 제거
11. `--deep` LLM 기반 검증 (비용 주의, 주 1회 권장):
    - 테스트가 acceptance_criteria보다 많은 것을 검증하는가 ("과잉 스펙" 감지)
    - domain.md 용어가 spec.yaml 엔티티와 일관?
    - business_rules 위반 코드 있는가?
12. `events.log`에 `audit_completed` 이벤트 (위반 카운트 포함)

#### 7.3.6 `/harness:events` — 이벤트 조회 (진단)

**입력**:
- `--feature <id>` — 특정 피처
- `--since <ISO8601>` — 시점 이후
- `--type <event_name>` — 이벤트 필터
- `--rotate` — 수동 로테이션 강제
- `--tail <n>` — 최근 n건 (기본 20)
- `--json` — 원본 JSON Lines 출력 (파이프 용)

**동작**:
1. `.harness/events.log` + 아카이브(`events-*.log.gz`)를 역시간순 스트리밍
2. 필터 적용 후 표 출력 (기본) 또는 JSON Lines 출력 (`--json`)
3. `--rotate` 시 5.6의 정책 무시하고 즉시 로테이션

**출력 예시**:
```
$ /harness:events --feature F-003 --tail 5
📜 /harness:events · filter · feature=F-003, tail=5

2026-04-20T10:45:00Z  feature_completed    F-003  commit=def456
2026-04-20T10:40:12Z  gate_passed          F-003  gate=4
2026-04-20T10:38:05Z  gate_passed          F-003  gate=3  coverage=78
2026-04-20T10:30:15Z  iteration_increment  F-003  1→2  reason=test_failure
2026-04-20T10:00:00Z  feature_started      F-003  agent=orchestrator
```

#### 7.3.7 `/harness:metrics` — 집계 지표 (진단)

**입력**:
- `--window <duration>` — 집계 범위 (`7d`, `30d`, `all`)
- `--by <dimension>` — 그룹화 (`feature`, `strategy`, `agent`, `gate`)

**동작**:
1. events.log 스캔해 지표 계산:
   - **피처 처리 효율**: 평균/중앙값/95p iterations_used
   - **Gate 실패율**: Gate별 fail/(pass+fail)
   - **에스컬레이션 빈도**: 전체 피처 중 blocked 비율
   - **전략별 성과**: test_strategy별 평균 iteration + 커버리지
   - **에이전트 실행 수**: 서브에이전트별 dispatch 횟수
2. 표 + 간단한 ASCII 차트 출력

**출력 예시**:
```
📈 /harness:metrics · window=30d · 12 features completed

📊 Metrics — 지난 30일, 12개 피처 완료

By strategy:
                    count  avg_iter  med_cov  escalated
  tdd                  5      1.8      82%       0
  lean-tdd             4      1.5      76%       0
  state-verification   2      2.0      68%       1
  integration          1      3.0      71%       0

Gate failure rate:
  Gate 0 (test_evidence):   2/12  (17%)
  Gate 3 (coverage):        3/12  (25%)  ⚠️ threshold may be too high
  Gate 4 (commit):          0/12  ( 0%)
```

13.6의 "엔트로피 방어"에 핵심 관측 도구.

#### 7.3.8 `/harness:status` — 현재 상태 조회 (진단, v2.3.3 순수 읽기 전용)

**입력**: 없음 | 선택 `--verbose` (전체 health check)

**설계 의도 (v2.3.3 CQS 준수)**: `status`는 **순수 읽기 전용**입니다. 어떤 파일도 생성·수정하지 않습니다. `.harness/`가 없으면 `/harness:init`을 안내할 뿐입니다.

**상태 기반 출력 분기** (모두 읽기 전용):

**A. `.harness/`가 없을 때** — 안내 메시지만:

```
📊 /harness:status · uninstalled · .harness/ 디렉터리 없음

harness-boot이 아직 설치되지 않았습니다.

다음 할 일:
  ★ /harness:init — 하네스 설치 (프로젝트당 1회)
```

**B. spec.yaml 미완성** (일부 completeness=low 또는 필수 필드 부재):

```
📊 /harness:status · incomplete · spec.yaml 필수 필드 부족

harness-boot 설치됨. 명세 작성 중.

Spec 완성도:
  ✅ project
  ⚠️ domain (2/5 필드)
  ❌ features (0개)

다음 할 일:
  ★ /harness:spec — 명세 작성/보완
```

**C. spec 완성, harness 미동기화** (해시 트리 불일치):

```
📊 /harness:status · drift · F-003·F-007·tech_stack 해시 불일치

spec 변경 감지

변경 영역:
  • features: F-003 수정, F-007 추가
  • tech_stack.framework 변경

다음 할 일:
  ★ /harness:sync — 델타 적용 (3건)
  또는 /harness:sync --dry-run — 계획만 확인
```

**D. 정상 상태** (모든 해시 일치):

```
📊 /harness:status · normal · 모든 해시 동기화됨

Harness Status — my-project

Progress: 7 / 12 features done (58%)

Current: F-008 (비밀번호 재설정)
  Strategy: tdd  |  Iteration: 2/5  |  Phase: Green
  Started: 2 hours ago

Next up:
  - F-009 (2FA 설정, depends on F-008)
  - F-010 (이메일 알림)

Health:
  ✅ spec/architecture/harness/state 모두 동기화
  ✅ Last check: 1 day ago, no violations

다음 할 일:
  ★ /harness:work — 현재 피처 계속
  또는 /harness:spec — 명세 보완/편집
  또는 /harness:check --deep — 심층 검증
```

**핵심 구현 사항**:
- `state.yaml`과 `spec.yaml`을 **읽기 시점에 조인**해 표시 (5.5의 SSoT 준수)
- 매 실행 시 session-start-bootstrap과 동일한 최소 검증 수행 (스키마 + root_hash)
- 경고 수준(error/warn/info)에 따라 자동 제안 분기
- **어떤 파일도 생성·수정하지 않음** (v2.3.3 불변 조건). 제안 명령은 사용자가 명시적으로 실행

### 7.4 레거시 별칭 (v2.0 사용자용)

v2.0 명령어를 기억하는 사용자를 위한 shim. **다음 major 버전(v3)에서 제거 예정**.

| v2.0 | → v2.3.5 | 비고 |
|------|---------|------|
| `/harness:init` | `/harness:init` | **동일 이름 유지 — shim 불필요**. v2.3.3부터 1급 명령으로 복원되어 `commands/init.md`가 직접 처리 |
| `/harness:build` | `/harness:sync --force` | shim 필요 (`commands/_legacy/build.md`) |
| `/harness:evolve` | `/harness:sync` | shim 필요 (`commands/_legacy/evolve.md`) |
| `/harness:start` | `/harness:work` | shim 필요 (`commands/_legacy/start.md`) |
| `/harness:refine` | `/harness:spec` (자동 Mode R) | shim 필요 (`commands/_legacy/refine.md`) |
| `/harness:audit` | `/harness:check` | shim 필요 (`commands/_legacy/audit.md`) |

**구현**: 이름이 달라진 5개만 `commands/_legacy/`에 shim 파일로 등록하고, 내부적으로 새 명령을 호출합니다. `/harness:init`은 이름이 동일하므로 shim이 필요 없으며 `commands/init.md`가 1급으로 처리합니다. 각 shim은 **Preamble 규약을 따라** 안내 후 정상 위임:

```
↪️ /harness:build · shim → /harness:sync --force · v3에서 제거 예정

(실제 /harness:sync --force 출력 이어짐)
```

### 7.5 명령어 흐름

```
 [프로젝트당 1회]
     ┌──────────────────────┐
     │ /harness:init        │
     │  (하네스 설치)       │
     └──────────┬───────────┘
                │
                ▼
 [일상 반복]
     ┌──────────────────────┐
     │ /harness:spec        │
     │  (Mode A/B/R/E 자동) │
     └──────────┬───────────┘
                │
                ▼
     ┌──────────────────────┐
     │ /harness:sync        │
     │  (build/evolve 자동) │
     └──────────┬───────────┘
                │
                ▼
     ┌──────────────────────┐
     │ /harness:work (반복) │
     │  (피처 사이클)       │
     └──────────────────────┘

 [언제든 호출, 읽기 전용]
     /harness:status   — 현재 상태·다음 행동 조회
     /harness:check    — 일관성 검증 (옵션: --fix, --deep, --execute-smoke)
     /harness:events   — 이벤트 로그 조회
     /harness:metrics  — 집계 지표

 [자동 되돌림 발생 시]
     /harness:sync → spec 변경 감지 → delta 모드 or 전체 빌드
     /harness:work → Gate 5 실패 → feature blocked → integrator 재dispatch
```

**자동화 정책**:
- `session-start-bootstrap` 훅이 자동으로 상태 점검 + 필요 시 경고
- `/harness:sync`는 **항상 사용자 명시 호출**. 자동 실행하지 않음 (의도하지 않은 재생성 방지)
- `/harness:check`도 수동 호출 (deep 모드는 LLM 비용 때문)
- `/harness:status`는 언제든 호출 가능한 읽기 전용. 파일 변경 없음 (v2.3.3 CQS 준수)

### 7.6 Preamble 규약 (v2.3.1 신설)

2.3의 "투명성 우선" 원칙을 명령어 구현 수준에서 강제하는 공식 규약입니다.

**구조**:

```
<이모지> /harness:<command> · <mode> · <근거>
<blank line>
<명령 본문 출력>
```

**필드별 명세**:

| 필드 | 규칙 |
|------|------|
| 이모지 | 명령별 고정. 🔍 spec · 🔄 sync · 🛠 work · 🩺 check · 📜 events · 📈 metrics · 📊 status · ↪️ legacy shim |
| command | `/harness:<name>` 전체 표기. shim일 경우 원래 명령 + `→` + 실제 명령 |
| mode | 실행 모드. 없으면 `normal` |
| 근거 | 왜 이 모드로 들어갔는지 5~10 단어. 없으면 생략 가능 (normal만 해당) |

**명령별 mode 목록**:

| 명령 | 가능한 mode 값 |
|------|---------------|
| `/harness:status` | `initial` (`.harness/` 없음) · `incomplete` (spec 미완성) · `drift` (해시 불일치) · `normal` |
| `/harness:spec` | `Mode A` (아이디어) · `Mode B` (--from) · `Mode R` (refine) · `Mode E` (edit) |
| `/harness:sync` | `full build` (첫 실행 또는 --force) · `delta` (일부 변경) · `phase 0 only` (파생만 변경) · `no-op` (동기화 불필요) |
| `/harness:work` | `skeleton` (Walking Skeleton 진행) · `feature` (일반) · `resume` (중단된 피처 재개) · `blocked` (복구 모드) |
| `/harness:check` | `shallow` (기본) · `deep` (LLM) · `execute-smoke` (--execute-smoke) |
| `/harness:events` | `tail` (기본) · `filter` (--feature 등) · `rotate` (--rotate) |
| `/harness:metrics` | `window=7d`(또는 지정값) · `by=<dim>` |

**근거 표현 가이드**:

- 구체적 숫자·파일·필드 언급 권장: "F-003 hash changed", "completeness=low in domain", "last smoke 2 days ago"
- 모호한 표현 지양: "automatic decision", "spec changed" (뭐가 어떻게?)
- 10단어 초과 시 본문으로 이동, preamble에는 요약만

**예외**: `/harness:status` **initial 모드**는 첫 환영 메시지라 이모지+제목 형태도 허용.

**이벤트 로깅**: 모든 자동 모드 판별은 `events.log`에 기록:

```jsonl
{"ts":"2026-04-20T10:00Z","event":"auto_mode_selected","command":"spec","mode":"R","reason":"completeness_low_in_domain_business_rules"}
```

**검증**: `/harness:check`가 최근 100개 이벤트를 스캔해 `auto_mode_selected` 없이 실행된 명령이 있는지 점검 (구현 회귀 방지).

### 7.7 현실적인 실제 흐름 예시 (v2.3.4 신설)

7.5의 다이어그램이 명령어의 **구조적 관계**를 보여준다면, 이 절은 **내 상황에서 어떤 순서로 치면 되는가**에 바로 답하는 여섯 가지 대표 시나리오입니다. 각 블록은 실제 터미널에 치는 명령을 그대로 나열합니다.

**신규 프로젝트 + 아이디어만 있음**:

```
/harness:init                          (1회)
/harness:spec                          (Mode A 인터뷰)
/harness:sync                          (전체 빌드)
/harness:work --auto                   (skeleton부터 자동)
  → Gate 5 실패 시 중단 → 디버깅 후 재개
  → 모든 피처 완료까지 반복
```

**신규 프로젝트 + 기획문서 있음**:

```
/harness:init                          (1회, 빈 레포)
/harness:spec --from plan.md           (Mode B — LLM 다층 추출 + 원문 인용 확인)
  → 누락 필드 있을 시 Mode A 인터뷰로 폴백 (7.3.1)
/harness:sync                          (전체 빌드, 해시 트리 초기 생성)
/harness:work --auto                   (skeleton부터 자동, plan.md 매핑 순서대로)
```

**기존 프로젝트 + 기획문서 있음**:

```
/harness:init
/harness:spec --from plan.md           (Mode B, LLM 추출 + 사용자 확인)
/harness:sync
/harness:work --auto
```

**기존 프로젝트 + 기획문서 없음** (13.3 미래 과제의 현재 폴백):

```
/harness:init                          (.harness/ 설치 — 기존 코드 자체는 건드리지 않음)
/harness:spec                          (Mode A 인터뷰 — 기존 코드를 참고 자료로 보며 답변)
  → 자동 역엔지니어링(reverse_engineered origin)은 v2.3.6 미지원 — 'idea'로 폴백 기록 (§5.1, §13.3)
/harness:sync                          (전체 빌드, 해시 트리 초기 생성)
/harness:check                         (권장: 작성한 spec과 기존 코드의 일관성 스냅샷 점검)
/harness:work --feature <id>           (신규·변경 피처만 진입 — 기존 파일 덮어쓰기 방지)
  → Walking Skeleton 재생성이 기존 코드와 충돌할 수 있으므로 `--auto` 전면 실행은 피할 것
```

**주(註)**: 이 시나리오는 `"도구가 기존 코드를 읽어 spec을 자동 구성하고 필요한 부분만 질문"`이라는 이상적 형태에서 **자동 스캔 파트를 유보**한 폴백입니다. 기획문서가 없는 기존 프로젝트는 `tech_stack.framework`(package.json류에서), `deliverable.type`(엔트리포인트·디렉터리 구조에서), feature 후보(git log·디렉터리에서) 정도는 결정적 스캔으로 높은 자동화율을 낼 수 있지만, `domain.business_rules`·`acceptance`·`invariants`는 거의 전부 사용자에게 물어야 합니다(코드·주석에 의도가 간접 표현되기 때문). 이 "40% 자동 스캔 + 60% 인터뷰" 하이브리드는 §13.3 **Mode I (Ingest)**로 예약돼 있으며, 구현되면 `/harness:spec --scan` 경로와 `metadata.source.origin: reverse_engineered` 활성화로 진입합니다. v2.3.6에서는 사용자가 동일한 정보를 Mode A 인터뷰로 수동 제공한다고 이해하면 됩니다.

**피처 추가 유지보수**:

```
/harness:spec                          (Mode E 자동, 새 feature 추가)
/harness:sync                          (델타 모드 자동 선택)
/harness:work --auto                   (새 피처만 진행)
```

**스펙 변경 없는 버그 수정**:

```
/harness:work --feature F-023          (기존 피처 재진입)
  또는 직접 수정 후 /harness:check     (일관성 검증만)
```

**참고 — 이 절에 직접 다루지 않는 경우**:

- **레거시 코드베이스 자동 역엔지니어링** (스캔만으로 spec 자동 생성): 13.3의 미래 과제(40% 자동 스캔 + 60% 대화형 인터뷰 하이브리드 설계, `reverse_engineered` origin은 현재 미지원). v2.3.6 현재 폴백은 위의 "기존 프로젝트 + 기획문서 없음" 시나리오 — Mode A 인터뷰에서 사용자가 본인 코드를 참고 자료로 활용하여 수동으로 채움
- **v1 하네스에서 업그레이드**: `scripts/migrate-v1-to-v2.mjs` 선행 후 "피처 추가 유지보수" 흐름으로 진입 (12.1)
- **`--auto` 없이 단계별 수동 진행**: `/harness:work`를 `--auto` 없이 호출하면 각 Gate에서 사용자 확인 후 다음으로 이동. 학습·디버깅용

**`--auto` 자동 중단 조건 (공통)**: 여섯 시나리오 모두 `/harness:work --auto`는 다음 상황에서 반드시 멈춥니다 — Walking Skeleton 우회 시도, Gate 0~4 iteration 5회 초과(에스컬레이션), **Gate 5 실패**(v1.0 재발 방지 — 7.3.4), architecture 파생 모호성 질문 발생. 중단 시 preamble에 멈춘 이유가 표시됩니다 (7.6).

---

## 8. 데이터 모델과 스키마

### 8.1 스키마 파일 위치

- 플러그인 레포: `harness-boot/docs/schemas/`
- 사용자 프로젝트: 스키마는 원격 참조 (`$schema: "https://.../spec.schema.json"`)

### 8.2 스키마 제공 파일 목록

| 파일 | 대상 |
|------|------|
| `spec.schema.json` | `.harness/spec.yaml` |
| `architecture.schema.json` | `.harness/architecture.yaml` |
| `harness.schema.json` | `.harness/harness.yaml` |
| `state.schema.json` | `.harness/state.yaml` |

### 8.3 검증 시점

| 시점 | 대상 | 실패 시 |
|------|------|--------|
| `/harness:spec` 저장 시 | spec.yaml | 에러 메시지 + 수정 요청 |
| `/harness:sync` 실행 시 | spec.yaml, architecture.yaml | 실행 거부 |
| `session-start-bootstrap` 훅 | state.yaml | 사용자에게 경고 표시 |
| `/harness:check` | 모든 yaml + 해시 트리 + 앵커 | 리포트에 포함 |

### 8.4 버전 관리

**세 종류의 버전을 분리합니다** (v2.3.5 명시):

| 버전 종류 | 대상 | 갱신 규칙 | 예시 |
|---|---|---|---|
| 설계 문서 버전 | 이 문서 (`harness-boot-design-{N}.md`) | 설계자가 수동으로 bump | 2.3.5 |
| 플러그인 버전 | `plugin.json`, `package.json` | 릴리스 시 SemVer | 2.3.0 |
| 스키마 버전 | 각 스키마 파일 루트 `version: "X.Y"` | **스키마 실제 변경 시에만 bump** | `spec.yaml.metadata.schema_version: "2.2"` |

- 사용자 YAML 파일(`spec.yaml`, `harness.yaml`, `state.yaml`, `architecture.yaml`)의 `version` 필드는 **해당 스키마 구조가 바뀔 때만** bump합니다. 설계 문서 버전과 독립입니다. 예: v2.3.3 → v2.3.5는 문서·동작 보강만이므로 사용자 파일의 스키마 버전은 변경되지 않음.
- `.claude-plugin/plugin.json`의 `version`은 플러그인 릴리스 SemVer를 따릅니다(배포 단위).
- 메이저 스키마 변경 시 마이그레이션 도구 제공: `scripts/migrate-schema-{from}-{to}.mjs`. 실행 시 `.harness/state.yaml`의 `schema_version`을 자동 갱신하고, 사용자 YAML을 in-place 업데이트(백업 `.bak` 생성).
- 과거 3개 메이저 스키마 버전 로딩 지원 원칙. 그 이상은 `/harness:check`가 "업그레이드 필요" 경고.
- 각 스키마 파일의 현재 버전은 `docs/schemas/VERSIONS.md`에 매트릭스로 정리(플러그인 버전 × 스키마 버전).

---

## 9. 생성 파이프라인

### 9.1 전체 플로우

```
사용자 입력
    │
    ▼
┌─────────────────────────────────────────┐
│ /harness:init (프로젝트당 1회)          │
│  - 협업 정책 선택 (단독/팀)             │
│  - .harness/ 스켈레톤 생성              │
│    spec.yaml, harness.yaml, state.yaml  │
│    events.log, CLAUDE.md                │
│  - .gitignore 설정                      │
│  - 완료 후: /harness:spec 안내          │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ /harness:spec                           │
│  자동 모드 판별:                        │
│    Mode A — 아이디어 인터뷰             │
│    Mode B — --from plan.md (LLM 다층)   │
│    Mode R — refine (빈약 필드)          │
│    Mode E — edit                        │
│                                         │
│  출력: 검증된 .harness/spec.yaml        │
│  완료 제안: /harness:sync               │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ /harness:sync                           │
│  자동 분기 (해시 트리 진단):            │
│    - harness.yaml 없음 → 전체 빌드      │
│    - 일부 영역 불일치 → 델타 모드       │
│    - 모두 일치 → "이미 동기화됨"        │
│                                         │
│  트랜잭션 범위: .harness/ + .claude/    │
│    1. .harness.backup/, .claude.backup/ │
│    2. .harness.tmp/, .claude.tmp/ 생성  │
│    3. 스키마 + 앵커 검증                │
│    4. 원자 rename (.harness 먼저)       │
│    5. 실패 시 backup에서 복원           │
│                                         │
│  완료 시: 세션 재시작 권장 출력         │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ /harness:work (반복)                    │
│  - Walking Skeleton 선조건 (v2.3)       │
│  - 피처 선택 (depends_on, priority)     │
│  - test_strategy 사이클 (Gate 0~4)      │
│  - integrator dispatch (build+smoke)    │
│  - Gate 5 판정 (v2.3 필수)              │
│  - 통과 시 단일 커밋 + state 갱신       │
│  - Gate 5 실패 시 blocked (v1.0 방지)   │
└─────────────────────────────────────────┘

진단 명령 (언제든, 읽기 전용):
  /harness:status  — 현재 상태 + 다음 행동 제안
  /harness:check [--fix] [--deep] [--execute-smoke]
  /harness:events [--feature | --since | --type | --tail]
  /harness:metrics [--window | --by]
```

### 9.2 각 단계의 실패 복원

**init 실패** (`/harness:init`): init은 단일 트랜잭션 — 중간 실패 시 `.harness/` 통째로 제거(원자성). 재실행으로 복구 가능. 디렉터리만 생성됐고 파일 생성 실패라면 `.harness/`를 삭제 후 재시도.

**spec 실패** (`/harness:spec`): 스키마 위반 시 사용자에게 에러 지점 표시 후 재편집 유도. `metadata.completeness`를 `low`로 두고 같은 명령의 Mode R로 나중에 보완 가능. LLM 파싱 실패는 7.3.2 Mode B의 fallback 경로(2회 재시도 후 Mode A 자동 전환)로 복구.

**sync 실패** (`/harness:sync`, 전체 빌드 모드) — v2.1 트랜잭션 범위 명시:
- 모든 생성은 `.harness.tmp/` **와** `.claude.tmp/`에서 수행 (부트스트랩 역설 회피)
- 기존 `.harness/` 및 `.claude/`는 `.harness.backup/{ts}/`, `.claude.backup/{ts}/`로 동시 백업
- 검증 실패 → tmp/ 삭제, 원본 그대로 유지 (사용자 관점에서 아무것도 바뀌지 않은 상태)
- rename 단계 실패 (매우 드묾) → 부분 교체 상태에서 backup으로 전체 복원
- 교체 순서: `.harness/` 먼저 → `.claude/` 나중 (설정이 훅을 참조하므로 훅이 먼저 있어야 함)
- 성공 후에도 backup은 **1회 유지**하여 수동 롤백 가능 (`.harness.backup/{ts}/` 최근 1개, 그 이전은 삭제)

**sync 실패** (`/harness:sync`, 델타 모드):
- 델타 적용 중 일부 파일 검증 실패 → 해당 변경만 롤백, 성공한 델타는 유지
- 해시 트리는 **부분 적용 상태**로 갱신 (`events.log`에 명시 기록)
- 편집 존중으로 건너뛴 파일은 `events.log`의 `derived_preserved` 이벤트로 추적

**work 실패** (`/harness:work`):
- Iteration 5회 초과 → 에스컬레이션 (feature를 `blocked` 상태로, `blocked_reason` 기록)
- Gate 실패 → feature `blocked`, 사용자 개입 대기
- 세션 중단 → `state.yaml.current`에 체크포인트, 재개 시 session-start-bootstrap이 `_workspace/handoff/inbox/`의 미처리 메시지까지 복원
- 훅 자체 실패(exit != 0, 2) → fail-open, `hook_error` 이벤트 로그 후 작업 계속

---

## 10. 진화 파이프라인

### 10.1 진화의 두 축

**Spec 진화**: 사용자가 spec.yaml을 변경 (피처 추가, 도메인 수정)
**Implementation 진화**: 개발 중 실제 코드가 축적

두 축이 일관성을 유지해야 함. `/harness:check`가 불일치 검출, `/harness:sync`가 전파.

### 10.2 spec 변경 → 하네스 전파

**변경 감지** (v2.2 갱신): v2.2에서 사용자 입력은 spec.yaml 하나뿐이므로, 모든 변경은 spec에서 출발합니다. architecture.yaml과 domain.md는 파생 결과이며, spec 변경 → Phase 0 재파생 → 하네스 재생성 순으로 전파됩니다.

- `harness.yaml.generation.generated_from.spec.root_hash`와 현재 spec.yaml 해시 비교
- root 불일치 시 세부 트리 순회로 변경 위치 특정 (`features.F-003`? `tech_stack`? `domain`?)
- `harness.yaml.derived_from.*.user_edit_detected`로 파생 파일의 사용자 편집 여부 추적
- 결과를 `harness.yaml.drift_status`에 기록 (`synced` | `spec_changed` | `derived_diverged` | `manual_edit_detected` | `include_changed`(v2.3.7))
- `/harness:status`와 `/harness:check`가 드리프트 경고 표시

**전파 전략** (`/harness:sync` Phase 0 + 델타 모드):

| 변경 종류 (spec에서 출발) | 감지되는 트리 노드 | Phase 0 영향 | Phase 1 영향 |
|-------------------------|------------------|-------------|-------------|
| 새 feature 추가 | `spec.features[F-new]` 등장 | F-new의 `modules` 참조가 새로우면 architecture 재파생 (모호 시 질문) | state.yaml에 pending entry 추가; `condition` 재평가로 에이전트 추가 |
| feature 삭제 | `spec.features[F-old]` 소멸 | 더 이상 참조되지 않는 모듈이 있으면 architecture 재파생 | state.yaml에서 제거 (done이면 archive) |
| test_strategy 변경 | `spec.features[F-id]` 해시만 변경 | 영향 없음 | evidence.strategy 불일치 발생 → check 경고, 진행 중이면 차단 |
| tech_stack 변경 | `spec.tech_stack_hash` 변경 | 영향 없음 | 모든 skill의 compatibility 필드 일괄 갱신 |
| pattern 변경 (`constraints.architecture.pattern`) | spec의 pattern 필드 변경 | architecture.yaml **전면 재파생 후보** (레이어·규칙 대폭 변경) | **전체 빌드 에스컬레이션** — 델타 모드가 거부하고 `--force` 권장 |
| `features[].modules` 참조 변경 | spec 수준 변경 | architecture 재파생 — 새 모듈이면 layer 질문, 삭제된 모듈은 제거 | 해당 모듈 특화 implementer 재생성 |
| entity/business_rule 추가·수정 | `spec.domain_hash` 변경 | domain.md 재파생 (사용자 편집 없을 시) | 도메인 참조 에이전트 재생성 |
| entity에 `sensitive: true` 추가 | `spec.domain_hash` 변경 | domain.md 재파생 + architecture의 cross_cutting 재계산 | `has_sensitive_entity` 조건 트리거 → qa-agent 생성 |

**파생 파일 편집 감지 시 동작** (v2.2, v2.3.2 정제):

- 사용자가 architecture.yaml에 수동 규칙 `AR-100`을 추가한 상태에서 spec.yaml을 바꿔도, Phase 0은 architecture.yaml을 건너뛰고 경고만. 사용자가 `--regenerate-derived=architecture`를 쓰면 편집본이 backup으로 이동하고 재파생.
- domain.md는 순수 뷰이므로 편집을 권장하지 않지만, edit-wins 안전망이 작동하여 의도치 않은 덮어쓰기를 방지. 서술이 필요하면 **spec.yaml의 자유 텍스트 필드**(`description`, `rationale`, `overview`)를 편집하세요.

### 10.3 코드 변경 → spec 반영 (수동)

코드에서 발견된 통찰(예: "이 기능은 실제로는 결제 경계를 건드린다")은 자동 역반영 불가.

대신 `/harness:spec` Mode E에서 사용자가 명시적으로 spec 수정.

`/harness:check --deep`이 "테스트가 acceptance_criteria보다 더 많은 것을 검증한다" 같은 힌트를 줄 수 있음 (LLM 기반, 비용 있음).

### 10.4 드리프트 관리

**드리프트 판정 근거**: 아래 8종(v2.3.7, Include drift 포함) 중 해시 비교를 사용하는 유형(Spec·Derived·Generated·Include)은 **부록 D — 해시 정규화 규약**에 의해 결정론적으로 판정됩니다. 해시 구현이 부록 D와 일치하지 않으면 잘못된 드리프트를 보고하거나 실제 드리프트를 놓칠 수 있습니다.

**드리프트 유형**:
1. **Spec drift**: spec.yaml이 변경됐는데 하네스가 따라가지 않음 → `/harness:sync` (해시 트리 델타, 부록 D). **v2.3.7**: spec.yaml은 안 바뀌어도 `$include` 대상 외부 md가 바뀌면 `expanded_spec` 해시가 달라져 동일 경로로 감지됨 (drift_status: `include_changed`).
2. **Code drift**: 코드가 architecture.yaml 규칙을 위반 → `/harness:check --fix` (규칙 적용) 또는 spec 업데이트
3. **Doc drift**: 문서가 코드와 어긋남 → `pre-tool-doc-sync-check` 훅이 실시간 차단
4. **Derived drift** (v2.2, domain.md/architecture.yaml): 사용자가 파생 파일을 편집 → `harness.yaml.derived_from.*.user_edit_detected: true` 기록, `/harness:sync`가 편집본 보존 경고, 재파생을 원하면 `--regenerate-derived`
5. **Generated drift** (v2.2, .claude/agents 등): 사용자가 생성 파일을 편집 → edit-wins 동일 규칙 적용, `/harness:sync`가 해당 파일만 건너뜀, 재생성을 원하면 `--force` 또는 `--regenerate-agents`
6. **Evidence drift** (v2.1): state.yaml.features[].evidence.strategy가 현재 spec.yaml의 test_strategy와 불일치 → 전략이 바뀌었다는 감사 신호, check 경고
7. **Anchor drift** (v2.1): 에이전트/스킬이 참조하는 프로토콜 앵커가 사라짐 → check가 검출, sync가 재생성
8. **Include drift** (v2.3.7, `$include` 대상 외부 md 파일): 외부 md가 편집됨 → `harness.yaml.generation.include_sources[].user_edit_detected: true`. **Derived drift와 달리 병합 결과가 자동으로 spec에 반영**되는 것이 정상 동작 (외부 md는 spec의 연장). `/harness:check`가 누락(파일 삭제)·크기 초과·형식 위반을 별도 항목으로 보고.

---

## 11. 플러그인 자체 구조

### 11.1 harness-boot 레포 구조

```
harness-boot/                           # 플러그인 레포 (배포 단위)
├── README.md
├── README.ko.md
├── LICENSE
├── package.json
├── CLAUDE.md                           # 이 레포 기여자용 Claude Code 설정
│
├── .claude-plugin/
│   └── plugin.json                     # Claude Code 플러그인 매니페스트
│
├── commands/                           # 슬래시 명령어 정의
│   ├── init.md                         # 하네스 설치 (Tier 1-init, v2.3.3)
│   ├── spec.md                         # 제품 설명 (Tier 1)
│   ├── sync.md                         # 하네스 동기화 (Tier 1)
│   ├── work.md                         # 피처 사이클 (Tier 1)
│   ├── status.md                       # 상태 조회 (Tier 2, 읽기 전용)
│   ├── check.md                        # 일관성 검증 (Tier 2)
│   ├── events.md                       # 이벤트 조회 (Tier 2)
│   ├── metrics.md                      # 집계 지표 (Tier 2)
│   └── _legacy/                        # v2.0 shim (v3에서 제거 예정)
│       ├── build.md                    # → sync --force
│       ├── start.md                    # → work
│       ├── refine.md                   # → spec
│       ├── audit.md                    # → check
│       └── evolve.md                   # → sync
│
├── docs/
│   ├── setup/                          # 스펙 문서 (기존 11개 토픽 + v2 추가)
│   │   ├── INDEX.md
│   │   ├── philosophy-and-layout.md
│   │   ├── runtime-guardrails.md
│   │   ├── domain-spec.md
│   │   ├── architecture-spec.md
│   │   ├── state-management.md
│   │   ├── agents-and-gates.md
│   │   ├── tdd-isolation.md
│   │   ├── model-routing.md
│   │   ├── code-style.md
│   │   ├── skills-anatomy.md
│   │   ├── evolution-and-recovery.md
│   │   └── generation-rules.md
│   │
│   ├── schemas/                        # JSON Schema 정의
│   │   ├── spec.schema.json
│   │   ├── architecture.schema.json
│   │   ├── harness.schema.json
│   │   └── state.schema.json
│   │
│   ├── templates/                      # 생성 시 복사되는 템플릿
│   │   ├── agents/
│   │   │   ├── orchestrator.md
│   │   │   ├── tdd-implementer.md
│   │   │   └── ...
│   │   ├── skills/
│   │   │   ├── new-feature/
│   │   │   ├── bug-fix/
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   ├── pre-tool-security-gate.mjs
│   │   │   └── ...
│   │   ├── protocols/
│   │   │   ├── tdd-cycles.md
│   │   │   └── ...
│   │   └── starter/                    # init 시 복사되는 초기 파일
│   │       ├── spec.yaml.template
│   │       ├── harness.yaml.template
│   │       └── CLAUDE.md.template
│   │
│   ├── protocols/                      # 플러그인 내부 프로토콜 (commands가 참조)
│   │   └── ...
│   │
│   ├── references/                     # 참고 자료
│   │   ├── agent-design-patterns.md
│   │   ├── execution-model.md
│   │   └── ...
│   │
│   └── start-prompts.md                # /start용 상황별 프롬프트
│
├── scripts/                            # 빌드/검증 스크립트
│   ├── build-rule-fragments.mjs
│   ├── check-doc-sizes.mjs
│   ├── validate-schemas.mjs
│   ├── detect-conversation-language.mjs
│   ├── derive-domain-md.mjs            # v2.2 신설 — spec.domain → domain.md 템플릿 렌더링
│   ├── derive-architecture-yaml.mjs    # v2.2 신설 — spec → architecture.yaml 파생 (모호성 질문 포함)
│   ├── compute-hash-tree.mjs           # v2.1 해시 트리 + v2.2 derived_from 계산 (v2.3.7: expanded_spec 기준)
│   ├── resolve-includes.mjs            # v2.3.7 신설 — $include 확장 + include_sources 계산
│   ├── hash-fixtures.mjs               # v2.3.6 도입 — canonical hash 테스트 벡터 (v2.3.7: T9 추가)
│   └── migrate-v1-to-v2.mjs            # 마이그레이션 도구
│
├── tests/
│   ├── fixtures/
│   │   ├── sample-spec.yaml            # v2.2 입력 샘플
│   │   ├── expected-domain.md          # v2.2 파생 기대값 (스냅샷 테스트)
│   │   ├── expected-architecture.yaml  # v2.2 파생 기대값
│   │   └── legacy-plan.md              # v1 → v2 마이그레이션 테스트용
│   └── ...
│
└── hooks/
    └── hooks.json                      # 플러그인 자체 훅 (비어 있음)
```

### 11.2 `commands/`와 `docs/` 관계

- `commands/*.md`는 슬래시 명령어의 **진입점**. 짧고 실행 흐름 중심.
- `docs/setup/*.md`는 명령어가 참조하는 **상세 스펙**. `${CLAUDE_PLUGIN_ROOT}/docs/setup/...`로 import.

### 11.3 템플릿과 생성의 관계

`docs/templates/`는 두 종류로 나뉨:

**도메인 무관 템플릿**: 프로젝트 성격에 관계없이 동일하게 복사됨
- `templates/agents/orchestrator.md` → `.claude/agents/orchestrator.md`
- `templates/hooks/pre-tool-security-gate.mjs` → `.harness/hooks/pre-tool-security-gate.mjs`
- `templates/protocols/tdd-cycles.md` → `.harness/protocols/tdd-cycles.md`

**프로젝트 적응 템플릿** (`.tmpl` 확장자): 변수 치환 후 복사
- `templates/skills/api-endpoint/SKILL.md.tmpl` → `.claude/skills/api-endpoint/SKILL.md`
  - `{{tech_stack.framework}}` → "Next.js 14"
  - `{{domain.entities}}` → 실제 엔티티 목록

### 11.4 플러그인 배포

- npm: `npm install -g @harness-boot/cli` (미래)
- Claude Code: `/plugin marketplace add qwerfunch/harness-boot` → `/plugin install harness-boot`
- 직접: `claude --plugin-dir /path/to/harness-boot`

---

## 12. 마이그레이션 전략

### 12.1 v1 → v2 변환

v1에서 v2로 마이그레이션할 기존 프로젝트가 있다면 (현재는 비공개 상태라 해당 없음).

**`scripts/migrate-v1-to-v2.mjs`**:

1. 기존 파일 백업: `.harness-v1-backup/`로 전체 복사
2. `plan.md` 파싱 → `.harness/spec.yaml` 생성 (LLM 기반 추출)
3. `PROGRESS.md` + `feature-list.json` → `.harness/state.yaml` 병합
4. `.claude/agents/`, `.claude/skills/` 유지 (위치 변경 없음)
5. `hooks/` → `.harness/hooks/` 이동
6. `.claude/settings.json` 경로 업데이트
7. `CLAUDE.md`를 얇은 import 파일로 교체 (원본은 `.harness/spec.yaml`에 통합)
8. `/harness:check`로 검증

### 12.2 호환성 정책

- v2.x: v1 스키마 읽기 가능 (자동 변환)
- v3.0 이상: v1 지원 중단 (명시적 마이그레이션 요구)

### 12.3 현재 상황 (비공개 단독 개발)

현재 harness-boot은 비공개 단독 개발 단계이므로, v1 사용자 호환성에 대한 고려는 **불필요**. 이 단계는 재설계를 전면 적용할 **유일한 기회**.

실행 순서 권장:
1. v2 설계 문서 확정 (이 문서)
2. `docs/schemas/*.json` 작성 (JSON Schema 먼저)
3. `tests/fixtures/sample-spec.yaml` 하나 작성 → 종이 설계 검증
4. `commands/*.md` 재작성
5. `docs/templates/` 재구성
6. 기존 `/setup`, `/start` 코드 제거 및 재구현
7. 내부 dogfooding (자기 프로젝트에 적용)
8. 공개

---

## 13. 열린 질문

설계 후 실제 구현에서 답해야 할 질문들.

### 13.1 spec.yaml의 크기 문제

현재 설계로 spec.yaml은 500~1,000 라인이 될 수 있음. 이게 감당 가능한가?

**대안**:
- `spec/` 디렉터리로 분할 (spec/project.yaml, spec/features.yaml 등)
- 분할 축은 "변경 빈도" (자주 바뀌는 features vs 드물게 바뀌는 domain)

**검증 방법**: `tests/fixtures/`에 실제 샘플 프로젝트의 spec.yaml을 작성해 봄. 500라인을 넘기면 분할 검토.

### 13.2 YAML 편집의 UX

비개발자(기획자·PM 역할 개발자)가 YAML을 직접 편집할 수 있는가?

**완화책**:
- `/harness:spec` 대화형 인터뷰를 UX 우선으로 설계 (사용자는 YAML을 거의 안 봐도 됨)
- VSCode YAML 확장 + 스키마 지원 유도
- 필요 시 웹 UI 에디터 제공 고려 (장기)

### 13.3 기존 프로젝트 전사 (향후 Mode I — Ingest)

이번 재설계에서 레거시 전사는 미래 과제로 미뤘음. 언제 도입할지, 어떤 기술로 접근할지는 별도 설계 문서 필요.

**예상 접근** — 향후 **Mode I (Ingest)** 로 정식화 예정. 진입 경로는 `/harness:spec --scan` 또는 `origin: reverse_engineered` 명시:

- **자동 스캔 40%** (결정적, LLM 없음): `package.json`/`pyproject.toml`/`Cargo.toml`/`go.mod` → `tech_stack.runtime`·`framework`, 엔트리포인트·디렉터리 구조 → `deliverable.type`, 테스트 디렉터리 패턴 → `test_framework`, `git log --oneline` 상위 N개 → feature 후보 명사 추출.
- **대화형 인터뷰 60%** (암묵지 추출): `domain.business_rules`·`acceptance`·`invariants`는 코드·주석에 의도가 간접 표현되므로 자동 추출 불가 — Mode R(refine) 질문 루프로 한 번에 하나씩.
- 자동 추출 결과는 모두 필드별 **`confidence: low|medium|high`** + `metadata.completeness: low`로 표기 후 사용자 검증. `metadata.source.origin: reverse_engineered` 값은 §5.1에 이미 예약돼 있으며 현재는 `'idea'`로 폴백 기록.
- v2.3.6 현 시점 폴백은 §7.7 "기존 프로젝트 + 기획문서 없음" 시나리오 — Mode A 인터뷰에서 사용자가 본인 코드를 참고 자료로 활용해 수동 제공.

### 13.4 `_workspace/handoff/` 모델의 한계

Subagent Dispatch의 파일 기반 핸드오프는 동시 실행 중 실시간 메시지 불가. Claude Code가 향후 TeamCreate/SendMessage를 정식 지원하면 재검토.

### 13.5 멀티 런타임 지원

Cursor, OpenCode 지원을 실제로 넣을 것인가?

- `.harness/`를 공통 자산으로 유지하는 설계는 이미 준비되어 있음
- 각 런타임별 어댑터 디렉터리(`.cursor/`, `.opencode/`)만 추가 구현
- 우선순위는 사용자 수요에 따라 결정

### 13.6 엔트로피 방어

100개 피처 이후의 "느린 붕괴"에 대한 `/harness:check`의 깊이. 현재 설계는 구조 검증 중심. 의미 수준 검증(도메인 용어 일관성, 비즈니스 규칙 준수)은 LLM 호출 비용 때문에 주기적으로만 실행해야 함.

**초기 타협**: `/harness:check --deep` 모드를 별도로 두고 주 1회 수동 실행 권장.

### 13.7 기능 검증의 한계 (v2.3 업데이트)

**v2.3 해결 부분**: "실행 자체가 안 되는" 수준의 문제(v1.0 사례)는 Walking Skeleton + integrator + Gate 5로 **구조적으로 차단**됨. 빌드가 깨진 상태에서 "완료" 보고 불가.

**여전히 미해결**: "실행은 되는데 **의도대로 동작하는가**". smoke_scenarios의 success_criteria는 자연어 기술이므로 LLM 해석 여지 있음. "점수가 올바르게 계산됨"을 scenario에 써도 에이전트가 이를 정확히 검증한다는 보장은 약함.

**단기 완화**:
- smoke_scenarios.success_criteria에 **기계 검증 가능한 표현** 권장 (예: "응답 JSON의 `score` 필드가 정수 100 이상")
- acceptance_criteria와 smoke_scenarios의 교차 참조 — `/harness:check --deep`이 불일치 감지

**장기 연구**: Intent-Met 측정 메커니즘 (microsoft/amplifier 사례 참고). 사용자 의도를 실행 증거와 대조하는 LLM 기반 검증. 비용·재현성 트레이드오프 미해결.

### 13.8 Monorepo 시나리오 (v2.1 신설)

현재 설계는 `.harness/`가 프로젝트 루트 하나만 상정합니다. `packages/*/` 구조의 monorepo는 어떻게?

**고려할 모델**:

1. **루트 단일 하네스 모델**: 전체 monorepo가 하나의 spec.yaml을 공유. features가 `module:package-a/src/...`처럼 패키지를 참조. 장점: 크로스 패키지 일관성. 단점: 패키지별 tech_stack 차이 표현 어려움.

2. **패키지별 하네스 모델**: 각 `packages/*/.harness/`가 독립. 루트 `.harness/`는 공유 도메인만 담음. 장점: 독립성. 단점: 공유 상태/이벤트 집계 어려움.

3. **계층 하네스 모델**: 루트 `.harness/`가 공유 도메인·비즈니스 규칙을 담고, 각 패키지 `.harness/`가 `extends: ../../.harness/`로 상속. 중간 복잡도.

**별도 설계 문서 필요**. 현재는 단일 프로젝트 루트만 공식 지원.

### 13.9 MCP 서버 통합 정책 (v2.1 신설)

Claude Code는 MCP (Model Context Protocol) 서버로 외부 도구(DB, API, 문서 저장소 등)를 연결할 수 있습니다. harness-boot의 관계는?

**현재 설계의 입장**: **무관심** — MCP 구성은 사용자/프로젝트의 책임. harness-boot은 간섭하지 않음.

**근거**:
- MCP 서버 목록은 프로젝트별로 매우 다양하고 빠르게 변화
- spec.yaml에 MCP 의존성을 하드코딩하면 이식성 저하
- 에이전트가 특정 MCP 도구에 의존하면 하네스 재현성 약화

**제한적 통합 지점** (v3 이후 검토):
- `spec.yaml.constraints.external_dependencies`에 사용 MCP 서버 **선언적 목록** 기록 (이름 + 용도, 설정 상세는 제외)
- `/harness:check`가 "선언된 MCP가 실제 연결됐는가"만 확인 (활성 여부는 Claude Code 책임)
- 에이전트 프롬프트에 "이 프로젝트는 X MCP를 쓸 수 있음"이라는 힌트 주입 (강제 아님)

### 13.10 UX 단순화의 부작용 (v2.3.1에서 해결)

v2.1에서 10개 명령을 4개 Tier 1 + 3개 Tier 2로 축약했지만, 내부 모드(Mode A/B/R/E, 전체/델타)가 자동 판별되는 설계는 **"지금 뭘 하고 있는지 덜 투명해지는 부작용"**이 있었습니다.

**v2.3.1 해결책 (2.3 원칙 + 7.6 규약)**:

- **Transparency-by-Preamble 원칙** 신설 (2.3)
- **Preamble 규약** 공식 명세 (7.6) — 모든 명령 첫 3줄에 "이모지 · 명령 · 모드 · 근거" 표시
- **auto_mode_selected 이벤트** — 자동 판별 결과를 events.log에 기록
- **`/harness:check` 회귀 검증** — preamble 없이 실행된 명령 감지

**남은 관찰 과제** (구현 후 검증):
- 근거 10단어 제한이 실제로 정보량을 보장하는가? (너무 짧아서 불친절하면 15단어로 확장 고려)
- 초기 사용자 세션에서 "어느 명령의 preamble이 혼란을 일으켰는가" 로그 분석

### 13.11 `$include` 재귀 및 깊이 제한 (v2.3.7 신설)

v2.3.7은 `$include`를 **단일 레벨**만 허용합니다 (외부 md 안에 또 `$include`가 있어도 확장하지 않음 — 그냥 문자열로 취급). 이는 다음 이유로 의도된 제한입니다:

- **구현 단순성**: 재귀 허용 시 사이클 검출·깊이 제한·캐시 로직이 필요
- **`.md`는 최종 콘텐츠 형식**: md 파일이 또 다른 md 파일을 "include" 한다는 의미는 문서 작성자 기대와 어긋날 수 있음 (md 파일은 최종 렌더 결과로 이해되는 것이 자연스러움)
- **YAML 쪽에서 추상화**: 진짜 필요한 건 "긴 서사를 md로 분리"이지 "md끼리 조합"이 아님

**v2.4+ 검토 항목**:
- 재귀 확장 필요성 데이터 (사용자가 md 안에 include를 시도하는 빈도)
- 허용 시 깊이 제한 (3단?), 사이클 검출 (DAG 검증)
- 관련 심볼릭 참조(`$ref` JSON Schema 방식) 도입 여부
- `$include`에 **쿼리 파라미터** 허용 (예: `$include: docs/features.md#F-003` — anchor 기반 부분 추출)

현재는 "평평한 한 층"으로 충분하다는 가정을 채택했습니다. 실제 사용 데이터가 재귀의 정당성을 보여주면 v2.4에서 도입을 재고합니다.

---

## 부록 A — 용어 사전

| 용어 | 정의 |
|------|------|
| **하네스 (harness)** | 모델이 아닌 모든 실행 환경 자산 — 에이전트·스킬·훅·프로토콜·명세·상태 |
| **spec (명세)** | 제품이 무엇인지에 대한 구조화된 선언. `.harness/spec.yaml`. v2.2부터 **유일한 사용자 입력**. |
| **deliverable** | v2.3 신설. "실행되면 무엇이 되는가"의 선언 — type, entry_points, smoke_scenarios. spec.yaml 최상위. |
| **Walking Skeleton** | v2.3 신설. 업계 표준 패턴 (Cockburn). "비어 있어도 엔드-투-엔드로 실행되는 최소 뼈대". `features[0].type: skeleton`으로 강제. |
| **skeleton feature** | Walking Skeleton을 구현하는 첫 번째 feature (`type: skeleton`). 빌드·기동·최소 smoke_scenario 통과가 수용 기준. |
| **integrator** (에이전트) | v2.3 신설. 매 피처 Gate 4 통과 후 exports를 main·DI·라우터에 wire-up하고 빌드·실행·smoke 수행. `test_strategy: integration`과 구별됨 (후자는 피처 내부 테스트 전략) |
| **Gate 5 (runtime smoke)** | v2.3 필수화. 빌드 성공 + entry_point 기동 + smoke_scenarios 전부 통과 = 통과. prototype_mode 때만 스킵 가능. |
| **prototype_mode** | v2.3 신설. `constraints.quality.prototype_mode: true` 시 Walking Skeleton 강제·Gate 5를 완화. 탐색·실험용 탈출구. |
| **파생 파일** | v2.2 신설. spec.yaml에서 자동 생성되는 파일(`domain.md`, `architecture.yaml`). edit-wins 규칙으로 관리. |
| **edit-wins** | v2.2 규칙. 파생 파일이 사용자 수동 편집되면 이후 자동 재생성 대상에서 제외되고 편집본 보존. 명시적 `--regenerate-derived` 플래그로 강제 재생성. |
| **derived_from** | v2.2 신설. `harness.yaml`의 파생 추적 섹션. source_hash(파생 시점 spec), output_hash(파생 결과), user_edit_detected, 질문 답변 누적. |
| **feature** | 배포 가능한 최소 기능 단위. spec.yaml의 features[]. v2.3.5 기준 `type: skeleton | feature` 2종. |
| **test_strategy** | 피처별 테스트 접근 방식. lean-tdd / tdd / state-verification / integration. (integrator 에이전트와 별개 개념) |
| **Gate** | 품질 관문. 0 = 테스트 증거, 1 = 컴파일, 2 = 스타일, 3 = 커버리지, 4 = 커밋, **5 = 런타임 스모크 (v2.3 필수)**. |
| **Subagent Dispatch** | Claude Code의 병렬 에이전트 실행 패턴. Agent(subagent_type=...) 호출. |
| **핸드오프 (handoff)** | 에이전트 간 파일 기반 통신. v2.1 큐 패턴: `_workspace/handoff/inbox/{to}/{ts}-{from}-{seq}.md`. |
| **anti-rationalization** | 에이전트의 흔한 변명을 사전 반박하는 테이블. 모든 스킬에 최소 2행. |
| **drift** | spec/harness/code 간 불일치. `/harness:check`가 검출. v2.3.7 기준 8종: Spec/Code/Doc/Derived/Generated/Evidence/Anchor/**Include**. |
| **`$include`** | v2.3.7 신설. spec.yaml의 🗒 자유 텍스트 필드에서 외부 md 파일을 참조하는 객체 문법 (`$include: <path>`). JSON Schema 호환 유지 + 일반 lint 도구에서 오작동 없음. |
| **`expanded_spec`** | v2.3.7 신설. spec.yaml에 `$include`를 치환해 얻은 메모리 내 트리. 해시 계산·파생·하네스 생성의 **실질적 입력**. 파일로 저장되지 않음. |
| **include_sources** | v2.3.7 신설. `harness.yaml.generation.include_sources[]`. 외부 md 파일의 path·pointer·output_hash·resolved_at·byte_size·user_edit_detected를 추적. |
| **Include drift** | v2.3.7 신설. 외부 md 파일 편집으로 인한 spec의 의미 변경. 자동으로 Spec drift 전파 (정상 동작), 파일 삭제/크기 초과/형식 위반은 별도 경고. |
| **Phase 0 (파생 단계)** | v2.2 신설. `/harness:sync`의 첫 단계. domain.md·architecture.yaml을 edit-wins 규칙에 따라 재파생. |
| **실행의 글** | v2.1부터의 원칙. 에이전트가 실행하고 훅이 검증하는 구조화된 계약. spec.yaml의 구조적 필드(🔒). |
| **사고의 글** | v2.1부터의 원칙. 사람이 자유롭게 쓰는 서사·의도·맥락. spec.yaml의 자유 텍스트 필드(🗒). |
| **🗒 / 🔒 범례** | v2.3.2 도입. spec.yaml 필드 주석의 성격 표시. 🗒 = 자유 텍스트, 🔒 = 구조적 필드. |
| **파생 뷰 (derived view)** | v2.3.2 명시. `domain.md`·`architecture.yaml`은 spec의 렌더링 결과. 서사의 원천이 아님. |
| **Tier 1-init** | v2.3.3 신설. `/harness:init` 하나만 속하는 일회성 티어. 프로젝트당 1회 실행. Tier 1 일상 명령과 구분. |
| **CQS (Command-Query Separation)** | v2.3.3 원칙. 조회(Query)와 변경(Command)을 명령어 단위로 분리. status는 조회만, init은 변경만. |
| **Preamble** | v2.3.1 신설. 모든 `/harness:*` 명령의 출력 첫 3줄. "이모지 · 명령 · 모드 · 근거" 고정 포맷. |
| **Transparency-by-Preamble** | v2.3.1 원칙. 내부 자동 판별 결과를 사용자에게 숨기지 않고 매번 명시. |
| **auto_mode_selected** | v2.3.1 이벤트. 명령 실행 시 자동 판별된 모드와 근거를 events.log에 기록. |
| **Mode A / B / R / E** | `/harness:spec`의 자동 판별 모드. A = 아이디어 인터뷰(대화형), B = `--from plan.md` 추출(LLM 다층), R = Refine(빈약 필드 보완), E = Edit(기존 spec 수정). |
| **shallow / deep / execute-smoke** | `/harness:check` 검증 깊이. shallow(기본, 파일 스캔+해시), deep(`--deep`, LLM 의미 검증, 주 1회 권장), execute-smoke(`--execute-smoke`, 실제 빌드+smoke 재수행). |
| **drift_status enum** | `state.yaml` 내 드리프트 유형 식별자. v2.3.7 기준 8종: `spec` / `code` / `doc` / `derived` / `generated` / `evidence` / `anchor` / `include_changed`. `/harness:check`가 각각을 독립 판정. |
| **fail-open** | 훅 자체 버그(exit != 0, 2)가 발생해도 작업을 막지 않는 정책. 관측성 상실은 `hook_error` 이벤트로 보상. 운영 중단을 우선하는 fail-closed 정책과 대비. |
| **Phase 0 / Phase 1** | Phase 0 = 파생 파일 동기화(`domain.md`·`architecture.yaml` edit-wins 재파생, v2.2 신설). Phase 1 = 기존 전체 빌드/델타 모드(에이전트·스킬·훅 생성 및 갱신). `/harness:sync`는 Phase 0 → Phase 1 순서로 실행. |
| **파생 파일 ≡ 파생 뷰 (derived view)** | 같은 개념의 두 표현. spec.yaml을 원천으로 하는 2차 산출물(`domain.md`·`architecture.yaml`). v2.3.2부터 "원천이 아닌 뷰"임을 개념적으로 명시. 구현·edit-wins 규칙은 동일. |
| **metadata.source.origin** | spec.yaml의 추출 출처 태그. `planning_doc`(Mode B 추출, 지원), `interview`(Mode A 인터뷰, 지원), `reverse_engineered`(코드 역엔지니어링으로 추출, **v2.3.5 기준 미지원 — 향후 기능**). |

---

## 부록 B — 관련 문서

- [Anthropic Agent Skills Specification](https://github.com/anthropics/skills)
- [Claude Code Plugin Reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code Subagents Guide](https://code.claude.com/docs/en/sub-agents)
- [12-Factor Agents (HumanLayer)](https://github.com/humanlayer/12-factor-agents)
- [OpenAI Harness Engineering](https://openai.com/index/harness-engineering/)

---

## 부록 C — 변경 이력

| 버전 | 일자 | 변경 |
|------|------|------|
| 0.1 | 2026-04-20 | v2.0 초기 드래프트 (원칙 선언, 파일 구조, 명령어 10개 설계) |
| 0.2 | 2026-04-20 | v2.0 → v2.1 구조적 결함 수정 리비전 |
| 0.3 | 2026-04-20 | v2.1 → v2.2 사용자 입력 최소화 — spec 단일 원천 모델 |
| 0.4 | 2026-04-20 | v2.2 → v2.3 실행 가능성 우선 — Walking Skeleton + integrator + Gate 5 필수 |
| 0.5 | 2026-04-20 | v2.3 → v2.3.1 Transparency-by-Preamble 원칙 본격 반영 |
| 0.6 | 2026-04-20 | v2.3.1 → v2.3.2 "사고의 글 vs 실행의 글" 원칙 일관성 회복 |
| 0.7 | 2026-04-20 | v2.3.2 → v2.3.3 `/harness:init` 복원 — CQS 원칙 준수, 업계 관행 일치 |
| 0.8 | 2026-04-20 | v2.3.3 → v2.3.4 7.7 "현실적인 실제 흐름 예시" 섹션 추가 — 네 가지 대표 시나리오 |
| 0.9 | 2026-04-20 | v2.3.4 → v2.3.5 구현 준비도 리뷰 반영 — Critical 7·Major 8·Minor 5건 수정. 부록 D(해시 정규화) 신설, Step 0 신선도 판정 알고리즘, integrator.md 누락/commands 중복 제거 등 |
| 1.0 | 2026-04-20 | v2.3.5 → v2.3.6 2차 리뷰 마감 정리 — 부록 D 역참조 추가(§5.4/§7.3.3/§10.4), 파일 순서 A-B-C-D로 정렬, `canonical_number()` 정의, Step 0 None 가드 순서 수정, D.4 `content_hash` → `node_hash`/`source_hash` 재정리, D.7 테스트 벡터를 `scripts/hash-fixtures.mjs` 기반 정책으로 전환, `reverse_engineered` 미지원 주석. **구현 착수 준비 완료** |
| 1.1 | 2026-04-22 | v2.3.6 → v2.3.7 **`$include` 외부 파일 참조 도입** (additive). spec.yaml의 🗒 자유 텍스트 필드에서 외부 md 파일을 `$include` 객체로 참조 가능. Phase 0에 include 확장 단계 추가, `harness.yaml.generation.include_sources[]` 신설, 부록 D.2 step 0(확장 후 정규화) 명시, drift 종류 1종 추가(Include drift). **스키마 하위 호환** (사용 안 하면 v2.3.6과 동일). Ready-for-Implementation 유지 |

### v2.3.6 → v2.3.7 주요 변경 (`$include` 도입)

**동기**:

v2.3.6 구현 착수 준비 완료 시점에 "긴 서사는 md가 편한데 spec은 YAML이라 긴 마크다운을 YAML 문자열에 박아야 해서 불편하다"는 실용적 질문이 제기됐습니다. 중간언어(Intermediate Representation) 관점에서 재검토하니 YAML 선택은 여전히 옳지만, 사고의 글(🗒 필드)에 한해 **외부 md 파일로 분리**하는 경로를 추가하는 것이 모든 IR 속성(결정론·검증·partial update·문맥 보존)을 해치지 않고 작성성(writability)만 개선함이 확인됐습니다.

**핵심 원칙**:

- **Additive only**: 기존 문법은 모두 그대로 동작. `$include`를 안 써도 v2.3.6과 동일.
- **🗒 필드 한정**: 구조적 계약(🔒)은 `$include` 허용하지 않음. 서사·설명·acceptance 같은 자유 텍스트만.
- **단일 레벨**: 외부 md 안에 또 `$include`는 **확장하지 않음** (v2.4+ 재검토).
- **해시 중립성**: 같은 논리 내용을 inline으로 쓰든 `$include`로 분리하든 spec 해시는 동일. `expanded_spec` 기준 계산.

**주요 변경 (8건)**:

1. **§5.1 `$include` 구문 신설**: 객체 문법(`$include: <path>`), 적용 대상 10개 🗒 필드 표, 6개 검증 규칙(경로·크기 100KB/1MB·존재·standalone·타입 일치·재귀 불허), 확장 의미론(`resolve_includes(spec.yaml) → expanded_spec`), 설계 근거(`!include` vs `$ref` vs `$include` 비교).
2. **§5.4 `harness.yaml.generation.include_sources[]` 신설**: path·pointer(JSONPath)·output_hash·resolved_at·byte_size·user_edit_detected 6필드. drift_status에 `include_changed` enum 추가. 별도 필드로 둔 이유(generated_from/derived_from과의 책임 분리).
3. **§7.3.3 Phase 0 step 0 추가**: `$include` 확장을 Phase 0의 맨 앞 단계로 명시. 드리프트 판정·실패 시 fail-fast·후속 단계 입력은 `expanded_spec` 등. Phase 0 출력 예시에 include 섹션 추가.
4. **부록 D.2 step 0 추가**: spec.yaml 해시는 `expanded_spec` 기준. 외부 md 파일 자체는 별도 `output_hash`로 추적. 다른 파일(harness.yaml 등)에는 `$include` 미허용.
5. **부록 D.4 표 갱신**: `output_hash` 정의에 "`$include` 외부 md" 포함. spec.yaml의 `source_hash`는 `expanded_spec` 기준임을 명시.
6. **부록 D.7 테스트 벡터 T9 추가**: `include_expansion_invariant` — inline 버전과 `$include` 분리 버전이 동일 해시를 내야 함.
7. **§10.4 Include drift 추가** (8번째 drift 유형): 외부 md 편집은 자동 Spec drift 전파(정상), 파일 삭제/크기 초과/형식 위반만 별도 경고.
8. **§4.3 git 정책 · §11.1 scripts · §13.11 열린 질문 · 부록 A 용어 사전**: `docs/spec/**/*.md` 커밋 대상 추가, `scripts/resolve-includes.mjs` 추가, 재귀·깊이 제한 논의 신설, `$include`·`expanded_spec`·`include_sources`·Include drift 4개 용어 추가.

**하위 호환**:

- v2.3.6 spec.yaml은 **그대로 v2.3.7에서 유효**. 스키마 변경은 순수 additive(오직 허용 형태를 1개 추가).
- 해시 값은 `$include`를 쓰지 않는 한 v2.3.6과 **동일**. `expanded_spec` = spec.yaml 인 경우 D.2 step 0은 no-op.
- 기존 `drift_status` enum 값도 그대로 유효. `include_changed`는 새로운 상태 추가일 뿐 기존 전환은 바뀌지 않음.
- `harness.yaml.generation.include_sources`가 없는 기존 파일은 빈 배열로 간주.

**v2.4 이후로 유보된 항목**:

- `$include` 재귀 확장(외부 md 안에 또 include).
- anchor 기반 부분 추출(`$include: foo.md#section-id`).
- 🔒 구조적 필드에 `$include` 허용 여부 (현재 명시적으로 금지).

**판정**: v2.3.6의 "Ready-for-Implementation"을 유지. 본 변경은 구현 복잡도를 크게 증가시키지 않으며(`resolve-includes.mjs` 1개 스크립트 + `include_sources` 추적 로직), 스키마는 additive라 마이그레이션 도구가 필요 없습니다. 구현 시작점은 v2.3.6 권장 순서 + `scripts/resolve-includes.mjs`를 `compute-hash-tree.mjs`보다 먼저 작성하는 것.

---

### v2.3.5 → v2.3.6 주요 변경 (마감 정리)

**동기**:

v2.3.5 직후 독립 리뷰는 "GO-with-minor-cleanup" 판정을 내렸고, 구현 착수를 막지는 않지만 누적되면 실장시 의문을 만들 수 있는 **마감 흠집 7건**을 지적했습니다. 본 판은 이 흠집만 정리합니다. 설계 원칙·구조·명령 체계는 v2.3.5와 **동일**합니다.

**주요 변경** (7건):

1. **부록 D 역참조 보강** (§5.4 / §7.3.3 / §10.4): 해시 필드를 언급하는 모든 절이 부록 D를 참조하도록 한 문단씩 추가. 구현자가 해시 규약을 놓치지 않도록 함.
2. **파일 내 부록 순서 정정**: TOC 순서(A→B→C→D)와 파일 바디 순서를 일치시킴. v2.3.5에선 물리 순서가 A-B-D-C로 어긋나 있었음.
3. **§5.1 `metadata.source.origin` 주석 보강**: `reverse_engineered (v2.3.5+ 미지원, 향후 기능 예약). 현재 스키마 검증은 값만 허용하고 파이프라인에선 fallback to 'idea'`를 명시.
4. **부록 D.2 `canonical_number()` 정의 추가**: 정수·부동소수 수렴 규칙을 7단계로 명시 (`42` == `42.0` == `4.2e1` → `"42"`). IEEE 754 round-trip + JS `Number.prototype.toString` 경계 규칙. 해시 안정성의 함정 제거.
5. **§7.3.5 Step 0 의사코드 수정**: `last_smoke_ts is None` 가드를 `git log --since` 호출 **이전**으로 이동. None이면 git 호출을 생략하고 `verdict="unknown"`으로 조기 종료. 종전 순서는 `--since=""`로 전체 히스토리를 스캔하는 버그였음.
6. **부록 D.4 용어 재정리**: `content_hash`를 제거하고 `source_hash`(리프/서브트리)와 `node_hash`(Merkle 내부 노드)로 이원화. 과거 자료의 `content_hash`는 읽기 전용 alias 취급. 의사코드(D.6)도 두 함수로 분리.
7. **부록 D.7 테스트 벡터 정책 전환**: 문서에 해시 기대값을 박지 않고 `scripts/hash-fixtures.mjs --verify` / `--update`를 단일 진실로 삼음. 케이스 8종(empty_map, empty_list, simple_map, key_order_invariant, unicode_nfc, int_float_collapse, merkle_composition, korean_keys)을 표로 기술.

**2.2 불변 원칙 표 정리** (v2.3.6 추가):

v1에서 계승된 "설계는 사용자의 몫 — 도구는 실행을 자동화, 설계는 촉진만" 원칙을 §2.2 표에서 제거했습니다. v2.2 "사용자 입력 최소화"·"파생 + 편집 존중" 및 v2.3 "실행 가능성 우선(Walking Skeleton·integrator 강제)"이 시스템 설계 상당 부분을 도구가 자동 결정·강제하는 방향으로 이동시켰기 때문에, 해당 항목이 "불변 원칙"으로 남아 있으면 다른 신규 원칙과 논리적으로 충돌합니다. 제품 설계(무엇을 만들 것인가)는 여전히 사용자가 spec.yaml에서 결정하지만, 시스템 설계(어떻게 조립하는가)는 파생·강제 영역으로 이전됐다는 점을 표 하단 주석에 남겼습니다.

**§7.7 시나리오 2종 추가** (v2.3.6 추가):

§7.7 현실적인 실제 흐름 예시가 네 가지에서 여섯 가지로 확장됐습니다.

1. **신규 프로젝트 + 기획문서 있음**: 빈 레포에서 `plan.md` 한 장을 들고 시작하는 가장 흔한 실전 케이스. `/harness:init`(1회, 빈 레포) → `/harness:spec --from plan.md`(Mode B 다층 추출, 누락 시 Mode A 폴백) → `/harness:sync`(해시 트리 초기 생성) → `/harness:work --auto`(plan.md 매핑 순서대로 skeleton). 기존 "기존 프로젝트 + 기획문서 있음"과의 차이는 `init`이 빈 디렉터리를 가정하는지 여부와 `sync` 단계가 전체 빌드를 수행한다는 점입니다.

2. **기존 프로젝트 + 기획문서 없음** (13.3 미래 과제의 현재 폴백): 자동 역엔지니어링(`reverse_engineered` origin)은 v2.3.6에서 여전히 미지원이므로, 현 폴백 경로만 명시했습니다 — `/harness:init`(기존 코드는 건드리지 않고 `.harness/`만 설치) → `/harness:spec`(Mode A 인터뷰, 사용자가 기존 코드를 참고 자료로 보며 답변, origin은 `idea`로 기록) → `/harness:sync` → `/harness:check`(권장: spec과 기존 코드의 일관성 스냅샷) → `/harness:work --feature <id>`(신규·변경 피처만 진입 — `--auto` 전면 실행은 Walking Skeleton 재생성 충돌 위험으로 피함). 완전 자동화는 §13.3에 "자동 스캔 40% + 대화형 인터뷰 60% 하이브리드" 비전으로 남겨두고, 실제 구현은 v2.4+에서 별도 설계 문서로 다룹니다.

`--auto` 자동 중단 조건 문단의 "네 시나리오"도 "여섯 시나리오"로 갱신. footer "참고 — 직접 다루지 않는 경우" 블록의 레거시 역엔지니어링 항목은 "기존 프로젝트 + 기획문서 없음" 시나리오로 포인터가 연결되도록 재작성.

**§7.7 "기존 프로젝트 + 기획문서 없음" 주석 보강 + §13.3 Mode I 명명** (v2.3.6 추가):

위 2번 시나리오에 대해 "이상적으로는 도구가 기존 코드를 읽어 spec을 자동 구성하고 필요한 부분만 질문해야 한다"는 독자 기대가 실제로 타당한지, v2.3.6이 그중 무엇을 유보하고 있는지를 시나리오 블록 바로 아래 주(註)로 명시했습니다 — 자동화 가능 필드(`tech_stack.framework`·`deliverable.type`·feature 후보)와 자동화 불가 필드(`domain.business_rules`·`acceptance`·`invariants`)를 구분하고, "40% 자동 스캔 + 60% 인터뷰" 하이브리드는 §13.3의 향후 과제임을 연결. 동시에 §13.3을 **Mode I (Ingest)**로 정식 명명하고 진입 경로(`/harness:spec --scan` 또는 `origin: reverse_engineered` 활성화)·자동화 가능 필드 목록·Mode R(refine) 재사용 계획을 단락으로 정리했습니다. **구현 범위 변경 없음** — v2.3.6은 여전히 Mode A 폴백만 제공하며, Mode I 정식 스펙은 v2.4 이후로 예약.

**스키마·원칙 변경 없음**: 사용자 YAML 파일은 영향받지 않습니다. 해시 계산 결과가 v2.3.5 대비 달라지지 않습니다(D.2의 숫자 규칙은 기존 구현이 암묵적으로 따랐던 것을 명시화한 것).

**하위 호환**: v2.3.5에서 동작하던 모든 흐름이 v2.3.6에서 그대로 동작합니다.

**판정**: 이 판을 기준으로 구현 착수 가능. `harness-boot` 레포의 `tests/fixtures/sample-spec.yaml`, `scripts/hash-fixtures.mjs`, `commands/init.md` 순으로 시작하는 것을 권장.

---

### v2.3.4 → v2.3.5 주요 변경 (구현 준비도 리뷰 반영)

**동기**:

v2.3.4까지 설계 원칙·구조·명령 흐름이 수렴했지만, 실제 구현에 착수하기 전 독립 리뷰에서 "구현자가 코드 한 줄을 쓰기 위해 추가 결정을 내려야 하는 공백"이 20건 발견되었습니다. 개별 결함은 작지만 누적되면 에이전트·훅·해시 시스템 전반의 비호환을 낳을 수 있었기에 **설계 원칙은 건드리지 않고** 공백·불일치·수치 미명세만 일괄 정리합니다.

**주요 변경 (Critical 7)**:

1. **부록 D — 해시 정규화 규약 신설**: Canonical YAML → Canonical JSON → SHA-256의 결정론적 변환 절차를 의사코드와 테스트 벡터로 명세. 델타 sync·edit-wins·drift 검출 모두가 **구현자에 따라 다른 해시를 내는 위험** 제거.
2. **7.3.5 Step 0 신선도 판정 알고리즘**: `last_commit_ts`를 `git log --since` + 런타임 경로 glob + 문서/하네스 자산 제외로 구체화. "stale인지 판정하는 법"을 기술적으로 고정.
3. **4.1 파일 구조에 `integrator.md` 추가**: v2.3에서 도입한 integrator 에이전트가 파일 구조 다이어그램에서 누락되어 있던 불일치 수정.
4. **11.1 `commands/` 중복 블록 제거**: 두 번 쓰인 commands/ 디렉터리 리스트 하나로 통합, 실제 v2.3.5 상태(init 1급 + 진단 4개) 반영.
5. **`features[].type`에서 `integration-check` 삭제**: 의미 미정의 값 제거. `skeleton | feature` 2종으로 고정. 부록 A 용어 사전도 동기화.
6. **7.3.5 check에 Preamble 예시 추가**: v2.3.1에서 도입한 Preamble 규약이 check 출력 예시에 빠져 있던 불일치 해결.
7. **8.4 버전 관리 3종 분리**: 설계 문서 버전 ↔ 플러그인 버전 ↔ 사용자 YAML 스키마 버전을 표로 분리. 문서 bump가 사용자 파일 bump를 유발하지 않는다는 정책 명시.

**주요 변경 (Major 8)**:

- **prototype_mode 경로 통일** (5.1/5.5/7.3.4): 본문 전반에서 `constraints.quality.prototype_mode: true` 형태로 정규화.
- **doc_sync.watch 의미 명시** (5.1 스키마): architecture.yaml.modules[].exports와 독립적으로 작동하며 상호 트리거됨을 주석 추가.
- **7.4 레거시 shim 표**: `/harness:init`은 이름이 동일해 shim이 필요 없음을 비고 열로 명시.
- **Mode B BM25 구현 명세**: 토크나이저·불용어·파라미터(k1=1.5, b=0.75)·섹션 단위 비교·임계값 3단(0.55/0.35/low).
- **델타 부분 실패 복구 알고리즘**: `_delta_manifest.json` 그룹 단위 스테이징, 의존자 전파 롤백, events.log 기록, 재시도 가이드까지 8단계로 구체화.
- **유사 이름 경고 임계**: Levenshtein ≤ 2 AND 편집 비율 ≤ 0.34, 소문자/구분자 정규화.
- **session-start-bootstrap 검증 범위**: shallow(스키마 + root_hash) + 경고만 출력(차단 없음), fail-open 원칙 일관화.
- **스키마 version 필드 갱신 정책**: 스키마 구조 변경 시에만 bump, 문서 버전과 독립. 마이그레이션 도구 명명(`migrate-schema-{from}-{to}.mjs`).

**주요 변경 (Minor 5)**:

- **TOC에 부록 항목 추가**: A·B·C·D 직접 링크.
- **부록 A 정리**: "manifest (v1 잔재)" 용어 제거. Mode A/B/R/E, shallow/deep/execute-smoke, drift_status enum, fail-open, Phase 0/1, 파생 파일≡파생 뷰, metadata.source.origin(reverse_engineered=미지원) 추가.
- **파생 파일/파생 뷰 상호 참조** 명시.
- **Gate 5 smoke 대상 주석**: `type: skeleton` 설명에 "Gate 5 smoke 검증 대상" 명시.

**스키마 변경 없음**: `features[].type` 열거자에서 미사용 값 하나를 제거한 것만이 실질 변경. 기존 spec.yaml은 영향받지 않음. 사용자 YAML의 `version` 필드는 **bump하지 않음** (8.4 정책에 따른 독립).

**하위 호환**: v2.3.4 기준으로 동작하던 모든 흐름이 v2.3.5에서 그대로 동작합니다. 새 해시 규약(부록 D)은 "기존 구현과의 차이" 없이 기존 기대 동작을 **정식화한 것**이므로 재계산이 발생하지 않습니다. 단, 구현자는 부록 D.7 테스트 벡터를 회귀 테스트로 도입해야 합니다.

**설계 방침**: **설계 원칙은 한 줄도 바꾸지 않음**. 이 리비전은 "명세를 읽고 코드를 쓸 때 구현자가 따로 결정을 내려야 하는 공백"만 메웁니다. 따라서 13장 열린 질문, 9·10·11장 구조, 6장 에이전트 매트릭스는 불변입니다.

---

### v2.3.3 → v2.3.4 주요 변경 (실사용 흐름 예시 추가)

**동기**:

v2.3.3까지의 설계 문서는 명령어 체계(7장)와 생성 파이프라인(9장)을 구조적으로 기술했지만, "**내 상황에서 어떤 순서로 치면 되지?**"라는 실용적 질문에 곧장 답하지 못했습니다. 신규 사용자가 자기 상황(아이디어만 있는가, 기획문서가 있는가, 이미 하네스가 설치되어 피처를 추가하는 중인가, 스펙 변경 없는 버그 수정인가)에 맞는 명령 시퀀스를 머릿속에서 조립해야 하는 부담이 있었습니다.

**주요 변경**:

1. **7.7 "현실적인 실제 흐름 예시" 섹션 신설**
   - 네 가지 대표 시나리오를 실제 터미널 명령 블록으로 제시
     - 신규 프로젝트 + 아이디어만 있음
     - 기존 프로젝트 + 기획문서 있음
     - 피처 추가 유지보수
     - 스펙 변경 없는 버그 수정
   - 각 블록에 해당 Mode(A/B/E) 또는 자동 판별 모드 주석
   - `--auto`의 공통 중단 조건 요약 (Gate 5 실패·iteration 초과·모호성 질문·skeleton 우회 시도)
   - 이 절이 다루지 않는 경로(레거시 역엔지니어링·v1 마이그레이션·수동 단계별 진행) 참고 안내

**스키마 변경 없음**: 순수 문서 보강. 명령어·파일 구조·에이전트·Gate 체계·해시 트리·스키마·이벤트 계약 전부 그대로 유지.

**하위 호환**: v2.3.3 기준으로 동작하던 모든 흐름이 v2.3.4에서 그대로 동작합니다. 기존 `.harness/` 프로젝트는 영향받지 않습니다.

**설계 방침**: 예시를 **문서의 정규 부분(7.7)**으로 삼되, 각 시나리오를 **최소 4~5줄의 명령 블록**으로 한정했습니다. 과도한 주석·분기 설명을 피해 "보면 바로 따라 친다"는 실용성을 우선합니다. 깊은 설명은 기존 7.3 각 명령 상세 섹션이 담당합니다.

---

### v2.3.2 → v2.3.3 주요 변경 (init 복원)

**동기**:

v2.1에서 명령어 간소화를 하며 `/harness:init`을 `/harness:status`의 "상태 기반 자동 init"으로 흡수했습니다. 의도는 "사용자가 기억할 명령 수를 줄이자"였으나, **세 가지 원칙을 동시에 위반**하는 설계였습니다:

1. **CQS (Command-Query Separation) 위반** — `status`는 조회 명령인데 디렉터리 생성이라는 부작용을 수행
2. **Transparency-by-Preamble (v2.3.1) 위반** — status를 쳤는데 몰래 init이 일어남. 이 원칙이 막으려던 바로 그 안티패턴
3. **업계 관행 불일치** — `npm init`, `git init`, `cargo new`, `uv init`, `create-react-app` 등 **모든 도구가 명시적 초기화 명령**을 가짐. harness-boot만 예외일 이유 없음

**해결책**: `/harness:init`을 **1급 명령으로 복원**. 단 사용 빈도가 "프로젝트당 1회"이므로 **Tier 1-init**이라는 별도 티어로 학습 우선순위는 일상 명령과 분리.

**결과적 흐름**: `init → spec → sync → work` 선형 흐름. Claude Code 일반 사용자의 멘탈 모델과 일치.

**주요 변경**:

1. **7.1 설계 원칙에 "v2.3.3 보정" 블록 추가** — init 복원 근거 (CQS·Transparency·업계 관행)
2. **7.2 명령어 지도 재구성**
   - Tier 1-init (1개): `/harness:init`
   - Tier 1 일상 (3개): `/harness:spec`, `/harness:sync`, `/harness:work`
   - Tier 2 진단 (4개): `/harness:status`(이동), `/harness:check`, `/harness:events`, `/harness:metrics`
3. **7.3.1 `/harness:init` 섹션 신설** — 선조건, 협업 정책 선택, 스켈레톤 생성, gitignore, 완료 안내
4. **7.3.8 `/harness:status` 재작성** — 순수 읽기 전용으로 환원. A상태(uninstalled)는 "`/harness:init`을 실행하세요" 안내만. 어떤 파일도 생성·수정 안 함
5. **7.3.2 `/harness:spec`** — 전제 조건으로 "`/harness:init` 완료" 명시. `.harness/` 없으면 에러
6. **7.4 레거시 shim 표 갱신** — `init → init (유지)`, 나머지 shim은 그대로
7. **7.5 명령어 흐름 다이어그램** — `init → spec → sync → work` 선형으로 재작성, status는 진단군으로 이동
8. **9.1 전체 플로우 다이어그램** — 동일하게 init 중심 선형 흐름
9. **11장 플러그인 레포 `commands/` 구조** — `init.md` 부활, `_legacy/init.md` 제거
10. **용어 사전에 Tier 1-init, CQS 추가**

**하위 호환**: v2.3.2 → v2.3.3은 **스키마 변경 없음**. 명령어 재구성만. 기존 `.harness/` 프로젝트는 그대로 동작 (이미 init이 끝난 상태이므로 새 `/harness:init`은 "이미 설치됨" 에러 — 안전).

**의도치 않은 부작용 없음**: v2.1의 "자동 init" shim은 내부 구현 세부사항이었고, 실제 v2.1 출시 이전이므로 사용자 영향 없음. 순수 설계 개선.

---

### v2.3.1 → v2.3.2 주요 변경 (원칙 일관성 회복)

**동기**:

2.1에서 선언한 **"사고의 글은 자유로워야 한다, 실행의 글은 구조화되어야 한다"** 원칙이 v2.2 파생 설계에서 의도치 않게 훼손되었습니다. 모든 입력을 spec.yaml로 수렴시키면서 "사고의 글의 자리가 사라지거나, 아니면 domain.md의 Decision Log 같은 애매한 편집 영역이 됨"이라는 모순이 있었습니다.

**재해석**: 사고의 글과 실행의 글의 분리는 **파일이 아니라 필드의 성격**으로 이뤄집니다. spec.yaml은 두 글을 한 파일에 담되, YAML 구조가 경계를 보장합니다. v1.0 plan.md의 실패는 "한 파일"이 아니라 "구조 없이 섞음"의 문제였습니다.

**주요 변경**:

1. **2.1 원칙 재조명** — "두 글의 공존 방식" 표 추가
   - 실행의 글 = 구조적 필드 (`features[].id`, enum, 숫자, ID, 참조)
   - 사고의 글 = 자유 텍스트 필드 (`description`, `vision`, `overview`, `rationale`)
   - 뷰 = 파생 파일 (`domain.md`, `architecture.yaml`)

2. **5.1 spec.yaml 필드 주석에 🗒/🔒 범례 추가**
   - 🗒 = 자유 텍스트 (사고의 글, 마크다운 OK, 길이 자유)
   - 🔒 = 구조적 필드 (실행의 글, 스키마 강제)
   - 필드별로 어느 쪽인지 명시

3. **5.2 domain.md에서 Decision Log 섹션 제거**
   - 도메인.md를 **순수 렌더링 뷰**로 단순화
   - 의사결정 이력은 git 커밋 메시지·PR 설명·ADR(`docs/adr/`)에 위임
   - 재발명하지 않음

4. **2.3 원칙 "사용자 입력 최소화" 정제**
   - "구조화된 파일은 spec.yaml 하나, 서사는 spec.yaml 자유 텍스트 필드 + git + ADR"
   - 파생 파일 편집은 드문 예외 (edit-wins는 안전망)

5. **3.2 책임 분담 표**에 자유 텍스트 필드 명시
   - "사고의 글의 자리" 문단 추가

**검토한 대안 — `.harness/notes/` 디렉터리 신설**: 초기 제안되었으나 **YAGNI 원칙에 따라 기각**. 이유:
- spec.yaml의 기존 자유 텍스트 필드가 서사의 99% 요구를 커버
- 의사결정은 git이 수십 년간 해결한 문제 — 재발명 불필요
- ADR 관행은 `docs/adr/`가 업계 표준 — harness-boot이 간섭할 영역 아님
- 별도 디렉터리는 "어디에 쓰지?" 고민만 증가

**하위 호환**: v2.3.1 → v2.3.2는 **스키마 변경 없음**. 필드 의미 재해석만. 기존 spec.yaml은 그대로 호환.

---

### v2.3 → v2.3.1 주요 변경 (투명성 우선)

**동기**:

v2.1의 명령어 축소(10개 → 7개)와 v2.2의 내부 모드 자동 판별(Mode A/B/R/E, 전체/델타, edit-wins)은 인지 부담을 줄였지만, 대가로 **"지금 뭐가 일어나는지" 투명성**을 잃을 위험이 있었습니다. 13.10에 열린 질문으로만 남아 있던 완화책을 **정식 원칙과 명세로 승격**합니다.

**주요 변경**:

1. **Transparency-by-Preamble 원칙 신설** (2.3)
   - v2.3의 세 원칙(Runtime-Verified First + 기존) 뒤에 네 번째 원칙으로 배치
   - 3줄 Preamble 구조 + 강제 수준 + 이벤트 로깅 연동

2. **7.6 Preamble 규약 섹션 신설**
   - 필드별 명세(이모지·명령·모드·근거)
   - 명령별 mode 값 목록 (7개 명령 × 2~4개 모드 = 고정 enum)
   - 근거 표현 가이드 (10단어 이내, 구체적 숫자·필드 언급 권장)
   - auto_mode_selected 이벤트 포맷
   - `/harness:check` 회귀 검증 (preamble 없는 실행 감지)

3. **기존 출력 예시 8개 Preamble 적용** (7.3.1~7.3.7 및 레거시 shim)
   - /harness:status A/B/C/D 상태 모두
   - /harness:sync Phase 0 + 델타 완료
   - /harness:work Gate 5 실패
   - /harness:events 필터
   - /harness:metrics window
   - 레거시 shim (`↪️` 이모지)

4. **13.10을 "해결된 원칙"으로 재분류**
   - "열린 질문"에서 제거하고 해결 근거(2.3 원칙 + 7.6 규약 + auto_mode_selected + /harness:check 검증) 명시
   - 남은 관찰 과제(10단어 제한 적정성)는 구현 후 검증 항목으로 별도 표기

**왜 minor 버전(v2.3.1)인가**:

v2.3에서 이미 전체 구조가 확정되었고, 이번 변경은 **기존 명령과 스키마를 수정하지 않고 출력 규약만 추가**했습니다. 명령 목록·파일 구조·에이전트·Gate 체계 모두 그대로. 기능적 회귀 없음.

---

### v2.2 → v2.3 주요 변경 (실행 가능성 우선)

**동기**:

v1.0 실사용에서 발견된 치명적 실패 패턴 — 에이전트가 피처별로 "완료" 보고했지만 실제 프로젝트를 실행하면 메인 함수가 없어 빌드·실행 자체가 불가능한 상태. v2.2까지 설계는 **"feature 단위 쪼개기와 각각 검증"에는 철저**했으나, **"전체가 돌아가는가"는 누구의 책임도 아닌 공백**이었습니다. v2.3은 세 장치를 **기본 활성**으로 도입해 이 공백을 구조적으로 막습니다.

**용어 사전 정리** (적용 전 선행 결정):
- "Bootstrap feature" 제안은 기존 3가지 bootstrap 용어(session-start-bootstrap 훅, 부트스트랩 역설, 부트스트랩 선조건)와 **충돌**하므로 폐기
- 업계 표준 패턴명 **"Walking Skeleton (최소 실행 뼈대)"** 채택 — Alistair Cockburn 용어

**축소 결정** (처음 7개 제안 중 3개를 단순화):
- Gate 5a/5b 이중 분리 폐기 → 단일 Gate 5 (5b가 성공하면 5a는 자동 보장이므로 중복)
- 신규 이벤트 6종 → 4종 (integration_attempted은 기존 agent_dispatched로 대체, runtime_verified는 smoke_passed와 동의어)
- /harness:check의 매번 재실행 → 기본은 "증거 신선도 검증", 재실행은 `--execute-smoke` 플래그

**최종 변경 (축소 후)**:

1. **deliverable 섹션 신설** (5.1, 최상위 필수)
   - type: cli | web-service | game | worker | library | static-site
   - entry_points[]: command, build_command, health_check (타입별 기대값)
   - smoke_scenarios[]: id, steps, success_criteria — 최소 1개

2. **Walking Skeleton 강제** (5.1 검증 규칙 2번)
   - `features[0]`이 반드시 `type: skeleton`
   - skeleton이 done이 아니면 다른 feature 진행 불가 (5.5 불변 조건)
   - `prototype_mode: true`일 때만 예외

3. **integrator 에이전트 신설** (6.3.1)
   - 11개 → 12개 에이전트로 확장
   - Tool 권한: Read/Glob/Grep/Write/Edit/Bash (빌드·실행 필요)
   - 매 피처 Gate 4 통과 직후 dispatch, Gate 5 담당

4. **Gate 5 필수화** (5.5, 5.6)
   - 기본 required_gates: [0,1,2,3,4,5]
   - evidence.smoke 별도 필드 신설 — verified_at, build_sha, health_check_passed, scenarios_passed
   - prototype_mode 시 `evidence.smoke: { skipped: true, reason: "prototype_mode" }`

5. **events.log 4종 추가** (5.6)
   - build_succeeded, build_failed, smoke_passed, smoke_failed

6. **/harness:work 사이클 확장** (7.3.4)
   - 6단계 → 8단계 (Walking Skeleton 선조건 + integrator dispatch + Gate 5 판정 추가)
   - auto 모드도 Gate 5 실패 시 반드시 중단 (v1.0 재발 방지)

7. **/harness:check Step 0 실행 가능성** (7.3.5)
   - 증거 신선도 검증 (빠름, 기본)
   - `--execute-smoke` 플래그로 실제 빌드·실행 재검증 (느림)

8. **스키마 버전 2.2 → 2.3**: 모든 YAML (`$schema` URL, `version` 필드)

**v1.0 재발 방지 증명**:

사용자가 v1.0에서 경험한 시나리오(F-001~F-004 게임 기능 피처들이 각자 "완료"되었지만 main 함수가 없어 실행 불가)가 v2.3에서 발생하려면:
- Walking Skeleton 강제를 우회해야 함 (prototype_mode 명시 승인 필요)
- 또는 skeleton feature에서 build_command를 거짓 성공시켜야 함 (integrator의 exit-code 검증 회피 필요)
- 또는 smoke_scenarios를 0개로 둬야 함 (검증 규칙 3번이 거부)

세 조건 모두 **구조적으로 차단**되며, 의도적으로 하려 해도 명시적 override 흔적이 events.log에 남습니다.

---

### v2.1 → v2.2 주요 변경 (사용자 입력 최소화)

(앞선 리비전 — 내용 아래 유지)

**핵심 패러다임 전환**:

v2.1은 `spec.yaml`·`domain.md`·`architecture.yaml` 세 파일 모두 사용자 편집 대상으로 상정했습니다. 이는 세 곳에 흩어진 정보의 일관성 유지를 사용자에게 맡기는 설계로, 드리프트와 인지 부담의 원인이었습니다.

v2.2는 **사용자 입력을 `spec.yaml` 하나로 축소**하고, `domain.md`·`architecture.yaml`을 spec에서 **파생**합니다. 사용자는 "나는 spec만 쓰면 된다"는 단일 멘탈 모델로 작업합니다.

**주요 변경**:

1. **파생 + 편집 존중 (Derive-first, Respect-edit) 원칙 신설** (2.3)
   - 파생 파일은 기본 자동 재생성
   - 사용자가 편집하면 편집본 우선 (edit-wins)
   - 3-way merge 대신 이진 규칙으로 단순화
   - 해시 비교로 편집 감지, 강제 재생성은 `--regenerate-derived`

2. **`domain.md`를 파생으로 재설계** (5.2)
   - 결정적 템플릿으로 spec.domain 렌더링
   - ~~Decision Log 섹션만 사용자 자유 영역~~ → **v2.3.2에서 제거**. 의사결정은 git·ADR 관행에 위임
   - 선택적 LLM 프로즈 폴리싱 옵션

3. **`architecture.yaml`을 파생으로 재설계** (5.3)
   - 필드별 파생 알고리즘:
     - `pattern`: spec 복사
     - `layers`: pattern별 사전 템플릿
     - `modules.name`: `features[].modules` 유니온
     - `modules.layer`: 이름 휴리스틱 + 엔티티 매칭 + 모호 시 사용자 질문
     - `allowed/forbidden_dependencies`: 패턴 규칙 기반
     - `exports`: 파생 대상 아님 (코드 실행 중 발견)
   - 모호성 질문: `/harness:sync` 실행 중 대화형, 답변은 `derived_from.architecture_yaml`에 누적 저장되어 재질문 없음

4. **`harness.yaml`에 `derived_from` 섹션 신설** (5.4)
   - `domain_md`: source_hash, output_hash, user_edit_detected
   - `architecture_yaml`: 동일 + layer_assignments, user_decisions 누적 저장소

5. **`/harness:sync`에 Phase 0 파생 단계 도입** (7.3.3)
   - Phase 0: 파생 파일 동기화 (매 sync 선행)
   - Phase 1: 기존 전체 빌드/델타 모드
   - `--regenerate-derived[=domain,architecture]` 플래그 추가

6. **3-way merge 제거 → edit-wins 통일** (7.3.3 델타 모드, 9.2, 10.4)
   - 파생 파일뿐 아니라 `.claude/agents/` 등 생성 파일도 동일 규칙
   - `--force`로 전체 재생성, `--regenerate-agents`로 특정 영역만

7. **드리프트 분류 갱신** (10.4, 6종 → 7종)
   - Derived drift, Generated drift 추가 (둘 다 edit-wins 규칙)

8. **스키마 버전 2.1 → 2.2**: 모든 YAML 파일 (`$schema` URL과 `version` 필드)

---

### v2.0 → v2.1 주요 변경

(앞선 리비전 — 내용 아래 유지)

### v2.0 → v2.1 주요 변경

**치명적 결함 수정**:
- **C1 (SSoT 위반)**: `state.yaml`의 `title`/`priority`/`test_strategy` 복제 제거. spec.yaml이 유일한 원천, 표시 시점에 조인 (5.5, 7.3.1)
- **C2 (부트스트랩 역설)**: `.claude/`까지 트랜잭션 범위 확장. `.harness.tmp/` + `.claude.tmp/` 동시 원자 교체, 세션 재시작 권장 고지 (7.3.3, 9.2)
- **C3 (스키마 표준 위반)**: `schema:` → `yaml-language-server: $schema=...` 지시자로 교체. VSCode YAML 확장 자동 인식 가능 (5.1, 5.4, 5.5)
- **C4 (해시 입도)**: 단일 `spec_hash`를 Merkle 스타일 **해시 트리**로 교체. 피처별/모듈별 델타 업데이트 가능 (5.4, 7.3.3 델타 모드)
- **C5 (증거 전략 편향)**: Gate 0 증거를 4개 전략별 discriminated union으로 재설계. 각 전략의 Gate 0 계약 명문화 (5.5)
- **C6 (핸드오프 동시성)**: `{from}->{to}.md` 덮어쓰기 모델 → `inbox/processing/archive` 큐 패턴 (4.1, 부록 A)

**구조적 개선**:
- **S1**: `tdd-test-writer` 에이전트를 파일 목록에 추가 (4.1)
- **S2**: `anti-rationalization.md` 프로토콜 파일 신설 (5.8)
- **S3**: `doc_sync`를 `{target, sections, watch, severity}` 구조로 재설계 (5.1)
- **S4**: 앵커 규약을 헤딩 앵커 `{#id}`로 통일. HTML 주석 앵커 폐기 (5.8)
- **S5**: git 커밋 정책 표 신설 (4.3)
- **S6**: LLM 파싱 다층 검증 (출처 라인, confidence, round-trip, fallback) (7.3.2 Mode B)

**공백 보완**:
- **G1**: 11개 에이전트 × 8개 tool 권한 매트릭스 신설 (6.3.1)
- **G2**: `/harness:events`, `/harness:metrics` 진단 명령 신설 (7.3.6, 7.3.7)
- **G3**: MCP 통합 정책 명시 (무관심 입장, 13.9)
- **G4**: Monorepo 시나리오를 열린 질문에 추가 (13.8)
- **G5**: 훅 실행 환경 계약(Node.js ≥20, zero-dep, 5초 타임아웃, fail-open) (5.7)

**사용자 경험 간소화**:
- **10개 → 4 Tier 1 + 3 Tier 2 명령어**. `init+spec+refine` → `/harness:spec`, `build+evolve` → `/harness:sync`, `start` → `/harness:work`, `audit` → `/harness:check`
- **`/harness:status`를 스마트 진입점으로 승격**. 신규 사용자는 이 하나만 기억하면 상태 기반 다음 행동 안내
- 레거시 shim(`commands/_legacy/`)으로 v2.0 명령어 호환 유지, v3에서 제거 예정

**기타**:
- `conditional` DSL(mini-expression)을 사전 정의 enum(`has_tdd`, `has_lean_tdd`, …)으로 교체. 파서 불필요 (M4, 5.4)
- `events.log` 로테이션 책임 주체 명시 (session-start 훅, 5.6)
- `conversation_language`/`comment_language` 소비 지점 주석으로 명시 (5.4)
- `entity.sensitive` 자동 추론 규칙 명문화 (정규식 + override 메커니즘, 5.1)

---

## 부록 D — 해시 정규화 규약 (Canonical Hashing) · v2.3.5 신설, v2.3.6 정리

harness-boot의 여러 메커니즘(델타 sync, 파생 파일 edit-wins, `/harness:check` drift 검출)은 YAML 콘텐츠에 대한 **결정론적 해시**를 전제합니다. 이 부록은 구현자가 라이브러리에 의존하지 않고도 동일한 해시 값을 재현할 수 있도록 규약을 명세합니다.

### D.1 목표

- 같은 논리적 구조는 **직렬화 표현과 무관하게 같은 해시**를 갖는다 (공백·줄바꿈·키 순서·주석에 의존하지 않음).
- **주석은 해시에 포함되지 않는다** (사고의 글은 자유롭게 수정 가능).
- 사용자가 `.harness/spec.yaml`을 다르게 들여쓰기로 저장하더라도 같은 논리면 delta 검출이 재트리거되지 않는다.

### D.2 Canonical JSON 변환 절차

**입력**: YAML 텍스트 (또는 YAML에서 파싱된 값 트리)

**절차**:

0. **`$include` 확장** (v2.3.7 신설, spec.yaml 해시 계산에만 적용):
   - spec.yaml 파싱 후 §5.1의 `$include` 객체를 외부 md 파일 내용 **string**으로 치환한 `expanded_spec` 트리를 만든다.
   - 확장은 **해시 계산 전에** 반드시 수행. 즉 **spec의 source_hash/node_hash는 `expanded_spec` 기준으로 계산**한다. 원본 spec.yaml(포인터 보존) 기준으로 계산하지 않는다.
   - **이유**: (a) 같은 논리 내용을 inline으로 쓰든 `$include`로 분리하든 동일한 해시가 나와야 한다(표현 중립성). (b) 외부 md가 바뀌면 spec의 의미가 바뀐 것이므로 해시도 바뀌어야 한다.
   - 외부 md 파일 **자체**의 해시는 별도로 `harness.yaml.generation.include_sources[].output_hash`에 기록한다 — 이 해시는 canonical JSON이 아니라 **파일 바이트의 SHA-256 원시값**이다(파일 단위 edit 감지용, D.4의 `output_hash` 정의와 동일 취급).
   - 확장 실패(§5.1 검증 규칙 위반) 시 해시 계산을 중단하고 sync도 fail-fast.
   - 이 단계는 spec.yaml 이외의 파일(harness.yaml, state.yaml 등) 해시 계산에는 **적용되지 않는다** — 이들 파일에는 `$include`가 허용되지 않는다.

1. **파싱** — YAML 1.2 파서로 트리로 읽는다. `!!binary`, 앵커(`&`), 별칭(`*`)은 파싱 단계에서 확장하여 보통의 값 트리로 평탄화한다.
2. **주석 제거** — 파싱 결과에는 주석이 이미 없다. YAML 전처리를 직접 수행한다면 `#` 이후 줄 끝까지 + 문서 주석 블록을 모두 제거한다.
3. **타입 규범화**:
   - 문자열: Unicode NFC 정규화 적용.
   - 숫자(`canonical_number()` 규칙, v2.3.6 명시):
     1. 입력값이 `NaN` / `±Infinity` 이면 오류 발생 (하네스 데이터에선 발생 불가).
     2. **정수 수렴**: 부동소수 `v` 에 대해 `v == trunc(v)` 이고 표현 범위가 ±2^53 이내이면 정수로 간주. 즉 `42`, `42.0`, `4.2e1`은 모두 `"42"` 바이트열.
     3. 부호 0 제거: `-0`, `-0.0` → `"0"`.
     4. 정수 직렬화: 부호 포함 10진수(`-?[0-9]+`), 선행 0 없음. 예: `+7` → `"7"`, `007` → `"7"`, `-3` → `"-3"`.
     5. 비정수 실수 직렬화: 다음 정규식으로 **유일한** 표현을 선택 — `-?[0-9]+\.[0-9]+([eE]-?[0-9]+)?`. 규범 형태:
        - 소수점은 항상 포함 (`3.14`, `1.0e10`).
        - 지수 표기는 `|v| < 1e-4` 또는 `|v| >= 1e21` 일 때만 사용 (JavaScript `Number.prototype.toString` 규칙과 일치).
        - 지수부는 소문자 `e`, 부호 필수는 음수일 때만 (`1.5e-7`), 양수 지수는 부호 생략 (`1.5e21`).
        - 유효 숫자 끝 0 제거 (`1.20` → `1.2`, `1.000` → 정수 수렴되어 `1`).
     6. 구현은 IEEE 754 double 기반 `repr` 라운드트립 알고리즘(Grisu3 / Ryu 등)을 사용해 최단 표현을 얻은 뒤 위 규칙으로 재포맷.
     7. 요약: `canonical_number(42) == canonical_number(42.0) == canonical_number(4.2e1) == "42"`.
   - 불리언: `true` / `false`.
   - 날짜·시각: RFC 3339 UTC 문자열로 고정 (`2026-04-20T10:45:00Z`). 타임존 지정이 없으면 UTC로 간주.
   - null: JSON `null`.
4. **컨테이너 규범화**:
   - **맵(object)**: 키 문자열을 UTF-8 코드포인트 오름차순으로 **재정렬**한다. 중복 키는 오류.
   - **배열(list)**: **순서를 보존**한다. harness 스키마의 배열은 의미상 순서가 있음(features 우선순위, smoke_scenarios 재현 단계 등).
   - 빈 컨테이너 (`{}`, `[]`)는 그대로.
5. **JSON 직렬화** — 공백 없음. RFC 8259 + ECMA-404 compliant. 키-값 구분자 `:`, 항목 구분자 `,`. 문자열 이스케이프는 JSON 규격(`\"`, `\\`, `\b`, `\f`, `\n`, `\r`, `\t`, 제어문자 `\u00XX`). 비-ASCII 문자는 그대로 UTF-8로 인코딩(이스케이프하지 않음).
6. **해시 계산** — Canonical JSON 바이트열을 **SHA-256**으로 해시한 뒤 **소문자 16진수**로 표현. 16진수 64자.

### D.3 부분 해시 (스코프 해시)

harness.yaml의 hash_tree는 spec의 특정 서브트리를 참조합니다(예: `features[id=F-002].modules`). 이때도 D.2 절차를 **서브트리에만** 적용해 동일한 해시를 얻습니다.

- 서브트리가 맵이면 맵 규범화만 적용.
- 서브트리가 원시값이면 타입 규범화 결과를 JSON 직렬화 (예: 정수 `42` → `"42"` 바이트).
- 서브트리 루트 경로는 `derived_from.{source_name}.source_path: "$.features[?(@.id=='F-002')].modules"` 같은 JSONPath로 보관해 재계산을 재현 가능하게 합니다.

### D.4 해시 용어 (세 종류, v2.3.6 재정리 · v2.3.7 include 행 추가)

| 이름 | 정의 | 대상 | 사용처 |
|------|------|------|--------|
| `output_hash` | 파일의 실제 바이트(YAML·Markdown·외부 md 원문)의 SHA-256 | 파일 단위 | edit-wins 감지. 파생 파일 수동 편집 · **`$include` 외부 md 편집** 여부 판정 |
| `source_hash` | 파생 **입력** 서브트리의 Canonical-JSON 바이트(D.2·D.3)에 대한 SHA-256. spec.yaml의 경우 **`expanded_spec` 기준**(D.2 step 0) | 값 트리(리프 또는 서브트리) | spec이 변경됐는지 판정 |
| `node_hash` | **Merkle 조합 해시**. 자식 `{path, hash}` 쌍 배열을 path ASCII 오름차순 정렬 후 canonical-JSON으로 직렬화한 바이트의 SHA-256 (D.5) | hash_tree의 **내부 노드** | 루트·중간 노드에서 델타 전파 판정 |

**주의 (v2.3.6)**: 이전 판에서 사용된 용어 `content_hash`는 실제로는 **서브트리가 리프이면 `source_hash`, 내부 노드이면 `node_hash`** 두 개념을 뭉뚱그리는 오류가 있었습니다. 구현에서는 `content_hash`를 쓰지 않고 위 세 이름만 사용합니다. 기존 자료·로그에 `content_hash`가 남아 있다면 읽기 전용 alias로만 취급하고 신규 파일에는 기록하지 않습니다.

### D.5 Merkle 조합 규칙

상위 노드 해시 계산:

```
children = [
  {"path": "metadata.project", "hash": "a1b2..."},
  {"path": "features[0].modules", "hash": "c3d4..."},
  ...
]
# path 기준 ASCII 오름차순으로 정렬
canonical = JSON.stringify(sorted_children, no spaces, UTF-8)
node_hash = SHA-256(canonical) in lowercase hex
```

### D.6 참조 구현 스케치 (의사코드)

```python
def canonical_bytes(value) -> bytes:
    if isinstance(value, dict):
        items = sorted(((normalize_str(k), canonical_bytes(v)) for k, v in value.items()),
                       key=lambda kv: kv[0].encode("utf-8"))
        inner = b",".join(json_string(k) + b":" + v for k, v in items)
        return b"{" + inner + b"}"
    if isinstance(value, list):
        inner = b",".join(canonical_bytes(x) for x in value)
        return b"[" + inner + b"]"
    if value is True:  return b"true"
    if value is False: return b"false"
    if value is None:  return b"null"
    if isinstance(value, (int, float)):
        return canonical_number(value).encode("ascii")
    if isinstance(value, datetime):
        return json_string(value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"))
    if isinstance(value, str):
        return json_string(unicodedata.normalize("NFC", value))
    raise ValueError(f"unhashable type: {type(value)}")

def source_hash(value) -> str:
    """D.3: 서브트리(리프 또는 맵·리스트) 해시."""
    return hashlib.sha256(canonical_bytes(value)).hexdigest()

def node_hash(children: list[dict]) -> str:
    """D.5: Merkle 상위 노드 해시. children은 [{'path': ..., 'hash': ...}, ...]."""
    sorted_children = sorted(children, key=lambda c: c["path"].encode("utf-8"))
    canonical = canonical_bytes(sorted_children)
    return hashlib.sha256(canonical).hexdigest()
```

### D.7 테스트 벡터 (필수 구현 적합성 테스트) · v2.3.6 정책 변경

**방침**: 본 문서는 해시 앵커의 **고정값을 더 이상 문서에 박지 않습니다**. 이유는 두 가지입니다.
1. 플레이스홀더가 남은 채로 구현·리뷰가 진행되면 문서와 구현이 영원히 괴리.
2. Canonical 규약의 작은 보강(D.2의 숫자 규칙 등)에도 문서 고정값은 유효해야 하는데, 이를 문서 편집으로 관리하면 휴먼 에러가 누적.

**대신**, 구현자는 `scripts/hash-fixtures.mjs`를 **참조 구현의 단일 진실로** 사용합니다:

```
# 1) 참조 구현 테스트 (구현자가 자기 구현을 검증):
node scripts/hash-fixtures.mjs --verify

# 2) 기대값 갱신 (규약이 정당하게 바뀐 경우에만):
node scripts/hash-fixtures.mjs --update
git commit scripts/hash-fixtures.mjs -m "chore: update hash test vectors"
```

**벡터 케이스** (값은 `hash-fixtures.mjs`에서 계산):

| # | 입력 (논리) | 테스트 이름 | 검증 속성 |
|---|------------|-------------|-----------|
| T1 | `{}` | empty_map | 빈 맵 앵커 |
| T2 | `[]` | empty_list | 빈 배열 앵커 |
| T3 | `{"a":1,"b":2}` | simple_map | 기본 맵 |
| T4 | `{"b":2,"a":1}` | key_order_invariant | T3와 동일 해시여야 함 (키 순서 불변) |
| T5 | `{"s":"café"}` (NFC 정규화) | unicode_nfc | NFC 합성형 ↔ NFD 분해형 동일 해시 |
| T6 | `{"n":42}` vs `{"n":42.0}` | int_float_collapse | **동일 해시** (D.2 canonical_number) |
| T7 | 중첩 3단 Merkle (D.5 예시) | merkle_composition | `node_hash` 재현성 |
| T8 | spec.yaml에서 한국어 키(`설명`·`요구사항`) | korean_keys | NFC + UTF-8 정렬 |
| T9 | inline string 버전과 `$include`로 분리한 버전 | include_expansion_invariant | `expanded_spec` 기준이므로 **동일 해시** (v2.3.7) |

**CI 강제**: 참조 구현과 다른 결과가 나오는 PR은 CI가 실패합니다(`hash-fixtures.mjs --verify`). 구현이 확정되면 `scripts/hash-fixtures.mjs`가 유일한 해시 계약서 역할을 합니다.

### D.8 비호환 변경 정책

Canonical 규약이 변경되면 **모든 해시가 일제히 재계산**되어야 합니다. 이는 실질적 메이저 스키마 변경이므로:

- `state.yaml`에 `hash_protocol_version: "1"` 필드 기록(기본 생략 시 v1로 간주).
- 마이그레이션 도구가 기존 해시를 모두 무효화하고 다음 `/harness:sync`에서 재계산.
- 변경 사유·영향 범위를 이 부록에 섹션으로 추가.

---

**문서 작성 메모**:

이 문서는 설계의 출발점이지 최종 명세가 아닙니다. 실제 구현 과정에서 반드시 조정이 필요하며, 특히 13장의 열린 질문들은 구현을 통해서만 답할 수 있습니다.

**열 차례 리비전의 초점**:

- **v2.0 → v2.1** (구조적 결함 수정): SSoT 위반, 부트스트랩 역설, 해시 입도, 증거 편향, 핸드오프 동시성. 명령어 10개 → 4+3개.
- **v2.1 → v2.2** (사용자 입력 최소화): `domain.md`·`architecture.yaml`을 spec에서 파생. 편집 존중(edit-wins) 규칙.
- **v2.2 → v2.3** (실행 가능성 우선): v1.0에서 드러난 "피처 완료 ≠ 프로젝트 실행 가능" 갭 해결. Walking Skeleton·integrator·Gate 5.
- **v2.3 → v2.3.1** (투명성 우선): 간소화·자동 판별의 부작용을 Preamble 규약으로 해소.
- **v2.3.1 → v2.3.2** (원칙 일관성 회복): 2.1의 "사고의 글 vs 실행의 글"이 v2.2 파생 설계에서 훼손된 것을 재조정. domain.md는 순수 뷰로, 사고의 글은 spec.yaml 자유 텍스트 필드로.
- **v2.3.2 → v2.3.3** (init 복원): v2.1 간소화의 과도한 단일화(status가 init 흡수)를 되돌림. CQS 원칙 준수, 업계 관행 일치.
- **v2.3.3 → v2.3.4** (실사용 흐름 예시 추가): 구조 설명과 별도로 "내 상황에서 무엇부터 치지?"에 바로 답하는 네 가지 시나리오를 7.7에 신설. 스키마·명령 변경 없음.
- **v2.3.4 → v2.3.5** (구현 준비도 리뷰 반영): 착수 전 전문가 리뷰에서 도출된 Critical 7·Major 8·Minor 5건을 일괄 수정. Canonical 해시 규약(부록 D), `/harness:check` Step 0 신선도 판정 알고리즘, 파일 구조 불일치(integrator.md 누락·commands/ 중복) 제거, 스키마 버전과 문서 버전의 독립 정책, BM25 임계값·Levenshtein 임계값 등 수치 명세 보강. 설계 원칙 불변 — 공백과 모호성만 제거.
- **v2.3.5 → v2.3.6** (마감 정리): 2차 리뷰 "GO-with-minor-cleanup" 7건 잔가시 제거. 부록 D 역참조 보강, 파일 순서 A-B-C-D 정렬, `canonical_number()` 정의로 int/float 해시 수렴, Step 0 None 가드 순서 버그 수정, `content_hash` → `source_hash`/`node_hash` 이원화, 테스트 벡터를 `scripts/hash-fixtures.mjs` 기반 정책으로 전환. §2.2 불변 원칙 표에서 현 설계와 충돌하는 "설계는 사용자의 몫" 항목 제거(주석으로 이전). §7.7 시나리오 2종 추가("신규+기획문서", "기존+기획문서 없음" 폴백) — 4개 → 6개. §13.3을 **Mode I (Ingest)**로 정식 명명하고 자동화 가능/불가 필드 구분을 본문과 §7.7 주(註)에 명시. **Draft — Ready-for-Implementation**.
- **v2.3.6 → v2.3.7** (`$include` 도입 — additive): 중간언어(IR) 관점에서 md vs YAML 재검토 결과, YAML 선택 유지하되 🗒 자유 텍스트 필드에 한해 외부 md 파일 참조(`$include: <path>` 객체)를 허용. spec.yaml 해시는 `expanded_spec` 기준으로 계산해 inline ↔ 외부 표현 중립성 보장. `harness.yaml.generation.include_sources[]`로 외부 파일 드리프트 추적(8번째 drift 유형 Include drift 추가). 기존 spec.yaml·해시·명령·Gate·에이전트 매트릭스 **전부 불변**. `scripts/resolve-includes.mjs` 1개 신설. 재귀 확장은 v2.4+ 유보. **Ready-for-Implementation 유지**.

**다음 단계**는 `tests/fixtures/sample-spec.yaml`을 실제로 작성해 v2.3.7 스키마로 표현 가능한지 검증하는 것입니다(`$include` 예제 1~2건 포함). 특히:

- **deliverable.type별 smoke 기본 템플릿**: game, web-service, cli 각각의 "최소 동작" 시나리오는 실제로 어떤 모양인가
- **integrator 에이전트 프롬프트**: 프레임워크(Next.js/FastAPI/Phaser 등)별 wire-up 관례를 LLM이 얼마나 정확히 추론하는가
- **Walking Skeleton의 적절한 최소 범위**: 너무 작으면 의미 없고, 너무 크면 skeleton이 아님
- **Preamble 근거의 적정 길이**: 10단어 제한이 실사용에서 충분한가, 혹은 답답한가
- **init의 협업 정책 선택 UX**: 단독/팀 양자택일이 충분한가, 혹은 중간 케이스(솔로지만 나중 팀 전환 가능)가 필요한가
- **이전 리비전의 쟁점** (v2.1 해시 트리 복잡도, v2.2 LLM round-trip 비용, G1 tool 권한 매트릭스)

종이 설계의 한계를 인정하고, 첫 샘플 작성으로 빠르게 피드백 루프를 돌리는 것이 핵심입니다.
