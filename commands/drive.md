---
description: Bounded autonomous loop driver — natural-language goal → researcher → planner → feature-author → execute loop, with explicit halt at every commit boundary (BR-015). Stage 1 (F-118) ships Goal primitives + read-only --status; Stage 2 (F-119) ships the full loop body.
allowed-tools: [Read, Write, Edit, Bash, Glob, Agent]
argument-hint: '"<natural-language goal>" | G-NNN | F-NNN | --status [--all] [--json] [--watch] | --resume | --plan-only | --auto-approve-{brief,all} | --max-iterations <n> | --max-hours <n> | --max-retries <n> | --dry-run | --abort [G-NNN]'
---

# /harness-boot:drive — Bounded Goal Driver (F-118 / F-119)

This command is the **autonomous-loop counterpart of `/work`**. Where
`/work` is a single-feature TDD state manager, `/drive` runs the
full *Goal* — a natural-language objective that decomposes into N
features — from researcher input through every feature's gate cycle
until each one transitions to `done`.

The loop is **bounded**, not unbounded. Iron Law (BR-004) is the
success metric, never bypassed (BR-015). The loop *escalates* on
every condition that needs human or LLM judgment instead of inventing
a continuation.

For unfamiliar terms (Walking Skeleton · Iron Law · drift · gate_0–5
· Goal · halt · CQS · …), see
[`docs/glossary/BRAND_TERMS.md`](../docs/glossary/BRAND_TERMS.md).

## Preamble (top 3 lines of every output)

```
🛠 /harness-boot:drive · <action on G-NNN> · <5–10 word reason>
NO skip: BR-004 Iron Law + BR-015 — drive escalates rather than bypasses
NO shortcut: drive cannot self-issue --hotfix-reason / git commit / gh release / marketplace ops
```

The two `NO` lines (BR-014) are **also** binding on drive itself. The
loop's behaviour is the test of its own sincerity.

## Subcommands (CLI surface)

Claude shells out to `harness drive <args>` based on the prompt.

### Status (read-only, CQS — Stage 1)

```bash
harness drive --status                          # active goal
harness drive --status G-001
harness drive --status --all                    # every goal in the spec
harness drive --status --json
harness drive --status --watch                  # tail-f-style refresh
harness drive                                   # no args = --status
```

State.yaml + spec.yaml + events.log mtimes are invariant. Empty
`goals[]` prints a clear "no goals registered yet" hint.

### Phase A — start a new Goal (Stage 2)

```bash
harness drive "<natural-language goal>"
```

1. Allocates the next `G-NNN` (monotonic, see `nextGoalId`).
2. Writes `_workspace/drive/run.yaml` with `phase: planning`.
3. Sets `state.session.active_goal_id`.
4. Halts (#1 plan_phase_approval) and prints the path of
   `_workspace/drive/goals/G-NNN/brief.md` — the file the
   **researcher agent** must write next.

### Phase A — advance through brief / plan / scaffold (Stage 2)

```bash
harness drive --resume
```

The `--resume` advance is a state machine:

| Pre-state | Trigger | Post-state |
|---|---|---|
| brief.md missing | researcher must run | halt #1 |
| brief.md present | implicit approval (file existence) | halt #1 (review then resume) |
| brief approved + plan.md missing | planner must run | halt #1 |
| plan.md present | implicit approval | halt #1 (review then resume) |
| plan approved + spec.yaml.goals[gid].feature_ids empty | feature-author must run | halt #1 |
| feature_ids non-empty | scaffolded → enter Phase B | proceeds |

`--auto-approve-brief` collapses the brief halt; `--auto-approve-all`
collapses brief + plan halts. The feature-author halt is structural
(spec.yaml has to actually be written) — no flag bypasses it.

### Phase A — plan-only

```bash
harness drive --plan-only
harness drive "<goal>" --plan-only --auto-approve-all
```

Runs only the Phase A advances and stops the moment Phase B becomes
ready. Useful when you want the goal scaffolded but not the
auto-execution to kick in.

### Phase B — autonomous execute loop (Stage 2)

After Phase A finishes (or on a subsequent `--resume`), drive enters
the per-feature loop:

1. `intentPlanner.suggest(state, spec)` — deterministic next-action.
2. Map Suggestion → `ExecutorAction` (`run_gate` · `complete` ·
   `activate` · `llm_required` · `halt`).
3. Deterministic actions execute via `src/work.ts`. LLM-required
   actions halt the loop with a clear yield message.
4. Every iteration first checks the 9 halt conditions (see below).

### Halt taxonomy (9 reasons)

| # | Reason | When | Resume hint |
|---|---|---|---|
| 1 | `plan_phase_approval` | Phase A awaits user / agent action | review brief/plan, then `harness drive --resume` |
| 2 | `commit_boundary` | feature is gate_5-pass + ≥ 1 evidence and tree is dirty | `git commit`, then resume |
| 3 | `retry_threshold` | same gate failed `--max-retries` times in a row (default 3) | fix the underlying problem, resume |
| 4 | `drift_severity_error` | `harness check` finds a `severity=error` Code/Stale/AnchorIntegration/Coverage drift | resolve drift (or `--hotfix-reason` if justified) |
| 5 | `feature_blocked` | every remaining feature in the goal is `blocked` | unblock with `harness work F-N --evidence`, resume |
| 6 | `wall_clock` | `--max-hours` exceeded | review, raise cap if needed, resume |
| 7 | `iteration_cap` | `--max-iterations` exceeded | review, resume |
| 8 | `network_failure` | researcher's WebFetch / WebSearch failed (Phase A) | restore connectivity, resume |
| 9 | `stop_file` | `_workspace/drive/STOP` exists (emergency pedal) | remove STOP, resume |

Halts always write to **three places**: `run.yaml.last_halt`,
`progress.log` (one append-only line), and `events.log`
(`drive_halted`).

### Caps

```bash
harness drive --max-iterations 30          # default 50
harness drive --max-hours 4                # default 2
harness drive --max-retries 5              # default 3
harness drive --hard-step-limit 200        # default 100 per invocation
```

`--hard-step-limit` is a per-invocation ceiling (separate from
`--max-iterations` which persists across invocations). It exists so a
single CLI call doesn't run unboundedly even when caps are loose.

### Inspecting without executing

```bash
harness drive --resume --dry-run           # next action, no execute
harness drive --resume --dry-run --json    # machine-readable plan
```

### Aborting

```bash
harness drive --abort                      # active goal
harness drive --abort G-001                # specific goal
```

Removes `_workspace/drive/run.yaml`. Goal definition stays in
spec.yaml; runtime state.yaml.goals[] entry stays in place. The user
re-runs `harness drive G-001` (or with the original prompt) to start
a new run for the same Goal.

## Slash-command orchestration (Phase A LLM contract)

The bash CLI is mechanism. **Policy** — when to call which agent —
is on Claude. The contract:

### When the user types `/harness-boot:drive "<goal>"`

1. Print the preamble.
2. `Bash: harness drive "<goal>" --json` — record the new G-NNN +
   brief path + halt #1.
3. **Dispatch the researcher agent**:

   ```
   @harness-boot:researcher
   Compose `_workspace/drive/goals/G-NNN/brief.md` for the user's
   goal "<verbatim goal title>". Stay within your contract — JTBD,
   prior art, competitors, constraints. ~250 words.
   ```

4. After the agent completes, print the brief path and halt #1
   message: *"review brief.md, then `/harness-boot:drive --resume`"*.

### When the user types `/harness-boot:drive --resume`

1. Print the preamble.
2. `Bash: harness drive --resume --json` — capture the JSON output.
3. Parse `phase` and `halt.reason`:

   - `phase: planning` + halt mentions "researcher" → already covered
     above; the user re-typed too early. Ask them to write brief.md.
   - `phase: planning` + halt mentions "review brief" → forward the
     halt verbatim (user reviews + types `--resume` again).
   - `phase: planning` + halt mentions "planner" → **dispatch the
     product-planner agent**:

     ```
     @harness-boot:product-planner
     Read `_workspace/drive/goals/G-NNN/brief.md` and compose
     `plan.md` next to it. Decide which features the goal decomposes
     into; emit a paste-ready features[] block for feature-author. ~400 words.
     ```

   - `phase: planning` + halt mentions "feature-author" → **invoke the
     feature-author skill**:

     ```
     /skill harness-boot:feature-author
     Use `_workspace/drive/goals/G-NNN/plan.md` to scaffold the
     features into both spec.yaml mirrors. Each feature gets
     `goal_id: G-NNN`. Append the goal to spec.yaml.goals[].
     feature_ids[]. **Both mirrors must stay byte-equal** —
     self_check.sh diff -q.
     ```

     After feature-author runs, the user types `--resume` again;
     drive's next advance returns `phase_b_ready` and the execute
     loop kicks in.

   - `phase: scaffolded | executing` + `halt.reason ∈ {commit_boundary,
     retry_threshold, drift_severity_error, feature_blocked, ...}`
     → forward the halt's `next step` hint to the user verbatim and
     stop. The user is the agent now.

### When `phase_b_ready` fires

The CLI auto-flows into the Phase B loop. Claude's job is
to relay the halt that eventually emerges. **Do not call agents
inside Phase B** — the deterministic actions are subprocess calls,
the LLM-required ones are halts, and the user is the next decider.

## BR-015 self-discipline

Drive is the harness's first autonomous mechanism. The charter is
**non-negotiable** even when an action *seems* obviously correct:

- **No self-issued `--hotfix-reason`.** If the Iron Law isn't met,
  drive halts. Period.
- **No `git commit / push / tag`, no `gh release create`, no
  `/plugin marketplace` calls.** Every shared-state mutation is the
  user's call. (The CLI itself doesn't expose those verbs to drive.)
- **No drift auto-resolve.** `severity=error` drift halts; the user
  fixes the underlying issue or accepts a hotfix.
- **No retry without bound.** Same gate failing 3 times in a row
  halts. The model that worked last iteration may be wrong this one.

These four bullets are tested by `tests/parity/driveExecutor.test.ts`
(self-hotfix reject) and `tests/parity/driveLoopAndPlan.test.ts`
(every halt firing on its trigger).

## Running examples

```
$ /harness-boot:drive "user can sync notes across devices"
🛠 /harness-boot:drive · planning G-001 · "user can sync notes across devices"
NO skip: BR-004 + BR-015 — escalate over bypass
NO shortcut: no self-hotfix · no git/release calls

drive: goal G-001 created. researcher should write
  /Users/.../.harness/_workspace/drive/goals/G-001/brief.md
HALT #1 (plan-phase approval) — researcher must compose brief.md.
After approval, run `harness drive --resume`.
```

```
$ /harness-boot:drive --resume                # after researcher finishes
[planner] _workspace/drive/goals/G-001/plan.md created
HALT #1 — plan.md is present. Review, then resume to dispatch feature-author.
```

```
$ /harness-boot:drive --resume                # after planner approval
[feature-author] F-200, F-201, F-202 added to spec.yaml mirrors
phase_b_ready → entering execute loop

[F-200] activate · gate_0 PASS · gate_1 PASS · gate_2 PASS · gate_3 PASS · gate_5 PASS
HALT #2 (gate_4 commit boundary) — F-200 ready to complete.
review changes, `git commit`, then `harness drive --resume`.
```

```
$ git diff --stat                                # user reviews
$ git commit -m "feat(F-200): note sync engine"
$ /harness-boot:drive --resume                   # back into the loop
[F-200] complete — Iron Law OK
[F-201] activate · gate_0 PASS · ...
```

When the last feature transitions to `done`:

```
drive: goal complete — Phase C retro generated.
       _workspace/drive/goals/G-001/retro.md
```

## Failure conditions

- `harness_dir` missing → exit 2.
- No checkpoint + no goal text supplied → exit 3 ("start with a goal").
- `--abort` with no active goal → printed warning + exit 0 (idempotent).
- Stage-2 flag on Stage-1 build (pre-F-119) → exit 3 + clear message.

## CQS — `--status` is read-only

`harness drive --status` (and the no-args form) only reads
state.yaml + spec.yaml + events.log. No write to those files; no
creation of `_workspace/drive/` either. Verified by
`tests/parity/driveStatus.test.ts` (mtime-invariant assertions).

## Coding-style note (for the agents writing brief.md / plan.md)

- Files written by the researcher / planner / feature-author live
  under `_workspace/drive/goals/<G-NNN>/`. That directory is
  **gitignored** (under `.harness/_workspace/*`) so the run details
  stay developer-local. The PR review surface is the spec.yaml
  diff, the CHANGELOG entry, and the per-feature retro under
  `_workspace/retro/F-N.md`.

- Spec references (F-NNN · BR-NNN · G-NNN) belong in **prose**, not
  in identifier names. Same rule as the rest of the codebase
  (Google Python Style Guide / TypeScript class-naming).

## Issue logging (F-027)

If drive itself surfaces friction (a halt that fires when it
shouldn't · a checkpoint shape that fails to round-trip · a halt
message that's wrong), append a row to
`.harness/_workspace/issues-log.md`. Sharing that file with the
maintainer triggers the next plugin patch (cosmic-suika ISSUES-LOG
batch return is the precedent).

## Glossary

For brand jargon, see [`docs/glossary/BRAND_TERMS.md`](../docs/glossary/BRAND_TERMS.md).
That file holds the bilingual (en + ko) gloss for terms like
*Goal* · *halt* · *Iron Law* · *commit boundary* · *Bounded Goal
Driver* · …
