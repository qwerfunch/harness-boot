# agents/ — harness sub-agents (v0.4+)

harness-boot 플러그인이 Claude Code 에 shipping 하는 **3 core sub-agents**. 각 에이전트는 권한 매트릭스를 `frontmatter.tools` 로 선언하고 Claude Code 가 **런타임 enforce**.

## 위치 규약

Claude Code 2.1.x 규약: `agents/<name>.md` at plugin root (not `.claude-plugin/agents/`). 자동 discovery.

## 호출 방법 (사용자 측)

- **@-mention**: `@harness:orchestrator` · `@harness:software-engineer` · `@harness:reviewer`
- **CLI session-wide**: `claude --agent harness:software-engineer`
- **자동 delegation**: Claude 가 description 기반 판단

## 권한 매트릭스 (F-012 AC)

| Agent | tools (allow-list) | 사용 시점 | 금지 |
|---|---|---|---|
| **orchestrator** | 전부 (무제한) | 다단계 작업 조율 · 다른 에이전트에게 delegate | — |
| **software-engineer** | Read · Write · Edit · Bash · Grep · Glob · NotebookEdit | 스펙 → 코드 → 테스트 · BR-004 사이클 (스택 중립 일반 구현) | Git push · 공유 시스템 수정 · 마켓 PR |
| **reviewer** | Read · Grep · Glob · Bash (읽기 전용) | PR/코드 리뷰 · drift 진단 · evidence 검증 | Edit · Write · 모든 mutation |
| **researcher** *(v0.5)* | Read · Write · Grep · Glob · Bash · WebFetch · WebSearch | Discovery — 한 줄 아이디어 → brief.md | 결정 행위 · 다른 에이전트 호출 · Edit |
| **product-planner** *(v0.5)* | Read · Write · Grep · Glob · Bash | Discovery — brief.md → plan.md (Mode B-2 feed) | 탐색 (researcher 영역) · WebFetch · Edit |
| **ux-architect** *(v0.5)* | Read · Write · Grep · Glob · Bash | Stage X — flows.md · IA · 상태 다이어그램 | 색/타이포 (visual-designer) · 코드 생성 |
| **visual-designer** *(v0.5)* | Read · Write · Grep · Glob · Bash | Stage X — tokens.yaml + components.yaml | flow 변경 · 코드 생성 · design 산출 수정 |
| **audio-designer** *(v0.5)* | Read · Write · Grep · Glob · Bash | Stage X — audio.yaml (has_audio 피처만) | BGM 제작 · .wav 바이너리 생성 |
| **a11y-auditor** *(v0.5)* | Read · Write · Grep · Glob · Bash (read-only) | Stage X — a11y/report.md (read-only 감사) | 모든 파일 수정 · 독단 BLOCK |
| **frontend-engineer** *(v0.5)* | Read · Write · Edit · Grep · Glob · Bash | Stage E — UI 구현 (design 산출 소비) | design 산출 수정 · 토큰 밖 값 하드코딩 |
| **backend-engineer** *(v0.5)* | Read · Write · Edit · Grep · Glob · Bash | Stage E — API · DB · service · 도메인 로직 | UI 수정 · destructive migration 독단 |
| **security-engineer** *(v0.5)* | Read · Write · Edit · Grep · Glob · Bash | Stage E — threat model · authn/z · secrets (sensitive 피처 필수) | prod secret 접근 · UI 작성 · 독단 BLOCK |
| **performance-engineer** *(v0.5)* | Read · Write · Edit · Grep · Glob · Bash | Stage E — profiling · 예산 (performance_budget 피처) | 대규모 리팩터 · 유리한 벤치 환경 선택 |
| **qa-engineer** *(v0.5)* | Read · Write · Grep · Glob · Bash | Stage Q — test strategy · risk matrix | 테스트 코드 작성 · spec 수정 |
| **integrator** *(v0.5)* | Read · Write · Edit · Grep · Glob · Bash | Stage I — DI · config · entry point · CI wire-up | module 내부 로직 재작성 · design 산출 수정 |
| **tech-writer** *(v0.5)* | Read · Write · Edit · Grep · Glob · Bash | Stage I — docs · CHANGELOG · README (Diátaxis) | 코드/스펙 수정 · 스크린샷 수동 편집 |

Claude Code 가 `tools` 밖 호출 **자동 차단**. 런타임 enforcement.

## 디자인 원칙

1. **최소 권한** — 각 에이전트는 담당 범위를 벗어나는 tool 미허용
2. **BR-004 Iron Law 적용** — software-engineer 는 gate_5 + evidence 없이 done 못 함
3. **Preamble + Anti-rationalization** (BR-014) — 출력 맨 앞 3 줄 규약 유지
4. **CQS (BR-012)** — reviewer 는 read-only · 진단만

## 기여자 확장 가이드

새 에이전트 추가 시:

1. `agents/<new-name>.md` 생성 (frontmatter 필수: `name`, `description`, `tools`)
2. 이 README 의 권한 매트릭스 표에 한 줄 추가
3. 테스트: `tests/unit/test_agents.py` 에 frontmatter 검증 추가
4. 커밋

## 참조

- Claude Code 공식 규약: `https://code.claude.com/docs/en/sub-agents.md`
- F-012 AC (spec.yaml): 각 에이전트 tools 선언 일치 · 권한 외 차단
- F-023 AC (인프라): agents/ tracked · `@harness:<agent>` 노출 확인
