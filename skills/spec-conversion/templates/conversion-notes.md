# Conversion Notes — {sample_id}

**용도**: 변환 중 망설임·결정을 그 자리에서 기록. skill/어댑터/스키마 개선 재료.

---

## 0. 메타

- **원본**: `{path/to/plan.md}` ({lines}줄, {chars}자)
- **skill**: v0.5 (v2.3.8 네이티브)
- **어댑터**: `{cli|worker|game|library|meta v0.2 ...}` (+조합이면 모두 나열)
- **재변환 여부**: {초변환 | 재변환 round=N}
- **소요**: 정찰 {m}분 + 작성 {m}분 + Stage 3·4 {m}분 = 총 {m}분

---

## 1. Stage 0 — 문서 축 판정

| 축 | 판정 | 근거 (원본 §x.y 인용) |
|----|------|-----------------------|
| 성숙도 | planning / architecture / implementation | ... |
| 도메인 | cli / worker / ... (+조합) | ... |
| 저자 강조 3축 (P-21) | ① ... ② ... ③ ... | project.vision + BR.rationale 에 반영 |

---

## 2. 핵심 의사결정 (Decisions)

재현성을 위해 숫자 매기고 근거 명시.

### D-1: `<결정 제목>`

- **선택지**: A) ..., B) ..., C) ...
- **선택**: B
- **근거**: 원본 §x.y 의 "..." + 어댑터 §z 원칙 P-nn.
- **영향**: `metadata.command_map[cmd-3]` 에 `mode: query` 설정.

### D-2 ~ D-N: ...

---

## 3. 망설임 목록 (Hesitations)

해결 못해 OQ 로 넘겼거나, 임시 대응한 것들.

| # | 상황 | 임시 대응 | 후속 |
|---|------|----------|------|
| H-1 | BR 과 invariant 경계 모호 | invariants 로 넣고 rationale 에 BR 측면 부기 | OQ-n 기록 |

---

## 4. 가설·관찰 (Observations)

다음 샘플이 들어오면 확인할 가설. F-n 형식으로 번호 매김.

- **F-n**: `<가설 문장>` — 검증 방법: `<샘플 / 측정>`
- **관찰 O-n**: `<사실 진술>`

(3 샘플 누적 시 HIT/MISS 판정 표를 META-RECONVERSION-COMPARE.md 류에 추가)

---

## 5. skill/어댑터 개선 후보

이 변환에서 드러난 개선점. 다음 skill 버전업 (v0.6+) 에 반영 후보.

- [ ] P-25 후보: ...
- [ ] 어댑터 `{X}.md` §n: ...
- [ ] 템플릿 수정: ...

---

## 6. 회귀 체크리스트

변환 완료 시점에 실행:

- [ ] `python3 scripts/conversion_diff.py --sample <id>` → 0(PASS)
- [ ] `ajv validate -s docs/schemas/spec.schema.json -d .harness/spec.yaml` → OK
- [ ] `metadata.extensions.*` 에 `agent_permissions` 외 키 없음
- [ ] Stage 4 `backlink-matrix.md` 작성 · 미매핑 0 · ★★★+ ≥ 70% (planning) / ≥ 85% (architecture)
