# harness-boot

> **2 개의 명령어**로 자연어 한 줄부터 운영 가능한 코드까지. spec.yaml 을 SSoT 로, AI 협업을 규율있게.

[![version](https://img.shields.io/badge/plugin-v0.9.4-blue)](.claude-plugin/plugin.json)
[![spec](https://img.shields.io/badge/spec-v2.3.8-green)](docs/schemas/spec.schema.json)
[![tests](https://img.shields.io/badge/tests-742%20passing-brightgreen)](tests)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## 한 줄 요약

Claude Code 에서 **`/harness-boot:init` + `/harness-boot:work`** 2 개 명령어로 자연어 아이디어 → 설계 → 구현 → 완료 사이클을 돌린다. 사용자가 외울 건 **명령 이름 2 개뿐** — 나머지는 자연어로 말하고 Claude 가 해석해 제안 · Y/n 실행.

**왜 이 도구가 필요한가**

- **"됐다"는 말에 증거를 요구한다** — Iron Law D (누적 declared evidence ≥ 3) 를 넘지 못하면 완료 거부.
- **파생 파일이 원천과 어긋나면 감지한다** — spec.yaml ↔ domain.md ↔ architecture.yaml ↔ code 10-way drift.
- **모든 결정이 events.log 에 남는다** — LLM 이 제안한 것 · 사용자가 고른 것 · 실제 실행된 것을 체인으로.

---

## 빠른 시작

```bash
# Claude Code 2.1+ 에서
/plugin marketplace add qwerfunch/harness-boot
/plugin install harness-boot@harness-boot

# 새 프로젝트 디렉터리에서 — 한 줄이면 됩니다
/harness-boot:init 솔로 음악인 연습용 포모도로 타이머

# 이후 일상은 work 하나로
/harness-boot:work                 # 대시보드 + 다음 할 일
```

의존성: Python 3.10+ · `pyyaml` (필수) · `jsonschema` (권장).

---

## 어떻게 말해도 됩니다

자연어로 말하면 Claude 가 의도를 해석 → Plan 으로 공개 → Y/n 로 실행. 아래는 **정식 계약 테이블** (README ↔ [`scripts/ui/scenarios.py`](scripts/ui/scenarios.py) ↔ [`tests/integration/test_scenario_mappings.py`](tests/integration/test_scenario_mappings.py) 가 같은 소스로 동기).

### 일상

| 이렇게 말하면 | 이렇게 해석합니다 |
|---|---|
| `/harness-boot:work` (빈 호출) | 현재 상태 + 다음 할 일 추천 1~3 안 |
| "돌려봐" · "확인해줘" · "테스트" · "검증" | 모든 검증 자동 실행 (gate_0~5) |
| "됐어" · "끝났어" · "완료" · "done" | 완료 전이 — Iron Law D 누적 근거 체크 |
| "막혔어" · "보류" · "나중에" · "block" | 보류 상태로 전환 + 사유 기록 |
| "다른 거 먼저" · "잠깐 딴 거" · "deactivate" | 현 작업 포인터 해제 — 피처 상태는 유지 |

### 시작 · 전환

| 이렇게 말하면 | 이렇게 해석합니다 |
|---|---|
| "로그인 흐름" · "@F-3" · "F-3 시작" | 피처 활성화 — 제목 substring · `@F-N` · 평문 `F-N` |
| "이어서" · "계속" · "재개" | 대시보드 추천이 가리키는 피처로 복귀 |

### 근거 · 정리

| 이렇게 말하면 | 이렇게 해석합니다 |
|---|---|
| "확인했어" · "수동 확인" · "리뷰 받았어" | declared evidence 추가 (Iron Law D 카운트) |
| "이건 빼자" · "취소해줘" · "없던 걸로" | planned 피처 삭제 (done 피처는 보호) |

파워 유저는 **`@F-N` prefix** 또는 **`python3 scripts/*.py` 직접 호출** 경로를 영구 유지. CI 에서도 같은 경로 사용.

---

## 2 개 명령어의 구조

### `/harness-boot:init` — 최초 1 회

프로젝트 부팅. 자연어 직접 진입 또는 3 옵션 메뉴:

- **1) 아이디어만** → researcher → product-planner → 설계 변환 (대화형 티키타카)
- **2) 기획 문서 있음** (`plan.md`) → 변환 루프 직행
- **3) 이미 코드 있음** → 현 상태 분석 → 로드맵 초안

각 단계는 **초안 제시 → Y / 수정 / 질문 / 되돌리기 / 다시** 5 옵션 루프. Artifact 는 `v1 · v2 · v3` 로 버전 관리.

### `/harness-boot:work` — 일상

빈 호출 → 대시보드 + 다음 할 일. 자연어 입력 → 의도 해석 → 실행.

**대시보드 출력 예시**:

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

## 품질 불변량 (절대 손상 없음)

- **Iron Law D** (BR-004 강화 · v0.9.3) — 완료 조건:
  - `gate_5` (runtime smoke) pass
  - 최근 7 일 **declared evidence** (kind ≠ `gate_run` · `gate_auto_run`) ≥ N
  - `product` 모드: N=3 (default) · `prototype` 모드: N=1
  - `--hotfix-reason "..."` 긴급 override: product 도 N=1, 사유를 audit trail 에 자동 기록
- **Drift 10/10** — spec · derived · include · evidence · code · doc · anchor · generated · SSoT · link 전 방향 감지. 자동 수정 없음 (사용자 의도 존중).
- **CQS 읽기 전용** — 대시보드 · status · check · events · metrics 는 mtime 까지 불변.
- **Events.log 투명 audit** — 모든 LLM 제안 · 사용자 선택 · 실행 결과 체인 기록.
- **결정론 경로 보존** — Gate · Drift · Iron Law 판정은 `scripts/` · LLM 은 라우팅만.

---

## 전문가 에이전트 팀 (16 역할)

피처 `shape` (UI 여부 · 민감 데이터 · 성능 예산 등) 에 따라 orchestrator 가 자동 라우팅. `@harness:<이름>` 으로 직접 호출도 가능.

| 단계 | 에이전트 |
|---|---|
| Discovery | researcher · product-planner |
| eXperience | ux-architect · visual-designer · audio-designer · a11y-auditor |
| Engineering | software · frontend · backend · security · performance-engineer |
| Quality | qa-engineer |
| Integration | integrator · tech-writer |
| Coordination | orchestrator |
| Audit | reviewer (read-only) |

각 에이전트는 `agents/<이름>.md` 에 자기가 읽을 3 계층 (`domain.md` / `architecture.yaml` / `plan.md`) 을 선언. frontmatter `tools:` 로 권한 강제.

상세: [`agents/README.md`](agents/README.md) · [`commands/work.md` § Orchestration Routing`](commands/work.md).

---

## 4 개 협업 루틴 (자동 발화)

실제 팀에서 쓰는 루틴을 LLM 워크플로에 이식. 각 산출은 `.harness/_workspace/` 에 파일로 남아 `grep` · `git` 으로 추적.

| 루틴 | 트리거 | 산출 |
|---|---|---|
| **Kickoff** | `/harness-boot:work F-N` activate 직후 | `_workspace/kickoff/F-N.md` · 에이전트별 우려 3 bullet |
| **Design Review** | ux-architect 가 flows 저장 후 | `_workspace/design-review/F-N.md` · 병렬 concerns 수집 |
| **Q&A (file-drop)** | 에이전트가 불명확 발견 | `_workspace/questions/F-N--from--to.md` · 파일 기반 polling |
| **Retrospective** | `/harness-boot:work F-N --complete` 직후 | `_workspace/retro/F-N.md` · reviewer → tech-writer 순차 |

세 루틴 (kickoff · design-review · retro) 은 idempotent — 사용자 curation 이 재실행으로 덮이지 않음. `--kickoff` · `--design-review` · `--retro` flag 로 강제 재생성.

---

## plan.md → spec.yaml 자동 변환

`plan.md` 가 있으면 4 단계 파이프라인으로 거의 자동:

1. **정찰** — BM25 키워드·통계 추출
2. **저작** — 24 원칙 + 5 도메인 어댑터 (saas · game · worker · library · meta)
3. **갭 기록** — 스펙으로 표현 불가능한 부분 카탈로그
4. **백링크** — 각 스펙 필드를 `plan.md` 행 번호로 연결

8 개 골든 샘플 회귀 러너로 검증 (recall 0.991 · precision 0.861).

상세: [`skills/spec-conversion/SKILL.md`](skills/spec-conversion/SKILL.md) · [`docs/samples/harness-boot-self/`](docs/samples/harness-boot-self/).

---

## 설계 원칙

| 원칙 | 의미 |
|---|---|
| **사고의 글 vs 실행의 글** | 🗒 자유 서술 ↔ 🔒 ID·enum·수치. 스키마로 경계 강제. |
| **단일 원천** | 사용자 편집 대상은 `spec.yaml` 하나. 나머지 전부 파생. |
| **파생 우선 · 사용자 수정 존중** | 사용자가 파생 파일 직접 수정하면 해시 비교로 감지 · 덮어쓰지 않음. |
| **실행 우선 검증** | 첫 피처는 반드시 `skeleton` 타입 + gate_5 (runtime smoke). |
| **Preamble 투명성** | 모든 명령이 3 줄 상태 표시 + 2 줄 근거/우회 거부 선언 (BR-014). |
| **표준 위치 존중** | `.claude/agents/` · `.claude/skills/` — Claude Code 규약 그대로. |

---

## 현재 상태

**v0.9.4** 기준:

- ✅ Claude Code 플러그인 · 2-command UX 완결
- ✅ Iron Law D (누적 declared evidence · hotfix override)
- ✅ Drift 10/10 · CQS 불변 · events.log 체인 기록
- ✅ 16 전문가 에이전트 · 4 협업 루틴 auto-wire (kickoff · design-review · retro · Q&A polling)
- ✅ spec-conversion 스킬 + 8 golden samples · 742 tests · self_check 5/5 PASS

**열린 작업** (v0.9.5+):

- `project.mode` prototype/product 의례 경량화 분기
- 정식 시나리오 테이블 v0.10 재정비 (legacy shim 제거)
- Cross-language canonical hash 테스트 벡터
- Event log rotation (`events.log.YYYYMM`)

릴리즈 이력: [`CHANGELOG.md`](CHANGELOG.md).

---

## 레포 구조

```
harness-boot/
├── .claude-plugin/              # plugin.json · marketplace.json
├── agents/                      # 16 전문가 에이전트
├── commands/                    # 슬래시 명령 (init · work)
├── hooks/                       # session-bootstrap
├── scripts/                     # Python 구현 (pure · deterministic)
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
│   └── samples/harness-boot-self/  # 자기 표현 canonical spec
└── tests/
    ├── unit/                    # 단위 테스트 (결정론 경로)
    ├── integration/             # 시나리오 매핑 end-to-end
    └── regression/              # golden samples (plan.md → spec.yaml)
```

---

## FAQ

**Q. 기존 프로젝트 관리 도구 (Linear · Jira) 와 겹치지 않나요?**
사람 팀 조율이 아니라 **AI 개발 루프의 규율 도구**입니다. Jira 는 사람을 조율하고 harness-boot 는 AI 에게 스펙·결정·증거를 제공합니다. 공존합니다.

**Q. 작은 프로젝트엔 과하지 않나요?**
`spec.project.mode: prototype` 을 설정하면 Iron Law D 가 N=3 → N=1 로 완화되고 의례도 경량화됩니다 (v0.9.5+ 점진 확장). 토이 규모에서도 부담 없이 시작 가능.

**Q. spec.yaml 을 직접 편집해야 하나요?**
대부분은 `/harness-boot:work` 이 대화로 채워줍니다. `plan.md` 가 있으면 자동 변환, 한 줄 아이디어만 줘도 researcher → product-planner 가 풍부한 plan.md 를 만든 뒤 스펙으로 변환.

**Q. 플러그인이 내 코드를 건드리나요?**
아니요. `.harness/` 와 Claude Code 규약 경로 (`.claude/agents/` · `.claude/skills/`) 만 관리합니다. 진단 명령은 mtime 도 바꾸지 않습니다.

**Q. CI 에서 사용할 수 있나요?**
네. `python3 scripts/*.py` 직접 호출 경로가 영구 유지됩니다. `@F-N` prefix 도 슬래시 명령에서 계속 사용 가능.

```yaml
# .github/workflows/ci.yml
- run: python3 scripts/work.py F-0 --run-gate gate_0 --json
- run: python3 scripts/check.py --json
```

---

## 기여

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
