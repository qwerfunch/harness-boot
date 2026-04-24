---
description: Drift 탐지 — Generated · Spec · Derived · Include · Evidence · Code · Doc · Anchor · Protocol · Adr 10/10 (v0.7.3+). 읽기 전용 (CQS).
allowed-tools: [Read, Bash]
argument-hint: "[--json] [--project-root DIR]  # 결과에 따라 exit 0 (clean) 또는 6 (drift)"
---

# /harness:check — 일관성 검증 (F-006)

**v0.7.3+ 범위** — 10 종 drift:

**Harness 기반 5 종**:
1. **Generated** — harness.yaml 의 필수 키 존재 검증.
2. **Spec** — spec.yaml canonical hash vs `harness.yaml.generation.spec_hash`.
3. **Derived** — domain.md / architecture.yaml 파일 해시 vs `harness.yaml.derived_from.*.output_hash` (edit-wins 감지).
4. **Include** — harness.yaml 에 기록된 `$include` 와 spec 의 현재 `$include` 비교 + chapters 파일 실존.
5. **Evidence** — state.yaml 의 `done` 피처는 evidence 최소 1 건 기록돼야 함 (BR-004).

**교차 3 종 (v0.3.8 신규)**:
6. **Code** — `features[].modules[]` 가 dict 이고 `source` 필드가 있으면 그 경로가 `project_root` 기준으로 실존하는지. 단순 문자열 모듈은 논리 식별자로 보고 skip (false positive 방지).
7. **Doc** — `project_root/CLAUDE.md` 의 `@<path>` import 타겟이 실존하는지 + 파생된 `domain.md` · `architecture.yaml` 이 0 byte 가 아닌지.
8. **Anchor** — `features[].id` 가 `^F-\d+$` 패턴인지 · ID 유일성 · `depends_on: [...]` 참조가 실제 feature 목록 내에 존재하는지.

**Protocol 1 종 (v0.3.13 신규, F-017)**:
9. **Protocol** — `.harness/protocols/*.md` 각 파일의 frontmatter `protocol_id` 가 파일명 stem 과 일치하는지 (F-017 AC-2). frontmatter 부재 · YAML 파싱 실패 · id 불일치 시 error. `protocols/` 디렉터리 부재는 clean.

**Adr 1 종 (v0.7.3 신규)**:
10. **Adr** — `decisions[].supersedes[]` 가 가리키는 ADR 의 `status` 가 `superseded` 인지. 새 ADR 이 오래된 ADR 을 대체했는데 오래된 것이 여전히 `accepted` 면 domain.md 가 모순을 렌더 (같은 결정에 두 개의 accepted). supersedes 가 존재하지 않는 ADR id 를 가리키면 dangling reference 로 warn. `decisions[]` 부재는 clean.

**CQS 불변조건**: 파일 수정 없음. spec-drift 를 찾아도 **자동 수정 제안하지 않음** (사용자 개입 필요).

## Preamble (출력 맨 앞 3 줄)

```
🔍 /harness:check · <clean|N findings> · <근거 5~10 단어>
NO skip: 10 종 drift 각각 실행 (Generated · Derived · Spec · Include · Evidence · Code · Doc · Anchor · Protocol · Adr)
NO shortcut: 자동 수정 금지 — Spec drift 는 반드시 사용자 개입 (BR-012)
```

**1 줄**: 이모지 · 명령 · 결과 요약 · 근거.
**2-3 줄 (Anti-rationalization, BR-014)**: drift 종류 skip · 자동 수정 유혹을 명시 거부.

예: `🔍 /harness:check · 2 findings · edit-wins 감지 + include 파일 부재`.

## 실행

```bash
python3 "$PLUGIN_ROOT/scripts/check.py" --harness-dir "$(pwd)/.harness" --json
python3 "$PLUGIN_ROOT/scripts/check.py" --harness-dir "$(pwd)/.harness" --project-root "$(pwd)"
```

기본 `project-root` 은 `--harness-dir` 의 부모. 다른 레이아웃 (`~/.harness` 등) 은 명시.

### 종료 코드

- `0` — clean (no drift)
- `6` — drift detected
- `2` — IO / setup error

## 출력 (human)

```
🔍 /harness:check

Checked: Generated, Derived, Spec, Include, Evidence, Code, Anchor, Doc

Findings (3):
  ⚠️  [Derived] domain.md: 해시 불일치 (edit-wins 감지) — sync --force 로 재생성 or 수동 수정 reconcile 필요
  ❌ [Include] missing-chapter.md: $include 타겟 파일 없음: chapters/missing-chapter.md
  ❌ [Anchor] F-002: depends_on 에 존재하지 않는 피처 참조: F-999
```

## Finding severity

- `warn` (⚠️) — 알림. 사용자 결정 필요 (edit-wins, 신규 include 감지 등).
- `error` (❌) — 구조 손상. 즉시 수정 필요 (필수 파일 부재, include 타겟 없음).

## 전형 사용

**정기 검증**:
```
/harness:check
→ CI 에 붙여서 drift 선감지.
```

**sync 전후 비교**:
```
/harness:sync
... 작업 ...
/harness:check
→ 파생물 사용자 수정 흔적 체크.
```

## 참조

- `scripts/check.py`.
- BR-012 (CQS): 진단 명령은 파일 수정 금지.
- Spec drift 해결: 항상 사용자 개입 필요 (자동 수정 금지).
