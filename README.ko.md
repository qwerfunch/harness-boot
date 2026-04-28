# harness-boot

> [English](README.md) · [한국어](README.ko.md)

> **AI 의 에너지를 가두지 않고, *집중* 시킵니다.**

Claude Code 위에서 도는 multi-agent 개발 하네스. 다른 AI 도구가 *능력* 을 더할 때, harness-boot 는 *방향* 을 만듭니다.

[![plugin](https://img.shields.io/badge/plugin-v0.11.7-blue)](.claude-plugin/plugin.json)
[![tests](https://img.shields.io/badge/tests-1117%20passing-brightgreen)](tests)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## 🐎 왜 하네스인가

야생마는 빠르지만 산만합니다. 마구 채운 말은 빠르고 *방향* 이 있습니다.

```
사용자  ──▶  ① 컨텍스트  ──▶  ② 진화  ──▶  ③ 집중  ──▶  ④ 협업  ──▶  ⑤ 통합  ──▶  결과
            (변환)          (문서)      (제어)        (전문가)      (명령 통합)
```

---

## 다섯 가지 강점

| # | 강점 | 어떻게 작동하나 | 사용자가 얻는 것 |
|---|---|---|---|
| 1 | **컨텍스트** | 사람의 자연어를 AI 가 이해할 중간언어(명세)로 정리합니다 — 모든 에이전트가 같은 컨텍스트에서 출발합니다 | 모든 에이전트가 같은 맥락에서 출발 — AI 가 헷갈리지 않습니다 |
| 2 | **진화** | 한 곳을 수정하면 관련 문서가 자동 갱신, 불일치는 자동 감지, 사용자가 직접 수정한 부분은 보존됩니다 | 설계 문서가 항상 최신, 관리 부담이 사라집니다 |
| 3 | **집중** | 각 AI 가 자기 작업 범위 안에서만 동작하고, 완료 조건은 시스템이 보장합니다 | AI 가 본래 일에만 집중합니다 |
| 4 | **협업** | 역할별 전문 AI 들이 정해진 절차로 협력하고, 모든 의사결정과 이견 처리 과정이 자동 기록됩니다 | 사각지대를 메우고, 모든 결정 과정이 추적 가능합니다 |
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
   │ 불일치 자동감지│  │  ├─ 품질·통합        │
   └────────────────┘  │  └─ 감사 (read-only) │
                       │  + 협업 절차         │
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

`/harness-boot:work` 뒤에 평소 쓰는 말투를 그대로 붙이면 됩니다. 짧은 키워드도, 긴 문장도 모두 해석됩니다.

| 의도 | 자연어 예시 |
|---|---|
| 대시보드 / 다음 할 일 | (인자 없음) · "지금 뭐 해야 해?" · "어디까지 했지?" · "다음 할 일 알려줘" |
| 검증 실행 | "테스트" · "돌려봐" · "지금까지 한 거 검증해줘" · "빠진 거 있는지 한번 봐줘" |
| 완료 시도 | "됐어" · "완료" · "이거 끝난 것 같아" · "로그인 기능 마무리할게" |
| 보류 | "막혔어" · "잠시 멈춰" · "외부 API 가 안 나와서 못 진행" · "오늘은 여기까지" |
| 기능 시작 / 전환 | "로그인 기능" · "회원가입 작업할게" · "F-3 시작" · "결제부터 먼저 만들자" |
| 작업 복귀 | "이어서" · "계속" · "어제 하던 거 다시" · "추천하는 거 진행" |
| 근거 추가 | "확인했어" · "리뷰 받았어" · "친구가 봐줬어" · "QA 통과했어" |
| 기능 정리 | "이건 빼자" · "취소해줘" · "F-9 는 안 만들래" |
| 이력 조회 | "지난주에 뭐 했지?" · "F-3 의 변경 이력" · "왜 OAuth 로 갔었지?" |

위 예시는 일부일 뿐, Claude 는 문맥을 보고 다른 표현도 해석합니다. 자신 없는 해석은 실행 전에 계획을 보여주고 Y/n 으로 확인합니다.

### 대화 예시

```
사용자> 로그인 기능 거의 다 된 것 같은데 마무리하자

Claude> 해석: F-3 (로그인 기능) 완료 시도
        현재 검증 5/6 통과 · 근거 1 개 (필요 3 개)
        근거가 부족해 완료할 수 없습니다. 다음 중 선택:
          1) 근거 더 추가 (수동 확인 · 리뷰 · 테스트 등)
          2) prototype 모드로 강등
          3) hotfix 사유로 우회
          4) 취소

사용자> 1, 방금 친구한테 봐달라고 했고 통과했어

Claude> reviewer_check 근거 추가됐습니다. 다시 시도할까요? [Y/n]

사용자> Y

Claude> 완료됐습니다. 회고가 자동 작성됐습니다.
        다음 추천: F-4 (회원가입) 작업 시작.
```

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

**v0.11.5** — 외부 채택 준비 단계, 자체 도그푸드 운영 중.

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
