# Adapter: meta (cli-plugin / dev-tool / self-hosting harness)

**출처 샘플**: `design/samples/harness-boot-self` (skill v0.3 · Phase 2.8 · 6회차) + `design/samples/vite-bundle-budget` (skill v0.4 · Phase 2.9 · 7회차) + `design/samples/vscode-commit-craft` (skill v0.4 · Phase 2.9 · 8회차)
**버전**: 0.2 (3 샘플 기반 — self(자기참조) + vite-bb + vscode-cc(비자기참조 host-plugin ×2) 교차 검증)

---

## 0. 버전 히스토리

| 버전 | 변경 | 날짜 |
|------|------|------|
| 0.0 | harness-boot self-bootstrap 변환으로 draft 생성. NEW-28~34 7개 공식화. 단일 샘플 기반이라 meta 전반 가설 일부는 검증 미완료 | 2026-04-22 |
| 0.1 | vite-plugin-bundle-budget 변환(비자기참조)으로 교차 검증. 주요 변경: (a) 자기 설정 ambient 파일을 강한 신호로 격상, (b) NEW-29 를 "agent 수 N≥2" 조건부 필수로 수정, (c) F-9(Config 엔티티 분리) 가설을 관찰된 함정으로 격상, (d) P-22(self-consistency)를 self_reference=true 조건부로 명시, (e) §4.7 host_binding 매핑 힌트 추가, (f) NEW-35 host_binding[] 추가 공식화, (g) OQ-5 체크 완료. F-8/F-10 은 미검증 유지 | 2026-04-22 |
| 0.2 | vscode-commit-craft 변환(host-plugin 2번째)으로 F-8 가설 PARTIAL HIT 확증. 주요 변경: (a) NEW-36 contribution_points[] 신규 공식화 (에디터 확장 한정), (b) §3.2 host-plugin 엔티티 템플릿 "8 ±2~3 변동 허용" 유연성 명시, (c) §4.8 contribution_points 매핑 힌트 신설, (d) §5.1 F-1 을 3/3 meta 불변 함정으로 격상, (e) §5.2 F-8 을 §5.1 PARTIAL HIT 관찰된 함정으로 격상, (f) §6 체크리스트 "에디터 확장 7종 contribution" 추가, (g) §7 OQ-2 체크 완료 + OQ-8 신설, (h) host-plugin 2샘플 BR/F=1.0 수렴 관찰 (self-bootstrap 0.67 대비 판별 지표). F-10 미검증 유지 | 2026-04-22 |

---

## 1. 도메인 시그널

- **강한 신호**
  - "플러그인", "extension", "CLI", "slash command", "sub-command"
  - 제품 표면이 "명령 N개" 로 구성 (`/prefix:xxx` 또는 `tool xxx`)
  - 자기 설정을 **사용자 레포의 ambient 디렉터리·파일** 에 둠 (`.harness/`, `.myconfig/`, `.tool/`, `xxx.config.ts`) — **v0.1 격상: 2/2 샘플에서 재현**
  - "SSoT" + "파생 파일" 이원화 패턴 + edit-wins / overwrite-per-run 정책
  - Walking Skeleton / 품질 관문 / preamble 출력 같은 메타 철학 용어
  - **숙주 도구 식별자** 가 등장 ("Vite 5+", "ESLint 9+", "Claude Code", "VSCode 1.80+") — v0.1 신규
- **중간 신호**
  - "sub-agent", "multi-agent", Tool 권한 매트릭스
  - "drift", "진화", "재생성" 같은 파생 생명주기 어휘
  - `shim`, `adapter`, `integrator`, `hook` 같은 바운더리 용어
  - Canonical hashing, Merkle tree, reproducible build
  - `zod` / `io-ts` 류 런타임 스키마 검증기 (config 파일 유효성) — v0.1 신규
- **약한 신호**
  - 템플릿 디렉터리 + 사용자 프로젝트에 복사·참조 모델
  - 변경 이력(changelog) 이 본문에 inline 으로 긴 서술

> **domain_adapter 판정 기준**: 강한 신호 2개 이상 + 제품 표면이 "명령 지도" 또는 "플러그인 계약" 이면 meta 로 확정.
> library 와 헷갈릴 수 있으나 **library = import 되는 것**, **meta = 다른 도구를 확장하거나 자기 설정을 사용자 레포에 두는 것**.

---

## 2. 우선 체크 갭

| 순위 | 갭 ID | 의미 | 설명 |
|------|-------|------|------|
| 1 | **NEW-28 command_map[]** | 명령어를 1급 시민으로 | 명령 간 관계·CQS·mode·부작용 8축을 담는 블록. meta 도메인 최우선 |
| 2 | **NEW-33 ambient_files[]** | 사용자 레포의 생성물 계약 | SSoT/파생/edit-wins/append-only 4 authorship 명시 |
| 3 | **NEW-30 gate_chain[]** | 0~N 품질 관문 모델 | Gate 0~5 같은 순차 관문과 실패 action (self + vite-bb 모두 재현 — 후자는 ok/warn/fail 3티어) |
| 4 | **NEW-29 agent_permissions[]** | 에이전트 × 도구 권한 매트릭스 | **조건부 필수 (v0.1): agent 수 N≥2 인 경우만 MUST, 단일 에이전트 플러그인(vite-bb 등)은 비해당** |
| 5 | **NEW-34 preamble_contract** | 투명성 출력 계약 | stdout 고정 포맷이 있으면 |
| 6 | **NEW-32 versioning_axes[]** | 복합 semver 추적 | plugin/spec/protocol/agent 다축 |
| 7 | **NEW-31 drift_catalog[]** | 불일치 분류 체계 | SSoT + 파생 모델이면 |
| 8 | G-10 open_questions | 메타 도구는 미결 11+개 가 흔함 | §13 급 내용 |
| 9 | G-08 milestones | architecture 성숙도면 changelog-metadata 변형 |
| 10 | G-13 non_goals | architecture 문서일수록 암묵 처리 → 명시 유도 필요 |
| 11 | **NEW-35 host_binding[]** | 숙주 도구 바인딩 (v0.1 신설, v0.2 2/2 host-plugin 확증) | 플러그인이 숙주(Vite/ESLint/VSCode 등)에 바인딩될 때의 호스트 식별자·버전 범위·훅 참여·subcommand prefix. deliverable.type/platform/constraints.compat 3곳 산포 해소 대상. **host-plugin 서브타입 불변 필수** |
| 12 | **NEW-36 contribution_points[]** | 에디터 확장 UI 기여 선언 (v0.2 신설) | VSCode/JetBrains/Chrome-ext 같은 숙주가 `package.json#contributes` 블록을 받는 경우. 7종 kind(commands/keybindings/views/configuration/menus/statusbar/activationEvents)를 정규화. NEW-28 과 cross-reference. **에디터 확장 계열 필수** |

---

## 3. 권장 엔티티 원형

### 3.1 self-bootstrap 형(풍부형, 엔티티 ≈ 20)

| 엔티티 | 역할 | 필수 불변식 |
|--------|------|-------------|
| Harness | 제품 인스턴스 | 단일 루트 · version 형식 |
| Spec | SSoT 파일 | schema version · 🔒/🗒 필드 분리 |
| Command | 명령 단위 | CQS · preamble 출력 · 고정 표면 |
| Mode | 명령 실행 모드 | 자동 분기 · read-only 모드 존재 |
| Agent | 서브 에이전트 | Tool 권한 매트릭스 상한 준수 |
| Skill | 절차 번들 | SKILL.md frontmatter 트리거 |
| Hook | 검증 스크립트 | fail-open · 타임아웃 |
| Gate | 품질 관문 | 순서 준수 · skip 정책 |
| Drift | SSoT-파생 불일치 | kind enum · 자동/수동 구분 |
| Preamble | 출력 계약 | 줄 수 · 필드 · per-line budget |

### 3.2 host-plugin 형(간결형, 엔티티 ≈ 8 ±2~3, v0.1 신규 · v0.2 유연성 명시)

| 엔티티 | 역할 | 필수 불변식 |
|--------|------|-------------|
| Plugin / Extension | 숙주 도구에 부착되는 인스턴스 | 1회만 등록 · peer host 필수 (VSCode 는 "Extension" 이 정식명) |
| Config / Template | 사용자 레포 SSoT 설정 | 런타임 스키마 검증 · deep-freeze (VSCode 확장에선 "Template" 이라 불림) |
| ConfigRule / LintRule | 단일 규칙 단위 | defaults 상속 · 리터럴 파싱 |
| Classifier / Extension-hook | 사용자 확장 함수 | 순수 함수 · 선언 순서 우선 (vscode-cc 에는 없음 — 변형 가능) |
| Artifact / Chunk / (없음) | 측정·처리 대상 | host 파이프라인 산출물 복사본 (빌드도구 계열만) |
| Verdict / Result / LintVerdict | 평가 결과 | level enum · 필드 고정 |
| Report / OutputChannel | 집계 | 직렬화 포맷 SemVer 안정 (VSCode 는 OutputChannel) |
| Lockfile / HistoryIndex | 파생 캐시 | schemaVersion 포함 · overwrite-per-run |
| Draft (선택, v0.2) | 작성 중 사용자 상태 | 메모리 only 또는 workspace 하위 · sensitive=true |
| LLMAdapter / NetworkBoundary (선택, v0.2) | 외부 호출 경계 | opt-in · graceful degradation · sensitive=true |
| StatusBarItem / UI-indicator (선택, v0.2) | 숙주 UI 요소 | alignment/priority/text 3필드 고정 |

**원칙 (v0.2 유연성 반영)**:
- 엔티티 수 목표: self-bootstrap 은 15~25, host-plugin 은 **6~11 (8 ±2~3)**
- VAPT 처럼 데이터 중심이 아니므로 엔티티의 "필드 목록" 은 얕고 **invariants 가 깊은** 형태가 정상
- **host-plugin 형은 Spec 대신 Config 를 쓰며, 양자는 구조상 유사하나 "소유자" 가 다름 — Spec 은 제품 저자, Config 는 소비자**
- **서브타입 유연성**: 빌드도구 계열(vite-bb)은 Artifact/Chunk 가 필수, 에디터 확장(vscode-cc)은 Draft/UI-indicator 가 필수 — 템플릿은 "권장" 이지 "고정" 이 아님
- **판별 보조 지표 (v0.2)**: host-plugin 형 BR/F 비율 ≈ 1.0 (vite-bb/vscode-cc 모두 10/10), self-bootstrap 형 ≈ 0.67 (self 14/21). 결정적 기준 아니나 서브타입 선택 참고용

---

## 4. 매핑 힌트

### 4.1 명령어 지도 → command_map (또는 features[] 다중 매핑)

스키마에 `command_map[]` 이 없으면:
- features F-001~F-N 에 이름으로 `/prefix:xxx` 를 인코딩
- deliverable.entry_points[] 에 kind="slash-command" 로 N개 복사
- 명령 간 관계(선후·흐름)는 free-text 로 별도 notes

**주의**: **features 와 entry_points 의 중복**을 감수해야 함. command_map[] 도입 전에는 피할 수 없음.

### 4.2 Tool 권한 매트릭스 → 최대한 BR 로 흡수

12 에이전트 × 8 도구 같은 격자는 spec 단일 블록으로 표현 불가. 차선책:
- BR-xxx "에이전트는 매트릭스 상한 이하 tools 선언" 1 문장
- features[F-agents].acceptance_criteria 에 "매트릭스 범위 외 Write 호출 시 실패"
- 실제 매트릭스는 `.claude/agents/*.md` 각 frontmatter 에 분산

### 4.3 SSoT + 파생 파일 계약 → ambient_files 부재 시 BR 다중

이 도메인은 "edit-wins"(BR), "append-only"(BR), "재생성"(BR) 이 최소 3문장으로 흩어짐. NEW-33 이 공식화되면 한 블록으로 흡수 가능.

### 4.4 Walking Skeleton → features[0].type="skeleton" 의 meaning

기존 skill core 에 이미 있는 원칙 P-17 과 정확히 일치. meta 어댑터에서는 이 원칙을 **자기참조적으로** 검증 — "이 스펙 자체가 기술하는 Walking Skeleton 원칙을 이 스펙 도 지키는가?" 체크.

### 4.5 Preamble 계약 → BR 2개 + features 1개

```yaml
business_rules:
  - id: "BR-xxx"
    statement: "모든 명령은 실행 직후 N줄 preamble 을 stdout 에 출력"
  - id: "BR-yyy"
    statement: "anti-rationalization 2행을 preamble 직후 출력"
features:
  - id: "F-preamble"
    acceptance_criteria:
      - "3줄 preamble 은 각 80자 이내 (mode/scope/next 키 고정)"
      - "non-TTY 출력에서도 포맷 동일"
```

NEW-34 preamble_contract 공식화 시 3 슬롯 → 1 블록으로 압축 가능.

### 4.6 Canonical Hashing → deliverable.artifacts 변형

해시 파이프라인은 "빌드 산출물의 재현성" 이므로 NEW-26 deliverable.artifacts[] (tzcalc 출처) 의 변형으로 볼 수 있음. 단 meta 도메인에서는 **spec.yaml 자체가 해시 대상** 이라 artifact 가 아닌 "input normalization contract" 성격.

### 4.7 호스트 바인딩 → NEW-35 host_binding[] (v0.1 신규, v0.2 VSCode 예시 추가)

host-plugin 형 meta 도구는 숙주 도구 정보가 스키마 3곳에 산포:
- `deliverable.type` (plugin 하위타입 부재로 "cli-plugin" 근사)
- `deliverable.platform` (문자열 1개라 버전 전개 불가)
- `constraints.compat.<host>` (peer 버전 범위)
- 코드(`import type {Plugin} from 'vite'`) 에 타입 의존 — spec 외부

**현 v2.3.7 대응**:
- 최선책: BR-xxx "peer <host>@>=X 를 강제한다" + constraints.compat 명시
- 차선책: conversion-notes 에 host_binding 표 1개 수동 작성하여 recurrence 기록
- 2개 이상 host 에 바인딩되는 경우(cross-IDE 확장 등) 는 현재 스키마로 표현 불가 — NEW-35 필수

**제안 스키마 (v2.4.0 P1 확정 권고, 2/2 host-plugin 실증)**:

Vite plugin 예시:
```yaml
host_binding:
  - host: "vite"
    version_range: ">=5 <7"
    hooks: ["configResolved", "generateBundle", "buildEnd"]
    subcommand_prefix: "vite bundle-budget"
    upgrade_policy: "next-major-on-host-break"
    type_imports: ["Plugin", "Rollup.OutputChunk"]
```

VSCode extension 예시 (v0.2 신규):
```yaml
host_binding:
  - host: "vscode"
    version_range: ">=1.80 <1.91"
    activation_events: ["onView:commitCraft.view.drafts", "onCommand:commitCraft.draft.new", "workspaceContains:.git"]
    contribution_entry_points: ["command×8", "view×2", "statusbar×1"]
    upgrade_policy: "follow-vscode-minor"
    type_imports: ["vscode"]
    best_effort_forks: ["cursor>=0.35", "vscodium>=1.80"]    # v0.2: fork 호환 표현
```

### 4.8 Contribution points → NEW-36 contribution_points[] (v0.2 신규)

에디터·IDE·브라우저 확장 형 meta 도구는 commands 외에 6~9종의 UI/행동 기여를 선언적으로 등록:

| 숙주 | contribution 수 | 주요 kind |
|------|:---------------:|-----------|
| VSCode | 7~10종 | commands / keybindings / views / configuration / menus / statusbar / activationEvents (+languages/grammars) |
| JetBrains | 6~8종 | actions / keymaps / toolWindows / settings / inspections |
| Chrome/Firefox | 3~5종 | action / content_scripts / permissions / background / options_ui |
| Obsidian | 3~4종 | commands / settings-tab / ribbon-icon / status-bar |

**현 v2.3.7 대응 차선책**:
- commands 는 features[] + entry_points[] 에 중복 기록 (NEW-28 패턴)
- 기타 기여는 `features[].modules[]` 에 문장으로 녹이거나 BR 에 평면화 — **kind 별 필드 구조 손실**
- configuration(json schema) 는 entities 의 `invariants` 로 부분 흡수
- conversion-notes 에 contribution_points 표 1개 수동 작성 권장

**제안 스키마 (v2.4.0 P2 또는 v2.5 후보)**:
```yaml
contribution_points:
  - kind: "view"
    id: "commitCraft.view.container"
    scope: "activity-bar"
    title: "Commit Craft"
  - kind: "keybinding"
    command: "commitCraft.draft.new"    # command_map[].id 참조
    key: "cmd+k m"
    when: "scmFocused"
  - kind: "configuration"
    id: "commitCraft.llm.enabled"
    json_type: "boolean"
    default: false
    scope: "user,workspace"
  - kind: "menu"
    location: "scm/input/context"
    command: "commitCraft.draft.fromTemplate"
    when: "scmProvider == git"
  - kind: "statusbar"
    id: "commitCraft.statusBar.lintResult"
    alignment: "right"
    priority: 100
    command: "commitCraft.lint.runNow"
  - kind: "activation-event"
    event: "onView:commitCraft.view.drafts"
```

**NEW-28 과의 경계선**:
- NEW-28 command_map[] 은 **명령 자체의 실행 계약** (CQS/mode/side-effect)
- NEW-36 contribution_points[] 는 **명령·뷰·키 등을 호스트에 연결하는 접착층**
- `contribution_points[keybinding].command` 이 `command_map[].id` 를 참조하는 cross-reference 로 설계

---

## 5. 흔한 함정

### 5.1 self 변환에서 실제 발생

**함정 F-1 (★★★ 3/3 재현 — meta 도메인 절대 불변 함정)**: `features[]` 와 `deliverable.entry_points[]` 의 과도한 중복.
→ 각 slash command / CLI 서브커맨드 / VSCode command 를 양쪽에 넣게 됨. harness-boot-self(진단 명령 4개), vite-bb(3 CLI 서브커맨드 init/report/check), vscode-cc(8 VSCode 명령 draft.*×5 + template.edit + lint.runNow + history.learn) 모두 양쪽 중복.
**완화**: features[F-xxx_command] 에 상세 AC, entry_points 에는 kind + command 만. v2.4.0 RFC 의 command_map[] 도입 시 해소.
**판정**: P-23 (CLI dup tolerate) 원칙으로 명시 수용 — 경고 없이 넘긴다. v0.2 에서 3/3 meta 샘플 재현으로 **"meta 도메인 절대 불변 함정"** 으로 격상.

**함정 F-2**: "에이전트 권한 매트릭스" 같은 격자 데이터를 spec 에 억지로 평면화하려다 BR 수가 15개 초과.
**완화**: 매트릭스는 외부 리소스(md 원본) 참조로 남기고, spec 에는 "매트릭스를 준수한다" 는 메타 BR 1개만.

**함정 F-3**: "drift 8종" 을 features 에 8개 넣어버림.
→ drift 는 **탐지 대상의 분류** 이지 피처 아님.
**완화**: features 에 /harness:check 1개, drift 분류는 entities 의 Drift invariants 로 압축 + NEW-31 대기.

**함정 F-4**: `prototype_mode: true` 의 오활성화.
→ meta 도구는 대부분 architecture 성숙도라 `prototype_mode=false` 가 자연스러움. 재설계 중이라는 이유로 true 로 두지 말 것.

**함정 F-5**: Walking Skeleton 을 "init 명령" 과 혼동.
→ Walking Skeleton 은 **첫 피처가 전 기술 스택 관통** 을 의미. `/harness:init` 이 스켈레톤인 게 아니라, **init 후 첫 /sync 가 Gate 5 까지 통과** 하는 것이 스켈레톤의 실체. features[F-001].AC 에 명시.

**함정 F-6**: 변경 이력(부록 C) 을 project.description 에 녹이려 함.
→ changelog 는 metadata 영역. 현재 스키마에는 자리가 없어 unrepresentable G-08 로 기록하는 게 원칙적. metadata.source.revision 에 최신 버전만 기록.

**함정 F-7 (조건부: self_reference=true 에만 적용 — v0.1 명확화)**: 자기참조 self-check 를 빠뜨림.
→ meta 도구 스펙은 자기 BR 이 스스로를 속박. 변환 말미에 "이 spec 이 자기 BR-001~N 을 실제로 지키는가" 한 번 훑어야 함. conversion-notes §4.1 참조.
**적용 조건**: `metadata.conversion.self_reference_flag: true` 인 샘플만. false 인 경우 (vite-bb 등) 는 P-22 가 N/A.

**함정 F-9 (★ HIT — vite-bb 에서 검증됨, v0.1 격상; v0.2 vscode-cc 재확증)**: 빌드 도구·플러그인은 "config 스키마" 가 제품의 절반이며 **Spec 엔티티와 독립된 Config 계열 엔티티 군(BudgetConfig + BudgetRule + Classifier 또는 Template + LintRule 같은 2~3분)** 이 필요.
→ 1개 Config 엔티티로 충분하지 않음. config schema 의 각 "필드 모음" 이 각자의 불변식을 가지므로 **엔티티 분해** 가 자연스러움. vscode-cc 에서도 Template + LintRule 2분 관찰 (Classifier 상당 엔티티는 없음).
**완화**: host-plugin 형 권장 엔티티(§3.2)를 템플릿으로 사용. Config 를 2~5 개 엔티티로 분해.
**재발 조건**: "사용자 레포에 `xxx.config.ts` 또는 `.xxx/template.yaml` 을 두는 플러그인/확장"

**함정 F-8 (★★ PARTIAL HIT — vscode-cc 에서 검증됨, v0.2 §5.2→§5.1 격상)**: 에디터 확장(VSCode/JetBrains/브라우저 확장)은 commands 외에 6~9종 contribution point 를 선언하는데, 이를 `features[].modules[]` 나 BR 에 평면화하면 **kind 별 필드 구조(when 조건식, alignment, json_type, default 등) 가 손실**됨.
→ vscode-cc 변환 시 §4.2~4.7 (keybindings/views/configuration/menus/statusbar/activationEvents) 6개 섹션이 ★/☆ 로 떨어짐. backlink-matrix ★★★+ 비율이 65% 에 머무는 주 원인.
**완화**: NEW-36 contribution_points[] 를 conversion-notes 에 표 형태로 수동 작성 → recurrence 기록. §4.8 매핑 힌트의 kind enum 7개를 체크리스트로 활용.
**재발 조건**: "숙주가 `package.json#contributes` 또는 `plugin.xml` 또는 `manifest.json` 에 선언 블록을 받는" 에디터·IDE·브라우저 확장. VSCode · JetBrains · Chrome/Firefox · Obsidian · Figma 등.
**결론**: 가설의 "surface_map 이 필요할 수 있음" 부분은 확증. 단 "command_map 과 별도" 라는 설계 방향은 더 정교하게 — NEW-36 은 NEW-28 의 확장이 아닌 **독립 필드 with cross-reference**.

### 5.2 다른 meta 도메인에서 예상되는 함정 (OQ-1/4/7 대기)

**가설 F-10 (미검증 — OQ-4 대기)**: Oclif/Commander 같은 CLI 프레임워크 자체의 스펙은 "명령 정의 DSL" 이 주 표면. command_map[] 이 더 복잡한 schema 를 요구할 가능성.
**검증 방법**: Oclif 기반 CLI 1건 변환 → 명령 계층(subcommand of subcommand), alias, completion, help text 가 command_map[] 에 담기는지 측정.

**예측 F-11 (v0.1 신규, v0.2 유지)**: 2개 이상 host 에 동시 바인딩되는 cross-platform 도구(예: "Prettier + IDE extensions + CLI 3 surface 통합") 는 host_binding[] 를 **배열** 로 가질 수밖에 없음. 이 때 surface 간 동기화 보장 (예: VSCode settings 와 .prettierrc 가 일치해야 함) 이 BR 로 중첩 등장. v0.3 에서 cross-host-sync 패턴으로 추출 가능 (OQ-7).

**가설 F-12 (v0.2 신규)**: ESLint plugin 같은 lint 계열은 VSCode 처럼 명시적 UI contribution 이 없지만 **rules/configs/processors 3종 기여** 를 가진다. NEW-36 contribution_points[] 가 "UI 에 한정" 되어 있지 않고 일반화 가능한지 (ESLint 의 rule 등록도 contribution 으로 볼지) 측정 필요.
**검증 방법**: eslint-plugin-* 1건 변환하여 rules[]/configs[]/processors[] 3종이 contribution_points[kind="rule"/"config"/"processor"] 로 확장 흡수되는지 확인. 가능하면 NEW-36 의 적용 범위가 "에디터 확장" → "plugin contribution 일반" 으로 확장 (OQ-1 과 연동).

---

## 6. 체크리스트 확장

core 체크리스트(P-1~P-21)에 더해, meta 도메인에서는 다음을 추가 확인:

```
[ ] 제품 표면이 명령 N개인가? → command_map 우회 전략 준비
[ ] ambient files 가 레포에 설치되는가? → authorship/write_policy 각 파일마다 명시
[ ] 품질 관문이 순차적 N단계인가? → gate_chain 이 없으면 features[].AC 에 분산
[ ] 멀티 에이전트인가? → Tool 권한 매트릭스 BR 최소 1개
[ ] preamble 같은 출력 계약이 있는가? → BR 2 + features 1로 3슬롯 할당
[ ] SSoT + 파생 모델인가? → edit-wins BR + drift 엔티티
[ ] 자기참조인가 (스펙이 자기 제약을 따름)? → self-consistency 체크 (true 면 P-22 적용, false 면 N/A)
[ ] 숙주 도구(vite/eslint/vscode 등) 에 바인딩되는가? → host_binding 표 작성 + NEW-35 기록
[ ] 에디터·IDE·브라우저 확장인가? → contribution_points 7종(commands/keybindings/views/configuration/menus/statusbar/activationEvents) 모두 점검 + NEW-36 기록 (v0.2)
[ ] config 스키마가 제품의 절반 이상인가? → host-plugin 형 엔티티 템플릿(§3.2) 적용, Config 계열 2~3 엔티티로 분해
[ ] 성숙도가 architecture 이상인가? → non_goals 명시 유도 (암묵 처리 방지)
[ ] prototype_mode=true 의 함정 확인 → 재설계 중이어도 architecture 면 false 유지
[ ] features[0].type=skeleton 이 전 기술 스택 관통인가? (init 단독 아님)
[ ] Walking Skeleton 원칙을 이 스펙 자신이 지키는가? (self_reference=true 샘플만)
[ ] Canonical Hashing 같은 재현성 계약이 있으면 입력 정규화 범위 명시
[ ] (v0.2) BR/features 비율로 서브타입 재확인 — host-plugin ≈ 1.0, self-bootstrap ≈ 0.67
[ ] (v0.2) 사용자 콘텐츠를 다루는가? (Draft/LLMAdapter 류) → sensitive=true 플래그 + 데이터 흐름 BR 최소 1개
```

---

## 7. v0.3 승격 조건 (open questions)

v0.2 는 self + vite-bb + vscode-cc 3 샘플(자기참조 1 + host-plugin 2 = 빌드도구 · 에디터확장) 로 3 패턴을 커버. v0.3 로 가려면 다음 중 최소 2가지:

- [ ] **OQ-1**: ESLint plugin 또는 Prettier plugin 변환 — host-plugin 형 3번째 (lint 계열). F-12 가설(rules/configs/processors 가 contribution_points 에 흡수되는지) 검증
- [x] **OQ-2**: VSCode extension 변환으로 "surface_map 필요성" 검증 (F-8) — **v0.2 에서 vscode-commit-craft 로 PARTIAL HIT 확증, NEW-36 공식화**
- [x] **OQ-3**: Build tool (Vite plugin) 변환으로 "Config 엔티티 분리" 검증 (F-9) — **v0.1 에서 vite-bundle-budget 으로 HIT 확증**
- [ ] **OQ-4**: CLI 프레임워크 자체(Oclif 등) 변환으로 command_map DSL 복잡성 검증 (F-10)
- [x] **OQ-5**: 자기참조 아닌 meta 도구 변환 1건 — **v0.1 에서 vite-bundle-budget 으로 완료, v0.2 에서 vscode-commit-craft 로 재확증. P-22 조건부화 근거 2/2 확보**
- [ ] **OQ-6**: NEW-28/33 이 v2.4.0 에 도입된 후 기존 self + vite-bb + vscode-cc 변환을 재실행하여 ★★★+ 비율이 65% → 88% 로 개선되는지 측정 (backlink-matrix.md §5 예측)
- [ ] **OQ-7 (v0.1 신규)**: Cross-host 도구(Prettier-like: CLI + IDE extension + plugin 동시) 1건으로 F-11 가설 검증
- [ ] **OQ-8 (v0.2 신규)**: NEW-36 이 JetBrains plugin / Chrome extension / Obsidian plugin 에서도 재현되는지 최소 1건 변환으로 검증. 재현되면 NEW-36 의 kind enum 을 "에디터 확장 한정" 에서 "plugin contribution 일반" 으로 확장

---

## 8. 관련 문서

### 8.1 샘플 1 — harness-boot self (self-bootstrap 형)

- 원본: `design/harness-boot-design-2.3.7.md`
- 변환 산출물: `design/samples/harness-boot-self/{spec.yaml,unrepresentable.md,conversion-notes.md,backlink-matrix.md}`
- 갭 정식화: `design/samples/harness-boot-self/unrepresentable.md §3` (NEW-28~34)
- 예측 vs 실제: `design/samples/harness-boot-self/conversion-notes.md §4.4` (이 어댑터의 씨앗)

### 8.2 샘플 2 — vite-plugin-bundle-budget (host-plugin 형, 빌드도구 계열, v0.1 신규)

- 원본: `design/samples/vite-bundle-budget/plan.md`
- 변환 산출물: `design/samples/vite-bundle-budget/{spec.yaml,unrepresentable.md,conversion-notes.md,backlink-matrix.md}`
- 갭 정식화: `design/samples/vite-bundle-budget/unrepresentable.md §3` (NEW-35)
- 예측 vs 실제: `design/samples/vite-bundle-budget/conversion-notes.md §4.2` (v0.1 승격 근거)

### 8.3 샘플 3 — vscode-commit-craft (host-plugin 형, 에디터 확장 계열, v0.2 신규)

- 원본: `design/samples/vscode-commit-craft/plan.md`
- 변환 산출물: `design/samples/vscode-commit-craft/{spec.yaml,unrepresentable.md,conversion-notes.md,backlink-matrix.md}`
- 갭 정식화: `design/samples/vscode-commit-craft/unrepresentable.md §3` (NEW-36)
- 예측 vs 실제: `design/samples/vscode-commit-craft/conversion-notes.md §4.2` (v0.2 승격 근거)

### 8.4 관련 어댑터

- `skills/spec-conversion/adapters/library.md` (v0.1, tzcalc 기반) — meta 와 가장 유사하나 "공개 심볼" 중심. `host-plugin 형` 의 Config 분해 패턴은 library 의 public_api[] 과 상호보완.

### 8.5 관련 RFC

- `design/rfcs/v2.4.0-schema-expansion.md` — P0 5필드(NEW-24/28/29/30/33) 수용 계획. 도입 후 meta 3샘플 ★★★+ 65% → 82~88% 예상. v0.2 권고: NEW-35 P1 확정, NEW-36 P2 신설.
