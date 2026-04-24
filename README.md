# harness-boot

> 자연어 아이디어를 **스펙으로 굳히고**, 전문가 에이전트 팀이 **역할별로 협업해** 실제 돌아가는 코드까지 이끌어내는 **AI 개발 하네스 프레임워크**.

[![version](https://img.shields.io/badge/plugin-v0.9.4-blue)](.claude-plugin/plugin.json)
[![spec](https://img.shields.io/badge/spec-v2.3.8-green)](docs/schemas/spec.schema.json)
[![tests](https://img.shields.io/badge/tests-742%20passing-brightgreen)](tests)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## 이 도구가 하는 일

Claude Code 에서 **자연어로 아이디어를 말하면**, 그 아이디어가 **검증 가능한 스펙** 으로 굳어지고, **역할별 전문가 에이전트** 가 설계·구현·검증을 분담해 **실제로 돌아가는 코드** 로 이어지도록 흐름을 잡아줍니다.

중간에 누수되는 세 가지를 구조로 막습니다:

- **"어떻게" 와 "무엇" 이 섞이는 문단** — 스펙 스키마가 자유 서술과 계약을 분리해, AI 가 계약만 계약으로 다룹니다.
- **기획 결정의 증발** — ADR · 위험 · 트레이드오프가 `domain.md` 로 렌더되어 모든 에이전트가 같은 근거를 봅니다.
- **증거 없는 "됐다"** — 완료 조건에 **누적 근거** 를 요구합니다. 근거가 없으면 `done` 으로 넘어갈 수 없습니다.

---

## 이런 분에게 유용합니다

- Claude Code 로 **혼자 또는 소규모** 제품을 만들면서, AI 가 스스로 "완료" 를 선언해 버리는 상황을 통제하고 싶은 개발자.
- **자연어 한 줄** 을 실제 배포 가능한 피처까지 일관된 방식으로 밀어붙이고 싶은 분.
- 여러 피처를 붙여 나가면서 **결정 이력** · **드리프트 감지** · **감사 로그** 가 필요한 프로젝트.
- 팀 규모를 늘리지 않고도 **frontend · backend · security · a11y · qa** 같은 역할 전문성을 AI 에이전트로 분산하고 싶은 분.

**오버킬일 수 있는 경우**: 피처 1~2 개짜리 스크립트, 일회성 실험. 이 경우 `spec.project.mode: prototype` 으로 의례를 가볍게 돌릴 수 있지만, 그래도 학습 비용 대비 이득이 크지 않을 수 있습니다.

---

## 빠른 시작

Claude Code 2.1 이상에서:

```bash
# 플러그인 설치 (한 번만)
/plugin marketplace add qwerfunch/harness-boot
/plugin install harness-boot@harness-boot

# 새 프로젝트 디렉터리에서 한 줄로
/harness-boot:init 솔로 음악인 연습용 포모도로 타이머

# 이후 일상 작업은 work 하나로
/harness-boot:work
```

**외울 slash command 는 2 개뿐** (`init` · `work`). 인자는 자연어로 말하면 됩니다. Claude 가 의도를 읽어 실행 계획을 제시하고, Y / n / 수정 으로 응답합니다.

**의존성**: Python 3.10+, `pyyaml` (필수), `jsonschema` (권장).

---

## 실제로 써보는 흐름

### 시작 — 아이디어부터 첫 피처까지

```
사용자> /harness-boot:init 솔로 음악인 연습용 포모도로 타이머

Claude> 해석: 아이디어 기반 신규 · prototype 힌트 없음 → product 모드 기본
        1) 배경 조사 (researcher) 로 시작할까요? [Y / 수정 / 설명]

사용자> Y
        ... researcher 가 brief.md 초안 작성 ...

Claude> brief 초안입니다. 어떻게 할까요?
        1) 이대로 다음 (로드맵 설계)   2) 수정   3) 질문   4) 되돌리기

사용자> 1
        ... product-planner 가 plan.md 작성 ...
        ... plan.md → spec.yaml 자동 변환 ...
        ... 첫 피처 F-0 (skeleton) 활성화 ...

Claude> 첫 피처가 준비됐습니다. 검증 실행할까요? [Y / n]
```

각 단계는 **초안 → Y / 수정 / 질문 / 되돌리기 / 다시 시작** 5 옵션 루프. 내부 artifact 는 `v1 · v2 · v3` 로 버전 관리되어 언제든 되돌릴 수 있습니다.

### 일상 — 외우지 않고 말하기

`/harness-boot:work` 뒤에 평소 쓰는 말 그대로:

| 이렇게 말하면 | Claude 가 하는 일 |
|---|---|
| `/harness-boot:work` (인자 없이) | 현재 상태 대시보드 + 다음 할 일 추천 1~3 안 |
| `/harness-boot:work 돌려봐` · `"확인해줘"` · `"테스트"` | 모든 검증 자동 실행 (gate_0~5) |
| `/harness-boot:work 됐어` · `"완료"` · `"done"` | 완료 전이 시도 — 근거 수 부족하면 이유 설명 후 거부 |
| `/harness-boot:work 막혔어` · `"보류"` · `"나중에"` | 보류 상태 + 사유 기록 |
| `/harness-boot:work 다른 거 먼저` · `"잠깐 딴 거"` | 현재 포인터 해제 (피처 자체는 유지) |
| `/harness-boot:work 로그인 흐름` · `"@F-3"` · `"F-3 시작"` | 피처 활성화 (제목 substring · @F-N · 평문 F-N 모두 허용) |
| `/harness-boot:work 이어서` · `"계속"` · `"재개"` | 대시보드가 추천한 피처로 복귀 |
| `/harness-boot:work 확인했어` · `"리뷰 받았어"` | declared evidence 추가 |
| `/harness-boot:work 이건 빼자` · `"취소해줘"` | planned 피처 삭제 (done 은 보호) |

이 표는 예시이고, Claude 는 문맥을 읽어 이 밖의 표현도 해석합니다. **자신 없는 해석은 실행 전에 Plan 으로 공개** 하고 Y/n 을 물어봅니다. 정확히 지정하고 싶으면 **`@F-N`** prefix 나 **`python3 scripts/*.py` 직접 호출** (CI 경로와 동일) 이 영구 보장됩니다.

### 대시보드 예시

```
📊 harness-boot

작업 중: "로그인 흐름"
  진행: 검증 3/6 통과 · 근거 2 개
  차단: 접근성 · Space 키 동작 미정

진행 중 (다른):
  "대시보드"

대기: "로그아웃" · "설정"

다음 할 일:
  (1) 검증 실행: gate_3 (추천)
  (2) 다른 작업으로 전환

Enter = 1 (추천)
```

---

## 2 개 명령어의 역할

### `/harness-boot:init` — 최초 한 번

새 프로젝트에 harness-boot 골격을 깝니다. 자연어 직접 진입 또는 3 옵션 메뉴:

1. **아이디어만 있음** — researcher → product-planner → 설계 변환 (대화형)
2. **기획 문서 있음** (`plan.md`) — 변환 루프 직행
3. **기존 코드 있음** — 현 상태 분석 → 로드맵 초안

### `/harness-boot:work` — 매일

빈 호출은 읽기 전용 대시보드. 자연어가 붙으면 의도 해석 → 실행 계획 공개 → Y/n → 실행. 실행 중 Iron Law · drift 같은 품질 체크는 자동으로 걸립니다.

---

## 품질을 망가뜨리지 않기 위한 장치

### 완료 조건에 근거를 요구합니다 (Iron Law D)

피처를 `done` 으로 넘기려면 다음이 모두 참이어야 합니다:

- **`gate_5` (runtime smoke) 통과** — 실제로 실행되는지 확인.
- **최근 7 일 누적 `declared evidence`** (사용자가 직접 적은 근거):
  - `product` 모드 (기본): **3 개 이상**
  - `prototype` 모드: **1 개 이상**

Gate 러너가 자동 생성한 `gate_run` 기록은 **근거로 인정되지 않습니다** — 자기검증을 자기가 하는 셈이기 때문. 사용자가 "수동 확인했다" · "리뷰 받았다" · "테스트 18/18 통과" 같은 declared 항목을 적어야 카운트됩니다.

긴급 상황엔 `--hotfix-reason "사유"` 로 1 건 허용 가능. 사유는 audit trail 에 자동 기록됩니다.

### 파생 파일이 원천과 어긋나면 알려줍니다 (drift 10-way)

`spec.yaml` 은 단일 원천, 나머지 (`domain.md` · `architecture.yaml` · `harness.yaml` · 코드 · 문서 · 앵커 등) 는 파생. 파생이 원천에서 벗어나면 10 가지 축으로 감지 — 그러나 **자동으로 덮어쓰지 않습니다**. 사용자가 파생을 일부러 손질한 경우를 존중하기 위함.

### 읽기 명령은 파일 mtime 도 바꾸지 않습니다 (CQS)

대시보드 · 상태 조회 · 이벤트 조회 · 드리프트 체크 등 "읽기" 동작은 어떤 파일도 수정하지 않습니다. 테스트가 mtime 불변을 강제합니다.

### 모든 결정이 events.log 에 남습니다 (audit chain)

**LLM 이 제안한 것 · 사용자가 고른 것 · 실제 실행된 것** 이 `events.log` 에 체인으로 기록됩니다. `grep` · `git log` · `/harness-boot:work 지난주 뭐 했지` 로 추적.

---

## 전문가 에이전트 팀 (16 역할)

피처의 성격 (UI 있음 · 민감 데이터 · 성능 예산 등) 에 따라 **자동으로 필요한 에이전트만 소환** 됩니다. 전 에이전트를 매번 부르지 않습니다.

| 단계 | 에이전트 |
|---|---|
| Discovery (기획) | researcher · product-planner |
| eXperience (설계) | ux-architect · visual-designer · audio-designer · a11y-auditor |
| Engineering (구현) | software · frontend · backend · security · performance-engineer |
| Quality (품질) | qa-engineer |
| Integration (통합) | integrator · tech-writer |
| Coordination (조율) | orchestrator |
| Audit (감사) | reviewer (읽기 전용) |

각 에이전트는 읽을 수 있는 문서 계층 · 사용할 수 있는 도구가 `agents/<이름>.md` frontmatter 로 선언돼 있고, Claude Code 가 이를 실제로 강제합니다 (예: reviewer 는 `Read · Grep · Glob · Bash` 만 — 코드를 수정할 수 없음).

**4 개 협업 루틴** 도 자동:

- **Kickoff** — 피처 활성화 직후 매칭된 에이전트들에게 "80 단어 내 우려 3 bullet" 수집.
- **Design Review** — UI 피처의 flows 가 저장되면 visual · frontend · a11y 가 병렬 concerns 제출.
- **Q&A** — 에이전트가 불명확한 점을 파일에 떨어뜨리면 orchestrator 가 대상 에이전트에 전달.
- **Retrospective** — 완료 시점에 reviewer → tech-writer 가 회고 prose 작성.

상세: [`agents/README.md`](agents/README.md) · [`commands/work.md`](commands/work.md).

---

## plan.md → spec.yaml 자동 변환

`plan.md` 가 이미 있다면 대부분 자동입니다:

- 4 단계 파이프라인 — 정찰 (키워드 추출) → 저작 (24 원칙 + 5 도메인 어댑터) → 갭 기록 → 백링크.
- 8 개 골든 샘플 회귀 검증 — recall 0.991 · precision 0.861.

어댑터: `saas` · `game` · `worker` · `library` · `meta`.

없다면 `/harness-boot:init` 에 한 줄 아이디어만 줘도 researcher → product-planner 가 `plan.md` 를 만든 뒤 스펙으로 변환합니다.

상세: [`skills/spec-conversion/SKILL.md`](skills/spec-conversion/SKILL.md).

---

## 설계 원칙

| 원칙 | 무슨 말인가 |
|---|---|
| **사고의 글 vs 실행의 글** | 🗒 자유 서술과 🔒 ID·enum·수치를 스키마로 분리. AI 는 필드가 묻는 것만 답함. |
| **단일 원천** | 사용자 편집은 `spec.yaml` 하나. 나머지는 전부 파생. |
| **파생 우선 · 사용자 수정 존중** | 파생 파일을 사용자가 손질하면 감지해 덮어쓰지 않음. |
| **실행 우선 검증** | 첫 피처는 반드시 `skeleton` (걸어다니는 뼈대) + `gate_5` (runtime smoke). |
| **Preamble 투명성** | 모든 명령이 3 줄 상태 + 2 줄 우회 거부 선언. |
| **표준 위치 존중** | `.claude/agents/` · `.claude/skills/` — Claude Code 규약 그대로. |

---

## FAQ

**Q. Jira · Linear 같은 이슈 트래커와 겹치지 않나요?**
이슈 트래커는 **사람 팀 조율 도구** 이고, harness-boot 는 **AI 개발 루프의 규율 도구** 입니다. 공존합니다. Jira 가 사람을 조율하는 동안 harness-boot 는 AI 에게 스펙·결정·증거를 제공합니다.

**Q. spec.yaml 을 직접 편집해야 하나요?**
대부분은 `/harness-boot:work` 이 대화로 채워줍니다. `plan.md` 가 있으면 자동 변환, 한 줄 아이디어만 줘도 researcher → product-planner 가 채웁니다. 직접 편집도 물론 가능하고, 편집 후 `/harness-boot:work 돌려봐` 하면 파생 재생성 + 검증이 묶여 실행됩니다.

**Q. 작은 프로젝트엔 과하지 않나요?**
`spec.project.mode: prototype` 으로 설정하면 근거 요구가 3 → 1 로 완화되고 의례도 가벼워집니다. 그래도 피처 2 개 미만의 토이 프로젝트엔 학습 비용이 이득을 넘어설 수 있습니다. 10+ 피처의 실제 제품부터 규율의 가치가 커집니다.

**Q. 플러그인이 내 코드를 건드리나요?**
아니요. 플러그인이 관리하는 건 `.harness/` 한 폴더와 Claude Code 규약 경로 (`.claude/agents/` · `.claude/skills/`) 뿐입니다. 진단 명령은 mtime 도 바꾸지 않습니다.

**Q. CI 에서도 쓸 수 있나요?**
네. `python3 scripts/*.py` 직접 호출 경로가 영구 유지됩니다. `@F-N` prefix 로 명시적 피처 지정도 가능:

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
├── scripts/                     # Python 구현 (결정론 · 순수)
│   ├── core/                    # state · event_log · canonical_hash · plugin_root
│   ├── ui/                      # feature_resolver · intent_planner · dashboard · scenarios
│   ├── ceremonies/              # kickoff · design_review · retro · inbox
│   ├── gate/                    # gate_runner (auto-detect pytest/mypy/ruff/...)
│   ├── render/                  # domain.md · architecture.yaml 렌더링
│   ├── spec/                    # mode_classifier · validate · include_expander · mode_b_*
│   ├── sync.py · work.py · status.py · check.py · events.py · metrics.py
│   └── self_check.sh            # SSoT · validate · sync · check · commands 5 단계
├── skills/spec-conversion/      # plan.md → spec.yaml 변환 스킬
├── docs/
│   ├── schemas/spec.schema.json # v2.3.8 JSONSchema
│   ├── templates/starter/       # init 복사 대상 4 템플릿
│   └── samples/harness-boot-self/   # 자기 표현 canonical spec
└── tests/
    ├── unit/                    # 단위 테스트 (결정론 경로)
    ├── integration/             # 시나리오 매핑 end-to-end
    └── regression/              # golden samples (plan.md → spec.yaml)
```

---

## 현재 상태 · 기여

**v0.9.4** — 2-command UX + Iron Law D (누적 근거) + 시나리오 계약 테이블 완결. 742 tests · self_check 5/5.

- **버그 · 제안**: [GitHub Issues](https://github.com/qwerfunch/harness-boot/issues)
- **변경 이력**: [CHANGELOG.md](CHANGELOG.md)
- **기여자 가이드**: [CLAUDE.md](CLAUDE.md)
- **스키마 참조**: [`docs/schemas/spec.schema.json`](docs/schemas/spec.schema.json)

로컬 개발:

```bash
python3 -m pip install --user -r requirements-dev.txt
python3 -m pytest tests/ -q
bash scripts/self_check.sh
```

## 라이선스

MIT — [LICENSE](LICENSE).
