# Unrepresentable — {sample_id}

**용도**: 원본이 제시하나 v2.3.8 스키마에 1급 시민 자리가 없는 덩어리를 분리 기록. 임시 대응(temporary workaround)과 그 품질 점수를 명시 — 나중에 스키마 확장 근거 데이터가 됨.

**v2.3.8 승격 완료 필드** (= 더 이상 이 파일에 기록 안 함, `metadata.*` 에 직접 넣을 것):
`command_map` · `ambient_files` · `host_binding` · `drift_catalog` · `versioning_axes` · `contribution_points` · `preamble_contract` · `changelog` · `gate_chain`

**v2.4.0 대기** (아직 `metadata.extensions.*`):
`agent_permissions`

---

## 1. 갭 카탈로그

각 갭은 **ID · 원본 인용 · 제안 스키마 · 임시 대응 · 품질 점수** 5열 필수.

| ID | 원본 인용 (짧게) | 제안 스키마 | 임시 대응 위치 | 품질 (★1~5) |
|----|------------------|-------------|----------------|:----------:|
| G-01 | "p95 < 100ms" | `constraints.non_functional[]` | `project.invariants` 에 문장화 | ★★ |
| G-10 | "<미결 항목 N개>" | 최상위 `open_questions[]` (이미 있음) | - | ★★★★ |
| NEW-24 | "`timezoneOf(date)` 공개" | `public_api[]` | unrepresentable + conversion-notes 표 | ★★ |

### 품질 점수 정의 (backlink-matrix 와 동일)

- ★★★★★ — 구조 보존 완전
- ★★★★  — 미세 요약
- ★★★   — 구조 일부 손실
- ★★    — 자연어로 흘림
- ★     — 자리 없음

---

## 2. 재변환 라운드 기록 (해소/잔여 판정)

v2.3.8 승격 후 **재변환**이라면, 기존 갭 중:

- **Resolved** — 이번 라운드에서 `metadata.*` 네이티브 위치로 옮겨감. 이 목록에서 제거.
- **Partial** — 일부만 수용됨 (예: ambient_files 는 들어갔지만 `authorship` 네 번째 값이 enum 에 없음).
- **Remaining** — 여전히 자리 없음.
- **N/A** — 이 샘플에는 해당 개념 자체가 없음.

| 갭 ID | 이전 판정 | 이번 판정 | 근거 |
|-------|----------|-----------|------|
| NEW-28 | Remaining (v2.3.7) | **Resolved** | `metadata.command_map[]` 에 10 엔트리 수용 |
| NEW-35 | Partial | **Resolved** | v2.3.8 `host_binding` 직접 필드 |

---

## 3. 신규 갭 후보 (이번 변환에서 발견)

| ID | 원본 인용 | 왜 기존 갭으로 포섭 안 됨 | P0/P1/P2 제안 |
|----|-----------|--------------------------|:--------------:|
| NEW-37 | ... | ... | ... |

이 섹션은 다음 차례의 v2.4.x / v2.5.x RFC 입력이 됨. Reviewer 가 복수 샘플 재현 여부를 판정.
