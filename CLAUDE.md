# harness-boot — Claude Code 플러그인 (v0.2.0 재작성 중)

이 파일은 세션 간 연속성을 보장하는 **영구 맥락** 입니다.  상세 계약은
루트 `spec.yaml` 에 있으며, 이 문서는 매 세션 첫 눈에 잡아야 할 요점만 담습니다.

---

## 빠른 상태

| 항목 | 값 |
|---|---|
| 단일 진실의 원천 (SSoT) | **`spec.yaml`** (루트, 1181 줄, 18 피처) |
| 프로젝트 버전 | `0.2.0` |
| 스키마 버전 | `2.3.6` (설계 문서 §5.1 준수) |
| 이전 버전 | `legacy/` 아카이브 (v0.1.0, 재작성 대상 아님) |
| 개발 언어 | **한국어 1 차** (BR-010), 커밋 · PR 만 영어 |
| 현재 단계 | **Stage 0 부트스트랩** — F-001 자산 미작성 |
| 주 브랜치 | `develop` (feature 브랜치 → develop 으로 머지) |

---

## 항상 기억해야 할 7 가지

1. **`spec.yaml` 이 유일한 편집 지점** — 나머지 `.harness/**` · `.claude/**` 는 파생 (BR-001 덮어쓰기 금지, BR-002 edit-wins).
2. **플러그인 저장소 ⊃ 사용자 저장소** (BR-009) — 공통 층(`.harness/**` · `.claude/**` · 제품 코드) + 플러그인 전용 층(`.claude-plugin/plugin.json` · 루트 `commands/agents/skills/hooks/`).
3. **Canonical 6-Step** (BR-007): Analyze → Specify → Plan → Implement → Verify → Evolve.  각 스텝은 `/harness:<step>` 슬래시 명령 1 개와 1:1 대응.
4. **Hook 은 공식 필드 + 확장 sidecar** (BR-005): `hooks/hooks.json` (공식) + `.harness/hooks/meta.json` (id · description · env 확장).
5. **SKILL.md ≤ 500 라인 + `references/` 분리** (BR-006).  Anti-Rationalization 3-섹션은 `references/rationalization.md` 에만.
6. **Iron Law** (BR-004) — "NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE".  Gate 5 증거 없이 `status: done` 전이 금지.
7. **append-only 이벤트 로그** (BR-008) — 모든 상태 변경 기록, 90 일 보존, sha256 체인 해시로 변조 감지.

---

## 아키텍처 결정 (spec.yaml 에 박힘)

| 항목 | 값 | 근거 |
|---|---|---|
| 패턴 | `layered` | 플러그인 프로젝트에서 hexagonal 은 과투자 — I/O 경계가 fs + CC 호스트 두 개뿐 |
| 스택 | TypeScript 5 · Node 20 ESM · Vitest 2 + fast-check | 설계 §4 |
| 플러그인 name | `harness` | `.claude-plugin/plugin.json.name` — 슬래시 명령 네임스페이스 |
| 저장소/npm name | `harness-boot` | `package.json.name` — CC `name` 필드와 분리 허용 |
| 아키텍처 계층 | core · plugin-api · steps · adapters · plugins-builtin | `src/` 하위 |

### 저장소 레이아웃 (계획)

```
harness-boot/
├── .claude-plugin/plugin.json           # ① 플러그인 매니페스트 (필수)
├── commands/                            # ① 배포: /harness:* 6 스텝
├── agents/                              # ① 배포: 서브에이전트
├── skills/                              # ① 배포: SKILL.md + references/
├── hooks/hooks.json                     # ① 배포: 공식 필드만
├── .harness/                            # ② 사용자 층 (도그푸드)
│   ├── harness.yaml · state.yaml · events.log
│   └── hooks/meta.json                  # 확장 3 필드
├── .claude/                             # ② 사용자 층 (도그푸드)
│   ├── agents/                          # Stage 0: 손수 쓴 3 개
│   └── commands/next-feature.md         # Stage 0: 피처 pick 명령
├── spec.yaml                            # ③ 제품 코드 층 — SSoT
├── package.json · schemas/ · bin/       # ③
└── src/                                 # ③ core · plugin-api · steps · adapters · plugins
```

① 플러그인 제공자 전용 · ② 모든 CC 프로젝트 공통 · ③ 제품 코드.

---

## Stage 0 부트스트랩 규약 — "다음 피처 pick"

**Claude 는 매 세션 `spec.yaml` 을 읽고 다음 순서로 작업 피처를 선택한다**:

1. `features[].status == "planned"` 인 피처 중
2. `depends_on` 이 모두 `status == "done"` 인 것 중
3. 최저 `priority` (동률이면 F-NNN ID 오름차순)

선택된 피처의 `acceptance_criteria` · `tdd_focus` · `modules` 가 구현 지시서 역할을 한다.  구현 시작 전 사용자 승인을 받고 `status` 를 `in_progress` 로 바꾼다.

**현재 선택 결과**: `F-001` (Walking Skeleton — Bootstrap Stage 0 + 최소 CLI 기동, priority=1).

---

## 다음 작업 — F-001 착수 자산

`spec.yaml` F-001 의 acceptance_criteria 에 따라 7 개 자산 작성:

1. `.claude-plugin/plugin.json` — CC 공식 매니페스트 (`name: "harness"`, `version: "0.2.0"`)
2. `package.json` — `name: "harness-boot"`, `bin`, TS 5 · Node 20 · Vitest 2 의존
3. `bin/harness-boot` — CLI 엔트리 (`version` 서브커맨드만 먼저, 나머지는 F-007 이후)
4. `.claude/agents/orchestrator.md` — Stage 0 수동 에이전트
5. `.claude/agents/implementer.md` — 동
6. `.claude/agents/reviewer.md` — 동
7. `.claude/commands/next-feature.md` — 위 "다음 피처 pick" 규약의 슬래시 명령화

F-001 완료 조건 = SS-001 + SS-005 smoke 통과 (`spec.yaml` 참조).

---

## 언어 정책 (BR-010)

- **현재 단계** — 스펙 · 문서 · 코드 주석 · 에러 메시지 전부 한국어로 먼저 작성
- **전환 시점** — 품질 안정 후 F-018 (`harness-boot i18n:migrate`) 로 일괄 전환.  원본은 `**/*.ko.md` 로 보존 (BR-001)
- **예외** — git 커밋 메시지 · PR 제목/본문은 항상 영어 (OSS 표준 · 검색 가능성)

---

## 주요 참조 문서

- `spec.yaml` — SSoT.  항상 이 파일을 1 차로 참조
- `design/harness-boot-design-2.3.6.md` — 상세 설계 (gitignored, 개인 워크스페이스)
- `design/spec-template.yaml` — 도그푸드 템플릿 (gitignored)
- `design/oss-refs-analysis.md` — 5 대 충돌 도출 근거 (gitignored)
- `legacy/` — v0.1.0 아카이브 (읽기만, 수정 금지)

---

## 세션 에티켓

- **해소되지 않은 가정이 생기면 한 번에 한 질문만** 묻고 번호 선택지 제시 (사용자 선호 규약)
- **덮어쓰기 금지** (BR-001) — 파생물 수정은 항상 patch/PR 경로
- **본 `spec.yaml` 도 같은 규범의 대상** — 스펙 구조적 변경은 사용자 승인 + ADR 기록 필수
- **완료 주장에는 증거 필요** (BR-004) — `state.yaml` 에 Gate 증거 없이 done 전이 금지
- **한 번에 한 피처** 에 집중 — 병렬 진행은 depends_on 독립 확인 후

---

_마지막 갱신: 2026-04-21 · spec.yaml v0.2.0 1 차 저작 시점_
