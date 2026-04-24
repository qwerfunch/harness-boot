# harness-boot

> 자연어 아이디어를 **스펙으로 굳히고**, 전문가 에이전트 팀이 **역할별로 협업해** 실제 돌아가는 코드까지 이끌어내는 **AI 개발 하네스 프레임워크**.

[![version](https://img.shields.io/badge/plugin-v0.6.1-blue)](.claude-plugin/plugin.json)
[![spec](https://img.shields.io/badge/spec-v2.3.8-green)](docs/schemas/spec.schema.json)
[![tests](https://img.shields.io/badge/tests-535%20passing-brightgreen)](tests/unit)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## 30 초 요약

- **무엇**: AI 와 함께 제품을 만들 때 "사고의 글 ↔ 실행의 글 혼재 · 결정 근거 증발 · 증거 없는 완료" 를 구조로 막는 규율 도구.
- **누구**: AI 코딩 에이전트 (현재 Claude Code · 추후 확장 가능) 로 제품을 만드는 개발자.
- **어떻게**: `spec.yaml` 한 파일에 기획·계약·결정을 적고, 도구가 파생 뷰·전문가 에이전트·협업 루틴을 얹어준다.
- **왜**: "됐다" 는 AI 의 말을 테스트·스모크·감사 이력으로 매 피처마다 검증. 여섯 번째 피처에서 무너지지 않는다.
- **현재 제공**: Claude Code 2.1+ 플러그인 (`/plugin install harness@harness-boot`). 내부 설계는 AI 에이전트 프로토콜 · SSoT · 해시 트리 · 이벤트 로그 같은 일반 개념이라 다른 에이전트 호스트로 이식 가능.

## 빠른 시작

```bash
# Claude Code 2.1+ 에서
/plugin marketplace add qwerfunch/harness-boot
/plugin install harness@harness-boot

# 새 프로젝트 디렉터리에서
/harness:init --solo
/harness:spec "수박게임 웹 버전"      # 한 줄 아이디어만 줘도 OK
/harness:sync
/harness:work F-0 activate
```

의존성: Python 3.10+ · `pyyaml` · `jsonschema` (선택).

---

## 왜?

자연어로 "이런 제품 만들어줘" 를 던지면 세 가지가 동시에 무너진다:

1. **"직관적이어야 한다" 와 "POST /users returns 201" 이 한 문단에 섞인다** — AI 가 어디부터 자유 영역이고 어디부터 계약인지 판단 못 함.
2. **기획 단계 결정이 다음 단계로 전달되지 않는다** — ADR · 위험 요소 · 트레이드오프가 기획자 이후로 사라진다.
3. **"됐다" 는 선언만 있고 증거가 없다** — 테스트 통과·실행 확인·드리프트 검증 흔적 없이 피처가 `완료` 로 찍힌다.

**harness-boot 의 답**:

- 두 글을 `spec.yaml` 안에서 **스키마로 분리한다** → AI 는 필드가 묻는 것만 답한다.
- 기획 결정을 `domain.md` 에 **렌더해 모든 에이전트에 공유한다** → 근거가 사라지지 않는다.
- 완료 선언에 **철칙을 건다 (BR-004 Iron Law)** → `gate_5 통과 + 증거 1건 이상` 없이는 `done` 거부.

> 사고의 글은 자유롭게, 실행의 글은 구조화해서. 두 글이 어긋나거나 실행 결과와 다르면 harness 가 알려준다.

---

## 비전 — 적은 인원 × 큰 시스템

전통적 "대규모 개발" 은 인원 추가로 풀었다. 결과는 Brooks's Law — 인원이 늘수록 소통 비용이 기하급수로 폭증한다. 역할 전문성 (frontend · backend · security · a11y · qa · docs) 을 분산하려면 최소 수십 명이 필요했다.

**AI 에이전트는 이 방정식을 뒤집는다.** 1~3 인이 **설계·판단·방향** 을 잡고, 전문가 에이전트 팀이 **구현·검증·문서** 를 병렬 실행한다. 여기서 harness-boot 가 거는 규율:

| 전통적 병목 | harness-boot 의 해법 |
|---|---|
| 역할 전문성 분산 | 16 + α 에이전트 · 역할별 계층 읽기 |
| 소통 비용 (인원² 증가) | 단일 원천 spec + Tier 차등 + Q&A 파일 드롭 |
| 맥락 이해 한계 | `domain.md` 한 문서로 cross-role 공유 |
| 수작업 검증 | qa · reviewer · tech-writer 자동화 + Iron Law 게이트 |
| 결정 이력 소실 | events.log + domain.md Decisions 섹션 |

**목표 스케일** (로드맵 참조): 단기 1인 × 30 피처 → 중기 1~3인 × 300 피처 → 장기 1~3인 × 1000+ 피처 · 수년 운영. 구조 · SSoT · 감사 이력이 **인원이 아닌 에이전트로 스케일** 하도록 설계됐다.

> 이 도구는 "소규모 팀을 위한 작은 도구" 가 아니다. **작은 팀이 큰 시스템을 만들기 위한 레버리지 도구** 다.

---

## 핵심 흐름

사용자가 편집하는 파일은 `spec.yaml` 하나. 모든 것이 여기서 출발한다.

```
        자연어 기획 (plan.md · 대화 · 한 줄 아이디어)
                       │
                       │  /harness:init          (최초 1회)
                       ▼
         ╔══════════════════════════════════════╗
         ║          spec.yaml  (단일 원천)      ║  ←  /harness:spec
         ║    🗒 사고의 글    · 자유 서술        ║     (편집 · 변환)
         ║    🔒 실행의 글    · 스키마 검증      ║
         ║    decisions[] · risks[]  (v0.6 신규)║
         ╚══════════╤══════════════════╤════════╝
                    │                  │
             /harness:sync      /harness:work  <F-N>
                    │                  │
                    ▼                  ▼
      ┌───────────────────┐   ┌────────────────────────────┐
      │  파생 뷰          │   │  개발 사이클 + 협업 루틴    │
      │  · domain.md      │   │  · Gate 0~5 · BR-004       │
      │    + 결정 · 위험  │   │  · 역할별 에이전트 소환     │
      │  · architecture   │   │  · 킥오프 · 디자인 리뷰     │
      │  · 해시 트리      │   │  · 비동기 Q&A · 회고       │
      └───────────────────┘   └────────────────────────────┘

      관찰 (읽기 전용):
         /harness:status   세션·피처·드리프트 요약
         /harness:check    드리프트 8 종 탐지
         /harness:events   이벤트 로그 조회
         /harness:metrics  lead time · gate pass · drift 빈도
```

**불일치를 찾는 세 지점**:

| 지점 | 무엇을 | 어떻게 |
|---|---|---|
| `spec.yaml` | 실행의 글 형식 오류 | 스키마 검증 |
| `/harness:sync` | 파생 뷰가 원천에서 벗어남 | 해시 비교 |
| `/harness:work` | 증거 없는 `done` 선언 | 게이트 실행 + 증거 수 확인 |

---

## 슬래시 명령

| 명령 | 역할 |
|---|---|
| `/harness:init` | `.harness/` 골격 + `CLAUDE.md` 편성 (`--solo` / `--team`) |
| `/harness:spec` | 스펙 편집 · 기존 수정 (A/R/E) · 신규 작성 (B-1 대화형 / B-1-vague 한 줄 아이디어 / B-2 plan.md 변환) |
| `/harness:sync` | 스펙 → `domain.md` · `architecture.yaml` · `harness.yaml` 파생 + 해시 트리 갱신 |
| `/harness:work` | 피처 사이클 (활성화 · 게이트 기록/자동실행 · 증거 · 완료) |
| `/harness:status` | 세션 · 피처 · 드리프트 · 마지막 sync 요약 |
| `/harness:check` | 드리프트 8 종 탐지 (생성물·스펙·파생·include·증거·코드·문서·앵커) |
| `/harness:events` | 이벤트 로그 필터 조회 |
| `/harness:metrics` | lead time · 게이트 통과율 · 드리프트 빈도 |

진단 계열 (`status` · `check` · `events` · `metrics`) 은 파일을 수정하지 않는다 (읽기/쓰기 분리).

---

## 전형 사용 흐름

```bash
/harness:init --solo                   # .harness/ 스캐폴딩
/harness:spec plan.md                  # 또는: /harness:spec "한 줄 아이디어"
                                       #   40 단어 미만이면 researcher → planner → 자동 변환
/harness:sync                          # spec → domain/architecture/harness.yaml
/harness:status                        # 생성된 피처 목록 · ID 확인 (F-0, F-1, ...)
/harness:work F-0 activate             # 첫 피처 활성화 → 킥오프 루틴 기동
# ... 피처 shape 에 매칭된 에이전트만 순차 소환
/harness:work F-0 --run-gate gate_0    # 테스트 · 타입 · 린트 · 커버리지 · 스모크 자동 실행
/harness:work F-0 --evidence "17/17"   # 증거 기록
/harness:work F-0 --complete           # BR-004 통과 확인 후 done → 회고 루틴 자동 생성
/harness:check                         # 드리프트 점검 (읽기 전용)
```

---

## 전문가 에이전트 팀

v0.5 에 도입. `@harness:<이름>` 으로 직접 호출하거나, orchestrator 가 피처의 shape (UI 여부 · 민감 데이터 · 성능 예산 등) 을 보고 자동 라우팅한다.

### 역할별 구성

| 단계 | 에이전트 | 주요 산출 |
|---|---|---|
| **Discovery** (기획) | researcher · product-planner | `brief.md` · `plan.md` |
| **eXperience** (설계) | ux-architect · visual-designer · audio-designer · a11y-auditor | flows · 디자인 토큰 · 컴포넌트 · 오디오 · 접근성 리포트 |
| **Engineering** (구현) | software-engineer · frontend-engineer · backend-engineer · security-engineer · performance-engineer | `src/` 코드 · 테스트 · 보안·성능 리포트 |
| **Quality** (품질) | qa-engineer | 테스트 전략 문서 |
| **Integration** (통합) | integrator · tech-writer | DI 배선 · README · CHANGELOG |
| **Coordination** (조율) | orchestrator | 루틴 파일 · 에이전트 소환 |
| **Audit** (감사) | reviewer | 드리프트 리포트 · 회고 초안 (읽기 전용) |

각 에이전트는 `agents/<이름>.md` 에 **자기가 읽을 계층**을 선언한다. frontmatter 의 `tools:` 가 권한을 실제로 강제한다 (예: reviewer 는 `Read·Grep·Glob·Bash` 만 — 파일을 수정할 수 없음).

### 피처 shape 별 라우팅

orchestrator 는 `commands/work.md` 라우팅 표와 `scripts/kickoff.py` 매핑 상수를 같은 소스로 쓴다 (둘이 어긋나지 않도록 정합성 테스트로 강제).

| shape | 에이전트 체인 |
|---|---|
| `baseline-empty-vague` (한 줄 아이디어) | researcher → product-planner → 자동 변환 |
| `ui_surface.present` (UI 있음) | ux-architect → visual (+ audio) → a11y → frontend (+ software) |
| `sensitive_or_auth` (민감 데이터/인증) | security-engineer ∥ reviewer (security 가 BLOCK 시 veto) |
| `performance_budget` (성능 예산) | performance-engineer |
| `pure_domain_logic` (순수 도메인) | backend-engineer (+ software) |
| `feature_completion` (완료 직전) | qa → 엔지니어(테스트) → integrator → tech-writer → reviewer |

---

## 3 계층 참조 — 역할별 차등 읽기

**전원이 전부 읽는** 방식은 토큰 비용·집중력·역할 경계를 모두 해친다. v0.6 은 3 계층으로 나눈다:

| 계층 | 파일 | 내용 | 읽는 에이전트 |
|---|---|---|---|
| **Tier 1** | `.harness/domain.md` | 프로젝트 · 이해관계자 · 엔티티 · 비즈니스 규칙 · **결정 · 위험** (v0.6 신규) | 전원 필수 |
| **Tier 2** | `.harness/architecture.yaml` | 모듈 · 기술 스택 · 호스트 바인딩 · 게이트 체인 | Engineering · Quality · Integration · Audit |
| **Tier 3** | `.harness/_workspace/plan/plan.md` | ADR 원문 · 우선순위 점수 · 일정 · 열린 질문 | tech-writer · reviewer · orchestrator |

규약:

- `spec.yaml` 은 **누구도 직접 참조하지 않는다** — 원천 파일을 격리해 스키마 변경이 에이전트들을 깨뜨리지 않게.
- Design 계열은 Tier 1 만 — 행동·시각·청각 설계에 집중, 모듈 그래프 몰라도 됨.
- Engineering 계열은 Tier 1 + 2 — 모듈 경계와 기술 스택 맥락 필요.
- Docs 는 Tier 1 + 3 — ADR 원문을 "왜" 섹션에 인용.
- Audit (reviewer) 만 전 계층 접근 — 감사 역할이라 제한 없되 여전히 읽기 전용.

**역할 간 공유 맥락**은 `domain.md` 의 결정 · 위험 섹션으로 확보한다. 예를 들어 visual-designer 도 "민감 엔티티" 표시나 "보안 결정" 섹션을 볼 수 있어 개인정보를 노출하는 UI 요소 같은 사고를 예방한다.

---

## 팀 협업 루틴

실제 엔지니어링 팀에서 쓰는 네 가지 루틴 — **킥오프 · 디자인 리뷰 · Q&A · 회고** — 을 LLM 워크플로에 그대로 옮겼다. 각 산출은 `.harness/_workspace/` 에 파일로 남아 `grep` · `git` 으로 이력 추적 가능.

| 루틴 | 트리거 | Python 역할 | Orchestrator 역할 | 산출 |
|---|---|---|---|---|
| **킥오프** | `/harness:work F-N activate` 직후 | 템플릿 생성 · `kickoff_started` 이벤트 기록 | 매칭된 에이전트에 "80 단어 내 우려 3 bullet" 요청 → 파일에 추가 | `_workspace/kickoff/F-N.md` |
| **디자인 리뷰** | ux-architect 가 flows 저장 후 | 리뷰어 (visual · frontend · a11y + 조건부 audio) 템플릿 생성 | 병렬 호출해 concerns 수집 → 판정 섹션 작성 | `_workspace/design-review/F-N.md` |
| **Q&A (파일 기반)** | 에이전트가 불명확한 점 발견 | `scripts/inbox.py` 가 열린 질문 폴링 | `questions/F-N--<보낸이>--<받는이>.md` 에 Answer 섹션 추가 | `_workspace/questions/` |
| **회고** | `/harness:work F-N --complete` 직후 | 이벤트 로그 분석해 "배포 내용 · 첫 실패 게이트 · 루틴 요약" 자동 채움 | reviewer 로부터 초안 문자열 받아 파일에 쓰고, 이어 tech-writer 가 다듬음 | `_workspace/retro/F-N.md` |

**원칙**: Python 스크립트는 **템플릿 + 이벤트 로그 기록**만 담당한다. 실제 지능 작업 (에이전트 호출 · 파일 쓰기) 은 orchestrator 의 LLM 책임. Claude Code 의 서브에이전트 호출 모델과 정합.

---

## plan.md → spec.yaml 자동 변환

`plan.md` 가 이미 있으면 대부분 자동화된다:

- 4 단계 파이프라인: **정찰** (키워드·통계 추출) → **저작** (24 원칙 + 5 도메인 어댑터) → **갭 기록** (스펙으로 표현 불가능한 부분 카탈로그) → **백링크** (각 스펙 필드를 `plan.md` 행 번호로 연결).
- 8 개 골든 샘플 + 회귀 러너로 검증 (recall 0.991 · precision 0.861).
- 어댑터: `saas` · `game` · `worker` · `library` · `meta`.
- **v0.6 변환 규약 추가**: `plan.md` 의 "트레이드오프 ADR" 섹션을 `spec.decisions[]` 로, "위험" 섹션을 `spec.risks[]` 로 매핑. 이전엔 이 정보가 변환 중 버려지던 경로를 막았다.

`plan.md` 가 없으면 `/harness:spec` 을 그냥 호출 (대화형). 한 줄 아이디어만 있으면 researcher 체인이 알아서 채운다.

상세: [`skills/spec-conversion/SKILL.md`](skills/spec-conversion/SKILL.md) · [`tests/regression/conversion-goldens/`](tests/regression/conversion-goldens/) · [`docs/samples/harness-boot-self/`](docs/samples/harness-boot-self/).

---

## 설계 원칙 (8 기둥)

harness 는 LLM 개발 루프에 걸어두는 **규율 구조**.

1. **사고의 글 vs 실행의 글** — 🗒 (자유 서술) 와 🔒 (ID·enum·수치) 를 필드 성격으로 분리. 스키마가 경계를 강제한다.
2. **단일 원천** — `.harness/` 에만 원천. `.claude/` 아래는 어댑터. 파생 파일은 뷰일 뿐.
3. **스키마 우선** — JSONSchema 로 실행의 글 필드 검증. 위반 시 sync 차단.
4. **사용자 최소 입력** — 사용자가 직접 편집하는 파일은 `spec.yaml` **하나**.
5. **파생 우선 · 사용자 수정 존중** — 파생 파일은 원칙적으로 편집 대상 아니지만, 사용자가 수정하면 해시 비교로 감지해 덮어쓰지 않는다.
6. **실행 우선 검증** — 첫 피처는 반드시 `skeleton` 타입 (걸어다니는 최소 뼈대) · 게이트 5 (실행 스모크) · integrator 로 "실제로 켜지는 코드" 강제.
7. **Preamble 투명성** — 모든 명령이 3 줄짜리 상태 표시 + 2 줄짜리 근거/우회 거부 선언.
8. **표준 위치 존중** — Claude Code 규약 경로 (`.claude/agents/` · `.claude/skills/`) 를 그대로 사용.

### 구현 상태 (v0.6.1 기준)

- ✅ 표준 해시 트리 · 읽기/쓰기 분리 · 추가 전용 이벤트 로그 · BR-004 Iron Law · 자체 검증 (self_check)
- 🛠 훅 fail-open: 인프라는 있으나 세션 부트스트랩 외 5 개 훅은 선택 설치

---

## 상태 · 버전

| 릴리즈 | 핵심 |
|---|---|
| v0.3.x | 8 슬래시 명령 · 8 종 드리프트 · 게이트 0~5 자동 실행 · 자기 표현 왕복 |
| v0.4.0 | `agents/` · `hooks/` 인프라 · 3 개 코어 에이전트 |
| v0.5.0 | **전문가 에이전트 풀 도입** · BREAKING `implementer` → `software-engineer` |
| v0.5.1 | 외부 프로젝트 도그푸드에서 찾은 문서 규약 gap 4 건 수정 |
| **v0.6.0** | **3 계층 참조** · 결정/위험이 `domain.md` 로 렌더 · 4 가지 협업 루틴 · 스키마 확장 |
| **v0.6.1 (현재)** | 배포 전 감사에서 발견된 심각 이슈 3 건 수정 · 이벤트 스키마 통일 · 라우팅 정합성 테스트 |
| v0.7 (계획) | **1~3인 × 50~100 피처 도달** — 루틴 자동 연동 · 에이전트 평가 하네스 · 스펙 모듈화 초기 |
| v0.8~0.9 | **1~3인 × 300 피처 · 1~2년 운영** — events.log DB 백엔드 · multi-project workspace · agent 품질 회귀 |
| v1.0 | **1~3인 × 1000+ 피처** — orchestrator 수평 확장 · LLM 비용/속도 최적화 (캐싱 · 부분 소환) |
| v1.5+ | **수천 피처 · 수년 프로덕션** — CI/CD 통합 · 규제 compliance · production-grade observability |

**검증 수준**:

- 535 단위 테스트 (18 skipped) · self_check 5/5 통과
- 자기 표현 왕복: harness-boot 자신을 변환한 스펙으로 sync 실행 → 일관된 파생물
- End-to-end 사이클: F-099 활성화 → 게이트 5 → 증거 → done → BR-004 enforcement 확인
- **외부 도그푸드**: `suika-web` — 수박게임 웹 완성형 프로토타입. 16 에이전트 워크플로 전 구간 + v0.6.1 협업 루틴 스크립트 실증.

---

## 현재 제약 & 확장 로드맵

비전 (1~3인 × 수백~수천 피처) 의 최종 지점까지 가는 길. v0.6.1 에서 **뼈대는 완성**되었고 각 버전이 스케일을 한 단계씩 올린다.

### v0.6.1 시점의 제약 — 단기 확장 (v0.7)

현재는 **설계는 있지만 구현 미완** 인 영역이 몇 군데:

- 협업 루틴 자동 연동 — 현재는 orchestrator 수동 호출
- ADR `supersedes` 자동 전이
- `skipped_agents[]` 이력 기록 (스키마만 있음)
- `performance_budget` 게이트 연동
- Design 계층 에이전트의 플랫폼 맥락 접근

이 5 개가 v0.7 의 핵심 작업. 해소되면 **1~3인 × 50~100 피처** 규모에서 마찰 없이 동작.

### 중~장기 확장 — 대규모 스케일

| 버전 | 확장 | 해소 제약 |
|---|---|---|
| v0.8~0.9 | events.log DB 백엔드 · multi-project workspace | 수년 운영 · 여러 제품 동시 관리 |
| v1.0 | orchestrator 수평 확장 · LLM 비용/속도 최적화 | 동시 수백 피처 · 수천 에이전트 호출 비용 |
| v1.5+ | CI/CD 통합 · 규제 compliance · production observability | 실프로덕션 신뢰성 · 감사 요구 |

각 단계의 상세는 [`CHANGELOG.md`](CHANGELOG.md) 및 개발 진행에 따라 업데이트.

---

## FAQ

**Q. 이미 Linear/Jira 로 프로젝트 관리하는데 이게 필요한가요?**
이건 사람 팀 조율 도구가 아니라 **AI 개발 루프의 규율 도구**입니다. Jira 는 사람을 조율하고, harness-boot 는 AI 에게 스펙·결정·증거를 제공합니다. 공존합니다.

**Q. 작은 프로젝트엔 과하지 않나요?**
피처 3 개 미만의 토이 프로젝트에는 오버킬일 수 있습니다. `/harness:init` + `/harness:spec` 만 쓰고 전문가 에이전트·루틴은 소환 안 해도 됩니다. 10~15 피처 이상의 실제 제품부터 규율의 가치가 비용을 넘어서기 시작하며, 규모가 커질수록 전문가 에이전트·협업 루틴·감사 이력의 효용이 커집니다.

**Q. spec.yaml 을 직접 편집해야 하나요?**
대부분은 `/harness:spec` 이 대화로 채워줍니다. `plan.md` 가 있으면 거의 자동 변환되고, 한 줄 아이디어만 줘도 researcher → product-planner 가 풍부한 `plan.md` 를 만든 뒤 스펙으로 변환합니다.

**Q. 언제 프로덕션에 도입해도 안전한가요?**
v0.6.1 은 **자체 검증 (535 tests · self_check 5/5)** 을 통과한 안정판으로, 규율 · 스펙 · 게이트 · 감사 이력 계층은 지금 당장 프로덕션 개발에 사용 가능합니다. 대규모 에이전트 연쇄 호출 (전 16 에이전트를 한 피처에서 소환) · 수백 피처 병렬 처리는 v0.7~v1.0 의 확장 범위이며 로드맵에 명시되어 있습니다. 즉 **지금 시작해 점진적으로 규모를 키우는** 사용이 적합합니다.

**Q. 플러그인이 내 코드를 건드리나요?**
아니요. 플러그인이 관리하는 영역은 `.harness/` 하나입니다. 어댑터 (`.claude/agents/` · `.claude/skills/`) 는 Claude Code 규약 위치에 따라 생성되지만 사용자 코드와 분리됩니다. 진단 명령은 mtime 도 바꾸지 않습니다.

---

## 레포 구조

```
harness-boot/
├── .claude-plugin/          # 플러그인 매니페스트 (v0.6.1)
├── agents/                  # 에이전트 정의 (코어 + 전문가, 읽는 계층 선언)
├── commands/                # 슬래시 명령
├── scripts/                 # Python 구현
│   ├── sync · work · check · events · metrics · status
│   ├── render_domain · render_architecture
│   ├── canonical_hash · include_expander · gate_runner
│   ├── spec_mode_classifier · validate_spec · state
│   ├── mode_b_*            # plan.md 통계 추출
│   └── kickoff · inbox · design_review · retro   # v0.6 협업 루틴
├── skills/spec-conversion/  # plan.md → spec.yaml 변환 스킬
├── docs/
│   ├── schemas/             # spec.schema.json (v2.3.8)
│   ├── templates/starter/   # init 템플릿
│   └── samples/harness-boot-self/   # 자기 표현 스펙
└── tests/
    ├── unit/                # 535 단위 테스트
    └── regression/conversion-goldens/   # 골든 샘플
```

---

## 기여

- **버그 · 제안**: [GitHub Issues](https://github.com/qwerfunch/harness-boot/issues)
- **변경 이력**: [CHANGELOG.md](CHANGELOG.md)
- **기여자 가이드**: [CLAUDE.md](CLAUDE.md) (개발 시 읽는 맥락 문서)
- **스키마 참조**: [`docs/schemas/spec.schema.json`](docs/schemas/spec.schema.json)

## 라이선스

[MIT](LICENSE) · © qwerfunch
