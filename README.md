# harness-boot

> **AI 의 에너지를 가두지 않고, *집중* 시킵니다.**

Claude Code 위에서 도는 multi-agent 개발 하네스. 다른 AI 도구가 *능력* 을 더할 때, harness-boot 는 *방향* 을 만듭니다.

[![plugin](https://img.shields.io/badge/plugin-v0.11.3-blue)](.claude-plugin/plugin.json)
[![tests](https://img.shields.io/badge/tests-1117%20passing-brightgreen)](tests)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## 🐎 왜 하네스인가

야생마는 빠르지만 산만합니다. 마구 채운 말은 빠르고 *방향* 이 있습니다.

```
사용자  ──▶  ① 변환  ──▶  ② 진화  ──▶  ③ 집중  ──▶  ④ 협업  ──▶  ⑤ 통합  ──▶  결과
            (자연어)     (문서)      (제어)        (전문가)      (명령 통합)
```

---

## 다섯 가지 강점

| # | 강점 | 어떻게 작동하나 | 사용자가 얻는 것 |
|---|---|---|---|
| 1 | **변환** | 사람의 자연어를, AI 가 따라갈 명세로 자동 정리합니다 | AI 가 헷갈리지 않습니다 |
| 2 | **진화** | 한 곳을 고치면 다른 문서가 자동 갱신, 어긋남은 자동 감지, 사용자 손질은 보존됩니다 | 설계 문서가 항상 최신, 관리 부담이 사라집니다 |
| 3 | **집중** | 각 AI 가 자기 영역만 만지고, 완료 조건은 시스템이 보장합니다 | AI 가 본래 일에만 집중합니다 |
| 4 | **협업** | 역할이 다른 전문 AI 들이 정해진 절차로 협력하고, 모든 결정과 충돌이 자동 기록됩니다 | 사각지대를 메우고, 모든 흐름이 추적 가능합니다 |
| 5 | **통합** | 외울 명령은 두 개. 자연어로 의도를 말하면 실행 전에 계획을 보여줍니다 | 평소 쓰는 말로 충분합니다 |

---

## 구조

```
        자연어 / plan.md / 기존 코드
                  │
                  ▼
   ┌──────────────────────────────────────────┐
   │  spec.yaml  (단일 원천)                   │
   │   ├─ 아이디어 — 비전 · 사용자             │
   │   └─ 규칙     — 기능 · 결정 · 제약        │
   └──────────┬─────────────────┬─────────────┘
              │                 │
       자동 파생            전문가 협업
              │                 │
              ▼                 ▼
   ┌────────────────┐  ┌──────────────────────┐
   │ domain.md      │  │ orchestrator         │
   │ architecture   │  │  ├─ 기획             │
   │ events.log     │  │  ├─ 설계             │
   │ chapters/      │  │  ├─ 구현             │
   │ drift 자동감지 │  │  ├─ 품질·통합        │
   └────────────────┘  │  └─ 감사 (read-only) │
                       │  + ceremonies        │
                       └──────────────────────┘
                                │
                                ▼
                         /harness-boot:work
                  (빈 호출=대시보드 · 자연어=의도)
```

---

## 빠른 시작

Claude Code 에서:

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

## 사용법

### 자연어로 말하기

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

자신 없는 해석은 **계획으로 공개 후 Y/n** 으로 확인합니다.

### 대시보드 출력

```
harness-boot

작업 중: "로그인 기능"
  진행: 검증 3/6 통과 · 근거 2 개
  차단: 접근성 · Space 키 동작 미정
대기: "회원가입" · "비밀번호 찾기"
다음 할 일: (1) 다음 검증 실행 (추천)
```

---

## 만들어진 결과물

| 프로젝트 | 데모 | 소스 | 설명 |
|---|---|---|---|
| **cosmic-suika** | [Play](https://qwerfunch.github.io/cosmic-suika-pages/) | [GitHub](https://github.com/qwerfunch/cosmic-suika-pages) | 우주 테마 머지 게임 |
| *여러분 차례* | — | — | harness-boot 로 만든 결과물 추가 가능 |

**여러분의 결과물도 환영합니다.** [PR](https://github.com/qwerfunch/harness-boot/pulls) 또는 [issue](https://github.com/qwerfunch/harness-boot/issues) 로 보내주시면 이 표에 추가합니다.

권장 형식: **이미지 또는 GIF** (1~3 초 demo, 800px 이하 너비, ≤ 5 MB) + 한 줄 설명 + 링크.
자세한 가이드는 [`docs/assets/README.md`](docs/assets/README.md).

---

## 레포 구조

```
harness-boot/
├── .claude-plugin/        plugin.json · marketplace.json
├── agents/                전문가 에이전트 정의
├── commands/              슬래시 명령 (init · work)
├── hooks/                 session-bootstrap · prompt-log
├── scripts/               Python 구현 (core · ceremonies · gate · render · spec · ui)
├── skills/spec-conversion/  plan.md → spec.yaml 변환
├── docs/                  스키마 · 템플릿 · 샘플 · 결과물 데모
└── tests/                 단위 · 통합 · 회귀 · 스케일
```

---

## 현재 상태

**v0.11.3** — 외부 채택 준비 단계, 자체 도그푸드 운영 중.

- 변경 이력 — [CHANGELOG.md](CHANGELOG.md)
- 개발자 가이드 — [CLAUDE.md](CLAUDE.md)
- 문제 보고 — [GitHub Issues](https://github.com/qwerfunch/harness-boot/issues)

```bash
python3 -m pip install --user -r requirements-dev.txt
python3 -m pytest tests/ -q
bash scripts/self_check.sh
```

---

## 라이선스

[MIT](LICENSE) — qwerfunch
