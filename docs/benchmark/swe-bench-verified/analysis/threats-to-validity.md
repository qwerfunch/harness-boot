# Threats to Validity — SWE-bench Verified A/B

> Every factor that could weaken the credibility of this benchmark, written down on purpose. Using results as marketing narrative without knowing these is dishonest.

## Change history

- **2026-05-13 (v0.15.10 hotfix · F-176)** — Pilot prep validated the v0.15.8-shipped `tasks.json` against the actual Verified dataset (500 rows) and found 10 of 20 `task_id`s did not exist. The entire `pandas-dev/pandas` repo had 0 entries in Verified. All 10 invalid ids were replaced with verified candidates from the same repo + difficulty bucket; the pandas slot was reassigned to a second `pylint` task. This document now carries both labels (authorial `easy/medium/hard` + Verified's native `verified_difficulty`). The miss was caught on the very next cycle by the v0.15.9 audit-before-merge pattern (F-175).
- **2026-05-13 (v0.15.11 · F-177)** — `scripts/aggregate.py` had a stub non-dry-run write path that printed warnings instead of updating REPORT.md, and REPORT.md had no sentinel anchors. Both were fixed in the same cycle, and a heavily-captioned demo row (`psf__requests-2317`) was added to validate the writer end-to-end.

---

## 1. Construct validity (does the measurement axis actually measure what it claims?)

### 1.1 Does SWE-bench's "resolve" equal user-perceived value?

SWE-bench's grading rule: the PR's patch makes the hidden test pass. That means it captures:

- API contract correctness and regression-test pass-through
- but **not** code readability, maintainability, non-functional requirements (perf, a11y, security), or design fit

**Threat**: if harness produces "tests pass but the code is cleaner", SWE-bench's resolve rate shows them tied. The harness's ceremony / drift value never reaches the metric.

**Mitigation**: §2.1's `code_loc` column and §4's qualitative observations partially close the gap. But citing only the quantitative columns will mislead.

### 1.2 Token measurement accuracy

- **Vanilla**: typed in from Claude Code's `/cost`. Users forget or mistype.
- **Harness**: written via `harness token`. Whether every subagent / agent call is captured depends on the F-172 hook automation; F-174 made that automatic for `Stop` events, but transcripts still depend on Claude Code's internal JSONL schema.

**Threat**: both sides self-report. If under-reporting bias is symmetric it cancels; if asymmetric it skews the result.

**Mitigation**: `setup.md` specifies the exact moment to record (immediately after each turn). Applying the same procedure on both sides minimizes asymmetric bias.

### 1.3 "Code quality" is poorly defined

`code_loc` + `tests_added` alone is a weak proxy for quality. Lint score, type-check pass rate, cyclomatic complexity — none of these enter SWE-bench's grade.

**Threat**: if harness produces shorter, clearer code, LOC alone shows the same number.

**Mitigation**: §2.1 can grow additional metrics (cyclomatic complexity, lint warning count) later. Current framework only measures LOC. Expand once the results stabilize.

---

## 2. Internal validity (is the measurement itself accurate?)

### 2.1 Confounders

| Confounder | Effect | Mitigation |
|---|---|---|
| **Same author (Claude)** | Both vanilla and harness use the same model instance; prompt differences from the human driver are uncontrolled. | `setup.md` requires the same prompt template. Per-turn variation inside the conversation is still hard to control. |
| **Same time / model version** | Token measurement + a specific model release. Re-running in 6 months may give different numbers. | The per-task JSON carries `model`, `plugin_version`, `run_date` metadata. |
| **Order effect** | If vanilla runs before harness on the same task, the conversation accumulates context. | Each task is reset to a fresh environment (Docker / clean workdir); `setup.md` enforces this. |
| **Sample selection bias** | If `tasks.json`'s 20-pick skews toward harness-fit tasks, the result is biased. | `tasks.json`'s `selection_criteria` is explicit — fit-mix (9 multi-step / 7 medium-step / 4 single-fix). Publicly auditable. |

### 2.2 SWE-bench task-level confounds

- **Contamination**: some Verified tasks are likely in the model's training data. Don't trust the absolute resolve rate.
- **Non-deterministic grading**: hidden tests can have flakes (timing, env). A borderline task may flicker between resolve and non-resolve.

**Mitigation**: vanilla and harness use the same SWE-bench tasks, so both sides share the same confounders. Interpret **relative difference** only. Treat absolute numbers with care in external citations.

---

## 3. External validity (does this generalize?)

### 3.1 Domain generalization

The 20 tasks span 11 repos (django · sympy · scikit-learn · matplotlib · sphinx · pytest · requests · flask · pylint · astropy · xarray). **All Python · all OSS · mostly mature libraries.**

**Threat**: results may not generalize to:

- Other languages (TS / Rust / Go) — the harness toolchain auto-detect is unmeasured in those environments.
- Greenfield vs brownfield — every SWE-bench task lives on top of a mature library. The value of harness's `init --scenario idea` flow is not measured here.
- Commercial multi-feature workflows — a SWE-bench task is one issue. The harness's cumulative retro and per-cycle Iron Law validation can't manifest in a single-task experiment.

### 3.2 Time generalization

These numbers are a snapshot of the plugin at this version plus the model release present at run time. Re-measure after v1.0.

### 3.3 User generalization

Assumes the user is equally fluent in both harness and vanilla flows. Real users:

- have to learn the harness commands (`harness init` · `harness work`, etc.)
- get vanilla for free with no special learning cost

→ The harness advantage in real-world numbers may be smaller than the framework measures, because user learning cost is not accounted for.

---

## 4. Conclusion validity (how should the result be phrased honestly?)

### 4.1 Phrasing guide

- "harness is better" → risky. Always specify the axis.
- "On a 20-task SWE-bench Verified subset, mean tokens dropped by N% on multi-step tasks with harness" → OK.
- "harness is superior to vanilla" → risky. No dimensional caveat.
- "On this benchmark suite's N=20 subset, harness wins on multi-step tasks were weakly observed; full 500-task run or a different model would clarify" → OK.

### 4.2 Null-result honesty

If the measurement yields "no meaningful difference":

- That itself is a valuable finding (a process-metric win does not automatically reduce to an outcome-metric win).
- Do not spin for marketing (BR-014 anti-rationalization).
- The README marketing copy should be something like: "Outcome A/B is mixed; process-metric wins are clear" — phrased honestly.

---

## 5. Follow-up

After this framework lands, recommended next cycles to raise confidence in the results:

1. **Hook automation** (F-172 / F-174 follow-up) — auto-capture token usage at Claude Code session boundary. Removes the manual-entry confounder. F-174 already covers `Stop` events.
2. **Multi-author run** — external dogfooders (`logcat-on`, `cosmic-suika`) run the same framework. Mitigates single-author bias.
3. **Multi-model run** — compare Sonnet 4.6 · Opus 4.7 · Haiku 4.5 on the same subset. Measures whether model size flips the result.
4. **Add code-quality metrics** — lint score · cyclomatic complexity · type-check pass rate into the per-task schema.
5. **Full 500 run** — decide time/budget based on pilot outcome, then proceed.
