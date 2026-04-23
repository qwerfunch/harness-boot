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

LLM 에게 "이런 제품을 만들어줘" 라고 자연어로 던지면 출력은 매번 다릅니다. 서두는 멋지지만 피처 6번째쯤에서 문맥이 어긋나고, "됐다" 라고 말하는데 실제로 뭐가 됐는지는 확인할 길이 없습니다.

**Harness-Boot 가 해결하는 것**: 자연어 기획 의도와 실제 구현 사이에 **구조화된 중간언어 (`spec.yaml`)** 를 심어, AI 가 그것을 SSoT 로 삼아 파생·개발·검증을 자동화하도록 강제합니다. 사용자는 spec.yaml 한 파일만 관리하고, 나머지는 모두 파생물이며, 모든 완료 선언은 증거와 해시로 추적됩니다.

---

## 핵심 흐름

```
  자연어 기획 · 입력
  plan.md · 대화 · 기존 코드
          │
          │  /harness:spec   (변환 · 편집 · 정제는 도구 경유)
          ▼
  ╔═══════════════════════════════════════════════════════╗
  ║  Harness-Boot   (Claude Code 플러그인)                ║
  ║  ─────────────────────────────────────────────        ║
  ║   spec.yaml   AI 중간언어 · SSoT · Merkle 해시        ║
  ║      │                          │                     ║
  ║      │ /harness:sync            │ /harness:work <피처>║
  ║      ▼                          ▼                     ║
  ║   파생 뷰                  개발 사이클                ║
  ║   domain.md                Gate 0~5  (gate_0 자동)    ║
  ║   architecture.yaml        evidence 수집              ║
  ║   harness.yaml (해시트리)  BR-004 준수 → done 전이   ║
  ║      ▲                          ▲                     ║
  ║      └── /harness:status · check · events ──┘         ║
  ║                (CQS read-only 관찰)                   ║
  ╚═══════════════════════════════════════════════════════╝
          │
          ▼
  개발 결과물 · 출력
  커밋 · 테스트 결과 · 배포
```

자연어 기획이 하네스 안으로 들어가 중간언어 (spec.yaml) 로 바뀌고, 하네스 내부 파생·개발·관찰 사이클을 거쳐 코드 결과로 나옴. **하네스는 입력→출력 변환기 + 중간 상태 관리자.**

**3 가지 불변조건**:

1. **SSoT via tool** — `.harness/spec.yaml` 이 유일한 SSoT. 직접 편집도 가능하나, 실사용 경로는 `/harness:spec` (Mode A 추가 / B 신규 / R 정제 / E 설명) 및 `spec-conversion` 스킬로 **도구 경유**. 사용자가 YAML 구조를 외울 필요 없음.
2. **Evidence over prose** — 완료 주장 (`status: done`) 은 **Gate 통과 + evidence ≥ 1** 없이 거부됨 (BR-004 Iron Law).
3. **Hash-tracked drift** — spec 편집 / 파생 사용자 수정 / include 파일 교체 **세 가지 변경을 독립으로 구분** 해야 정확한 drift 리포트와 재현 가능한 파생이 가능. Canonical YAML → JSON → SHA-256 Merkle 트리로 YAML 포맷 변경엔 둔감, 의미 변경만 감지.

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

**로컬 전용 (`.gitignore`)**: `design/` 에 원본 설계 문서 (~3,500 줄) · RFC · 샘플 작업본 · Phase 메모리가 있습니다. 플러그인 사용에는 불필요. 기여자는 별도 요청.

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

## 하네스 엔지니어링 · 철학

LLM 을 다루는 엔지니어링 문제 중 하네스가 직접 답하는 것들. 각 항목은 **무엇** 과 **왜 필요** 한지.

### 1. 사고의 글 vs 실행의 글 — 중간언어의 필연성

자연어는 해상도가 낮음 → LLM 이 매번 재해석. 기계 구조 (YAML 스키마) 는 사람에게 부담 → 기획이 시작 안 됨. **중간언어 `spec.yaml`** 이 둘을 다리 — 기획자는 `/harness:spec` 으로 대화·변환하고, 도구와 AI 는 그 구조를 SSoT 로 일관되게 참조.

### 2. SSoT + Evidence over prose — BR-004 Iron Law

AI 가 "됐다" 라고 말해도 파일엔 흔적이 없을 수 있음. 증거가 있어야 done. 완료 주장은 Gate 실행 결과 (테스트 · 스모크) + `evidence[]` ≥ 1 없이는 `/harness:work --complete` 가 거부.

### 3. Transparency-by-Preamble + Anti-rationalization

모든 `/harness:*` 명령은 실행 직후 stdout 에 3 줄 preamble (mode · scope · next) + anti-rationalization 2 행을 출력 — **LLM 이 과정을 skip 하면서 그럴듯하게 합리화하는 경로를 막음**. 80 자 이내 고정 포맷 → 로그 스크레이핑 · 감사 가능.

### 4. Canonical Hashing · 재현 가능한 파생

자연어 → YAML → JSON 으로 내려가면서 **주석 · 키 순서 · 공백은 의미 아님**. Canonical YAML → Canonical JSON → SHA-256 Merkle 트리로 "의미가 바뀐 것" 만 해시가 바뀜. 언어 간 (Python · Node · etc.) 동일 spec 을 같은 해시로 재현 — 부록 D.7 테스트 벡터로 강제.

### 5. Edit-wins · Fail-open · CQS

세 가지 안전 규약:
- **Edit-wins**: 파생 파일 (`domain.md` · `architecture.yaml`) 을 사용자가 수정하면 재생성이 덮지 않음 — 대신 `/harness:check` 가 drift 로 리포트.
- **Hook fail-open**: `.harness/hooks/` 는 훅 실패해도 사용자 명령을 차단하지 않음 — 대신 `hook_failed` 이벤트 기록.
- **CQS (Command-Query Separation)**: `/harness:status` · `:check` · `:events` 는 파일 **읽기만**, mtime 불변 — 진단 중 의도치 않은 변이 방지.

### 6. Append-only event log

`.harness/events.log` 는 JSONL, 기존 레코드 수정·삭제 금지 (BR-013). "왜 이렇게 됐지?" 를 추적할 수 있어야 harness 의 핵심 가치 (감사성) 가 성립. 회전은 `events.log.YYYYMM` 으로 분할.

### 7. Walking Skeleton first

`features[0].type = "skeleton"`. **계획 페이퍼웨어 방지** — 첫 피처부터 Gate 5 (runtime smoke) 까지 통과해야 함. "배포 가능한 최소" 가 먼저, 확장은 그 위에.

### 8. Self-hostable

harness-boot 자신이 `docs/samples/harness-boot-self/spec.yaml` 로 표현됨. v0.2 부터 self-describe round trip (자기 스펙 → sync → 파생 검증), v0.3 부터 별도 워크스페이스에서 `/harness:work` 로 자체 개발 가능. **도구를 쓰는 엔지니어가 그 도구로 도구 자신을 만들 수 있어야 진짜 쓸 만함**.

---

## 참여

- [CHANGELOG.md](CHANGELOG.md) · [CLAUDE.md](CLAUDE.md) · [docs/schemas/spec.schema.json](docs/schemas/spec.schema.json)
- 로컬 설계 문서 · RFC · 샘플 작업본 요청: issue 혹은 [GitHub 저장소](https://github.com/qwerfunch/harness-boot) 연락.

## 라이선스

[MIT](LICENSE) · © qwerfunch
