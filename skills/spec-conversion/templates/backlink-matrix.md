# Back-link Matrix — {sample_id}

**용도**: 원본 문서의 각 섹션이 변환 산출물(spec.yaml / unrepresentable.md /
conversion-notes.md / $include 파일 / 의도적 생략) 중 어디로 갔는지 추적하는
Stage 4 검증 아티팩트. **모든 원본 섹션은 반드시 하나 이상의 destination 을
가져야 함** — "누락됨"은 허용되지 않는다. 원본이 의도적 생략일 경우 그
판단 근거를 noted_in 칼럼에 명시.

---

## 1. 원본 섹션 인벤토리

원본 문서의 모든 heading 을 항목화. 섹션 번호와 제목을 그대로 사용.

| 섹션 | 제목 | 요약(한 줄) |
|------|------|-------------|
| §1 | ... | ... |
| §2 | ... | ... |
| ... | ... | ... |

---

## 2. 섹션 → 변환 산출물 매핑

| 섹션 | 주 destination | 세부 위치 | noted_in | 매핑 품질 |
|------|----------------|-----------|----------|-----------|
| §1 | spec | `project.description` | - | ★★★★ (inline 보존) |
| §2 | spec | `domain.vocabulary[]` | - | ★★★ (일부 생략) |
| §3 | spec + notes | `constraints.architectural[]` + `P-15 후보` | - | ★★ |
| §7 | unrepresentable | `NEW-18` | execution DAG | ★ (구조 없음) |
| §14 | $include | `docs/spec/scan-db-protocol.md` | - | ★★★★★ |
| §28 | spec | `non_goals` 또는 vision | skip 근거 기록 | ★★★ |
| ... | ... | ... | ... | ... |

### 매핑 품질 점수 (★1~5)

- ★★★★★ — 구조 보존 완전 + 의미 손실 없음
- ★★★★   — 구조 보존 + 미세 요약
- ★★★    — 구조 일부 손실(예: 여러 bullet → 한 문장)
- ★★     — 자연어로만 흘림 / 임시 대응
- ★      — 자리 없음 → unrepresentable.md

---

## 3. 미매핑 섹션 (있으면 실패)

```
[ ] 미매핑 0건
```

미매핑 발견 시:
1. 해당 섹션을 다시 읽고 정찰 누락 원인 기록
2. 가능한 destination 재탐색
3. 그래도 자리 없으면 unrepresentable.md 에 새 갭 엔트리 추가
4. skill 갱신 후보로 conversion-notes.md 에 기록

---

## 4. 매핑 품질 분포

| 점수 | 섹션 수 | 비율 |
|------|---------|------|
| ★★★★★ | N | N% |
| ★★★★ | N | N% |
| ★★★ | N | N% |
| ★★ | N | N% |
| ★ | N | N% |

**목표**: ★★★ 이상 ≥ 70% (Phase 3 agent 승격 조건).  
**경고**: ★★ 이하 ≥ 30% 면 스키마 확장 우선순위 재평가.

---

## 5. 의도적 생략 (Skip with justification)

| 섹션 | 생략 근거 |
|------|-----------|
| §X.Y | "본문 아닌 cross-reference 인덱스라 무의미" |
| §Z   | "부록 중 예시 데이터만 — 스펙 대상 아님" |
