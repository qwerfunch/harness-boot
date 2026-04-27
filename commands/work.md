---
description: Per-feature TDD lifecycle manager — activate · record gate result · gather evidence · transition to done (F-004). In Phase 1 the actual gate execution is on you (or CI); this command tracks the result.
allowed-tools: [Read, Write, Bash]
argument-hint: "<F-ID> [--gate NAME RESULT] [--evidence SUMMARY] [--complete] [--block REASON] [--current]"
---

# /harness-boot:work — feature lifecycle (F-004)

This command is the **state manager for a feature's TDD cycle**. In v0.3
scope you (or CI) run the actual gate; this command records the result in
`state.yaml` + `events.log` and transitions the feature.

For unfamiliar terms (Walking Skeleton, Iron Law, drift, gate_0–5,
kickoff, retro, autowire, fog-clear, …), see
[`docs/glossary/BRAND_TERMS.md`](../docs/glossary/BRAND_TERMS.md).

**v0.3 boundary**:
- Actual test runners · coverage computation · gate_5 runtime smoke automation
  are **out of scope** (v0.4+).
- This command focuses on result recording and state transitions.

## Preamble (top 3 lines of every output)

> Spec: see [`docs/preamble-spec.md`](../docs/preamble-spec.md) — the
> single source of truth for the convention. The block below is this
> command's instance.

```
🛠 /harness-boot:work · <action on F-ID> · <5–10 word reason>
NO skip: BR-004 Iron Law — cannot complete without gate_5=pass + evidence ≥ 1
NO shortcut: all state transitions go through scripts/work.py — no manual state.yaml edits (work.py auto-appends to events.log)
```

**Line 1**: emoji · command · `<action on F-ID>` · short reason.
**Lines 2-3 (Anti-rationalization, BR-014)**: explicit refusal to bypass
Iron Law or skip the event log.

Example: `🛠 /harness-boot:work · activate F-003 · spec changed after sync`.

## Subcommands

Claude shells out to `scripts/work.py` based on the args. Resolve `$PLUGIN_ROOT`
via the 4-strategy chain in `commands/init.md §2` (or `scripts/core/plugin_root.py`).

### Dashboard (v0.9.2 — empty call)

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" --harness-dir "$(pwd)/.harness"
python3 "$PLUGIN_ROOT/scripts/work.py" --harness-dir "$(pwd)/.harness" --json
```

With no arguments, you get a **read-only dashboard**.

```
📊 harness-boot

working on: "login flow"
  progress: 3/6 gates passed · 1 evidence entries
  blocker: a11y · Space-key behavior undefined

in progress (others):
  "dashboard"

on hold: "billing"

pending: "logout" · "settings"

next actions:
  (1) run gate_3 (recommended)
  (2) switch to another feature

Enter = 1 (recommended)
```

CQS — `state.yaml` and `events.log` mtimes don't change. The "next
actions" 1-3 list is produced deterministically by
`scripts/ui/intent_planner.py` (no LLM call): it reads the active
feature's gate progress, evidence state, and any blocker, then proposes
**one logical next step** as the recommended option. If you free-text or
issue an explicit subcommand, control routes to that branch.

### Activate

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --harness-dir "$(pwd)/.harness" --json
```

- Transitions `planned` → `in_progress` and sets `session.active_feature_id`.
- If the feature is already `done`, this becomes a read (no re-activation).

**F-037 Layer B fog-clear (auto, 2026-04-27)**: in brownfield projects
(`metadata.source.origin == "existing_code"`), activate auto-fires
fog-clear. It reconnoiters only the paths in `feature.modules[]` →
writes `.harness/chapters/area-{slug}.md`, updates
`.harness/area_index.yaml`, and appends a `fog_cleared` event to
`events.log`. The kickoff that runs in the same activate auto-references
the chapter (the "existing style context" section). Idempotent — a
second activate on the same area set produces a byte-identical chapter
and no duplicate event. User edits inside
`<!-- harness:user-edit-begin --> ... <!-- harness:user-edit-end -->`
survive regeneration.

**Opt out**: `python3 work.py F-NNN --no-fog` (this run only) or
`spec.metadata.fog.disabled: true` (permanent). On greenfield
(`origin: idea`) where fog adds noise, set `metadata.fog.disabled: true`.

### Record gate result (manual)

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --gate gate_0 pass --note "19 unit tests" --json
```

Result ∈ {pass, fail, skipped}. On `pass`, `session.last_gate_passed`
updates.

### Auto-run a gate (v0.3.1+, Phase 1)

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --run-gate gate_0 --json
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --run-gate gate_0 --override-command "pytest tests/unit" --json
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --run-gate gate_0 --project-root ../other --timeout 60
```

`scripts/gate/runner.py` auto-detects the runner:

- **gate_0 (tests)**: pyproject+pytest → tests/+unittest → npm test → make test
- **gate_1 (type check)**: pyproject+mypy → pyproject+pyright → tsconfig+tsc
  → Cargo+cargo check → go.mod+go vet
- **gate_2 (lint)**: pyproject+ruff → pyproject+flake8 →
  package.json+eslint → .eslintrc+npx → Cargo+cargo clippy →
  go.mod+golangci-lint
- **gate_3 (coverage, v0.3.5+)**: pyproject+pytest-cov → coverage+pytest
  → package.json scripts.coverage → npx nyc → Cargo+tarpaulin →
  Cargo+llvm-cov → go test -cover. Threshold follows the tool's own
  config (e.g. `[tool.coverage]`).
- **gate_4 (commit check, v0.3.6+)**: `git diff --quiet && git diff --cached --quiet`
  — both working tree and staging area must be clean to pass. Without a
  git repo or `git` binary, the result is `skipped`.
- **gate_5 (runtime smoke, v0.3.7+)**: `scripts/smoke.sh` →
  `tests/smoke/` + pytest → `tests/smoke/` + unittest → Makefile
  `smoke:` → package.json `scripts.smoke`. Runtime smoke is highly
  project-specific, so we **recommend a `harness.yaml.gate_commands.gate_5`
  override**. On detection failure the result is `skipped` (the reason
  string includes the override hint). Default timeout 600s.
- **gate_perf (performance, v0.7.3+)**: no auto-detect (perf tooling is
  diverse). `harness.yaml.gate_commands.gate_perf` or `--override-command`
  is required. On pass, the evidence summary auto-injects the feature's
  `performance_budget` (lcp_ms · inp_ms · bundle_kb · custom[]). Default
  timeout 900s.

The result records automatically; on pass, evidence is added too.
Override priority: `--override-command` → `harness.yaml.gate_commands.<gate>`
→ auto-detect.

**Current scope**: gate_0–5 + gate_perf are automated. gate_0–5 are on
the BR-004 Iron Law required path; gate_perf is invoked by the
orchestrator routing (performance-engineer) for any feature that
declares a `performance_budget`.

### Add evidence

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --evidence "domain smoke passes" --kind test --json
```

### Block

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --block "external API not deployed yet" --kind blocker --json
```

→ status `blocked` + reason recorded as evidence + `feature_blocked`
event appended to events.log.

### Complete (transition to done)

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --complete --json
python3 "$PLUGIN_ROOT/scripts/work.py" F-NNN --complete --hotfix-reason "prod down — redis race"
```

**Iron Law** (v0.9.3 — BR-004 reinforcement):

1. `gate_5` (runtime smoke) result = `pass`
2. **Declared evidence in the last 7 days** (kind != `gate_run` ·
   `gate_auto_run`) ≥ the threshold:
   - `product` mode (default): **3**
   - `prototype` mode (`spec.project.mode: prototype`): **1**
3. `--hotfix-reason "..."`: even in product mode, 1 entry is enough.
   The reason is auto-recorded as a `kind=hotfix` evidence entry, so
   the audit trail is preserved.

If the law isn't met, complete returns the reason (status unchanged,
re-callable). On pass, the feature transitions to `done`,
`active_feature_id` clears, and the `feature_done` event carries
`iron_law_mode` · `declared_count` · `required` · (when supplied)
`hotfix_reason`.

**kind taxonomy**:
- automatic: `gate_run` · `gate_auto_run` — emitted by the gate runner;
  Iron Law doesn't count these.
- declared: `test` · `manual_check` · `user_feedback` · `reviewer_check`
  · `blocker` · `hotfix` · `generic` · `trivial` · anything else —
  developer intent signal; Iron Law counts these.

**`kind=trivial`** (v0.10.7, cosmic-suika I-006 return): an intent
marker for genuinely tiny changes (one-line wiring · typo · doc-only ·
style fix). **Not** an Iron Law exemption — it still counts toward
the evidence ≥ N threshold. The marker just lets a reviewer or audit
reader see "this wasn't ceremony, this was actually trivial". Use it
on cleanup PRs where a full ceremony entry feels like overkill. For a
real emergency bypass, use `--hotfix-reason`.

### Query the active feature (CQS — read-only)

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" --current --json
```

## Coding style (read before implementing)

Python code follows the **Google Python Style Guide**. **Spec
references (F-NNN · AC-N · BR-NNN) belong in docstrings or comments
only** — never in function or class names. Pick names from the domain.

```python
# ✅
class StrictestRuleTests(unittest.TestCase):
    """BR-004: when multiple rules match, the strictest max wins."""

# ❌
class BR004_StrictestRuleTests(unittest.TestCase): ...
class AC1_CodeFormatTests(unittest.TestCase): ...
```

Details: `agents/software-engineer.md § Coding style`.

## Typical scenario

A full cycle for one feature:

```
/harness-boot:work F-004                                 → activated
... (you write tests, then code, then refactor) ...
/harness-boot:work F-004 --gate gate_0 pass --note "19 tests green"
/harness-boot:work F-004 --gate gate_1 pass --note "type check clean"
/harness-boot:work F-004 --gate gate_2 pass
/harness-boot:work F-004 --gate gate_3 pass --note "coverage 85%"
/harness-boot:work F-004 --gate gate_4 pass --note "merged"
/harness-boot:work F-004 --gate gate_5 pass --note "smoke session OK"
/harness-boot:work F-004 --evidence "full suite 237/237" --kind test
/harness-boot:work F-004 --complete                      → done
```

## Failure conditions

- harness_dir doesn't exist → stop.
- `--complete` without gate_5 pass or any evidence → action=queried with
  a reason message (not a failure; you can re-call).
- Invalid gate result → exit 3.

## Activate UX warnings (v0.7.1)

`activate` emits a stderr warning and continues (backward compat — not
a failure) in these cases:

- **ghost feature**: `spec.yaml` exists but the `F-N` you named isn't
  in it. The warning suggests registering it via `/harness-boot:work`
  or undoing with `--remove F-N`.
- **concurrent in_progress**: another feature is already `in_progress`.
  The warning lets you finish or block it before activating the new
  one — or work in parallel by ignoring the warning.

## Session pointer cleanup (v0.7.1)

```bash
/harness-boot:work --deactivate              # clears session.active_feature_id only; feature status unchanged
/harness-boot:work --remove F-99             # removes the entry from state.yaml features[] (ghost cleanup); done features are protected
```

- `--deactivate` closes the work session; you can resume the status
  later.
- `--remove` reclaims a ghost or typo entry. A `feature_removed` event
  goes to the log so the change is auditable.

## Orchestration Routing (v0.5)

The orchestrator picks the agent chain based on the feature's shape.
The table below is a **machine-checkable contract** —
`tests/unit/test_work_routing.py` parses it and asserts six rows with
the expected `shape_key` and `agent_chain` columns.

| shape_key | agent_chain |
|---|---|
| baseline-empty-vague | `@harness:researcher` → `@harness:product-planner` → `/harness-boot:work <plan.md>` |
| ui_surface.present | `@harness:ux-architect` → (`@harness:visual-designer` ∥ `@harness:audio-designer` if has_audio) → `@harness:a11y-auditor` → `@harness:frontend-engineer` (+ `@harness:software-engineer` for logic) |
| sensitive_or_auth | `@harness:security-engineer` ∥ `@harness:reviewer` (parallel audit; security BLOCK vetoes) |
| performance_budget | `@harness:performance-engineer` (binds via the v0.6 schema field; v0.5 only with an inline payload) |
| pure_domain_logic | `@harness:backend-engineer` (+ `@harness:software-engineer` as backup) |
| feature_completion | `@harness:qa-engineer` → engineers (tests) → `@harness:integrator` → `@harness:tech-writer` → `@harness:reviewer` (final) |

**Conflict resolution (orchestrator's job)**:
- `security-engineer` vs `reviewer` disagree → security BLOCK is
  **veto** (sensitivity wins).
- `ux-architect` flow vs `visual-designer` tokens → ux-architect is
  authoritative; if the disagreement repeats twice, the orchestrator
  escalates to you.
- `a11y-auditor` is read-only — it only emits BLOCK; it doesn't
  influence other agents' PASS verdicts.

**Skip policy (v0.5.1, made explicit)**:
- `security-engineer` — skip when the feature has no
  `entities[].sensitive=true` and no auth/payment surface. **Record
  the skip reason** in `.harness/state.yaml` `feature.skipped_agents[]`
  for the audit trail. Example: `"no sensitive entity, static client only"`.
- `performance-engineer` — skip when `features[].performance_budget`
  isn't declared. Same skip-record discipline.
- `audio-designer` — skip when `features[].ui_surface.has_audio=false`.
- `integrator` and `tech-writer` — **don't skip these in the completion
  chain**. Even on a tiny feature, the one-line wire-up and changelog
  entry stay their responsibility. The only allowed skip is on
  doc-only changes (`test_strategy=none`) — and even then, record the
  reason.
- Principle: **explicit skip vs. silent omission are different**. A
  skip leaves a trace in state.yaml; an omission is a bug.

**Feature context payload (orchestrator → expert)**:
When calling an agent, inline this prose in the prompt. The expert
shouldn't have to dig through spec.yaml.
```
feature_id: F-NNN
ac_summary:
  - AC-1: ...
  - AC-2: ...
modules: [...]
test_strategy: tdd | contract | property | smoke
ui_surface: {present, platforms, has_audio}  # only when present
```

**Free-text intent routing (F-038, 2026-04-27)**: the various intents
you throw at /work — *question / design / planning / implementation /
review* — **collapse into the shape keys above**. The orchestrator
calls the chain matched to the shape, so there's no separate intent
classifier; the routing falls out naturally:

| Your intent | Shape / agents |
|---|---|
| "how should I model this domain?" / "entity relationship question" | `pure_domain_logic` → `backend-engineer` (+ `software-engineer`) |
| "design this screen flow" / "review the button placement" | `ui_surface.present` → `ux-architect` → `visual-designer` → `a11y-auditor` → `frontend-engineer` |
| "review this plan" / "feature A vs B priority" | `baseline-empty-vague` (spec undecided) → `researcher` → `product-planner` |
| "performance / response-time target" | `performance_budget` → `performance-engineer` |
| "security / auth / payments" | `sensitive_or_auth` → `security-engineer` ∥ `reviewer` |
| "build it / write the code / add a test" | the engineer matched to the shape + `qa-engineer` |
| "review / sign-off / wrap up" | `feature_completion` → `qa-engineer` → engineers → `integrator` → `tech-writer` → `reviewer` |

**Routing transparency (F-038)**: right after `python3 work.py F-N`
activate, the output adds a `routed agents: <chain>` line, and the
no-args dashboard surfaces an `agent chain:` section for the active
feature. **You don't have to open kickoff.md to know which agents
this activate just engaged.** Machine-checked by
`tests/unit/test_work_routed_agents.py` and
`test_dashboard_agent_chain.py`.

**Parallel dispatch (F-039, 2026-04-27)**: when the orchestrator
emits multiple Agent tool calls in a single message, Claude Code
runs them **natively in parallel**. Only safe for read-only audits
or independent-output agents (no write conflict). The currently
declared groups:

- `sensitive_or_auth` →
  `(@harness:security-engineer ∥ @harness:reviewer)` — both are
  read-only audits; security BLOCK vetoes.
- `ui_surface.present` (has_audio=true) →
  `(@harness:visual-designer ∥ @harness:audio-designer)` — both
  depend on ux-architect's `flows.md`, write to separate output
  files (tokens.yaml · audio.yaml).

Routing notation: parallel groups are wrapped `(a ∥ b)`; sequential
steps are joined with `→`. Both the activate `routed agents:` line
and the dashboard `agent chain:` section use the same syntax.
Machine-checked by the `kickoff.PARALLEL_GROUPS` constant +
`parallel_groups_for_shapes()` helper +
`tests/unit/test_kickoff_parallel_groups.py` ·
`test_work_parallel_routing.py` · `test_dashboard_parallel.py`.
Safety rule: **before adding a new parallel group, audit for write
conflicts** — two agents writing the same file create a
last-writer-wins hazard. The orchestrator owns this check.

## Kickoff Ceremony (v0.6 + v0.8.2 idempotency)

Right after the state transition, `/harness-boot:work F-N activate`
**auto-fires** `kickoff.generate_kickoff` (v0.7 auto-wire). It only
fires when spec.yaml resolves and the feature exists; if spec.yaml is
missing, it silent-skips (backward compat). The discovery phase (when
spec.yaml is first being authored) doesn't apply.

**Idempotency (v0.8.2)**: if `.harness/_workspace/kickoff/F-N.md`
already exists, kickoff **doesn't overwrite it**. Once you (or the
orchestrator) has filled in the headings, re-activating preserves the
content. To force regeneration use the `--kickoff` flag:

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-N --kickoff --harness-dir .harness
```

Use this when the agent lineup needs to refresh — typically because
the feature's shape changed. (Same pattern as `--design-review`.)

**Execution mechanism** (v0.7 auto-wire):

`activate()` calls `_autowire_kickoff()` → parses `spec.yaml` →
`kickoff.detect_shapes(feature)` returns the shape list →
`kickoff.generate_kickoff()` fires. Manual reproduction via the CLI:

```bash
python3 "$PLUGIN_ROOT/scripts/ceremonies/kickoff.py" \
    --harness-dir .harness \
    --feature F-N \
    --shape ui_surface.present \
    --shape feature_completion \
    [--has-audio]
```

Shape detection rules (`kickoff.detect_shapes`):

- `title` · `AC` · `modules` all empty → `["baseline-empty-vague"]`
- `ui_surface.present=true` → `ui_surface.present` (+ audio-designer
  when `has_audio=true`)
- `performance_budget` declared → `performance_budget`
- `sensitive=true` or domain references a sensitive entity →
  `sensitive_or_auth`
- None of the specialty shapes → `pure_domain_logic`
- Always append `feature_completion` to the end

Python **only generates the template** and hands control back to the
orchestrator:

1. `.harness/_workspace/kickoff/F-N.md` — per-role headings with empty
   bullet slots.
2. `.harness/events.log` — `kickoff_started` appended (with the agents
   list).

Then the orchestrator calls each agent in order via prose contract:
"For F-N, give me your three concerns from your perspective. Pull
from your [Tier anchor]. 80 words max." Each response gets appended
under that role's heading.

**Participation scope**: only the shapes in the routing table that
matched. Don't summon all 14 agents. The `ROUTING_SHAPES` constant in
`kickoff.py` is the 1:1 source of truth for the table
(`test_ceremony_routing.py` enforces alignment).

**Consumption**: every later agent on this feature reads
`.harness/_workspace/kickoff/F-N.md` as part of its briefing
(cross-role empathy).

## Q&A File-Drop Protocol (v0.6)

When an agent encounters ambiguity or conflict mid-work, **don't
call another agent directly** — drop a question into the file-based
inbox. The orchestrator polls between stages.

**File convention**: `.harness/_workspace/questions/F-N--<from>--<to>.md`

```markdown
---
to: ux-architect
blocking: true
needs_reply_by: design-review
---
## Question (2026-04-25T10:00:00Z · from frontend-engineer)

AC-2 says "instant transition" — is that 150ms or 300ms? design
tokens/motion/session-start says 200ms but the AC doesn't pin it.

## Answer (2026-04-25T10:30:00Z · from ux-architect)

200ms across the board. flows.md's motion/session-start is canonical.
```

**Polling**:

```bash
python3 "$PLUGIN_ROOT/scripts/ceremonies/inbox.py" --harness-dir .harness --feature F-N
# → 🔒/⬜️ · 🔒 blocking · F-N · from → to · path
```

`--json` for machine parsing · `--all` to include answered.

**Events**: when the orchestrator sees a new question file it appends
`question_opened` to `events.log`; when an answer is appended,
`question_answered` follows (the retro PR-ε aggregates them).

**Why a file-based queue**: zero daemon · zero routing complexity,
`git grep` for history, PR diffs for review. The local-disk
equivalent of a Slack thread.

## Design Review Ceremony (v0.8 auto-wire)

Starting in v0.8 `scripts/work.py` auto-fires this ceremony. The
trigger isn't a single lifecycle event — it's a **3-condition
readiness check**, evaluated at the end of any state-mutating call
(activate · record_gate · add_evidence · run_and_record_gate).

**Auto-fire conditions (all three must hold)**:

1. `features[F-N].ui_surface.present == true` — design review is
   meaningless on non-UI features.
2. `.harness/_workspace/design/flows.md` exists — ux-architect has
   delivered.
3. `.harness/_workspace/design-review/F-N.md` doesn't exist —
   **idempotent**, fires once per feature.

When all three hold, `ceremonies.design_review.generate_design_review`
runs, producing the template + a `design_review_opened` event. If any
fails, silent skip.

**Manual regeneration** (e.g. flows.md changed and the design review
needs a refresh):

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-N --design-review --harness-dir .harness
```

The `--design-review` flag bypasses condition (3) and rewrites.
Conditions (1) and (2) still apply — forcing a regeneration on a
non-UI feature still does nothing.

**Direct CLI** (raw template only):

```bash
python3 "$PLUGIN_ROOT/scripts/ceremonies/design_review.py" \
    --harness-dir .harness --feature F-N [--has-audio]
```

**Participants**: `visual-designer` + `frontend-engineer` +
`a11y-auditor` (+ `audio-designer` when has_audio). No other agent
gets read access to flows.md (Tier policy).

**Output**: `.harness/_workspace/design-review/F-N.md` — one
concerns section per reviewer + an orchestrator "Decisions" footer.
On a second round of disagreement the orchestrator escalates.

**Event**: `design_review_opened`.

## Retrospective Ceremony (v0.6 + v0.8.7 idempotency)

Right after `/harness-boot:work F-N --complete` succeeds (gate_5 +
evidence), `scripts/work.py::complete()` **auto-fires**
`retro.generate_retro` (v0.7 auto-wire). When spec.yaml is missing,
it silent-skips (symmetric with kickoff).

**Idempotency (v0.8.7)**:

- Calling `--complete` on a feature that's already done is a no-op
  + `action=queried`. No duplicate `feature_done` ·
  `feature_retro_written` events.
- If `.harness/_workspace/retro/F-N.md` exists, the auto-fire
  doesn't overwrite — prose the orchestrator collected from
  reviewer → tech-writer survives.
- Force regeneration with `--retro`:

```bash
python3 "$PLUGIN_ROOT/scripts/work.py" F-N --retro --harness-dir .harness
```

(Same pattern as `--kickoff` and `--design-review`. All three
ceremonies behave identically.)

```bash
python3 "$PLUGIN_ROOT/scripts/ceremonies/retro.py" --harness-dir .harness --feature F-N
```

**Output**: `.harness/_workspace/retro/F-N.md`
- Machine sections (retro.py auto-fills): What Shipped · First Gate
  to Fail · Ceremonies summary (kickoff / design-review / questions
  counts).
- LLM sections (orchestrator calls reviewer → tech-writer in order):
  Risks Materialized vs plan.md · Decisions Revised · Kickoff
  Predictions Right/Wrong · Reviewer Reflection · Copy Polish.

**Author order**: reviewer drafts the **prose return** (read-only
preserved · CQS — BR-012); the orchestrator writes the draft into
the Reviewer Reflection section. Then tech-writer polishes prose
directly in Copy Polish (tech-writer has Write/Edit). Order is
fixed.

**Event**: `feature_retro_written` (with the analysis summary).

**Future use**: the retro corpus feeds cross-feature learning,
which `/harness-boot:work` consumes as input.

## References

- `scripts/work.py` — the actual implementation.
- `scripts/core/state.py` — state.yaml helper.
- `docs/samples/harness-boot-self/spec.yaml` — F-004 AC · modules.
- BR-004 (Iron Law): "NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE".
- `agents/*.md` — each expert agent's `## Context` and `## Output contract`.

## Issue logging — harness-boot improvement feedback loop (F-027)

While running this command, if you spot **friction in the
harness-boot plugin itself** (gate auto-detect failure · spec/state
mismatch · ceremony output broken · stale doc · dead reference ·
awkward UX · missing automation), append **one entry per friction**
to `.harness/_workspace/issues-log.md`. Sharing this file with the
maintainer triggers the next plugin release (cosmic-suika
I-001/I-008/I-010 → v0.10.x return is the precedent).

If the file doesn't exist, create it once with a short header
(`# harness-boot ISSUES-LOG — <project name>`).

**Entry template (markdown, append-only)**:

```markdown
## YYYY-MM-DDTHH:MM:SSZ — <one-line title>
- **Source**: /harness-boot:work [F-N]
- **Category**: ergonomics | bug | missing-feature | dead-reference | docs-stale | gate-detect
- **Severity**: blocker | annoying | trivial
- **What happened**: <1–3 lines — what Claude saw + the relevant command/file path>
- **Suggested fix**: <optional — one line if it's obvious>
```

**When not to log**: actual feature-code bugs (you record those as
F-N evidence) · plain git conflicts and other dev-environment
friction · gates that legitimately fail because your code is wrong.
When in doubt, write a one-liner with `Severity=trivial`.

**NO skip**: this section is fail-open (a logging error doesn't
block the cycle), but **if Claude saw friction and didn't write it
down**, the next user hits the same friction — discipline.

---

## Glossary

For brand jargon, see [`docs/glossary/BRAND_TERMS.md`](../docs/glossary/BRAND_TERMS.md).
That file holds the bilingual (en + ko) gloss for terms like Walking
Skeleton · Iron Law · drift · sigil · fog-clear · routed agents ·
parallel groups, with one primary-file backlink per term.
