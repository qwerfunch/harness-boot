# harness-boot-self — self-referential canonical spec

This directory treats **the harness-boot plugin itself** as a product and converts it through `docs/schemas/spec.schema.json`. It is the official sample. A self-bootstrap loop: the schema this spec uses is the same schema this spec describes.

| File | Role |
|---|---|
| [`spec.yaml`](spec.yaml) | The v2.3.8 canonical spec. Features, commands, gates, and ambient files for the plugin itself. |

## Why this exists

1. **Reference for v0.2-era feature design.** `/harness-boot:sync`, `/harness-boot:work`, `/harness-boot:status`, `/harness-boot:check`, the six core hooks — all of them are defined in this spec first. PRs that implement them say "Implements F-NNN per docs/samples/harness-boot-self/spec.yaml".
2. **JSONSchema stress test.** A meta-domain (a spec that takes specs as its subject) is the strongest test of how accurately the schema describes itself. Regression catches drift fast.
3. **Dogfood input for `/harness-boot:sync` after v0.2.** Copy this spec into a separate workspace and run sync — `domain.md` and `architecture.yaml` should regenerate cleanly. That round trip is the first self-describe proof.

## How to use it

**Read-only reference (current default):**
```bash
cat docs/samples/harness-boot-self/spec.yaml
```
When designing or implementing a v0.2 feature, look up the feature here for `acceptance_criteria`, `tdd_focus`, and `source_ref`.

**Dogfood (after v0.2 `/harness-boot:sync` lands):**
```bash
# Use a separate workspace — never install this on the repo itself
# (CLAUDE.md §7: "the plugin does not install onto itself").
mkdir -p ~/Developer/work/harness-boot-selfhost
cd ~/Developer/work/harness-boot-selfhost
cp /path/to/harness-boot/docs/samples/harness-boot-self/spec.yaml .harness/spec.yaml
# (init's --use-existing flag is targeted for v0.2; today's init only creates a new spec.)

# Run sync → .harness/domain.md and architecture.yaml are generated.
```

## Conversion lineage

| Round | Date | Skill | Notes |
|---|---|---|---|
| v1 | 2026-04-22 | spec-conversion v0.3 | First pass. Preserved at `tests/regression/conversion-goldens/harness-boot-self/`. |
| v2 | 2026-04-22 | spec-conversion v0.4 + meta adapter v0.2 | NEW-28 through NEW-36 gaps were structured into `metadata.extensions.*`. Stored at `design/samples/harness-boot-self/v2/` (local). |
| v2 → v2.3.8 | 2026-04-23 | `scripts/upgrade_to_2_3_8.py` | This file. `metadata.*` promoted to native fields. Only `agent_permissions` still rides under `extensions.*` — earmarked for v2.4.0. |

## Constraints

- **Do not install onto the repo's own `.harness/`** (CLAUDE.md §7: "the plugin does not install onto itself"). This spec is a public document. Real dogfood lives in a separate scratch workspace.
- **Real derivation (`/harness-boot:sync`) lands at v0.2** — today this directory is read-only.
- **`agent_permissions` still lives under `metadata.extensions.*`** — promotion to a native top-level block is queued for the v2.4.0 schema expansion (RFC `design/rfcs/v2.4.0-schema-expansion.md`).

## Related documents

- Original design doc: `design/harness-boot-design-2.3.7.md` (gitignored, ~3,500 lines).
- v2 conversion notes / backlink matrix / unrepresentable gaps: `design/samples/harness-boot-self/v2/` (gitignored).
- Schema: [`docs/schemas/spec.schema.json`](../../schemas/spec.schema.json) (v2.3.8, JSONSchema 2020-12).
- v2.3.8 promotion RFC: `design/rfcs/v2.3.8-metadata-extensions-promotion.md` (gitignored).
