# SWE-bench Verified A/B — REPORT

> Live results ledger. **The tables in this file are filled automatically when measurements arrive.** Framework landed in v0.15.8 (F-173), task list dataset-validated in v0.15.10 (F-176), `aggregate.py` auto-write into REPORT.md actually wired up + first demo row in v0.15.11 (F-177).

**Methodology**: see [`README.md`](./README.md). **Validity threats**: see [`analysis/threats-to-validity.md`](./analysis/threats-to-validity.md).

---

## 1. Progress

| Stage | Status | Notes |
|---|---|---|
| Framework | ✅ landed | v0.15.8 / F-173 |
| Task list dataset-validated | ✅ landed | v0.15.10 / F-176 |
| `aggregate.py` auto-write | ✅ landed | v0.15.11 / F-177 |
| Pilot run (5 tasks) | ⏳ 1/5 (demo row only) | requests-2317 (same-session demo · caveats in JSON) — a real pilot still requires an external Docker environment |
| Full run (20 tasks) | ⏳ pending | Decision depends on pilot outcome |
| README link | ⏳ pending | Add to project root README "Benchmarks" section once results stabilize |

**Last updated**: 2026-05-13 · runs: 1 / 20 (1 demo)

---

## 2. Results tables (filled by `aggregate.py`)

Every row is computed by `scripts/aggregate.py` from the per-task JSON files under `results/<approach>/`. See `README.md` §2 for the JSON schema.

### 2.1 Per-task

<!-- aggregate:per-task:start -->
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
| psf__requests-2317 | easy | single-fix | logic-verified-not-test-verified | 0 | — | — | — | — | — | — |
| pallets__flask-5014 | easy | medium-step | — | — | — | — | — | — | — | — |
| pylint-dev__pylint-7080 | medium | multi-step | — | — | — | — | — | — | — | — |
| astropy__astropy-12907 | medium | multi-step | — | — | — | — | — | — | — | — |
| astropy__astropy-14182 | medium | medium-step | — | — | — | — | — | — | — | — |
| pylint-dev__pylint-6386 | medium | medium-step | — | — | — | — | — | — | — | — |
| pydata__xarray-4094 | easy | medium-step | — | — | — | — | — | — | — | — |
<!-- aggregate:per-task:end -->

### 2.2 Aggregate

<!-- aggregate:aggregate:start -->
| Metric | Vanilla | Harness | Δ (harness − vanilla) | Significance (qualitative) |
|---|---|---|---|---|
| **Resolve rate** (N=20) | 0/20 (0%) | 0/20 (0%) | +0 | — |
| **Mean tokens / task (in+out)** | 0 | — | — | — |
| **Mean wall time (s) / task** | — | — | — | — |
| **Mean attempts / task** | 1 | — | — | — |
| **Mean code LOC / patch** | 2 | — | — | — |
| **Mean tests added / task** | 0 | — | — | — |
<!-- aggregate:aggregate:end -->

### 2.3 Harness-only signals

<!-- aggregate:harness-signals:start -->
| Metric | Total | Per resolved task | Notes |
|---|---|---|---|
| Drift catches | 0 | 0.0 | issues caught by the 15-detector |
| Evidence kinds used | 0 | — | distribution: — |
| Iron Law blocks | — | — | auto-captured after the F-172 / F-174 hook automation lands |
<!-- aggregate:harness-signals:end -->

---

## 3. By harness-fit slice (hypothesis check)

Tasks grouped by their `harness_fit` axis:

| Slice | Tasks | Vanilla resolve | Harness resolve | Token Δ | Hypothesis |
|---|---|---|---|---|---|
| **multi-step** (9 tasks) | django-13551 · sympy-13031 · sympy-13852 · scikit-learn-10844 · sphinx-8721 · sphinx-9229 · pytest-6197 · pylint-7080 · astropy-12907 | — | — | — | harness wins on tokens and resolve rate |
| **medium-step** (7 tasks) | scikit-learn-10297 · matplotlib-14623 · pytest-7236 · flask-5014 · astropy-14182 · pylint-6386 · xarray-4094 | — | — | — | similar or slight harness edge |
| **single-fix** (4 tasks) | django-10097 · matplotlib-23314 · requests-1142 · requests-2317 | — | — | — | vanilla slightly ahead (harness overhead) |

---

## 4. Qualitative observations (filled during measurement)

### 4.1 Common vanilla failure patterns

(After measurement — which tasks failed, and why.)

### 4.2 Common harness wins

(After measurement — cases where the drift detector or Iron Law caught something the manual review would have missed.)

### 4.3 Common harness costs

(After measurement — boilerplate overhead, `mode=product`'s `evidence ≥ 3` ceremony cost, etc.)

---

## 5. Conclusion (written after measurement)

Only filled from real data. Not authored while the framework is the only thing that exists.

Expected format:

> Across 20 SWE-bench Verified tasks, harness-boot resolved N tasks vs vanilla M (Δ +/−%). Mean token consumption was X for vanilla and Y for harness (Δ +/−%). The largest harness wins came on multi-step tasks (mean Δ −15%); single-fix tasks favored vanilla by +Z%. The harness drift detector caught K issues that vanilla's manual review would have missed.

A null result is recorded with the same discipline:

> No significant difference observed at N=20. Effect size too small to claim. A larger run (full 500) or a different model would resolve this.

---

## 6. Raw data

- `results/vanilla/*.json` — per-task vanilla outcomes
- `results/harness/*.json` — per-task harness outcomes
- `scripts/aggregate.py` reads both directories and rewrites §2 / §3 tables in place

No human-edited tables — the script is the only writer (BR-014 anti-rationalization).
