# harness-boot

> **AI 의 에너지를 가두지 않고, *집중* 시킵니다.**
>
> Claude Code 위에서 도는 multi-agent 개발 하네스. 다른 AI 도구가 *능력* 을
> 더할 때, 우리는 *방향* 을 만듭니다.

[![v0.11.3](https://img.shields.io/badge/plugin-v0.11.3-blue)](.claude-plugin/plugin.json)
[![spec](https://img.shields.io/badge/spec-v2.3.8-green)](docs/schemas/spec.schema.json)
[![tests](https://img.shields.io/badge/tests-1117%20passing-brightgreen)](tests)
[![cost](https://img.shields.io/badge/~$2/월-Sonnet-blueviolet)](#-비용)
[![license](https://img.shields.io/badge/MIT-lightgrey)](LICENSE)

---

## 🐎 왜 *하네스 (harness)* 인가

야생마는 빠르지만 산만합니다. 마구 채운 말은 빠르고 *방향* 이 있습니다.

다른 AI 도구가 *말의 속도* 를 자랑할 때, 우리는 *마구 그 자체* 를 만듭니다.

---

## ✨ 이 도구가 하는 5 가지

```
   1. 변환    →    2. 진화    →    3. 집중 ★   →    4. 협업    →    5. 통합
   (헷갈림         (문서가          (에너지가         (전문가들이       (외울 명령
    줄이기)         함께 자람)        흩어지지 않음)     감사 가능 결론)    2 개로 전부)
```

### 1️⃣ 변환 — AI 가 헷갈릴 여지를 줄여 전달

자연어 아이디어 → 구조화 spec → 작업 시점에 *prose summary* 만 전달.

- `plan.md` (한국어 자유서술) → `spec.yaml` 자동 변환 (4 stage 파이프라인)
- 🗒 자유 서술 (비전·사용자) ↔ 🔒 계약 항목 (기능·규칙) 을 schema 에서 분리
- 에이전트 호출 시 spec.yaml 통째 X — *해당 feature 의 prose summary* 만

### 2️⃣ 진화 — 문서가 따로 작성되는 게 아니라 개발과 함께

`spec.yaml` 이 단일 원천 (SSoT). 나머지는 모두 자동 파생:

- `domain.md` · `architecture.yaml` — 자동 생성
- `events.log` — 모든 결정 자동 누적 (append-only)
- 회고 (retro) — 완료 시 자동 작성
- **12 가지 drift** 자동 감지 (Generated · Derived · Spec · Include · Evidence · Code · Anchor · Adr · Stale · AnchorIntegration · Doc · Protocol)
- 사용자가 파생을 손질하면 *덮어쓰지 않음* (edit-wins)

### 3️⃣ 집중 — AI 가 엉뚱한 곳으로 튀어나가지 못하게 ★

**가장 핵심.** AI 가 자유로우면 산만합니다. 우리는 *마구* 를 채웁니다.

- **16 명의 전문가 AI** — 각자 자기 영역 도구만 (시스템 강제)
- **kickoff 라우팅** — feature shape 보고 *필요한 agent 만* 소환
- **Iron Law** — `gate_5` (실행 증명) + 사람이 직접 적은 근거 ≥ N 개 없이 *완료* 거부
- **NO skip / NO shortcut** — 모든 명령 출력 머리 3 줄에 박힘. 자기 합리화로 단계 우회 차단
- **drift × Iron Law gating** — wire-integrity drift (Code / Stale / AnchorIntegration) 시 완료 거부

### 4️⃣ 협업 — 16 명의 전문가가 *감사 가능한* 결론을 만듦

| 기획 | 설계 | 구현 | 품질·통합 | 감사 |
|---|---|---|---|---|
| researcher · product-planner | ux-architect · visual-designer · audio-designer · a11y-auditor | software · frontend · backend · security · performance | qa-engineer · integrator · tech-writer | reviewer (read-only) |

위에 **orchestrator** 가 조율자로 한 명 더. 16 명 (orchestrator + 15 전문가).

**4 ceremony 자동 발화**:
- **kickoff** — feature 활성화 직후 관련 전문가들이 우려 노트
- **design-review** — UI 설계 저장 시 visual·a11y·frontend 가 병렬 검토
- **Q&A inbox** — 에이전트 간 질문은 파일 기반 (Slack 스레드의 로컬 등가)
- **retro** — 완료 직후 reviewer → tech-writer 가 회고 prose

**충돌 해결**:
- security-engineer vs reviewer 불일치 → **security 가 veto**
- 모든 결정 / 충돌 / 우회 → `events.log` 에 자동 기록

### 5️⃣ 통합 — 위 4 가지가 외울 명령 *2 개* 로

- `/harness-boot:init` — 최초 한 번 (스펙 깔기)
- `/harness-boot:work` — 이후 모든 작업

자연어로 말하면 Claude 가 해석해 실행 계획을 보여주고 Y/n 묻습니다.

---

## 🏗 구조도

```
       사용자
         │
         │  자연어 한 줄 / plan.md / 기존 코드
         │
         │  /harness-boot:init   (최초 한 번)
         ▼
   ┌───────────────────────────────────────────────────┐
   │            ① 변환 — 알아들을 말로                  │
   │                                                    │
   │   plan.md       spec-conversion       spec.yaml    │
   │  (자유서술)  ──── 4 stage ────▶  (구조화 SSoT)    │
   │                                                    │
   └────────────────────────┬──────────────────────────┘
                            │
                            ▼
   ┌───────────────────────────────────────────────────┐
   │       ② 진화 — 문서가 함께 자람                    │
   │                                                    │
   │   spec.yaml ──┬─→ domain.md / architecture.yaml   │
   │  (단일 원천)  ├─→ events.log (모든 결정 누적)      │
   │              ├─→ retro (자동 회고)                 │
   │              └─→ check.py (12 drift 자동 감지)    │
   │                                                    │
   └────────────────────────┬──────────────────────────┘
                            │
                            ▼
   ┌───────────────────────────────────────────────────┐
   │       ③ 집중 — 에너지를 가두지 않고 모음 ★         │
   │                                                    │
   │   ┌─ 16 권한 매트릭스 (시스템 강제)                │
   │   ├─ Iron Law (gate_5 + 사람 근거 N 개)            │
   │   ├─ NO skip / NO shortcut (Preamble 3 줄 강제)   │
   │   └─ drift × Iron Law gating (wire-integrity)     │
   │                                                    │
   └────────────────────────┬──────────────────────────┘
                            │
                            ▼
   ┌───────────────────────────────────────────────────┐
   │       ④ 협업 — 전문가 16 명 오케스트레이션         │
   │                                                    │
   │  ┌──────────────────────────────────────────┐     │
   │  │            orchestrator                   │     │
   │  └────────┬──────────┬──────────┬───────────┘     │
   │     ┌─────▼────┐  ┌──▼─────┐  ┌─▼──────┐         │
   │     │ 기획 (2) │  │ 설계 4 │  │ 구현 5 │  ...    │
   │     └──────────┘  └────────┘  └────────┘         │
   │                                                    │
   │  ceremonies: kickoff · design-review              │
   │              · Q&A inbox · retro                  │
   └────────────────────────┬──────────────────────────┘
                            │
                            ▼
   ┌───────────────────────────────────────────────────┐
   │       ⑤ 통합 — 외울 것 단 2 개                     │
   │                                                    │
   │   /harness-boot:init   (최초 한 번)                │
   │   /harness-boot:work   (이후 전부 — 자연어 OK)     │
   │                                                    │
   │   빈 호출 = 대시보드 · 자연어 = 의도 해석           │
   └───────────────────────────────────────────────────┘
```

---

## 🚀 30 초 시작

Claude Code 2.1+ 에서:

```bash
# 1. 플러그인 설치 (한 번만)
/plugin marketplace add qwerfunch/harness-boot
/plugin install harness-boot@harness-boot

# 2. 새 프로젝트에서 한 줄로
cd my-new-project
/harness-boot:init "간단한 할 일 관리 앱"

# 3. 이후 작업은 work 하나로
/harness-boot:work
```

5 분이 더 걸린다면 [issue 열어주세요](https://github.com/qwerfunch/harness-boot/issues) — 고치겠습니다.

**의존성**: Python 3.10+, `pyyaml` (필수), `jsonschema` (권장).

---

## 📖 사용 방법

### 시작 — 아이디어 한 줄에서 첫 기능까지

```
사용자> /harness-boot:init "간단한 할 일 관리 앱"

Claude> 해석: 새 아이디어 · 참고 제품 없음 · 일반 모드
        배경 조사부터 시작할까요? [Y / 수정 / 설명]

사용자> Y
        ... 조사 에이전트가 brief 작성 ...

Claude> brief 초안입니다. 어떻게 할까요?
        1) 이대로 다음 (로드맵 설계)
        2) 수정
        3) 질문
        4) 되돌리기

사용자> 1
        ... 기획 에이전트가 로드맵 작성 ...
        ... 로드맵 → 스펙 자동 변환 ...
        ... 첫 기능 (최소 뼈대) 준비 완료 ...

Claude> 첫 기능이 준비됐습니다. 검증 실행할까요? [Y / n]
```

각 단계는 **초안 → Y / 수정 / 질문 / 되돌리기 / 다시 시작** 5 옵션. 내부 작업물은 버전 관리됩니다.

### 작업 — 외우지 않고 말하기

`/harness-boot:work` 뒤에 자연어를 그대로 덧붙이면 됩니다:

| 이렇게 말하면 | Claude 가 하는 일 |
|---|---|
| `/harness-boot:work` (인자 없이) | 현재 상태 대시보드 + 다음 할 일 추천 |
| `/harness-boot:work 돌려봐` · `"확인해줘"` · `"테스트"` | 모든 검증 자동 실행 |
| `/harness-boot:work 됐어` · `"완료"` | 완료 시도 — 근거 부족하면 이유 설명 후 거부 |
| `/harness-boot:work 막혔어` · `"보류"` | 보류 상태 + 사유 기록 |
| `/harness-boot:work 다른 거 먼저` | 현 작업 포인터 해제 (작업 자체는 유지) |
| `/harness-boot:work 로그인 기능` · `"회원가입"` | 해당 이름의 기능 작업 시작 |
| `/harness-boot:work 이어서` · `"계속"` | 대시보드 추천 작업으로 복귀 |
| `/harness-boot:work 확인했어` · `"리뷰 받았어"` | 근거 기록 추가 |
| `/harness-boot:work 이건 빼자` · `"취소해줘"` | 아직 시작 안 한 기능 삭제 |

자신 없는 해석은 **Plan 으로 공개 후 Y/n** 으로 확인합니다.

### 대시보드

```
📊 harness-boot

작업 중: "로그인 기능"
  진행: 검증 3/6 통과 · 근거 2 개
  차단: 접근성 · Space 키 동작 미정

진행 중 (다른):
  "대시보드"

대기: "회원가입" · "비밀번호 찾기"

다음 할 일:
  (1) 다음 검증 실행 (추천)
  (2) 다른 작업으로 전환

Enter = 1 (추천)
```

### 한 기능의 풀 사이클 (CLI 직접 호출)

```bash
/harness-boot:work F-004                        # 활성화
... (TDD red/green/refactor) ...
/harness-boot:work F-004 --run-gate gate_0      # 자동 테스트
/harness-boot:work F-004 --run-gate gate_5      # runtime smoke
/harness-boot:work F-004 --evidence "수동 확인 OK" --kind manual_check
/harness-boot:work F-004 --evidence "리뷰 받음" --kind reviewer_check
/harness-boot:work F-004 --complete             # done 전이
```

---

## 🆚 비슷한 도구와의 차이

| 도구 | 잘하는 것 | harness-boot 가 다른 점 |
|---|---|---|
| **BMAD-METHOD** | multi-agent SDLC, 7 persona | 우리는 *근거의 출처* 를 카운트 함수에서 분리 (사람 vs AI) |
| **GitHub Spec Kit** | spec-first, GitHub 후광 | 우리는 12 방향 drift 자동 감지 (Spec Kit 은 1~2 종) |
| **Cline / Aider** | IDE / CLI agent | 우리는 그 *위* 의 사이클 하네스 — 같이 씁니다 |
| **OpenHands** | sandboxed agent platform | 우리는 zero runtime, 그냥 `.harness/` 폴더 |
| **Everything Claude Code** | 184 agents 묶음 | 우리는 16 명 — 각자 권한이 *시스템 layer* 강제 |

> 한 줄: BMAD 가 *역할* 을 잘 나눕니다. 우리는 *근거의 출처* 를 카운트에서 나눕니다.

---

## 🎨 Built with harness-boot — 포트폴리오

이 하네스로 실제로 만들어진 결과물들.

### 🍉 cosmic-suika

<!-- 사용자가 docs/assets/cosmic-suika.gif 추가 후 broken link 자동 해소 -->
![cosmic-suika demo](docs/assets/cosmic-suika.gif)

Suika (2048-style merge) 게임의 우주 테마 변형. 첫 외부 dogfood 프로젝트.

- 🎮 **플레이**: [qwerfunch.github.io/cosmic-suika-pages](https://qwerfunch.github.io/cosmic-suika-pages/)
- 📦 **소스**: [github.com/qwerfunch/cosmic-suika-pages](https://github.com/qwerfunch/cosmic-suika-pages)
- **개발 흐름**: `/harness-boot:init` 한 줄로 시작 → spec → 첫 기능 → 자동 ceremony → 완료
- **harness-boot 환원**: I-001 (npm scripts auto-detect) · I-008 (product mode strict) · I-010 (AnchorIntegration drift) 등 10 개 이슈 환원 — *우리 도구를 더 나아지게 만든 사용자 사례*

### 🤝 여러분 차례

**하네스부트로 만든 결과물이 있다면** 알려주세요. PR 또는 [issue](https://github.com/qwerfunch/harness-boot/issues) 로:

- GIF / 스크린샷 (1~3 초 demo, ≤ 5 MB 권장)
- 한 줄 설명 + 링크
- (선택) 사용 후기 / 환원 가능한 이슈

**여기에 추가하겠습니다.** 다른 사용자가 *진짜 사례* 를 봅니다.

```
docs/assets/your-project.gif
```

자세한 추가 가이드: [`docs/assets/README.md`](docs/assets/README.md).

---

## 💰 비용

Claude Sonnet 기준 — feature 1 개 풀 사이클 (kickoff + 6 gates + 3 evidence + complete + retro):

| 모델 | feature 당 | 월 (~20 features) |
|---|---|---|
| Sonnet 4.6 | ~$0.10 | **~$2-3** |
| Opus 4.7 | ~$0.50 | ~$13 |

`intent_planner.py` (자연어 라우팅) · `gate/runner.py` · drift 검출 · Q&A inbox 가 모두 **deterministic** — LLM 호출 0. 토큰은 *kickoff + retro + design-review* 의 prose contract 에서만 사용.

---

## ❓ FAQ

**Q. Jira / Linear 같은 이슈 트래커와 겹치지 않나요?**
이슈 트래커는 *사람 팀* 조율 도구, harness-boot 는 *AI 개발 루프* 의 규율 도구입니다. 공존합니다. Jira 가 사람을 조율하는 동안 우리는 AI 에게 스펙·결정·근거를 제공합니다.

**Q. spec.yaml 을 직접 편집해야 하나요?**
대부분 `/harness-boot:work` 이 대화로 채워줍니다. plan.md 가 있으면 자동 변환, 한 줄 아이디어만 줘도 조사 → 기획 에이전트가 채웁니다.

**Q. 작은 프로젝트엔 과하지 않나요?**
"prototype 모드" 로 가볍게 가능합니다. 그래도 기능 2 개 미만이면 학습 비용 ↑. 10+ 기능부터 가치가 커집니다.

**Q. 플러그인이 내 코드를 건드리나요?**
아니요. `.harness/` 한 폴더와 Claude Code 규약 경로 (`.claude/agents/`, `.claude/skills/`) 만. 진단 명령은 파일 수정 시각도 안 바꿉니다.

**Q. CI 에서도 쓸 수 있나요?**
네. `python3 scripts/*.py` 직접 호출 경로가 영구 유지됩니다.

```yaml
- run: python3 scripts/work.py F-0 --run-gate gate_0 --json
- run: python3 scripts/check.py --json
```

**Q. AI 가 만든 evidence 와 사람이 만든 evidence 가 다른가요?**
**다릅니다.** AI 가 만든 검증 기록 (`gate_run`, `gate_auto_run`) 은 *0 개로* 칩니다. 사람이 직접 적은 것 (`manual_check`, `user_feedback`, `reviewer_check`, `test`, ...) 만 N 개로 카운트. 이게 다른 SDD 도구와 가장 큰 차이입니다.

---

## 📁 레포 구조

```
harness-boot/
├── .claude-plugin/              # plugin.json · marketplace.json
├── agents/                      # 16 전문가 에이전트
├── commands/                    # 슬래시 명령 (init · work)
├── hooks/                       # session-bootstrap · prompt-log
├── scripts/                     # Python 구현 (core · ceremonies · gate · render · spec · ui)
├── skills/spec-conversion/      # plan.md → spec.yaml 변환
├── docs/                        # 스키마 · 템플릿 · 샘플 · 포트폴리오 GIF
└── tests/                       # 단위 · 통합 · 회귀 · scale (1117 tests)
```

---

## 📦 현재 상태

**v0.11.3** — drift × Iron Law gating (F-048, GAP 1 close) · native English consolidation thread (F-049~F-054) · "Iron Law D" → "Iron Law" 호칭 단순화 · 1117 tests · self_check 5/5.

- 🐛 **버그 · 제안**: [GitHub Issues](https://github.com/qwerfunch/harness-boot/issues)
- 📜 **변경 이력**: [CHANGELOG.md](CHANGELOG.md)
- 👷 **기여자 가이드**: [CLAUDE.md](CLAUDE.md)

```bash
python3 -m pip install --user -r requirements-dev.txt
python3 -m pytest tests/ -q          # 1117 passing
bash scripts/self_check.sh           # 5/5 OK
```

---

## 📝 라이선스

MIT — [LICENSE](LICENSE).
