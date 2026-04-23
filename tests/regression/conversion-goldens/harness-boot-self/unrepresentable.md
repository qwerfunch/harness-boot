# Unrepresentable — harness-boot-self (meta / cli-plugin 도메인 최초 케이스)

**원본**: `design/harness-boot-design-2.3.7.md` (3493줄, 13장 + 부록 A/B/C/D)
**변환 회차**: 6회차 (url-shortener → retro-jumper → price-crawler → VAPT → tzcalc → **self**)
**스킬 버전**: v0.3 (MUST/SHOULD/MAY 적용)
**어댑터 상태**: 부재. library + worker + saas 원칙 혼합으로 작성.
**성격**: **자기참조 스펙** — 이 문서의 스키마가 곧 이 스펙이 설명하는 그 스키마(v2.3.7). 메타 도메인 최초의 자기변환 스트레스 테스트.

---

## 0. 요약 (TL;DR)

| 지표 | 값 |
|------|---:|
| 재현된 기존 갭 (G-01~G-16) | 12/16 |
| 재현된 NEW-17~23 (VAPT) | 5/7 |
| 재현된 NEW-24~27 (tzcalc) | 2/4 |
| **신규 갭 제안 (NEW-28~34)** | **7 신규** |
| 총 갭 엔트리 | **26** |
| 누적 갭 카탈로그 크기 | G-01~16 + NEW-17~34 = **34개** |

**해석**: 메타 도메인은 기존 4 도메인의 합집합에 비해 **command-map / agent-matrix / gate-chain / drift-catalog / preamble-contract** 5개 축이 스키마 공백 상태. 기존 어댑터로는 도달 못함 → **P2.8-5 에서 `adapters/meta.md` 신설 강하게 지지**.

---

## 1. 기존 G-01~G-16 재현 매트릭스

| 갭 | 재현 | 비고 |
|----|:----:|------|
| G-01 quantified_non_functional_requirements | ✅ | "Gate 5 까지 통과", "delta 빌드 60% 단축"(F-003 AC), "80자 이내"(F-011 AC) 등 — 수치는 AC 에 분산, 집약 필드 부재 |
| G-02 api_contracts | **부분** | slash command 가 "명령 API" 역할. 파라미터 스키마가 §7.3.x 에 산재. 기존 HTTP-중심 API 모델과 불일치 — G-02 의 확장 필요 |
| G-03 entity_attrs | ✅ | 14 엔티티가 invariants 만 기록. 필드 목록은 §5.x 본문에 산문으로 존재(State.yaml 스키마 §5.5 등) |
| G-04 ui_scenarios | **비해당(정당)** | CLI 플러그인이므로 UI 없음. 단 /harness:events 출력 포맷은 약한 UI 성격 |
| G-05 priority_sla | ⚠ | 명시 SLA 없음. "Gate 5 통과 전 done 불가" 같은 논리적 전후관계는 BR 로 기록 |
| G-06 external_deps | **부분** | constraints.tech_stack 에 런타임/CLI 프레임워크만. 개별 npm 패키지·Claude Code API 버전은 미정리. "Claude Code plugin API" 는 암묵적 의존 |
| G-07 benchmarks_and_gt | **비해당(정당)** | 메타 도구라 "정답지" 개념 부족. 다만 부록 D.7 해시 **테스트 벡터** 가 GT 성격 — NEW 갭 후보 (F-010 에 묶어 기록) |
| G-08 milestones | **부분** | 부록 C 변경 이력이 milestone 역할(v0.1 → v1.1=v2.3.7). 단 미래 milestone 없음(성숙 플래그) |
| G-09 risk_register | ⚠ | §13 열린 질문이 유사 역할. 정식 risk_register 블록은 부재 |
| G-10 open_questions | ✅ | §13 의 11개 열린 질문 → 정식 open_questions 블록 필요(G-10 재현) |
| G-11 assets | **비해당(정당)** | 플러그인 자체의 에셋 없음. 단 templates/ 디렉터리(§11.1) 는 약한 에셋 성격 |
| G-12 parameter_tuning_registry | **비해당(정당)** | 튜닝 파라미터 없음 |
| G-13 explicit_non_goals | ⚠ | §3 에 "harness-boot 가 아닌 것" 간접 서술, 명시 non-goals 블록 부재. §13 "향후" 항목 일부가 암묵 non-goal |
| G-14 data_lifecycle | **비해당(정당)** | events.log 회전(월별 분할) 이 유일. 라이브러리처럼 소거 대상 데이터 개념 약함 |
| G-15 failure_policies | **부분** | "fail-open hooks"(BR-006) · "Gate 5 실패 = blocked" 가 존재하나 체계적 카탈로그 아님 |
| G-16 observability_stack | **부분** | events.log + state.yaml 이 observability. metrics 명령(F-008) 이 집계. 전용 observability 블록은 부재 |

**기존 16 중 재현**: 12 (명시 10 + 부분 2). **정당 N/A**: 5 (G-04/G-07/G-11/G-12/G-14).

---

## 2. NEW-17~27 재현 매트릭스

| 갭 | 출처 | 재현 | 근거 |
|----|------|:----:|------|
| NEW-17 layer_architecture | VAPT | ✅ | §6 Agent-Skill-Tool + §2.3 Walking Skeleton/Gate 계층 — 명시적 3+층 구조 |
| NEW-18 execution_dag | VAPT | **부분** | /harness:sync Phase 0 → Phase 1 → Gate 0~5 순서가 DAG 성격. 명시 DAG 스키마 부재 |
| NEW-19 llm_routing | VAPT | **비해당(정당)** | harness-boot 자체는 LLM 호출 안 함. 단 Claude Code 가 에이전트/스킬 호출 시 내부 라우팅 있음 |
| NEW-20 pricing_tier | VAPT | **비해당(정당)** | OSS 플러그인, 요금제 없음 |
| NEW-21 self_evolution | VAPT | ⚠ | "hooks 가 skill 을 호출해 도구 생성" 같은 자가 진화는 없음. §10 진화 파이프라인은 사용자 spec 변경 전파를 말함 — NEW-21 과 개념 불일치 |
| NEW-22 benchmark_registry | VAPT | **부분** | 부록 D.7 해시 테스트 벡터가 사실상 벤치마크. conversion-goldens/ 도 일종 |
| NEW-23 security_profiles | VAPT | **부분** | Tool 권한 매트릭스(§6.3.1) 가 security_profile 역할. 단 naming 이 다름 |
| NEW-24 public_api | tzcalc | ✅ | **slash command 8종 + 에이전트 인터페이스 + 스킬 SKILL.md** 가 공개 API. 라이브러리의 심볼 목록과 패턴 유사 — tzcalc 와 다르게 "명령 + 에이전트 + 스킬" 3축이라 더 큼 |
| NEW-25 compatibility_matrix | tzcalc | **부분** | claude-code 버전 호환만 암묵적. 명시 호환 매트릭스 부재 |
| NEW-26 deliverable.artifacts | tzcalc | **부분** | 플러그인은 단일 아티팩트(git tag + npm?). subpath_exports 개념 약함 |
| NEW-27 bundle_size_budget | tzcalc | **비해당(정당)** | 플러그인에 크기 제약 없음 |

**NEW-17~27 재현**: 7 (명시 2 + 부분 5). **정당 N/A**: 3 (NEW-19/20/27).

---

## 3. 신규 갭 제안 — NEW-28 ~ NEW-34 (메타 도메인 고유)

### NEW-28  `command_map[]` — 명령어를 1급 시민으로

**문제**: harness-boot 의 표면 = 8개 slash command. 각 명령은 (mode, scope, input, output, side_effects, agents_invoked, events_emitted, gates_touched) 8축 속성을 가짐. 현 스키마에는 명령을 담을 자리가 없어 features[] 에 "command_xxx" 로 억지 매핑하거나 deliverable.entry_points 로 밀어냄.

**현재 우회**:
- features F-001~F-008 의 이름에 "/harness:xxx" 를 포함
- deliverable.entry_points[] 에 kind="slash-command" 로 8개 나열
- 실제 명령 간 관계(§7.5 명령어 흐름)는 free-text 서술로만 존재

**제안 스키마**:
```yaml
command_map:
  - name: "harness:spec"
    surface: "/harness:spec"
    mode_axis: ["A", "B", "R", "E"]     # 자동 분기
    input: "user_prompt + existing_spec?"
    output: "mutated spec.yaml"
    side_effects: ["spec.yaml write", "events.log append"]
    agents_invoked: ["spec-author", "spec-reviewer"]
    gates_touched: []                    # spec 수정은 gate 대상 아님
    cqs: "command"                       # vs "query"
```

**재발 조건**: 2개 이상의 명령을 가진 CLI/plugin 도메인 문서를 변환할 때 항상 재발. tzcalc 에서도 약하게 보였음(11 심볼 == 명령과 유사).

**우선도**: **HIGH**. meta 어댑터의 최우선 신설 대상.

---

### NEW-29  `agent_tool_permission_matrix`

**문제**: §6.3.1 에 12 에이전트 × 8 도구의 격자가 있지만, spec.yaml 에는 이를 담을 자리가 없음. agents 디렉터리의 개별 md 에 frontmatter 로 들어가지만 **매트릭스 전체의 일관성**(예: "Write 권한을 가진 에이전트는 spec.yaml 수정 금지") 을 선언할 필드가 없음.

**현재 우회**:
- BR-011 에 문장으로 "Tool 권한 매트릭스 상한 이하" 규칙 기입
- 실제 매트릭스 데이터는 원본 문서의 표에만 존재

**제안 스키마**:
```yaml
agent_permissions:
  - agent: "spec-author"
    tools: ["Read", "Write", "Edit", "Grep"]
    scope:
      writable: ["spec.yaml", ".harness/chapters/*.md"]
      readable: ["**/*.md", "src/**/*"]
    forbidden:
      - "state.yaml"             # 파생
      - "events.log"             # append-only, 별도 훅만
```

**재발 조건**: 멀티 에이전트 시스템(VAPT 10 에이전트, harness-boot 12 에이전트) 에서 재발. VAPT 에서는 "에이전트 간 통신은 ScanDB 만"(BR-004) 으로 우회됐으나 **권한** 은 못 담음.

**우선도**: **HIGH**.

---

### NEW-30  `gate_chain[]` — 0~N 단계 품질 관문 모델

**문제**: Gate 0~5 가 "통과 순서·skip 금지·실패 시 action" 3 속성을 가짐. features[].test_strategy 는 단일 전략만 담으므로 5단계 게이트 체인을 표현 못함.

**현재 우회**:
- BR-003 에 "Gate 5 까지 통과" 문장
- features[].acceptance_criteria 에 "Gate 5 통과 이전에는 X 금지" 같은 간접 서술

**제안 스키마**:
```yaml
gate_chain:
  - id: 0
    name: "tests"
    kind: "required"
    on_fail: "block"
    skippable_when: "prototype_mode && path in [src/examples, src/scripts]"
  - id: 3
    name: "coverage"
    kind: "required"
    on_fail: "block"
    skippable_when: "prototype_mode"
  - id: 5
    name: "runtime_smoke"
    kind: "required"
    on_fail: "feature.status = blocked"
    skippable_when: null
```

**재발 조건**: 다단계 품질 관문을 가진 CI/CD·빌드·배포 시스템 문서에서 재발. price-crawler(worker) 도 "스케줄링·스로틀링" 단계가 있어 약한 재발 신호가 있었음.

**우선도**: **HIGH** (harness-boot 핵심 철학 Gate 5 의 1급 시민화).

---

### NEW-31  `drift_catalog[]` — 불일치 분류 체계

**문제**: §10.4 에서 8종 드리프트(Spec/Code/Doc/Derived/Generated/Evidence/Anchor/Include) 를 정의하지만, 현 스키마에는 "어떤 드리프트를 탐지하고, 각각 어떤 해결 경로를 갖는지" 담을 필드가 없음. features[] 중 F-006 /harness:check 에만 간접 언급.

**제안 스키마**:
```yaml
drift_catalog:
  - kind: "Spec"
    detects: "spec.yaml 과 domain.md/architecture.yaml 간 의미 불일치"
    resolution_path: "user_manual_only"
    auto_fixable: false
  - kind: "Include"
    detects: "$include 대상 파일의 sha vs. harness.yaml.include_sources[].hash 불일치"
    resolution_path: "rerun /harness:sync"
    auto_fixable: true
```

**재발 조건**: SSoT 가 있는 모든 다중 파일 시스템. url-shortener 샘플에서도 "DB vs cache 정합" 이 약하게 유사 패턴을 보였음.

**우선도**: **MEDIUM**.

---

### NEW-32  `versioning_axes[]` — 복합 semver 추적

**문제**: harness-boot 에는 최소 4개 버전 축이 공존 — (1) 플러그인 자체 버전(v2.3.7), (2) spec.yaml schema 버전, (3) protocol 버전, (4) 개별 agent/skill 버전. tzcalc 가 도입한 NEW-24 public_api semver 축과 비슷하나 **여러 버전 축의 상호 호환 제약**까지 담아야 함.

**제안 스키마**:
```yaml
versioning_axes:
  plugin:
    current: "2.3.7"
    compat_range: ">=2.3.0 <3.0.0"
  spec_schema:
    current: "2.3.7"
    locked_to: "plugin.major_minor"     # plugin 과 동일 major.minor 강제
  protocol:
    policy: "parallel"                   # breaking change 시 v1 · v2 병행
  agent:
    policy: "per-file semver"
```

**재발 조건**: 다중 버전 축을 가진 모든 플랫폼·프레임워크. VAPT 에서도 Tool.version · Rule.version · Agent.version 3축이 있었으나 명시 안 됐음.

**우선도**: **MEDIUM**.

---

### NEW-33  `ambient_files_contract` — 생성물과 상태 파일의 수명

**문제**: harness-boot 은 `.harness/` 에 spec·state·events·hooks·protocols·chapters 등 **사용자 손을 거친 흔적과 기계 생성물이 공존**. 어느 파일이 (a) 사용자 편집 대상, (b) 기계 재생성, (c) edit-wins, (d) append-only 인지 스키마에 명시할 자리가 없음.

**현재 우회**: BR-002/BR-005/BR-013 세 문장이 개별 파일 속성을 서술.

**제안 스키마**:
```yaml
ambient_files:
  - path: ".harness/spec.yaml"
    authorship: "user"
    on_rerun: "preserve"
    write_policy: "user_only"
  - path: ".harness/state.yaml"
    authorship: "machine"
    on_rerun: "regenerate"
    write_policy: "machine_only"
  - path: ".harness/domain.md"
    authorship: "derived"
    on_rerun: "regenerate_unless_edited"
    write_policy: "edit_wins"
  - path: ".harness/events.log"
    authorship: "machine"
    on_rerun: "append"
    write_policy: "append_only"
    retention: "rotate_monthly"
```

**재발 조건**: SSoT + 파생 파일을 모두 사용자 레포에 두는 모든 도구. 기존 4 샘플에서는 산출물이 외부(서버/앱/바이너리)라 재발 안 함 → **메타 도구 고유 갭**.

**우선도**: **HIGH** (edit-wins 정책의 1급 시민화, drift 엔진 재료).

---

### NEW-34  `preamble_contract` — 투명성 출력 계약

**문제**: §7.6 의 3줄 preamble + 2행 anti-rationalization 은 harness-boot 의 **핵심 투명성 계약**이지만, 스키마상 출력 계약을 담을 자리가 없음. BR-004 · BR-014 두 문장으로 간접 기술.

**제안 스키마**:
```yaml
preamble_contract:
  lines: 3
  per_line_budget: 80                     # characters
  required_fields: ["mode", "scope", "next"]
  anti_rationalization:
    lines: 2
    position: "after_preamble"
    purpose: "prevent_llm_self_justified_skipping"
  non_tty_behavior: "same_format"         # 파이프/로그 대상
```

**재발 조건**: LLM/AI 도구가 stdout 으로 계약된 포맷을 출력해야 하는 모든 문서. 일반 웹앱/게임/라이브러리에서는 재발 안 함 → **메타 도구 고유**.

**우선도**: **MEDIUM** (현재 BR 2개로 우회 가능하나 검증 자동화가 어려움).

---

## 4. 5-샘플 재현 매트릭스 갱신 (self 추가로 6 샘플)

| 갭 | url-shortener | retro-jumper | price-crawler | vapt-apk-sast | tzcalc | **self** |
|----|:--:|:--:|:--:|:--:|:--:|:--:|
| G-01 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| G-02 | ✅ | - | ✅ | ✅ | - | ⚠ |
| G-03 | ✅ | ✅ | ✅ | ✅ | - | ✅ |
| G-04 | - | ✅ | - | ✅ | N/A | N/A |
| G-05 | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠ |
| G-06 | ✅ | - | ✅ | ✅ | - | ⚠ |
| G-07 | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| G-08 | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠ |
| G-09 | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠ |
| G-10 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| G-11 | - | ✅ | - | ✅ | N/A | N/A |
| G-12 | - | - | ✅ | ✅ | N/A | N/A |
| G-13 | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠ |
| G-14 | ✅ | - | ✅ | ✅ | N/A | N/A |
| G-15 | - | - | ✅ | ✅ | - | ⚠ |
| G-16 | - | - | ✅ | ✅ | - | ⚠ |

**G-01/10 은 6/6 domain-invariant 확증**. G-02/05/08/09/13 는 5~6건으로 거의 불변. self 에서 "N/A" 가 많음 → 메타 도메인의 도메인 외곽성 시사.

| 갭 | vapt | tzcalc | **self** |
|----|:--:|:--:|:--:|
| NEW-17 layer | ✅ | - | ✅ |
| NEW-18 dag | ✅ | - | ⚠ |
| NEW-19 llm_routing | ✅ | - | N/A |
| NEW-20 pricing | ✅ | - | N/A |
| NEW-21 self_evolution | ✅ | - | ⚠ |
| NEW-22 benchmarks | ✅ | - | ⚠ |
| NEW-23 security_profiles | ✅ | - | ⚠ |
| NEW-24 public_api | - | ✅ | ✅ |
| NEW-25 compat_matrix | - | ✅ | ⚠ |
| NEW-26 artifacts | - | ✅ | ⚠ |
| NEW-27 bundle_size | - | ✅ | N/A |
| **NEW-28 command_map** | - | - | ✅ (신규) |
| **NEW-29 agent_perm_matrix** | - | - | ✅ (신규) |
| **NEW-30 gate_chain** | - | - | ✅ (신규) |
| **NEW-31 drift_catalog** | - | - | ✅ (신규) |
| **NEW-32 versioning_axes** | - | - | ✅ (신규) |
| **NEW-33 ambient_files** | - | - | ✅ (신규) |
| **NEW-34 preamble_contract** | - | - | ✅ (신규) |

**누적**: G-01~16 + NEW-17~34 = **34개 갭 카탈로그**.

---

## 5. 어댑터 부재 상태의 영향

어댑터가 없어서 발생한 구체적 손실:

1. **도메인 관용구 부재** — 다른 샘플이 "업로드 API 는 1GB 이하"(saas/vapt), "DST ambiguous 기본값"(library/tzcalc) 처럼 도메인 체크리스트를 건졌는데, meta 에는 그런 힌트가 없어 처음부터 NEW-28~34 를 새로 발굴.
2. **비해당 원칙 판정의 비용** — P-9/P-11/P-12/P-14 가 비해당인지 재확인하는 시간 추가 소요(메타 도메인이 library 와 worker 의 특성이 섞여있어 단순 추론 불가).
3. **재발 조건 기록이 자체 누적 근거** — 각 NEW 갭이 "메타 도구에서 재발한다" 를 스스로 증명해야 했고, 이 근거가 P2.8-5 meta 어댑터 작성의 1차 자료가 됨.

---

## 6. v2.3.7 스키마 확장 우선순위 (self 반영)

| 순위 | 신규 필드 | 승격 조건 |
|:---:|-----------|-----------|
| 1 | `command_map[]` (NEW-28) | 메타/CLI/플러그인 도메인 표현성 필수 |
| 2 | `ambient_files[]` (NEW-33) | edit-wins 정책 자동화의 전제 |
| 3 | `gate_chain[]` (NEW-30) | harness-boot 의 핵심 철학(Gate 5) 1급화 |
| 4 | `agent_permissions[]` (NEW-29) | BR-011 의 런타임 검증 가능화 |
| 5 | `public_api[]` (NEW-24) | tzcalc + self 양방 반복 요청 — v2.3.8 RFC 후보 1순위 |
| 6 | `drift_catalog[]` (NEW-31) | /harness:check 스펙 명세화 |
| 7 | `preamble_contract` (NEW-34) | BR-004/014 의 자동 검증 |

v2.3.7 은 `$include` 만 추가한 소폭 스키마이므로, 위 7 필드를 한 번에 수용하는 **v2.4.0 메이저 확장** 이 합리적.

---

## 7. 자기참조 스펙의 메타 관찰

이 변환은 harness-boot v2.3.7 스키마로 **harness-boot 자체** 를 스펙화한 유일 케이스. 이로부터 드러난 자기참조 속성:

**장점**:
- 스키마의 "사고의 글 vs 실행의 글" 분리 원칙이 이 변환에서도 지켜짐 (project.* 서사 + features[].AC 계약이 선명)
- BR 14개가 도메인 규칙으로 잘 들어맞음 (BR-001~014 전부 실제 design doc 의 §2~§12 에 근거 구절 존재)

**한계(= self 에서만 드러난 부분)**:
- 스키마가 **자기 자신의 명령 표면** 을 담을 방법을 미제공 (NEW-28)
- 스키마가 **자기 자신의 생성물 파일 계약** 을 담을 방법을 미제공 (NEW-33)
- 스키마가 **자기 자신의 품질 관문 체인** 을 담을 방법을 미제공 (NEW-30)

즉, harness-boot 은 **자기 자신의 핵심 철학(§2)을 현재 스키마로 온전히 기술하지 못한다**. 이것이 이 변환의 가장 큰 발견이며, v2.4.0 확장의 근거.

---

## 8. conversion-notes.md 로 이어지는 링크

- 21 원칙 발동 여부: 다음 파일 §2 참조
- 실수 카탈로그 X-1~X-14 재발 여부: §3 참조
- 메타 도메인 고유 학습(library 어댑터 v0.1 → meta 어댑터 v0.0 draft): §4 참조
