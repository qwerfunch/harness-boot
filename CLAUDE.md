# harness-boot — plugin development repo

> This CLAUDE.md is the context to read **when developing the plugin in this repo**.
> Don't confuse it with `docs/templates/starter/CLAUDE.md.template`, which is the separate file `/harness-boot:init` writes **into a user's project**.

## 1. What this repo is

The source of the Claude Code plugin `harness-boot`. Users install the `.harness/` skeleton into their own project with `/harness-boot:init`, then run the per-feature cycle (activate → gate → evidence → complete) through a single `/harness-boot:work` command. The v0.9.0 UX rewrite collapsed the surface to two slash commands you actually have to memorize.

- **Current release**: v0.11.1 (tagged 2026-04-27 — Iron Law rename + F-048 drift × Iron Law gating). The marketplace PR is held until the user explicitly green-lights it (memory: `marketplace_timing`). For full history see `git log` and `CHANGELOG.md`.
- **Install path**: `/plugin marketplace add qwerfunch/harness-boot` then `/plugin install harness-boot@harness-boot`. Update with `/plugin update harness-boot@harness-boot`.
- **SemVer policy**: patch-first. Even new features ship as X.Y.Z+1. Minor and major bumps require user confirmation and are reserved for substantial milestones.
- **License**: MIT · Author: qwerfunch

## 2. Where we are

**v0.11.1 — Iron Law (renamed from "Iron Law D") + drift × Iron Law gating** (2026-04-27).

Cumulative state:

- **Two slash commands** (`/harness-boot:init` · `/harness-boot:work`) — collapsed in v0.9.0. `init` accepts a free-form natural-language prompt or a 3-option menu; `work` handles no-args (dashboard, v0.9.2), natural-language intents, and direct F-ID invocation alike.
- **Gate automation 0/1/2/3/5** — `src/gate/runner.ts` walks pyproject pytest → npm scripts (typecheck/lint/test:coverage/smoke/test:e2e, v0.10.2) → direct tool invocation → polyglot fallback in that order. **BR-004 Iron Law (gate_5 = pass + declared evidence ≥ N) is automated end-to-end.**
- **Iron Law — cumulative declared evidence** (v0.9.3) + **product mode strict** (v0.10.3) — when `project.mode == product`, every recorded gate's `last_result` must be non-fail before complete is allowed. Prototype mode keeps the lighter contract. The "D" suffix from v0.9.3 history was dropped in v0.11.1 — internal evolution marker that confused users.
- **Drift × Iron Law gating** (v0.11.1, F-048) — `complete()` now calls `check.py` first. `severity="error"` findings on wire-integrity drift kinds (`Code` · `Stale` · `AnchorIntegration`) reject the transition; `--hotfix-reason` still bypasses. Closes GAP 1 from the 4-mechanism cohesion analysis.
- **Project mode axis** (v0.9.6) — `spec.project.mode ∈ {prototype, product}` is the single switch that determines the Iron Law floor, kickoff/retro template depth, and design-review autowire behavior. Unset → product (strict default).
- **Drift detection 12 kinds** — Generated · Derived · Spec · Include · Evidence · Code · Anchor · Adr · Stale · AnchorIntegration · Doc · Protocol. Two-layer supersession metadata (`features[].supersedes` / `superseded_by`) and the archive flow (v0.10.0).
- **Ceremony automation 4/4** — kickoff · retro · design-review · inbox.
- **Phase 2 self-dogfood active** (since 2026-04-27) — `.harness/` is the live workspace. Every new feature in this repo runs through `node bin/harness.js work F-N --harness-dir .harness`. See §7 for the contract.
- **Init/work observability** (v0.10.5) — the `## Issue logging` section in `commands/{init,work}.md` plus `hooks/prompt-log.sh` (UserPromptSubmit). Users accumulate `.harness/_workspace/{issues-log.md, prompts/YYYY-MM.jsonl}` → maintainer return cycle + prompt-shape corpus.
- **Scaling preparedness** (v0.10.6) — five additive fields on `features[]` (area · archived_at · archive_reason · digest · include_path) plus `src/spec/{shard,unshard,summary}.ts` (TS port pending; spec utilities deferred past v0.13.0) and `tests/scale/test_scale.py` measuring 100 / 1000 / 3000 / 10000 features. Users won't need to invoke any of this until ~300 features.
- **cosmic-suika ISSUES-LOG batch return** (v0.10.7) — I-003 (recommended tsconfig) · I-004 (relaxed `risks[].id` pattern) · I-006 (clarified `--kind trivial`) · I-007 (changelog version optional). The first return cycle for the F-027 convention.
- **Cumulative tests**: 1119 (1110 unit + 26 integration + F-048's 7 new). 41+ test files.

**Next-thread candidates**: see §9.

## 3. Repo layout (tracked files only)

```
.claude-plugin/
├── plugin.json                     # plugin manifest (name: "harness-boot", v0.11.1)
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
dist/                               # pre-built CLI (committed for plugin install)
bin/harness.js                      # Node entry point
self_check.sh                       # repo-root 5-step self-dogfood verification
legacy/scripts/                     # Python archive (read-only since v0.13.0)
                                    # — kept until external dogfood signals zero regressions
tests/parity/                       # TS parity test suite (operational)
tests/unit/ · tests/integration/    # Python tests (quarantined; reference-only)
tests/regression/conversion-goldens/   # golden samples + MANIFEST
docs/
├── schemas/spec.schema.json        # spec v2.3.8 JSONSchema (Walking Skeleton enforced + project.mode)
├── samples/harness-boot-self/      # self-referential canonical spec (49 features incl. F-048/F-049)
├── templates/starter/              # the templates /harness-boot:init copies (CLAUDE.md.template, etc.)
├── glossary/BRAND_TERMS.md         # F-041 — 28 brand terms (Walking Skeleton · Iron Law · …)
├── i18n/README.md                  # F-040 — runtime locale policy
├── preamble-spec.md                # F-042 — single source for Preamble + NO skip / NO shortcut
└── archive/                        # F-042 — historical (local-install · first-run · v0.1.0 / v0.4 plans · i18n-ko-frozen-f041/)
.github/workflows/self-check.yml    # Phase 3 CI (v0.8.3) — self_check.sh per PR
README.md · CHANGELOG.md · LICENSE · CLAUDE.md (this file) · requirements-dev.txt
```

**Untracked** (.gitignore): `design/` · `legacy/` · `translations-ko/` · `node_modules/` · `.harness/{events.log,harness.yaml,domain.md,architecture.yaml,chapters/}` · etc.

## 4. Current git state

- **Tags**: v0.1.0 through v0.11.1 are pushed to origin (v0.10.4 was retroactive). Tags must not move.
- **main HEAD**: `eeb35bc release: v0.11.1 — Iron Law rename + F-048 drift × Iron Law gating`.
- **Default branch**: main (the marketplace fetch ref). Work branches follow `feat/v0.X.Y-*` / `fix/v0.X.Y-*` and fast-forward into main.
- **Working tree**: clean.
- **Next thread**: F-049 (in progress) — native English consolidation, Phase 1 entry-point dev surfaces. See §9.

## 5. Recent commit context

**v0.11.x line — naming cleanup + 4-mechanism cohesion (Iron Law × drift gating)** (2026-04-27 cluster):
- `eeb35bc release: v0.11.1 — Iron Law rename + F-048 drift × Iron Law gating` (3-commit thread bundled into a patch release)
- `b03441d feat(F-048): drift × Iron Law gating — complete() blocks on wire-integrity drift` (closes GAP 1: complete() now calls check.py)
- `856198c chore: rename "Iron Law D" → "Iron Law" (BR-004 simplification)` (drop the v0.9.3 history-marker "D" from external naming)

**v0.11.0 — vision consolidation**:
- `97e71f9 feat(v0.11.0): vision consolidation — 6-release refactor thread closes (F-047)` (F-001 → F-010 archived in place; minor bump on user confirmation)

**v0.10.x line — Phase 2 self-hosting + cosmic-suika ISSUES-LOG return + observability + scaling preparedness**:
- `2610829 feat(v0.10.7): cosmic-suika ISSUES-LOG batch return (I-003 / I-004 / I-006 / I-007)`
- `3e8160a feat(v0.10.6): scaling preparedness — F-029 schema + F-030 sharding tools + F-031 stress test` (avoids 1k–10k feature post-hoc migration cost)
- `36dab82 feat(v0.10.5): init/work observability — issue logging (F-027) + prompt logging (F-028)` (standardizes the cosmic-suika ISSUES-LOG pattern)
- `bc8e539 feat(v0.10.4): Phase 2 self-hosting active — F-025/F-026 + smoke shim + pytest scope` (the Phase 1 → Phase 2 flip)
- `38eba96 feat(v0.10.3): cosmic-suika I-008 — Iron Law D product mode strict` (recorded gate fail blocks complete)
- `2a4c66d feat(v0.10.2): cosmic-suika I-001 — npm scripts auto-detection in gate runner`
- `89c5776 feat(v0.10.1): cosmic-suika ISSUES-LOG patch — AnchorIntegration drift + no-args dashboard candidates`
- `ede6f98 feat(v0.10.0): two-layer supersession — features[] supersedes/superseded_by + archive flow + Stale drift`

**v0.9.x line — UX rewrite + Iron Law + mode axis**:
- `e969e28 feat(v0.9.0)!: UX re-architecture step 1 — namespace rename + command consolidation` (8 → 2 commands, `harness` → `harness-boot`)
- `87a490c feat(v0.9.1): feature_resolver module + scripts/ui/ scaffolding`
- `9d31637 feat(v0.9.2): dashboard + intent_planner — no-args entry point`
- `1a631ab feat(v0.9.3): Iron Law D — cumulative declared evidence + hotfix override`
- `8194716 feat(v0.9.4): README overhaul + scenario contract table + plugin description modernization`
- `db9d0db feat(v0.9.6): project mode axis — prototype/product ceremony lightening`

**v0.8.x line — agent fixtures + ceremonies + CI**:
- `66c8a25 feat(v0.8.0): design-review auto-wire closes 4/4 ceremony automation`
- `aae9e8f feat(v0.8.1): complete agent-eval fixtures 15/15`
- `9746770 feat(v0.8.3): Phase 3 CI — GitHub Actions self-check workflow`
- `1bc95a8 feat(v0.8.6): events.log monthly rotation`

**Pre-v0.7.x** (subpackage cleanup, gate auto-runners) is recoverable via `git log --oneline v0.7.0..HEAD` or the tag list (`git tag --sort=-version:refname`).

## 6. Reference map

| To do this | Read this |
|---|---|
| 30-second status check | `README.md` plus this file |
| **Continuing work in Claude Code** | `design/HANDOFF-to-claude-code.md` (gitignored) |
| First-run smoke verification | `docs/archive/first-run-checklist-v0.1.0.md` (F-042 archive) |
| Tagging / release playbook | `docs/archive/release-v0.1.0-playbook.md` (F-042 archive — same playbook applies through v0.11.x) |
| Full change history | `CHANGELOG.md` |
| Slash command spec | `commands/{init,work}.md` (Preamble convention · BR-014 NO skip / NO shortcut two-liner) |
| Spec v2.3.8 JSONSchema | `docs/schemas/spec.schema.json` |
| **Self-referential canonical spec** | `docs/samples/harness-boot-self/spec.yaml` — the SSoT for `.harness/spec.yaml` |
| Skill v0.5 implementation guide | `skills/spec-conversion/SKILL.md` |
| Script-layer tests | `tests/unit/test_*.py` (1119 tests) |
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
    node bin/harness.js work F-N --harness-dir .harness                        # activate
    node bin/harness.js work F-N --harness-dir .harness --run-gate gate_0      # ... 1, 2, 3, 5
    node bin/harness.js work F-N --harness-dir .harness --evidence "..."       # declared evidence
    node bin/harness.js work F-N --harness-dir .harness --complete             # transition
    ```
  - Slash commands **cannot live-edit from this repo** — the installed copy always wins. So the dev entry point is always `node bin/harness.js work` directly. (In a user project, `/harness-boot:work` is the wrapper.)
  - `.harness/state.yaml` is committed alongside the feature PR (the previous Phase 1 "only at release tag" restriction is lifted).
  - `events.log` accumulates lifecycle events (`feature_activated`, `gate_run`, `evidence_declared`, `feature_completed`). The `/harness-boot:work` dashboard and `scripts/metrics.py` use them to compute real lead time and gate pass rate.
  - `project.mode` is `prototype` (current default) — the Iron Law floor is `evidence ≥ 1` plus `gate_5 = pass`. Promotion to product is a user decision.

- **Common rules** (Phase-independent):
  - `.harness/spec.yaml` is a **copy** (not a symlink) of `docs/samples/harness-boot-self/spec.yaml`. `self_check.sh` enforces lockstep with `diff -q`. Adding a feature means **editing both at once**.
  - `events.log`, `harness.yaml`, `domain.md`, `architecture.yaml`, `chapters/`, and `_workspace/` are gitignored.
  - No user collision: when a user runs `/harness-boot:*`, it always references `$(pwd)/.harness` — our internal `.harness/` is invisible to them.

- **Slash command pathway** (validated 2026-04-23, re-checked 2026-04-27):
  - Works: `/plugin marketplace add qwerfunch/harness-boot` plus `/plugin install harness-boot@harness-boot` → `/harness-boot:{init,work}` available. Update via `/plugin update harness-boot@harness-boot`.
  - Doesn't work: `CLAUDE_PLUGIN_ROOT` env or `settings.json plugins[]` for live dev-checkout reflection — the installed copy always wins.
  - Conclusion: edits don't reflect into slash commands instantly. **The dev workflow inside this repo always calls `node bin/harness.js` directly.** Slash-command verification happens through release → `/plugin update`.
  - Details: `docs/archive/local-install-v0.1.0.md` §2 + Appendix A (F-042 archive).

- **Tags never move.** A broken release gets yanked and hotfixed (`docs/archive/release-v0.1.0-playbook.md` §5 · F-042 archive).
- **main is the default branch.** Merges come from `feat/v0.X.Y-*` PRs and fast-forward into main.
- **Patch-first versioning.** Even a new feature ships as X.Y.Z+1. Minor or major bumps require user confirmation and a substantial milestone.
- **Release is a user decision.** No auto-tagging. Commits and merges are free; tags and release notes wait for an explicit instruction.
- **Commit / PR language**: English. Response / explanation language: Korean (file content depends on context).
- **Anti-rationalization**: both slash commands carry the Preamble, with the `NO skip:` / `NO shortcut:` pair on lines 2 and 3 (BR-014).
- **CQS**: read-only commands (`status` · `check` · `events` · `metrics`) never change a target file's mtime. Tests verify the invariant.

## 8. Known limitations (as of v0.11.1)

**Closed since the last CLAUDE.md snapshot:**
- v0.4 → v0.7: agent fixtures 15/15 · ceremonies 4/4 · subpackage cleanup · gate auto-runners.
- v0.8.x: Phase 3 CI · monthly events.log rotation · agent fixtures complete · design-review autowire.
- v0.9.x: command consolidation (8 → 2) · feature_resolver · no-args dashboard · Iron Law · README user-friendly · project mode axis.
- v0.10.0–3: two-layer supersession + Stale drift · cosmic-suika I-001/I-008/I-010 returns.
- v0.10.4: **Phase 2 self-hosting deferral resolved** (2026-04-27) — this repo became real dogfood.
- v0.10.5: init/work observability — F-027 issue-logging convention + F-028 prompt-log hook.
- v0.10.6: scaling preparedness — F-029 schema (5 additive fields) + F-030 sharding tools + F-031 stress test (1k–10k features measured).
- v0.10.7: cosmic-suika ISSUES-LOG batch return (I-003 tsconfig + I-004 risks pattern + I-006 kind=trivial + I-007 changelog version optional).
- v0.11.0: vision consolidation — F-001 → F-010 archived in place, 6-release refactor thread closed.
- v0.11.1: Iron Law rename ("D" suffix dropped) + F-048 drift × Iron Law gating (GAP 1 of the 4-mechanism cohesion analysis closed).

**Open:**
- Cross-language canonical hash test vectors (Appendix D.7) — Node / Go cross-validation not yet implemented.
- AC coverage drift (a candidate for a 13th drift detector in `check.py`).
- URL → design seed — large scope and IP-boundary concerns (reviewed 2026-04-24).
- gate_perf auto-detect heuristics (lighthouse / k6 / wrk config detection).
- The pre-commit hook is in place, but the discipline still relies on memory; tighten if it slips.
- F-030 sharding utility (and other spec/* author tools) has not been ported to TS yet — listed under tier-3 follow-ups.
- F-028 prompt-log hook needs a production check — confirm prompts actually accumulate after a real `/plugin update`.
- F-049 → F-053 native-English consolidation thread (§9) is in flight: F-049 closes the Phase 1 entry-point surfaces; F-050 covers spec mirrors + schema; F-051 covers `scripts/` Python docstrings; F-052 covers `tests/`; F-053 settles a CHANGELOG English-only-going-forward policy.

## 9. Next-phase candidates

**v0.11.1 shipped (2026-04-27). Active and queued:**

### In progress
- **F-049** — native English consolidation, Phase 1: top-level dev docs + supporting docs + hook script banners. (this commit)

### Queued (user opt-in per phase)
- **F-050** — Phase 2: both spec mirrors + `docs/schemas/spec.schema.json` description bodies.
- **F-051** — Phase 3: `scripts/` Python docstrings and comments.
- **F-052** — Phase 4: `tests/` Python docstrings and comments.
- **F-053** — Phase 5: CHANGELOG English-only-going-forward policy (history preserved as-is).

### Available but not scheduled
- AC coverage drift detector — would be the 13th drift kind in `check.py`.
- The next batch of cosmic-suika ISSUES-LOG returns, when external usage surfaces them.
- F-049 Tier-promotion candidates from the 4-mechanism cohesion analysis (LLM author-attribution on evidence; Preamble compliance scanner). Held until external dogfood validates the need.

### Larger milestones (user confirmation, minor bump)
- Cross-language canonical hash test vectors (Node / Go cross-check).
- URL → design seed (scope decision needed).
- gate_perf auto-detect heuristics.

## 10. Imports

None for now. `design/HANDOFF-*.md` files are personal notes (gitignored) — global `@import` should not depend on them.
