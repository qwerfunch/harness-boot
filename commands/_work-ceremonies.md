# /harness-boot:work — ceremony detail (sidecar of commands/work.md)

Auto-wire mechanism · idempotency · participation · consumption spec for the four work-lifecycle ceremonies: **Kickoff · Q&A File-Drop · Design Review · Retrospective**.

> **Read scope** — every ceremony below is fired by `src/work.ts` lifecycle code, not by the LLM. LLMs invoking `/harness-boot:work` do **not** need this file in their input window; the spec stays here for the rare cases when the operator (or orchestrator agent) needs to reason about ceremony output, regenerate one manually (`--kickoff` / `--design-review` / `--retro`), or debug an idempotency miss. Consult on demand only.

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
harness work F-N --kickoff --harness-dir .harness
```

Use this when the agent lineup needs to refresh — typically because
the feature's shape changed. (Same pattern as `--design-review`.)

**Execution mechanism** (v0.7 auto-wire):

`activate()` calls `_autowire_kickoff()` → parses `spec.yaml` →
`kickoff.detect_shapes(feature)` returns the shape list →
`kickoff.generate_kickoff()` fires. Manual reproduction via the CLI:

```bash
harness work F-N --kickoff --harness-dir .harness
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
### Question (2026-04-25T10:00:00Z · from frontend-engineer)

AC-2 says "instant transition" — is that 150ms or 300ms? design
tokens/motion/session-start says 200ms but the AC doesn't pin it.

### Answer (2026-04-25T10:30:00Z · from ux-architect)

200ms across the board. flows.md's motion/session-start is canonical.
```

**Polling**:

```bash
harness inbox --harness-dir .harness --feature F-N
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
harness work F-N --design-review --harness-dir .harness
```

The `--design-review` flag bypasses condition (3) and rewrites.
Conditions (1) and (2) still apply — forcing a regeneration on a
non-UI feature still does nothing.

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
harness work F-N --retro --harness-dir .harness
```

(Same pattern as `--kickoff` and `--design-review`. All three
ceremonies behave identically.)

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
