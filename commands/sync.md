---
description: spec.yaml 변경을 domain.md · architecture.yaml · harness.yaml 해시트리에 반영 — v0.2 Phase 0 전체가 scripts/sync.py 에 구현돼 있음 (Phase 1 은 /harness:work)
allowed-tools: [Read, Bash]
argument-hint: "[--dry-run] [--force]  # --dry-run: 변경 없이 plan · --force: edit-wins 무시"
---

# /harness:sync — 파생 동기화

이 명령은 `.harness/spec.yaml` (사용자 편집 SSoT) 에서 파생물 — `.harness/domain.md`, `.harness/architecture.yaml`, `.harness/harness.yaml` 해시트리 — 를 재생성합니다. Claude 는 다음 Phase 를 **정확히** 수행하고 각 Phase 후 간단히 결과를 보고하되, 전체 요약은 마지막에 1회만.

**v0.2 구현 범위**: Phase 0 (expand + hash + render) 전체. Phase 1 (Gate 0~5 실행) 은 **v0.3 `/harness:work` 로 이관** — sync 는 "파생" 에 집중, work 는 "구동" 에 집중.

## Preamble (출력 맨 앞)

```
🔄 /harness:sync · 파생 · <근거 10단어 이내>
```

예: `🔄 /harness:sync · 파생 · spec drift 감지 후 domain/arch 재생성`.

## 전제 조건

1. `.harness/spec.yaml` 존재 (없으면 중단, "먼저 /harness:init 또는 /harness:spec 실행하세요").
2. 플러그인 루트 경로 해석 성공 — `Bash: python3 $(python3 -c "import sys,os; sys.path.insert(0, os.path.expanduser('~/.claude/plugins/local-harness-marketplace/harness-boot/scripts')); import plugin_root; r=plugin_root.resolve(); print(r.root)")` (NEW-37/44 4-전략 체인). 또는 `commands/init.md §2` 의 bash 스니펫 재사용.

## Phase 0 실행 — scripts/sync.py 위임

v0.2 Phase 0 전체 로직은 `scripts/sync.py` 에 구현돼 있어 Claude 가 다음 1줄로 실행:

```bash
python3 "$PLUGIN_ROOT/scripts/sync.py" --harness-dir "$(pwd)/.harness" --json
```

- `--dry-run`: 파일 변경 없이 plan 확인.
- `--force`: edit-wins 무시하고 재생성 (domain.md / architecture.yaml 사용자 수정 덮어씀).
- JSON 출력을 받아 preamble 요약에 활용.

스크립트가 내부적으로 하는 일 (아래는 상세 계약 — 직접 실행할 필요는 없으나 문제 진단용):

## 내부 동작 참조

### 0.1 스펙 로드 + 스키마 검증 (Gate 0~1)

1. `Read .harness/spec.yaml` → YAML 파싱.
2. `docs/schemas/spec.schema.json` 로 JSONSchema 검증 (플러그인 루트에 있는 공식 스키마).
3. 실패 시 에러를 preamble 다음 줄에 출력하고 중단. 성공 시 Phase 0.2 로.

### 0.2 $include 전개 (F-009 의존)

1. `spec.yaml` 내 모든 `$include: "<path>"` 노드를 찾음. 🔒 필드 (id · version · entity name 등) 내부는 건너뜀 — `docs/templates/starter/spec.yaml.template` 의 🗒/🔒 표기를 참조.
2. 각 `$include` 를 `.harness/chapters/<path>` 에서 읽어와 치환. **깊이 1 강제** — 치환된 내용 내부의 `$include` 는 그대로 문자열 보존 (depth=2 금지).
3. 전개 실패 (파일 없음·순환·깊이 초과) 시 즉시 중단 + events.log 에 `include_expand_failed` 기록.
4. 전개 결과를 메모리 `expanded_spec` 으로 보관. 원본 `spec.yaml` 은 수정하지 않음.

### 0.3 Canonical Hashing (F-010 의존)

1. `spec.yaml` 원본 → `spec_hash_raw`.
2. `expanded_spec` → `spec_hash_expanded` (include 전개 후 해시).
3. 각 subtree (project · domain · features[*] · metadata.*) 별 `subtree_hashes` 계산.
4. 알고리즘: **Canonical YAML → Canonical JSON → SHA-256** (부록 D 명세).
5. 구현: `scripts/canonical_hash.py` 사용 (v0.2 에서 신설 예정 — 현재는 Python one-liner 로 임시 대체 가능).

### 0.4 도메인 뷰 렌더링 (`domain.md`)

1. 타겟: `.harness/domain.md`. **edit-wins** 정책 — 파일이 이미 존재하고 사용자 수정 흔적이 있으면 **덮어쓰지 않고** skip + drift 경고.
2. 사용자 수정 감지: `.harness/harness.yaml.generation.derived_from.domain_md.output_hash` 와 현재 파일 해시 비교. 다르면 `user_edit_detected: true` → skip.
3. 렌더링 소스: `spec.domain.entities[]` · `spec.domain.business_rules[]` · `metadata.source_lines.entities` (선택).
4. 출력 형식: markdown 한 페이지 — 엔티티 목록 (invariants 포함) + BR 목록 + 원본 section 앵커.

### 0.5 아키텍처 뷰 렌더링 (`architecture.yaml`)

1. 타겟: `.harness/architecture.yaml`. 동일 edit-wins 로직.
2. 소스: `spec.constraints.tech_stack` · `spec.deliverable` · `spec.features[*].modules` · `metadata.host_binding` · `metadata.contribution_points`.
3. 출력: YAML — modules 그래프 · tech stack 결정값 · contribution points · host binding.

### 0.6 `harness.yaml` 해시트리 갱신

1. `Read .harness/harness.yaml`.
2. `generation.generated_from.spec_hash` 를 0.3 의 `spec_hash_raw` 로 설정.
3. `generation.generated_from.spec_hash_expanded` 도 설정 (있을 때).
4. `generation.generated_from.subtrees` 맵 갱신.
5. `generation.derived_from.domain_md.source_hash` + `output_hash` 갱신 (0.4 에서 write 했을 때만; skip 했으면 기존 값 유지).
6. `generation.derived_from.architecture_yaml.*` 동일 규칙.
7. `generation.include_sources[]` 를 0.2 에서 전개한 chapters 목록으로 갱신.
8. `generation.drift_status` 를 `clean` 으로 (edit-wins 로 skip 된 파일이 있으면 `derived_edited`).
9. `Write .harness/harness.yaml`.

### 0.7 이벤트 로그

`.harness/events.log` 에 **1 줄** 추가 (append-only, JSON Lines):

```json
{"ts":"<ISO8601 UTC>","type":"sync_completed","plugin_version":"<from plugin.json>","phase":"0","spec_hash":"<0.3 의 spec_hash_raw>","derived":["domain.md","architecture.yaml"],"skipped":[]}
```

`skipped` 에는 edit-wins 로 덮어쓰지 않은 파일이 들어감.

## Phase 1 — 빌드·Gate 실행 (v0.3 이관)

**v0.2 에서는 미구현**. Phase 1 은 `/harness:work` 에 흡수되어:
- 피처 선택 → TDD red/green/refactor → Gate 4 (skeleton builds) → Gate 5 (runtime smoke).

`/harness:sync --with-gates` 플래그는 v0.3 이후 재검토. v0.2 sync 는 Phase 0 만.

## 최종 보고

```
🔄 /harness:sync 완료

변경 파일:
  .harness/domain.md          <생성|갱신|skip(edit-wins)>
  .harness/architecture.yaml  <동>
  .harness/harness.yaml       <해시트리 갱신>
  .harness/events.log         <append>

해시:
  spec_hash        <sha256 앞 8자>
  expanded_hash    <sha256 앞 8자 · include 있을 때만>

드리프트:
  <clean | derived_edited: <파일 목록>>

다음 단계:
  - 피처 작업: /harness:work  (v0.3)
  - 검증: /harness:check       (v0.3)
```

## 실패 조건 (fail-fast)

- `.harness/spec.yaml` 부재 → Phase 0.1 에서 중단 + 안내.
- JSONSchema 검증 실패 → 해당 path · 이유 출력 후 중단.
- $include 깊이 2 · 순환 → include 경로 dump 후 중단.
- 쓰기 권한 없음 → 사용자에게 권한 확인 요청.

## v0.2 스코프 제한

이 stub 은 **계약 레벨** 만 명시. 다음은 v0.2 구현에서 채워야 함:

- **scripts/canonical_hash.py** (Python) — Canonical YAML→JSON→SHA256. F-010 전용 테스트 벡터 (부록 D.7) 검증.
- **$include 전개 로직** — F-009 모듈. 단순 regex 치환 + 깊이 체크. Python 스크립트로 뽑을지 Claude-인라인으로 처리할지 v0.2 구현 중 결정.
- **domain.md / architecture.yaml 템플릿** — 이 sync 가 렌더링할 대상 형식. `docs/templates/derived/` 에 추가 예정.
- **edit-wins 감지** — harness.yaml 의 `output_hash` 와 현재 파일 해시 비교. F-018 에서 심화.
- **self-describe 검증** — `docs/samples/harness-boot-self/spec.yaml` 을 sync 에 입력으로 넣어 생성된 domain.md · architecture.yaml 이 정말 우리 플러그인을 묘사하는지 수동 대조 (F-003 acceptance_criteria 의 마지막 항).

## 참조

- `docs/samples/harness-boot-self/spec.yaml` — F-003 AC · tdd_focus · modules 전체. v0.2 구현의 1차 레퍼런스.
- `commands/init.md §2` — 플러그인 루트 해석 4-전략 체인. sync 에서도 동일 적용.
- `design/rfcs/v0.1.1-init-hardening.md` — NEW-37/44 패턴 재사용.
- `docs/schemas/spec.schema.json` — 스펙 검증용.
