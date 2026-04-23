# harness-boot

> **Plan.md 하나로 출발해 Claude Code 에이전트·스킬·훅·프로토콜을 파생·생성·진화시키는 harness 플러그인.**
> 사용자는 `.harness/spec.yaml` 만 편집하고, 나머지는 도구가 파생합니다.

[![version](https://img.shields.io/badge/plugin-v0.1.0-blue)](.claude-plugin/plugin.json)
[![spec](https://img.shields.io/badge/spec-v2.3.8-green)](docs/schemas/spec.schema.json)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

---

## 30초 요약

Plan.md → `.harness/spec.yaml` (v2.3.8) → Walking Skeleton → 기능 반복.

- **편집 대상은 1개**: `.harness/spec.yaml`. 제품 설명·엔티티·비즈니스 룰·기능·배포 계약을 모두 여기에.
- **파생은 자동**: `domain.md` · `architecture.yaml` · `.claude/agents/**` · `.claude/skills/**` · hooks.
- **증거 기반**: 기능마다 `acceptance_criteria` + 커버리지 Gate. Claude 가 조작할 수 없는 수치 증거를 요구.
- **드리프트 추적**: Merkle 해시 트리로 spec 변경·파생 수정·외부 include 를 각각 구분 검출.

## 설치

```bash
# 마켓플레이스 등록 (최초 1회)
claude plugin marketplace add qwerfunch/harness-boot

# 플러그인 설치
claude plugin install harness-boot
```

> **주의 (v0.1.0 범위)**: 현재 릴리즈는 `/harness:init` + 스킬 `spec-conversion` 만 포함합니다. `/harness:sync` · `/harness:work` · `/harness:status` · `/harness:check` 는 v0.2+ 에서 활성화됩니다.

## 첫 명령

프로젝트 루트에서:

```text
/harness:init
```

생성 결과:

```
.harness/
  spec.yaml          ← 당신이 편집하는 유일한 파일
  harness.yaml       ← 도구 관리 (해시 트리)
  state.yaml         ← 진행 상태
  events.log         ← 이벤트 스트림 (JSON Lines)
CLAUDE.md            ← Claude 세션 컨텍스트 (spec.yaml import)
.gitignore           ← 병합됨
```

옵션:
- `--team` — `state.yaml` 을 `.gitignore` 에 추가 (팀 모드, 개인 머신에만 보관).
- `--solo` / 생략 — 커밋 대상으로 유지.

## 다음 명령 (v0.2+ 예정)

| 명령 | 역할 |
|------|------|
| `/harness:spec` | 제품 설명 편집 (대화형 · Mode A / Mode B 자동 분기) |
| `/harness:sync` | spec 변경 후 도메인·아키텍처·어댑터 파생 |
| `/harness:work` | Walking Skeleton → 기능 구현 사이클 |
| `/harness:status` | 현재 진행 상태 확인 |
| `/harness:check` | 일관성·드리프트 검증 |

## 레포 구조

```
harness-boot/
├── .claude-plugin/plugin.json       # Claude Code 플러그인 매니페스트
├── commands/                        # 슬래시 명령 (v0.1: init 만)
├── skills/
│   └── spec-conversion/SKILL.md     # plan.md → spec.yaml 변환 스킬 v0.5
├── agents/                          # (v0.2+)
├── hooks/                           # (v0.2+)
├── docs/
│   ├── schemas/spec.schema.json     # spec.yaml JSONSchema (draft 2020-12)
│   ├── templates/starter/           # /harness:init 이 복사하는 템플릿 4종
│   └── setup/local-install.md       # 로컬 설치 스모크 시나리오
├── scripts/
│   ├── mode_b_extract.py            # plan.md → 축별 BM25 추출 (Mode B Phase 1)
│   ├── mode_b_axes.py               # 12 축 질의 어휘
│   ├── mode_b_stopwords.py          # EN/KR 불용어 + 조사
│   └── mode_b_roundtrip.py          # 6 샘플 회귀 러너
└── tests/
    └── regression/conversion-goldens/  # 8 golden 샘플 (url-shortener · retro-jumper · price-crawler · vapt-apk-sast · tzcalc · vite-bundle-budget · vscode-commit-craft · harness-boot-self) + MANIFEST.yaml
```

> **설계 문서는 로컬 전용**: 주 설계 문서(`design/harness-boot-design-2.3.7.md`, ~3,200줄) · Mode B 리포트 · RFC 문서는 `design/` 디렉터리에 보관되며 .gitignore 로 공개 레포에서 제외됩니다. 플러그인 사용에는 필요 없고, 기여자는 별도 요청하세요.

## 설계 철학

세 가지 축이 균형을 이룹니다.

1. **Single source of truth**: `spec.yaml` 이 유일한 사용자 편집 대상. 파생물은 edit-wins 추적으로 사용자 수정을 보호.
2. **Evidence over prose**: "됐다" 는 주장보다 커버리지·테스트·스모크 시나리오로 증명.
3. **Walking Skeleton first**: `features[0]` 은 항상 `type: skeleton`. 첫 기능부터 종단간 배포 가능 상태 유지.

자세한 근거는 주 설계 문서 (로컬 전용) 참조.

## Plan.md 가 이미 있다면

`spec-conversion` 스킬이 plan.md → spec.yaml 변환을 자동화합니다. 8 샘플로 회귀 검증된 4-stage 파이프라인 (정찰 → 저작 → gap 카탈로그 → backlink 매트릭스):

- [skills/spec-conversion/SKILL.md](skills/spec-conversion/SKILL.md) — v0.5, 24 원칙 · 5 도메인 어댑터
- [tests/regression/conversion-goldens/](tests/regression/conversion-goldens/) — 8 완성 샘플 + `MANIFEST.yaml` (plan.md → spec.yaml)
- Mode B 통계 추출 (BM25 기반, recall 0.991 / precision 0.861) — `scripts/mode_b_*.py`

## 상태

**v0.1.0 (현재)** — 플러그인 뼈대 + `/harness:init` 최소판 + `spec-conversion` 스킬.

**v0.2.0 (예정)** — `/harness:sync`, `scripts/hash-fixtures.mjs`, `.claude/agents/**` · `.claude/skills/**` 자동 생성, 6 핵심 훅 (security-gate · doc-sync-check · coverage-gate · format · test-runner · session-start-bootstrap).

**v0.3.0+ (구상)** — `/harness:work` 구현 사이클, `/harness:check` 드리프트 감지, spec v2.4.0 스키마 확장.

## 라이선스

[MIT](LICENSE) · © qwerfunch
