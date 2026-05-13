# SWE-bench Verified A/B — REPORT

> 실측 결과 누적 문서. **이 파일의 표는 실측 시점에 채워집니다.** Framework 만 landed (F-173, v0.15.8). Pilot run + full run 은 maintainer 가 외부 환경에서 진행하며 row 단위로 갱신.

**Methodology**: see [`README.md`](./README.md). **Validity threats**: see [`analysis/threats-to-validity.md`](./analysis/threats-to-validity.md).

---

## 1. 진행 상태

| Stage | 상태 | 비고 |
|---|---|---|
| Framework | ✅ landed | v0.15.8 / F-173 |
| Pilot run (5 task) | ⏳ pending | maintainer 가 외부 환경에서 실측 후 결과 row 채움 |
| Full run (20 task) | ⏳ pending | pilot 결과 보고 진행 결정 |
| README link | ⏳ pending | 결과 안정화 후 project root README 의 marketing 자리에 link |

**Last updated**: 2026-05-13 (framework landed; task list dataset-validated v0.15.10) · runs: 0 / 20

---

## 2. 결과 표 (실측 후 채움)

각 task row 의 값은 `results/<approach>/<task_id>.json` 의 schema (README §2 참조) 에서 자동 집계.

### 2.1 Per-task

| Task ID | Difficulty | Harness fit | Vanilla resolved | Vanilla tokens | Vanilla wall (s) | Harness resolved | Harness tokens | Harness wall (s) | Δ tokens | Δ resolve |
|---|---|---|---|---|---|---|---|---|---|---|
| django__django-13551 | easy | multi-step | — | — | — | — | — | — | — | — |
| django__django-10097 | easy | single-fix | — | — | — | — | — | — | — | — |
| sympy__sympy-13031 | medium | multi-step | — | — | — | — | — | — | — | — |
| sympy__sympy-13852 | hard | multi-step | — | — | — | — | — | — | — | — |
| scikit-learn__scikit-learn-10297 | medium | medium-step | — | — | — | — | — | — | — | — |
| scikit-learn__scikit-learn-10844 | medium | multi-step | — | — | — | — | — | — | — | — |
| matplotlib__matplotlib-23314 | medium | single-fix | — | — | — | — | — | — | — | — |
| matplotlib__matplotlib-14623 | medium | medium-step | — | — | — | — | — | — | — | — |
| sphinx-doc__sphinx-8721 | easy | multi-step | — | — | — | — | — | — | — | — |
| sphinx-doc__sphinx-9229 | hard | multi-step | — | — | — | — | — | — | — | — |
| pytest-dev__pytest-7236 | medium | medium-step | — | — | — | — | — | — | — | — |
| pytest-dev__pytest-6197 | hard | multi-step | — | — | — | — | — | — | — | — |
| psf__requests-1142 | easy | single-fix | — | — | — | — | — | — | — | — |
| psf__requests-2317 | easy | single-fix | — | — | — | — | — | — | — | — |
| pallets__flask-5014 | easy | medium-step | — | — | — | — | — | — | — | — |
| pylint-dev__pylint-7080 | medium | multi-step | — | — | — | — | — | — | — | — |
| astropy__astropy-12907 | medium | multi-step | — | — | — | — | — | — | — | — |
| astropy__astropy-14182 | medium | medium-step | — | — | — | — | — | — | — | — |
| pylint-dev__pylint-6386 | medium | medium-step | — | — | — | — | — | — | — | — |
| pydata__xarray-4094 | easy | medium-step | — | — | — | — | — | — | — | — |

### 2.2 Aggregate

| Metric | Vanilla | Harness | Δ (harness − vanilla) | Significance (qualitative) |
|---|---|---|---|---|
| **Resolve rate** (N=20) | —/20 (—%) | —/20 (—%) | — | — |
| **Mean tokens / task** | — | — | — | — |
| **Median tokens / task** | — | — | — | — |
| **Mean wall time (s) / task** | — | — | — | — |
| **Mean attempts / task** | — | — | — | — |
| **Mean code LOC / patch** | — | — | — | — |
| **Mean tests added / task** | — | — | — | — |

### 2.3 Harness-only signals

| Metric | Total | Per resolved task | 비고 |
|---|---|---|---|
| Drift catches | — | — | 15-detector 가 잡은 issue 수 |
| Evidence kinds used | — | — | manual_check / test / reviewer_check 등 분포 |
| Iron Law 차단 발생 | — | — | declared evidence 부족으로 reject 된 횟수 (F-172 후속 작업의 데이터) |

---

## 3. By harness-fit slice (가설 검증)

`harness_fit` axis 로 grouping:

| Slice | Tasks | Vanilla resolve | Harness resolve | Token Δ | 가설 |
|---|---|---|---|---|---|
| **multi-step** (9 tasks) | django-13551 · sympy-13031 · sympy-13852 · scikit-learn-10844 · sphinx-8721 · sphinx-9229 · pytest-6197 · pylint-7080 · astropy-12907 | — | — | — | harness 가 token / resolve 양쪽 우위 예상 |
| **medium-step** (7 tasks) | scikit-learn-10297 · matplotlib-14623 · pytest-7236 · flask-5014 · astropy-14182 · pylint-6386 · xarray-4094 | — | — | — | 비슷 또는 약간 harness 우위 |
| **single-fix** (4 tasks) | django-10097 · matplotlib-23314 · requests-1142 · requests-2317 | — | — | — | vanilla 가 약간 우위 (harness overhead) |

---

## 4. 정성적 관찰 (실측 시 채움)

### 4.1 Vanilla 시도의 흔한 실패 패턴

(실측 후 — 어떤 task 에서 fail 했는지, 왜)

### 4.2 Harness 시도의 흔한 우위 패턴

(실측 후 — drift catch / Iron Law 차단이 fail 직전에 잡은 케이스)

### 4.3 Harness 시도의 흔한 손해 패턴

(실측 후 — boilerplate / mode=product 의 evidence ≥ 3 overhead)

---

## 5. 결론 (실측 후 작성)

이 섹션은 실측 데이터 기반으로만 채움. framework 만 landed 한 시점에서는 작성 X.

기대 형식:

> Across 20 SWE-bench Verified tasks, harness-boot resolved N tasks vs vanilla M (Δ +/−%). Mean token consumption was X for vanilla and Y for harness (Δ +/−%). The largest harness wins came on multi-step tasks (mean Δ −15%); single-fix tasks favored vanilla by +Z%. Harness's drift detector caught K issues that vanilla's manual review would have missed.

null result 도 정직하게:

> No significant difference observed at N=20. Effect size too small to claim. Larger run (full 500) or different model would resolve.

---

## 6. Raw data

- `results/vanilla/*.json` — per-task vanilla 결과
- `results/harness/*.json` — per-task harness 결과
- `scripts/aggregate.py` 가 이 두 디렉터리를 읽고 §2/§3 표를 갱신

수동 갱신이 아니라 스크립트로 갱신 — 사람 손이 데이터를 만지지 않음 (BR-014 anti-rationalization).
