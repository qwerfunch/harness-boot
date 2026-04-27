---
protocol_id: sync-to-work-handoff
version: "1"
direction: "sync -> work"
status: stable
fields:
  - name: spec_hash
    type: string
    required: true
  - name: merkle_root
    type: string
    required: true
  - name: derived
    type: array<string>
    required: true
  - name: plugin_version
    type: string
    required: true
---

# sync-to-work-handoff

After `/harness-boot:sync` finishes Phase 0, downstream commands like `/harness-boot:work` and `/harness-boot:check` need a way to confirm **the spec snapshot is settled**. This protocol is that handshake.

## Trigger

`scripts/sync.py` appends a `sync_completed` event to `.harness/events.log` when Phase 0 finishes. That event line *is* the protocol payload.

## Consumer contract

`scripts/work.py` and `scripts/check.py` read it as follows:

1. **`spec_hash`** is compared against `harness.yaml.generation.generated_from.spec_hash`. A mismatch reports "spec drift — sync needed".
2. **`merkle_root`** is recomputed locally with `canonical_hash.compute` and compared. A mismatch should append a `sync_failed` event.
3. **`derived`** is the list of files Phase 0 produced. The consumer checks each one exists; missing files report "derived drift".
4. **`plugin_version`** is included on every events.log entry, which lets you trace plugin-version-over-time after the fact.

## Versioning

v1 (current):
- The four fields above are stable.
- Adding optional fields stays non-breaking (`subtrees`, `skipped`, `dry_run` already ride along that way).

v2 trigger conditions (when a breaking change is unavoidable):
- Renaming a required field, or redefining its meaning.
- On the cut, write `docs/protocols/sync-to-work-handoff_v2.md`, mark v1 `status: deprecated`, and keep v1 alive for two minor releases.

## Example payload

```json
{
  "ts": "2026-04-23T10:10:37Z",
  "type": "sync_completed",
  "plugin_version": "0.3.12",
  "phase": "0",
  "spec_hash": "8446644a4381e996b4c4c60ef7c3d33877b868e85afe35d068a32dd52f60293e",
  "merkle_root": "3e0fdc5997abf12fa565126ae9732478d646f40b59eff3fda1ba5d13f4da2982",
  "derived": ["domain.md", "architecture.yaml"],
  "skipped": [],
  "dry_run": false
}
```

## Live references

- Producer: `scripts/sync.py._append_event(..., type="sync_completed")`.
- Consumers: `scripts/check.py.check_derived()` and `scripts/status.py._last_sync()`.
