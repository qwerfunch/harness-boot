# harness-boot — plugin development repo

> This CLAUDE.md is the context to read **when developing the plugin in this repo**.
> Don't confuse it with `docs/templates/starter/CLAUDE.md.template`, which is the separate file `/harness-boot:init` writes **into a user's project**.

## 1. What this repo is

The source of the Claude Code plugin `harness-boot`. Users install the `.harness/` skeleton into their own project with `/harness-boot:init`, then run the per-feature cycle (activate → gate → evidence → complete) through a single `/harness-boot:work` command. The v0.9.0 UX rewrite collapsed the surface to two slash commands you actually have to memorize.

- **Current release**: see [`.claude-plugin/plugin.json`](./.claude-plugin/plugin.json) `version` field (canonical). Tagged-release narrative is in [`CHANGELOG.md`](./CHANGELOG.md) (Keep a Changelog 1.1.0). Commit-level history: `git log --oneline`. The marketplace PR is held until the user explicitly green-lights it (memory: `marketplace_timing`).
- **Install path**: `/plugin marketplace add qwerfunch/harness-boot` then `/plugin install harness-boot@harness-boot`. Update with `/plugin update harness-boot@harness-boot`.
- **SemVer policy**: patch-first. Even new features ship as X.Y.Z+1. Minor and major bumps require user confirmation and are reserved for substantial milestones.
- **License**: MIT · Author: qwerfunch

## 2. Where we are

For *which release* and *what shipped in it* see [`CHANGELOG.md`](./CHANGELOG.md). The list below is the cumulative *capability inventory* — what the harness can do, not when each capability landed. Capability lines stay current as long as the underlying code stays current; release labels are deliberately omitted to keep the document evergreen.

Cumulative state:

- **Two slash commands** (`/harness-boot:init` · `/harness-boot:work`) — `init` scaffolds the `.harness/` skeleton; `work` handles no-args dashboard, natural-language intents, and direct F-ID invocation.
- **Gate automation** — `src/gate/runner.ts` auto-detects toolchains for gate_0 (tests) · gate_1 (typecheck) · gate_2 (lint) · gate_3 (coverage) · gate_5 (smoke) · gate_perf, walking pyproject → npm → Cargo → Go in that priority. **BR-004 Iron Law (gate_5 = pass + declared evidence ≥ N) is automated end-to-end.**
- **Iron Law — cumulative declared evidence + product-mode strict** — when `project.mode == product`, every recorded gate's `last_result` must be non-fail before complete is allowed. `prototype` mode keeps the lighter contract (1 declared evidence). `--hotfix-reason` is the audited bypass.
- **Drift × Iron Law gating** (F-048) — `complete()` calls `src/check.ts` first. `severity="error"` findings on the wire-integrity drift kinds reject the transition. <!-- harness:fact key=blocking_drift_kinds_count value=4 source=src/work.ts:BLOCKING_DRIFT_KINDS --> Four kinds (`Code · Stale · AnchorIntegration · Coverage`) <!-- /harness:fact --> currently block; `--hotfix-reason` bypasses with audit trail.
- **Project mode axis** — `spec.project.mode ∈ {prototype, product}` is the single switch determining the Iron Law floor, kickoff/retro template depth, and design-review autowire behavior. Unset → product (strict default).
- **Drift detection** — <!-- harness:fact key=drift_kinds_count value=13 source=src/check.ts:runCheck --> 13 kinds <!-- /harness:fact -->: Generated · Derived · Spec · Include · Evidence · Code · Anchor · Adr · Stale · AnchorIntegration · Doc · Protocol · Coverage (description-vs-fingerprint substantive coverage). Two-layer supersession metadata (`features[].supersedes` / `superseded_by`) and the archive flow.
- **Ceremony automation 4/4** — kickoff · retro · design-review · inbox; all auto-fire from `src/work.ts` lifecycle hooks (silent on failure).
- **Phase 2 self-dogfood active** — `.harness/` is the live workspace. Every new feature in this repo runs through `node bin/harness work F-N --harness-dir .harness`. See §7 for the contract.
- **Init/work observability** — the `## Issue logging` section in `commands/{init,work}.md` plus `hooks/prompt-log.sh` (UserPromptSubmit). Users accumulate `.harness/_workspace/{issues-log.md, prompts/YYYY-MM.jsonl}` → maintainer return cycle + prompt-shape corpus.
- **Scaling preparedness** — five additive fields on `features[]` (area · archived_at · archive_reason · digest · include_path) plus `tests/scale/test_scale.py` measuring 100 / 1000 / 3000 / 10000 features. Sharding utilities are scoped but not required until ~300 features.
- **TS migration cutover** — full Python → TypeScript operational rewrite. The plugin ships as a single `dist/cli/harness.bundle.mjs` (esbuild) loaded by `bin/harness`; install sites no longer need `node_modules`. Python files in `legacy/` are read-only history.
- **Drive autonomous loop** — natural-language goal → researcher → product-planner → feature-author → execute, with bounded halts (10-enum: max iterations, wall clock, blocked feature, retry threshold, gate no progress, …). Halt classes live in `src/drive/halt.ts`.
- **feature-author skill** — auto-trigger spec entry authoring on free-text feature ideas; auto-detects shape (UI / sensitive / performance / pure-domain) and emits paste-ready `features[]` blocks for both spec.yaml mirrors.

**Next-thread candidates**: see §9. **Recent shipped releases**: see [`CHANGELOG.md`](./CHANGELOG.md).

## 3. Repo layout (tracked files only)

```
.claude-plugin/
├── plugin.json                     # plugin manifest — `version` is the canonical SSoT
└── marketplace.json                # single-plugin marketplace
.harness/                           # Phase 2 active dogfood workspace (§7)
├── spec.yaml                       # copy of docs/samples/harness-boot-self/spec.yaml (diff -q enforced)
├── state.yaml                      # maintained by work.py — do not edit by hand
├── README.md                       # short note on the dogfood policy
├── domain.md · architecture.yaml   # gitignored (sync derives them)
├── harness.yaml · events.log       # gitignored
├── chapters/                       # gitignored
└── _workspace/                     # gitignored — kickoff · retro · design_review · questions
commands/                           # two slash commands (collapsed in v0.9.0)
├── init.md · work.md
agents/                             # 16 fixtures (closed in v0.8.1)
hooks/                              # hooks.json + scripts/ (shipped in v0.4)
skills/spec-conversion/             # plan.md → spec.yaml conversion skill
src/                                # TypeScript implementation (operational since v0.13.0)
├── core/ · spec/ · render/ · ui/   # subsystem trees
├── ceremonies/ · gate/ · scan/     # ceremony + gate + scan helpers
├── cli/harness.ts                  # commander-based CLI (8 subcommands)
└── work.ts · sync.ts · check.ts · status.ts · events.ts · metrics.ts
dist/cli/harness.bundle.mjs         # esbuild single-file bundle (committed for plugin install — no node_modules at install site)
bin/harness                         # Node shim that loads the bundle (auto-PATH by Claude Code)
self_check.sh                       # repo-root 5-step self-dogfood verification
legacy/scripts/                     # Python archive (read-only since v0.13.0)
                                    # — kept until external dogfood signals zero regressions
tests/parity/                       # TS parity test suite (operational)
tests/unit/ · tests/integration/    # Python tests (quarantined; reference-only)
tests/regression/conversion-goldens/   # golden samples + MANIFEST
docs/
├── schemas/spec.schema.json        # spec v2.3.8 JSONSchema (Walking Skeleton enforced + project.mode)
├── samples/harness-boot-self/      # self-referential canonical spec — `wc -l` for current size
├── templates/starter/              # the templates /harness-boot:init copies (CLAUDE.md.template, etc.)
├── glossary/BRAND_TERMS.md         # F-041 — 28 brand terms (Walking Skeleton · Iron Law · …)
├── i18n/README.md                  # F-040 — runtime locale policy
├── preamble-spec.md                # F-042 — single source for Preamble + NO skip / NO shortcut
└── archive/                        # F-042 — historical (local-install · first-run · v0.1.0 / v0.4 plans · i18n-ko-frozen-f041/)
.github/workflows/self-check.yml    # Phase 3 CI (v0.8.3) — self_check.sh per PR
README.md · CHANGELOG.md · LICENSE · CLAUDE.md (this file)
```

**Untracked** (.gitignore): `design/` · `legacy/` · `translations-ko/` · `node_modules/` · `.harness/{events.log,harness.yaml,domain.md,architecture.yaml,chapters/}` · etc.

## 4. Current git state

- **Tags**: see `git tag --sort=-version:refname` (canonical). Retroactive tags (e.g. v0.10.4) are documented in `CHANGELOG.md` where relevant. **Tags must not move.**
- **main HEAD**: `git rev-parse main` and `git log -1 main` for current pointer + message.
- **Default branch**: main (the marketplace fetch ref). Work branches follow `feat/v0.X.Y-*` / `fix/v0.X.Y-*` and merge into `develop`; `develop` fast-forwards into `main` on user-confirmed release.
- **Working tree state and in-flight branches**: `git status` and `gh pr list --state open` are the SSoT — this document does not enumerate them. In-progress F-IDs live in [`.harness/state.yaml`](./.harness/state.yaml) `features[].status==in_progress`.
- **Next-thread candidates**: see §9.

## 5. Recent commit context

**Source of truth**: [`CHANGELOG.md`](./CHANGELOG.md) (Keep a Changelog 1.1.0 — structured BREAKING / Added / Changed / Deprecated / Removed / Fixed / Security per release). For commit-level context: `git log --oneline v0.X.0..HEAD` or `git log --grep="F-NNN"`.

**Why this section is a pointer, not a narrative**: every prior version of CLAUDE.md hardcoded release-cluster summaries here. They duplicated CHANGELOG.md verbatim and went stale as soon as the next release shipped (v0.11.1 → v0.14.x drifted three minor versions before the F-123 / F-124 sweep caught it). The CHANGELOG is the canonical timeline; this file documents capability inventory (§2) and decision intent (§8 / §9), not history.

## 6. Reference map

| To do this | Read this |
|---|---|
| 30-second status check | `README.md` plus this file |
| **Continuing work in Claude Code** | `design/HANDOFF-to-claude-code.md` (gitignored) |
| First-run smoke verification | `docs/archive/first-run-checklist-v0.1.0.md` (F-042 archive) |
| Tagging / release playbook | `docs/archive/release-v0.1.0-playbook.md` (F-042 archive — same playbook applies through v0.14.x) |
| Full change history | `CHANGELOG.md` |
| Slash command spec | `commands/{init,work}.md` (Preamble convention · BR-014 NO skip / NO shortcut two-liner) |
| Spec v2.3.8 JSONSchema | `docs/schemas/spec.schema.json` |
| **Self-referential canonical spec** | `docs/samples/harness-boot-self/spec.yaml` — the SSoT for `.harness/spec.yaml` |
| Skill v0.5 implementation guide | `skills/spec-conversion/SKILL.md` |
| TS parity tests | `tests/parity/*.test.ts` (~620 vitest tests, operational since v0.13.0) |
| Legacy Python tests | `tests/unit/test_*.py` (1119 tests, quarantined post-v0.13.0 cutover; reference-only) |
| Project mode semantics | `src/core/projectMode.ts` (prototype-vs-product docstring) |
| Self-hosting appendix | `docs/archive/local-install-v0.1.0.md` Appendix A (F-042 archive) |
| Local memory (user style, progress notes) | `~/.claude/projects/.../memory/MEMORY.md` (gitignored) |

## 7. Working rules

- **`design/` is your personal workspace.** Never `git add` it. If something there deserves to be public, promote it into `docs/`.
- **`legacy/` is the same.** Keep the existing tracked files; don't add new ones.
- **The plugin does not install onto itself.** Never run `/harness-boot:init` in this repo — it would overwrite the plugin source.

- **Self-dogfood policy — Phase 2 active** (since 2026-04-27):
  - **Every new feature goes through the work.py cycle.** Same contract as cosmic-suika and other external dogfood projects. "Refactor" / "doc-only" / "small fix" are not exceptions.
  - The four-verb flow:
    ```
    node bin/harness work F-N --harness-dir .harness                        # activate
    node bin/harness work F-N --harness-dir .harness --run-gate gate_0      # ... 1, 2, 3, 5
    node bin/harness work F-N --harness-dir .harness --evidence "..."       # declared evidence
    node bin/harness work F-N --harness-dir .harness --complete             # transition
    ```
  - Slash commands **cannot live-edit from this repo** — the installed copy always wins. So the dev entry point is always `node bin/harness work` directly. (In a user project, `/harness-boot:work` is the wrapper.)
  - `.harness/state.yaml` is committed alongside the feature PR (the previous Phase 1 "only at release tag" restriction is lifted).
  - `events.log` accumulates lifecycle events (`feature_activated`, `gate_run`, `evidence_declared`, `feature_completed`). The `/harness-boot:work` dashboard and `harness metrics` use them to compute real lead time and gate pass rate.
  - `project.mode` is `prototype` (current default) — the Iron Law floor is `evidence ≥ 1` plus `gate_5 = pass`. Promotion to product is a user decision.

- **Common rules** (Phase-independent):
  - `.harness/spec.yaml` is a **copy** (not a symlink) of `docs/samples/harness-boot-self/spec.yaml`. `self_check.sh` enforces lockstep with `diff -q`. Adding a feature means **editing both at once**.
  - `events.log`, `harness.yaml`, `domain.md`, `architecture.yaml`, `chapters/`, and `_workspace/` are gitignored.
  - No user collision: when a user runs `/harness-boot:*`, it always references `$(pwd)/.harness` — our internal `.harness/` is invisible to them.

- **Slash command pathway** (validated 2026-04-23, re-checked 2026-04-27):
  - Works: `/plugin marketplace add qwerfunch/harness-boot` plus `/plugin install harness-boot@harness-boot` → `/harness-boot:{init,work}` available. Update via `/plugin update harness-boot@harness-boot`.
  - Doesn't work: `CLAUDE_PLUGIN_ROOT` env or `settings.json plugins[]` for live dev-checkout reflection — the installed copy always wins.
  - Conclusion: edits don't reflect into slash commands instantly. **The dev workflow inside this repo always calls `node bin/harness` directly.** Slash-command verification happens through release → `/plugin update`.
  - Details: `docs/archive/local-install-v0.1.0.md` §2 + Appendix A (F-042 archive).

- **Tags never move.** A broken release gets yanked and hotfixed (`docs/archive/release-v0.1.0-playbook.md` §5 · F-042 archive).
- **main is the default branch.** Merges come from `feat/v0.X.Y-*` PRs and fast-forward into main.
- **Patch-first versioning.** Even a new feature ships as X.Y.Z+1. Minor or major bumps require user confirmation and a substantial milestone.
- **Release is a user decision.** No auto-tagging. Commits and merges are free; tags and release notes wait for an explicit instruction.
- **Commit / PR language**: English. Response / explanation language: Korean (file content depends on context).
- **Anti-rationalization**: both slash commands carry the Preamble, with the `NO skip:` / `NO shortcut:` pair on lines 2 and 3 (BR-014).
- **CQS**: read-only commands (`status` · `check` · `events` · `metrics`) never change a target file's mtime. Tests verify the invariant.

## 8. Known limitations

**Closed items**: tracked release-by-release in [`CHANGELOG.md`](./CHANGELOG.md). This section deliberately does *not* enumerate them — that history is the changelog's job, not this document's.

**Open** (decision intent — what we know but have not yet acted on):

- **Cross-language canonical hash test vectors** (Appendix D.7) — Node / Go cross-validation not yet implemented.
- **AC ↔ Test traceability** (proposed 14th drift kind, F-125 candidate): ensure each `acceptance_criteria[]` entry maps to a concrete test function. Distinct from the `Coverage` detector, which is description-vs-fingerprint, not AC-vs-test.
- **LLM author attribution on evidence** (F-126 candidate): tag each `evidence[]` entry with `author=human|llm` so audits can distinguish declared human verification from automated gate runs. Closes the F-122 audit weakness ("five evidence entries, all `gate_run`").
- **Content drift detector** (proposed 15th drift kind, F-127 candidate): validate `<!-- harness:fact key=X value=V source=Y -->` sigil regions in this CLAUDE.md (and elsewhere) against the cited code SSoT — auto-rejects stale L2 facts.
- **Pre-push hook** calling `runBlockingCheck` — moves Iron Law from post-hoc (`--complete`) to in-flight (`git push`). Pre-commit was rejected as too-frequent; pre-push is the right cadence.
- **External dogfood expansion** beyond cosmic-suika and logcat-on — recruit 1–2 additional OSS adopters and run an ISSUES-LOG return cycle. Differentiation narrative is currently single-source.
- URL → design seed — large scope and IP-boundary concerns.
- gate_perf auto-detect heuristics (lighthouse / k6 / wrk config detection).
- F-030 sharding utility (and other spec/* author tools) has not been ported to TS yet — `harness check` runs at 0.27 s on the live workspace, so low priority until real-world scale demands it.
- F-028 prompt-log hook needs a production check — confirm prompts actually accumulate after a real `/plugin update`.
- F-034 pre-commit hook does not cover merge commits (no `active_feature_id` after a feature completes); a `.git/MERGE_HEAD` short-circuit is logged in `.harness/_workspace/issues-log.md`.

## 9. Next-phase candidates

### In progress
The authoritative list lives in [`.harness/state.yaml`](./.harness/state.yaml) `features[]` where `status == in_progress`. Open PRs: `gh pr list --state open`. This document does not enumerate them — those values change per push and are guaranteed to drift if hardcoded here.

### Queued — Tier 1 (promotable to the next cycle)
- **AC ↔ Test traceability detector** (proposed 14th drift kind) — each `acceptance_criteria[]` entry must map to a concrete test function. Distinct from the `Coverage` detector (description-vs-fingerprint). Strengthens the differentiation axis.
- **LLM author attribution on evidence** — schema 1 field (`author=human|llm`) + work.ts kind branching. Closes the audit weakness where automated gate-run evidence alone passes the Iron Law without any declared human verification.
- **Content drift detector** (proposed 15th drift kind, Step B of the CLAUDE.md info-architecture refactor) — validates `<!-- harness:fact key=X value=V source=Y -->` sigil regions in this CLAUDE.md against the cited code SSoT. Auto-rejects stale L2 facts. Self_check.sh adds a step 6.

### Queued — Tier 2 (external-validation gated)
- **Pre-push hook** invoking `runBlockingCheck` — moves Iron Law from post-hoc (`--complete`) to in-flight (`git push`). Pre-commit was rejected as too-frequent; pre-push is the right cadence. Predicate: at least 1–2 external dogfood adopters have run a complete cycle without trip-wires firing.
- **External dogfood expansion** — beyond cosmic-suika and logcat-on, recruit 1–2 OSS adopters and run an ISSUES-LOG return cycle. The differentiation narrative needs more than one external signal.

### Available but not scheduled
- The next batch of ISSUES-LOG returns from any adopter, when external usage surfaces them.
- `harness check` parallelisation + incremental mode — currently a premature optimisation (sub-second on the live workspace). Re-evaluate at ~1 k features.

### Larger milestones (user confirmation, minor or major bump)
- Cross-language canonical hash test vectors (Node / Go cross-check).
- MCP server (`@modelcontextprotocol/sdk`) — exposes harness state · spec · events to non-Claude-Code clients (Cursor, Continue, Cline). Predicate: external dogfood corpus large enough to justify cross-client investment.
- VSCode extension — IDE sidebar dashboard + drift squigglies. Predicate: same as MCP.
- Plugin SDK / external detector registration — let downstream projects register custom drift detectors via `harness.yaml.detectors[]`.
- URL → design seed (scope decision needed).
- gate_perf auto-detect heuristics.
- Semantic drift detector (LLM-based) — `acceptance_criteria` intent vs code behaviour. Held: LLM non-determinism + cost.

## 10. Imports

None for now. `design/HANDOFF-*.md` files are personal notes (gitignored) — global `@import` should not depend on them.
