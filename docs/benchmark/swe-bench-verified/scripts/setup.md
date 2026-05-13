# Benchmark Setup — SWE-bench Verified A/B

> Procedure for running the measurement in an external environment. The framework + scripts in this directory are fixed; the user sets up once and iterates per task.

---

## 1. Prerequisites

| Tool | Purpose | Install |
|---|---|---|
| **Python 3.10+** | SWE-bench harness | `brew install python@3.11` or system package |
| **Docker Desktop** | per-task isolation (each repo + base commit) | https://docs.docker.com/get-docker/ |
| **git** | repo clone | pre-installed on most systems |
| **harness-boot CLI** | the harness side | `node bin/harness` in this repo — already installed |
| **Claude Code (Anthropic)** | LLM surface for both sides | your own environment |
| **Model access** | Sonnet 4.6 (or your choice) | Anthropic API key or Claude Code subscription |

**Time / cost estimate**:

- Per-task wall time: 5–30 min
- Per-task model cost: $1–10 (Sonnet pricing)
- 20 tasks × 2 approaches = 40 runs × ~$3 average = **~$120**
- Total wall time: ~8–15 hours (no parallelism)

---

## 2. Install the SWE-bench harness

```bash
# Dedicated work directory
mkdir -p ~/swe-bench-ab && cd ~/swe-bench-ab

# Official SWE-bench repo
git clone https://github.com/princeton-nlp/SWE-bench.git
cd SWE-bench
pip install -e .

# Extract the Verified subset using this repo's tasks.json
python -c "
import json
from datasets import load_dataset
ds = load_dataset('princeton-nlp/SWE-bench_Verified', split='test')
with open('/path/to/harness-boot/docs/benchmark/swe-bench-verified/tasks.json') as f:
    chosen = {t['task_id'] for t in json.load(f)['tasks']}
subset = ds.filter(lambda r: r['instance_id'] in chosen)
subset.to_json('verified_subset_20.jsonl')
print(f'{len(subset)} tasks ready')
"

# Preload Docker images (each repo's base-commit environment)
python -m swebench.harness.run_evaluation \
  --instance_ids $(python -c "import json; print(' '.join(t['task_id'] for t in json.load(open('verified_subset_20.jsonl'))))") \
  --predictions_path /dev/null \
  --max_workers 2 \
  --run_id setup-warmup \
  --cache_level instance
```

This step takes ~1 hour (image download + venv build).

---

## 3. Per-task run (vanilla side)

Call `run-vanilla.sh <task_id>` for each task:

```bash
cd ~/swe-bench-ab
export TASK_ID="django__django-13551"
bash /path/to/harness-boot/docs/benchmark/swe-bench-verified/scripts/run-vanilla.sh "$TASK_ID"
```

What the script does:

1. Check the repo out at the task's `base_commit` (inside Docker).
2. Render the issue body as the initial prompt for Claude Code.
3. The human drives Claude Code through turn-by-turn natural language.
4. After each turn, record `/cost` output into the prompts log.
5. If the patch passes the SWE-bench harness test → `resolved = true`.
6. Save the result as `results/vanilla/<task_id>.json`.

**Measurement-accuracy note**: vanilla runs depend on humans remembering to read `/cost`. The checklist in §6 enforces that immediately after each turn.

---

## 4. Per-task run (harness side)

```bash
cd ~/swe-bench-ab
export TASK_ID="django__django-13551"
bash /path/to/harness-boot/docs/benchmark/swe-bench-verified/scripts/run-harness.sh "$TASK_ID"
```

Flow:

1. Check the repo out at `base_commit` (inside Docker).
2. Call `harness init` — auto-routing picks the `existing_code` scenario.
3. Register the issue body as a new feature in `spec.yaml` (e.g. `F-1`).
4. `harness work F-1` to activate.
5. Drive Claude Code with harness routing in play.
6. `harness token --in X --out Y --model M --feature F-1` immediately after each LLM call (or automatic via the F-174 Stop hook).
7. Gate + evidence + complete.
8. If the patch passes the SWE-bench test → `resolved = true`.
9. Extract token totals via `harness metrics --json` and drift catches from `events.log`.
10. Save the result as `results/harness/<task_id>.json`.

---

## 5. Aggregate

Once both sides have run all 20 tasks:

```bash
python /path/to/harness-boot/docs/benchmark/swe-bench-verified/scripts/aggregate.py \
  --results-dir /path/to/harness-boot/docs/benchmark/swe-bench-verified/results \
  --tasks /path/to/harness-boot/docs/benchmark/swe-bench-verified/tasks.json \
  --report /path/to/harness-boot/docs/benchmark/swe-bench-verified/REPORT.md
```

The script rewrites §2.1, §2.2, §2.3, and §3 of `REPORT.md` in place using sentinel anchors. §4 qualitative observations and §5 conclusion are still human-authored.

---

## 6. Token measurement checklist

Same procedure on every task, both sides:

- [ ] Just before the turn begins, run `/cost` → record `start_tokens`.
- [ ] Run the turn (N LLM calls).
- [ ] Just after the turn ends, run `/cost` → record `end_tokens`.
- [ ] `delta = end - start`.
- [ ] Vanilla: type the cumulative number into the result JSON.
- [ ] Harness: call `harness token --in delta_in --out delta_out --model M --feature F-N` immediately.

The F-174 hook auto-captures token usage on `Stop` events for harness-installed sessions. Vanilla still depends on the manual step until further automation lands.

---

## 7. Commit + PR for results

Once all 20 tasks are done and REPORT.md is regenerated:

```bash
cd /path/to/harness-boot
git checkout -b benchmark/swe-bench-results-<date>
git add docs/benchmark/swe-bench-verified/results/
git add docs/benchmark/swe-bench-verified/REPORT.md
git commit -m "benchmark: SWE-bench Verified A/B results (N=20, model=<id>)"
git push -u origin HEAD
gh pr create --base develop --title "benchmark: SWE-bench Verified A/B results"
```

After the PR is merged, add a link from the project root README's Benchmarks / Status section.

---

## 8. Troubleshooting

| Symptom | Cause | Resolution |
|---|---|---|
| Docker image download fails | network / Anthropic registry timeout | `--max_workers 1` for sequential, retry |
| Tests look like PASS but swebench grades fail | hidden-test flake | re-run the same task 2–3 times and take the majority |
| `harness token` calls do not appear in events.log | wrong `--harness-dir` path | pass `--harness-dir "$(pwd)/.harness"` as an absolute path |
| Vanilla turn finishes but `/cost` shows 0 | Claude Code cost tracking disabled | enable token tracking via `claude config` |

---

## 9. Pilot recommendation

Before running all 20 tasks, do a **5-task pilot**:

- 1 easy (matplotlib-23314)
- 3 medium (django-13551 · sphinx-8721 · scikit-learn-10297)
- 1 hard (sympy-13852)

The pilot validates the framework and lets you measure actual time + cost before committing to the full 20.
