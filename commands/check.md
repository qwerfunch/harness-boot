---
description: Drift 탐지 — Spec · Derived · Include · Generated · Evidence 5 종 (v0.3 범위). 읽기 전용 (CQS).
allowed-tools: [Read, Bash]
argument-hint: "[--json]  # 결과에 따라 exit 0 (clean) 또는 6 (drift)"
---

# /harness:check — 일관성 검증 (F-006)

**v0.3 범위** — 5 종 drift:
1. **Generated** — harness.yaml 의 필수 키 존재 검증.
2. **Spec** — spec.yaml canonical hash vs `harness.yaml.generation.spec_hash`.
3. **Derived** — domain.md / architecture.yaml 파일 해시 vs `harness.yaml.derived_from.*.output_hash` (edit-wins 감지).
4. **Include** — harness.yaml 에 기록된 `$include` 와 spec 의 현재 `$include` 비교 + chapters 파일 실존.
5. **Evidence** — state.yaml 의 `done` 피처는 evidence 최소 1 건 기록돼야 함 (BR-004).

**v0.4+ 범위** (미포함):
- Code drift — 실제 소스 코드와 spec.architecture 교차 검증.
- Doc drift — 별도 docs 디렉터리 변경 감지.
- Anchor drift — `source_ref` 앵커 유효성.

**CQS 불변조건**: 파일 수정 없음. spec-drift 를 찾아도 **자동 수정 제안하지 않음** (사용자 개입 필요).

## Preamble (출력 맨 앞 3 줄)

```
🔍 /harness:check · <clean|N findings> · <근거 5~10 단어>
NO skip: 5 종 drift 각각 실행 (Generated · Spec · Derived · Include · Evidence)
NO shortcut: 자동 수정 금지 — Spec drift 는 반드시 사용자 개입 (BR-012)
```

**1 줄**: 이모지 · 명령 · 결과 요약 · 근거.
**2-3 줄 (Anti-rationalization, BR-014)**: drift 종류 skip · 자동 수정 유혹을 명시 거부.

예: `🔍 /harness:check · 2 findings · edit-wins 감지 + include 파일 부재`.

## 실행

```bash
python3 "$PLUGIN_ROOT/scripts/check.py" --harness-dir "$(pwd)/.harness" --json
```

### 종료 코드

- `0` — clean (no drift)
- `6` — drift detected
- `2` — IO / setup error

## 출력 (human)

```
🔍 /harness:check

Checked: Generated, Derived, Spec, Include, Evidence

Findings (2):
  ⚠️  [Derived] domain.md: 해시 불일치 (edit-wins 감지) — sync --force 로 재생성 or 수동 수정 reconcile 필요
  ❌ [Include] missing-chapter.md: $include 타겟 파일 없음: chapters/missing-chapter.md
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
