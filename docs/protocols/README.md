# Protocols — inter-agent payload contracts (F-017)

## Purpose

A structured contract for the JSON payloads that flow between agents, slash commands, and hooks inside harness-boot. The line `"what I send = what you can rely on receiving"` is formalized here. Ad-hoc JSON keys are not allowed.

## Locations

| Path | Use |
|---|---|
| `docs/protocols/` (plugin source) | Default protocol library shipped with harness-boot. Documented in this README. |
| User project `.harness/protocols/` | Per-project custom protocols. `/harness-boot:init` does not create this directory — users add it when needed. `/harness-boot:check` validates the contract. |

## File format

Each protocol file is YAML frontmatter plus a markdown body.

### Required frontmatter

```yaml
---
protocol_id: sync-to-work-handoff    # must equal the file's stem (AC-2)
version: "1"                          # semver major; breaking change ships a parallel _v2
direction: "sync -> work"             # "<sender> -> <receiver>"
status: "stable" | "experimental" | "deprecated"
fields:                                # payload schema summary
  - name: "spec_hash"
    type: "string"
    required: true
  - name: "derived"
    type: "array<string>"
    required: true
---
```

### Body

- `## Trigger` — when this protocol is emitted.
- `## Consumer contract` — how the receiver reads each field.
- `## Versioning` — what to do on breaking change.
- `## Example payload` — concrete JSON.

## Versioning policy (AC-1)

**On a breaking change, ship a new file `<id>_v2.md` and keep the old one** — drift prevention by parallel versions. Existing consumers stay on v1; new consumers opt into v2. Once migration is complete, mark the old file `status: deprecated`.

**Counts as breaking:**
- Adding or removing a required field
- Changing a field's type
- Removing an enum value
- Redefining the meaning of an existing name

**Counts as non-breaking:**
- Adding an optional field
- Adding an enum value
- Wording-only edits

## Validation (AC-2)

`scripts/check.py` runs **Protocol drift (the 9th drift kind)** against every `.harness/protocols/*.md`:

1. The frontmatter parses.
2. A `protocol_id` field is present.
3. `protocol_id` equals the file's stem.

Any of those failing produces an `error`-severity finding. Run with `/harness-boot:check --harness-dir .harness`.

The plugin source's own `docs/protocols/` is **not** subject to this user-project check — plugin self-validation is a contributor responsibility.

## Default library

| File | Direction | Status |
|---|---|---|
| [sync-to-work-handoff.md](sync-to-work-handoff.md) | `/harness-boot:sync` → `/harness-boot:work` | stable |

## Adding a protocol

1. Write `docs/protocols/<new-id>.md` following the format above.
2. Frontmatter `protocol_id: <new-id>` (matches the stem).
3. Fill in the four body sections.
4. Add a row to "Default library" above.
5. Commit.

For users adding a project-specific protocol:

1. Write `.harness/protocols/<id>.md`.
2. Run `/harness-boot:check` to validate.
