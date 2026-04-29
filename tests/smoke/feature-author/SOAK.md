# feature-author skill — soak decision record

## Status

**SOAKING — DO NOT MERGE PR #47 yet.**

Decision date: 2026-04-30
Soak window: 2 weeks → review on 2026-05-14
PR state: draft (locked against accidental merge)

## Why we're soaking

The skill builds cleanly (parity 497/497, schema-valid live walkthrough,
4 shape adapters, Korean natural-phrasing triggers). What it does NOT
have yet is **evidence of net value**.

Honest concerns surfaced before merge:

- 121 self-dogfood feature entries were authored without the skill —
  including F-114, F-115, F-116 in this very session. They're all
  schema-valid and shape-consistent. The skill therefore raises a
  ceiling that isn't being hit, not a floor that's being missed.
- Auto-trigger on Korean natural phrasing ("X 만들어줘", "X 추가해줘")
  is high-recall but unproven precision. False positives in
  non-harness-boot projects or in lifecycle-ops contexts (existing F-N)
  would degrade UX more than the skill helps in the new-F-N case.
- Context overhead is permanent: `description` + `when_to_use` are in
  every skill listing whether the skill fires or not. ~1k tokens
  always-on per session.
- The same value (consistent F-N shape, lockstep paste reminder)
  could be delivered as `docs/feature-authoring.md` referenced from
  CLAUDE.md — context-free until grep'd, no false-positive risk.

So we're holding the merge until we have observational data.

## What to measure

Two weeks of dogfood + (optionally) one or two external trial users.
Track manually in this file or in `events.log`-adjacent notes:

| Signal | Pass threshold | Fail threshold |
|---|---|---|
| Skill auto-load count when authoring a new F-N | ≥ 80% of new-feature attempts | < 50% — auto-trigger broken |
| False-positive auto-load (non-new-F-N context) | ≤ 1 instance / 2 weeks | ≥ 3 instances |
| F-N entry quality vs baseline (pre-skill) | Equal or better — fewer schema-rejections, fewer self_check.sh fails | Same — no measurable lift |
| User-perceived friction | Lockstep mistakes (one-mirror commits) drop or stay zero | New mirror mistakes appear |
| Lockstep cost | New maintenance burden ≤ 30 min / month | ≥ 1 hr / month adapter / template churn |

Recording: append observations under `## Observations` below as they
happen. One line per data point.

## Decision tree at 2026-05-14

After 2 weeks of soak:

- **Pass thresholds met** → merge PR #47, advance to next skill
  candidate from the recommendation thread.
- **Mixed (some pass, some fail)** → narrow the skill (e.g., demote
  auto-trigger, require explicit `/harness-boot:work feature` invoke),
  re-test 1 week.
- **Fail thresholds hit** → close PR #47 without merge. Migrate
  SKILL.md content to `docs/feature-authoring.md`, drop `skills/`
  subdir, keep `tests/smoke/feature-author/` as the doc home.

## Observations

(Append one line per skill auto-load attempt or notable interaction.
Format: `YYYY-MM-DD · context · skill fired? · outcome`.)

_(none yet — soak begins 2026-04-30)_

## Reverting if needed

If we close without merge:

```bash
git checkout main
git branch -D feat/F-114-feature-author-skill          # local
git push origin :feat/F-114-feature-author-skill       # remote (after PR close)
gh pr close 47 --comment "$(cat <<'EOF'
Closing after 2-week soak — feature-author skill did not show
measurable lift over the existing 121-example baseline. Migrating
SKILL.md content to docs/feature-authoring.md per SOAK.md
decision tree. No code regression — the cycle remains useful as
a probe of how the harness-boot self-dogfood discipline reacts
to skill-shaped additions.
EOF
)"
```

If we merge:

```bash
gh pr ready 47
# wait for CI green, then:
gh pr merge 47 --merge --auto
```

(Standard develop merge; main rebase + tag waits for explicit user
release instruction.)
