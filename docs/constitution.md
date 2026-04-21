# harness-boot Constitution v0.2

> **지위 (Status):** Proposed — F-002 Walking 초안.  런타임 강제 (Gate 5
> `/harness:check` 위반 리포트) 는 F-011 에 wire-up 된다.  그전까지 이 문서는
> **서술적 규범** 이다.
>
> **소속:** 이 문서는 `spec.yaml` 파생물이다.  조항 문구 변경은 반드시
> `spec.yaml` 의 관련 `business_rules` 항목 편집 + ADR 1 건 기록으로만
> 성립한다 (BR-001 덮어쓰기 금지 · 아래 "Amendment Process" 참조).

---

## 0. 목적 (Purpose)

harness-boot 는 `spec.yaml` 하나를 SSoT 로 삼아 Claude Code 어댑터 계층을
파생하는 플러그인이다.  본 Constitution 은 그 파생 · 배포 · 운영 전 단계에
일관되게 적용되는 **7 개의 비협상 조항** 이다.

**9 → 7 재구성 이력.**  [spec-kit][ref-spec-kit] v0.1 의 9 조항 (저장소
내 `spec-driven.md`) 중 Article IV / V / VI (각각 CLI Interface Mandate 세부,
Observability, Versioning Discipline) 는 harness-boot 의 범위(Claude Code 위의
플러그인) 에서는 다른 조항에 흡수되거나 `spec.yaml` 구조로 대체되어 7 조항
체계로 통합되었다.  Article V(spec-kit 의 Anti-Abstraction 이었던 것) 는 C2
충돌 해소(BR-003) 를 반영하여 **"Anti-Abstraction-Scoped"** 로 의미가 명시된다.

**5 대 충돌 (C1~C5) 과의 관계.**  각 충돌은 아래 조항 중 하나 이상의 직접
대상이다 (표의 "직접 참조 BR" 열 참조).

| # | 조항 | 한 줄 규범 | 직접 참조 BR | 해소 대상 충돌 |
|---|---|---|---|---|
| I | Skill-First | 모든 기능은 독립 Skill 로 먼저 성립한다 | BR-006, BR-009 | C1 |
| II | CLI-First | 모든 기능은 CLI 동등물을 가진다 | BR-007 | C3, C4 |
| III | Test-First | 완료 주장은 실행된 테스트 증거를 동반한다 | BR-004 | — |
| IV | Simplicity | 3 층(공통·플러그인 전용·제품 코드) 외 추가는 ADR 로만 | BR-009 | C3 |
| V | **Anti-Abstraction-Scoped** | 사용자 코드에만 적용한다.  harness-boot 자체는 Adapter Layer | BR-003 | C2 |
| VI | Integration-First | Hook · Gate 는 실제 Claude Code 세션에서 검증 | BR-005, BR-008 | C5 |
| VII | Evidence-Before-Claim | 완료 선언 전 증거(로그 · 해시) 를 append-only 로 남긴다 | BR-004, BR-008 | — |

---

## Article I — Skill-First

**Statement.** harness-boot 의 모든 기능은 먼저 **독립 Skill** 로 성립한다.
즉 `skills/<skill>/SKILL.md` + `references/` 레이아웃으로 문서화 가능해야
하며, 플러그인 내부 전용 로직(파서 · 린터) 조차 SKILL 로서의 설명 가능성을
유지한다.

**Rationale.**  Anthropic 공식 Skill 규약(Progressive Disclosure, ≤ 500 라인
본문) 은 사용자가 필요한 깊이를 스스로 고르는 경로를 만든다.  Anti-Rationalization
3-섹션(Rationalization / Red Flags / Verification) 과의 지면 충돌(C1) 은
`references/rationalization.md` 분리로 해소한다(BR-006).

**BR backrefs.**
- BR-006 — SKILL.md ≤ 500 라인 + references/ 분리
- BR-009 — 플러그인 저장소는 사용자 저장소의 상위집합 (skills/** 공통 층)

**Phase 0 Gate (체크리스트).**
- [ ] 이 기능이 독립 Skill 로 기술 가능한가?  (아니면 정당화 ADR)
- [ ] `SKILL.md` 본문이 500 라인 이하인가?
- [ ] Anti-Rationalization 3-섹션이 `references/rationalization.md` 에만 존재하는가?

**Enforcement (F-011 wire-up 대상).**  `/harness:check` 가 Article I 위반을
리포트할 때 `Article-I` 라벨을 사용한다.

---

## Article II — CLI-First

**Statement.**  harness-boot 의 모든 기능은 **CLI 동등물** 을 가진다.
`/harness:<step>` 슬래시 명령은 `harness-boot <step>` 서브커맨드와 1:1
대응하며, 슬래시 명령 없이 CI · 셸 스크립트에서도 동일한 결과를 얻을 수
있다.

**Rationale.**  Canonical 6-Step(Analyze → Specify → Plan → Implement →
Verify → Evolve) 은 단일 워크플로이며(BR-007), 복수 워크플로 중첩(C4) 을
CLI 수준에서도 허용하지 않는다.  6-Step 외의 상위 집합/하위 집합 관계는
명령 계층에서도 나타나서는 안 된다.

**BR backrefs.**
- BR-007 — Canonical 6-Step 워크플로 단일화

**Phase 0 Gate.**
- [ ] 슬래시 명령과 CLI 서브커맨드가 1:1 매핑되는가?
- [ ] 동일 입력에서 동일 출력을 보장하는가 (결정적)?
- [ ] 6-Step 외의 별도 워크플로를 도입하고 있지 않은가?

**Enforcement.**  Article-II.

---

## Article III — Test-First

**Statement.**  모든 `feature.status` 의 `in_progress → done` 전이는 **실행된
테스트 · 빌드 · smoke 의 신선한 증거** 를 동반한다.  증거 없이 done 은 불가하다.
**sensitive 엔티티(Hook · Gate · EventLog) 참조 피처** 는 `test_strategy: tdd`
가 강제된다 (§5.1 검증 규칙 4 · BR-004).

**Rationale.**  Iron Law ([superpowers][ref-superpowers] OSS 인용) —
"NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE".  관측 가능한 증거
없는 "작동합니다" 는 부채다.

**BR backrefs.**
- BR-004 — Iron Law

**Phase 0 Gate.**
- [ ] `test_strategy` 가 선언되었는가?
- [ ] sensitive 엔티티 참조 시 `tdd` 인가?
- [ ] 증거 파일(테스트 로그 · 빌드 로그 · smoke 결과) 이 커밋 가능한 위치에 있는가?

**Enforcement.**  Article-III.  Gate 5 (`runtime_smoke`) 실패는 Article III
위반으로 분류된다.

---

## Article IV — Simplicity

**Statement.**  저장소는 **3 층 구조** 만 가진다 — 공통 층(`.harness/**` ·
`.claude/**` · 제품 코드) + 플러그인 전용 층(`.claude-plugin/plugin.json` ·
루트 `commands/agents/skills/hooks/`) + (선택) 사용자 전용 덮어쓰기.
새 층 · 새 최상위 디렉토리 추가는 ADR 1 건을 요구한다.

**Rationale.**  spec-kit Article VII "Simplicity(3-프로젝트)" 와
[harness][ref-harness] 6-phase · 4-stage 복잡도의 충돌(C3) 을 "계층은 3 층,
단계는 6-Step" 으로 해소한다.  플러그인 ⊃ 사용자 거울(BR-009) 도 같은 단순성의
표현이다.

**BR backrefs.**
- BR-009 — 플러그인 저장소 ⊃ 사용자 저장소 구조 거울

**Phase 0 Gate.**
- [ ] 새 파일은 세 층 중 어디에 속하는가 (분명히)?
- [ ] 최상위 디렉토리 추가가 있다면 ADR 이 존재하는가?
- [ ] `.harness/` 깊이가 3 단을 넘지 않는가?

**Enforcement.**  Article-IV.

---

## Article V — Anti-Abstraction-Scoped

**Statement.**  Anti-Abstraction 원칙 (프레임워크 · SDK 를 직접 사용, 독자
래퍼 금지) 은 **사용자 코드에만 적용** 된다.  harness-boot 자체는 Claude Code
위의 **Adapter Layer** 이며, 이 계층에서는 추상화가 명시적으로 허용된다.
단 어댑터가 **부가 책임** (로그 포맷팅 · 캐싱 · 정책 해석 등 원 책임 외) 을
짊어져 비대해지는 것은 여전히 금지된다 (single responsibility).

**Rationale.**  v2.3.x 까지의 자기모순(C2) 해소.  spec-kit Article VIII 를
문자 그대로 적용하면 harness-boot 의 존재 자체가 위반이 된다 — 이는 원칙이
아니라 버그다.  "Scoped" 라는 수식어로 적용 범위를 명시하여 두 집단(사용자
제품 코드 · harness-boot 어댑터 코드) 각각이 맞는 원칙을 따르게 한다.

**BR backrefs.**
- BR-003 — Anti-Abstraction 원칙은 사용자 코드에만 적용

**Phase 0 Gate.**
- [ ] 이 변경이 **사용자 코드** 인가, **어댑터 코드** 인가? (명시)
- [ ] 사용자 코드라면 프레임워크 · SDK 를 직접 사용하는가?
- [ ] 어댑터 코드라면 원 책임(Claude Code ↔ spec.yaml 교량) 외 책임을 떠안지 않았는가?

**Enforcement.**  Article-V.  린터는 `src/` (어댑터) 와 `fixtures/user-repo/` (사용자 코드)
를 구분하여 다른 규칙을 적용한다.

---

## Article VI — Integration-First

**Statement.**  Hook · Gate · EventLog 같은 **sensitive 엔티티** 는 실제
Claude Code 세션(또는 그에 준하는 subprocess 근사치) 에서의 통합 검증을
먼저 통과한다.  단위 테스트만으로는 합격할 수 없다.

**Rationale.**  공식 `hooks/hooks.json` 스키마 준수(BR-005) 와 append-only
이벤트 로그(BR-008) 는 Claude Code 런타임이 실제로 기대하는 계약이다.
mock 으로는 이 계약을 지켰는지 확인할 수 없다.

**BR backrefs.**
- BR-005 — 공식 hooks.json 네이티브 + meta.json 확장 분리
- BR-008 — append-only 이벤트 로그 · 90 일 보존

**Phase 0 Gate.**
- [ ] 대상이 sensitive 엔티티를 수정하는가?
- [ ] 실제 Claude Code 세션(또는 subprocess) 에서 돌아가는 통합 테스트가 있는가?
- [ ] `hooks.json` 변경 시 공식 스키마 검증이 통과하는가?

**Enforcement.**  Article-VI.  Gate 5 `runtime_smoke` 에서 sensitive 엔티티
관련 스모크가 없으면 Article VI 위반으로 리포트된다.

---

## Article VII — Evidence-Before-Claim

**Statement.**  모든 상태 변경 — `feature.status` 전이, Gate 통과, Hook
실행, Artifact 생성/이동 — 은 선언 **이전** 에 `.harness/events.log` 에
append 된다.  사실 선언의 증거는 로그 엔트리의 sha256 체인 해시로 변조를
감지한다.

**Rationale.**  BR-004 (Iron Law) 의 구조적 실행.  "증거를 만든 다음 선언" 이
아니라 "선언하면 로그가 자동으로 남는다" 가 아닌 — "로그가 먼저, 선언이
나중" 이다.  이 순서는 우회 경로를 만들기 어렵게 한다.

**BR backrefs.**
- BR-004 — Iron Law (증거 동반)
- BR-008 — append-only 이벤트 로그

**Phase 0 Gate.**
- [ ] 상태 변경 API 는 append-first 경로만 제공하는가?
- [ ] 체인 해시 검증 실패 시 downstream 이 어떻게 반응하는가?
- [ ] 90 일 로테이션 경계에서도 불변식이 유지되는가?

**Enforcement.**  Article-VII.  EventLog append 없이 상태 전이를 시도하면
Article VII 위반으로 차단 (F-013 구현 후 하드 게이트).

---

## Amendment Process

1. **발의.**  조항 문구 · 추가 · 폐기는 먼저 `spec.yaml` 의 해당
   `business_rules` 항목 편집으로 발의한다.  Constitution 자체는 `spec.yaml`
   파생이므로 문서만 고치는 것은 BR-001 위반이다.
2. **ADR.**  `docs/adr/YYYY-MM-DD-constitution-<slug>.md` 에 Nygard 4-섹션
   (Status / Context / Decision / Consequences) 으로 기록한다.  기존 조항을
   대체할 경우 `Superseded_by:` 링크 필수.
3. **승인.**  maintainer 2 인 리뷰 + `main` 브랜치 PR 로만 머지.
   `develop` 직접 커밋 금지.
4. **버전.**  조항 추가/삭제는 `project.version` 의 MINOR 이상 bump 를
   요구한다 (SemVer).

---

## Deferred Integration Points (F-002 → F-011)

- **런타임 강제.**  본 문서의 각 Article 에 표기된 `Article-<N>` 라벨은
  F-011 (`/harness:check`) 의 위반 리포트 포맷에서 그대로 사용된다.
  F-011 구현 시점에 이 문서가 "체크 키 → Article 매핑" 의 SSoT 역할을 한다.
- **스냅샷 테스트.**  F-002 의 `test_strategy: state-verification` 는 본
  문서의 렌더링 결과 + Article 리스트의 위반 탐지 출력을 골든 파일로 비교한다.
  골든 파일은 F-006 (spec.yaml Schema v0.2) 와 함께 `tests/golden/constitution/`
  에 추가된다.

---

## 참고

**내부 문서.**

- `spec.yaml` — SSoT (`domain.business_rules[BR-001..010]` · `metadata.external_references`)
- `CLAUDE.md` — 세션 에티켓 · "항상 기억해야 할 7 가지"

**외부 OSS 레퍼런스.**  정식 목록 · 역할 · 라이선스는 `spec.yaml`
`metadata.external_references` 참조.  본문에서 인용된 것만 여기에 요약한다.

- [spec-kit][ref-spec-kit] (MIT) — GitHub 공식 SDD.  9 조항 Constitution 의 원형 (본 문서의 "9 → 7 재구성" 기준점).
- [superpowers][ref-superpowers] (MIT) — Iron Law 의 출처 (Article II).
- [harness][ref-harness] (Apache-2.0) — Phase 0~6 워크플로.  C3/C4 충돌의 한 축.

[ref-spec-kit]: https://github.com/github/spec-kit
[ref-superpowers]: https://github.com/obra/superpowers
[ref-harness]: https://github.com/revfactory/harness
