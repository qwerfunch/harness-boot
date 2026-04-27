# BRAND_TERMS — harness-boot glossary

Single reference for jargon that shows up across `commands/`, `agents/`, and
runtime output. The English masters use these terms as-is and link here once;
they don't re-explain on every page. If you add a new term, update this file
*and* the runtime catalog in `scripts/ui/messages.py` when applicable.

| Term | EN gloss | KO gloss | Where it lives |
|---|---|---|---|
| **Walking Skeleton** | Smallest end-to-end slice that proves the whole pipeline is wired together. | 시스템이 끝-끝으로 연결됐음을 증명하는 가장 작은 골격. | BR-003, `commands/init.md`, `commands/work.md` |
| **Iron Law D** | "No `done` without Walking Skeleton + N declared evidence + `gate_5=pass`." | "기본 골격 + 근거 N 개 + 검증 5단계 통과 없이 완료 불가." | BR-004, `scripts/work.py` (complete guard) |
| **BR-001 … BR-014** | Business-rule IDs. The fourteen non-negotiables. | 14 개 비즈니스 규칙 ID. | `.harness/spec.yaml` `domain.business_rules[]` |
| **F-NNN** | Feature ID — `F-` followed by zero-padded digits. | 피처 ID. | `spec.yaml` `features[].id` |
| **AC-N** | Acceptance Criterion — one numbered, testable bullet under a feature. | 인수기준. | `spec.yaml` `features[].acceptance_criteria[]` |
| **gate_0 … gate_5** | Six staged checks: lint → unit → integration → coverage → clean tree → smoke. | 6 단계 검증 — 린트/단위/통합/커버리지/클린 트리/동작 확인. | `scripts/gate/runner.py` |
| **drift** | Spec ↔ code/doc/state divergence. Eight kinds, all auto-detected. | 스펙과 코드·문서·상태의 어긋남 (8 종 자동 검출). | `scripts/check.py` |
| **sigil region** | `<!-- harness:user-edit-begin -->` … `<!-- harness:user-edit-end -->` block preserved across regen. | 자동 재생성 시에도 보존되는 사용자 편집 보호 영역. | `scripts/scan/chapter_writer.py` |
| **fog-clear** | Per-feature reconnaissance (F-037). Fills `.harness/chapters/area-*.md` on each `activate`. | 피처마다 영역 정찰 — 지도의 어둠을 걷어냄. | F-037, `scripts/scan/` |
| **Preamble** | The 3-line header every command emits. Anti-rationalization (BR-014). | 모든 명령이 출력 맨 앞에 박는 3줄 안내. | `commands/*.md`, `agents/*.md` |
| **NO skip / NO shortcut** | Lines 2–3 of the Preamble. Fail-loud guards against quietly bypassing the pipeline. | 사이클 단계 생략·우회 금지를 명시하는 두 줄. | `commands/*.md`, `scripts/self_check.sh` step 5 |
| **autowire** | Implicit ceremony fired by `work.py activate` (kickoff / fog-clear / design-review). | activate 시점에 자동 발화하는 부수 작업. | `scripts/work.py` |
| **kickoff** | Per-feature ceremony that names participating agents and their concerns. | 피처별 시작 회의 — 참여 에이전트와 우려사항. | `scripts/ceremonies/kickoff.py` |
| **retro** | Per-feature retrospective written after `--complete`. | 피처 완료 후 회고. | `scripts/ceremonies/retro.py` |
| **routed agents** | Agents the orchestrator will engage for this feature (F-038). | 이번 피처에 참여할 팀. | F-038, `WorkResult.routed_agents` |
| **parallel groups** | Agent pairs the orchestrator may dispatch in one message (F-039), e.g. `(security ∥ reviewer)`. | 한 메시지에서 동시 호출 가능한 에이전트 묶음. | F-039, `kickoff.PARALLEL_GROUPS` |
| **shape** | Feature classification driving the agent chain (UI / sensitive / pure-domain / etc). | 피처 유형 — 어떤 에이전트 체인이 호출될지 결정. | `kickoff.detect_shapes()` |
| **mode (prototype / product)** | Ceremony-weight switch — `prototype` lighter, `product` strict. | 디시플린 강도 — prototype 가벼움, product 엄격. | `spec.project.mode` |
| **CQS** | Command-Query Separation — read-only commands never mutate state. | 명령과 질의 분리 — 진단 명령은 상태를 바꾸지 않음. | BR-012 |
| **DDD** | Domain-Driven Design (Evans). | 도메인 주도 설계. | `agents/backend-engineer.md`, spec `domain.entities[]` |
| **JTBD** | Jobs-To-Be-Done (Christensen). | 고객이 해결하려는 일 — 기능이 아닌 결과 중심. | `agents/product-planner.md` |
| **Mom Test** | Discovery interview method (Fitzpatrick) — facts, not opinions. | 사실만 묻는 인터뷰 방법론. | `agents/researcher.md` |
| **STRIDE** | Microsoft threat-model taxonomy (Spoofing/Tampering/Repudiation/Info-disclosure/DoS/Elevation). | 6 종 위협 분류. | `agents/security-engineer.md` |
| **OWASP ASVS** | Application Security Verification Standard. | 애플리케이션 보안 검증 표준. | `agents/security-engineer.md` |
| **WCAG 2.2** | Web Content Accessibility Guidelines, version 2.2. | 웹 접근성 지침 2.2. | `agents/a11y-auditor.md` |
| **OAuth 2.1** / **FIDO2** | Auth standards. | 인증 표준. | `agents/security-engineer.md` |
