---
description: Per-feature TDD lifecycle manager — activate · record gate result · gather evidence · transition to done (F-004). In Phase 1 the actual gate execution is on you (or CI); this command tracks the result.
allowed-tools: [Read, Write, Bash]
argument-hint: "<F-ID> [--gate NAME RESULT] [--evidence SUMMARY] [--complete] [--block REASON] [--current]"
---

# /harness-boot:work — feature lifecycle (F-004)

This command is the **state manager for a feature's TDD cycle**. The
gate runner executes tests, types, lints, coverage, and runtime smoke
automatically; this command activates a feature, records each gate
result in `state.yaml` + `events.log`, aggregates evidence, and
transitions the feature once the Iron Law is satisfied.

For unfamiliar terms (Walking Skeleton, Iron Law, drift, gate_0–5,
kickoff, retro, autowire, fog-clear, …), see
[`docs/glossary/BRAND_TERMS.md`](../docs/glossary/BRAND_TERMS.md).

**Automation scope**:
- `scripts/gate/runner.py` auto-detects toolchains for gate_0 (tests) ·
  gate_1 (type) · gate_2 (lint) · gate_3 (coverage) · gate_5 (runtime
  smoke) · gate_perf, with the same chain across pyproject, npm,
  Cargo, and go.mod projects.
- This command focuses on result recording, evidence aggregation, and
  Iron Law transitions — the runner does the work, work.py keeps the
  ledger.

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
harness work --harness-dir "$(pwd)/.harness"
harness work --harness-dir "$(pwd)/.harness" --json
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
harness work F-NNN --harness-dir "$(pwd)/.harness" --json
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

**Opt out**: `harness work F-NNN --no-fog` (this run only) or
`spec.metadata.fog.disabled: true` (permanent). On greenfield
(`origin: idea`) where fog adds noise, set `metadata.fog.disabled: true`.

### Record gate result (manual)

```bash
harness work F-NNN --gate gate_0 pass --note "19 unit tests" --json
```

Result ∈ {pass, fail, skipped}. On `pass`, `session.last_gate_passed`
updates.

### Auto-run a gate

```bash
harness work F-NNN --run-gate gate_0 --json
harness work F-NNN --run-gate gate_0 --override-command "pytest tests/unit" --json
harness work F-NNN --run-gate gate_0 --project-root ../other --timeout 60
```

`scripts/gate/runner.py` auto-detects the runner:

- **gate_0 (tests)**: pyproject+pytest → tests/+unittest → npm test → make test
- **gate_1 (type check)**: pyproject+mypy → pyproject+pyright → tsconfig+tsc
  → Cargo+cargo check → go.mod+go vet
- **gate_2 (lint)**: pyproject+ruff → pyproject+flake8 →
  package.json+eslint → .eslintrc+npx → Cargo+cargo clippy →
  go.mod+golangci-lint
- **gate_3 (coverage)**: pyproject+pytest-cov → coverage+pytest
  → package.json scripts.coverage → npx nyc → Cargo+tarpaulin →
  Cargo+llvm-cov → go test -cover. Threshold follows the tool's own
  config (e.g. `[tool.coverage]`).
- **gate_4 (commit check)**: `git diff --quiet && git diff --cached --quiet`
  — both working tree and staging area must be clean to pass. Without a
  git repo or `git` binary, the result is `skipped`.
- **gate_5 (runtime smoke)**: `scripts/smoke.sh` →
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
harness work F-NNN --evidence "domain smoke passes" --kind test --json
```

### Block

```bash
harness work F-NNN --block "external API not deployed yet" --kind blocker --json
```

→ status `blocked` + reason recorded as evidence + `feature_blocked`
event appended to events.log.

### Complete (transition to done)

```bash
harness work F-NNN --complete --json
harness work F-NNN --complete --hotfix-reason "prod down — redis race"
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
  · `blocker` · `hotfix` · `generic` · `trivial` · `perf_regression` ·
  `perf_resolved` · anything else — developer intent signal; Iron Law
  counts these.

**`kind=trivial`** (v0.10.7, cosmic-suika I-006 return): an intent
marker for genuinely tiny changes (one-line wiring · typo · doc-only ·
style fix). **Not** an Iron Law exemption — it still counts toward
the evidence ≥ N threshold. The marker just lets a reviewer or audit
reader see "this wasn't ceremony, this was actually trivial". Use it
on cleanup PRs where a full ceremony entry feels like overkill. For a
real emergency bypass, use `--hotfix-reason`.

**`kind=perf_regression` / `kind=perf_resolved`** (F-129, logcat-on
ISSUES-LOG return): paired markers for perf cycles. Declare
`perf_regression` after a `gate_perf` run when the just-measured
numbers actually got worse against the previous baseline — `complete()`
will then refuse to transition until you record a matching
`perf_resolved` (typically after another `gate_perf` run shows the fix
landed). Both kinds count toward the Iron Law threshold like any
declared evidence. The check is simply "what is the latest of the two
markers on this feature?" — `perf_regression` blocks, `perf_resolved`
clears. `--hotfix-reason` overrides the guard with the existing audit
trail.

### Query the active feature (CQS — read-only)

```bash
harness work --current --json
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

A full cycle for one feature (canonical commit position made explicit in v0.11.10 — F-070):

```
/harness-boot:work F-004                                 → activated
... (you write tests, then code, then refactor) ...
/harness-boot:work F-004 --gate gate_0 pass --note "19 tests green"
/harness-boot:work F-004 --gate gate_1 pass --note "type check clean"
/harness-boot:work F-004 --gate gate_2 pass
/harness-boot:work F-004 --gate gate_3 pass --note "coverage 85%"
/harness-boot:work F-004 --gate gate_5 pass --note "smoke session OK"
/harness-boot:work F-004 --evidence "full suite 237/237" --kind test
git commit -m "feat(F-004): ..."                         # active=F-004 still set; F-034 hook passes
/harness-boot:work F-004 --complete                      → done
```

**Why `git commit` between `--evidence` and `--complete`**:

- The pre-commit hook (F-034) sees `active_feature_id = F-004` at commit time and lets the staged changes through — no `HARNESS_BYPASS_PRE_COMMIT=1` escape hatch.
- The `--complete` working-tree guard (F-070) refuses to transition while the tree has uncommitted user changes. A missing commit surfaces immediately as a rejection, never silently as a hook bypass.
- `--gate gate_4 pass` is optional and can be recorded post-commit if you want the audit trail; the guard makes its core check (clean tree) automatic anyway.

(Putting `git commit` *after* `--complete` leaves `active_feature_id = null`, so the F-034 hook treats the staged changes as a work.py bypass and rejects them. The guard's whitelist mirrors F-034: `.harness/state.yaml`, `.harness/_workspace/...`, and `CHANGELOG.md` are exempt — work.py mutates them as part of the cycle itself.)

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

> **Operational detail** (conflict resolution · skip policy · feature-context payload · routing transparency · parallel-dispatch safety) is consolidated in `commands/_work-orchestration.md`. The 6-row table above stays here as the machine-checkable contract; the orchestrator agent consults the sidecar on demand.

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

> **Routing transparency, parallel dispatch, and the full safety rule** live in `commands/_work-orchestration.md`. Activate's `routed agents:` line and the dashboard `agent chain:` section render from the same source.

## Lifecycle ceremonies (sidecar)

Four ceremonies fire automatically off `src/work.ts` lifecycle:

- **Kickoff** — after `activate` (per-role concerns template).
- **Q&A File-Drop** — async inbox between agents (`.harness/_workspace/questions/`).
- **Design Review** — auto when `ui_surface.present=true` + `flows.md` ready.
- **Retro** — after `--complete` (events.log analysis + reviewer/tech-writer prose).

All four are silent · idempotent · code-driven (no LLM input required per call). Manual regen flags: `--kickoff` · `--design-review` · `--retro`. **Full spec** — auto-wire mechanism, shape detection, idempotency, participation, consumption — lives in `commands/_work-ceremonies.md`. Consult on demand.

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
