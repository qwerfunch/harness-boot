# `.harness/` — harness-boot self-dogfood (DEV ONLY)

This directory is the harness-boot maintainer's **internal observation and operating space** — the plugin watching itself. **It is not a user project's spec.**

## For users

- **Your project's `.harness/`** is what `/harness-boot:init` creates in **your own cwd**. That is not this directory.
- **This `.harness/`** lives at the harness-boot repo root and is dev-only. It ships in the plugin tarball so users see it, but `/harness-boot:*` commands **never reference this path** — they always target `$(pwd)/.harness`.

## Source of truth

- `spec.yaml` is a **copy** of `docs/samples/harness-boot-self/spec.yaml` (not a symlink). The canonical file lives under `docs/samples/`. Edits go in both places at once. `scripts/self_check.sh` enforces lockstep with `diff -q`.
- `state.yaml` is maintained by `work.py`. **Do not edit by hand.** v0.3-era F-001…F-024 are frozen; F-025 onward is the live Phase 2 cycle.
- `events.log`, `harness.yaml`, `domain.md`, `architecture.yaml`, `chapters/`, and `_workspace/` are all gitignored — derived, ephemeral, or ceremony scratch.

## Phase 2 active (since 2026-04-27)

**Every new feature in this repo goes through `python3 scripts/work.py`** — the same contract we ask of cosmic-suika and other external dogfood projects.

`project.mode: prototype` — the Iron Law floor is `evidence ≥ 1` plus `gate_5 = pass`.

```
python3 scripts/work.py F-N --harness-dir .harness                       # activate
python3 scripts/work.py F-N --harness-dir .harness --run-gate gate_0     # tests
python3 scripts/work.py F-N --harness-dir .harness --run-gate gate_5     # smoke (= self_check.sh via scripts/smoke.sh shim)
python3 scripts/work.py F-N --harness-dir .harness --evidence "..."
python3 scripts/work.py F-N --harness-dir .harness --complete
```

The slash command `/harness-boot:work` **cannot live-edit from this repo** — the installed copy always wins. So the dev entry point here is always `python3 scripts/work.py` directly. See root `CLAUDE.md` §7 for the full policy.

## Verification

```
bash scripts/self_check.sh
```

Five steps (diff → validate_spec → sync --dry-run → check → commands/*.md preamble grep). Exit 0 means all green. `scripts/smoke.sh` is a thin wrapper around this — `gate_5` auto-detect picks it up.
