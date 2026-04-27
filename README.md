# harness-boot

> **AI 의 에너지를 가두지 않고, *집중* 시킵니다.**

Claude Code 위에서 도는 multi-agent 개발 하네스. 다른 AI 도구가 *능력* 을 더할 때, harness-boot 는 *방향* 을 만듭니다.

[![v0.11.3](https://img.shields.io/badge/plugin-v0.11.3-blue)](.claude-plugin/plugin.json)
[![spec](https://img.shields.io/badge/spec-v2.3.8-green)](docs/schemas/spec.schema.json)
[![tests](https://img.shields.io/badge/tests-1117%20passing-brightgreen)](tests)
[![cost](https://img.shields.io/badge/~$2/월-Sonnet-blueviolet)](#-비용)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## 🐎 왜 *하네스* 인가

야생마는 빠르지만 산만합니다. **마구 (harness) 채운 말은 빠르고 *방향* 이 있습니다.**

```
사용자  ──▶  ① 변환  ──▶  ② 진화  ──▶  ③ 집중 ★  ──▶  ④ 협업  ──▶  ⑤ 통합  ──▶  결과
            (자연어)     (문서)      (제어)        (16 전문가)    (2 명령)
```

---

## ✨ 다섯 가지 강점

| # | 강점 | 핵심 메커니즘 | 사용자가 얻는 것 |
|---|---|---|---|
| 1 | **변환** | `plan.md` → `spec.yaml` (4 stage 파이프라인) → prose summary | AI 가 헷갈리지 않게 전달 |
| 2 | **진화** | spec.yaml SSoT + 자동 파생 + 12 종 drift 감지 + edit-wins | 문서가 개발과 함께 자람 |
| 3 | **집중 ★** | 16 권한 매트릭스 + Iron Law + NO skip / NO shortcut + drift gating | AI 가 엉뚱한 곳으로 안 튐 |
| 4 | **협업** | orchestrator + 16 전문가 + 4 ceremony (kickoff · design-review · Q&A · retro) + 충돌 해결 | 감사 가능한 협업 결론 |
| 5 | **통합** | `/harness-boot:init` · `/harness-boot:work` 2 명령 + 자연어 라우팅 | 외울 명령은 단 두 개 |

> ★ 핵심 기둥. 다른 4 가지가 모두 *집중 (③)* 을 떠받칩니다.

---

## 🏗 구조

```
        자연어 / plan.md / 기존 코드
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │  spec.yaml  (단일 원천 · SSoT)            │
   │   ├─🗒 자유 서술 — 비전 · 사용자          │
   │   └─🔒 계약 항목 — 기능 · 규칙 · 결정     │
   └──────────┬─────────────────┬─────────────┘
              │                 │
       자동 파생            전문가 협업
              │                 │
              ▼                 ▼
   ┌────────────────┐  ┌──────────────────────┐
   │ domain.md      │  │ 16 agents            │
   │ architecture   │  │ orchestrator         │
   │ events.log     │  │ ┌─ 기획 (2)          │
   │ chapters/      │  │ ├─ 설계 (4)          │
   │ 12 drift 감지  │  │ ├─ 구현 (5)          │
   └────────────────┘  │ ├─ 품질·통합 (3)    │
                       │ └─ 감사 (1)          │
                       │ + 4 ceremonies       │
                       └──────────────────────┘
                                │
                                ▼
                         /harness-boot:work
                  (빈 호출=대시보드 · 자연어=의도)
```

---

## 🚀 빠른 시작

Claude Code 2.1+ 에서:

```bash
/plugin marketplace add qwerfunch/harness-boot
/plugin install harness-boot@harness-boot

cd my-new-project
/harness-boot:init "간단한 할 일 관리 앱"
/harness-boot:work
```

**의존성**: Python 3.10+, `pyyaml` (필수), `jsonschema` (권장).

5 분 이상 걸리면 [issue 알려주세요](https://github.com/qwerfunch/harness-boot/issues).

---

## 📖 사용법

### 자연어로 말하기 — 외울 필요 없음

| 입력 | Claude 가 하는 일 |
|---|---|
| `/harness-boot:work` | 대시보드 + 다음 할 일 추천 |
| `/harness-boot:work 돌려봐` · `"테스트"` | 모든 검증 자동 실행 |
| `/harness-boot:work 됐어` · `"완료"` | 완료 시도 — 근거 부족 시 거부 |
| `/harness-boot:work 막혔어` · `"보류"` | 보류 + 사유 기록 |
| `/harness-boot:work 로그인 기능` | 해당 기능 작업 시작 |
| `/harness-boot:work 이어서` · `"계속"` | 추천 작업으로 복귀 |
| `/harness-boot:work 확인했어` | 근거 기록 추가 |
| `/harness-boot:work 이건 빼자` | 미시작 기능 삭제 |

자신 없는 해석은 **Plan 으로 공개 후 Y/n** 으로 확인합니다.

### 한 기능의 풀 사이클

```bash
/harness-boot:work F-004                                    # 활성화
/harness-boot:work F-004 --run-gate gate_0                  # 자동 테스트
/harness-boot:work F-004 --run-gate gate_5                  # runtime smoke
/harness-boot:work F-004 --evidence "수동 확인 OK" --kind manual_check
/harness-boot:work F-004 --evidence "리뷰 받음" --kind reviewer_check
/harness-boot:work F-004 --complete                         # done
```

### 대시보드 출력

```
📊 harness-boot
작업 중: "로그인 기능"
  진행: 검증 3/6 통과 · 근거 2 개
  차단: 접근성 · Space 키 동작 미정
대기: "회원가입" · "비밀번호 찾기"
다음 할 일: (1) 다음 검증 실행 (추천)
```

---

## 🆚 다른 도구와의 차이

| 도구 | 잘하는 것 | harness-boot 의 차이 |
|---|---|---|
| **BMAD-METHOD** | multi-agent SDLC, persona | *근거의 출처* (사람 vs AI) 를 카운트 함수에서 분리 |
| **GitHub Spec Kit** | spec-first 작성 | 12 방향 drift 자동 감지 (Spec Kit 은 1~2 종) |
| **Cline / Aider** | IDE / CLI agent | 그 *위* 의 사이클 하네스 — 같이 사용 |
| **OpenHands** | sandboxed agent platform | zero runtime, 그냥 `.harness/` 폴더 |
| **Everything Claude Code** | 184 agents 묶음 | 16 명 · 권한이 *시스템 layer* 에서 강제 |

---

## 🎨 Built with harness-boot

이 하네스로 만들어진 결과물.

| 프로젝트 | Demo | Source | 설명 | 환원 |
|---|---|---|---|---|
| 🍉 **cosmic-suika** | [Play](https://qwerfunch.github.io/cosmic-suika-pages/) | [GitHub](https://github.com/qwerfunch/cosmic-suika-pages) | Suika (2048-style merge) 우주 테마 변형 | I-001 · I-008 · I-010 |
| 🎯 *여러분 차례* | — | — | harness-boot 로 만든 결과물 추가 가능 | — |

**여러분 차례**: 만든 결과물이 있다면 [PR](https://github.com/qwerfunch/harness-boot/pulls) 또는 [issue](https://github.com/qwerfunch/harness-boot/issues) 로 *GIF + 한 줄 설명 + 링크* 보내주세요. 이 표에 추가하겠습니다. 가이드: [`docs/assets/README.md`](docs/assets/README.md).

---

## 💰 비용

Claude Sonnet 기준, feature 1 개 풀 사이클 (kickoff + 6 gates + 3 evidence + complete + retro):

| 모델 | feature 당 | 월 (~20 features) |
|---|---|---|
| **Sonnet 4.6** | ~$0.10 | **~$2-3** |
| Opus 4.7 | ~$0.50 | ~$13 |

`intent_planner` (자연어 라우팅) · `gate/runner` · drift 검출 · Q&A inbox 가 모두 **deterministic** — LLM 호출 0. 토큰은 *kickoff · retro · design-review* 의 prose contract 에서만.

---

## ❓ FAQ

| 질문 | 답 |
|---|---|
| **Jira / Linear 와 겹치지 않나요?** | 이슈 트래커는 *사람 팀* 조율, harness-boot 는 *AI 개발 루프* 의 규율. 공존합니다. |
| **spec.yaml 직접 편집해야 하나요?** | 대부분 work 가 대화로 채워줍니다. plan.md 자동 변환, 한 줄 아이디어도 OK. |
| **작은 프로젝트엔 과한가요?** | "prototype 모드" 로 가볍게 가능. 단 기능 2 개 미만이면 학습 비용 ↑. |
| **내 코드를 건드리나요?** | 아니요. `.harness/` 한 폴더 + Claude Code 규약 경로만. 진단은 mtime 도 안 바꿉니다. |
| **CI 에서도?** | 네. `python3 scripts/work.py F-0 --run-gate gate_0 --json` 직접 호출 영구. |
| **AI evidence vs 사람 evidence 차이?** | **다릅니다.** AI 가 만든 검증 (`gate_run`) 은 *0 개로* 칩니다. 사람이 직접 적은 것만 카운트 — 다른 SDD 도구와 가장 큰 차이. |

---

## 📁 레포 구조

```
harness-boot/
├── .claude-plugin/        plugin.json · marketplace.json
├── agents/                16 전문가 에이전트
├── commands/              슬래시 명령 (init · work)
├── hooks/                 session-bootstrap · prompt-log
├── scripts/               Python 구현 (core · ceremonies · gate · render · spec · ui)
├── skills/spec-conversion/  plan.md → spec.yaml 변환
├── docs/                  스키마 · 템플릿 · 샘플 · 포트폴리오 GIF
└── tests/                 단위 · 통합 · 회귀 · scale (1117 tests)
```

---

## 📦 현재 상태 · 기여

**v0.11.3** — drift × Iron Law gating (F-048) · native English consolidation (F-049~F-054) · 1117 tests · self_check 5/5.

- 🐛 **버그 · 제안** — [GitHub Issues](https://github.com/qwerfunch/harness-boot/issues)
- 📜 **변경 이력** — [CHANGELOG.md](CHANGELOG.md)
- 👷 **기여자 가이드** — [CLAUDE.md](CLAUDE.md)

```bash
python3 -m pip install --user -r requirements-dev.txt
python3 -m pytest tests/ -q          # 1117 passing
bash scripts/self_check.sh           # 5/5 OK
```

---

## 📝 라이선스

[MIT](LICENSE) — qwerfunch
