# feature-author skill — manual smoke template

This directory is the canonical hand-test for the
`feature-author` skill (`skills/feature-author/SKILL.md`).

Parity tests in `tests/parity/skill-feature-author.test.ts` cover
the structural contract — frontmatter, adapter sections, template
placeholders, deterministic shape-detection. They cannot cover the
final mile: **does Claude Code actually load the skill and produce
the expected output when a real user types a real prompt?**

This template gives a contributor (or your future self) a 5-minute
procedure to verify that.

## Procedure

```bash
# 1. From a Claude Code session with the plugin installed.
#    (Install: /plugin marketplace add qwerfunch/harness-boot
#              /plugin install harness-boot@harness-boot)

# 2. Make a scratch project and seed the .harness/.
mkdir /tmp/feature-author-smoke && cd $_
mkdir .harness
cp <repo>/tests/smoke/feature-author/seed-spec.yaml .harness/spec.yaml

# 3. Open Claude Code in that directory and type ONE prompt from
#    prompts.md. The skill should auto-load (look for
#    "feature-author" in Claude's reasoning).

# 4. Compare Claude's output to the matching walkthroughs/<shape>.md.
#    Pass criteria:
#      - The shape Claude detected matches the prompt's expected shape.
#      - AC count is in the prototype range (3-4) since seed-spec.yaml
#        sets project.mode: prototype.
#      - Entry contains the shape's required block (ui_surface / entities
#        / performance_budget / no extra block).
#      - Output ends with lockstep paste instructions.

# 5. (Optional) Validate the output by appending it to seed-spec.yaml
#    and running:
#      node <repo>/bin/harness validate .harness/spec.yaml \
#           --schema <repo>/docs/schemas/spec.schema.json
#    `valid — .harness/spec.yaml` confirms a paste-ready entry.
```

## What "pass" looks like

- Skill triggers on Korean natural phrases ("로그인 기능 구현해줘",
  "X 만들어줘", "결제 추가해줘") and English ("implement X",
  "draft a feature").
- Skill picks the **stricter** shape when the prompt could match
  more than one (login form → `sensitive`, not `ui-surface`).
- Skill ends with lockstep paste instructions referencing both
  spec.yaml mirrors.

## What "fail" looks like

- Skill does not auto-load (Claude responds without referencing
  feature-author / SKILL.md). Diagnosis: `description` /
  `when_to_use` does not match the prompt's phrasing — widen them.
- Skill picks the wrong shape (e.g., `ui-surface` for a login
  form). Diagnosis: precedence rule in SKILL.md Step 1 is wrong
  or the prompt's signal words are missing from the adapter's
  "When to use" list.
- AC count is outside the project.mode range. Diagnosis: SKILL.md
  Step 2 phrasing or seed-spec.yaml's project.mode is wrong.
