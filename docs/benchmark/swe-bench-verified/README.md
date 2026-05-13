# SWE-bench Verified A/B benchmark — harness-boot vs vanilla Claude Code

> Goal: **objectively measure** — when the same task is solved by (a) plain Claude Code and (b) Claude Code with harness-boot, is there a quantitative difference in output quality, token consumption, and goal achievement rate?

This directory is a **reproducible comparison framework**. Live measurements accumulate in `REPORT.md`.

---

## 1. Why SWE-bench Verified?

| Criterion | SWE-bench Verified | Alternatives |
|---|---|---|
| Authority | Used as a standard by Anthropic / Princeton — the comparison baseline for every frontier model | HumanEval (simple functions, contamination) · MBPP (outdated) · Aider polyglot (single-language only) |
| Realism | Real GitHub issue → PR. Multi-file fix. Auto-graded by whether the test suite passes | LiveCodeBench (monthly-refresh noise) · TAU-bench (domain-restricted) |
| Harness fit | **Multi-step agentic + explicit acceptance criteria + repo-level → exercises every axis where harness-boot is supposed to help** | HumanEval-style benchmarks are single-function, so harness overhead loses quantitatively |
| Externally citable | Cited by Anthropic / OpenAI / Google — README marketing value | Self-built benchmarks have no external validation |

**Why 20 tasks, not the full 500**: a full run is roughly `task_cost × model × both_approaches = $40+ × 500 ≈ $20,000`, which is impractical. A 20-task subset captures the first-order signal; expand based on what that shows.

The 20 picks in `tasks.json` are chosen for a **repo mix** (django · sympy · scikit-learn · matplotlib · sphinx · pytest · requests · flask · pylint · astropy · xarray), a **difficulty mix** (hard 3 · medium 10 · easy 7 per Verified's `difficulty` field, mapped), and a **harness-fit mix** (single-fix vs medium-step vs multi-step).

---

## 2. The four measurement axes

Each task's two attempts (vanilla · harness) write a row to `results/<approach>/<task_id>.json`. Schema:

```json
{
  "task_id": "django__django-13551",
  "approach": "vanilla" | "harness",
  "resolved": true,                          // SWE-bench harness graded the patch as PASS
  "tokens_input": 123456,                    // cumulative input tokens (vanilla: typed in from /cost; harness: auto via `harness token`)
  "tokens_output": 7890,
  "wall_time_sec": 720,
  "attempts": 1,                             // retry count on the same task
  "code_loc": 45,                            // patch +lines − −lines
  "tests_added": 3,                          // new tests authored
  "tests_passed": "all" | "partial" | "none",
  "harness_drift_catches": 0,                // harness only: number of issues caught by the 15-detector
  "harness_evidence_kinds": ["manual_check", "test", "..."],  // harness only
  "notes": "..."                             // qualitative observations
}
```

The aggregator (`scripts/aggregate.py`) computes:

- **Resolve rate** = `Σ(resolved == true) / N`
- **Mean tokens per task** = average of `tokens_input + tokens_output`
- **Mean wall time per task** = average seconds
- **Per-task delta** = distribution of `harness − vanilla`

---

## 3. Reproduction procedure

See `scripts/setup.md` for the full walkthrough. The short version:

```bash
# 1) Set up the SWE-bench harness (one-time)
git clone https://github.com/princeton-nlp/SWE-bench.git
cd SWE-bench
pip install -e .

# 2) Extract the 20-task subset
python -c "from datasets import load_dataset; import json; \
  chosen = {t['task_id'] for t in json.load(open('docs/benchmark/swe-bench-verified/tasks.json'))['tasks']}; \
  ds = load_dataset('princeton-nlp/SWE-bench_Verified', split='test').filter(lambda r: r['instance_id'] in chosen); \
  ds.to_json('verified_subset_20.jsonl')"

# 3) Vanilla attempts (iterate over every task)
bash docs/benchmark/swe-bench-verified/scripts/run-vanilla.sh

# 4) Harness attempts (iterate over every task)
bash docs/benchmark/swe-bench-verified/scripts/run-harness.sh

# 5) Aggregate + rewrite REPORT.md
python docs/benchmark/swe-bench-verified/scripts/aggregate.py \
  --results-dir docs/benchmark/swe-bench-verified/results \
  --tasks docs/benchmark/swe-bench-verified/tasks.json \
  --report docs/benchmark/swe-bench-verified/REPORT.md
```

Token measurement on each side:

- **Vanilla**: invoke Claude Code's `/cost` after every task and paste the cumulative numbers into the result JSON.
- **Harness**: `harness token --in X --out Y --model M --feature F-N` records it automatically (the F-172 + F-174 infrastructure).

---

## 4. How harness is supposed to differ (hypotheses)

For this comparison to capture signal rather than noise, the hypotheses have to be stated up front:

| Hypothesis | How to measure | Expected direction |
|---|---|---|
| Harness resolves **acceptance-criteria-heavy tasks** more often than vanilla | `tests_passed == "all"` rate | harness +5–15% |
| Harness auto-catches **drift patterns** (e.g. README vs code mismatch) | tasks where `harness_drift_catches > 0` | harness catches 0–3 more |
| Harness shortens **multi-step tasks** in tokens (auto-sync + ceremony reduces manual prompting) | mean `tokens_input + tokens_output` | harness −10 to −30% |
| Harness costs **more tokens on single-fix tasks** (ceremony overhead) | same axis | harness +10 to +30% |
| **Resolve rate is similar overall** (same model on both sides) | resolve rate | ±0–5% |

If the data contradicts the hypothesis, that's a more valuable finding. **Null results are recorded honestly**.

---

## 5. Honest limits

- **Single model · single author** (Claude). Both sides use the same model. Prompt differences between the human runs are a confounder.
- **Single time slice**. Tied to the plugin version and model release present when the run happens.
- **Benchmark contamination**. Some Verified tasks are likely in the training data. The absolute resolve rate is unreliable; the **relative difference between the two approaches** is what matters.
- **20-task subset**. 4% of the 500. Statistical power is weak. Watch the magnitude of the effect size rather than p-values.
- **Harness-fit per task**. Tasks with clear acceptance criteria favor harness; trivial typo fixes are pure overhead. The selection mix itself influences the result.

Detailed analysis: `analysis/threats-to-validity.md`.

---

## 6. Deliverable lifecycle

1. **Framework** — folder · methodology · scripts · skeleton — landed in v0.15.8 (F-173).
2. **Task list dataset-validated** — every `task_id` confirmed in Verified — landed in v0.15.10 (F-176).
3. **aggregate.py auto-write** — sentinel-aware substitution so REPORT.md actually fills row-by-row — landed in v0.15.11 (F-177).
4. **Pilot run (5 tasks)** — maintainer runs externally with the SWE-bench Docker harness, fills REPORT.md row by row.
5. **Full run (20 tasks)** — gated on pilot results. A separate cycle.
6. **README link** — once the data stabilizes, link this directory from the project root `README.md` (the "Benchmarks" section already points here at framework level).

---

## 7. Directory layout

```
docs/benchmark/swe-bench-verified/
├── README.md                    # this file — methodology + limits
├── REPORT.md                    # accumulated results (filled as runs complete)
├── tasks.json                   # the 20-task selection + selection criteria
├── results/
│   ├── vanilla/<task_id>.json
│   └── harness/<task_id>.json
├── scripts/
│   ├── run-vanilla.sh
│   ├── run-harness.sh
│   ├── aggregate.py
│   └── setup.md
└── analysis/
    └── threats-to-validity.md
```

---

## 8. Citation

When citing data from this suite:

```
harness-boot SWE-bench Verified A/B (v0.15.8+)
https://github.com/qwerfunch/harness-boot/tree/main/docs/benchmark/swe-bench-verified
```

If the comparison target is a different tool rather than vanilla Claude Code, fork into a new directory.
