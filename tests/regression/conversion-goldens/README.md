# Conversion Goldens — Spec-Conversion Regression Suite

**목적**: spec-conversion skill 이 버전업될 때(v0.2 → v0.3 → ...) 동일한 원본
문서를 변환하면 **의미적으로 동일한 결과**가 나오는지 자동 검증.

**스코프**: 4 샘플 (Phase 2.5 종료 시점 기준)
- `url-shortener/` — 웹 애플리케이션 (v0.1 샘플)
- `retro-jumper/` — 게임 프로토타입 (v0.2 샘플)
- `price-crawler/` — 데이터 수집 워커 (v0.2 샘플)
- `vapt-apk-sast/` — SaaS + 보안 (v0.2 stress test, architecture 성숙도)

---

## 폴더 구조

```
tests/regression/conversion-goldens/
├── README.md                    # 이 파일
├── MANIFEST.yaml                # 골든 메타데이터 + 고정 메트릭
├── {sample}/
│   ├── source.md                # 원본 입력 (plan.md 또는 architecture.md)
│   ├── spec.yaml                # 골든 출력 1
│   └── unrepresentable.md       # 골든 출력 2
└── metrics/
    └── {sample}.metrics.json    # 각 샘플의 정량 지표 스냅샷
```

---

## 회귀 검증 워크플로

```
1. skill v0.X 로 source.md 를 재변환
2. 결과 spec.yaml / unrepresentable.md 를 골든과 비교
3. scripts/conversion_diff.py 실행 → semantic diff 출력
4. 회귀 기준(아래)을 위반하면 CI/리뷰 단계에서 블록
```

---

## 회귀 기준 (Regression Rules)

### R-1 (HARD): 집합 동치성

- 모든 샘플에서 `features[].id` 집합 동일
- `domain.entities[].name` 집합 동일
- `domain.business_rules[].id` 집합 동일
- `unrepresentable.md` 의 갭 ID 집합(`G-*`·`NEW-*`) 동일

### R-2 (HARD): 카디널리티 감소 금지

- stakeholders 수 감소 불가
- entities 수 감소 불가
- features 수 감소 불가 (신규 추가는 OK)

### R-3 (SOFT): 메트릭 비회귀

각 샘플의 `metrics/{sample}.metrics.json` 대비:
- `entity_field_coverage` ±5%p 허용
- `external_deps_coverage` ±5%p 허용
- `non_goals_coverage` ±5%p 허용
- `ac_with_numeric_constant_ratio` 증가하면 경고 (P-8 역행 신호)

### R-4 (SOFT): 갭 수습 품질

- 새 변환에서 unrepresentable.md 엔트리가 10% 이상 늘면 경고
- 기존 갭이 "자리 없음" → "구조적 보존" 으로 이동하면 PASS (긍정 신호)

---

## 업데이트 정책

Goldens 는 **사용자 edit-wins 기반으로만 갱신**한다:
- `/harness:spec --learn` 명령 구현 후(Phase 4), 사용자가 실제로 수정한 항목만 golden 에 반영
- 자동 갱신 금지 — skill 스스로 golden 을 덮어쓸 수 없다
- 수동 갱신 시: PR 제목에 `[goldens-update]` 태그 + 변경 근거 요약 필수
