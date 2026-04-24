# harness-boot

> 자연어 아이디어를 **스펙으로 굳히고**, 전문가 에이전트 팀이 **역할별로 협업해** 실제 돌아가는 코드까지 이끌어내는 **AI 개발 하네스 프레임워크**.

[![version](https://img.shields.io/badge/plugin-v0.9.4-blue)](.claude-plugin/plugin.json)
[![spec](https://img.shields.io/badge/spec-v2.3.8-green)](docs/schemas/spec.schema.json)
[![tests](https://img.shields.io/badge/tests-742%20passing-brightgreen)](tests)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## 한 눈에

Claude Code 에서 **"간단한 할 일 앱 만들어줘"** 같은 한 줄을 던지면:

1. 그 아이디어를 **검증 가능한 스펙 문서** 로 다듬고
2. 기획자 · 디자이너 · 엔지니어 · 검토자 **AI 전문가들이 역할을 나눠** 작업하고
3. **실제로 실행되는 코드** 와 테스트까지 만들고
4. "됐다" 를 선언하기 전에 **근거가 있는지 확인** 합니다

Claude 가 혼자 "완료" 를 선언해 버리는 상황을 구조로 막고, 모든 결정과 근거를 감사 가능한 기록으로 남기는 것이 목표입니다.

---

## 전체 구조

```
      한 줄 아이디어 / 기획 문서 / 기존 코드
                       │
                       │  /harness-boot:init     (최초 한 번)
                       ▼
         ╔══════════════════════════════════════╗
         ║      spec.yaml  (원천 문서 하나)     ║
         ║                                      ║
         ║   🗒 자유 서술  —  비전 · 사용자      ║
         ║   🔒 계약 항목  —  기능 · 규칙        ║
         ║     + 결정 이력 · 위험 · 수용 조건    ║
         ╚══════════╤══════════════════╤════════╝
                    │                  │
              자동 파생             이후 작업
                    │                  │
                    ▼                  ▼
      ┌───────────────────┐   ┌───────────────────────────┐
      │  파생 문서         │   │  전문가 팀 협업            │
      │                   │   │                            │
      │  · 도메인 설명     │   │  · 기획 → 설계 → 구현      │
      │  · 아키텍처        │   │  · 시작 모임 · 디자인 리뷰 │
      │  · 변경 감사       │   │  · Q&A · 회고              │
      │                   │   │  · 완료 시 근거 자동 확인  │
      └───────────────────┘   └───────────────────────────┘
                    │                  │
                    └─────────┬────────┘
                              ▼
                  /harness-boot:work
             (빈 호출 = 대시보드 · 자연어 = 의도 해석)
```

사용자는 **자연어로만** `/harness-boot:work` 과 대화합니다. `spec.yaml` 은 그 대화 결과 · 기획 문서 · 기존 코드 분석으로 **자동 생성 · 갱신** 되는 시스템 원천이며, 나머지 문서는 전부 거기서 파생됩니다. 파생이 원천과 어긋나면 알려주지만 멋대로 덮어쓰지 않습니다. (직접 `spec.yaml` 을 편집하는 것도 가능하지만 거의 필요 없는 escape hatch.)

---

## 이런 분에게 유용합니다

- Claude Code 로 **한 줄 아이디어부터 돌아가는 코드까지** 일관된 흐름으로 밀어붙이고 싶은 분
- 한 AI 에게 모든 걸 맡기는 대신 **기획 · 설계 · 구현 · 검증** 을 역할별로 분리해 돌리고 싶은 분
- 기능이 10 · 20 개로 늘어나도 **이전 결정과 맥락이 흩어지지 않는** 개발 흐름이 필요한 분
- 매번 처음부터 설명하지 않고, **축적된 스펙 위에서** AI 와 이어서 협업하고 싶은 분

**오버스펙일 수 있는 경우**: 기능 1~2 개짜리 스크립트, 일회성 실험. 이 경우 "prototype 모드" 로 가볍게 돌릴 수 있지만, 그래도 학습 비용 대비 이득이 크지 않을 수 있습니다.

---

## 빠른 시작

Claude Code 2.1 이상에서:

```bash
# 플러그인 설치 (한 번만)
/plugin marketplace add qwerfunch/harness-boot
/plugin install harness-boot@harness-boot

# 새 프로젝트 디렉터리에서 한 줄로
/harness-boot:init 간단한 할 일 관리 앱

# 이후 작업은 work 하나로
/harness-boot:work
```

**외울 slash command 는 2 개** (`init` · `work`) 입니다. 인자는 자연어로 말하면 Claude 가 해석해 실행 계획을 제시하고, Y / n / 수정으로 응답합니다.

**의존성**: Python 3.10+, `pyyaml` (필수), `jsonschema` (권장).

---

## 실제로 써보는 흐름

### 시작 — 아이디어부터 첫 기능까지

```
사용자> /harness-boot:init 간단한 할 일 관리 앱

Claude> 해석: 새 아이디어 · 참고 제품 없음 · 일반 모드
        배경 조사부터 시작할까요? [Y / 수정 / 설명]

사용자> Y
        ... 조사 에이전트가 간단한 brief 작성 ...

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

각 단계는 **초안 → Y / 수정 / 질문 / 되돌리기 / 다시 시작** 5 옵션 루프. 내부 작업물은 버전 관리되어 언제든 되돌릴 수 있습니다.

### 작업 — 외우지 않고 말하기

`/harness-boot:work` 뒤에 평소 쓰는 말을 그대로 덧붙이면 됩니다:

| 이렇게 말하면 | Claude 가 하는 일 |
|---|---|
| `/harness-boot:work` (인자 없이) | 현재 상태 대시보드 + 다음 할 일 추천 |
| `/harness-boot:work 돌려봐` · `"확인해줘"` · `"테스트"` | 모든 검증 자동 실행 |
| `/harness-boot:work 됐어` · `"완료"` | 완료 선언 시도 — 근거 부족하면 이유 설명 후 거부 |
| `/harness-boot:work 막혔어` · `"보류"` · `"나중에"` | 보류 상태로 전환 + 사유 기록 |
| `/harness-boot:work 다른 거 먼저` | 현재 작업 포인터 해제 (작업 자체는 유지) |
| `/harness-boot:work 로그인 기능` · `"회원가입"` | 해당 이름의 기능 작업 시작 |
| `/harness-boot:work 이어서` · `"계속"` · `"재개"` | 대시보드가 추천한 작업으로 복귀 |
| `/harness-boot:work 확인했어` · `"리뷰 받았어"` | 근거 기록 추가 |
| `/harness-boot:work 이건 빼자` · `"취소해줘"` | 아직 시작 안 한 기능 삭제 |

표는 예시이고, Claude 는 문맥을 읽어 이 밖의 표현도 해석합니다. **자신 없는 해석은 실행 전 Plan 으로 공개** 하고 Y/n 을 물어봅니다.

### 대시보드가 보여주는 것

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

---

## 2 개 명령어의 역할

### `/harness-boot:init` — 최초 한 번

새 프로젝트에 harness-boot 골격을 깝니다. 자연어 직접 진입 또는 3 옵션 메뉴:

1. **아이디어만 있음** — 조사 → 로드맵 → 스펙 변환 (대화형)
2. **기획 문서 있음** — 변환 루프 직행
3. **기존 코드 있음** — 현 상태 분석 → 로드맵 초안

### `/harness-boot:work` — 이후 모든 작업

- 빈 호출 → **읽기 전용 대시보드**
- 자연어 입력 → **의도 해석 → 실행 계획 공개 → Y/n → 실행**

실행 중 품질 체크는 자동으로 걸립니다.

---

## 품질을 지키는 4 가지 장치

### 1. 완료 조건에 근거를 요구합니다

기능을 `완료` 로 넘기려면:

- **실제로 실행되는지** (runtime smoke) 확인되어야 하고
- **사용자가 직접 적은 근거** 가 **몇 건 이상** 있어야 합니다 (수동 확인 · 리뷰 받음 · 테스트 통과 등)

AI 가 자동 생성한 검증 기록만으로는 "자기검증" 이라 인정되지 않습니다. 긴급한 상황엔 사유와 함께 1 건 허용 가능하며, 그 사유는 기록에 남습니다.

### 2. 파생 파일이 원천과 어긋나면 알려줍니다

`spec.yaml` 이 원천, 나머지 (도메인 문서 · 아키텍처 · 코드 · 문서 등) 는 파생. 10 가지 방향으로 정합성을 감지하지만 **자동으로 덮어쓰지 않습니다** — 사용자가 파생을 의도적으로 손질한 경우를 존중하기 위함.

### 3. 읽기 명령은 파일을 건드리지 않습니다

대시보드 · 상태 조회 · 이력 조회 · 드리프트 체크 같은 "읽기" 동작은 어떤 파일도 수정하지 않습니다. 파일 수정 시각 (mtime) 조차 그대로 유지됩니다.

### 4. 모든 결정이 기록에 남습니다

**Claude 가 제안한 것 · 사용자가 고른 것 · 실제 실행된 것** 이 이벤트 로그에 체인으로 남습니다. `git log` 처럼 `grep` · `/harness-boot:work 지난주 뭐 했지` 로 이력 추적 가능.

---

## 전문가 에이전트 팀 (16 역할)

기능의 성격 (UI 여부 · 민감 데이터 · 성능 예산 등) 에 따라 **필요한 에이전트만 자동으로 소환** 됩니다. 전 에이전트를 매번 부르지 않습니다.

| 단계 | 에이전트 |
|---|---|
| 기획 | researcher · product-planner |
| 설계 | ux-architect · visual-designer · audio-designer · a11y-auditor |
| 구현 | software · frontend · backend · security · performance-engineer |
| 품질 | qa-engineer |
| 통합 | integrator · tech-writer |
| 조율 | orchestrator |
| 감사 | reviewer (읽기 전용) |

각 에이전트는 **읽을 수 있는 문서** 와 **사용할 수 있는 도구** 가 선언돼 있고 Claude Code 가 이를 실제로 강제합니다 (예: 검토자는 파일을 수정할 수 없습니다).

**4 개 협업 루틴** 도 자동:

- **시작 모임** — 기능 활성화 직후 관련 에이전트들이 짧은 우려 노트 작성
- **디자인 리뷰** — UI 설계가 저장되면 시각 · 접근성 · 프론트엔드가 병렬로 concerns 제출
- **질문 주고받기** — 에이전트가 불명확한 점을 파일에 떨어뜨리면 조율자가 전달
- **회고** — 완료 시 검토자 → tech-writer 가 회고 prose 작성

상세: [`agents/README.md`](agents/README.md) · [`commands/work.md`](commands/work.md).

---

## 기획 문서 있으면 자동 변환

`plan.md` 가 이미 있으면 대부분 자동입니다:

- 4 단계 파이프라인 — 정찰 (키워드 추출) → 저작 (24 원칙 + 5 도메인 어댑터) → 갭 기록 → 백링크
- 8 개 골든 샘플 회귀 검증 — recall 0.991 · precision 0.861

어댑터: `saas` · `game` · `worker` · `library` · `meta`.

없다면 `/harness-boot:init` 에 한 줄 아이디어만 줘도 조사 → 기획 에이전트가 `plan.md` 를 만든 뒤 스펙으로 변환합니다.

상세: [`skills/spec-conversion/SKILL.md`](skills/spec-conversion/SKILL.md).

---

## 설계 원칙

| 원칙 | 무슨 말인가 |
|---|---|
| **사고의 글 vs 실행의 글** | 🗒 자유 서술과 🔒 계약을 스키마로 분리. AI 는 필드가 묻는 것만 답함 |
| **단일 원천** | 모든 변경의 기준은 `spec.yaml` 하나. 자연어 대화로 자동 갱신되고 나머지는 거기서 파생 |
| **파생 우선 · 사용자 수정 존중** | 파생 파일을 손질하면 감지해 덮어쓰지 않음 |
| **실행 우선 검증** | 첫 기능은 반드시 걸어다니는 뼈대 + 실행 스모크 |
| **Preamble 투명성** | 모든 명령이 3 줄 상태 + 2 줄 우회 거부 선언 |
| **표준 위치 존중** | `.claude/agents/` · `.claude/skills/` — Claude Code 규약 그대로 |

---

## FAQ

**Q. Jira · Linear 같은 이슈 트래커와 겹치지 않나요?**
이슈 트래커는 **사람 팀 조율 도구**, harness-boot 는 **AI 개발 루프의 규율 도구** 입니다. 공존합니다. Jira 가 사람을 조율하는 동안 harness-boot 는 AI 에게 스펙 · 결정 · 근거를 제공합니다.

**Q. spec.yaml 을 직접 편집해야 하나요?**
대부분은 `/harness-boot:work` 이 대화로 채워줍니다. `plan.md` 가 있으면 자동 변환, 한 줄 아이디어만 줘도 조사 → 기획 에이전트가 채웁니다. 직접 편집도 물론 가능.

**Q. 작은 프로젝트엔 과하지 않나요?**
"prototype 모드" 로 설정하면 근거 요구가 완화되고 의례가 가벼워집니다. 그래도 기능 2 개 미만의 토이 프로젝트엔 학습 비용이 이득을 넘어설 수 있습니다. 10+ 기능의 실제 제품부터 규율의 가치가 커집니다.

**Q. 플러그인이 내 코드를 건드리나요?**
아니요. `.harness/` 한 폴더와 Claude Code 규약 경로 (`.claude/agents/` · `.claude/skills/`) 만 관리합니다. 진단 명령은 파일 수정 시각도 바꾸지 않습니다.

**Q. CI 에서도 쓸 수 있나요?**
네. `python3 scripts/*.py` 직접 호출 경로가 영구 유지됩니다:

```yaml
# .github/workflows/ci.yml
- run: python3 scripts/work.py F-0 --run-gate gate_0 --json
- run: python3 scripts/check.py --json
```

---

## 레포 구조

```
harness-boot/
├── .claude-plugin/              # plugin.json · marketplace.json
├── agents/                      # 16 전문가 에이전트
├── commands/                    # 슬래시 명령 (init · work)
├── hooks/                       # session-bootstrap
├── scripts/                     # Python 구현
├── skills/spec-conversion/      # plan.md → spec.yaml 변환
├── docs/                        # 스키마 · 템플릿 · 샘플
└── tests/                       # 단위 · 통합 · 회귀 (742 tests)
```

---

## 현재 상태 · 기여

**v0.9.4** — 2 개 명령어 UX + 완료 근거 원칙 + 시나리오 계약 완결. 742 tests · self_check 5/5.

- **버그 · 제안**: [GitHub Issues](https://github.com/qwerfunch/harness-boot/issues)
- **변경 이력**: [CHANGELOG.md](CHANGELOG.md)
- **기여자 가이드**: [CLAUDE.md](CLAUDE.md)

로컬 개발:

```bash
python3 -m pip install --user -r requirements-dev.txt
python3 -m pytest tests/ -q
bash scripts/self_check.sh
```

## 라이선스

MIT — [LICENSE](LICENSE).
