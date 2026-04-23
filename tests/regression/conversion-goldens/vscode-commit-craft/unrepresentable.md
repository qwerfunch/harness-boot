# Unrepresentable.md — vscode-commit-craft (meta 도메인 3번째 샘플)

**대상**: `design/samples/vscode-commit-craft/plan.md` (≈205줄, 17 섹션)
**스키마**: v2.3.7
**비교 대상**: url-shortener / retro-jumper / price-crawler / vapt-apk-sast / tzcalc / **harness-boot-self** / **vite-bundle-budget**
**변환 회차**: 8회차 (Phase 2.9 — meta 어댑터 v0.1 → v0.2 승격 준비)
**자기참조**: false (OQ-5 재확증 — meta 도메인 비자기참조 2번째 사례)
**어댑터 버전 사용**: v0.1 (host-plugin 형)

---

## 0. 요약

| 판정 | 개수 |
|------|------|
| 기존 갭 재현 (G-01 ~ G-16) | **13/16** (G-11/14 비해당, G-04 부분 재현 — sidebar 가 있어 약하게 존재) |
| 기존 신규 갭 재현 (NEW-17 ~ NEW-35) | **10/19** (NEW-17/24/26/28/30/32/33/34/35 강·부분 재현) |
| VSCode 확장 고유 신규 갭 후보 | **1개** (NEW-36 contribution_points[]) |
| 총 갭 엔트리 | **36개** (16 G + 18 NEW-17~34 + NEW-35 + NEW-36) |

**관찰 1 — F-8 가설 PARTIAL HIT**: meta 어댑터 v0.1 §5.2 의 F-8 "에디터 확장은 surface_map 필요" 가설이 **부분적으로 재현**됨. VSCode 확장은 contribution point 7종(commands / keybindings / views / configuration / menus / statusbar / activationEvents) 을 모두 `package.json#contributes` 로 선언하는데, 이 중 **commands 만 NEW-28 command_map[] 로 흡수 가능**. 나머지 6종은 현 스키마에서 `features[].modules[]` 혹은 `deliverable.entry_points[]` 임시 `kind` 필드로 우회. → **NEW-36 contribution_points[]** 신규 공식화.

**관찰 2 — host_binding 재확증 (2/2)**: vite-bb 에서 도입된 NEW-35 host_binding[] 이 vscode-cc 에서도 그대로 재현. 구체적으로 `host: "vscode"`, `version_range: ">=1.80"`, `activation_events: ["onView:", "onCommand:", "workspaceContains:.git"]`, `type_imports: ["vscode"]`. **host-plugin 형 meta 샘플에서 NEW-35 가 2/2 필수** 확증 → 불변 필수 갭 승격.

**관찰 3 — NEW-28 surface 확장 필요성 관찰**: vite-bb 변환 때는 "NEW-28 command_map[] 에 `surface` 필드 추가로 부분 흡수 가능" 이라 언급했는데, vscode-cc 에서 이 추측이 **불충분**으로 드러남. command_map[] 에 surface 만 추가해서는 views(트리뷰 계층 구조) · configuration(json schema) · menus(조건식 when) 를 담을 수 없음. → NEW-36 이 NEW-28 의 확장이 아니라 **독립 필드**여야 함 (F-8 가설의 세밀화).

**관찰 4 — Draft 엔티티의 민감성**: 다른 meta 샘플(self, vite-bb) 에서는 sensitive=true 엔티티가 없거나(Spec/BudgetConfig 모두 공개) 최소였지만, vscode-cc 의 Draft 와 LLMAdapter 는 사용자 작성 콘텐츠·API 키 포함으로 sensitive=true. meta 도메인의 3번째 변형 (end-user data-touching plugin) 발견 — 기존 함정 F-2 "권한 매트릭스" 와 다른, **개인정보 흐름 BR** 의 필요성이 Bank 1건(BR-002/003/004) 으로 재현.

**관찰 5 — BR 10건 × features 10건 교차확증**: meta 도메인 3샘플(self=BR14/F21, vite-bb=BR10/F10, vscode-cc=BR10/F10) 의 host-plugin 형 샘플 2건에서 **BR/features = 1.0 비율 수렴**. self-bootstrap 형(self) 의 0.67 과 구분되는 신호 — `domain_adapter.meta` 의 두 서브타입 판별에 실효.

---

## 1. 기존 갭(G-01 ~ G-16) 재현 매트릭스

| ID | 재현 | vscode-commit-craft 에서의 구체 양상 |
|----|:----:|-------------------------------------|
| G-01 NFR | **재현** | "50ms 이내 드롭다운", "300ms debounce", "gz 150 kB 번들", "cold start < 1s" — NFR 블록 부재로 AC/BR 에 산포 |
| G-02 API | **재현** | extension activate() + 8 commands + LLM HTTP 어댑터 (사용자 endpoint). public_api[] 자리 없음 (NEW-24 재확증) |
| G-03 Entity attributes | **재현** | Template 스키마(types/scopes/format/schemaVersion 4필드) · LintRule 4필드 · HistoryIndex 3필드. entities[].invariants 로 일부 수용 |
| G-04 UI screens | **부분 재현 (meta 변형)** | VSCode 확장이라 "UI screen" 은 아니지만 **tree view 2 뷰 + statusbar + 입력박스 인라인 힌트** 가 존재. vite-bb 와 달리 UI 비중이 약간 있음 — G-04 가 완전 비해당은 아님 |
| G-05 Edge cases | **재현** | Template schemaVersion mismatch / 대형 레포 HistoryIndex / LLM 호출 실패 / 평문 API 키 저장 / Cursor 호환성 — BR·AC·OQ 에 산포 |
| G-06 External deps | **재현** | vscode ≥1.80 (peer) + simple-git + zod + yaml + (optional) user LLM endpoint. constraints.compat + architectural 2곳에 분산 |
| G-07 Metrics | **재현** | DAU, 명령 빈도, lint blocking 발생률, LLM opt-in 비율, cold start p95 — AC 에 산포. 자리 없음 |
| G-08 Milestones | **재현** | M1~M6 (각 1주) — features[].priority 로는 기간 표현 불가 |
| G-09 Risks | **재현** | §12 리스크 5개 (Cursor 호환 / Template 완화 / 대형 레포 / VSCode 1.90 변경 / LLM 평문 키) — open_questions OQ-1~5 로 흡수 |
| G-10 Open questions | **재현** | §12 + §4.4 LLM 정책 — OQ-1~5 로 정리 |
| G-11 Assets | **비해당** | 아이콘 몇 개 외 대용량 asset 없음. plan.md 에 도식 없음 |
| G-12 Tuning constants | **부분** | debounce 300ms, retainDays 30d, learnCount=100, bundle_size 150kB, priority=100 (statusbar) — BR/AC 에 산포 |
| G-13 Non-goals | **재현** | §13: commitizen 대체 · GitLens 경쟁 · VSCode Online · 웹뷰 기반 분석 대시보드 · LLM 기본활성화 — constraints 자리 없음 |
| G-14 Schedule/concurrency | **비해당** | 확장 런타임에 스케줄러 없음 (debounce 수준). history 재학습은 on-demand |
| G-15 Failure policies | **부분 재현 (meta 변형)** | lint.onCommit ∈ {off, warn, error} 3정책 + LLM degrade. "실패 정책" 의 meta 변형(정책 열거)은 vite-bb 와 공통 |
| G-16 Observability | **부분 재현** | VSCode OutputChannel `commit-craft` + 상태바 lint 상태 — meta 도메인의 "출력 계약" 성격 |

### 재현 매트릭스 누적 (8 샘플)

| 갭 | URL | retro | worker | VAPT | tzcalc | self | vite-bb | **vscode-cc** | 재현율 |
|----|:---:|:-----:|:------:|:----:|:------:|:----:|:-------:|:-------------:|:------:|
| G-01 NFR | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **8/8** |
| G-02 API | ✅ | ✅ | ✅ | ✅✅ | ✅✅ | ✅ | ✅ | ✅ | **8/8** |
| G-03 Entity attrs | ✅ | ✅ | ✅ | ✅✅ | ⚠ | ✅ | ✅ | ✅ | 7.5/8 |
| G-04 UI | ✅ | ✅ | ⚠ | ✅ | — | — | — | ⚠ | 4/8 |
| G-05 Edge cases | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **8/8** |
| G-06 External deps | ✅ | ✅ | ✅ | ✅✅ | ⚠ | ✅ | ✅ | ✅ | 7.5/8 |
| G-07 Metrics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **8/8** |
| G-08 Milestones | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **8/8** |
| G-09 Risks | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **8/8** |
| G-10 Open questions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **8/8** |
| G-11 Assets | - | ✅ | ⚠ | ⚠ | — | — | — | — | 2/8 |
| G-12 Tuning | - | ✅ | ✅ | ✅ | ⚠ | ⚠ | ⚠ | ⚠ | 4.5/8 |
| G-13 Non-goals | ⚠ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 6.5/8 |
| G-14 Schedule/concurrency | - | - | ✅ | ⚠ | — | — | — | — | 1.5/8 |
| G-15 Failure policies | ⚠ | ⚠ | ✅ | ✅ | — | ⚠ | ⚠ | ⚠ | 4.5/8 |
| G-16 Observability | ⚠ | - | ✅ | ✅ | — | ✅ | ⚠ | ⚠ | 5/8 |

**8/8 재현 확정 = 7개** (G-01/02/05/07/08/09/10) — 7샘플 기준 동일. **"도메인 불변 필수 갭" 집합 = G-01/02/05/07/08/09/10 (7종) 8/8 확증**.

**meta 도메인 안정 비해당 = G-14** (meta 샘플 3건 모두 —). G-11 은 meta 3건 중 비해당(self=—, vite-bb=—, vscode-cc=—) 이므로 meta 도메인 비해당으로 격상 가능. G-04 는 vscode-cc 에서 부분 재현이 발생하여 "meta 불변 비해당" 에서 제외됨 — **meta 도메인 = UI 완전 부재가 아닌 "UI 비중 < 20%" 로 정의 수정 필요**.

---

## 2. 기존 신규 갭 (NEW-17 ~ NEW-35) 재현 여부

| ID | 재현 | 비고 |
|----|:----:|------|
| NEW-17 Tool/Skill/Agent layer | **부분** | LLMAdapter 가 약한 "tool" 계층. BR-004 (keychain) 으로 일부 흡수 |
| NEW-18 DAG execution | **비해당** | VSCode 확장은 이벤트 기반, DAG 아님 |
| NEW-19 Benchmark GT | **비해당** | 성능 벤치마크 없음 |
| NEW-20 Pricing/tenant tier | **비해당** | MIT OSS 단일 티어 |
| NEW-21 Diagram/mermaid | **비해당** | plan.md 에 도식 없음 |
| NEW-22 Self-evolving | **비해당** | 자가진화 아님 |
| NEW-23 (security-specific) | **비해당** | VAPT 고유 갭, 여기 해당 없음 |
| NEW-24 public_api[] | **재현 (HIT)** | `activate()` / `deactivate()` / (on-command handlers 8종) / (LLM adapter interface) 공개 계약. self(✅) + tzcalc(✅✅) + vite-bb(✅✅) + vscode-cc(✅) = **4/4 연속 HIT** → **도메인 초월 P0 1순위 확증** |
| NEW-25 Compatibility matrix | **부분 재현** | VSCode 1.80~1.90, Cursor 0.35+, VSCodium 1.80+, Node 18 (VSCode 내장), git 2.30+. constraints.compat 에 명시 가능하나 "best-effort" 같은 뉘앙스는 손실 |
| NEW-26 deliverable.artifacts[] | **재현 (HIT)** | VSIX → VS Marketplace + OpenVSX 양대 마켓. 2개의 artifacts[] 엔트리로 표현 가능 |
| NEW-27 (library subtype) | **부분** | tzcalc 고유였으나 여기서도 재현: `deliverable.type="cli-plugin"` 로 대응했으나 **"vscode-extension" 하위타입이 정확** — NEW-35 와 연동 |
| NEW-28 command_map[] | **재현 (HIT)** | 8 commands (draft.new/fromTemplate/fromDiff/save/clear + template.edit + lint.runNow + history.learn) + CQS (edit=쓰기, runNow=읽기, clear=쓰기) + keybinding 연결. features F-001/002/005/007/009 와 entry_points[vscode-command×8] 양쪽에 중복 — 함정 F-1 재현 (3/3) |
| NEW-29 agent_permissions[] | **비해당** | 단일 "에이전트" (= 확장). LLMAdapter 를 외부 엔티티로 보더라도 권한 matrix 수준 아님 — v0.1 "N≥2 조건부" 근거 재확증 |
| NEW-30 gate_chain[] | **재현 (HIT)** | lint.onCommit 정책 off→warn→error 3단계 + Template 스키마 검증 + LLM opt-in 게이트. 명시적 gate chain 이지만 현재 스키마에는 BR/AC 분산 |
| NEW-31 drift_catalog[] | **부분** | (a) Template schemaVersion drift, (b) HistoryIndex stale (retainDays 경과), (c) Draft.diffHash ↔ 현재 스테이징 drift, (d) LLM API 키 평문 drift — **4종 drift 후보 관찰** (vite-bb 3종, self 8종의 중간값) |
| NEW-32 versioning_axes[] | **부분 재현** | (a) 확장 SemVer, (b) Template schemaVersion (독립), (c) VSCode engines 하한, (d) LLM adapter protocol — 4축 |
| NEW-33 ambient_files[] | **재현 (HIT)** | `.commit-craft/template.yaml` (SSoT, edit-wins) + `.commit-craft/drafts/*.md` (사용자 저장, append-only) + `.vscode/commit-craft-history.json` (파생, overwrite-per-learn) + `settings.json#commitCraft.*` (사용자 설정, edit-wins) — **4 ambient file 종류** — meta 3샘플(self=8, vite-bb=3, vscode-cc=4) 의 중간값. authorship/write_policy/on_rerun 3축 모두 적용 |
| NEW-34 preamble_contract | **비해당** | VSCode 확장은 stdout preamble 개념 없음 (OutputChannel 로그만) — self 고유에 가까운 것으로 추가 확증 |
| NEW-35 host_binding[] | **재현 (HIT, 2/2)** | `host: "vscode"`, `version_range: ">=1.80 <1.91"`, `activation_events: [onView:, onCommand:, workspaceContains:.git]`, `contribution_entry_points: [command×8, view×2, statusbar×1]`, `upgrade_policy: "follow-vscode-minor"`, `type_imports: ["vscode"]`. vite-bb 에서 도입된 NEW-35 가 **2/2 host-plugin 샘플에서 필수** — 불변 필수 갭 승격 |

### NEW 재현 매트릭스 (VAPT/tzcalc/self/vite-bb/vscode-cc 5샘플)

| NEW | VAPT | tzcalc | self | vite-bb | vscode-cc | 재현율 | 의미 |
|-----|:----:|:------:|:----:|:-------:|:---------:|:------:|------|
| NEW-17 Tool/Skill/Agent | ✅✅ | ⚠ | ✅ | ⚠ | ⚠ | 3.5/5 | meta·security 에서 강함 |
| NEW-22 Self-evolving | ⚠ | — | ✅ | — | — | 1.5/5 | self 고유에 가까움 |
| NEW-24 public_api[] | — | ✅✅ | ✅ | ✅✅ | ✅ | **4.5/5** | **도메인 초월 P0 1순위 확증** |
| NEW-26 deliverable.artifacts[] | ⚠ | ✅✅ | ✅ | ✅✅ | ✅✅ | 4.5/5 | library + meta 에서 강함 |
| NEW-28 command_map[] | — | — | ✅✅ | ✅✅ | ✅✅ | **3/3 meta** | **meta 불변 필수 ★ (3/3)** |
| NEW-30 gate_chain[] | ⚠ | — | ✅✅ | ✅ | ✅ | 3.5/5 | meta 에서 매번 재현 |
| NEW-33 ambient_files[] | — | — | ✅✅ | ✅✅ | ✅✅ | **3/3 meta** | **meta 불변 필수 ★ (3/3)** |
| NEW-35 host_binding[] | — | — | — | ✅✅ | ✅✅ | **2/2 host-plugin** | **host-plugin 불변 필수 ★ (2/2)** |

**결론 (meta 3샘플 수렴)**:
- **NEW-28 command_map[] · NEW-33 ambient_files[] 는 3/3 meta 샘플 모두 HIT** — meta 도메인 불변 필수 확정.
- **NEW-35 host_binding[] 은 2/2 host-plugin 샘플 모두 HIT** — host-plugin 서브타입 불변 필수 확정 (self-bootstrap 형은 해당 없음).
- **NEW-24 는 library + meta 4.5/5 로 P0 1순위 재확증**.
- v2.4.0 RFC 의 P0 5필드 우선순위가 meta 3샘플로 수렴 — RFC 타당성 강화.

---

## 3. 신규 갭 공식화 — NEW-36

### NEW-36 **contribution_points[]** (에디터 확장 특이 — F-8 가설 PARTIAL HIT 공식화)

**의미**: 에디터 확장(VSCode/JetBrains/Sublime 등) 이 숙주에 기여하는 **UI 및 행동 표면의 유형별 선언**. commands 는 NEW-28 command_map[] 으로 흡수되지만, views / configuration / menus / keybindings / statusbar / activationEvents 같은 **비명령 표면** 을 담는 별도 구조가 필요.

**필요성 (vscode-cc 기준)**:
VSCode 확장은 `package.json#contributes` 에 다음 7종을 선언:

| contribution | vscode-cc 수 | 현 v2.3.7 표현 위치 | 문제 |
|--------------|:-----------:|-----------------------|------|
| commands | 8 | `deliverable.entry_points[kind=vscode-command]` + features 중복 | NEW-28 로 해결 예정 |
| keybindings | 3 | features F-007.modules[] + BR 에 숨김 | command 와 표면-키 매핑 구조 부재 |
| views | 2 (container + tree) | `deliverable.entry_points[kind=vscode-tree-view]` 우회 | 계층 구조(tree item type) 손실 |
| configuration | 10 settings | entities.Template (일부) + BR 에 산포 | JSON schema · default · scope · description 구조 전체 부재 |
| menus | 4 위치 | features F-007 문장 | `when` 조건식 손실 |
| statusbar | 1 | entities.StatusBarItem + features F-005 | alignment/priority/text 쌍 손실 |
| activationEvents | 3 | BR-006 + features F-001 | 트리거 어휘 리스트 부재 |

**총 6종 (commands 제외) 이 spec 에 산포** — NEW-28 command_map[] 단독으로는 **흡수 불가**.

**재발 조건**: 에디터·IDE·브라우저 확장, 즉 숙주가 "plugin contribution" 을 `package.json`/`manifest.json`/`plugin.xml` 등의 선언적 블록으로 받는 모든 확장. 예:

- VSCode extension (검증됨)
- JetBrains plugin (plugin.xml)
- Chrome/Firefox extension (manifest.json)
- Obsidian plugin (manifest.json)
- Figma plugin (manifest.json)

**제안 스키마 (v2.5 후보, v2.4.0 P1 격상 검토 — NEW-35 와 동계층)**:

```yaml
contribution_points:
  - kind: "view"
    id: "commitCraft.view.container"
    scope: "activity-bar"
    title: "Commit Craft"
  - kind: "view"
    id: "commitCraft.view.drafts"
    scope: "tree"
    parent: "commitCraft.view.container"
    item_types: ["draft", "template", "recent-commit"]
  - kind: "keybinding"
    command: "commitCraft.draft.new"
    key: "cmd+k m"
    when: "scmFocused"
  - kind: "configuration"
    id: "commitCraft.llm.enabled"
    json_type: "boolean"
    default: false
    scope: "user,workspace"
    description: "Enable LLM adapter (requires endpoint + keychain key)"
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
  - kind: "activation-event"
    event: "workspaceContains:.git"
```

**NEW-28 과의 경계선 (중요 설계 결정)**:
- NEW-28 command_map[] 은 **명령 자체의 실행 계약** (CQS/mode/side-effect/return 타입 등).
- NEW-36 contribution_points[] 는 **명령·뷰·키 등을 호스트에 연결하는 접착층**.
- 동일 명령이 `commands[]` 에 1개 정의 + `contribution_points[keybinding]` 2개 + `contribution_points[menu]` 1개 등장 가능 — **정규화된 cross-reference** 로 설계.

**v2.4.0 RFC 와의 관계**:
- NEW-36 은 P0 5필드 밖 (P1 후보, NEW-35 와 동계층).
- v2.4.0 릴리즈 시 NEW-28 만 도입하면 vscode-cc 의 ★★★+ 비율은 65% → 78% 정도 개선 예상 (vite-bb 88% 예측보다 낮음).
- NEW-36 까지 도입하면 88% 이상 달성 예측.

**F-8 가설 세밀화 (v0.2 adapter 반영 필요)**:
- 기존 F-8: "에디터 확장은 surface_map 이 필요할 수 있다"
- v0.2 F-8 결론: "에디터 확장은 **contribution_points[] 가 필수**이며, 7종 kind enum 을 갖는다. command_map[] 과는 cross-reference 로 연결된 독립 필드."

---

## 4. 변환 전/후 매핑 실제 위치

| 원본 섹션 | 이상적 위치 | 실제 위치 (v2.3.7) |
|-----------|-------------|---------------------|
| §2 목표 3축 | project.vision + BR 매트릭스 | BR-001/002/003 로 산포 |
| §4.1 commands (8개) | command_map[8] | entities.Extension + entry_points[vscode-command×8] + features F-001/002/005/007/009 중복 |
| §4.2 keybindings (3개) | contribution_points[keybinding×3] | features F-007.modules[] + AC 문장 |
| §4.3 views (2개) | contribution_points[view×2] | entry_points[vscode-tree-view/vscode-view-container] 우회 + features F-006 |
| §4.4 configuration (10개) | configuration_schema[] (json schema 하위필드) | entities.Template (일부) + BR-004/005 + OQ-5 |
| §4.5 menus (4개) | contribution_points[menu×4] | features F-007 문장에 평면화 |
| §4.6 statusbar (1개) | contribution_points[statusbar] | entities.StatusBarItem + features F-005 중복 |
| §4.7 activationEvents (3개) | contribution_points[activation-event×3] | BR-006 + features F-001 |
| §5 엔티티 8개 | entities[] 그대로 | entities[] 그대로 ★ 잘 들어맞음 |
| §10 UX 원칙 | design_principles[] | BR-001/002/003/004 + project.vision 산포 |
| §11 마일스톤 | schedule.milestones[] | 자리 없음 — G-08 으로 기록 |
| §12 리스크 | risk_register[] + open_questions[] | open_questions[] 로 전환 |
| §13 non-goals | non_goals[] | constraints 에 자리 없음 — G-13 |
| §14 이해관계자 | stakeholders[] | stakeholders[] 그대로 ★ |
| §15 측정 지표 | metrics[] | 자리 없음 — G-07 |
| §16 배포 | deliverable.artifacts[] | artifacts[2] ★ |
| §17 부록 예시 | examples[] | 자리 없음 — notes 로 이관 |

**전체 원본 섹션 수 = 17, spec 매핑 성공 ≥ 12** (71% 매핑). self(65%), vite-bb(77%) 대비 vscode-cc 는 가운데 위치 — contribution points 가 많은 샘플이라 매핑 부담이 약간 상승. NEW-36 도입 시 ★★★+ 비율이 88%+ 로 개선 예상.

---

## 5. 결론 및 v2.4.0 RFC / 메타 어댑터 v0.2 영향

### 5.1 v2.4.0 RFC 에 주는 영향

1. **P0 HIGH 5필드 (v2.4.0) 의 실증 강화**:
   - NEW-24 public_api[] : 4.5/5 샘플 연속 HIT — P0 1순위 재확증
   - NEW-28 command_map[] : 3/3 meta 샘플 HIT — meta 불변 필수 확정
   - NEW-33 ambient_files[] : 3/3 meta 샘플 HIT — meta 불변 필수 확정
   - NEW-30 gate_chain[] : 3.5/5, meta 3/3 — meta 에서 매번 재현
   - NEW-29 agent_permissions[] : vite-bb + vscode-cc 에서 비해당 확증 (2/3 meta 샘플 N/A) → **RFC 에서 "agent N≥2 조건부 필수" 로 수정 권고**

2. **NEW-35 host_binding[] 의 P1 격상 근거 확립**:
   - 2/2 host-plugin 샘플에서 불변 필수 재현
   - v2.4.0 P1 격상 강력 추천 (RFC 문서 §4 갱신 필요)

3. **NEW-36 contribution_points[] 신설 제안 (v2.5 또는 v2.4.0 P2)**:
   - vscode-cc 에서 명확히 드러남 (commands 외 6종 표면)
   - JetBrains / 브라우저 확장 / Figma 플러그인 등으로 재현 예상
   - NEW-35 와 쌍 — 숙주 정보(NEW-35) + 숙주 UI 기여(NEW-36)

### 5.2 메타 어댑터 v0.1 → v0.2 승격 근거

v0.1 의 OQ 체크리스트 중:
- [x] **OQ-2**: VSCode extension 변환으로 "surface_map" 검증 (F-8) — **vscode-cc 로 PARTIAL HIT 확증**
- [x] **OQ-3**: (v0.1 에서 이미 완료)
- [x] **OQ-5**: (v0.1 에서 이미 완료)

**v0.2 승격 시 주요 변경**:
1. §2 우선 체크 갭 테이블에 **NEW-36 contribution_points[]** 신규 추가 (순위 12, 에디터 확장 한정 필수)
2. §3.2 host-plugin 형 엔티티 테이블은 유지 (vscode-cc 도 8 엔티티로 수렴)
3. §4.7 host_binding 매핑 힌트 유지 + §4.8 contribution_points 매핑 힌트 신설
4. §5.1 F-1(features ↔ entry_points 중복) 을 **3/3 meta 불변 함정**으로 격상
5. §5.2 F-8 가설을 §5.1 **PARTIAL HIT 관찰된 함정** 으로 격상 (전문: "에디터 확장은 contribution_points[7종 kind] 가 필수, command_map[] 과 cross-reference 관계")
6. §6 체크리스트에 "에디터 확장인가? → contribution_points 표 작성 + 7종 kind 모두 점검" 항목 추가
7. §7 v0.3 승격 조건 재설정: OQ-2 완료 표시, OQ-1 (ESLint), OQ-4 (Oclif), OQ-7 (cross-host) 만 남김
8. §8 관련 문서에 §8.3 vscode-commit-craft 샘플 섹션 신설

### 5.3 BR/features 비율의 host-plugin 서브타입 판별 실효성

| 샘플 | BR | features | BR/F |
|------|:--:|:--------:|:----:|
| harness-boot-self (self-bootstrap 형) | 14 | 21 | 0.67 |
| vite-bundle-budget (host-plugin 형) | 10 | 10 | 1.00 |
| vscode-commit-craft (host-plugin 형) | 10 | 10 | 1.00 |

host-plugin 형 2샘플 BR/F = 1.0 수렴, self-bootstrap 형 0.67 과 명확히 구분됨. **메타 어댑터 v0.2 §3.1/3.2 선택 휴리스틱에 이 비율을 참고 지표로 추가 권장** (결정적이지는 않음).

### 5.4 다음 변환 대상 제안 (v0.2 → v0.3)

- OQ-1: ESLint plugin 변환 — host-plugin 형 3번째 샘플. contribution_points[] 가 ESLint 에서는 어떻게 나타나는지 측정 (rules/configs/processors 3종).
- OQ-4: Oclif 기반 CLI 1건 변환 — command_map DSL 복잡성 측정.
- OQ-7: Prettier-like cross-host 도구 (CLI + IDE extension + plugin) — F-11 cross-host-sync 패턴 검증.

NEW-36 이 ESLint plugin 에서도 재현되면 "에디터 확장 한정" 에서 "plugin contribution 일반" 으로 정의 확장 가능 — 메타 어댑터 v0.3 주요 업데이트 후보.
