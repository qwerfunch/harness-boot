# harness-boot

> **자연어로 쓴 기획 의도를 AI 가 따라갈 수 있는 "중간언어" 로 바꾸고, 그 중간언어를 SSoT 로 삼아 개발 결과까지 이끌어내는 Harness-Boot.**
>
> Claude Code 플러그인으로 제공.

[![version](https://img.shields.io/badge/plugin-v0.3.1-blue)](.claude-plugin/plugin.json)
[![spec](https://img.shields.io/badge/spec-v2.3.8-green)](docs/schemas/spec.schema.json)
[![tests](https://img.shields.io/badge/tests-261%20passing-brightgreen)](tests/unit)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## 왜?

LLM 에게 "이런 제품을 만들어줘" 라고 자연어로 던지면 **사고의 글** (서사·의도·맥락) 과 **실행의 글** (실제로 돌아가야 할 계약) 이 한 프롬프트 안에 섞입니다. 어디까지가 아이디어고 어디부터가 계약인지 LLM 이 판별 못 하니 피처 6번째쯤에서 문맥이 어긋나고, "됐다" 라고 말해도 실제 흔적은 없습니다.

**Harness-Boot 의 답** — 이 두 글을 한 파일 (`spec.yaml`) 안에서 **스키마로 분리** 하고, 두 글이 어긋나거나 실행 결과와 차이가 나면 알려주는 **규율 구조 (harness)** 를 LLM 개발에 걸어둡니다. AI 는 그 구조 안에서 움직이며, 모든 진전은 해시와 이벤트로 추적됩니다.

> 사고의 글은 자유로워야 하고, 실행의 글은 구조화되어야 합니다.
> 두 글이 어긋날 때 알려주는 것이 **harness 의 일** 입니다.

---

## 핵심 흐름

사용자가 관리하는 파일은 `spec.yaml` 하나. `🗒 사고의 글` 과 `🔒 실행의 글` 이 스키마 경계로 공존하고, 모든 파생·개발·관찰은 이 SSoT 에서 출발.

```
        자연어 기획 (plan.md · 대화 · 아이디어)
                       │
                       │  /harness:init          (최초 1회 · 스캐폴딩)
                       ▼
         ╔══════════════════════════════════════╗
         ║          spec.yaml  (SSoT)           ║  ←  /harness:spec
         ║    🗒 사고의 글    · 자유 서술        ║    (작성 · 편집 ·
         ║    🔒 실행의 글    · 스키마 검증      ║     정제 · 설명)
         ║                                      ║     · 직접 편집 OK
         ╚══════════╤══════════════════╤════════╝
                    │                  │
             /harness:sync      /harness:work  <피처 ID>
                    │                  │
                    ▼                  ▼
        ┌───────────────────┐  ┌──────────────────────┐
        │  파생 뷰          │  │  개발 사이클          │
        │  · domain.md      │  │  · Gate 0~5           │
        │  · architecture   │  │    (gate_0 자동 실행) │
        │  · 해시트리       │  │  · evidence 수집      │
        │    (Merkle)       │  │  · BR-004 → done 차단 │
        └───────────────────┘  └──────────────────────┘

        관찰 (read-only · CQS):
           /harness:status   세션 · 피처 · drift 요약
           /harness:check    drift 리포트 (spec · derived · include · …)
           /harness:events   events.log 필터 조회
```

**어긋남을 찾는 3 지점**:
- `spec.yaml` — 스키마 검증으로 실행의 글 형식 불일치.
- `/harness:sync` — 해시 비교로 파생 drift.
- `/harness:work` — Gate 실행 결과로 증거 없는 `done` 주장 차단.

---

## 설치

```
/plugin marketplace add qwerfunch/harness-boot
/plugin install harness@harness-boot
```

Claude Code 재시작 후 `/harness:init` 가 자동완성에 뜨면 성공. 의존성: Python 3.10+, `pyyaml`, `jsonschema` (선택).

---

## 8 개 슬래시 명령

| 명령 | 역할 | 상태 |
|------|------|:---:|
| `/harness:init` | `.harness/` 스캐폴딩 + CLAUDE.md 편성. `--solo` / `--team` | ✅ v0.1.0 |
| `/harness:spec` | spec.yaml 편집 · Mode A 추가 / B 신규 / R 정제 / E 설명 | 🛠 v0.2 (classifier + Mode E 구현, A/R/B LLM 드리븐) |
| `/harness:sync` | spec → `domain.md` · `architecture.yaml` · `harness.yaml` 파생 + Merkle 해시 갱신 | ✅ v0.2 |
| `/harness:work` | 피처 단위 개발 사이클 (활성화 · Gate 기록/자동실행 · evidence · done 전이) | ✅ v0.3 (`--run-gate gate_0` 자동) |
| `/harness:status` | 세션·피처·drift·마지막 sync 요약 (CQS) | ✅ v0.3 |
| `/harness:check` | drift 5/8 탐지 (Generated · Spec · Derived · Include · Evidence) | 🛠 v0.3 (Code/Doc/Anchor 는 v0.3.2+) |
| `/harness:events` | events.log 필터 조회 (CQS) | ✅ v0.3 |
| `/harness:metrics` | 집계 지표 (lead time · gate pass rate · drift 빈도) | ⏳ v0.3.2+ |

✅ full · 🛠 partial · ⏳ planned.

---

## 전형 사용 흐름

```bash
# 빈 프로젝트에서 claude 실행 후:
/harness:init --solo                         # .harness/ · CLAUDE.md 스캐폴딩
/harness:spec plan.md                        # plan.md → spec.yaml 자동 변환 (Mode B-2)
                                             # (plan.md 없으면 /harness:spec 만으로 대화식)
/harness:sync                                # spec → domain.md · architecture.yaml 파생
/harness:status                              # 생성된 피처 목록·ID 확인 (F-001, F-002, ...)
/harness:work <피처 ID>                      # 선택 피처 활성화 (planned → in_progress)
/harness:work <피처 ID> --run-gate gate_0    # 테스트 자동 실행 + evidence 자동
/harness:check                               # drift 점검 (read-only)
/harness:work <피처 ID> --complete           # gate 통과 + evidence 있어야 done
```

피처 ID 는 `/harness:spec` 변환 결과에서 자동 생성됩니다 (`F-001`, `F-002`, …). `/harness:status` 로 언제든 목록 조회.

---

## plan.md → spec.yaml 변환 (Mode B)

plan.md 가 이미 있으면 대부분 자동화됩니다.

- 4-stage 파이프라인: **정찰** (Mode B 통계 추출) → **저작** (24 원칙 + 5 도메인 어댑터) → **gap** (unrepresentable 카탈로그) → **backlink** (source_ref 매트릭스).
- 8 golden 샘플 + 회귀 러너로 검증 (recall 0.991 / precision 0.861, BM25 기반).
- 어댑터: `saas` · `game` · `worker` · `library` · `meta`. self-bootstrap 메타 케이스 포함.

**참조**:
- [`skills/spec-conversion/SKILL.md`](skills/spec-conversion/SKILL.md) — v0.5 스킬 가이드 (24 원칙 · 어댑터)
- [`tests/regression/conversion-goldens/`](tests/regression/conversion-goldens/) — 8 완성 샘플 + `MANIFEST.yaml`
- [`docs/samples/harness-boot-self/`](docs/samples/harness-boot-self/) — harness-boot **자신** 을 변환한 canonical spec (self-referential)

plan.md 가 없어도 `/harness:spec` 대화로 spec.yaml 을 빈 상태에서 채워나갈 수 있습니다 (Mode B-1).

---

## 레포 구조

```
harness-boot/
├── .claude-plugin/
│   ├── plugin.json              # Claude Code 플러그인 매니페스트
│   └── marketplace.json         # single-plugin marketplace (v0.1.1+)
├── commands/                    # 8 슬래시 명령 계약
│   ├── init.md · spec.md · sync.md · work.md
│   └── status.md · check.md · events.md · (metrics.md 예정)
├── scripts/                     # Python 구현체 (pyyaml · jsonschema 의존)
│   ├── sync.py · include_expander.py · canonical_hash.py · render_*.py
│   ├── work.py · status.py · check.py · events.py · state.py
│   ├── spec_mode_classifier.py · explain_spec.py · spec_diff.py
│   ├── validate_spec.py · plugin_root.py · gate_runner.py
│   └── mode_b_*.py              # plan.md → spec.yaml 통계 추출
├── skills/
│   └── spec-conversion/SKILL.md # v0.5 변환 스킬
├── docs/
│   ├── schemas/spec.schema.json # spec v2.3.8 JSONSchema
│   ├── templates/starter/       # /harness:init 템플릿
│   ├── samples/harness-boot-self/  # self-referential canonical spec
│   ├── setup/                   # 설치 · first-run 가이드
│   └── release/                 # 태깅 플레이북
└── tests/
    ├── unit/                    # 261 unit tests (11 modules)
    └── regression/conversion-goldens/  # 8 golden 변환 샘플
```

---

## 상태 · 버전

| 릴리즈 | 핵심 내용 |
|---|---|
| v0.1.0~0.1.1 | `/harness:init` 스캐폴딩 · first-run hardening |
| v0.2.0~0.2.1 | `/harness:sync` Phase 0 · self-describe round trip · `plugin_version` 해석 |
| v0.3.0 | `/harness:work` · `/harness:status` · `/harness:check` · `/harness:events` |
| **v0.3.1 (current)** | `/harness:work --run-gate gate_0` 테스트 자동 실행 |
| v0.3.2+ (계획) | Gate 1~5 자동화 · Code/Doc/Anchor drift · `/harness:metrics` |
| v0.4 (후보) | 공식 마켓플레이스 PR · 실사용 피드백 통합 · 대형 스펙 확장 |

**검증 수준** (v0.3.1 기준):
- 261 unit tests (11 모듈 · pytest/unittest 호환)
- self-describe round trip 검증 (harness-boot 스스로를 변환한 spec 으로 sync 실행 → 일관된 domain/architecture 파생)
- end-to-end work cycle dogfood (F-099 활성화 → gate_5 기록 → evidence → done · BR-004 enforcement 확인)

---

## 하네스 엔지니어링 — 8 기둥

harness = LLM 개발에 걸어놓는 **규율 구조**. 아래는 그 구조를 지탱하는 원칙들.

### 1. 사고의 글 vs 실행의 글

두 글은 물리적으로 분리된 파일이 아니라 `spec.yaml` 안에 공존. 분리는 파일이 아닌 **필드의 성격** 으로 이루어짐. 🗒 는 자유 서술 (description · rationale · vision), 🔒 는 enum·ID·숫자 (features[].id · coverage_threshold). 스키마가 경계를 강제하니 사용자는 구조를 외울 필요 없이 "필드가 묻는 것" 만 답하면 됨.

### 2. Single Source of Truth

모든 정보는 `.harness/` 에 한 곳. `.claude/` 아래 파일들은 이 원천에서 **생성된 어댑터**. 파생 파일 (`domain.md` · `architecture.yaml`) 은 뷰이지 원천 아님.

### 3. Schema-First

구조화된 데이터는 JSONSchema 로 검증. v2.2 이후 사용자가 직접 편집하는 구조화 파일은 `spec.yaml` 하나지만, 파생 파일도 모두 명시적 스키마 보유 → `/harness:check` 대상. 스키마 위반은 sync 를 차단.

### 4. User-Minimal Input

사용자가 직접 편집하는 파일은 `spec.yaml` **단 하나**. `/harness:spec` (Mode A/B/R/E · spec-conversion 스킬) 로 대화·변환 경로도 제공 — 원칙은 직접 편집, 도구는 도움. 파일 하나만 알면 되는 인지 부담 감소.

### 5. Derive-first, Respect-edit

파생 파일은 원칙적으로 편집 대상 아님 (뷰). 드문 예외 (architecture.yaml 수동 규칙 등) 를 위해 **edit-wins 안전망** 유지. 해시 불일치 감지 시 재생성 건너뛰고 `/harness:check` 가 drift 로 리포트 — 덮어쓰기 금지.

### 6. Runtime-Verified First

v1.0 에서 "피처는 완료됐는데 앱이 안 켜지는" 문제를 방지. 세 장치:
- **Walking Skeleton 강제** — `features[0].type = "skeleton"` 은 공허하더라도 엔드-투-엔드 실행되는 최소 뼈대. v0.3.2 부터 JSONSchema 가 검증 (`features[0].type` enum = `["skeleton"]`).
- **Gate 5 필수** ✅ — 빌드 + 실행 + smoke scenario 통과 없이는 피처 `done` 불가. `/harness:work --complete` 가 `gate_5=pass + evidence ≥ 1` 없이 거부 (BR-004 Iron Law).
- **integrator 에이전트** ⏳ (v0.4+) — 피처 완료 시 메인 조립 (DI·라우터) 에 wire-up 책임을 명시한 에이전트. 설계 원칙만 있고 `agents/` 디렉터리는 아직 ship 안 됨.

### 7. Transparency-by-Preamble

모든 `/harness:*` 명령은 stdout 첫 3 줄에 `<이모지> <command> · <mode> · <근거>` 형식 preamble + anti-rationalization 2 행. LLM 이 모드 자동 판별을 이유 없이 수행하면서 "건너뛴 걸 합리화" 하는 경로 차단. 80 자 고정 포맷 → 로그 스크레이핑·감사 가능. 이벤트 로그에 `auto_mode_selected` 로 사후 추적.

### 8. Standard-First

Claude Code 가 요구하는 파일은 Claude Code 규약 위치 (`.claude/agents/`, `.claude/skills/`, `.claude/settings.json`). 우리만의 자산은 `.harness/` 에만. 규약을 거스르지 않음.

---

### 엔지니어링 보충 (구현 세부)

8 기둥을 성립시키는 실제 메커니즘:

- **Canonical Hashing** ✅ — Canonical YAML → Canonical JSON → SHA-256 Merkle 트리. 주석·키순서·공백 무시, 의미 변경만 감지. Python 내 결정론 · Unicode · subtree + merkle root 를 19 tests 로 강제. **cross-language 테스트 벡터** (Node/Go 등에서 같은 해시) 는 v0.4+ 예정.
- **CQS (Command-Query Separation)** ✅ — 진단 명령 (`/harness:status` · `:check` · `:events`) 은 파일 **읽기만**, mtime 불변 테스트로 검증. `/harness:metrics` 는 v0.3.2+.
- **Append-only event log** ✅ (BR-013) — `events.log` JSONL, 모든 쓰기는 `open(mode="a")`. 로그 회전 (`events.log.YYYYMM` 분할) 은 v0.4+.
- **Hook fail-open** ⏳ (BR-006) — 원칙만 선언. `hooks/` 디렉터리 자체가 아직 ship 안 됨. 훅이 도입되는 시점 (v0.4+) 부터 enforce 대상.
- **Self-hostable** ✅ — harness-boot 자체도 `docs/samples/harness-boot-self/spec.yaml` 로 표현됨. v0.2 부터 self-describe round trip. **v0.3.10 부터 레포 루트에 `.harness/` 를 두어 자기 스크립트로 자기 무결성 검증** (`bash scripts/self_check.sh` — 5 단계 diff/validate/sync/check/commands 규약 · unittest 에 포함).

---

## 참여

- [CHANGELOG.md](CHANGELOG.md) · [CLAUDE.md](CLAUDE.md) · [docs/schemas/spec.schema.json](docs/schemas/spec.schema.json)
- 버그·제안: [GitHub Issues](https://github.com/qwerfunch/harness-boot/issues).

## 라이선스

[MIT](LICENSE) · © qwerfunch
