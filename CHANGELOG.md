# Changelog

All notable changes to harness-boot are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

**Language policy (since v0.11.3, F-054):** new release notes from this entry forward are written in English. Earlier entries (v0.1.0 through v0.11.2) preserve their original Korean / English mix as historical record and are not retroactively translated. The contributor convention is unchanged: commits and PRs are English, file content depends on context, and Korean prose is acceptable in user-facing surfaces only when explicitly bilingual (see `docs/glossary/BRAND_TERMS.md` for the bilingual reference table).

---

## [Unreleased]

### Queued

- Marketplace submission to `anthropic/claude-plugins-official` — held until external soak; submission text templated, user submits via https://claude.ai/settings/plugins/submit.
- SKILL.md → seed_spec reference rot — `skills/spec-conversion/SKILL.md:409` references `scripts/scan/seed_spec` which is no longer ported. Skill is Markdown-driven, so the LLM can synthesize the seed inline; not blocking.
- Deferred autowires named in `src/work.ts:411-413` — `spec/quantClaims`, `scan/chapterWriter`, `scan/styleFingerprint`. Stderr-only hints, never Iron-Law gating; pick up when there is external pressure.
- F-052/F-053/F-051 docstring sweep follow-ups — carry-forward.
- F-073 (`read_events(tail=N)`) and F-074 (`canonical_hash` mtime cache) — v0.11.11 cumulative-slowdown audit queue.
- Next-skill candidates after feature-author soaks — `drift-explain-and-fix` · `acceptance-criteria-craft` · `gate-recover` · `evidence-craft`. Sequential, not parallel — one experiment at a time. Internal A/B test (2026-04-30) showed existing capability already covers these cases — pick up only on external user pain signal.

## [0.14.3] — 2026-05-05

**driveLoopAndPlan.test.ts seedCheckpoint time-bomb fix (F-122).**

Discovered while running the v0.14.2 work-vs-drive verification cycle on 2026-05-05. Six halt-detection cases in `tests/parity/driveLoopAndPlan.test.ts` started failing 24h after F-119 (drive Stage 2) was authored. Root cause: the test fixture `seedCheckpoint()` hardcoded `started_at = '2026-05-04T10:00:00Z'`, and `defaultCheckpoint.max_seconds = 7200` (2h). Once real wall-clock outran the 2h window, drive's `wall_clock` halt #6 fired before any other halt the test was actually asserting (#5 blocked, #3 retry_threshold, #10 gate_no_progress, retry-vs-stagnation priority, goal completion).

Production code (`src/drive/loop.ts:303-323` wall_clock check) is correct — only the test fixture failed to isolate time. The fix flips the default `started_at` to `new Date().toISOString()` (dynamic, "drive that just started"), and a regression-guard `it()` block pins the dynamic-default behaviour so the next person who tries to revert is caught at test time rather than 24h later.

Patch-only — zero production code changes, zero schema/behaviour changes. Users do not need to update; the existing v0.14.2 install is functionally identical. The release exists so CI on every downstream fork stays green.

### Fixed

- **F-122** — `tests/parity/driveLoopAndPlan.test.ts` `seedCheckpoint()` default `started_at` becomes dynamic (`new Date().toISOString()`) instead of the hardcoded `'2026-05-04T10:00:00Z'` literal. The wall_clock self-test (`halt #6 — wall-clock cap reached`) keeps passing because it overrides both `started_at` and `now:` explicitly. New regression-guard test `seedCheckpoint default started_at is dynamic` asserts the fix is preserved.

### Verification

- `npm run typecheck` clean
- `npm run lint` clean
- `npm test` — **622/622** (was 615/621 with 6 fails on 2026-05-05 before this patch; 621/621 on the day of authorship 2026-05-04)
- `bash self_check.sh` 5/5 OK
- F-122 completed via `node bin/harness work F-122 --harness-dir .harness --complete` on `fix/v0.14.3-driveloop-test-time-isolation`

## [0.14.2] — 2026-05-04

**logcat-on ISSUES-LOG batch return — L-001 / L-002 / L-003 (F-121).**

Thirty-eighth cycle. The external dogfood project `logcat-on` (Rust workspace) accumulated three friction points on its `.harness/_workspace/issues-log.md`. Returned in one patch following the cosmic-suika v0.10.7 ISSUES-LOG batch-return precedent.

### Fixed

- **F-121 / L-001** — `docs/templates/starter/spec.yaml.template` now declares `summary: ""` under `project:`. The schema (`docs/schemas/spec.schema.json`) requires `["name", "summary"]`, so the very first `harness sync --soft` after `/harness-boot:init` previously surfaced a "fail — SpecValidationError: project: must have required property 'summary'" message. Exit code stayed 0 (fail-open intact) but the wording scared users on a brand-new skeleton. New parity test in `tests/parity/validate.test.ts` AJV-validates the template directly so any future schema change that breaks the starter is caught at test time.
- **F-121 / L-003** — `src/gate/runner.ts` `detectGate0Command()` now probes `Cargo.toml` (→ `cargo test --workspace`) and `go.mod` (→ `go test ./...`), mirroring the symmetric branches that already existed in `detectGate1Command` / `detectGate2Command` / `detectGate3Command`. Without this every Rust or Go project hit "no test command detected" → `gate_0 = skipped` and fell into L-002 below. Pyproject / npm / tests/ / Makefile precedence is preserved (regression test in `tests/parity/gateRunner.test.ts`).
- **F-121 / L-002** — `src/drive/loop.ts` adds halt **#10 `gate_no_progress`**. `bumpRetryCounter()` only counts FAIL, and `intentPlanner.suggest()` is pure (no memory of prior recommendations), so a stuck gate (`skipped` from L-003 above) caused drive's Phase B to recommend the same `run_gate` action every iteration, never trip halt #3 (`retry_threshold`), and burn all 50 iterations until halt #7 (`iteration_cap`). The new halt records the last 3 `(gate, result)` tuples per `(feature, gate)` on the checkpoint; when the same non-pass result repeats N=2 times in a row, drive yields with an actionable hint ("set `harness.yaml.gate_commands.<gate>` or fix project detection"). Retry_threshold (#3) keeps priority on consecutive FAIL — a dedicated test guards the order.

### Changed

- **`src/drive/types.ts`** — `HaltReason` adds `'gate_no_progress'` (additive, no breaking change for existing `--resume` flows).
- **`src/drive/halt.ts`** — `HALT_REASON_INDEX` adds `{n: 10, tag: 'gate no progress'}`; `nextStepFor()` adds the matching one-line hint.
- **`src/drive/checkpoint.ts`** — `ExecutePhaseCheckpoint` adds `recent_gate_results: Record<string, Record<string, Array<'pass'|'fail'|'skipped'>>>`. `defaultCheckpoint()` initializes it to `{}`; `loadCheckpoint()` defensively fills the field when missing, so pre-v0.14.2 checkpoints resume cleanly.
- **`src/drive/loop.ts`** — exports `RECENT_GATE_RESULTS_WINDOW = 3` and `GATE_STAGNATION_THRESHOLD = 2`; new `recordGateResult()` helper next to `bumpRetryCounter()`.

### Verification

- `npm run typecheck` clean
- `npm run lint` clean
- `npm test` — **621/621** (613 from v0.14.1 + 8 new tests across `validate.test.ts` (template), `gateRunner.test.ts` (Cargo/go probes), `driveLoopAndPlan.test.ts` (halt #10 + reset + priority over halt #3))
- `bash self_check.sh` passes (spec mirror lockstep + smoke)
- F-121 completed via `node bin/harness work F-121 --harness-dir .harness --complete` on `feat/v0.14.2-logcat-on-issues-log-batch`

## [0.14.1] — 2026-05-04

**`harness work --gate <name> <result>` parsing fix (F-120).**

Post-v0.14.0 E2E sample-project verification surfaced that `harness work F-N --gate gate_5 pass --note "..."` exited with `error: --gate takes two values` against a fresh project. Root cause: the commander option spec was authored as `.option('--gate <name> <result>', ...)` — commander does not support multi-placeholder option specs, so it captured only the first arg and rejected the second as a stray positional. `commands/work.md`'s documented Typical Scenario was therefore not directly invokable; users had to fall back to `--run-gate` (auto-detect).

### Fixed

- **F-120** — `src/cli/harness.ts` switches the `--gate` option spec to commander variadic (`<values...>`). Both `--gate gate_0 pass` and `--gate gate_0 pass --note "..."` now parse correctly. The action-side `Array.isArray && length === 2` cardinality guard is preserved — `--gate gate_5` (one arg) still exits 3 with the same `--gate takes two values` message.

### Verification

- `npm run typecheck` clean
- `npm run lint` clean
- `npm test` — **613/613** (611 from v0.14.0 + 2 new F-120 regression tests in `tests/parity/cli.test.ts`)
- `npm run build` clean
- `bash self_check.sh` 5/5 OK
- Manual smoke against a fresh sample project — both `--gate <name> <result>` paths now work.

### Issues-log return cycle

- I-009 entry — `--gate <name> <result>` two-arg option parsing rejects valid input → **resolved by F-120**. Pattern follows the cosmic-suika I-001/I-008 batch return convention.

## [0.14.0] — 2026-05-04

**`drive` — bounded autonomous loop. Codex `/goal` reimagined as a Bounded Goal Driver under BR-015 (F-118 + F-119).**

Two-stage landing: F-118 ships the *Goal* domain primitives + read-only `harness drive --status`; F-119 ships the autonomous loop body — Phase A (researcher → product-planner → feature-author trio) + Phase B (executor + intentPlanner-driven loop with 9 enumerated halt conditions) + Phase C (Goal-level retrospective). Single new BR (BR-015) charters the discipline: **escalate, never bypass**.

### What landed

- **F-118** — Goal domain primitives: spec schema v2.3.8 → v2.3.9 (additive — top-level `goals[]` + `features[].goal_id`), `state.yaml` runtime mirror (`session.active_goal_id` + `goals[]`), `src/drive/{types,goalStore,progressRenderer,statusCommand}.ts`, `harness drive --status [G-N] [--all] [--json] [--watch]` (CQS, mtime invariant per BR-012).
- **F-119** — autonomous loop body: `src/drive/{checkpoint,halt,executor,planPhase,loop,goalRetro}.ts`, `commands/drive.md` slash command, full CLI surface (`harness drive "<goal>" | --resume | --plan-only | --auto-approve-{brief,all} | --max-iterations | --max-hours | --max-retries | --dry-run | --abort`).
- **BR-015** — Bounded Autonomy Charter (new). Drive cannot self-issue `--hotfix-reason`; cannot call `git commit/push/tag`, `gh release`, or `/plugin marketplace`; must escalate on `severity=error` drift; must escalate after the configured retry threshold; records every halt to `_workspace/drive/run.yaml` + `progress.log` + `events.log`; obeys the BR-014 preamble itself; single active goal + single active feature (sequential only).

### Halt taxonomy (9 reasons, all from a single union type)

| # | Reason | Trigger |
|---|---|---|
| 1 | `plan_phase_approval` | researcher / planner / feature-author handoff awaits user action |
| 2 | `commit_boundary` | active feature is gate_5-pass + ≥ 1 evidence and tree is dirty |
| 3 | `retry_threshold` | same gate failed `--max-retries` times in a row (default 3) |
| 4 | `drift_severity_error` | `harness check` finds a `severity=error` Code/Stale/AnchorIntegration/Coverage drift |
| 5 | `feature_blocked` | every remaining feature in the goal is `blocked` |
| 6 | `wall_clock` | `--max-hours` exceeded |
| 7 | `iteration_cap` | `--max-iterations` exceeded |
| 8 | `network_failure` | researcher's WebFetch / WebSearch failed (Phase A) |
| 9 | `stop_file` | emergency-pedal sigil at `_workspace/drive/STOP` |

### Verification

- `npm run typecheck` clean
- `npm run lint` clean
- `npm test` — **611/611** (497 pre-Stage-1 + 61 Stage-1 + 53 Stage-2)
- `npm run build` clean
- `bash self_check.sh` 5/5 OK (SSoT diff · validate · sync · check · commands grep)
- BR-015 self-hotfix reject — covered by `tests/parity/driveExecutor.test.ts`
- 9 halt conditions — exercised across `tests/parity/driveLoopAndPlan.test.ts` + `driveHaltAndRetro.test.ts`
- Goal retro idempotency (AC-6) — second `generateGoalRetro` call returns `created:false`, no duplicate `goal_retro_written` events
- F-118 + F-119 both completed via the harness CLI cycle on `feat/v0.14.0-drive-stage1` and `feat/v0.14.0-drive-stage2`

### Out of scope (next minor)

- Stage-2 LLM-required actions (`analyze_fail`, `resolve_block`) currently halt to user; a future `--use-llm-judgment` flag could route them to an Agent call inside Phase B.
- `drift_severity_error` halt is reactive (only fires when `runDriveStep` itself observes a finding); a *proactive* check before each iteration is queued for v0.14.1+.
- BRAND_TERMS.md additions for *Goal* / *halt* / *Bounded Goal Driver* — to be added with the user-friendly README sweep.

## [0.13.2] — 2026-04-30

**Repo root cleanup — remove dead Python config (F-117).**

After v0.13 (F-107) retired the Python operational surface to `legacy/scripts/`, two config files at root were left behind. Both dead in the v0.13 hot path. Cleanup PR #48.

### Removed

- `pytest.ini` — F-026 era; `testpaths = tests/unit` constraint on bare `python -m pytest`. v0.13 hot path no longer invokes bare pytest.
- `requirements-dev.txt` — pyyaml · jsonschema · pytest · coverage · tomli. All Python-only; replaced by `package.json` devDependencies (vitest · typescript · eslint · prettier · esbuild).
- `.pytest_cache/` (local working tree only — already gitignored).

### Doc updates

- `CLAUDE.md` §3 repo layout drops `requirements-dev.txt` reference.

### Out of scope

- `legacy/scripts/` keeps no `pytest.ini` or `requirements*.txt` of its own. Running legacy tests requires manual env setup — intended posture for a read-only archive.
- `.DS_Store` at root — macOS junk, untracked, leave alone.

### Verification

- `npm run typecheck` clean
- `npm run lint` clean
- `npm run test:parity` 497/497 PASS (no regression)
- `bash self_check.sh` 5/5 OK

## [0.13.1] — 2026-04-30

**`feature-author` skill v0.1 — auto-trigger F-N entry authoring.**

The first Skill expansion since `spec-conversion`. harness-boot used 17 agents and 2 slash commands as primary surface, with skills participating only in the plan.md → spec.yaml conversion path. v0.13.1 puts a Skill on the friction point self-dogfood surfaced 121+ times: writing the F-N entry itself.

### What landed

- **F-114** — `skills/feature-author/` v0.1: SKILL.md (5-step procedure) + 4 shape adapters (ui-surface · sensitive · performance-budget · pure-domain) + paste-ready `feature-entry.yaml` skeleton + 26-case structural parity test.
- **F-115** — Anthropic skill-guide alignment: dropped non-spec `version` frontmatter field, split trigger phrases into canonical `when_to_use`, added "Bundled resources" section with explicit markdown links per the official authoring guide.
- **F-116** — smoke verification template at `tests/smoke/feature-author/` with seed-spec.yaml + prompts.md (4 shapes × ko/en) + 4 shape walkthroughs + live schema-validate evidence.

### Trigger phrases (auto-load)

Korean natural-phrasing patterns the skill responds to:
- "X 기능 구현해줘" · "X 기능 만들어줘" · "X 추가해줘" · "X 개발해줘"
- "로그인 기능 만들자" · "결제 붙이자" · "회원가입 구현"
- "새 피처 추가" · "피처 추가하자" · "F-N 정의" · "spec.yaml 에 추가"

English equivalents: "implement X feature", "build X", "add a X feature", "draft a feature", "spec out X", "scaffold X", "register this as F-N".

### How it works

1. **Shape detection** — picks one of `ui-surface` / `sensitive` / `performance-budget` / `pure-domain` from the user's intent, with stricter-shape-wins precedence (sensitive > performance > ui-surface > pure-domain).
2. **Project-mode-aware AC count** — reads `project.mode` from spec.yaml; `prototype` → 3-4 ACs, `product` → 6-8 ACs.
3. **Adapter-driven AC content** — loads the matching shape adapter for category-specific AC templates (e.g., sensitive shape's threat-model / authn-z / secret-mgmt / audit ACs).
4. **Paste-ready output** — emits the complete entry with shape-specific block (`entities` / `ui_surface` / `performance_budget`) and lockstep paste instructions for both spec.yaml mirrors.
5. **Routing preview** — surfaces the orchestrator agent chain for the detected shape so the user knows what to expect at activate time.

### Pre-merge verification

Multi-shape A/B test (n=4 + 1 adversarial) showed measurable lift across all 4 shapes when no prompt steering is given:
- AC categorical coverage went from 1.5-4 / 4 (without skill) to 4 / 4 (with skill).
- Routing chain accuracy: skill-guided output matched the orchestrator routing table; without-skill output sometimes invented non-existent agent names.
- Schema discipline: skill-guided output never misplaced top-level fields at feature level; without-skill output occasionally did.
- Adversarial baseline (no skill but strong steering) matched skill output, confirming the skill is essentially a saved prompt that auto-loads — value scales with how rarely users hand-type equivalent steering.

Audit trail at `tests/smoke/feature-author/SOAK.md` (now obsolete after merge but kept as design record).

### What is NOT in this release

- The other skill candidates from the recommendation thread (`drift-explain-and-fix`, `acceptance-criteria-craft`, `gate-recover`, `evidence-craft`). Held until external dogfood signal on `feature-author`.
- Auto-write to spec.yaml. Skill emits the entry; the user pastes manually so the human stays in the loop.

### Verification

- `npm run typecheck` clean
- `npm run lint` clean
- `npm run test:parity` 497/497 PASS (was 467 + 30 new across F-114/F-115/F-116)
- `bash self_check.sh` 5/5 OK
- Live schema validate of the sensitive walkthrough output → valid

## [0.13.0] — 2026-04-29

**Python → TypeScript runtime migration. 30 cycles, F-084 → F-113. Umbrella PR #46 (60 commits).**

The whole operational surface — `work` · `sync` · `check` · `status` · `events` · `metrics` · `inbox` · `validate` — is now TypeScript. Python sources moved to `legacy/scripts/` as a read-only regression reference.

### Why migrate

- Fresh-install users on macOS / Windows / stripped Docker hit `command not found` before any helpful message reached them. F-081 / F-082 mitigated but did not eliminate this — the failure mode lived inside Python's import path.
- Other AI CLIs (Cursor, Cline, Aider, Copilot CLI) are all Node-based; extending into them via Python was awkward.
- Claude Code itself runs on Node, so Node is effectively guaranteed on every harness-boot user's machine. Python was not.

### What landed

- **Foundation (F-084)** — project setup (`package.json`, `tsconfig`, `vitest`, `eslint v9`, `prettier`) + `src/core/canonicalHash.ts` byte-equal port + parity test framework.
- **Core ports (F-085 → F-088)** — `core/{eventLog,state,pluginRoot,projectMode,gates,routing}.ts`.
- **Spec / render / scan (F-089 → F-091, F-101)** — `spec/{validate,includeExpander,modeClassifier}.ts`, `render/{architecture,domain}.ts`, `scan/{structure,manifest,areaResolver}.ts`.
- **UI helpers (F-092, F-099, F-103)** — `ui/{lang,messages,dashboardConfig,render,featureResolver,intentPlanner,dashboard}.ts`.
- **Read-only views (F-093, F-094, F-098)** — `events.ts`, `status.ts`, `metrics.ts`.
- **Operational core (F-095 → F-097, F-100, F-102)** — `gate/runner.ts`, `sync.ts`, `ceremonies/{kickoff,retro,designReview,inbox}.ts`, `check.ts` (13-detector drift), `work.ts` (lifecycle orchestrator).
- **Entry + cutover + cleanup (F-104 → F-108)** — `bin/harness` commander shim, audit gates, `legacy/scripts/` archive, Python operational surface removal, post-cutover end-to-end audit.
- **Supply-chain follow-ups (F-109 → F-112)** — install + CI verification, single-file esbuild bundle (~850 KB inlining commander · yaml · ajv · ajv-formats · smol-toml), README dependency-section purge, Node.js requirement line drop (Claude Code already implies Node).
- **Release-prep audit (F-113)** — Python ↔ TS coverage matrix, version lock, v1.0 framing removed. Verdict: 33 direct ports + 5 merged into siblings + 3 deliberately deferred (named inline in `src/work.ts`) + 14 retired-surface drops + 1 documented follow-up + 0 silent gaps.

### Behavioral parity

`tests/parity/` runs Python-generated fixtures against the TypeScript implementations and asserts byte-equal output. **467/467 PASS** at release HEAD across 21 test files. Public APIs match by name (snake_case → camelCase) and by canonical hash where applicable.

### Plugin install path

Claude Code's `/plugin install` mechanism does NOT auto-run `npm install`, and the cached plugin under `~/.claude/plugins/cache/...` has no `node_modules`. F-110 closes this with an esbuild single-file bundle:

- `dist/cli/harness.bundle.mjs` (~850 KB) inlines every runtime dependency.
- `bin/harness` is a 14-line shim that `import()`s the bundle.
- The `bin/` directory is auto-PATHed by Claude Code per the plugin spec, so user-facing calls are plain `harness work F-N` — no absolute path, no `node` prefix, no `$PLUGIN_ROOT/bin/harness.js` boilerplate.

Verified in `/tmp/hb-fresh-test`: copy `bin/`, `dist/`, `docs/`, `commands/`, `agents/`, `hooks/`, `skills/`, `.claude-plugin/` to a temp directory without `node_modules` and run `harness {--version, status, validate, work}` — all green.

### CI updates

`.github/workflows/self-check.yml` now runs `npm install` + `bash self_check.sh` on a Node 20 + Node 22 matrix. No Python step in CI any more.

### What is NOT in this release

- `spec/quant_claims`, `scan/chapter_writer`, `scan/style_fingerprint` — deferred-by-design with an inline comment at `src/work.ts:411-413`. They were never Iron-Law gating, only stderr hints. Will land when there is external pressure.
- `/harness:spec` Mode A/B/R/E CLI — retired in v0.10+; spec edits are direct file edits + `harness check` for drift.
- F-030 sharding utilities (`spec/shard`, `unshard`, `summary`) — one-shot scaling tools, kept in `legacy/scripts/` for direct invocation if needed past ~300 features.
- `spec/upgrade_to_2_3_8.py` — one-shot schema migration; users on the latest schema never run it.

### Breaking changes

None for end users. Slash commands `/harness-boot:init` and `/harness-boot:work` keep their full surface. The `harness` CLI subcommands keep their flag shapes (verified by the parity tests).

For contributors: the source tree moved. `scripts/` is gone in operational use; new code goes into `src/`. Tests under `tests/parity/` run via `vitest` — no `pytest` step needed for normal contribution.

### Audit trail

`.harness/_workspace/audit/F-113.md` carries the full Python ↔ TS coverage matrix with per-file dispositions. `tests/parity/` is the live regression net.

## [0.12.2] — 2026-04-29

**External dogfood feedback batch — graceful optional-dep handling (F-081 + F-082).**

A new external user installed v0.12.1 on macOS system Python 3.9 and reported two install-time blockers within hours:

1. **Blocker** — `/harness-boot:work` dashboard crashes with `ModuleNotFoundError` when neither `tomllib` (Python 3.11+) nor `tomli` is present. The two-step try/except in `scripts/scan/style_fingerprint.py:14-17` catches the first ImportError but the second propagates and aborts module load. `work.py` imports the scan package, so even the read-only dashboard becomes unreachable. Same crash shape in `scripts/scan/manifest.py` and `scripts/scan/seed_spec.py`.

2. **Annoying** — `scripts/sync.py --soft` exits 1 instead of 0 when `pyyaml` is missing. The module-level `import yaml` runs before argparse sees `--soft`, breaking F-076's "soft mode always exits 0" contract. `/harness-boot:init §5.5` invokes `sync.py --soft`, so a fresh init treated the missing optional dep as a hard failure.

Both bugs share a common root: the plugin assumes `pyyaml` / `tomli` are installed (declared in `requirements-dev.txt`) but neither bundles them nor surfaces the missing dep before crashing. Catch-22: the user could not reach the install instructions because the plugin itself could not run.

This release ships two coordinated layers so the first-run experience stays smooth regardless of the user's Python environment.

### Added — `_YAML_AVAILABLE` + nested tomllib import wraps (F-081 inner layer)

`scripts/sync.py` wraps `import yaml` so module load survives when `pyyaml` is absent. `main()` inspects raw `argv` before argparse so `--soft` short-circuits with `sync (initial): fail — pyyaml not available (install via …)` and `return 0` (F-076 contract preserved). The strict path keeps `return 1` with a stderr install hint.

`scripts/scan/{style_fingerprint, manifest, seed_spec}.py` rewrite the import block to a nested try/except — outer catches `tomllib`, inner catches `tomli`, both branches set `tomllib = None`. Every `tomllib.loads` site (style_fingerprint `_pyproject_has`, manifest `extract_project_name` pyproject + Cargo branches, manifest `_detect_python`, manifest `_detect_rust`, seed_spec `_infer_deliverable` Cargo branch) gains a `if tomllib is None: …skip` guard. Pyproject signals are silently lost in degraded mode; the dashboard / kickoff / scan flows keep working.

### Added — `commands/init.md §0.5` Optional dependency preflight (F-082 outer layer)

`/harness-boot:init` now runs a quick `python3 -c "import yaml"` and `import tomllib || import tomli` probe between §0 and §1. When `deps: missing`, init sends the user a single message asking `yes / no / venv`:

* **`yes`** → run `python3 -m pip install --user pyyaml "tomli; python_version<'3.11'"`. If pip fails with `PEP 668 / externally-managed-environment`, ask once more whether to override with `--break-system-packages`. If `no`, fall back to the venv path.
* **`no`** → print the install command for later use, continue init in degraded mode (F-081 backstop).
* **`venv`** → print the `python3 -m venv .venv && source .venv/bin/activate && pip install …` command, continue init.

Init never aborts on dep failure — F-081 graceful degradation handles whatever the user chose. A `deps_preflight` event with `status ∈ {ok, installed, skipped, failed}` is appended to events.log so retro / metrics can track first-visit user flows.

The contract explicitly forbids auto-install: the user's Python environment is their asset, and surprise modification (especially when PEP 668 is in effect) is worse UX than asking once.

### Tests

* `tests/unit/test_sync.py` — `SoftCliTests` +2 cases: `test_soft_cli_returns_zero_when_pyyaml_missing` and `test_strict_cli_returns_one_when_pyyaml_missing` (mock `_YAML_AVAILABLE = False`).
* `tests/unit/scan/test_scan_style_fingerprint.py` — `TestTomllibMissingDegradation` (2 cases: `_pyproject_has` returns False + `fingerprint()` does not raise when `tomllib` is mocked None).
* `tests/unit/test_init_md_preflight_contract.py` (new) — markdown contract test (9 cases): section anchor exists between §0 and §1, detection bash present, three branches documented, pip install command present, PEP 668 fallback documented, venv command present, never-abort clause present, `deps_preflight` event documented.
* 1192 tests pass (1153 unit + 39 integration; +13 new across F-081 / F-082). `bash scripts/self_check.sh` 5/5 OK.

### Notes

* **No auto-install** by design. The plugin asks once, then respects whatever the user chose. F-081 ensures the plugin stays alive in any branch.
* `.harness/_workspace/issues-log.md` carries both reporter entries verbatim with a `✅ FIXED in v0.12.2` resolution note (v0.10.7 cosmic-suika batch-return pattern, second application).
* F-080 was previously the kickoff "Quantitative completeness" section; that work renumbers to F-084. F-081 (carry-forward debt) renumbers to F-085. F-082 was claimed for the init preflight.

## [0.12.1] — 2026-04-29

**v0.12.0 substantive coverage validation — synthetic replay + integration regression (F-080).**

A patch release that closes the v0.12.0 thread by proving the new gates (F-077 lint · F-078 Coverage drift · F-079 dashboard gauge) actually fire on realistic prose, not just on unit-mocked inputs. The original external project that surfaced the failure mode has been "solved via prompt" already (carry-forward acknowledged in retros through human steering), so it is no longer a clean test bed for the new gates. F-080 builds an isolated synthetic replay that reproduces the exact symptom: a feature whose `description` claims `13 ChainTemplate · 74 propagation rule · 35 Heuristic tools` while the AC accepts only `5 / 10 / 1` respectively.

### Added — `tests/integration/test_iron_law_substantive.py`

End-to-end regression that walks the full `activate → gate → evidence → complete` cycle through `scripts/work.py` via `subprocess` (not the unit-mocked layer), so the wiring users actually hit is the wiring tested. Four cases:

- `test_activate_emits_quant_hint_for_each_mismatch` — F-077 stderr `[hint]` pattern + numeric values for each metric.
- `test_activate_persists_fingerprint_file` — `_workspace/coverage/F-1.yaml` exists with the three recorded mismatches.
- `test_complete_rejects_with_coverage_drift` — F-078 returns `action='queried'` with `Coverage` in the message and a `--hotfix-reason` hint.
- `test_hotfix_reason_bypasses_coverage_drift` — F-048 escape hatch preserved; the feature transitions to `done` with a hotfix evidence trail.

Fixture spec uses `mode='prototype'` so the Iron Law evidence threshold stays at 1 and the test stays compact.

### Added — `docs/dogfood-replay-v0.12.0.md`

Operational evidence report capturing the verbatim stdout / stderr from each step of a manual replay run against `/tmp/dogfood-replay-v0.12.0/.harness`. Future readers can see the gates firing on realistic prose without re-running the test. Cross-references the integration test for permanent regression coverage.

### Tests

- 1179 tests pass (1149 unit + 30 integration; +4 new from F-080). Regression 0 from the v0.12.0 baseline. `bash scripts/self_check.sh` 5/5 OK.

## [0.12.0] — 2026-04-29

**Iron Law structural shift — procedural completion → substantive coverage gating (F-077 + F-078 + F-079).**

A three-feature thread that closes a field-discovered failure mode where Iron Law (BR-004) passed despite features covering only ~10–15% of the spec's quantitative targets. BR-004 verified procedural completion (`gate_5 = pass` plus declared evidence count) but did not look inside evidence to confirm the numbers actually matched the spec's promises. A downstream user surfaced the symptom: features whose `description` claimed "13 ChainTemplate" / "74 propagation rule" / "35 Heuristic tools" reached `done` with implementations covering ~38% / ~13% / ~3% of those targets because the AC text happily accepted partial regression PASS and the carry-forward bullets stayed buried in retro Deferred sections.

This release reshapes the response chain end-to-end. F-077 ships the diagnose layer (activate-time stderr lint surfacing description-vs-AC numeric mismatches and persisting fingerprints under `_workspace/coverage/F-N.yaml`). F-078 promotes the lint into a blocking drift kind so `complete()` rejects under-covered transitions; the F-072 fast path absorbs the new detector without paying for the full 13-detector flow. F-079 surfaces the same data in the dashboard and prepends a "review carry-forward debt" suggestion in the intent planner so users see backpressure before they hit the `complete()` rejection.

The Iron Law itself stays procedural by design — substantive coverage gating now sits on the drift surface alongside `Code` / `Stale` / `AnchorIntegration` (F-048's lineage), with `--hotfix-reason` as the unified escape hatch for intentional carry-forward.

This is a minor bump (first since v0.11.0 vision consolidation) because the Iron Law gate semantics widen from "procedural pass" to "procedural pass + substantive coverage drift". Every project that runs `complete()` after upgrade will see the new gate fire whenever F-077 fingerprints accumulate. Patch-shape was considered but rejected: the user-visible behavior of `complete()` changes meaningfully and downstream dogfood projects need to know about the new gate so they can either raise coverage or document explicit carry-forward in retros.

### Added — Dashboard coverage gauge + intent planner carry-forward recommendation (F-079)

Third and final step in the F-077 → F-078 → F-079 thread. The no-args dashboard now reads the F-077 fingerprint files and surfaces:

* A `coverage: NN% (5/13 chaintemplate, …)` line under the active-feature progress line whenever the feature's mean ratio is below 1.0.
* A `Coverage debt: N features with mismatches (M below threshold X.XX)` aggregate section near the bottom.
* An `⚠ Coverage debt high — review carry-forward before next feature` alert line when the below-threshold count exceeds 5.

`scripts/ui/dashboard.render()` gains an optional `harness_dir` kwarg; when omitted the output is byte-identical to the v0.11.x baseline (full back-compat). `_load_coverage(harness_dir, fid)` is the shared reader.

`scripts/ui/intent_planner.suggest()` gains an optional `coverage` kwarg. When the active feature's coverage falls below `_DEFAULT_COVERAGE_THRESHOLD` (0.80 by default), a `review_carry_forward` Suggestion is prepended ahead of the usual gate / completion suggestions. This pre-empts the F-078 `complete()` rejection by surfacing the gap one step earlier — the user can either raise coverage or document explicit carry-forward in the retro before hitting the gate.

`scripts/work.py:_dashboard_snapshot` threads `harness_dir` into both `dashboard.render` and `intent_planner.suggest`. JSON snapshots gain a `coverage` field per active feature.

#### Tests for F-079

- `tests/unit/dashboard/test_dashboard.py` — `CoverageGaugeTests` (5 cases: mismatch fingerprint → coverage line · empty mismatches → no line · missing fingerprint → no line · debt count above 5 → alert · render without harness_dir is byte-identical to baseline).
- `tests/unit/test_intent_planner.py` — `CoverageRecommendationTests` (3 cases: below-threshold prepends carry-forward suggestion · `coverage=None` unchanged · `coverage=1.0` unchanged).
- 1149 unit tests pass (regression 0; +8 new from F-079). `bash scripts/self_check.sh` 5/5 OK.

### Added — 13th drift kind `Coverage` — quant lint becomes a `complete()` blocker (F-078)

Second step in the F-077 → F-078 → F-079 thread. F-077 surfaced description-vs-AC quantitative mismatches as informational stderr hints at activate time; users could still ignore the hint and proceed to `complete()`, where the procedural Iron Law (`gate_5 = pass` plus declared evidence count) would happily transition the feature to `done`. F-078 closes the loop: `Coverage` becomes the 13th drift kind, joins `_BLOCKING_DRIFT_KINDS`, and `complete()` rejects transitions whose description over-promises by more than the configured threshold.

`scripts/check.py:check_spec_coverage(harness_dir, spec_yaml)` reads the F-077 fingerprints under `_workspace/coverage/F-*.yaml` and, for each recorded mismatch, computes `ratio = ac_value / description_value`. When `ratio < threshold` (default `0.80`, override via `harness.yaml.coverage.threshold`), it emits a `severity='error'` finding under `kind='Coverage'`. Missing fingerprint dir, unparseable file, or empty mismatches list → empty findings (no exception).

`scripts/work.py:_BLOCKING_DRIFT_KINDS` adds `'Coverage'`. F-072's `run_blocking_check` fast path extends to call `check_spec_coverage` so `complete()` does not pay for the eight cheap-but-discarded detectors. F-048's `--hotfix-reason` escape hatch bypasses Coverage like every other blocking kind — intentional carry-forward stays expressible without disabling the detector globally.

### Tests

- `tests/unit/test_check.py` — `CheckSpecCoverageTests` (5 cases: low ratio → error · high ratio silent · threshold override `0.30` suppresses · missing coverage dir empty · empty mismatches silent). `StrictRunBlockingCheckTests` updated: `_BLOCKING_KINDS` now `("Code", "Stale", "AnchorIntegration", "Coverage")` and the "invokes each blocking detector exactly once" case now also mocks `check_spec_coverage`.
- `tests/unit/work/test_drift_iron_law_gate.py` — `CoverageBlocksCompleteTests` (2 cases: Coverage error blocks `complete()` and `--hotfix-reason` bypasses). F-048's existing 5 cases (`DriftFreeCompleteTests`, `ErrorDriftBlocksTests`, `WarnOnlyDoesNotBlockTests`, `HotfixOverridesDriftTests`, `CheckFailureGracefulTests`) untouched and pass.
- 1141 unit tests pass (regression 0; +7 new from F-078). `bash scripts/self_check.sh` 5/5 OK.

### Notes

The Iron Law itself stays procedural by design — substantive coverage gating sits on the drift surface alongside `Code` / `Stale` / `AnchorIntegration` (F-048's lineage). F-079 will surface coverage % directly in the dashboard so the gauge is visible without invoking `check.py`.

### Added — `_autowire_quant_lint` in `scripts/work.py:activate()` (F-077)

First step in the three-feature thread (F-077 → F-078 → F-079) that addresses an Iron Law structural gap: BR-004 verifies procedural completion (`gate_5 = pass` plus declared evidence count) but does not look inside evidence to confirm the numbers actually match the spec's quantitative targets. A field-discovered failure mode: features whose `description` promised "13 ChainTemplate" / "74 propagation rule" / "35 Heuristic tools" reached `done` with implementations covering ~38% / ~13% / ~3% of those targets because the AC text happily accepted partial regression PASS and the carry-forward bullets stayed buried in retro Deferred sections.

`scripts/spec/quant_claims.py` (new) parses three pattern families — `<int> <counter-noun>` (incl. multi-token tails like "74 propagation rule"), `≥/>= <int>` thresholds, and `<int>/<int>` fractions. The Korean counter `개` is preserved as a distinct metric. `extract_numeric_claims(text)` returns `Claim(metric, value, span)` tuples; `diff_claims(description, ac_texts)` returns `Mismatch(metric, description_value, ac_value)` for metrics that appear on both sides where `description_value > ac_value`. Metrics absent from either side are silently skipped — no false-positive "AC missing" noise.

`scripts/work.py:_autowire_quant_lint` runs at activate time, between `_autowire_initial_sync` and `_autowire_fog_clear`. It writes the parse result to `_workspace/coverage/F-N.yaml` (fingerprint reused by F-078 / F-079) and prints one stderr `[hint]` line per mismatch:

```
[hint] description claims 13 chaintemplate but AC accepts 5 — explicit carry-forward to retro recommended
```

The autowire is informational only — fail-open like its siblings, never blocks `activate()`. F-077 closes the diagnosis half of the response chain; F-078 will turn the same fingerprint into a blocking drift kind on `complete()`.

### Tests

- `tests/unit/test_quant_claims.py` — `ExtractNumericClaimsTests` (6 cases) + `DiffClaimsTests` (5 cases including order-stable output by metric token).
- `tests/unit/work/test_work_autowire.py` — `QuantLintAutowireTests` (3 cases: hint emitted on mismatch · silent on matching values · fail-open under monkeypatch on extractor failure).
- 1134 unit tests pass (regression 0 from the v0.11.12 baseline of 1120 + 14 new). `bash scripts/self_check.sh` 5/5 OK.

### Queued

- Marketplace submission to anthropic/claude-plugins-official — submission templated text prepared; user submits via https://claude.ai/settings/plugins/submit. README install snippet update queued for after approval.
- F-052 follow-up — broader `scripts/` Python docstring sweep across check.py, work.py, gate/runner.py, sync.py and others (~25 files of KO-bearing docstrings still queued).
- F-053 follow-up — `tests/` Python docstring sweep (~99 files queued; per-area batch execution recommended).
- F-051 follow-up — older active features (F-002/F-004/F-006/F-011~F-040) description / AC body sweep.
- Pre-marketplace polish follow-ups — `plugin.json.repository` field, `commands/init.md` header version marker (deferred from F-055 to keep that feature focused).
- F-073 (`read_events(tail=N)` for status/dashboard) and F-074 (`canonical_hash` mtime cache) — both still queued from the v0.11.11 cumulative-slowdown audit; they will be sequenced individually if external usage surfaces the need.

## [0.11.12] — 2026-04-29

**Initial sync auto-wire — close the post-init / post-conversion gap (F-075 + F-076).**

A two-feature bundle that closes a field-discovered gap: previously, `/harness-boot:init` followed by the `spec-conversion` skill could produce a populated `spec.yaml` without ever materializing `domain.md`, `architecture.yaml`, or `harness.yaml.generation.generated_from.spec_hash`. Users could iterate through several `/harness-boot:work` cycles before noticing the derived views were missing and the `CLAUDE.md` `@import` lines pointed at non-existent files. Three entry points (init markdown · `spec-conversion` skill · `work.py` per-feature cycle) each treated `sync` as a separate manual concern; none of them wired `python3 scripts/sync.py` into its finalize path.

This release wires all three. F-075 ships the inner Python guard inside `scripts/work.py:activate()` so the very first feature cycle catches the missing-sync state. F-076 wires the two upstream surfaces (`commands/init.md` §5.5 and `skills/spec-conversion/SKILL.md` Stage 5) so derived views are materialized as soon as a populated `spec.yaml` exists — eliminating the post-install / post-conversion stutter where the first work cycle had to fire sync before kickoff bullets could reference `domain.md`.

### Added — Upstream sync wiring: `try_initial_sync` helper + `--soft` CLI + init / spec-conversion finalize (F-076)

Follow-up to F-075. F-075 closed the inner Python guard so the very first feature cycle catches the missing-sync state, but the upstream entry points (`commands/init.md`, `skills/spec-conversion/`) still treated `sync` as a separate manual concern. This release wires both upstream surfaces so derived views (`domain.md`, `architecture.yaml`) and `harness.yaml.generation.generated_from.spec_hash` are materialized as soon as a populated `spec.yaml` exists — eliminating the post-install / post-conversion stutter where the first `/harness-boot:work` cycle had to fire sync before kickoff bullets could reference `domain.md`.

Three coordinated additions:

1. **`scripts/sync.try_initial_sync(harness_dir) -> dict`** — a public fail-open wrapper around `sync.run()`. Never raises; returns a status dict with `ok: bool`, `reason: str`, optional `skipped: bool`. Skips when `harness.yaml.spec_hash` is already populated (idempotent under canonical hashing). Decision tree: `spec.yaml` missing → `skipped: True, ok: False, reason: 'spec.yaml missing'`; already synced → `skipped: True, ok: True`; otherwise call `run()` and wrap any exception as `ok: False, reason: '<ClassName>: <msg>'`.

2. **`scripts/sync.py --soft` CLI flag** — calls `try_initial_sync`, prints one human-readable line `sync (initial): <ok|skip|fail> — <reason>`, and exits 0 unconditionally. Existing flags (`--dry-run`, `--force`, `--json`, `--skip-validation`, `--schema`, `--timestamp`) continue to operate against the strict `run()` path; `--soft` is a separate fail-open mode for upstream finalize bash blocks.

3. **`commands/init.md` §5.5 + `skills/spec-conversion/SKILL.md` Stage 5** — both finalize stages now invoke `python3 "$PLUGIN_ROOT/scripts/sync.py" --harness-dir "$(pwd)/.harness" --soft`. Stub specs from init menu options 1 / 2 fail schema validation and `--soft` prints `sync (initial): fail — <reason>` and still exits 0; option 3 (brownfield) and `spec-conversion` output rich specs that succeed and print `sync (initial): ok — synced`. The F-075 autowire inside `scripts/work.py:activate()` remains the inner safety net.

### Changed — `_autowire_initial_sync` delegates to `try_initial_sync`

`scripts/work.py:_autowire_initial_sync` is now a thin wrapper that calls `sync.try_initial_sync(harness_dir)` and converts the status dict into the existing stderr `[warn] initial sync auto-wire failed: ...` contract. Same external behavior as F-075; the duplication between the two implementations is gone.

### Tests

- `tests/unit/test_sync.py` — `TryInitialSyncTests` (5 cases: fresh-runs · already-synced-skips · missing-spec-no-run · schema-invalid-soft-fails · run-exception-caught) + `SoftCliTests` (3 cases: success · schema-failure · spec-missing all return rc=0) + `MarkdownContractTests` (init.md and SKILL.md both contain the `--soft` invocation).
- `tests/unit/work/test_work_autowire.py` — F-075's `InitialSyncAutowireTests` (5 cases) pass unchanged after the autowire refactor; the stderr `[warn]` contract is preserved verbatim.
- Total: **1120 unit tests pass**. `bash scripts/self_check.sh` 5/5 OK.

### Added — `_autowire_initial_sync` in `scripts/work.py:activate()` (F-075)

Closes a field-discovered gap: when a downstream user ran `/harness-boot:init` followed by the `spec-conversion` skill, the resulting `spec.yaml` was populated but `domain.md`, `architecture.yaml`, and `harness.yaml.generation.generated_from.spec_hash` remained absent / empty. Several feature cycles could complete before the missing derived views were noticed, leaving the `CLAUDE.md` `@import` lines pointing at non-existent files. Root cause: three entry points (init markdown · `spec-conversion` skill · `work.py` per-feature cycle) each treat `sync` as a separate manual step; none of them wires `python3 scripts/sync.py` into its finalize path.

`scripts/work.py` now ships a fourth autowire — `_autowire_initial_sync(harness_dir)` — that fires from `activate()` before `_autowire_fog_clear` / `_autowire_kickoff` / `_autowire_design_review`. Trigger condition: `spec.yaml` is present **and** (`harness.yaml` is missing **or** its `generation.generated_from.spec_hash` is empty/absent). On trigger it imports `scripts.sync` and calls `sync.run(harness_dir)`. `sync.run` is idempotent under canonical hashing, so subsequent activations are no-ops once `spec_hash` has been populated. Failures are fail-open — a stderr warning is printed and `activate()` proceeds — matching the existing autowire pattern; a ceremony glitch must never block a feature transition.

The `commands/init.md` and `skills/spec-conversion/` finalize paths remain candidates for future wiring (queued separately) — but the inner Python guard catches every case regardless of which upstream path the user took.

### Tests

- `tests/unit/work/test_work_autowire.py` — `InitialSyncAutowireTests` (5 cases): fresh harness fires sync and renders both derived views; already-synced harness is a no-op (`sync.run` not re-invoked); missing `spec.yaml` is a silent skip; `sync.run` exception is fail-open with the expected stderr warning; sync ordering precedes kickoff in `events.log`.
- Regression: **1110 unit tests pass**. `bash scripts/self_check.sh` 5/5 OK.

### Queued

- Marketplace submission to anthropic/claude-plugins-official — submission templated text prepared; user submits via https://claude.ai/settings/plugins/submit. README install snippet update queued for after approval.
- F-052 follow-up — broader `scripts/` Python docstring sweep across check.py, work.py, gate/runner.py, sync.py and others (~25 files of KO-bearing docstrings still queued).
- F-053 follow-up — `tests/` Python docstring sweep (~99 files queued; per-area batch execution recommended).
- F-051 follow-up — older active features (F-002/F-004/F-006/F-011~F-040) description / AC body sweep.
- Pre-marketplace polish follow-ups — `plugin.json.repository` field, `commands/init.md` header version marker (deferred from F-055 to keep that feature focused).
- F-073 (`read_events(tail=N)` for status/dashboard) and F-074 (`canonical_hash` mtime cache) — both still queued from the v0.11.11 cumulative-slowdown audit; they will be sequenced individually if external usage surfaces the need.

## [0.11.11] — 2026-04-29

**`complete()` drift gating fast path — `run_blocking_check` (F-072).**

A targeted performance patch for the most-frequented hot path. v0.11.1's F-048 wired `complete()` into `scripts/check.py:run_check`, which always runs all 11 drift detectors and then keeps only findings whose kind is in `_BLOCKING_DRIFT_KINDS = {Code, Stale, AnchorIntegration}`. The other 8 detectors were computed and discarded on every feature transition. As `.harness/` self-dogfood accumulated (71 features at v0.11.10, plus a continuously growing `src/` tree under each `Stale` walk), the latency surfaced.

### Added — `scripts/check.run_blocking_check()` (F-072)

A new entry point that runs only the three wire-integrity detectors `complete()` actually blocks on (`check_code` + `check_stale` + `check_anchor_integration`) and returns the same `CheckReport` shape as `run_check`. `scripts/work.py:complete()` now imports and calls `run_blocking_check` instead of `run_check`. The user-facing `python3 scripts/check.py` route is untouched — full diagnostic output stays available via `run_check`.

### Changed — `complete()` drift call site

`scripts/work.py:complete()` (the `if not hotfix_reason:` block) calls `run_blocking_check(harness_dir)` in place of `run_check(harness_dir)`. F-048's gate semantics (`severity='error'` × `kind ∈ _BLOCKING_DRIFT_KINDS`) are preserved verbatim because `_BLOCKING_DRIFT_KINDS` already filtered the same kinds out of `run_check`'s larger result. The 7 cases in `tests/unit/work/test_drift_iron_law_gate.py` pass after a one-line `unittest.mock.patch` retarget from `check.run_check` to `check.run_blocking_check`; the gate logic itself is unchanged.

### Performance

In-process 5-iteration mean on the v0.11.11 `.harness` baseline (71 features, ~75 modules, full repo `src/` tree):

- `run_check` (full 11-detector flow): **239.9 ms**
- `run_blocking_check` (3-detector fast path): **66.3 ms**
- Reduction: **−72.4 %**

End-to-end `time python3 -c '...'` invocations show the same shape (273 ms → 105 ms; Python startup dominates the smaller value). The complete-path drift overhead is now back below the v0.11.0 baseline that did not run drift checks at all in `complete()`.

### Tests

- `tests/unit/test_check.py` — `StrictRunBlockingCheckTests` (5 cases) + `CompleteUsesBlockingFastPathTests` (2 cases). Mocks the 9 non-blocking detectors and asserts they are not invoked from `run_blocking_check`; verifies the 3 blocking detectors are each called exactly once; source-level scan asserts `scripts/work.py` imports `run_blocking_check` and no longer references `run_check(harness_dir)`.
- `tests/unit/work/test_drift_iron_law_gate.py` — F-048's 7 cases retargeted to the new mock site.
- Total: **1105 unit tests pass**. `bash scripts/self_check.sh` 5/5 OK.

### Notes

This release closes the most acute item from the cumulative-slowdown audit (`plan/velvet-yawning-ocean.md` Phase A). Two follow-ups remain queued as separate features: F-073 (`read_events(tail=N)` for status/dashboard) and F-074 (`canonical_hash` mtime cache). Neither ships in this release — both will be sequenced individually if external usage surfaces the need.

## [0.11.10] — 2026-04-28

**Manual install guide for both READMEs + canonical commit sequence enforced + Korean rewrite (F-068 → F-071).**

A four-feature bundle. F-068 was queued from v0.11.9; F-069/F-070/F-071 land in this release. The headline change is F-070, which turns the F-068/F-069 commit-ordering quirk (both required `HARNESS_BYPASS_PRE_COMMIT=1` to land) into a deterministic guard inside `complete()`. F-070 itself shipped without any hook bypass — the guard self-validated.

### Changed — plugin.json keywords refresh (F-068, originally queued in v0.11.9)

`.claude-plugin/plugin.json` keywords drop `agent-workflow` and `walking-skeleton`; add `multi-agent`, `ai-coding`, `agent-harness`. Final set: `claude-code · harness · multi-agent · ai-coding · spec-driven · agent-harness` (6 keywords). Aligned with the directory-listing tags about to be submitted to claude-plugins-official.

### Added — Manual install guide in both READMEs (F-069)

A new `## Manual install` / `## 수동 설치` section after Quick start in `README.md` and `README.ko.md`. The section walks the contributor / fork / offline path: `git clone` → `/plugin marketplace add /absolute/path` → `/plugin install harness-boot@harness-boot`, plus `git pull` + `/plugin marketplace update harness-boot` for updates.

A one-line note clarifies that harness-boot is not currently listed in the official Claude Code marketplace, so the existing Quick start `qwerfunch/harness-boot` form resolves to this GitHub repo directly. Unverified install paths (`CLAUDE_PLUGIN_ROOT`, `~/.claude/settings.json plugins[]`) stay confined to `docs/archive/local-install-v0.1.0.md` and do not surface in either README.

Quick start commands are preserved verbatim — Manual install is additive, not a replacement.

### Added — complete-time working tree guard + canonical commit sequence (F-070)

`scripts/work.py::complete()` now runs `git status --porcelain --untracked-files=all` before Iron Law evaluation. If any non-whitelisted path is dirty, the call returns `action=queried` with a message naming the canonical sequence and refuses to transition state. Non-git projects bypass the guard silently. `hotfix_reason` does NOT bypass — working-tree-clean is an audit-trail invariant about *what code is part of a "done" feature*, orthogonal to Iron Law's evidence-count concern.

Whitelist mirrors the F-034 pre-commit hook: `.harness/state.yaml`, `.harness/_workspace/**`, and `CHANGELOG.md`. work.py mutates these as part of the cycle itself; treating them as dirtiness would make the canonical sequence unreachable.

The canonical sequence is now made explicit in `commands/work.md` Typical scenario:

```
... gate_0..3, gate_5, --evidence ...
git commit -m "feat(F-N): ..."     # active=F-N still set; F-034 hook passes
/harness-boot:work F-N --complete  # done
```

Why this matters: F-068 and F-069 both committed *after* `--complete`, which leaves `active_feature_id = null`, which the F-034 hook treats as a work.py bypass — both relied on `HARNESS_BYPASS_PRE_COMMIT=1`. The guard turns that silent escape hatch into an explicit rejection at the exact decision point. F-070 itself was the first feature shipped via the new sequence (no bypass).

Six new unit tests in `WorkingTreeGuardTests` cover dirty working tree reject · dirty staging reject · clean pass · `hotfix_reason` does not bypass · message contents · whitelisted-only-changes pass; one new test in `CompleteTests` documents the non-git skip path.

### Changed — README.ko.md manual install rewritten in native Korean (F-071)

The 수동 설치 section landed in F-069 as a literal translation of the English copy and read awkwardly to native Korean speakers — calque phrases (`self-hosted 마켓플레이스로 동작합니다`, `덕분에 클론 자체가`, `· fork · 오프라인 환경용`, `위 X 형식은 Y 를 직접 가리킵니다`) leaked through.

Rewritten so it reads as text a Korean speaker would write from scratch: sentence ordering / particles / verb endings chosen for Korean readers, `·` noun lists replaced with `또는` / comma joins, marketplace status note reframed (`등록되어 있지 않습니다` / `곧장 등록하는 형태입니다`). Path placeholder switched from `/절대경로/to/harness-boot` to `/Users/your-name/harness-boot` plus a `pwd` hint, less translation feel. README.md (English) is untouched.

A feedback memory (`feedback_korean_native_writing.md`) was added alongside this feature so future Korean documents are written natively rather than translated.

### Internal — test count + version markers

- 1126 tests passing (was 1117 in v0.11.9; +9: F-070's 7 working-tree-guard tests + 2 incidental).
- Plugin version: `0.11.9 → 0.11.10` in `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, README badges, and Status section.

## [0.11.9] — 2026-04-28

**Portfolio ergonomics: cosmic-suika preview lands + Built-with contribution flow aligned with OSS norm + license tagline + assets guide trimmed (F-062 → F-067).**

A six-feature bundle on the *Built with harness-boot* portfolio surface and surrounding copy. No behavior change.

### Changed — cosmic-suika preview image landed (F-062)

`docs/assets/cosmic-suika.png` (494 KB, comfortably under the 1 MB PNG budget) is committed. README portfolio Preview cells (EN + KO) now render a real `<a><img width="240"></a>` linked to the live demo at <https://qwerfunch.github.io/cosmic-suika-pages/>. The `_(image landing soon)_` / `_(이미지 곧 추가)_` placeholders are gone. `docs/assets/README.md` inventory row no longer marks cosmic-suika as placeholder; file extension is `.png` (screenshot, not GIF).

### Changed — KO portfolio description: 머지 → 수박 (F-063)

The KO row described cosmic-suika as "우주 테마 머지 게임", but the genre is more widely recognized in Korean as "수박 게임" (after the Suika Game reference). Single-word KO copy fix. EN row keeps "Space-themed merge game" — the term is global there.

### Changed — README copy polish: image format softening + assets guide EN + license tagline (F-064)

Three small README copy fixes:

1. The Built-with image format constraint `(1–3 seconds, ≤ 800px wide, ≤ 5 MB)` softened to *"Send any image, GIF, or screenshot that shows the project — plus a one-liner and a link. We'll optimize and place it on merge."* The strict-looking gate in front of contributors became a *"target, not a hard limit"* invitation. KO mirror tracks: *"이미지·GIF·스크린샷 무엇이든... 머지 전에 메인테이너가 다듬어 적용합니다."*
2. `docs/assets/README.md` rewritten in English (audience is external contributors), with the format spec rephrased as *"target, not a hard limit"* and an explicit *"send it anyway, we'll optimize on merge"* line.
3. License line `MIT — qwerfunch` → `MIT — Free to use, free to fork.` in both EN and KO mirrors. KO carries the English wording verbatim per user direction — light/friendly tone over a maintainer ID.

### Changed — Built-with contribution flow: OSS-standard PR-first (F-065)

The *Built something?* line treated PR and issue as equal channels. Aligned with OSS norm (awesome-* lists, vercel/showcase, tailwindcss/showcase, homebrew formula PRs): PR is now the primary path with a one-line template hint *"copy an existing row as a template"*. Issue is the fallback (*"if a PR is overkill"* / *"양식이 번거로우시면"*). `docs/assets/README.md` Option A (PR) gains a `(recommended)` label and the same template hint. Email is intentionally not exposed in the README.

### Changed — docs/assets/README.md trailing line: fact fix then trim (F-066 / F-067)

The trailing line previously claimed *"Every asset in this directory is automatically referenced from the main README"* — not true; the wiring is manual (a row has to be added to the *Built with harness-boot* table by hand). F-066 corrected the fact, but the new wording read as 구구절절. F-067 then dropped the trailing line entirely — the *How to add* block above already explains the wiring step, so the closing mantra was redundant. The file now ends at the *How to add* code fence.

### Changed — Status line bumped to v0.11.9

Both README mirrors' Status line was stale at `v0.11.5`. Now reflects the actual release.

### Pillar 6 — F-062 → F-067 dogfood evidence

Six work.py 4-verb cycles ran on `.harness/`, each landing `gate_0 PASS · gate_5 PASS` plus 3 evidence entries before transitioning to `done`. `scripts/self_check.sh` 5/5 OK including the canonical-vs-`.harness/` lockstep. 1119 unit + integration tests pass.

## [0.11.8] — 2026-04-28

**README first-impression bundle: Quick start two-form, portfolio Preview column, conversation rewrite, ① verb consistency, status-as-English, friendly-main message format (F-058 / F-059 / F-060 / F-061).**

A user-driven readability pass on the README first impression and the live `/harness-boot:work` output, run as four small features. Behavior is unchanged; this is display-layer only.

### Changed — Quick start lists both entry points (F-058)

The Quick start now spells out both `/harness-boot:init "<idea>"` (one-line idea) and `/harness-boot:init plan.md` (existing planning doc) on separate lines. The plan.md form was hidden behind the spec-conversion skill description, so first-time readers missed that the harness accepts both shapes.

### Changed — "Built with harness-boot" portfolio table gains Preview column (F-058)

The portfolio table had no slot for a preview image, even though the row immediately below recommends "image or GIF (1–3 seconds, ≤800px wide, ≤5 MB)". When the cosmic-suika preview lands it now has somewhere to go. Cosmic-suika row carries a placeholder cell that flips to an `<img>` once the asset is committed.

### Changed — "A short conversation" rewritten as a happy path (F-058)

The conversation example demonstrated the Iron-Law guardrail (insufficient evidence → 4-option escalation: prototype mode / `--hotfix-reason` / cancel / add evidence) but skipped the happy path that most first readers need. Replaced with a compact happy-path walkthrough: activate → run gates → Iron Law satisfied → mark done → retro auto-written → next feature. Less jargon up-front, same 5-block shape.

### Changed — ① heading verb consistency + intermediate-language framing (F-059)

Diagram column ① main↔sub-text swapped: main reverts to the verb `Convert / 변환`, sub-text becomes the noun `(the context) / (컨텍스트)`. All five mains read as verbs again (Convert · Evolve · Focus · Collaborate · Unify). Table row 1 heading and body update in lockstep — body uses verb form (`Plain-language ideas convert into ...` / `... 중간언어(명세)로 변환합니다`).

The conversation block paired system terms with friendly glosses for the first time: `gate_0 (tests) PASS — 19 unit tests`, `Iron Law satisfied (gate_5 + evidence)`. The system terms line up with actual `work.py` output and the glossary; the glosses make first-time reading easier.

### Changed — KO conversation status tokens to English (F-060)

The KO mirror's conversation example used Korean status verbs (`통과` / `건너뜀`) which read as natural-language prose rather than category values, and they didn't line up with what `work.py` actually prints (`PASS` / `FAIL` / `SKIPPED` in English). Swapped the two bare status tokens — surrounding Korean prose stays Korean (`Iron Law 충족`, `단위 19 개`, `도구 미감지`, `F-3 끝낼까요?`).

### Changed — friendly main + system identifier in parens (F-061)

The format flipped one more time, this time inverting `gate_X (friendly)` to `friendly (gate_X)`. The friendly term reads first; the system identifier rides along as the parenthetical reference. The same swap applies to feature references: `F-3 (Login)` → `Login (F-3)`.

`scripts/work.py` gained a `GATE_FRIENDLY` dict (`gate_0=tests` · `gate_1=type check` · `gate_2=lint` · `gate_3=coverage` · `gate_4=commit check` · `gate_5=smoke run` · `gate_perf=performance`) and a `_friendly_gate()` helper. The run-gate response message and the complete-rejection message both flow through it. Live output now reads `tests (gate_0) PASS` and `cannot complete — smoke run (gate_5) is not PASS yet`.

README.md / README.ko.md conversation examples updated in lockstep, and the broken `README.ko.md:136` line (left from a mid-edit interrupt during F-060) was restored as part of the swap.

### Fixed — two integration tests that parsed message strings positionally (F-061)

`tests/integration/test_scenario_mappings.py` and `tests/unit/work/test_work_autowire.py` each had one assertion that did `res.message.split()[1]` to grab the status keyword. With the new format that token is `(gate_0)` instead of `PASS`. Both tests were rewritten to scan tokens for `PASS`/`FAIL`/`SKIPPED` regardless of position — robust to display-layer wording shifts.

### Internal layer unchanged

- `state.yaml` keys (`gate_5:`, etc.)
- CLI arguments (`--gate gate_0 pass`, `--run-gate gate_5`)
- Function names, code constants, `gate_X` identifiers
- 1119 unit + integration tests (2 skipped) pass

### Pillar 6 — F-058 / F-059 / F-060 / F-061 dogfood evidence

Four work.py 4-verb cycles ran on `.harness/`, each landing `gate_0 PASS · gate_5 PASS` plus 3 evidence entries before transitioning to `done`. `scripts/self_check.sh` 5/5 OK including the canonical-vs-`.harness/` lockstep. CI 4-leg matrix (py3.10/11/12/13) expected green.

## [0.11.7] — 2026-04-28

**README hero diagram ① sub-text refinement: input → mechanism (F-057).**

A docs-only follow-up to v0.11.6. After ① shifted to *Context* (a noun naming the result), the diagram sub-text on column ① still pointed at the *input* side (`(your words)` / `(자연어)`), while the other four columns each pointed at something tied to their heading. ① alone broke the pattern.

### Changed — diagram sub-text on column ①

- `README.md:21`: `(your words)` → `(conversion)`
- `README.ko.md:21`: `(자연어)` → `(변환)`

The five sub-texts now each form a closed pair with their heading, on different but deliberate axes:

| Heading | Sub-text | Pair shape |
|---|---|---|
| ① Context (the result) | (conversion / 변환) | result ↔ act |
| ② Evolve (the act) | (the docs / 문서) | act ↔ target |
| ③ Focus (the act) | (the rules / 제어) | act ↔ how |
| ④ Collaborate (the act) | (the experts / 전문가) | act ↔ who |
| ⑤ Unify (the act) | (two commands / 명령 통합) | act ↔ form |

No forced uniformity — the sub-texts intentionally sit on five different axes (act / target / how / who / form), which keeps each cell informative without tipping into tautology like "(collaboration-method)".

### Pillar 6 — F-057 dogfood evidence

`gate_0` PASS · `gate_5` PASS · 3 evidence · status=done. Two README mirrors, line 21 only. `scripts/self_check.sh` 5/5 OK.

## [0.11.6] — 2026-04-28

**README Five Strengths terminology refinement: ① Translate → Context, with intermediate-language framing (F-056).**

A docs-only patch tightening row 1 of the Five Strengths table after a user-driven validation pass. The four other labels (Evolve · Focus · Collaborate · Unify) are preserved verbatim — Evolve maps to the harness's living-spec metaphor, Focus and Collaborate stay strong, and Unify is the 5-stage culmination point (not just a 2-command consolidation). Behavior is unchanged.

### Changed — ① heading: Translate → Context

The label shifts from a verb (act of translation) to a noun (the context AIs rely on). "Context" is a stronger framing for the AI-tool space, and it lines up with how the harness actually works: spec.yaml + domain.md + architecture.yaml form the living context every agent reads from.

- `README.md`: ① diagram column and table row 1 → `Context`
- `README.ko.md`: ① 다이어그램 / 표 1행 → `컨텍스트`

### Changed — ① body: intermediate-language framing

The row 1 body now names the mechanism explicitly. Natural words become an *intermediate language* — a structured spec that every AI agent can act on directly.

- EN: *"Your plain-language ideas become an intermediate language — structured specs that every AI agent can act on directly"*
- KO: *"사람의 자연어를 AI 가 이해할 중간언어(명세)로 정리합니다 — 모든 에이전트가 같은 컨텍스트에서 출발합니다"*

The "What you get" cell follows suit: *"Same context for every agent — less guessing, sharper output"* / *"모든 에이전트가 같은 맥락에서 출발 — AI 가 헷갈리지 않습니다"*.

### Fixed — ③ EN sub-text drift

The diagram's ③ Focus sub-text on the EN side read `(the agents)`, which conflicted with the KO mirror's `(제어)` and with the section semantics (③ is about Iron-Law-enforced rules and agent lanes; the agent itself is the subject of ④ Collaborate's `(the experts)`). Corrected to `(the rules)`. KO unchanged.

### Fixed — Status line stale

`README.md:177` and `README.ko.md:178` both still showed `v0.11.3`. Bumped to `v0.11.5` (the previous release) on each side, then this patch lands as `v0.11.6` — version badges and `Status` line now agree.

### Pillar 6 — F-056 dogfood evidence

F-056 ran through the work.py 4-verb cycle on `.harness/` — `gate_0` PASS, `gate_5` PASS, three evidence entries before transitioning to `done`. Two README mirrors only; no behavior change. `scripts/self_check.sh` 5/5 OK including the canonical-vs-`.harness/` lockstep.

## [0.11.5] — 2026-04-28

**Pre-marketplace polish: refresh `commands/work.md` from v0.3 tense to current v0.11.x state (F-055).**

A docs-only patch that updates the body of `/harness-boot:work` so an external evaluator (or a new user) reading the slash command cold no longer sees a project frozen at v0.3. Behavior is unchanged.

### Changed — `commands/work.md` body

- The opening paragraph dropped the *"In v0.3 scope you (or CI) run the actual gate"* phrasing. The gate runner has run gate_0–5 + gate_perf automatically since v0.10.x; the new wording reflects that.
- The former *"v0.3 boundary"* callout (which still claimed gate_5 runtime smoke automation was *"out of scope (v0.4+)"*) is replaced by a present-tense *"Automation scope"* block listing the auto-detected toolchains (pyproject, npm, Cargo, go.mod) and reaffirming that work.py is the ledger, the runner does the work.
- The `(v0.3.1+, Phase 1)` / `(v0.3.5+)` / `(v0.3.6+)` / `(v0.3.7+)` historical markers attached to gate auto-detect bullets were removed. CHANGELOG and git tags remain the source of truth for when each gate auto-runner landed; the slash-command body should narrate the present.

`grep -n "v0\.3" commands/work.md` now returns zero matches (AC-1).

### Pillar 6 — F-055 dogfood evidence

F-055 ran through the work.py 4-verb cycle (`activate · run-gate · evidence · complete`) on `.harness/`, recording `gate_0 PASS` and `gate_5 PASS` plus three evidence entries before transitioning to `done`. The change touches one file (`commands/work.md`); related cleanups (`plugin.json` `repository` field, `commands/init.md` header version marker) are deliberately deferred to follow-up patches and tracked in `[Unreleased]`.

## [0.11.4] — 2026-04-28

**External-surface polish: English-master README, plugin description rewrite, Python 3.10 CI fix, stale-data corrections.**

A documentation-and-CI hotfix that closes the gaps surfaced during the README professional-review pass and the Python 3.10 CI failure. No feature behavior changes — the entire release is content and packaging.

### Changed — README v3 → v11 (English master + Korean mirror)

The README was rewritten across nine iterative passes around the user-articulated five strengths: **Translate · Evolve · Focus · Collaborate · Unify**. The harness metaphor (loose horse vs. harnessed horse) drives the hero, and the portfolio table includes a real entry (cosmic-suika) plus a "Yours next" slot for community submissions.

- `README.md` — now native English (not a translation). Hero: *"Your AI has speed. We give it direction."*
- `README.ko.md` — Korean mirror, preserves the v10 prose verbatim.
- Both files carry a top-line language toggle (`[English](README.md) · [한국어](README.ko.md)`) so users round-trip in one click.
- `docs/assets/README.md` — portfolio asset guide for community contributions (image/GIF format spec).

The README structure now reads as a calm specification — five strengths in one table, one architecture diagram, a portfolio table, and a short conversation example. The previous "feature parade" tone (lists, badges, jargon) is gone.

### Changed — Plugin manifest descriptions in native English

Both `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` now carry the same hero-tone English description aligned with the new README structure:

> *"Multi-agent development harness for Claude Code. Your AI has speed; we give it direction — through living specs and focused specialist agents."*

The previous Korean description leaked command names (`/harness-boot:init`, `/harness-boot:work`); the new wording stays at the value-proposition layer where a marketplace card belongs.

### Fixed — Python 3.10 CI matrix

`scripts/scan/{style_fingerprint, seed_spec, manifest}.py` imported `tomllib` directly. That module joined the standard library only in Python 3.11, so the 3.10 leg of `.github/workflows/self-check.yml` was failing on every push with `ModuleNotFoundError: No module named 'tomllib'`.

```python
try:
    import tomllib  # Python 3.11+
except ImportError:
    import tomli as tomllib  # Python 3.10 backport
```

`requirements-dev.txt` now adds `tomli; python_version < "3.11"`. The runtime API of `tomli` is identical to `tomllib`, so no other code changes were needed. Honors the README-stated "Python 3.10+" promise.

### Fixed — stale data in README and marketplace manifest

- `marketplace.json` `plugins[0].version`: `0.10.3` → `0.11.3` → `0.11.4`. The previous value had not moved across five releases (a self-doc drift exactly matching the F-051 13th-detector hypothesis).
- `README.md` — version, test count, drift detector count all aligned with the running build.

### Numbers

- 1117 unit + integration tests, regression 0
- self_check 5/5
- README iterations: 9 commits (v3 through v11), each addressing a specific user feedback round
- 12 + 1 commits bundled (12 in v0.11.3 push + 1 release commit here)

## [0.11.3] — 2026-04-28

**Native English consolidation thread closes — F-051 + F-052 + F-053 (partial / deferred) + F-054 (policy).**

Continues the post-F-041 native-English consolidation thread from v0.11.2 (F-049 + F-050) and closes the thread with an explicit going-forward language policy.

### Added

- **F-051 (Phase 2b, partial)** — features[] description bodies for F-042 ~ F-048 rewritten in native English. F-051 ~ F-054 spec entries themselves authored in native English (self-evidence). KO line count in spec.yaml: 666 → 662 in this commit; the older active features (F-002 / F-004 / F-006 / F-011 ~ F-040) keep their KO bodies — full sweep deferred (recorded in F-051 evidence and `[Unreleased]` above).

- **F-052 (Phase 3, partial)** — `scripts/README.md` (the highest-visibility entry point inside `scripts/`) rewritten end-to-end in native English (52 KO lines → 0). Other `scripts/` Python files keep their KO docstrings — comprehensive sweep deferred (`[Unreleased]`). `scripts/ui/messages.py` KO is intentional (F-040 i18n catalog).

- **F-053 (Phase 4, deferred)** — `tests/` Python docstring sweep is queued. 99 test files carry KO content; some assert KO string semantics, so a per-file sweep with regression checks is the right shape. F-053 is marked done with the explicit deferred-scope evidence.

- **F-054 (Phase 5, policy)** — CHANGELOG.md gains an English-language policy note immediately after the Keep-a-Changelog header: from this entry forward, release notes are written in English; entries v0.1.0 ~ v0.11.2 stay as historical record and are not retroactively translated. Closes the F-049 ~ F-054 thread.

### Honest scope notes

This patch release intentionally bundles partial / deferred phases. Each F-NNN's evidence records why the scope was compressed in-flight: translating every body across 49 active features and ~70 + ~99 Python files in one session would have put diff -q + validate invariants at risk. The thread is queued in `[Unreleased]` with concrete next-batch suggestions.

### Verification

```bash
bash scripts/self_check.sh             # 5/5 OK
python3 -m pytest tests/unit/ tests/integration/ -q   # 1117 PASS
```

## [0.11.2] — 2026-04-27

**Native English consolidation thread — Phases 1 & 2 (F-049 + F-050 partial).**

Continuation of F-041 (commands + agents native-EN masters). Two phases of the post-F-041 thread bundled into a patch release: external contributors now read English on every entry-point dev surface plus the JSONSchema and the top-level spec narrative.

### Added — F-049 (Phase 1, entry-point dev surfaces)

9 modules rewritten in native English (commit `a503a30`):
- `CLAUDE.md` (also refreshed §2/§4/§5/§8/§9 to v0.11.1)
- `.harness/README.md`
- `docs/protocols/README.md` · `docs/protocols/sync-to-work-handoff.md`
- `docs/templates/hooks/README.md`
- `docs/samples/harness-boot-self/README.md`
- `hooks/pre-commit-phase2.sh` · `hooks/prompt-log.sh`
- `tests/unit/test_audit_pass.py` markers updated (self-doc drift surfaced inline; preview of F-051's planned 13th drift detector)

`docs/i18n/README.md` keeps two intended KO occurrences (`상태:` / `근거: N 개`) that demonstrate the i18n policy itself. `BRAND_TERMS.md` KO column is preserved as bilingual reference.

### Added — F-050 partial (Phase 2, spec mirrors + JSONSchema)

`docs/schemas/spec.schema.json` description bodies fully rewritten (KO 66 → 0). JSONSchema 2020-12 still parses cleanly. (commit `c70f375`)

`docs/samples/harness-boot-self/spec.yaml` (and `.harness/spec.yaml` mirror) rewritten in:
- `project` block (description, vision, summary, stakeholders.concerns)
- `domain.overview`
- `domain.business_rules` BR-001 ~ BR-014 (statement + rationale)
- `domain.vocabulary` 10 terms

`tests/unit/test_audit_pass.py:test_schema_archived_at_marks_declarative` updated — KO phrase guard `자동 채우지 않음` swapped for `work.py does not auto-fill`.

### Deferred (transparent scope compression)

F-050 AC-2 was compressed mid-flight: the features[] description / acceptance_criteria / tdd_focus bodies (~500 KO lines across 49 features) are deferred to F-050b. Keeping diff -q + validate green across every feature in one phase would have been fragile; F-050b will sweep them incrementally.

### Native EN idiom (F-041 pattern preserved)

- "원천 vs 파생"           → "source of truth vs derived view"
- "사고의 글 vs 실행의 글" → "author's prose vs engineer's contract"
- "외울 명령"               → "commands you actually have to memorize"
- "도그푸드"                → "self-dogfood"
- "감사성"                  → "auditability"
- "단일 원천 가정"          → "single-source assumption"
- "건너뛰기 합리화"         → "plausibly rationalize its own skips"

### Numbers

- spec.yaml KO lines: 747 → 666 (-81 lines, ~11%)
- spec.schema.json KO lines: 66 → 0 (-66 lines, 100%)
- 9 entry-point dev files: 100% native EN (8 zero-KO + 1 with intended bilingual examples)
- 1117 unit + integration tests PASS · self_check 5/5
- F-049 + F-050 both completed via the work.py 4-verb cycle (Phase 2 dogfood)

### Self-evidence

Both F-049 and F-050 spec entries were written in native English at the moment of addition — the features describing native-EN consolidation are themselves in native EN. F-050's AC-2 was even compressed mid-flight (in English) to keep the scope trace honest.

### Verification

```bash
bash scripts/self_check.sh             # 5/5 OK
python3 -m pytest tests/unit/ tests/integration/ -q   # 1117 PASS
grep -c '[가-힣]' docs/schemas/spec.schema.json       # 0
```

## [0.11.1] — 2026-04-27

**Iron Law rename (BR-004 외부 호칭 단순화) + F-048 drift × Iron Law gating (격자 1차 결합).**

4 메커니즘 (Iron Law · NO skip · CQS · Drift 12) 결합 검증 결과 발견된 GAP 1 닫기 + 사용자 혼동 호소에 따른 호칭 정리. patch bump (capability 변경은 단일 feature, schema/CLI surface 변경 0).

### Changed — Iron Law rename

- `Iron Law D` → `Iron Law` 외부 호칭 단순화. "D" 는 v0.9.3 의 4번째 정밀화 (declared evidence 도입) 표시였지만 사용자에게 history 흔적이 혼동만 유발. BR-004 의미 보존 — Walking Skeleton + N declared evidence + gate_5 pass.
- 식별자: `_IRON_LAW_D_REQUIRED` → `_IRON_LAW_REQUIRED` (work.py), `IRON_LAW_D_DEFAULT_WINDOW_DAYS` → `IRON_LAW_WINDOW_DAYS` (state.py), `test_complete_action_enforces_iron_law_d` → `..._iron_law` (integration test).
- 본문: scripts/, tests/, commands/, agents/, docs/, .harness/, CLAUDE.md (current-state).
- 보존 (history): CHANGELOG release notes (already-shipped), docs/archive/ frozen, .harness/state.yaml events, CLAUDE.md commit-subject quotes (v0.9.3 / v0.10.3 의 commit message 그대로), `tests/unit/test_cosmic_suika_returns.py` regex (legacy "Iron Law D" + simplified "Iron Law" 둘 다 accept 하도록 일반화).

### Added — F-048 drift × Iron Law gating

`scripts/work.py:complete()` 가 이전엔 `scripts/check.py` 를 호출하지 않아 drift 가 누적된 채로 feature 완료가 가능했음 (4 메커니즘 결합 검증 §Part 10 의 GAP 1). 이번 결합으로 gate_5 + Iron Law 검증 직전에 drift gate 를 추가.

- **차단 대상**: severity="error" 이면서 *진짜 wire 무결성* 위반 (`Code` · `Stale` · `AnchorIntegration`) 인 finding 1+.
- **차단 안 함**: schema-validation 류 (`Anchor` · `Generated` · `Doc` · `Spec` 등) — build state 따라 false-positive 가능 (예: harness.yaml 미생성). F-051 에서 multi-tier severity (Critical/High/Med/Low) 로 일반화 예정.
- **escape hatch**: `--hotfix-reason` 으로 bypass — 기존 emergency override 와 동일 path.
- **best-effort**: check.py 실행 실패 (malformed spec / IO 에러) 시 silent fallback. gate_5 가 이미 runtime smoke 증명.

```python
# scripts/work.py
_BLOCKING_DRIFT_KINDS: frozenset[str] = frozenset({"Code", "Stale", "AnchorIntegration"})

# complete() 본체에서:
blocking = [d for d in drift_report.findings
            if d.severity == "error" and d.kind in _BLOCKING_DRIFT_KINDS]
if blocking:
    return CannotComplete("N blocking drift(s) (kinds...)")
```

### Tests

- 신규: `tests/unit/work/test_drift_iron_law_gate.py` — 7 케이스 (drift 0 → pass · error wire-integrity → 거부 · 여러 unique kinds 메시지 · non-blocking error kind 통과 · warn-only 통과 · hotfix override · check 실행 실패 graceful).
- 회귀 0: 1117 unit + integration PASS (1110 → 1117, +7 신규).
- self_check 5/5.

### Self-evidence (Phase 2 dogfood)

F-048 자체가 자기가 도입한 drift gate 를 통과해 자기 complete — work.py 4-verb 사이클 완주: activate → run-gate gate_5 → 3 declared evidence (manual_check + reviewer_check + auto gate_run) → complete. *"우리 도구가 자기 GAP 을 자기 메커니즘으로 닫는다"* 의 첫 증명.

### Cumulative state (v0.11.1)

- 48 features (47 archived/done + F-048 done)
- 1117 unit + integration tests · self_check 5/5
- 4 메커니즘 결합: GAP 1 닫힘 (격자 1차). GAP 2/3 은 외부 dogfood 누적 후 처리 — F-049 (evidence author attribution) · F-050 (Preamble compliance scanner) 는 본 레포 내부 검증 환경 부족.
- 외부 호칭 정리: "Iron Law D" → "Iron Law" (BR-004 의미 보존)

### 관련 분석

PR/release 분석: `~/.claude/plans/wondrous-hopping-canyon.md` (12 part 분석 — 컨셉/철학/비전 검증 + 4 메커니즘 결합 GAP 발견 + 운용 추천).

## [0.11.0] — 2026-04-27

**Refactor thread closes (F-042 → F-047) · minor bump · vision consolidation.**

6 release (v0.10.16 → v0.11.0) 의 리팩토링 thread 종결. 외부 채택 readiness 신호. memory 정책상 minor bump 는 사용자 confirm 받음 — F-047 시작 시점에 명시 동의.

### 6-release thread (F-042~F-047) 한눈

| ver | feature | scope |
|---|---|---|
| v0.10.16 | F-042 doc cleanup | 5 stale docs → docs/archive/ · Preamble 단일 source · git mv history 보존 |
| v0.10.17 | F-043 hardcode externalization | core/{gates,routing}.py · ui/{render,dashboard_config}.py — 분산 hardcode 단일 source |
| v0.10.18 | F-044 spec archive flow | F-029 의 archived_at / archive_reason 필드 활성화 + dashboard 3-축 archive 인식 |
| v0.10.19 | F-045 facade-preserving split | work_internals · work_autowire · work_cli · check_detectors (DRIFT_CHECKS registry) · check_report — sibling alias modules |
| v0.10.20 | F-046 tests namespace | 20 테스트 파일 → tests/unit/{work,scan,dashboard,kickoff}/ git mv |
| **v0.11.0** | **F-047 vision consolidation** | F-001~F-007/F-009/F-010 in-place archive 마킹 (7 features) + CHANGELOG cleanup + minor bump |

### Added — F-047
- F-001 (Skeleton init), F-003 (sync), F-005 (status), F-007 (events), F-008 (metrics), F-009 (include_expander), F-010 (canonical_hash) 의 양쪽 spec mirror 에 `archived_at: "2026-04-23T00:00:00Z"` + `archive_reason` 마킹. F-002/F-004/F-006 (활성 개발) 제외.

### Changed
- `plugin.json` version 0.10.20 → **0.11.0** (minor bump · 사용자 confirm · 6-release refactor 누적).
- CHANGELOG `[Unreleased]` 정리 — Marketplace PR 한 줄만 남김.

### Cumulative state (v0.11.0)
- 47 features · done 또는 archived
- 1084 unit + 26 integration tests · self_check 5/5
- 41 → 47 features 누적 · 7 archived · 41+ active = 47 - 7 = ... (실제 활성 개발 가능 features 적은 수)
- 외부 dev access path: `from scripts.work_internals import activate` · `from scripts.check_detectors import DRIFT_CHECKS` · `from scripts.core.gates import STANDARD_GATES`
- runtime locale: `HARNESS_LANG=ko` · `spec.project.language: ko` · LC_ALL ko_KR (F-040)
- native-English commands/agents masters (F-041) + KO snapshot in docs/archive (F-042)
- brownfield reconnaissance: F-036 init seed + F-037 work-activate fog clear
- routing transparency: F-038 routed_agents · F-039 parallel groups

### 6 release thread 의 의미
F-036~F-041 의 "외부 dev 마주치는 표면" thread (brownfield seed → fog clear → routing transparency → parallel dispatch → i18n → native English) 가 끝난 후, F-042~F-047 의 "내부 정리" thread 가 6 release 진행. 둘이 합쳐 12 release 가 외부 채택 ready 단계로 끌어올림. 다음 자연 thread: 외부 영어권 dev case study + Marketplace PR (사용자 결정 시점에).

### Verification
```bash
bash scripts/self_check.sh             # 5/5 OK
python3 -m pytest tests/unit/ -q       # 1084 PASS
python3 -m pytest tests/integration/ -q # 26 PASS

# Archive 확인
grep -E "archived_at" .harness/spec.yaml | wc -l   # 7

# Sibling modules 확인
python3 -c "from scripts.work_internals import activate; from scripts.work_autowire import _autowire_kickoff; from scripts.check_detectors import DRIFT_CHECKS; print(len(DRIFT_CHECKS))"
```

## [0.10.20] — 2026-04-27

**Tests namespace cleanup — Phase 5 of the 6-release refactor (F-046).**

`tests/unit/` 의 20 분산 테스트 파일을 영역별 sub-dir 로 이동 (git mv · history 보존). pytest auto-discovery 가 sub-dir picks up.

### Moved (git mv)
- **`tests/unit/work/`** (7) — autowire · design_review · fog_clear_hook · parallel_routing · routed_agents · routing · ux.
- **`tests/unit/scan/`** (6) — area_resolver · chapter_writer · manifest · seed_spec · structure · style_fingerprint.
- **`tests/unit/dashboard/`** (4) — base · agent_chain · i18n · parallel.
- **`tests/unit/kickoff/`** (3) — base · parallel_groups · style_inject.

### Adjusted
- 12 파일의 `Path(__file__).resolve().parents[2]` → `parents[3]` (한 단계 더 깊어진 디렉토리 보정).
- 3 scan 테스트의 fixtures path: `parent.parent / "fixtures"` → `parent.parent.parent / "fixtures"`.

### Tests
- pytest `testpaths=tests/unit` 그대로 — recursive discovery 자연 동작.
- 1084 unit + 26 integration · self_check 5/5 · F-038~F-045 회귀 0.

### 효과
- tests/unit/ 의 시각 부담 ↓ (40+ 파일 → 4 영역별 + base files).
- 새 테스트 위치 결정 명확 (영역별 디렉토리에 추가).

## [0.10.19] — 2026-04-27

**Facade-preserving split (sibling alias modules) — Phase 4 of the 6-release refactor (F-045).**

`scripts/work.py` (1295 줄) + `scripts/check.py` (937 줄) = 2232 줄을 디렉토리 conversion 없이 sibling alias module 형태로 분할. 위험 관리 결정: 본체 파일은 그대로 두고 5 sibling 이 stable access path 제공 → 외부 dev / 미래 refactor 가 새 path 사용 시 본체 분할이 visible 영향 0. 즉 외부 API 변경 0, backward-compat 100%, migration 진입로 확보.

### Added — F-045
- **`scripts/work_internals.py`** — `WorkResult` · `activate` · `record_gate` · `add_evidence` · `complete` · `archive` · `block` · `current` · `deactivate` · `remove_feature` · `run_and_record_gate` · `format_human` 12 public 이름 re-export.
- **`scripts/work_autowire.py`** — `_autowire_design_review` · `_autowire_fog_clear` · `_autowire_kickoff` · `_autowire_retro` 4 함수 re-export.
- **`scripts/work_cli.py`** — `main()` re-export.
- **`scripts/check_detectors.py`** — 12 detect_* 함수 + `DRIFT_CHECKS = {"Generated": fn, ...}` registry. 새 drift 종류 추가 비용: 함수 1 + registry 한 줄.
- **`scripts/check_report.py`** — `DriftFinding` dataclass re-export.

### Changed
- 본체 (`work.py`, `check.py`) 변경 0. 외부 callsite 모두 그대로 동작.
- alias 는 `is` 식 동일성 보장 (`work_internals.activate is scripts.work.activate`).

### Tests
- **신규**: 7 `tests/unit/test_facade_split.py` — alias 동일성 검증 (work_internals 12 names · work_autowire 4 names · work_cli 1 · check_detectors registry 12 entries + alias · check_report 1).
- **누적**: 1084 unit + 26 integration. `self_check 5/5`. F-038~F-044 회귀 0.

### Out-of-scope (의도)
- **본체 물리 분할** — work.py 1295 줄 / check.py 937 줄을 실제 sibling 으로 옮기는 작업은 별도 release 권장. alias 가 먼저 자리잡고 외부 사용자 마이그레이션이 일어난 후 본체 축소가 안전.
- **`DRIFT_CHECKS` registry 가 `check.py::main()` 의 dispatch 흐름을 대체** — main() 의 hardcoded 호출 그대로. registry 는 외부 자동화 / 통계용 진입로.

### 효과
- 외부 dev 가 `from scripts.work_autowire import _autowire_kickoff` 같은 stable path 사용 가능.
- 새 drift 종류 추가: 함수 작성 + DRIFT_CHECKS dict 한 줄.
- 본체 분할 시점은 외부 사용 패턴 측정 후 결정 (점진적 path).

## [0.10.18] — 2026-04-27

**Spec archive flow — Phase 3 of the 6-release refactor (F-044).**

F-029 (v0.10.6) 가 정의했지만 41 entry 중 0 개 사용 중이던 `archived_at` / `archive_reason` 필드의 lifecycle 활성화. 외부 dev 가 spec 의 historical features 를 in-place 마킹할 수 있는 도구 + dashboard 의 자동 필터링.

### Added — F-044
- **`scripts/spec/archive.py`** — `archive_feature(spec_path, feature_id, reason, *, timestamp=None)` 함수. spec.yaml 의 `features[F-N]` entry 에 `archived_at` (ISO8601 UTC) + `archive_reason` 채움. unknown feature 는 KeyError, 빈 reason 은 ValueError.
- **`is_archived(feature)`** helper — feature dict 의 archived_at 마커 검사.

### Changed
- **`scripts/ui/dashboard.py::_render_unregistered`** — F-029 의 `archived_at` 마커 가진 feature 도 "next candidates" 에서 자동 제외 (`status=archived` · `superseded_by` 와 함께 3 차단 layer).

### Tests
- **신규**: 7 `tests/unit/test_spec_archive.py` (archive_feature 4 + is_archived 2 + dashboard filter 1).
- **누적**: 1077 unit + 26 integration. `self_check 5/5`. F-038~F-043 회귀 0.

### Out-of-scope (의도)
- **F-001 ~ F-010 in-place 마킹 — F-047 (vision consolidation) 로 미룸**. 이유: 본 레포 spec.yaml 은 1700+ 줄 + 한국어 주석 + edit-wins 형태라 yaml round-trip 으로 자동 mutate 시 주석 / 순서 깨짐. 외부 사용자의 단순 spec 에서는 archive_feature 가 yaml.safe_dump 로 안전 동작; 본 레포는 manual Edit 또는 ruamel 도입 후 F-047 에서 처리.
- **work.archive() 와의 spec marker wire-up** — 같은 위험. archive_feature 는 외부 dev 가 직접 호출하는 도구로 둠.

### 효과
- F-029 의 5 dead fields 중 2 개 (`archived_at` + `archive_reason`) 가 살아남.
- dashboard 의 archive 인식이 3-축 (status · superseded_by · archived_at).
- 외부 dev 가 historical features 의 lifecycle 명시 도구 확보.

## [0.10.17] — 2026-04-27

**Hardcode externalization — Phase 2 of the 6-release refactor (F-043).**

분산 hardcode 정리. 한 곳에서 한 번 바꾸면 전 영역에 반영. backward-compat alias 보존이라 기존 import path · CLI 모두 그대로.

### Added — F-043
- **`scripts/core/gates.py`** — `STANDARD_GATES = ("gate_0", ..., "gate_5")` + `GATE_PERF`. 단일 source.
- **`scripts/core/routing.py`** — `ROUTING_SHAPES` + `PARALLEL_GROUPS` 이전. `kickoff.py` 는 re-export.
- **`scripts/ui/render.py`** — `render_agent_chain(agents, groups, *, parallel_token, sequence_token, comma_join)`. work.py 의 `_render_agent_chain` + dashboard.py 의 `_render_chain` 33 줄 mirror 통합.
- **`scripts/ui/dashboard_config.py`** — `max_other_list()` · `max_pending_list()` · `max_unregistered_list()` env-overridable. `HARNESS_DASHBOARD_MAX_OTHER` · `_PENDING` · `_UNREGISTERED` 환경변수로 dial up.

### Changed (backward-compat aliases)
- `scripts/work.py::_STANDARD_GATES` → `core.gates.STANDARD_GATES` re-import.
- `scripts/work.py::_render_agent_chain` → `ui.render.render_agent_chain` re-import.
- `scripts/ui/dashboard.py::_STANDARD_GATES` → `core.gates.STANDARD_GATES`.
- `scripts/ui/dashboard.py::_render_chain` → `ui.render.render_agent_chain`.
- `scripts/ui/dashboard.py` 의 `_MAX_*` 상수 → 함수 호출 (`_max_other_list()` · `_max_pending_list()` · `_max_unregistered_list()`).
- `scripts/ceremonies/kickoff.py::ROUTING_SHAPES` · `PARALLEL_GROUPS` → `core.routing` re-export.

### Tests
- **신규**: 8 `tests/unit/test_core_externalization.py` (gates 2 + routing 2 + render 2 + dashboard_config 2).
- **누적**: 1070 unit + 26 integration. `self_check 5/5`. F-038/F-039/F-040/F-041/F-042 회귀 0.

### Out-of-scope (의도)
- `.harness/routing.yaml` override loader — 진입로만 marking, 실 구현은 후속 (사용자 요청 시).
- check.py 의 8 drift detector → registry pattern — F-045 (work.py + check.py split) 영역.
- magic numbers 의 모든 외재화 — gate detect 우선순위 list 등은 F-043 범위 밖 (다음 phase).

### 효과 측정
- 새 gate 추가 비용: 3 곳 → 1 곳 (`core/gates.py`).
- 새 parallel group / shape 추가 비용: 2 곳 → 1 곳 (`core/routing.py`).
- `_render_agent_chain` 의 의미 변경 비용: 2 곳 → 1 곳 (`ui/render.py`).
- 대규모 프로젝트 dashboard 의 truncation cap 조정: 코드 수정 → env 한 줄.

## [0.10.16] — 2026-04-27

**Doc cleanup — Phase 1 of the 6-release refactor (F-042).**

전체 리팩토링 6 release 의 첫 단계 (가장 안전, code 0). 누적된 dead docs / 중복 / 4 곳 반복 규약을 정리. v0.10.17~20 + v0.11.0 으로 이어지는 청결 base.

### Added — F-042
- `docs/preamble-spec.md` — 3-line Preamble + `NO skip:` / `NO shortcut:` prefix 규약의 single source. `commands/{init,work}.md` 의 Preamble 섹션 + `agents/README.md` 의 design principles 가 backlink. self_check.sh step 5 가 hardgrep 하는 두 prefix 가 영어로 박혀있다는 사실 + 변경 가능 / 불가 영역 명시.

### Moved (history preserved via `git mv`)
- `docs/setup/local-install.md` → `docs/archive/local-install-v0.1.0.md`
- `docs/setup/first-run-checklist.md` → `docs/archive/first-run-checklist-v0.1.0.md`
- `docs/release/v0.1.0.md` → `docs/archive/release-v0.1.0-playbook.md`
- `docs/release/v0.4-plan.md` → `docs/archive/release-v0.4-plan-shipped.md`
- `docs/i18n/ko/` → `docs/archive/i18n-ko-frozen-f041/` (17 files)

빈 부모 디렉토리 (`docs/setup/`, `docs/release/`) 자동 제거.

### Updated
- `CLAUDE.md` — 5 곳의 stale path reference 갱신 (`docs/setup/*` · `docs/release/v0.1.0` → `docs/archive/*`). 본문 한국어 톤 유지 (ops 컨텍스트).
- `docs/i18n/README.md` — KO snapshot 경로 backlink 를 `docs/archive/i18n-ko-frozen-f041/` 로 갱신 + 시각적 archive 의미 한 줄.
- `tests/unit/test_audit_pass.py` — `LOCAL_INSTALL` / `FIRST_RUN` 경로 상수 갱신 (deprecation-notice 검증 contract 그대로 유지).

### Out-of-scope (의도)
- README 한국어 → 영어 — 사용자 결정 보류.
- 실 deletion — `git mv` 로 archive 이동 만, history 보존.
- CHANGELOG historical entries 압축 — 다음 release (F-047) 의 vision consolidation 영역.

### Tests
- 1062 unit + 26 integration · self_check 5/5 · F-040 KO runtime catalog 회귀 0.
- F-041 native-English masters + KO archive snapshot 모두 byte-stable.

## [0.10.15] — 2026-04-27

**Native-English rewrite of `commands/` and `agents/` (F-041).**

User feedback called for the slash-command definitions and sub-agent
fixtures to read **as if a native English-speaking dev wrote them from
scratch** — not as translation. F-040 (v0.10.14) localized the *runtime
output*; F-041 closes the gap on the *system prompts Claude Code loads*,
the loudest-Korean surface a non-Korean adopter encountered.

### Added — F-041 native-English rewrite

- **`commands/init.md`** + **`commands/work.md`** — rewritten end-to-end at
  native level. Preamble + `NO skip:` / `NO shortcut:` line prefixes
  preserved (self_check step 5 invariant). Single glossary backlink near
  the top.
- **`agents/*.md`** (15 sub-agents + `README.md`) — same treatment.
  Headers follow the `# <agent-name> — <one-liner role>` pattern;
  frontmatter (`name`, `description`, `tools`) preserved with the
  `description` field also rewritten in English.
- **`docs/glossary/BRAND_TERMS.md`** — new bilingual reference (28 terms:
  Walking Skeleton · Iron Law D · BR-NNN · F-NNN · gate_0–5 · drift ·
  sigil · fog-clear · routed agents · parallel groups · STRIDE · OWASP
  ASVS · WCAG 2.2 · OAuth 2.1 · FIDO2 · Mom Test · etc.). Each entry has
  EN gloss + KO gloss + a primary-file backlink. Rewritten files link
  here once instead of inline-defining each term.
- **`docs/i18n/ko/`** — frozen byte-exact snapshot of the pre-rewrite
  Korean source. `commands/{init,work}.md` + `agents/*.md`. Kept as a
  translation reference; **not synced** with the English masters.
- **`docs/i18n/README.md`** — one-paragraph policy: English is the source
  of truth; the KO snapshot is a frozen reference; runtime Korean output
  goes through `scripts/ui/messages.py` (F-040), unaffected here.

### Tests
- **Updated**: `tests/unit/test_agents.py` exclusion-phrase regex expanded
  to accept both legacy Korean (`spec.yaml 직접 참조 금지` · `읽지 않`
  · `접근 금지`) and the F-041 native-English forms (`Don't read … directly`
  · `off-limits` · `not in the allow-list` · etc.). Markdown emphasis
  (`**`/`*`) stripped before matching. `tests/unit/test_cosmic_suika_returns.py`
  `kind=trivial` exemption-clarification check accepts both phrasings the
  same way.
- **Cumulative**: 1062 unit + 26 integration. `self_check 5/5`.
  F-040 runtime locale switching unaffected — `HARNESS_LANG=ko` still
  emits `상태:` / `통과:` / `근거: N 개` / `라우팅된 팀:`.

### Out-of-scope (intentional)
- `CLAUDE.md` (this repo's ops context — Korean primary by design).
- Historical CHANGELOG entries (history not rewritten; new entries in English).
- `scripts/` Python source — already English.
- F-040 message catalog (`scripts/ui/messages.py`) — runtime axis,
  separate concern; KO + EN both stay.

### Verification
```bash
# Zero Korean script in masters
python3 -c "
import re, pathlib, sys
patt = re.compile(r'[가-힯]')
violators = [str(p) for p in [*pathlib.Path('commands').glob('*.md'),
                              *pathlib.Path('agents').glob('*.md')]
             if patt.search(p.read_text(encoding='utf-8'))]
print('violators:', violators); sys.exit(1 if violators else 0)
"

# KO snapshot still byte-identical with the pre-rewrite source
ls docs/i18n/ko/commands/ docs/i18n/ko/agents/

# Self-check + tests
bash scripts/self_check.sh
python3 -m pytest tests/unit/ -q   # 1062 PASS
python3 -m pytest tests/integration/ -q   # 26 PASS

# F-040 KO runtime catalog still works
HARNESS_LANG=ko python3 scripts/work.py F-041 --harness-dir .harness
```

## [0.10.14] — 2026-04-27

**User-friendly plugin output — i18n, glossary, visual signature (F-040).**

사용자 실 사용 피드백 — *"플러그인 출력 용어가 어렵고 한국어/영어 혼재되고 harness-boot 가 작업하는 게 구분이 안 보인다"* — 의 4 가지 갭 메우기. 백엔드 결정론은 그대로 (수학 공식), 사용자 표면만 부드럽게.

### Added — F-040 user-friendly output

- **`scripts/ui/lang.py`** — `resolve_lang(spec=None)` 우선순위: env `HARNESS_LANG` > `spec.project.language` > `LC_ALL`/`LANG` (ko_KR 패턴) > `"en"` fallback. 영어 default 가 외부 dev 진입 보호.
- **`scripts/ui/messages.py`** — en/ko 메시지 catalog. 27 키 (status / passed / failed / evidence / routed_agents / agent_chain / walking_skeleton / iron_law_block / dashboard sections / init steps). 미존재 lang 은 en 으로 fallback, 미존재 키는 KeyError 로 fail loud.
- **`scripts/work.py::format_human()`** — lang 자동 결정 후 messages catalog 호출. 한국어 사용자 시 `상태:` / `통과:` / `근거: N 개` / `라우팅된 팀:`. 영어 default 시 기존 `status:` / `passed:` / `evidence: N entries` / `routed agents:`.
- **`scripts/ui/dashboard.py`** — `render(state, spec, suggestions, *, lang=None)` 가 lang 자동 결정. 모든 _render_* 함수에 lang 전달, 한국어/영어 일관 출력. 기존 dashboard 테스트 (한국어 가정) 는 `lang="ko"` 명시 호출 + `WorkDashboardCliTests` 의 setUp 에서 env 핀.
- **`docs/schemas/spec.schema.json`** — `project.language` enum `["en", "ko", "auto"]` additive. 기존 11 sample 회귀 0.
- **`commands/work.md`** Glossary 섹션 — 16 jargon (Walking Skeleton / Iron Law D / gate_0~5 / evidence / drift / kickoff / retro / autowire / preamble / fog-clear / routed agents / parallel groups / mode / shape / sigil region) 영어/한국어 짧은 풀이.
- **`commands/init.md`** "사용자 언어" 섹션 — 우선순위 + 활성화 방법 안내.

### Tests
- **신규**: 12 `tests/unit/test_lang_resolver.py` (env / spec / locale / fallback) + 9 `tests/unit/test_messages_catalog.py` (필수 키 / 미존재 키 / fallback / 핵심 라벨) + 8 `tests/unit/test_format_human_i18n.py` (영어 default / 한국어 / 비-activate 회귀) + 4 `tests/unit/test_dashboard_i18n.py` (영어 / 한국어 라벨).
- **누적**: 1062 unit (1029 + 33 신규) + 6 integration. `self_check 5/5`. F-036~F-039 회귀 0.

### Out-of-scope (의도)
- 사용자 자유 텍스트 LLM 응답 — 기존 Claude Code 자체 동작 (사용자가 한국어 prompt → 한국어 답). 본 release 는 결정론 출력만 i18n.
- 코드 / commit / schema field name — 영어 유지 (drift 위험).
- 시스템 locale 자동 감지의 고급 케이스 (zh_CN, ja_JP 등) — 우선순위에서 영어 fallback 으로 떨어짐. 추후 확장 가능.

## [0.10.13] — 2026-04-27

**Parallel agent dispatch — visibility + orchestrator contract (F-039).**

사용자 질문 — *"병행 작업 가능한 에이전트는 멀티 호출로 고속 처리 가능한가?"* — 의 답은 *가능*. Claude Code 의 Agent tool 이 단일 메시지 멀티 호출 시 native 병렬 실행. F-039 가 이 native 동작을 harness-boot 의 데이터·문서·UI 로 노출. F-038 (routing transparency) 의 자연 follow-up.

### Added — F-039 parallel agent dispatch

- **`scripts/ceremonies/kickoff.py::PARALLEL_GROUPS`** — 새 상수 `dict[str, list[tuple[str, ...]]]`. 명시된 그룹: `sensitive_or_auth` → `(security-engineer, reviewer)`, `ui_surface.present` → `(visual-designer, audio-designer)`. ROUTING_SHAPES 자체는 unchanged (backward compat).
- **`parallel_groups_for_shapes(shapes, has_audio)`** helper — `has_audio=False` 시 `audio-designer` 그룹에서 drop 후 단원 그룹 제거. order-preserving + dedup.
- **`WorkResult.parallel_groups: list[list[str]]`** (`default_factory=list`) + `_resolve_routing` 가 `(routed_agents, parallel_groups)` 튜플 반환. activate 시점에만 채움.
- **`format_human()`** — `_render_agent_chain(agents, groups)` 가 그룹화된 표기 emit: 예 `routed agents: ux-architect → (visual-designer ∥ audio-designer) → a11y-auditor → frontend-engineer`. 그룹 없는 chain 은 기존 `, ` join (회귀 0).
- **`scripts/ui/dashboard.py`** — `_resolve_agent_chain` 가 `(agents, groups)` 튜플 반환 + 로컬 `_render_chain` (work.py 의 mirror — dashboard 가 pure renderer 라 import 회피). active feature 의 `agent chain:` 줄에 동일 ∥ 표기.
- **`_result_to_dict()`** — `parallel_groups` 키 추가.
- **`commands/work.md`** Orchestration Routing 표 — `ui_surface.present` 행에 `(visual-designer ∥ audio-designer)` 명시. 새 단락 "Parallel dispatch (F-039)" — 어떤 그룹이 병렬 가능, 안전 규칙 (write conflict 없는 에이전트끼리만), 표기 문법 `(a ∥ b)` 와 `→`, 신규 그룹 추가 절차.
- **`agents/orchestrator.md`** 새 섹션 "Parallel Invocation Pattern" — single message multi tool use 패턴 명시 + 안전 규칙 + 현재 그룹 2 종 인용 + 호출 예시 (같은 turn 안에 여러 Agent tool call block).

### Tests
- **신규**: 7 `tests/unit/test_kickoff_parallel_groups.py` (PARALLEL_GROUPS 상수 + helper · 5 cases) + 8 `tests/unit/test_work_parallel_routing.py` (activate 가 채움 · format_human 그룹 표기 · 비-activate 회귀 · JSON dict) + 3 `tests/unit/test_dashboard_parallel.py` (∥ 노출 · pure_domain 회귀 · UI 단원 그룹 drop).
- **누적**: 1029 unit + 6 integration. self_check 5/5. F-036/F-037/F-038 회귀 0.

### Out-of-scope (의도)
- orchestrator 의 *실제* 자동 dispatch — orchestrator 는 LLM 에이전트라 결정론 코드로 강제 불가. F-039 는 데이터 + 문서 + UI 로 행동 가이드만.
- `feature_completion` chain 병렬화 — write conflict 가능성으로 보류 (engineers + integrator).
- ROUTING_SHAPES 자료 구조 변경 — 별도 PARALLEL_GROUPS 추가만 (backward compat).

## [0.10.12] — 2026-04-27

**Agent routing transparency in `/harness-boot:work` outputs (F-038).**

사용자 실 사용 피드백 — *"work 안에서 질문 / 디자인 / 기획 / 구현 / 리뷰 같은 다양한 의도가 처리되는데, 어떤 에이전트가 라우팅됐는지 정확히 명시되어야 한다"* — 의 갭 메우기. 라우팅 인프라 (`kickoff.ROUTING_SHAPES` + `agents_for_shapes`) 는 이미 견고했지만 사용자는 `kickoff.md` 를 직접 열어야 봤다. 이제 `activate` 출력과 dashboard 둘 다에 라우팅 결과가 노출됨.

### Added — F-038 work agent routing transparency

- **`scripts/work.py::WorkResult.routed_agents`** (`list[str]`, `default_factory=list`) — `activate()` 가 `kickoff.detect_shapes` + `agents_for_shapes` 결과를 채워서 반환. `_resolve_routed_agents` 헬퍼가 autowire 와 동일 입력으로 계산 → kickoff.md 와 사용자 표시가 drift 없음.
- **`format_human()`**: `action == "activated"` + `routed_agents` 비지 않을 때 `routed agents: <chain>` 한 줄 출력. 다른 액션 (gate/evidence/complete) 은 zero diff.
- **`_result_to_dict()`**: `routed_agents` 키 추가 — `--json` 출력 다운스트림 친화.
- **`scripts/ui/dashboard.py::_render_active_block`**: active feature 가 있으면 `agent chain:` 줄 추가. `_resolve_agent_chain` 가 kickoff routing 을 그대로 호출 (single source of truth).
- **`commands/work.md` Orchestration Routing 섹션**: "자유 텍스트 의도 라우팅" 표 신설 — 질문/디자인/기획/성능/보안/구현/리뷰 7 의도 → shape 매핑 + 결과적으로 호출되는 에이전트 체인. "라우팅 투명성" 노트로 activate 출력 한 줄 + dashboard `agent chain:` 섹션을 사용자 contract 로 명시.

### Tests
- **신규**: 7 `tests/unit/test_work_routed_agents.py` (activate 가 routed_agents 채움 · UI shape · format_human 라인 · 비-activate 액션 회귀 · JSON 키) + 3 `tests/unit/test_dashboard_agent_chain.py` (active 시 agent chain 노출 · 미-active 시 zero diff · UI 체인 검증).
- **누적**: 1011 unit + 6 integration. `self_check 5/5`. F-036/F-037 회귀 0.

## [0.10.11] — 2026-04-27

**fog-of-war brownfield reconnaissance — F-036 (Layer A · init seed) + F-037 (Layer B · work-activate fog clear).**

사용자 비유 — *"기존 프로젝트에 이어 신규 피처 작업 시 기존 스타일 그대로 유지 — 깜깜한 미니맵에서 이동하는 곳마다 어둠이 걷히는 느낌"* — 의 메커니즘 정착. 기존 코드 보유 프로젝트 (`metadata.source.origin == "existing_code"`) 에서 `/harness-boot:init` 옵션 3 의 deferred 구현이 닫히고, 이후 매 `python3 work.py F-N` activate 마다 그 피처의 `modules[]` 영역만 결정론 정찰 → `.harness/chapters/area-{slug}.md` 작성 + kickoff prompt 에 자동 inject. 그린필드 사용자 영향 0 (옵션 1/2 byte-equal 보존, `--no-fog` opt-out).

### Added — F-037 brownfield repo seed (work-activate fog clear · Layer B)

사용자 비유 — *"깜깜한 미니맵에서 이동하는 곳마다 어둠이 걷힘"* — 의 본체. F-036 (Layer A · init-time 1회 정찰) 위에서, 매 `python3 scripts/work.py F-N` activate 시점에 그 피처의 `modules[]` 영역만 결정론 정찰 → `.harness/chapters/area-{slug}.md` 작성 + `.harness/area_index.yaml` 갱신 + `events.log` 의 `fog_cleared` 이벤트. 같은 activate 의 kickoff 가 chapter 를 자동 reference ("기존 스타일 컨텍스트" 섹션) — 신규 피처가 기존 스타일 그대로 확장되는 메커니즘의 종착점. fully deterministic (LLM 호출 X).

- **신규 모듈**: `scripts/scan/{area_resolver, style_fingerprint, chapter_writer}.py` — F-036 의 manifest/structure 를 재사용 (추가 walking 비용 0).
- **work.py**: `_autowire_fog_clear` 추가 + `activate()` 호출 순서 fog → kickoff → design_review (chapter 가 kickoff 시점에 존재해야 inject 가능). `--no-fog` CLI flag.
- **kickoff.py**: `_render_style_block` + `generate_kickoff(..., style_block="")` — area_index.yaml 의 area 와 feature.modules 매칭 시 "기존 스타일 컨텍스트" 섹션 emit. 미매칭 피처는 zero diff (회귀 0).
- **schema additive**: `metadata.{style_fingerprint, area_index, fog}` + `features[].area_scan` 4 신규 optional. version label v2.3.8 유지 (patch-first). 11/11 기존 sample validate 회귀 0.
- **persistence**: area_index 의 canonical store 는 `.harness/area_index.yaml` side file (spec.yaml 무결성 보호). schema 의 `metadata.area_index[]` 는 사용자 명시 inline 시에만 valid.
- **idempotency**: chapter 는 timestamp-free 이라 같은 area+style+feature 입력에 byte-identical. 사용자 편집은 `<!-- harness:user-edit-begin -->` / `end -->` 영역으로 보존. fog_cleared 이벤트는 같은 area set 두 번째 호출 시 emit X.
- **opt-out**: `--no-fog` CLI 또는 `metadata.fog.disabled: true`.
- **tests**: 28 신규 unit (area_resolver 7 + style_fingerprint 8 + chapter_writer 6 + fog_clear hook 7) + 5 신규 integration (init option 3 e2e + F-037 self-cycle). 누적 1001 unit + 6 integration. self_check 5/5 유지.
- **out-of-scope**: URL → design seed (F-038+), 사용자 코드 자동 수정/lint 강제, cross-language hash 테스트 벡터, F-036 Layer A 분기 변경.

### Added — F-036 brownfield repo seed (init option 3 · Layer A)

`/harness-boot:init` 옵션 3 ("이미 코드가 있는 프로젝트") 의 deferred 구현을 닫는다. init 시점에 1회 정찰 — 결정론으로 `constraints.tech_stack` · `project.name` · directory shape 를 시드, 선택적으로 LLM (spec-conversion 의 brownfield 어댑터) 이 `domain.{overview, entities[]}` 초안 추가. 사용자 미리보기 + 4-옵션 (Y/D/S/E) 게이트. skip 시 옵션 1 동치 (starter template byte-equal).

- **신규 모듈**: `scripts/scan/{__init__,manifest,structure,seed_spec}.py` — 결정론 정찰 + 시드 composer + CLI (`--preview` / `--apply` / `--skip`).
- **신규 어댑터**: `skills/spec-conversion/adapters/brownfield.md` v0.1 — 입력 형태 어댑터 (도메인 어댑터와 직교).
- **SKILL.md**: §0 트리거 enum 에 `existing_code` 추가, §8 어댑터 표에 brownfield 행 추가, §12 v0.6 changelog.
- **schema**: `metadata.source` 에 description 추가 — `existing_code` 가 권장 origin 값임을 명시 (additive only · enum 강제 X · 11/11 기존 spec 호환 유지).
- **init.md**: §2.A 옵션 3 분기 신설 — 결정론 preview → LLM (선택) → Y/D/S/E 게이트 → events.log 의 `brownfield_seeded` 이벤트.
- **fixtures**: `tests/fixtures/brownfield-repos/{node-react, python-fastapi, rust-cli, empty-repo}/` — 매니페스트 + README + 도메인 후보 파일.
- **tests**: 48 신규 unit (manifest 17 + structure 11 + seed_spec 15 + brownfield adapter 5) + 4 integration e2e. 누적 968 unit + integration 4. self_check 5/5 유지.
- **out-of-scope**: work-time fog clear (Layer B — F-037 candidate), 코드 스타일 학습, 기존 코드 자동 수정.

## [0.10.10] — 2026-04-27

**gate_5 browser smoke auto-detect — gstack `/qa` 환원 + cosmic-suika I-010 root fix.**

BR-003 (Walking Skeleton + Gate 5 통과) 의 약속이 진짜 user-facing smoke 로
격상. 이전 gate_5 는 `scripts/smoke.sh` (구조 검증) 또는 unit-test fallback
만 — Iron Law D 의 "gate_5 pass" 가 실제 동작과 분리. 이제 playwright /
cypress config 가 있으면 자동으로 e2e 가 gate_5 를 책임.

### Changed

- **`scripts/gate/runner.py::detect_gate_5_command`** 우선순위 재배치 (이전
  6 단계 → **7 단계**, NEW = ★):
  1. `scripts/smoke.sh` (사용자 explicit override · 변경 X)
  2. **★ `playwright.config.{ts,js,mjs,cjs}` → `npx playwright test`**
  3. **★ `cypress.config.{ts,js,mjs,cjs}` → `npx cypress run`**
  4. `package.json scripts.smoke` (기존, v0.10.2)
  5. `package.json scripts.test:e2e` (기존, v0.10.2)
  6. `tests/smoke/` (pytest 또는 unittest, 기존)
  7. `Makefile smoke:` 타겟 (기존)

### Added

- **`_playwright_command`** + **`_cypress_command`** helpers in `runner.py` —
  config 파일 4 변형 (.ts / .js / .mjs / .cjs) 감지 → `npx playwright test`
  또는 `npx cypress run` 반환. node 부재 시 명령 실행 단계에서 자연 실패
  (사용자 문맥 있는 메시지).
- **9 신규 tests** in `tests/unit/test_gate_runner.py`:
  - 3 × playwright config 변형 (.ts / .js / .mjs)
  - 2 × cypress config 변형 (.ts / .js)
  - 4 × 우선순위 회귀 검증: `smoke.sh > playwright`, `playwright > cypress`,
    `playwright > npm.smoke`, `cypress > tests/smoke unittest`

### Notes

- 이번 release 부터 cosmic-suika 같은 playwright 사용자가 `--override-command`
  또는 `harness.yaml gate_commands` 수동 wire 부담 없이 `--run-gate gate_5`
  한 줄로 동작. UI 프로젝트 onboarding 마찰 해소.
- 본 레포 (`scripts/smoke.sh` shim 으로 self_check 호출) 는 영향 X — 우선순위
  1 위 유지. 회귀 0.
- cosmic-suika ISSUES-LOG I-010 (gate_5 too shallow to catch "no real game
  wired") 의 root cause fix — 이전엔 v0.10.1 의 AnchorIntegration drift
  로 우회 fix. 진짜 원인은 gate_5 가 user-facing smoke 가 아니라 구조
  검증만 했던 것.
- F-034 권장 release flow 첫 적용 — F-035 활성화 → gates → evidence →
  **commit → push → tag → complete** 순서. pre-commit hook 가 active
  feature 검증 통과 (자기 자신 안 막음).
- 누적 테스트 911 → 920 (+9). features count 34 → 35. self_check 5/5 OK.

## [0.10.9] — 2026-04-27

**Phase 2 pre-commit hook — 자동 enforcement (F-026 후속).**

수동 디시플린 ("every change MUST go through work.py", cosmic-suika 메모리)
을 도구가 책임지도록 자동화. F-034 단일 피처로 묶어 work.py 풀 사이클 (gate_0
+ gate_5 + evidence + complete) 완주 후 본 레포에 self-install 완료.

### Added

- **`hooks/pre-commit-phase2.sh`** — git commit 시 staged code 변경이 있는데
  `.harness/state.yaml` 의 active feature 가 없으면 reject. 5 분기 contract:
  1. `.harness/state.yaml` 부재 → silent exit 0 (Phase 2 안 쓰는 프로젝트 영향 0)
  2. `HARNESS_BYPASS_PRE_COMMIT=1` env → exit 0 (true emergencies)
  3. staged 가 화이트리스트 (`.harness/state.yaml` · `.harness/_workspace/*` ·
     `CHANGELOG.md`) 만이면 → exit 0 (chore commits 통과)
  4. non-whitelisted staged + active 부재 → **exit 1 + stderr 에 4 우회 옵션** (work.py
     activate · spec 에 새 F-N · `--no-verify` · env bypass)
  5. non-whitelisted staged + active 있음 → exit 0
- **`scripts/install_pre_commit.py`** — CLI installer:
  - `--install` (기존 non-harness pre-commit hook 보존, `--force` 로 덮어씀)
  - `--uninstall` (다른 사용자 hook 은 절대 안 지움 — F-034 marker 검증)
  - `--status`
- **`tests/unit/test_pre_commit_hook.py`** — 13 tests. tempdir + git mock 으로
  5 분기 × installer 6 safety scenarios.

### Notes

- 본 레포에 self-install 완료 — 이번 v0.10.9 commit 부터 enforcement 활성.
- 사용자 워크스페이스에서: `python3 <plugin_root>/scripts/install_pre_commit.py
  --install` 한 번 실행 시 활성화. opt-in.
- git `--no-verify` 와 `HARNESS_BYPASS_PRE_COMMIT=1` 두 가지 우회 — emergency
  hotfix 같은 정당한 우회 보장.
- 누적 테스트 898 → 911. features count 33 → 34. self_check 5/5 OK.

## [0.10.8] — 2026-04-27

**Audit pass — stale rename + README/CLAUDE.md refresh + dogfood self-issues-log + F-029 schema doc 명확화.**

v0.10.4~v0.10.7 빠른 출시 후 codebase 점검. 사용자 영향 0 (기존 동작 변경 없음) ·
모두 docs / template 갱신 + 자체 도그푸드 적용. F-033 단일 피처로 묶어 work.py
풀 사이클 (gate_0 + gate_5 + `--kind trivial` evidence + complete) 완주.

### Changed

- **`docs/templates/starter/CLAUDE.md.template`** 전면 재작성 — `/harness:*` →
  `/harness-boot:*` (사용자 프로젝트에 복사되는 stale 컨텐츠 제거), v0.9.0
  통합된 2 명령 안내, F-027/F-028 observability 섹션 + `.harness/_workspace/prompts`
  디렉터리 명시.
- **`README.md`**: 배지 `v0.9.6` → `v0.10.7`, 테스트 수 `764`/`742` → `883`,
  현재 상태 단락을 v0.10.7 (Phase 2 + observability + scaling preparedness) 로 갱신.
- **`CLAUDE.md` (루트)**: §1 현재 릴리즈 v0.10.3 → v0.10.7, §2 누적 테스트
  838+ → 883 + v0.10.5/6/7 핵심 줄 추가, §5 v0.10.4~7 narrative 4 줄 추가,
  §8 닫힘 항목 정리, §9 다음 후보 갱신.
- **`docs/schemas/spec.schema.json`** `archived_at` / `archive_reason`
  description 에 "**declarative · work.py 가 자동 채우지 않음**" 명시 —
  F-029 의 의도 모호 해소 (state.yaml 의 status=archived 가 runtime 책임;
  spec.yaml 의 field 는 사용자가 직접 채우는 forward-compat declaration).

### Added

- **`docs/setup/{local-install,first-run-checklist}.md`** 상단에 v0.10.7
  deprecation notice 한 단락 — `/harness:*` 잔존 안내. 본문은 historical
  로 보존.
- **`.harness/_workspace/issues-log.md`** 신설 — F-027 컨벤션의 본 레포 첫
  자체 적용. F-025~F-032 사이에 발견한 8 갭을 entry 로 기록 (대부분 이미
  해소된 ✅ FIXED 표기). dogfood-violation 모순 해소.
- **`tests/unit/test_audit_pass.py`** 신규 — 15 tests (template stale 0,
  README 배지/숫자, CLAUDE.md narrative, schema description, issues-log
  존재 + 5+ entry).

### Notes

- F-028 prompt log hook 의 production 검증은 사용자가 `/plugin update
  harness-boot@harness-boot` 후 다음 세션부터 가능 — `.harness/_workspace/prompts/YYYY-MM.jsonl`
  에 매 prompt 마다 entry 가 누적되는지 실측. 현재 본 레포의 첫 entry 는
  F-028 smoke test 부산물 (빈 prompt + 빈 session_id).
- F-029 의 5 schema fields 는 의도된 declarative — work.py 가 자동 wire
  하지 않는 것이 design choice. 향후 sharding 진입 시 사용자가 채움.
- 누적 테스트 883 → 898 (+15). features count 32 → 33. self_check 5/5 OK.

## [0.10.7] — 2026-04-27

**cosmic-suika ISSUES-LOG 일괄 환원 (I-003 / I-004 / I-006 / I-007).**

F-027 issue logging 컨벤션 (v0.10.5) 의 첫 실증 사이클 — cosmic-suika 가
수동 운영해온 ISSUES-LOG 의 미해결 4 건을 한 PR 로 환원. 모두 small,
additive, 기존 사용자 spec 영향 0. F-032 단일 피처로 묶어 work.py 풀
사이클 (gate_0 + gate_5 + `--kind trivial` evidence + complete) 완주 —
도그푸드 도구가 자기 fix 의 audit trail 도 책임진다.

### Added

- **`docs/templates/starter/tsconfig.json.template`** (I-003 환원) —
  TypeScript 프로젝트용 권장값 템플릿. `allowImportingTsExtensions: true`
  · `noEmit: true` · `types: ["vitest/globals"]` (없으면 `@types/node`
  미설치 시 typecheck fail) · `strict` 등. 자동 복사 X — `init.md` §2.5
  의 안내만 (TS 프로젝트로 감지되면 `팁:` 한 줄). cosmic-suika 첫 sync
  시 마주친 typecheck friction.

### Changed

- **`docs/schemas/spec.schema.json` risks[].id pattern** (I-004 환원):
  `^R-\d+$` → `^(R|RISK)-\d+$`. 다른 ID 컨벤션 (BR-N · ADR-N · F-N ·
  AC-N) 과 일관. **backward-compat** — 기존 R-N 그대로 사용 가능.
- **`docs/schemas/spec.schema.json` $defs/changelog.items.required**
  (I-007 환원): `["version"]` → `[]`. `metadata.changelog: [{date, note}]`
  같이 version 없는 entry 도 validate 통과 — placeholder 강제 회피.
- **`commands/work.md` kind taxonomy** (I-006 환원): `trivial` 추가 +
  의미 명시 ("Iron Law D 면제 X · 단지 ceremony vs 진짜 trivial 의도
  signal"). `scripts/work.py` 의 `--kind` argparse help 도 확장.
- **`commands/init.md` §2.5**: `tsconfig.json.template` 안내 한 단락 추가.

### Notes

- I-005 (Three.js 외부 의존성) · I-009 (cosmic-suika 자체 tooling) 은
  harness-boot 변경 대상 아님 — ISSUES-LOG 에 그대로 닫힘 처리 권장.
- F-032 evidence 가 `--kind trivial` 로 기록된 첫 사례 — Iron Law D 가
  여전히 1 declared 카운트 (prototype 모드) 통과.
- 누적 테스트 869 → 883 (14 신규 in `tests/unit/test_cosmic_suika_returns.py`).
- features count 31 → 32. self_check 5/5 OK.

## [0.10.6] — 2026-04-27

**Scaling preparedness — 1000~10000 features 도달 전 사후 마이그레이션 비용 회피.**

cosmic-suika 운용 (~100 features) 에서 사용자가 제기한 "방대해질 때 문제 없을까?"
가설을 (a) additive schema 로 사전 정착, (b) sharding 도구를 미리 빌드, (c) 가짜
스펙으로 실측 데이터 수집 — 세 단계 pre-emptive 대응. 셋 모두 사용자 영향 0,
호출 안 해도 무방 (forward-compat infra).

### Added — F-029 (additive schema fields)

- **`features[].area`** (선택, string) — 향후 sharding grouping 키. enum 강제 X,
  사용자가 자유롭게 채울 수 있음.
- **`features[].archived_at`** (선택, ISO8601 string) — true archive 시각.
  v0.10.0 supersession 메타와 보완 (다른 피처가 대체 vs 단순 archive 구분).
- **`features[].archive_reason`** (선택, string) — archive 사유.
- **`features[].digest`** (선택, string) — 1~2 줄 LLM-context 요약. summary
  index 산출 시 사용.
- **`features[].include_path`** (선택, string) — sharding 진입로. 설정되면
  detail 이 외부 파일에서 로드 (현재는 무시 가능).
- 모두 additive — 기존 spec.yaml validate 영향 0. 11 신규 tests
  (`tests/unit/test_schema_scaling_fields.py`).

### Added — F-030 (sharding tooling)

- **`scripts/spec/shard.py`** — monolithic spec.yaml 을
  `<output>/features/<area>/F-N.yaml` 로 분할 (idempotent). area 미지정 features
  는 `misc/` fallback. 잔여 top-level (project · domain · constraints · ...)
  은 `<output>/spec.yaml` 의 features 가 `[{id, include_path}]` 인덱스로 변환.
- **`scripts/spec/unshard.py`** — 역방향. round-trip (shard → unshard) 결과가
  원본 dict 와 byte-identical (json sorted-key 비교).
- **`scripts/spec/summary.py`** — features index 도출. `id/status/area/digest`
  최소 + archived 마커. CLAUDE.md @import 가 향후 spec.yaml 통째 대신
  summary.yaml 로 전환 시 사용.
- 8 신규 tests (`tests/unit/test_spec_shard.py`) — round-trip · CLI · summary
  semantics. 사용자는 ~300 임계점까지 안 호출해도 무방.

### Added — F-031 (scaling stress test)

- **`tests/scale/test_scale.py`** — 100/1000/3000/10000 가짜 features 에 대해
  yaml_load · yaml_dump · validate · canonical_hash · summary 의 walltime
  측정. unittest discover (tests/unit) 가 잡지 않음 — 수동 호출:
  `python3 -m unittest tests.scale.test_scale`. 3000+ 는 `HARNESS_SCALE_FULL=1`
  env 로 옵트인. CI 에 안 들어감 (느림).

**실측 결과 (2026-04-27, M-class 머신)** — 가설 조정의 근거:

| N | yaml_load | yaml_dump | validate | hash | summary |
|---|---|---|---|---|---|
| 100 | 0.024s | 0.015s | 0.028s | 0.0004s | 0s |
| 1000 | 0.22s | 0.13s | 0.04s | 0.003s | 0.0002s |
| 3000 | 0.68s | 0.41s | 0.06s | 0.008s | 0.0005s |
| 10000 | 2.40s | 1.43s | 0.15s | 0.027s | 0.002s |

**관찰**:

- **YAML parse 가 가장 큰 병목** — 10000 에서 2.4s. work.py 매 호출마다
  fresh parse 라 사용성에 영향.
- **canonical_hash 와 summary 는 사실상 무료** — 10000 도 30ms 미만. Merkle
  + per-feature 단순 추출의 효과.
- **validate 도 빠름** — 10000 에서 0.15s.
- 가설 조정: scripts 자체 latency 임계점은 ~3000 (yaml_load 0.7s) 이며,
  진짜 한계는 LLM context (hash/summary 가 무료이므로 sharding 진입로는
  LLM-side 가 우선이지 도구-side 가 아님).

### Notes

- 누적 테스트 850 → 869 (+11 F-029, +8 F-030; F-031 stress 는 unit suite
  에 미포함).
- features count 28 → 31.
- 셋 모두 prototype 모드 풀 사이클 (gate_0 + gate_5 + evidence + complete) 완주.
- 후속 후보: ~300 features 임계점에서 archival convention 운용 (F-029 archived_at
  채우기 + spec/archive/YYYY.yaml 이동), ~1000 features 임계점에서 sharding 활성화
  (shard.py 호출 + CLAUDE.md.template 이 summary import 로 전환).

## [0.10.5] — 2026-04-27

**Init/work observability — issue logging (F-027) + prompt logging (F-028).**

사용자가 외부 프로젝트에서 `/harness-boot:init` · `/harness-boot:work` 를
사용하면서 (a) 마주친 harness-boot 마찰을 표준화된 형식으로 적게 하고,
(b) 입력 프롬프트를 자동 누적하여 추후 plugin 개선 (메인테이너 환원 사이클)
+ prompt 형상화 데이터로 활용한다. cosmic-suika 가 수동 운영해온 ISSUES-LOG
패턴을 플러그인 차원에서 표준화 + 자동화.

### Added — F-027 (issue logging convention)

- **`commands/init.md`** + **`commands/work.md`** 양쪽에 `## Issue logging`
  섹션 추가. 사용자 프로젝트의 `.harness/_workspace/issues-log.md` 에
  Claude 가 마찰을 발견할 때마다 한 entry 씩 append 하도록 지시.
- **Entry schema** (markdown, append-only): `Source` · `Category` (ergonomics
  / bug / missing-feature / dead-reference / docs-stale / gate-detect) ·
  `Severity` (blocker / annoying / trivial) · `What happened` ·
  `Suggested fix`.
- **5 신규 tests** in `tests/unit/test_command_issue_log.py` —
  섹션/경로/필드 grep + anti-rationalization (BR-014) 보존 검증.

### Added — F-028 (prompt logging hook)

- **`hooks/prompt-log.sh`** 신설 — UserPromptSubmit hook script. 사용자
  프로젝트의 `.harness/_workspace/prompts/YYYY-MM.jsonl` 에 prompt 를
  무음 append. fail-open (빈 stdin · 권한 부재 · python3 부재 등 어떤
  에러 경로도 exit 0 + 무출력).
- **`hooks/hooks.json`** 에 UserPromptSubmit 등록 (SessionStart 와 동일
  pattern, 2>/dev/null + `|| true`).
- **`.harness/` 부재 시 silent exit 0** — 대부분의 워크스페이스에 영향 X.
- **JSONL entry schema**: `{ts, session_id, prompt}` · UTF-8 보존
  (Korean/CJK round-trip).
- **`user_prompt` 키 우선 + `prompt` 키 fallback** — Claude Code 버전 호환.
- **7 신규 tests** in `tests/unit/test_prompt_log_hook.py` — 스크립트
  존재/executable + hooks.json 와이어링 + 4 behavior contract.

### Notes

- F-027 은 LLM 디시플린 (instruction 기반) — Claude 가 마찰을 봤을 때
  적느냐가 운용 핵심. `NO skip` 명시.
- F-028 은 자동 (hook 기반) — 사용자가 `/harness-boot:*` 외 일반 prompt 도
  모두 캡처. `.harness/` 가 있는 워크스페이스에서만 활성화.
- 누적 테스트 838 → 850.
- 두 피처 모두 prototype 모드 풀 사이클 (gate_0 + gate_5 + evidence +
  complete) 완주. features 26 → 28.

## [0.10.4] — 2026-04-27

**Phase 2 self-hosting active — harness-boot 자체 도그푸드 활성화 + ergonomics 정리.**

2026-04-25 의 deferral 이 사용자 결정으로 뒤집혀 본 레포의 모든 신규 피처가
`python3 scripts/work.py` 사이클을 거친다 (cosmic-suika 와 동일 규약).
`project.mode: prototype` 으로 시작. 활성화 자체를 F-025 로 트래킹, 직후
발견된 5 갭 (smoke shim · stale doc · dead-ref · CHANGELOG · gate_0 scope) 을
F-026 으로 묶어 첫 풀 사이클 reference 로 완주.

### Added

- **`scripts/smoke.sh`** — `self_check.sh` 의 thin wrapper. `scripts/gate/runner.py`
  의 gate_5 auto-detect 가 가장 먼저 잡아 `--override-command` 의존 제거.
- **`pytest.ini`** — `testpaths = tests/unit` 으로 베어 `python -m pytest` 의
  scope 고정. 이전엔 `design/oss-refs/` (gitignored 외부 OSS 참조본) 까지
  recursive collection 시도하다 의존성 부재로 collection error → exit 2.
  gate_0 가 베어 pytest 를 호출하므로 override 불필요해짐.
- **F-025 · F-026** in `docs/samples/harness-boot-self/spec.yaml` +
  `.harness/spec.yaml` — Phase 2 활성화 (F-025) 와 후속 정리 (F-026).
  features 24 → 26.
- **`project.mode: prototype`** in spec — Iron Law D 는 evidence ≥ 1 + gate_5 pass.
  product 로 promote 는 사용자 결정 시점.

### Changed

- **`CLAUDE.md`** v0.3.9 표기 → v0.10.3 reality 로 전면 갱신 (§1~§9). slash
  명령 8 → 2 (init · work), 자체 도그푸드 정책 Phase 1 observational →
  Phase 2 active flip. v0.4 ~ v0.10 narrative 추가.
- **`hooks/session-bootstrap.sh`** dead reference 수정: 안내 명령
  `/harness:status` (v0.9.0 통합 시 부재화) → `/harness-boot:work` (no-args
  대시보드, v0.9.2 entry point). **사용자 visible behavior change** —
  플러그인 설치된 모든 워크스페이스의 SessionStart 배너에 영향.
- **`.harness/README.md`** · **`scripts/self_check.sh`** 헤더 — Phase 1 표기를
  Phase 2 active 로 갱신. README 에 work.py 4-verb 사이클 사용 예시 추가.
- **`.gitignore`** — `.harness/_workspace/` 추가 (kickoff · retro · design_review
  · questions ceremony 산출 미추적).

### Notes

- F-025 사이클: gate_5 (override 시기) + 1 declared evidence → done.
- F-026 사이클: gate_0 (838 tests) + gate_5 (smoke shim 자동) + 1 declared
  evidence → done. **Phase 2 의 첫 풀 사이클 reference**.
- 회귀: self_check 5/5 + 838 tests OK.
- 메모리 갱신: `project_self_hosting_deferred` → `_active`,
  `feedback_cosmic_suika_harness_only` 일반화 (cosmic-suika + harness-boot
  양쪽 적용).
- 다음 신규 피처부터는 `--override-command` 없이 `--run-gate gate_0/5` 만으로
  깔끔하게 굴러감. Phase 2 의 정상 형태 확보.

**v0.8 완결** (PR-α + PR-β):

- ~~Design review auto-wire~~ ✅ v0.8.0
- ~~나머지 agent fixtures (8 종)~~ ✅ v0.8.1 — 15/15 fixtures 전원 완결

**v0.9 범위 후보 (novel axis)**:

- URL → design seed: `/harness:clone <url>` 또는 별도 `harness-seed` 플러그인. `.harness/_workspace/design/{flows,tokens,components}.md|yaml` 를 자동 시드 · visual-designer/ux-architect 는 refine 역할로 전환. (2026-04-24 검토 — scope 크고 IP 경계 주의 필요)
- gate_perf auto-detect heuristics (lighthouse.config.js · k6 · wrk 설정 감지)

**기타 backlog**:

- ~~Phase 3 CI — `.github/workflows/self-check.yml` + PR gate~~ ✅ v0.8.3
- Cross-language hash test vectors (Appendix D.7)
- ~~Event log rotation (`events.log.YYYYMM`)~~ ✅ v0.8.6
- AC coverage drift (check.py 11 번째 drift 후보)
- pre-commit hook (Phase 2 자동 enforcement) — 디시플린이 흔들릴 때 진입 후보.

## [0.10.3] — 2026-04-27

**Iron Law D — product mode strict (cosmic-suika I-008 환원).**

이전 contract (gate_5 pass + N declared evidence) 만으로는 gate_2 (lint)
fail 이 있어도 complete 가 통과하던 문제. product 모드는 이제 record 된
모든 gate 의 last_result 가 fail 이 아닐 때만 통과한다. prototype 모드는
lighter contract 유지.

### Changed

- **`scripts/work.py::complete`** — product 모드일 때 추가 검증 1 단계:
  ``gates`` 맵에서 ``last_result == "fail"`` 인 항목이 하나라도 있으면
  reject. 메시지에 모든 fail gate 이름 나열 (정렬). prototype 모드는
  검증 skip — 현행 동작 유지. ``hotfix_reason`` 제공 시 strict 우회 가능
  (audit trail 은 hotfix evidence 로 보존).

### Notes

- skipped / unrecorded gate 는 검증 대상 아님 — 사용자가 특정 gate 를
  의도적으로 안 돌렸을 수 있음 (도구 미설치 환경 등). record 된 gate
  중 fail 만이 차단 사유.
- 검증 순서: gate_5 pass → product strict → declared evidence 카운트 →
  state 전이. 가장 직접적인 gate fail 을 먼저 거름.
- 8 new tests in `tests/unit/test_iron_law_declared.py`
  (ProductModeFailedGateTests). 누적 838 tests OK.

## [0.10.2] — 2026-04-27

**npm scripts auto-detection — gate_runner cosmic-suika I-001 환원.**

npm-only 프로젝트가 `pyproject.toml` 부재 + `tests/` 디렉터리 (vitest 등의
관용) 가 있을 때 gate_0 이 unittest fallback 으로 잘못 잡히는 문제 + 사용자
정의 npm scripts (typecheck/lint/test:coverage/smoke/test:e2e) 가 무시되는
문제를 해결.

### Added

- **`_npm_script_command(project_root, script_name)`** in
  `scripts/gate/runner.py` — package.json scripts → `npm run <script>`
  (또는 `npm test` for `script_name == "test"`). package.json 부재,
  scripts 부재, script 미정의, npm PATH 부재 모두 None 반환.
- **gate_1 (typecheck)** — `package.json scripts.typecheck` 매핑 (tsc 직접
  호출보다 우선, pyproject + mypy/pyright 보다는 후순위).
- **gate_2 (lint)** — `package.json scripts.lint` 매핑 (eslint 직접 호출 ·
  npx fallback 보다 우선).
- **gate_3 (coverage)** — `package.json scripts.test:coverage` (vitest/jest
  관용) 우선, 없으면 `coverage`. 도구 직접 호출 (nyc) 보다 우선.
- **gate_5 (smoke)** — `package.json scripts.smoke` 우선, 없으면
  `test:e2e` (Playwright/Cypress 관용). 단 `scripts/smoke.sh` 는 명시적
  entry point 라 npm scripts 보다 더 우선.

### Changed

- **gate_0 (test) 우선순위 재배치** — `pyproject + pytest` 다음으로 npm
  `scripts.test` 가 `tests/` unittest fallback **보다 위**. 이전엔 마지막
  fallback 이라, npm-only 프로젝트가 vitest 용 `tests/` 디렉터리를 갖고
  있으면 `python -m unittest discover tests` 로 잘못 잡혔음.
- **gate_5 우선순위 재배치** — `scripts/smoke.sh` 다음으로 npm
  `scripts.smoke` / `test:e2e` 가 `tests/smoke/` unittest fallback **보다
  위**. cosmic-suika 의 playwright e2e 의도 보존.

### Notes

- 우선순위 일반 원칙 (gate_1~5 공통): **pyproject (Python 도구) > 사용자
  정의 npm scripts > 도구 직접 호출 (eslint, tsc, nyc) > 언어별 polyglot
  fallback**. mixed (pyproject + package.json) 프로젝트에서는 Python 도구가
  우선 — 풀스택 monorepo 가 한 root 에 같이 있으면 backend 검증이 더
  엄격하다는 일반적 expectation 반영.
- `_npm_script_command` 는 read-only · 부작용 없음. CQS 보존.
- 23 new tests (NpmScriptCommandHelperTests + 각 DetectGateNTests 의 npm
  분기 + 우선순위 케이스). 누적 830 tests OK.

## [0.10.1] — 2026-04-27

**cosmic-suika ISSUES-LOG 환원 patch — AnchorIntegration drift +
no-args dashboard 후보 가시화.**

dogfood 프로젝트 (cosmic-suika) 에서 누적된 이슈 중 플러그인 코드/스키마
부족함으로 환원 가능한 두 건 (I-010, I-002) 을 묶어서 처리.

### Added

#### I-010 — AnchorIntegration drift (declarative integration wiring guard)

35 개 피처가 독립적으로 모두 gate_5 (smoke) 를 통과했음에도 통합 진입점
(`src/main.ts`) 이 비어 있어 end-to-end 동작이 안 됐다. per-feature smoke
만으로는 검출 불가능한 통합 wiring 누락을 declarative 로 가드한다.

- **`features[].integration_anchor: string[]`** schema field in
  `docs/schemas/spec.schema.json` — optional list of project-relative
  anchor file paths. Feature 가 ship (`status=done`) 시 declared
  module 의 basename 또는 path-token stem 이 anchor 파일들 중 적어도
  하나에 등장해야 한다. Backward-compatible — 기존 spec 은 변경 없이 검증.
- **`AnchorIntegration` drift in `scripts/check.py`** (drift catalog
  11/11) — `Stale` 과 동일한 grep-level 휴리스틱 (`basename`, `/stem`,
  `"stem`, `'stem`). Severity:
  - `error` — anchor 파일이 부재 (사용자가 잘못된 경로를 적음).
  - `warn` — 어떤 anchor 에서도 module 참조 못 찾음 (통합 누락 가능성;
    Iron Law 위반은 아님).
  - silent — `archived`, `superseded_by`, status≠`done`,
    `integration_anchor` 미선언/빈 배열, `modules` 비어 있음.
- 12 new tests in `tests/unit/test_check.py` (basename/stem 매칭,
  any-of 시맨틱, 면제 조건, anchor 부재 error, run_check 등록).

#### I-002 — `/harness:work` 빈 호출 대시보드에 spec 미등록 후보 노출

기존 빈 호출 대시보드는 `state.yaml` 에 등록된 피처만 표시 → spec.yaml 에
정의된 31 개 피처 중 아직 activate 가 일어나지 않은 후보가 비가시화. 사용자가
무엇을 다음에 시작해야 하는지 발견 어려움.

- **`scripts/ui/dashboard.py::_render_unregistered`** — spec features ∖
  state by_id 차집합을 spec 순서로 표시. 헤더에 총 후보 수, 5 개 초과 시
  `… 외 N 개 (spec.yaml 참조)` 힌트. archived / superseded_by 면제.
- **`scripts/ui/intent_planner.py::_first_unregistered_in_spec`** — idle
  분기에서 state-level planned 가 없을 때 spec-level 첫 미등록 피처를
  `start_feature` 액션으로 추천. in_progress 가 있으면 resume 이 우선,
  unregistered 가 보조로 따라옴.
- empty-state hint (`아직 피처가 없습니다`) 는 unregistered 후보가 있으면
  표시 안 됨 (사용자가 곧바로 후보를 보게 됨).
- 13 new tests in `tests/unit/test_dashboard.py` · `test_intent_planner.py`.

누적 807 tests OK.

### Notes

- `integration_anchor` 는 opt-in. 기존 프로젝트는 바꾸지 않으면 드리프트
  없음. 사용자가 anchor 를 적는 순간부터 검증.
- 휴리스틱은 import graph 를 파싱하지 않는다 — false negative (런타임
  문자열 조립으로 import) 와 false positive (anchor 파일에 동명 식별자가
  무관하게 등장) 모두 가능. Pragmatic by design.
- Dashboard 변경은 CQS 보존 — 파일 수정 없음. work.py main() 의 빈 호출
  분기는 그대로이며, ui 모듈 두 곳만 수정.

## [0.10.0] — 2026-04-25

**Two-layer supersession — features[] supersedes/superseded_by + archive flow + Stale drift.**

Resolves the asymmetry surfaced by the cosmic-suika dogfood: `decisions[]`
already had `supersedes` for ADRs, but features had no equivalent. Pivots
forced a binary choice — rewrite history (lose audit) or leave dead code
(lose reality). The two-layer model splits these cleanly:

- **Spec is additive** — features never deleted; `supersedes` /
  `superseded_by` chain marks replacement (mirrors the ADR pattern).
- **State is transitional** — `done → archived` through a new audited
  `feature_archived` event.
- **Code is replacement** — dead modules can be deleted freely; the new
  `Stale` drift surfaces done features whose declared modules are
  unreferenced and not yet archived/superseded.

### Added

- **`features[].supersedes` / `features[].superseded_by`** schema fields
  in `docs/schemas/spec.schema.json` — array of `F-N` and single `F-N`
  string respectively, both optional, mirroring the existing
  `decisions[].supersedes` pattern. Backward-compatible: existing specs
  validate unchanged.
- **`scripts/work.py archive(...)`** + `--archive [--superseded-by F-N]
  [--reason "..."]` CLI flags — transition a `done` feature to
  `archived`, append `feature_archived` event with `superseded_by` /
  `reason` to `events.log`, and force-refresh the retro template so the
  new "Superseded By" section can fill in. Guards: feature must be
  `done`, `--superseded-by` target must exist in spec, idempotent on
  re-archive.
- **`Stale` drift** in `scripts/check.py` — flags features where
  `status == "done"`, declared `modules` exist with concrete `source`
  paths, but no `src/` file references them. Severity `warn` (gives
  cleanup time, not Iron Law). Exempted: `status == "archived"`,
  `superseded_by` set, or no modules declared. Silent when no `src/`
  tree (non-typescript/python repos).
- **`scripts/check.py::check_anchor`** extension — Anchor drift now also
  validates `supersedes` / `superseded_by` references: dangling-ref,
  self-ref, cycle detection (DFS), and bidirectional consistency
  (`A.superseded_by = B` must match `B.supersedes ⊇ [A]`, else warn).
- **`scripts/ceremonies/retro.py`** — `analyze` detects
  `feature_archived` events; template renders an auto-filled
  `## Superseded By` section showing replacement F-N + reason +
  timestamp. Renders in both `prototype` and `product` modes.
- **`tests/unit/test_feature_supersedes.py`** (new, 12 tests) —
  reference validity, self-ref rejection, two-/three-node cycle
  detection, bidirectional consistency, dangling-ref handling.
- **`tests/unit/test_check.py::StaleDriftTests`** — 8 tests covering the
  Stale drift exemptions and detection.
- **`tests/unit/test_work.py::ArchiveTests`** — 9 tests covering
  archive transitions, idempotency, guards, event emission.
- **`tests/unit/test_retro.py::ArchivedRetroSectionTests`** — 5 tests
  covering Superseded By section rendering across modes.
- **`tests/unit/test_schema_additive.py::FeatureSupersedesSchemaTests`**
  — schema-shape backward-compat assertions.

### Changed

- `DriftKind` comment updated to include `Stale`. `run_check` registers
  the new check after `Adr` so the order in `Checked:` line stays
  predictable.

### v0.9.x → v0.10.0

| Version | Status |
|---|---|
| v0.9.0 ~ v0.9.6 | shipped |
| **v0.10.0** | ✅ Two-layer supersession metadata |

### Numbers

- Tests: 764 → 802 (+38).
- self_check 5/5 PASS.
- New module surface: schema fields ×2, drift kind ×1, CLI flag ×3,
  retro section ×1.

### Validated externally

The cosmic-suika dogfood was the first consumer: 3 design pivots
accumulated 3 done features (`F-037 / F-038 / F-040`) that no longer
matched the implemented game. After v0.10.0 they're marked
`superseded_by F-042 / F-043` and archived, and ~600 LOC of orphaned
modules (sun.ts, sun-surface.ts, saturn-ring.ts, sun-absorption.ts +
test, launcher-anchor.ts) deleted with `check.py` Stale drift staying
clean. The audit chain — every pivot recorded in `events.log` with
reason — survived intact.

## [0.9.6] — 2026-04-25

**Project mode axis — `prototype` vs `product` ceremony lightening.**

`spec.project.mode` becomes a single switch that simultaneously tightens or
relaxes Iron Law D (already in place since v0.9.3), kickoff template depth,
retrospective template depth, and design-review autowire. Existing specs
without the field continue to behave identically (defaults to `product`).

### Added

- **`scripts/core/project_mode.py`** — shared `resolve_mode(spec) -> "prototype" | "product"` helper. Pure function, no I/O. Replaces the duplicated mode resolution that was inlined in `scripts/work.py`.
- **`scripts/ceremonies/kickoff.py`** — `generate_kickoff(..., mode=...)`. `prototype` renders one bullet per agent and a one-line guidance comment; `product` keeps the original three-bullet / 80-word prompt. Agent list itself unchanged across modes — only per-agent depth is lightened. The `kickoff_started` event now carries `mode`.
- **`scripts/ceremonies/retro.py`** — `generate_retro(..., mode=...)`. `prototype` renders only the three machine-extractable sections (What Shipped · First Gate to Fail · Ceremonies summary) and skips the five LLM-driven sections that need a reviewer→tech-writer pass. `feature_retro_written` event now carries `mode`.
- **`scripts/work.py::_autowire_design_review`** — fourth AND condition: skips the autowire when mode is `prototype`. Explicit `--design-review` flag still forces generation in either mode.
- **`docs/schemas/spec.schema.json`** — `project.mode` enum (`prototype` · `product`) added with description.
- **`tests/unit/test_project_mode.py`** — 22 tests:
  - `resolve_mode` (11) — defaults, enum gating, malformed input handling, non-dict spec.
  - Kickoff lightening (4) — product 3-bullets, prototype 1-bullet, default mode, event metadata.
  - Retro lightening (4) — product full template, prototype machine-only, default mode, event metadata.
  - Design-review autowire (3) — product autowires, prototype skips, prototype `--design-review` overrides skip.

### Changed

- `scripts/work.py` no longer holds its own `_resolve_project_mode` — imports `core.project_mode.resolve_mode`. All Iron Law D mode lookups, kickoff autowire, retro autowire, and design-review autowire now go through the same single path.

### v0.9.x progress

| Version | Status |
|---|---|
| v0.9.0 | ✅ Namespace rename + 6 commands removed |
| v0.9.1 | ✅ feature_resolver |
| v0.9.2 | ✅ Dashboard + intent_planner |
| v0.9.3 | ✅ Iron Law D + hotfix override |
| v0.9.4 | ✅ Scenario contract table + integration tests + plugin description modernization (round 1) |
| v0.9.5 | ✅ README user-friendly rewrite + plugin description tagline style |
| **v0.9.6** | ✅ project.mode prototype/product ceremony lightening |
| v0.10.0 | ⏳ Legacy shim removal · README top reorganization |

### Numbers

- Tests: 742 → 764 (+22).
- self_check 5/5 PASS.
- One new module (`scripts/core/project_mode.py`), schema enum addition, three ceremony / autowire touch-ups.

## [0.9.5] — 2026-04-25

**Docs-only patch — README / 플러그인 description 사용자 친화 개편.**

v0.9.4 에서 나온 README 가 타이틀 문장 가치 제안 부족 · 내부 용어 (F-N · AC · Iron Law D · CQS · drift 10) 노출 · "솔로 음악인 연습용 포모도로" niche 예시 · 구조 다이어그램 부재로 사용자가 이해하기 어렵다는 피드백. 이 릴리즈는 코드 변경 없이 문서만 교체.

### Changed

- **`README.md`** 전면 재작성 — 가치 제안 기반 재배열:
  - 타이틀 문장: v0.9.3 의 원문 복원 ("자연어 아이디어를 스펙으로 굳히고, 전문가 에이전트 팀이 역할별로 협업해 ...").
  - **전체 구조** 섹션 신설 — 아이디어 → `spec.yaml` (단일 원천) → 파생 문서 + 전문가 팀 → `/harness-boot:work` 흐름을 ASCII 로 시각화.
  - 예시 교체 — "솔로 음악인 연습용 포모도로 타이머" → **"간단한 할 일 관리 앱"** / "로그인 기능" / "회원가입" 등 모두 이해 가능한 보통 이름.
  - 내부 용어 은닉 — F-N · @F-N · AC · gate_0~5 · Iron Law D · CQS · drift 10-way · declared evidence 를 사용자 섹션에서 제거. 쉬운 문구로 풀어 서술 (유일 잔존 위치: CI 사용 예시 코드 블록 — 기술 맥락상 적절).
  - **이런 분에게 유용합니다** 재작성 — negative framing ("'다 됐다' 통제") 제거, positive value 기반 (일관 흐름 · 역할 분리 · 결정 맥락 유지 · 축적된 스펙 위 협업).
  - "일상 / 매일" → "작업 / 이후 작업" 용어 통일 (4 곳).
  - `spec.yaml` 문구 갱신 — "사용자가 직접 편집하는 파일" → "자연어 대화로 자동 생성 · 갱신되는 시스템 원천". 직접 편집은 escape hatch 로 재위치.
  - 마케팅성 섹션 (Phase 1~4 로드맵 · "적은 인원 × 큰 시스템") 유지 제거.
- **`.claude-plugin/plugin.json`** · **`.claude-plugin/marketplace.json`** — description 을 타이틀 문장 스타일로 교체: "자연어 아이디어를 스펙으로 굳히고 ... AI 개발 하네스 프레임워크. Claude Code 플러그인 · 2 개 slash command ... 외울 것 최소화 · 자연어 입력."

### v0.9.x 진행

| 버전 | 상태 |
|---|---|
| v0.9.0 | ✅ namespace rename + 6 command 삭제 |
| v0.9.1 | ✅ feature_resolver |
| v0.9.2 | ✅ dashboard + intent_planner |
| v0.9.3 | ✅ Iron Law D + hotfix override |
| v0.9.4 | ✅ 시나리오 매핑 · 통합 테스트 + 플러그인 description 1차 현대화 |
| **v0.9.5** | ✅ README 사용자 친화 재구성 + 플러그인 description 타이틀 스타일 |
| v0.9.6 | ⏳ `project.mode` prototype/product 분기 · 의례 경량화 (v0.9.5 로 계획됐던 항목) |
| v0.10.0 | ⏳ legacy shim 제거 |

### Numbers

- Tests: 742 (unchanged — docs-only).
- README: 322 줄 (v0.9.4 의 298 대비 + 구조 다이어그램 / walkthrough).
- self_check 5/5 PASS.

## [0.9.4] — 2026-04-25

**UX re-architecture step 5 — README 전면 개편 · 시나리오 매핑 계약 테이블 · 플러그인 description 현대화.**

### Added

- **`scripts/ui/scenarios.py`** — 자연어 phrase ↔ 내부 action canonical 계약 테이블.
  - `ScenarioMapping(category, phrases, action, description, read_only)` frozen dataclass.
  - `SCENARIOS` tuple 10 entries · 5 categories (일상 · 시작 · 근거 · 정리).
  - `Action` Literal 9 values (dashboard · activate · run_gates · complete · block · deactivate · add_evidence · remove · switch).
  - `dispatch_action_name(action) -> str` — action id → `scripts/work.py` 함수명.
  - `as_readme_rows()` — README 렌더링용 `(category, phrases, description)` 표.
- **`tests/integration/test_scenario_mappings.py`** — 20 tests, 4 categories:
  - Structural — 빈 리스트 · frozen · known action · 빈 phrases · 빈 description · dashboard=read_only · ≤ 6 categories.
  - Dispatch — 모든 action 이 dispatch name 보유 · `work.py` 에 해당 attr 존재 + callable.
  - README rendering — row 개수 일치 · phrase quoting.
  - End-to-end smoke — dashboard snapshot · activate · block · deactivate · add_evidence · complete (Iron Law D) · remove · run_gates.
  - Coverage — Action literal 전부 SCENARIOS 에 등장 (switch 별칭 제외).

### Changed

- **`README.md`** — 전면 재작성 (370 → 225 줄):
  - 한 줄 tagline 을 2-command UX 에 재정렬.
  - "어떻게 말해도 됩니다" 시나리오 매핑 섹션 신설 (scenarios.py 와 동기).
  - 8 commands 잔상 제거 — 모든 예제를 `/harness-boot:work` 자연어 형식으로 통일.
  - Iron Law D · drift 10/10 · CQS · events chain 을 "품질 불변량" 한 섹션으로 통합.
  - Phase 1~4 로드맵 · "적은 인원 × 큰 시스템" 마케팅 섹션 제거 — 현실적 현재 상태 + 열린 작업으로 대체.
  - FAQ 4 → 5 항목 · CI 사용법 명시 추가.
  - 뱃지: v0.9.4 · tests 742.
- **`.claude-plugin/plugin.json` · `.claude-plugin/marketplace.json`** — description 완전 교체.
  - 구: "Plan.md 하나로 출발해 ..." (plan.md 만 입력으로 가정하던 v0.2 시절 표현)
  - 신: "Claude Code 용 spec-driven 개발 하네스. 2 개 명령으로 자연어 아이디어부터 완료까지. Iron Law D · drift 10/10 · events.log · 16 에이전트 · 4 루틴 auto-wire."

### v0.9.x 진행

| 버전 | 상태 |
|---|---|
| v0.9.0 | ✅ namespace rename + 6 command 삭제 |
| v0.9.1 | ✅ feature_resolver |
| v0.9.2 | ✅ dashboard + intent_planner |
| v0.9.3 | ✅ Iron Law D + hotfix override |
| **v0.9.4** | ✅ README 전면 개편 · 시나리오 매핑 · 플러그인 description 현대화 |
| v0.9.5 | ⏳ `project.mode` prototype/product 의례 경량화 분기 |
| v0.10.0 | ⏳ legacy shim 제거 · README 상단 재작성 |

### Numbers

- Tests: 722 → 742 (+20 integration).
- README: 370 → 225 줄 (39% 감소).
- self_check 5/5 PASS.
- 신규 모듈 1 개 (`scripts/ui/scenarios.py`) · 신규 test dir (`tests/integration/`).

## [0.9.3] — 2026-04-25

**UX re-architecture step 4 — Iron Law D (누적 declared evidence). BR-004 강화: gate_5 pass + 최근 7 일 declared evidence N 개.**

### Added

- **`scripts/core/state.py`**:
  - `is_declared_evidence(ev) -> bool` — evidence kind 를 automatic vs declared 로 분류. `gate_run` / `gate_auto_run` 만 automatic, 나머지 (test · manual_check · user_feedback · reviewer_check · blocker · hotfix · generic · 미지정 kind) 는 declared. Kind-based 분류로 기존 state.yaml 과 forward-compatible (migration 불필요).
  - `count_declared_evidence(feature, *, window_days=7, now=None) -> int` — 최근 trailing window 내 declared 카운트. ts 누락 / 파싱 실패 entry 는 최근 취급 (보수적 — 타임스탬프 없다고 불이익 없음).
  - `IRON_LAW_D_DEFAULT_WINDOW_DAYS = 7` 상수.
- **`scripts/work.py`**:
  - `_resolve_project_mode(spec) -> "product" | "prototype"` — `spec.project.mode` 읽기, 미정·미지원 값은 `product` (strict default) fallback.
  - `complete(harness_dir, fid, *, hotfix_reason=None)` — Iron Law D 로 전면 교체:
    - product (default): 3 declared.
    - prototype (`spec.project.mode: prototype`): 1 declared.
    - `--hotfix-reason "..."`: product 에서도 1 declared 허용. 사유가 `kind=hotfix` evidence 로 자동 append 되어 audit 에 남음. 빈 사유 거부.
    - 거부 시 state.yaml 불변 — hotfix 경로 rollback 포함.
    - `feature_done` event 에 `iron_law_mode` · `declared_count` · `required` · `hotfix_reason` 첨부.
  - CLI `--hotfix-reason FLAG`.
- **`tests/unit/test_iron_law_declared.py`** — 33 tests:
  - Kind taxonomy (10) · count window (7) · product mode completion (4) · prototype mode (2) · mode resolution edge cases (3) · hotfix override (5) · event metadata (1) · CLI wiring (1).
- **`commands/work.md`** — "완료 (done 전이)" 섹션 Iron Law D 로 재작성 + kind taxonomy 표.

### Changed

- **`tests/unit/test_work.py::CompleteTests`** · **`test_work_autowire.py`** · **`test_work_ux.py`** — 기존 1-evidence 기반 테스트를 3-declared 기반으로 업데이트 (product default 일관). `test_plan_to_done` 은 3 declared (test · manual_check · reviewer_check) 로 확장.

### Design

**왜 "누적 declared" 인가** (요구사항 재검토 결과):
- 기계 필터 (길이 / 키워드 규칙) 는 "ok" 3 번도 통과 — 성의의 역설. 제거.
- 개수 자체가 성실성 신호: 하나하나 짧아도 세 번 쓰는 **행위** 가 의도를 입증.
- TDD 사이클에서 test · manual_check · reviewer_check 는 **자연히** 쌓임 — 억지 요구 아님.
- Hotfix 는 긴급 예외 경로로 인정 (single-entry + reason). audit 에 투명하게 남김.
- Automatic (`gate_run`) 은 gate runner 부산물이라 자기증명에 불인정 — 이게 핵심.

### v0.9.x 진행

| 버전 | 상태 |
|---|---|
| v0.9.0 | ✅ namespace rename + 6 command 삭제 |
| v0.9.1 | ✅ feature_resolver |
| v0.9.2 | ✅ dashboard + intent_planner |
| **v0.9.3** | ✅ Iron Law D + hotfix override |
| v0.9.4 | ⏳ 시나리오 매핑 integration test · README "어떻게 말해도 됩니다" |
| v0.9.5 | ⏳ `project.mode` prototype/product 의례 경량화 |
| v0.10.0 | ⏳ legacy shim 제거 · README 재작성 |

### Numbers

- Tests: 689 → 722 (+33 Iron Law D + 기존 테스트 업데이트).
- self_check 5/5 PASS.

## [0.9.2] — 2026-04-25

**UX re-architecture step 3 — 빈 호출 대시보드 + intent_planner 결정론 추천. `/harness-boot:work` 하나로 상태 파악 + 다음 할 일 한 눈에.**

### Added

- **`scripts/ui/intent_planner.py::suggest(state, spec) -> list[Suggestion]`** — 상태 → Top 1~3 다음 행동 추천. 순수 결정론 (LLM 호출 없음).
  - Active feature 있을 때: `blocked/blocker` 최우선 → gate `fail` 분석+재실행 → 가장 이른 미통과 gate 실행 → `gate_5` 통과+근거 0 → 근거 추가 → 완료 처리.
  - Active 없을 때: `in_progress` 존재 → 이어 작업 / `planned` 존재 → 다음 피처 시작 / 없음 → 새 피처 등록.
  - `Suggestion(label, action, feature_id, gate)` frozen dataclass. `action` 은 machine id (`run_gate` · `complete` · `resolve_block` · ...).
  - Title lookup: 가능한 곳마다 `spec.features[].name` 을 label 에 임베드 — 사용자가 F-N 대신 제목으로 인식.
- **`scripts/ui/dashboard.py::render(state, spec, suggestions) -> str`** — 빈 호출 대시보드 렌더러. 순수 함수 · I/O 없음.
  - 섹션: `작업 중` (title · 검증 N/6 통과 · 근거 N 개 · 차단 note) · `진행 중 (다른)` · `보류` · `대기` · `다음 할 일`.
  - 최근 non-blocker evidence 가 있으면 이전 blocker note 자동 억제 — 해결 후 차단 문구 잔상 제거.
  - "Enter = 1 (추천)" 푸터로 Top 추천 즉시 선택 경로 안내.
- **`scripts/work.py`** — 빈 호출 분기 추가. `python3 scripts/work.py` (feature id 없음) → 대시보드 출력. `--json` 지원 (snapshot shape).
  - `dashboard_snapshot(harness_dir) -> dict` 공개 — State · spec · suggestions · counts · active_feature_id 를 묶어 반환. CQS (읽기 전용).
- **`tests/unit/test_intent_planner.py`** — 22 tests:
  - Suggestion 데이터 형상 · default fields.
  - Idle paths: 빈 state / 계획 only / 진행 중 only / 진행+계획 공존 / dangling active.
  - Gate progression: no gates → gate_0 / gate_0 pass → gate_1 / 0~4 pass → gate_5.
  - Completion: all pass 근거 0 → add_evidence / all pass 근거 ≥ 1 → complete.
  - Fail/block: gate fail → analyze+rerun / blocked status → resolve_block / blocker evidence → resolve_block / blocker 뒤 non-blocker 이면 정상 흐름 복귀.
  - Malformed inputs · title lookup.
  - Max 3 suggestions.
- **`tests/unit/test_dashboard.py`** — 19 tests:
  - Render — 빈 state / active block / 제목 lookup / blocker note / blocker 자동 억제 / title fallback to id.
  - Sections — 진행 중 others / pending / blocked / active 는 others/blocked 에서 제외.
  - Suggestion block — 번호 · 추천 marker · "Enter = 1".
  - CLI integration — `work.py` 빈 호출 · JSON 출력 · state/events mtime 불변 · 파일 생성 없음 · missing harness_dir 에러.
- **`commands/work.md`** — `### 대시보드 (v0.9.2 — 빈 호출)` 섹션 추가.

### v0.9.x 진행

| 버전 | 상태 |
|---|---|
| v0.9.0 | ✅ namespace rename + 6 command 삭제 |
| v0.9.1 | ✅ feature_resolver 모듈 + 테스트 |
| **v0.9.2** | ✅ dashboard + intent_planner (읽기 전용 진입점) |
| v0.9.3 | ⏳ Iron Law D · 누적 declared evidence · hotfix flag |
| v0.9.4 | ⏳ 시나리오 매핑 integration test · README "어떻게 말해도 됩니다" |
| v0.9.5 | ⏳ `project.mode` prototype/product 분기 |
| v0.10.0 | ⏳ legacy shim 제거 · README 재작성 |

### Numbers

- Tests: 666 → 687 (+21 — intent_planner 22 tests 중 일부는 기존 helper 와 중복되지 않음, dashboard 19 tests).
- `scripts/ui/` 총 3 모듈: feature_resolver (v0.9.1) · intent_planner · dashboard.

## [0.9.1] — 2026-04-25

**UX re-architecture step 2 — title fuzzy + @F-N resolver. v0.9 의 "F-N 외우지 않음" 기반 모듈.**

### Added

- **`scripts/ui/`** — 신규 subpackage. UI helpers · slash command 와 결정론 scripts 사이 라우팅 레이어. 향후 dashboard · intent_planner · sync_gate · confirm 모듈의 그릇.
- **`scripts/ui/feature_resolver.py::resolve(query, spec) -> ResolveResult`** — 사용자 입력을 spec.features[] 의 dict 로 해결.
  - `@F-N` 명시 prefix (최우선) — 파워 유저 escape · title 매칭 절대 섞이지 않음.
  - 평문 `F-N` (caps-insensitive) — 기존 CLI 호환.
  - 제목 substring fuzzy (대소문자 무시 · 공백 정규화).
  - 결과 3 종: `single` · `multiple` (2+ 매칭 · caller 가 메뉴 제시) · `none`.
  - 순수 함수 · I/O 없음 · state 변경 없음.
- **`tests/unit/test_feature_resolver.py`** — 21 tests 커버:
  - `@F-N` 명시 (존재/부재/잘못된 패턴/공백)
  - 평문 `F-N` (존재/부재)
  - Title fuzzy (단일/다중/대소문자/공백/부분 단어/무매칭)
  - Edge cases (빈 query · 빈 features · title 없는 feature)
  - 우선순위 (@F-N · F-N 이 title 보다 우선)
  - ResolveResult 데이터 형상

### v0.9.x 진행

| 버전 | 상태 |
|---|---|
| v0.9.0 | ✅ namespace rename + 6 command 삭제 |
| **v0.9.1** | ✅ feature_resolver 모듈 + 테스트 (wiring 은 v0.9.2) |
| v0.9.2 | ⏳ dashboard · intent routing · Plan+Y/n UX |
| v0.9.3 | ⏳ Iron Law D · 누적 declared evidence |
| v0.9.4 | ⏳ 시나리오 매핑 integration test |
| v0.9.5 | ⏳ project.mode prototype/product 축 |

### Tests

646/646 green (625 + 21). self_check 5/5 PASS.

## [0.9.0] — 2026-04-24

**UX re-architecture · 첫 단계. Plugin namespace rename + command surface 8 → 2 collapse. 내부 엔진 변화 없음 · slash command 재조직만.**

### Breaking change — 재설치 필요

Plugin name `harness` → **`harness-boot`** (프로젝트 이름과 일치). 기존 설치는 자동 승계 안 됨:

```
/plugin uninstall harness@harness-boot
/plugin install harness-boot@harness-boot
```

`.harness/` 디렉터리 · spec.yaml · state.yaml · 사용자 작업물 전부 보존 (plugin 이름 무관).

### Changed

- **Slash command 8 → 2**:
  - `/harness-boot:init` — 최초 셋업 (기존 `/harness:init`)
  - `/harness-boot:work` — 일상 (기존 `/harness:work` 가 새 인터페이스로 재구성될 예정 · 현재 기능은 v0.8.10 과 동일)
- **삭제**: `commands/{spec,sync,status,check,events,metrics}.md` (6 파일). 이 기능들은 v0.9.2+ 에서 `/harness-boot:work` 자연어 라우팅으로 흡수 예정. 이번 릴리즈는 파일 삭제만.
- **`commands/init.md`** 상단 재설계 — 자연어 직접 진입 (A · 권장) + 3 옵션 메뉴 (B · fallback) 2 경로:
  - `/harness-boot:init 트위터 같은 거 만들래` → 옵션 1 + 레퍼런스 맥락 주입
  - `/harness-boot:init 빨리 대충 프로토타입` → 옵션 1 + mode hint
  - `/harness-boot:init plan.md 있어` → 옵션 2 (기획 문서)
  - `/harness-boot:init 이미 만들던 코드` → 옵션 3 (기존 프로젝트)
  - 빈 호출 → 3 옵션 메뉴 fallback
- **`plugin.json` + `marketplace.json`**: plugin name `harness` → `harness-boot`.
- **README** 빠른 시작 섹션 재작성 — 2 command + 자연어 중심.

### Removed

- `tests/unit/test_spec_modes.py` — 삭제된 `commands/spec.md` 의 Mode A/B/R/E 계약 검증. v0.9.2 에서 `/harness-boot:work` 자연어 라우팅 re-implementation 후 새 테스트로 대체 예정.

### v0.9.x 로드맵 (예고)

| 버전 | 내용 |
|---|---|
| v0.9.1 | `scripts/ui/feature_resolver.py` · title fuzzy match · `@F-N` escape |
| v0.9.2 | `/harness-boot:work` 빈 호출 → 대시보드 · 자연어 → intent 라우팅 · Plan+Y/n UX |
| v0.9.3 | Iron Law D — 누적 declared evidence (prototype 1 · product 3 · hotfix override) |
| v0.9.4 | 시나리오 매핑 integration test · README "어떻게 말해도 됩니다" |
| v0.9.5 | `project.mode: prototype/product` 축 · 의례 경량화 |
| v0.10.0 | (미정) · v0.9.x 완주 후 재검토 |

### Tests

625/625 green (이전 637 − 12: test_spec_modes 삭제분). self_check 5/5 PASS.

## [0.8.10] — 2026-04-24

**CI hotfix — pytest + coverage added to requirements-dev.txt. v0.8.8's `PytestCommandDetectionTests` failed on CI because the matrix only had pyyaml + jsonschema.**

### Problem

v0.8.8 introduced `_pytest_command()` with two new tests assuming pytest is importable. requirements-dev.txt (v0.8.5 SSoT) only listed pyyaml + jsonschema, so CI matrix on py3.10–3.13 ran without pytest and both tests hit `AssertionError: unexpectedly None`. CI failed on all 4 Python minors.

### Fixed

- **`requirements-dev.txt`** — pytest + coverage added. Comments point to v0.8.10 as the release that added each dep.
- No code changes — just dev dependency widening. CI matrix now installs pytest, so `_pytest_command()` binary-or-module detection succeeds and both tests PASS.

### Lesson captured (again)

This is the second time a test assumption (pytest installed) diverged from the CI environment. v0.8.4 was the first (jsonschema missing). The pattern: when a helper uses a capability, the test asserting the helper's behavior must have that capability guaranteed by requirements-dev.txt. Reviewer checklist entry candidate.

### Tests

CI re-run expected green across py3.10-3.13. Local: 637/637 green (no new tests).

## [0.8.9] — 2026-04-24

**Starter `.gitignore` + `conftest.py` templates — closes the third v0.8.6 e2e finding. Onboarding friction removed.**

### Problem (from v0.8.6 e2e smoke)

- **No `.gitignore` shipped** → `.harness/events.log` · `state.yaml` · `_workspace/` were tracked by default. `/harness:work --run-gate gate_4` (commit check) FAILs on every mutation.
- **No `conftest.py` helper** → Python projects with `src/<pkg>/` layout couldn't run pytest collection or subprocess smoke (`python -m pkg`) without manual `sys.path` / `PYTHONPATH` configuration.

### Added

- **`docs/templates/starter/.gitignore.template`** — ignores mutable harness files (events.log + rotated `events.log.YYYYMM*`, state.yaml, harness.yaml, domain.md, architecture.yaml, `_workspace/`) plus common Python/Node/IDE noise. Comments at bottom list what to **keep** tracking (spec.yaml, chapters/, protocols/). Designed for append-merge when user already has a .gitignore.
- **`docs/templates/starter/conftest.py.template`** — pythonpath injection for `src/<pkg>/` layouts. Handles both pytest collection (`sys.path.insert`) and subprocess propagation (`os.environ["PYTHONPATH"]`). Safe no-op when no `src/` directory exists. Optional — Python projects only.
- **`commands/init.md` §2.5** — new "선택 파일" section documenting when to copy each template, merge policy (`.gitignore` = append · `conftest.py` = manual for existing files), and `--solo` lite-mode skip.
- **`tests/unit/test_starter_schema.py::OptionalStarterTemplatesTests`** — 4 tests: gitignore ships with mutable files listed, gitignore preserves user-editables (spec.yaml · chapters/ · protocols/), conftest ships with sys.path + PYTHONPATH handling, init.md documents both templates.

### End-to-end smoke findings — fully resolved

| Finding | Fix version |
|---|---|
| `shutil.which("pytest")` misses user-site installs | v0.8.8 |
| `--complete` re-emits events on done feature | v0.8.7 |
| retro.md overwritten on re-complete | v0.8.7 |
| No `.gitignore` → gate_4 dirty tree | **v0.8.9** |
| No `conftest.py` → Python smoke fails | **v0.8.9** |

All 5 gaps surfaced by the v0.8.6 greet-e2e live run are now closed.

### Tests

637/637 green (633 + 4 new). self_check 5/5 PASS.

## [0.8.8] — 2026-04-24

**Gate 0/3 pytest detection — covers user-site / venv installs. Second fix from v0.8.6 e2e smoke findings.**

### Problem

`detect_gate_0_command` / `detect_gate_3_command` used `shutil.which("pytest")` to find the test runner. If pytest was installed only as a Python module (pip `--user`, venv without activated PATH, Homebrew site-packages, etc.), the binary wouldn't appear on PATH, so detection fell through to `unittest discover` — which collected 0 tests when the project's layout was pytest-idiomatic. Gate 0 then returned exit 5 (NO_TESTS_COLLECTED) spuriously. Surfaced on the live greet-e2e smoke.

### Fixed

- **`scripts/gate/runner.py::_pytest_command()`** — new helper returns a runnable pytest command:
  1. If `shutil.which("pytest")` → `["pytest"]` (cleanest invocation).
  2. Else if `python -m pytest --version` succeeds → `[sys.executable, "-m", "pytest"]` (covers user-site/venv).
  3. Else `None`.
- **`detect_gate_0_command`** and **`detect_gate_3_command`** both route pytest detection through `_pytest_command()` instead of bare `shutil.which`. Behavior for non-pytest runners (unittest, npm, make, cargo, go) is unchanged.
- **`tests/unit/test_gate_runner.py::PytestCommandDetectionTests`** — 2 new tests verifying the helper returns a callable command on any Python with pytest installed, and module form starts with `sys.executable`.
- Existing `DetectCommandTests` that monkey-patched `shutil.which("pytest") → None` updated to also mock `gr._pytest_command = lambda: None` so they continue to exercise the unittest fallback path.

### Tests

633/633 green (631 + 2 new). self_check 5/5 PASS.

## [0.8.7] — 2026-04-24

**Complete + retro idempotency — closes the third instance of the "ceremony writes unconditionally" pattern. Surfaced by v0.8.6 end-to-end smoke run.**

### Problem

During the live e2e verification (smoke project: `greet-e2e` CLI), `--complete` was called twice on the same `done` feature. Observed: duplicate `feature_done` event, `retro/F-0.md` overwritten, duplicate `feature_retro_written` event. Exact mirror of the kickoff bug fixed in v0.8.2. 3 ceremonies auto-wired × 3 flavors of the same defect → third patch.

### Fixed

- **`scripts/work.py::complete(harness_dir, fid)`** — early return with `action=queried`, message "already done — no re-completion" when feature's status is already `done`. No event emission, no retro autowire.
- **`scripts/ceremonies/retro.py::generate_retro`** gains `force: bool = False`. When `retro/F-N.md` exists and `force=False`: return path without write or event.
- **`scripts/work.py::_autowire_retro`** propagates `force` kwarg (defaults False on automatic calls).
- **New `--retro` CLI flag** forces regeneration (mirrors `--kickoff` and `--design-review`). Emits fresh `feature_retro_written` event and yields `action=retro_refreshed`.

### Ceremony idempotency — now unified across all 3

| Ceremony | Patch | Force flag |
|---|---|---|
| Kickoff | v0.8.2 | `--kickoff` |
| Design Review | v0.8.0 (native) | `--design-review` |
| Retrospective | **v0.8.7** | `--retro` |

The three auto-wired ceremonies now obey the same write-once-then-preserve rule. Consistency contract verified by 4 new tests.

### Tests

631/631 green (627 + 4 new: `CompleteIdempotencyTests` × 2, `RetroForceRefreshTests` × 2). self_check 5/5 PASS.

## [0.8.6] — 2026-04-24

**Phase 2 scale readiness · first step — `events.log` monthly rotation.**

### Why

Events accumulate forever. On a long-running project (the vision's "수년 운영" target) the single `events.log` grows unbounded, and every `/harness:events` / `/harness:metrics` call pays linear parse cost over history. v0.8.6 introduces opt-in rotation that keeps the **write path identical** (no emitter change) while letting queries span split files transparently.

### Added

- **`scripts/core/event_log.py`** — new module with two public functions:
  - `read_events(harness_dir)` — unified event stream across `events.log` + every `events.log.YYYYMM` sibling, returned in timestamp order. Unparseable-ts events sort last but are never dropped.
  - `rotate(harness_dir, *, now_yyyymm=None, dry_run=False)` — moves events whose ts is strictly older than the current month into `events.log.YYYYMM` buckets. Current-month events and events with unparseable ts stay in `events.log`. Returns `{yyyymm: count}` moved. Idempotent.
- **CLI**: `python3 scripts/core/event_log.py rotate [--harness-dir PATH] [--dry-run]`.
- **`tests/unit/test_event_log.py`** — 10 tests: empty harness, single log, merged rotated files, corrupted-line skip, split semantics, append to existing rotated file, idempotency, unparseable-ts preservation, dry-run non-mutation, events.py integration.

### Changed

- **`scripts/events.py`** main path now calls `read_events(harness_dir)` instead of `parse_events(events.log)` — automatically surfaces rotated files. Legacy `parse_events(path)` helper kept for backward compat (any downstream consumer passing a path directly).
- **`scripts/metrics.py`** `compute(log_path, ...)` — when `log_path.name == "events.log"`, routes through `read_events(log_path.parent)`. Other paths fall back to single-file parser (preserves test-only direct-path calls).
- **`commands/events.md`** — new "Log rotation (v0.8.6)" section with CLI usage + writer/reader contract + idempotency guarantee.

### Tests

627/627 green (617 + 10). self_check 5/5 PASS.

## [0.8.5] — 2026-04-24

**Development dependency SSoT — direct follow-up to v0.8.4's lesson.**

### Added

- **`requirements-dev.txt`** — single source of truth for local + CI. Lists `pyyaml` (required) and `jsonschema` (schema validation). Comments point back to v0.8.4 as the incident that justified the file.
- **README §빠른 시작** — local dev setup block showing `python -m pip install -r requirements-dev.txt`, `python -m unittest discover tests/unit`, `bash scripts/self_check.sh`. Mentions CI installs the same file for matrix parity.

### Changed

- **`.github/workflows/self-check.yml`** — install step now runs `pip install -r requirements-dev.txt` instead of inline package names. Keeps CI and local in lockstep. Comment in the workflow references v0.8.4 incident.

### Why

v0.8.4 was a CI-caught bug hidden locally by a missing `jsonschema` install (12 tests silently skipped). The direct lesson: **local dev environment must match CI**. This release formalizes that parity with a manifest.

### Tests

617/617 green (no new tests; existing suite unchanged). self_check 5/5 PASS.

## [0.8.4] — 2026-04-24

**Hotfix: path depth off-by-one after v0.7.6 subpackage relocation. CI (v0.8.3) caught this immediately on first matrix run — exactly what the gate was built for.**

### Problem

v0.7.6 moved `scripts/validate_spec.py` → `scripts/spec/validate.py` (+ two siblings) but retained the original `Path(__file__).resolve().parent.parent` pattern. When the file was at `scripts/validate_spec.py` that resolved to repo root; after the move it resolves to `scripts/`, which is wrong.

Locally the failure was silent — 12 of the 14 `test_validate_spec.py` cases skip when `jsonschema` is not installed, so the broken path code was never exercised. CI installs `jsonschema` in the full matrix, so every Python minor exposed the bug on the first run.

Error message seen in CI:

```
AssertionError: 'features' not found in
'스키마 파일 없음: /home/runner/work/harness-boot/harness-boot/scripts/docs/schemas/spec.schema.json'
                                                     ^^^^^^^
                                                     bogus prefix
```

### Fixed

- `scripts/spec/validate.py::_default_schema_path` — `parent.parent` → `parents[2]`.
- `scripts/spec/conversion_diff.py::REPO_ROOT` — `parent.parent` → `parents[2]`.
- `scripts/spec/mode_b/roundtrip.py::REPO` — `parent.parent` → `parents[3]`.

Comments added to each fixed line pointing to this release so future relocations notice the depth dependency.

### Verification

With `jsonschema` installed locally (matching CI env): 617/617 green, 0 skipped (previously 18 skipped locally because jsonschema was missing — that was what hid the bug). self_check 5/5 PASS.

### Lessons captured

- Dev dependencies file missing — `pyyaml` + `jsonschema` should be documented as expected local deps. Candidate v0.8.5 or v0.9 cleanup item.
- Path-depth discipline — any module that computes repo-relative paths via `__file__` needs a comment stating its depth, so future `git mv` callers know to update it.

## [0.8.3] — 2026-04-24

**Phase 3 CI — GitHub Actions self-check workflow. Every PR + push to main/develop runs the full suite + self_check against Python 3.10-3.13.**

### Added

- **`.github/workflows/self-check.yml`** — matrix build (Python 3.10 · 3.11 · 3.12 · 3.13) on Ubuntu. Triggers on push to `main` / `develop` and on any PR targeting those branches. `fail-fast: false` so each Python minor reports independently.
- Pipeline steps:
  1. Checkout (fetch-depth 1).
  2. Setup Python with `actions/setup-python@v5`.
  3. Install `pyyaml` + `jsonschema` (CI runs the full matrix with structural validation enabled).
  4. `python -m unittest discover tests/unit --verbose` — full 617-test regression.
  5. `bash scripts/self_check.sh` — SSoT · validate · sync · check · commands 규약 5 steps.
- **Concurrency group** keyed on ref name — in-progress runs cancel when a new push lands.

### Why

Closes one of the v1.0 checklist items: automated regression gate on public branches. Before v0.8.3 the suite ran only locally; now it's enforced on every PR before merge.

### Tests

617/617 green locally (CI will mirror on first run). self_check 5/5 PASS.

## [0.8.2] — 2026-04-24

**Kickoff idempotency patch — re-activate no longer overwrites curated kickoff headings. Brings kickoff in line with design-review's idempotency policy.**

### Problem (surfaced in v0.8.0 live smoke test)

`scripts/work.py::_autowire_kickoff` called `kickoff.generate_kickoff` unconditionally. Re-activating the same feature (even via `--current` follow-up by orchestrator) re-wrote `_workspace/kickoff/F-N.md`, wiping any heading content that had been curated between calls. Also emitted a duplicate `kickoff_started` event each time.

### Fixed

- **`ceremonies.kickoff.generate_kickoff`** now accepts `force: bool = False`. When the kickoff.md already exists and `force=False`, the function returns the existing path without rewriting the file or emitting an event.
- **`scripts/work.py::_autowire_kickoff`** passes `force=False`, so autowire re-runs are silent idempotent skips.
- **`--kickoff` CLI flag** — explicit force re-generation for cases where the agent lineup needs to refresh (e.g., `ui_surface.present` flipped true, or `has_audio` changed). Mirror of `--design-review` pattern. Emits new `kickoff_started` event and yields action=`kickoff_refreshed`.
- `commands/work.md` Kickoff Ceremony section documents the idempotency rule + `--kickoff` flag usage.

### Tests

617/617 green (612 + 5: 3 idempotency tests covering re-activate preservation, single event emission, record_gate no-re-fire; 2 force-refresh tests). self_check 5/5 PASS.

### Live smoke evidence

This patch was triggered by direct verification. Before: events.log showed two `kickoff_started` entries from two `activate` calls. After: one entry, regardless of how many state-mutating work calls touch the feature.

## [0.8.1] — 2026-04-24

**Agent eval fixture coverage reaches 15/15 — v1.0 체크리스트의 fixture 항목 완결.**

### Added — 8 새 fixtures

| Agent | producer_type | output_path |
|---|---|---|
| `backend-engineer` | code | null (OpenAPI + src/domain + tests/domain 조합) |
| `security-engineer` | markdown | `.harness/_workspace/security/report.md` (STRIDE + Findings + Verdict) |
| `performance-engineer` | markdown | `.harness/_workspace/perf/report.md` (Budget + Measurements + Verdict) |
| `audio-designer` | yaml | `.harness/_workspace/design/audio.yaml` (sound/loudness/freq_strategy/reduced_motion) |
| `qa-engineer` | markdown | `.harness/_workspace/qa/strategy.md` (Risk Map + Test Strategy + Coverage) |
| `integrator` | markdown | `.harness/_workspace/integration/notes.md` (Assembly + CI + Gate 5 Override) |
| `orchestrator` | markdown | null — prose returned to user (상태 전이 + 참여 에이전트 + BLOCK + 다음 단계) |
| `reviewer` | markdown | null — prose returned to orchestrator (CQS · BR-012 엄수) |

각 fixture 는 역할 경계 침범을 막는 `forbidden_phrases` 포함:
- qa-engineer 가 `LUFS` (audio-designer 어휘) · `bench` (performance-engineer 영역) 사용 금지
- integrator 가 `새 ADR 추가` 금지 (product-planner 영역)
- reviewer 가 `Edit(` · `Write(` · `TODO: fix` 사용 금지 (CQS 위반 정후)
- orchestrator 가 `WCAG SC` · `CVSS` 사용 금지 (도메인 전문가 영역)

### Coverage

| 이전 (v0.7.4) | v0.8.1 |
|---|---|
| 7/15 fixtures | **15/15 fixtures** |

### Tests

612/612 green (fixture 8 추가는 새 테스트 없이 기존 파라메트릭 스키마에 통합 · 모두 green). self_check 5/5 PASS.

## [0.8.0] — 2026-04-24

**Ceremony auto-wire 4/4 완결 — design-review 자동 발화 (마지막 남은 수동 ceremony 해소).**

### Added

- `scripts/work.py::_autowire_design_review(harness_dir, fid, *, force=False)` — state-mutating work.py 호출 말미에서 3 조건 AND readiness 평가:
  1. `features[F-N].ui_surface.present == true` — UI 없는 피처는 design-review 의미 없음
  2. `.harness/_workspace/design/flows.md` 존재 — ux-architect delivered
  3. `.harness/_workspace/design-review/F-N.md` 미존재 — idempotent
- 4 wiring 지점: `activate`, `record_gate`, `add_evidence`, `run_and_record_gate`. 각 호출 말미에 조건 체크 후 필요 시 `ceremonies.design_review.generate_design_review` 호출. kickoff/retro 와 동일하게 silent-swallow exceptions (ceremony 오류가 state mutation 을 실패시키지 않음).
- `--design-review` CLI flag — idempotent (조건 3) 우회, 기존 design-review/F-N.md 덮어쓰고 재생성. UI 조건 (1) 과 flows.md 조건 (2) 는 여전히 적용.
- `tests/unit/test_work_design_review.py` — 10 tests: auto-fire conditions (5) · multiple trigger points (3) · has_audio propagation (1) · force re-generate flag (1).

### Changed

- `commands/work.md` Design Review Ceremony 섹션 전면 개정:
  - "prose-contract 수동 호출" → "v0.8 auto-wire"
  - 3 조건 readiness check 규약 명시
  - `--design-review` flag 안내

### Ceremony 자동화 현황 (v0.8.0 시점)

| Ceremony | 상태 | 트리거 | 버전 |
|---|---|---|---|
| Kickoff | ✅ auto | `work.activate` | v0.7 |
| Retrospective | ✅ auto | `work.complete` | v0.7 |
| Design Review | ✅ auto | 3 조건 readiness (state-mutating calls) | **v0.8** |
| Q&A file-drop | 🟡 poll | `inbox.py --feature` — orchestrator 주기 polling | — |

Q&A 는 "protocol" 성격이라 auto-wire 대상 아님 — orchestrator 가 stage 경계에서 `inbox.py` 로 poll 하는 게 설계 의도.

### Tests

612/612 green (602 + 10). self_check 5/5 PASS.

### Version policy note

v0.8.0 은 **minor bump**. 사유 = ceremony auto-wire 스토리 (4/4) 의 마일스톤 완결. 이전 v0.7.x patch 시리즈와 달리 사용자 대면 capability (자동 발화) 의 구조적 변화.

## [0.7.6] — 2026-04-24

**Deeper scripts/ reorganization — root cleaned to 6 primary command entries. Internal refactor only; `/harness:*` behavior byte-for-byte identical.**

### Refactored

- **13 더 많은 파일 서브패키지로 이동** (v0.7.5 는 내부 전용 8 만 이동, v0.7.6 은 공개 CLI 포함 모두 정리):
  - `state.py` · `canonical_hash.py` · `plugin_root.py` → `core/`
  - `gate_runner.py` → `gate/runner.py`
  - `kickoff.py` · `retro.py` · `design_review.py` · `inbox.py` → `ceremonies/`
  - `validate_spec.py` → `spec/validate.py`
  - `explain_spec.py` → `spec/explain.py`
  - `spec_diff.py` → `spec/diff.py`
  - `spec_mode_classifier.py` → `spec/mode_classifier.py`
  - `mode_b_extract.py` → `spec/mode_b_extract.py`
- **scripts/ 루트에 6 primary CLI 만 남음**: `sync · work · status · check · events · metrics`. 4 subdir (`core` · `gate` · `ceremonies` · `spec` · `render`) 로 나머지 분산.
- `commands/*.md` 의 `$PLUGIN_ROOT/scripts/<name>.py` 참조 18 군데 일괄 업데이트. 사용자는 `/plugin update` 한 번이면 byte-for-byte 동일 경험.
- 모든 cross-import 경로 업데이트 (`import state` → `from core.state import` 등). 3 루트 CLI (work/check/sync/status) + 13 moved 파일 + 21 test 파일 커버.
- `scripts/self_check.sh` 의 `validate_spec.py` 경로 보정.

### Added

- 새 3 서브패키지 `__init__.py` — 책임 경계 + 호출 방향 명시 (`core` 는 아무 것도 호출 않음; 다른 서브패키지는 `core` 만 호출; 서브패키지 간 상호 호출 금지).
- `scripts/README.md` 전면 개정 — 5 서브패키지 레이아웃 · 의존 그래프 · 공개 CLI 표.

### Changed — 버전 정책 명시화

v0.7.5 에서 "공개 CLI 경로 변경은 major bump" 라고 기록했던 문구를 **철회**. 실제 계약은:

- **사용자 대면**: `/harness:*` 슬래시 명령만. 이게 진짜 공개 API.
- **내부 구현 경로**: `scripts/**/*.py` 는 patch 단위로 자유롭게 이동 가능. commands/*.md 가 동일 커밋에서 갱신되고 테스트가 녹색이면 OK. `/plugin update` 후 사용자는 변화를 인지하지 않음.

이 구분이 scripts/README.md §"버전 정책" 에 고정됨.

### Tests

602/602 green (baseline 동일). self_check 5/5 PASS. `git mv` 로 history 보존.

## [0.7.5] — 2026-04-24

**Internal refactor — scripts/ directory organization + professional docstrings. No user-facing behavior change.**

### Refactored

- **scripts/ 디렉터리 정리** — 내부 전용 모듈 8 개를 서브패키지로 이동. 공개 CLI 경로 (commands/*.md 가 참조하는 `scripts/<name>.py`) 는 **전부 그대로** — `/harness:*` 동작에 영향 없음.
  - `render_domain.py` → `render/domain.py`
  - `render_architecture.py` → `render/architecture.py`
  - `include_expander.py` → `spec/include_expander.py`
  - `conversion_diff.py` → `spec/conversion_diff.py`
  - `upgrade_to_2_3_8.py` → `spec/upgrade_to_2_3_8.py`
  - `mode_b_axes.py` → `spec/mode_b/axes.py`
  - `mode_b_roundtrip.py` → `spec/mode_b/roundtrip.py`
  - `mode_b_stopwords.py` → `spec/mode_b/stopwords.py`
- 각 서브패키지에 `__init__.py` + module docstring (책임 경계 · 호출 방향 명시).
- 소비자 import 경로 업데이트 (sync · check · mode_b_extract · 3 test 파일) — `import X` → `from <pkg> import X`.

### Added

- `scripts/README.md` — 29 파일 인벤토리 · 의존 방향 다이어그램 · 공개 vs 내부 표시 · 테스트/버전 정책. 새 기여자가 "어디에 코드 추가할지" 즉시 파악 가능.
- 전문 수준 module docstring 보강 (`retro.py` · `render/domain.py` · `render/architecture.py` · `spec/mode_b/stopwords.py` · `spec/mode_b/axes.py`): 공개 API · 섹션 순서 · 결정론 계약 · 이벤트 스키마 계약 · CLI 사용법 · 업그레이드 경로 명시.

### Version policy 확립

- **공개 CLI 경로** (`scripts/<name>.py`) 변경은 **major bump** (v1.0+) 대상. commands/*.md 가 직접 참조하므로.
- **내부 서브패키지** (`scripts/render/*`, `scripts/spec/*`, `scripts/spec/mode_b/*`) 는 자유 재편.
- 이 규약은 `scripts/README.md` §"버전 정책" 에 고정.

### Tests

602/602 green (baseline 동일, 변경된 테스트는 3 파일의 import 경로 뿐). self_check 5/5 PASS.

## [0.7.4] — 2026-04-24

**Design-tier Platform access + fixture schema for YAML/code producers.**

### Added

- `scripts/render_domain.py` 에 `## Platform` 섹션 렌더러 (v0.7.4). `constraints.tech_stack` (runtime · min_version · language · test · build + 추가 필드) 가 선언돼 있으면 Project 바로 뒤 · Stakeholders 앞에 렌더. Tier 1 only agents (visual-designer · a11y-auditor) 가 architecture.yaml(Tier 2) 접근 없이도 플랫폼 맥락에 닿음. tech_stack 부재/비어있음 시 섹션 자체 생략.
- `agents/visual-designer.md` + `agents/a11y-auditor.md` Context 블록 업데이트 — domain.md 의 Platform 섹션을 명시적으로 참조 (runtime=browser → system-ui · runtime=ios → Dynamic Type 등 플랫폼별 기본값 규약).
- `tests/unit/test_agent_fixtures.py` — `producer_type` 필드 지원 (`markdown` 기본 · `yaml` · `code`). 타입별 요구 키 디스패치: markdown → required_sections_in_order · yaml → required_top_keys · code → required_file_patterns. 기존 v0.7.2 fixture 5 개는 producer_type 생략 시 markdown 으로 간주되어 계속 PASS.
- `tests/fixtures/agent-evals/visual-designer/` (producer_type=yaml) · `tests/fixtures/agent-evals/software-engineer/` (producer_type=code) — 2 개 non-markdown fixture 추가. 총 7 agents 커버.
- `tests/unit/test_render_domain.py::PlatformSectionTests` — 5 tests (부재 · 존재 · 순서 · 부분 필드 · 빈 stack 처리).

### Tests

602/602 green (594 + 8). self_check 5/5 PASS.

## [0.7.3] — 2026-04-24

**ADR supersedes drift check + gate_perf with performance_budget integration.**

### Added

- `scripts/check.py::check_adr_supersedes(spec)` — 10 번째 drift 종류 `Adr`. `decisions[].supersedes[]` 가 가리키는 ADR 의 `status` 가 `superseded` 가 아니면 warn (domain.md 가 동일 주제에 두 개의 accepted ADR 을 렌더하는 모순 방지). supersedes 가 존재하지 않는 ADR id 를 가리키면 dangling reference warn. SSoT 원칙 유지 — 자동 수정 없음 (사용자 개입 필요).
- `scripts/gate_runner.py::run_gate_perf` — performance_budget 기반 perf 게이트. auto-detect 없음 (perf 도구 다양성), `harness.yaml.gate_commands.gate_perf` 또는 `--override-command` 로 커맨드 공급 필수. 기본 timeout 900s. run_gate dispatcher 에 gate_perf 등록.
- `scripts/work.py::_format_performance_budget(budget)` — budget dict → 한 줄 요약 (`lcp_ms=2500 · inp_ms=200 · bundle_kb=180 · api_startup_ms=300`). gate_perf pass 시 evidence summary 에 자동 주입 (`gate_run` kind).
- `tests/unit/test_check.py::AdrSupersedesDriftTests` — 6 tests.
- `tests/unit/test_gate_runner.py::RunGatePerfTests` — 5 tests (pass/fail override, skipped 기본, harness.yaml override, dispatcher 인식).
- `tests/unit/test_work_autowire.py::PerfGateBudgetIntegrationTests` — 2 tests (perf gate pass 시 budget summary 주입 · 다른 gate 는 주입 없음).

### Changed

- `commands/check.md` — 10/10 drift 로 변경, Adr 섹션 추가, Preamble "9 종" → "10 종".
- `commands/work.md` — Gate 자동 실행 목록에 gate_perf 라인 추가.

### Tests

594/594 green (581 + 13). self_check 5/5 PASS.

## [0.7.2] — 2026-04-24

**Agent eval fixture expansion + skipped_agents state API.**

### Added

- `tests/fixtures/agent-evals/{researcher,product-planner,a11y-auditor,tech-writer}/` — 4 new fixture directories. Each ships `input.md` (representative brief) + `expected-structure.yaml` (required sections, phrases, forbidden phrases). Now 5 agents covered (+ existing ux-architect).
- `tests/unit/test_agent_fixtures.py` — parametric schema check. Auto-discovers any directory under `tests/fixtures/agent-evals/` and validates required keys, section H2/H3 form, agent name ↔ directory match. Future fixtures: drop a directory, tests pick it up.
- `scripts/state.py::add_skipped_agent(fid, agent, reason)` + `get_skipped_agents(fid)` — v0.5 routing policy had documented `skipped_agents[]` but state.py never implemented the write API. Silent skip policy remains orchestrator business; state now has the substrate. Refuses empty reason (audit-trail integrity).
- `tests/unit/test_state.py::SkippedAgentsTests` — 6 tests covering add/read, order, empty-input refusal, save/load round-trip.

### Scope pivot

Original v0.7 PR-β scope listed "15 agents × 3 대표 입력 회귀". Reduced to 4 new markdown-producing agents: engineers (frontend/software) and visual-designer emit code/YAML, which the current markdown-section schema does not fit. v0.7.3+ will extend the schema for those agent classes.

### Tests

581/581 green (566 + 15). self_check 5/5 PASS.

## [0.7.1] — 2026-04-24

**Activate UX patch. 3 gaps surfaced during v0.7.0 live smoke test.**

### Added

- `scripts/work.py::deactivate(harness_dir)` — clears `session.active_feature_id` without touching feature status. CLI: `--deactivate`. Emits `feature_deactivated` event.
- `scripts/work.py::remove_feature(harness_dir, fid)` — deletes feature entry from `state.yaml`. Refuses done features (audit trail protection). Clears active pointer if removing the active feature. CLI: `--remove FID`. Emits `feature_removed` event with `prior_status`.
- `scripts/state.py::remove_feature(fid) -> bool` and `features_in_progress() -> list[str]` helpers.
- `tests/unit/test_work_ux.py` — 16 tests covering ghost warning, concurrent warning, deactivate, remove semantics, done-protection, CLI flags.

### Changed

- `scripts/work.py::activate()` now warns on stderr (proceeds regardless — backward compat):
  - **ghost feature**: `spec.yaml` exists but F-N is not defined in `features[]`.
  - **concurrent in_progress**: another feature is already `in_progress`.
- `commands/work.md` — new sections *Activate UX 경고* + *Session pointer 정리* documenting warnings and the two new flags.

### Tests

566/566 green (550 + 16). self_check 5/5 PASS.

## [0.7.0] — 2026-04-24

**Auto-wire kickoff · retro ceremonies. `scripts/work.py::activate/complete()` 가 `kickoff.py` · `retro.py` 를 자동 호출 — v0.6 의 "prose-contract 수동 호출" 약속이 실 구현으로 전환.**

### Added

- `scripts/kickoff.py::detect_shapes(feature, *, spec=None)` — feature dict → routing shape list 자동 감지:
  - title · AC · modules 비어 있음 → `["baseline-empty-vague"]`
  - `ui_surface.present=true` → `ui_surface.present` (+ `has_audio=true` → audio-designer)
  - `performance_budget` 선언 → `performance_budget`
  - `sensitive=true` 또는 `domain.entities[].sensitive=true` 참조 → `sensitive_or_auth`
  - 위 전문가 shape 모두 없음 → `pure_domain_logic`
  - 항상 최종에 `feature_completion` 추가
- `scripts/kickoff.py::has_audio(feature)` — `ui_surface.has_audio` 추출.
- `scripts/work.py::_autowire_kickoff` · `_autowire_retro` — activate/complete 내부 훅. spec.yaml resolve 되고 feature 존재할 때만 발화, 예외는 silent swallow (activate/complete 는 ceremony 오류로 실패하지 않음).
- `tests/unit/test_work_autowire.py` — 15 tests: shape detection 7 · activate autowire 6 · complete autowire 2. 핵심 불변: backward-compat (spec.yaml 미존재 시 kickoff/retro 디렉터리 생성 없음) + 이벤트 순서 (`feature_activated` < `kickoff_started`, `feature_done` < `feature_retro_written`).

### Changed

- `commands/work.md` Kickoff · Retrospective 섹션의 "prose-contract 로 수동 호출" 문구를 "자동 호출 (v0.7 auto-wire)" 로 정정. Design Review 섹션은 수동 유지 명시 (file-watcher 훅 없음, v0.8+ 로 미룸).
- Shape 감지 규칙 문서가 `commands/work.md` Kickoff 섹션에 편입 — orchestrator 가 어떤 shape 로 어떤 에이전트를 소환하는지 사용자가 예측 가능.

### Tests

550/550 green (기존 535 + 15 autowire). self_check 5/5 PASS.

## [0.6.1] — 2026-04-24

**Critical fixes surfaced by pre-push audit. v0.6.0 was not pushed; these patches land before first publish.**

### Fixed

- **Event schema drift** (v0.6.0 blocker) — `scripts/retro.py::analyze()` was reading `"feature_id"` and `"feature_completed"`, but the canonical emitter `scripts/work.py` uses `"feature"` + `"feature_done"`. retro ran blind against real pipelines (tests passed only because they fabricated fake events). Aligned retro.py · kickoff.py · design_review.py to emit `"feature"` key (matches work.py). Retro filter now uses `"feature_done"`. tests/unit/test_{retro,kickoff,design_review}.py updated.
- **Reviewer write permission mismatch** (v0.6.0 blocker) — `agents/reviewer.md` Context prose promised retro.md write exception, but frontmatter `tools: [Read, Grep, Glob, Bash]` blocks Write. Claude Code enforces via frontmatter, not prose. Resolved by **keeping CQS strict** — reviewer returns draft prose, orchestrator writes the file. reviewer frontmatter unchanged. Retro template comments clarify handoff.
- **Auto-trigger claims** (v0.6.0 blocker) — `commands/work.md` said kickoff fires "자동" on `activate` and retro on `--complete`, but `scripts/work.py::activate/complete()` never calls them. Documentation softened to "orchestrator 가 prose-contract 로 수동 호출" with v0.7 note for auto-wire. Same applies to design-review trigger.
- **ROUTING_SHAPES drift risk** — `scripts/kickoff.py::ROUTING_SHAPES` and `commands/work.md` Orchestration Routing table were not mutually validated. `tests/unit/test_work_routing.py::KickoffRoutingShapesParityTests` adds 3 checks (forward/reverse shape coverage + per-shape agent inclusion).

### Known (documented · deferred to v0.7)

- `decisions[].supersedes[]` — 렌더만 되고 **old ADR 의 `status=superseded` 자동 전이는 미구현** (수동 업데이트 필요). `skills/spec-conversion` Mode B-2 또는 별도 preprocessor 에서 v0.7 에 구현 예정.
- `state.yaml.features[].skipped_agents[]` — schema 문서화 됐으나 `scripts/state.py` · `scripts/work.py` 가 읽거나 쓰지 않음. v0.7 에서 skip policy 실 구현 시 연동.
- `features[].performance_budget` — schema 만 존재, `gate_runner.py` 에 연동 없음. v0.7 에서 performance-engineer 자동 트리거에 사용.
- `agents/visual-designer.md` / `a11y-auditor.md` Tier 1 only — motion/a11y 결정이 플랫폼 의존이나 현재 `constraints.tech_stack` 접근 없음. v0.7 에 `render_domain.py` 에 `## Platform` 섹션 추가 검토.

### Tests

535/535 green (기존 532 + 3 routing parity). self_check 5/5 PASS.

## [0.6.0] — 2026-04-24

**3-Anchor Tier orchestration + real-team ceremonies (kickoff · design-review · Q&A · retro). 사용자 우려 "모든 에이전트에 전부 주입은 과도 · 플래너 산출이 다른 에이전트로 전달되어야" 에 대한 구조적 답.**

### Added

**Schema (PR-α, additive only)**:
- `decisions[]` (top-level) — ADR 카탈로그. `supersedes[]` / `superseded_by` 양방향 연결.
- `risks[]` (top-level) — risk catalog. likelihood/impact × mitigation × status {open, mitigated, materialized, closed}.
- `features[].performance_budget` — Web Vitals (lcp_ms/inp_ms/cls/bundle_kb) + backend (latency_p95_ms/memory_rss_mb) + custom[].
- `constraints.tech_stack` 구조화 — runtime/min_version/language/test/build. `additionalProperties: true` 보존.

**Renderer (PR-β)**:
- `scripts/render_domain.py` 에 `## Decisions` · `## Risks` 섹션 — plan.md ADR/Risk 가 drop 되지 않고 domain.md 에 흐름.
- `skills/spec-conversion/SKILL.md` H-10~H-13 heuristics — plan.md → decisions[]/risks[] 변환 규약.

**Agent Tier 체계 (PR-γ)**:
- 13 expert agent 의 `## Context` 블록을 Tier 별로 업데이트:
  - **Tier 1 only** (Design): ux-architect · visual-designer · audio-designer · a11y-auditor — domain.md 만.
  - **Tier 1 + 2** (Engineering/Quality/Integration): software-engineer · frontend-engineer · backend-engineer · security-engineer · performance-engineer · qa-engineer · integrator — + architecture.yaml.
  - **Tier 1 + 3** (Docs): tech-writer — + plan.md (ADR 원문 인용).
  - **전 Tier** (Audit): reviewer — full access + retro.md write exception.
- `tests/unit/test_agents.py` 에 `TierMappingTests` — 각 agent 가 자기 Tier anchor 만 언급하는지 grep 검증.

**Ceremonies (PR-δ + PR-ε)**:
- `scripts/kickoff.py` — routing shape 기반 per-role template + `kickoff_started` event.
- `scripts/inbox.py` — `.harness/_workspace/questions/F-N--<from>--<to>.md` 폴링 · blocking flag 파싱.
- `scripts/design_review.py` — visual + frontend + a11y (+ audio if has_audio) reviewer trio/quartet.
- `scripts/retro.py` — events.log 분석 (first gate fail · ceremony count) + reviewer draft → tech-writer polish 템플릿.
- `commands/work.md` 에 Kickoff · Q&A · Design Review · Retrospective 4 섹션 prose contract.

### Changed

- `agents/reviewer.md` `## Context` 섹션 신설 — 전 Tier access + retro.md write 예외 명시.
- `agents/software-engineer.md` `## Context` 섹션 신설 (Tier 1+2).
- `.claude-plugin/{plugin,marketplace}.json` — 0.5.1 → 0.6.0.
- `docs/templates/starter/CLAUDE.md.template` — 4 신규 ceremony 디렉터리 언급.

### Tests
532/532 unit tests green (16 skipped + 2 jsonschema-not-installed). v0.5.1 의 459 대비 +73 신규 (24 schema · 6 renderer · 5 Tier · 12 kickoff · 9 inbox · 6 design_review · 11 retro). self_check 5/5 PASS.

### v0.5.1 deferred 해소

- B1-10 `constraints.tech_stack` 구조화 ✅
- B1-5 feature-context payload — `commands/work.md` 섹션으로 prose 정리 (머신 schema 는 v0.7 검토)
- B1-6 a11y 재감사 자동 trigger — retro ceremony 가 대체 (수동 호출은 여전히 사용자 선택)

### Why

v0.5.1 suika-web 도그푸드에서 드러난 구조적 gap — plan.md 의 ADR/Risk 가 downstream 에 전달 안 됨, architecture.yaml 이 렌더만 되고 미참조, orchestrator payload 가 prose-only, ceremony 전무 — 에 대한 일괄 답. 사용자 질문 "모든 에이전트가 모든 정보 읽는 건 과도 · 아키텍처는 엔지니어 위주" 를 Tier 구조로 반영.

### Not breaking

- 기존 self-spec · .harness/spec.yaml · v0.5 starter template 모두 v0.6 schema 로 validate.
- 기존 `@harness:*` 호출 호환 유지.
- ceremony 는 opt-in — 소규모 피처는 건너뛸 수 있음.

## [0.5.1] — 2026-04-24

**suika-web 실전 도그푸드에서 드러난 프로즈 gap 4 건 patch. 코드 변경 없음.**

### Changed
- `commands/work.md` Preamble — Iron Law 문구에 "상태 전이는 scripts/work.py 경유" 명시. state.yaml 수동 편집과 events.log drift 를 방지 (B1-1).
- `commands/work.md` — `## Skip 정책` 섹션 추가. security-engineer · performance-engineer · audio-designer 는 조건부 skip 허용하되 **state.yaml `skipped_agents[]` 에 사유 기록**. integrator · tech-writer 는 원칙 skip 금지 (문서-only 피처 예외) (B1-7).
- `agents/frontend-engineer.md` — `## Viewport · Resize · Physics 체크리스트` 추가. canvas resize 시 physics world 재구축 · viewport-fit=cover + safe-area-inset 4 방향 · aria-live debounce · SRI/onerror · reduced-motion transform sweep 포함 (B1-2).
- `agents/security-engineer.md` — STRIDE Tampering 에 `## Supply Chain / CDN` 체크리스트 구체화. 외부 CDN 로드는 SRI 필수 · crossorigin=anonymous · onerror fallback · exact version pinning · 라이선스 확인 (B1-8).
- `.claude-plugin/{plugin,marketplace}.json` — 0.5.0 → 0.5.1.

### Why
`/Users/qwerfunch/Developer/work/suika-web/` 에서 v0.5.0 workflow 를 14 agent 역할극으로 시뮬한 결과:
- Matter.js CDN 을 SRI 없이 로드했다가 뒤늦게 제거 (security-engineer 규약 부재 원인)
- resize 핸들러가 walls 재구축 안 해서 회전 시 과일 탈출 가능 (frontend-engineer 규약 부재 원인)
- suika-web state.yaml 수동 작성 → events.log 와 drift (Phase 1 observational 경계 문서 부재 원인)
- security-engineer 를 "no sensitive entity" 이유로 skip 했는데 사유 기록 안 됨 (skip 정책 부재 원인)

각 item 은 **실전에서 드러난 gap** 이며 **severity should** 이상 만 반영. nice-to-have (B1-3 sync.md 문서화 gap · B1-11 ui_surface 스코프 주석) 은 v0.6 으로 연기.

### Tests
459/459 unit tests green 유지 (프로즈 변경이라 계약 영향 없음). self_check 5/5 PASS.

### Deferred to v0.6
- B1-4 `scripts/init.py` 도입 or prose-only 설계 확정
- B1-5 feature-context payload JSON schema
- B1-6 a11y post-implementation 재감사 자동 trigger
- B1-10 `constraints` schema 구조화 (tech_stack runtime/min_version)
- B1-12 나머지 10 agent fixture

## [0.5.0] — 2026-04-24

**전문가 에이전트 풀(14) + Orchestration Routing. 제품 개발 라이프사이클 전반에 최고 수준 전문가가 도메인을 이해하고 동작.**

### BREAKING
- `agents/implementer.md` → `agents/software-engineer.md` (rename). `@harness:implementer` 사용자는 `@harness:software-engineer` 로 전환.
- 테스트 내부 변수 `_IMPLEMENTER_FORBIDDEN` → `_SOFTWARE_ENGINEER_FORBIDDEN`.
- 보존: `ai_implementer` persona role (`project.stakeholders[]`) · CHANGELOG 과거 엔트리 · regression golden fixture.

### Added
- 13 신규 sub-agent (`agents/*.md`) — 14-agent 포트폴리오 완성:
  - **Stage D (Discovery)** — `researcher` · `product-planner`
  - **Stage X (eXperience)** — `ux-architect` (reference) · `visual-designer` · `audio-designer` · `a11y-auditor`
  - **Stage E (Engineering)** — `frontend-engineer` · `backend-engineer` · `security-engineer` · `performance-engineer`
  - **Stage Q (Quality)** — `qa-engineer`
  - **Stage I (Integration & Docs)** — `integrator` · `tech-writer`
- 각 에이전트는 named framework rubrics 내장: JTBD · Mom Test · Nielsen 10 · 5E · WCAG 2.2 · Atomic Design · Twelve-Factor · DDD · STRIDE · OWASP ASVS · OAuth 2.1 · Web Vitals · USE method · Test Pyramid · Diátaxis 등.
- **domain.md 단일 참조점** 규약 — Stage X/E/Q/I 는 `spec.yaml` 직접 읽지 않고 `.harness/domain.md` 만 anchor. `test_agents.py` 가 규약 위반 grep 으로 검증.
- **Discovery 예외** — researcher · product-planner 는 domain.md 없이도 동작 (bootstrap).
- `docs/schemas/spec.schema.json`: `project.brief` (researcher/planner anchor) + `features[].ui_surface` (orchestrator routing key). 둘 다 additive.
- `scripts/spec_mode_classifier.py`: `baseline-empty-vague` subtype — 한 줄 아이디어(< 40 단어) → researcher 경로.
- `scripts/render_domain.py`: `## Stakeholders` 섹션 렌더.
- `commands/spec.md`: Mode B-1-vague 분기 prose contract (researcher → planner → Mode B-2 chain).
- `commands/work.md`: **Orchestration Routing** 표 (6 shape-branch × agent chain) + 충돌 조정 규약 + 피처 컨텍스트 payload shape.
- `tests/unit/test_work_routing.py` (신규) · `tests/fixtures/agent-evals/ux-architect/` (reference fixture).
- `docs/templates/starter/CLAUDE.md.template` · `spec.yaml.template`: 전문가 풀 섹션 + `brief` · `ui_surface` 필드 seed.

### Changed
- `agents/README.md` — 권한 매트릭스 14 행.
- `agents/orchestrator.md` · `reviewer.md` — `implementer` → `software-engineer` 참조 정리.
- `.claude-plugin/plugin.json` · `marketplace.json` — 0.4.1 → 0.5.0.

### Tests
459/459 unit tests green (16 skipped). 기존 v0.4.1 의 432 대비 +27 신규.

### Why
하네스 자체는 충분히 다듬어졌으나, **사용자 프로젝트를 실제로 만드는** 전문가 층이 빈약했다. 한 줄 아이디어만 받으면 stub spec 에서 멈췄고, UX/UI/a11y/audio 는 first-class 가 아니었다. v0.5 는 이 gap 을 한 번에 메우되 domain.md 단일 참조점 + 계약 기반 routing 으로 확장성을 확보한다.

## [0.4.1] — 2026-04-23

**Coding style guide 반영. 사용자 피드백 기반.**

### Added
- `agents/implementer.md` § **코딩 스타일** 섹션 신규 — Google Python Style Guide 준수 + spec reference (F-NNN · AC-N · BR-NNN) 는 **docstring/주석에만**, 함수/클래스 이름에 금지. 예시 ✅/❌ 포함.
- `commands/work.md` § **코딩 스타일** 섹션 — 동일 규칙 요약 + implementer.md 로 cross-link.
- `tests/unit/test_agents.py` + 2 tests (`StyleGuideTests`) — Google Python Style 언급 + ID-in-docstring rule 문서화 검증.

### Why
A/B 테스트 결과물 리뷰에서 사용자 피드백: `AC1_CodeFormatTests` · `BR004_StrictestRuleTests` 같은 **이름에 spec ID 를 박는 패턴이 가독성 저해**. 이름은 도메인 의미 (`CodeFormatTests`, `StrictestRuleSelectionTests`), spec reference 는 docstring 메타데이터로 분리해야 한다는 원칙.

### Changed
- `.claude-plugin/plugin.json` · `marketplace.json` — 0.4.0 → 0.4.1

### Testing
- 430 → **432 tests** (+2 StyleGuideTests).
- self_check 5/5 green.

### 범위 외 (참고)
A/B test B 조건 artifacts (`/tmp/ab-test-harness-boot/*/B-harness/test_*.py`) 도 새 규약으로 재작성 — 이는 repo 외 demo 라 커밋엔 미포함. 32/32 tests 유지.

## [0.4.0] — 2026-04-23

**첫 minor bump. Agent orchestration & interactive flows 완결.** F-002 · F-012 · F-014 및 신규 인프라 F-023 · F-024 를 묶음 → 24/24 features done.

### Added — Agent 층 (F-023 · F-012)
- **`agents/` 디렉터리 신규** (plugin root) — Claude Code 2.1.x 규약의 자동 discovery 위치
- **3 core sub-agents**:
  - `orchestrator` — 다단계 조율 (Agent · Read/Write/Edit/Bash/Task* · WebFetch)
  - `implementer` — TDD 코드 빌더 (Read/Write/Edit/Bash/Grep/Glob/NotebookEdit, 하지만 Agent tool 없음 · 추가 delegation 금지)
  - `reviewer` — read-only 감사 (Read/Grep/Glob/Bash만 · Edit/Write 금지, CQS 엄수)
- **권한 매트릭스** 문서화 (`agents/README.md`) + Claude Code 런타임 enforcement 확증
- 각 에이전트 본문에 BR-014 Preamble + Anti-rationalization 2 행 규약
- 10 신규 tests (디렉터리/frontmatter/permission/preamble)

### Added — Hook 층 (F-024 · F-014)
- **`hooks/hooks.json`** 신규 (plugin root) — SessionStart banner 하나만 (global scope 의식적 최소화)
- **`hooks/session-bootstrap.sh`** — `.harness/` 존재 시 `/harness:status` 유도 배너 · 없으면 silent exit 0
- **`docs/templates/hooks/` 5 opt-in 템플릿** (사용자가 자기 프로젝트 `.claude/hooks.json` 으로 복사):
  - `security-gate.sh` (PreToolUse Bash) — rm -rf root · system · home · chmod 777 · fork-bomb 감지
  - `format.sh` (PostToolUse Write|Edit) — prettier/black/gofmt/rustfmt auto-apply
  - `doc-sync-check.sh` (PostToolUse Write|Edit) — CLAUDE.md @-import 유효성
  - `test-runner.sh` (PostToolUse Write|Edit) — 바뀐 파일 타입별 테스트 실행
  - `coverage-gate.sh` (PreToolUse Bash) — `rm -rf` / git reset --hard / force push / SQL DROP 경고 + 1s delay
- **Fail-open 강제**: 모든 훅 `exit 0` 종결 · 플러그인 hook 은 exit 2 반환 불가
- 21 신규 tests (infra 5 · templates 5 · pipe-test 11 — false-positive 회귀 포함 `rm -rf /tmp/foo` must NOT warn)

### Added — Interactive Mode 층 (F-002 완결)
- **commands/spec.md 대폭 확장** — Modes A/R/B-2 의 LLM prose contract 구체화:
  - 각 Mode 별 **Activation trigger** (결정론 분기)
  - **LLM prompt template** (Claude 가 따라야 할 단계)
  - **Approval checkpoint** (사용자 "1·예" 응답 전까지 Edit/Write 금지)
  - **`--dry-run` 의미론**: checkpoint 자동 "3·취소"
- Mode E 의 CQS 엄수 문구 재강화 (Edit 호출 금지 · mtime 불변 · 대화 중 수정 요청은 Mode A/R 재분기)
- Mode B-2 의 `skills/spec-conversion` 4-stage 호출 + schema 재검증 루프 명시
- 12 신규 tests (prose contract grep 검증 — 각 Mode 섹션 필수 구성요소 존재)

### Changed
- `.claude-plugin/plugin.json` · `marketplace.json` — 0.3.13 → **0.4.0** (첫 minor bump)
- `docs/samples/harness-boot-self/spec.yaml` → 24 features (F-023 + F-024 신규)
- `.harness/state.yaml` — F-002 partial → done · 4 신규 feature cycles 기록

### Testing
- 387 → **430 unit tests** (+10 agents + 21 hooks + 12 modes = +43 신규)
- self_check 5 steps green
- `/harness:check` 9/9 drift clean (errors 0 · warns 0)

### Phase 2 dogfood 집계
- 총 15 feature cycles recorded via `scripts/work.py` 이번 세션 누적 (F-020, F-022, F-015, F-019, F-021, F-013, F-017, F-023, F-012, F-024, F-014, F-002 + 세션 전 3)
- state.yaml: **24/24 features done** (100%) — harness-boot-self 스펙의 모든 선언이 실 구현 증거 보유
- lead time baseline: median 1.32m · mean 1.64m · max 3.97m (n ≥ 10)

### Scope
v0.4 완결. 다음 minor (v0.5) 후보:
- 공식 마켓플레이스 PR
- Cross-language canonical hash 테스트 벡터
- Event log rotation
- Phase 3 CI (.github/workflows/)
- 템플릿 보강 NEW-51/52/53

## [0.3.13] — 2026-04-23

**Phase 2 집단 closeout — 5 planned features 일괄 처리 + F-017 실 구현.**

### Added
- **Protocol drift (9 번째 drift 종) — F-017 AC-2 구현**
  - `scripts/check.py.check_protocol()` · `.harness/protocols/*.md` 각 파일의 frontmatter `protocol_id` 가 파일명 stem 과 일치하는지 자동 검증
  - 7 신규 테스트 (`ProtocolDriftTests`): no-protocols / matching-id / mismatched-id / missing-frontmatter / missing-id / invalid-yaml / non-dict
  - `commands/check.md` — 9 종 drift 반영
- **Protocol 라이브러리 (F-017 AC-1)**
  - `docs/protocols/README.md` — 프로토콜 형식 spec + 버전 정책 (breaking 은 `_v2` 병행 파일로 parallel-protocol · 기존 `status: deprecated` 2 minor 유지)
  - `docs/protocols/sync-to-work-handoff.md` — stable 프로토콜 v1 · `/harness:sync` → `/harness:work` 핸드오프 페이로드 스키마

### F-017 완료
AC-1 (breaking 은 병행 유지) · AC-2 (protocol_id == 파일명 stem 자동 검증) 둘 다 충족.

### 일괄 closeout (Phase 2 cycles 3~7)
- **F-015** (CLAUDE.md shim + 사용자 프로젝트 분리) — 이미 `docs/templates/starter/CLAUDE.md.template` + `commands/init.md §3` 에서 구현됨. BR-009 + NEW-44 검증 evidence 로 done.
- **F-019** (v1→v2 마이그레이션) — v1 사용자 부재 (첫 public release = v0.1.0 이 곧 v2.3.8 schema). BR-007 Non-claim 원칙 적용 · done.
- **F-021** (플러그인 자체 빌드 · 배포) — 12 태그 (v0.1.0~v0.3.12) + 2 매니페스트 + 4 tracked 디렉터리 + v0.3.10 real-session `/plugin update` smoke. AC-1 AC-2 충족 · done.
- **F-013** (Claude skills 호출 인터페이스) — `skills/spec-conversion/SKILL.md v0.5` 이미 shipped (frontmatter description + 5 adapters + 4 templates). AC-1 AC-2 충족 · done.
- **F-017** (Protocols) — 위 Added 섹션 참조.

### Phase 2 연기 (v0.4 minor bump)
- **F-012** (sub-agents Tool 권한 매트릭스) — `agents/` 디렉터리 부재 → v0.4 에 agents 인프라와 함께
- **F-014** (Hooks 시스템) — `hooks/` 디렉터리 부재 → v0.4 에 hooks 인프라와 함께
- **F-002** (Modes A/R/B-2 실 구현) — LLM 대화 루프 실구현 필요, 단일 세션 범위 초과 → v0.4 후보

### Changed
- `docs/samples/harness-boot-self/spec.yaml` · `.harness/spec.yaml` — 변경 없음 (F-022 까지 유지)
- `.harness/state.yaml` — 5 features 전이 기록 (F-013/F-015/F-017/F-019/F-021 모두 done)
- `scripts/check.py` docstring — v0.3.13 범위 9/9 반영
- `.claude-plugin/plugin.json` · `marketplace.json` — 0.3.12 → 0.3.13

### Testing
- 380 → **387 tests** (+ 7 ProtocolDriftTests).
- self_check 5 단계 green 유지.

### Phase 2 누적 통계
- Features done via /harness:work: 7 (F-020, F-022, F-015, F-019, F-021, F-013, F-017)
- state.yaml done 총계: 19/22 (86%). 남은 3 개 (F-002 partial, F-012, F-014) 는 v0.4 후보.
- events.log 누적 lifecycle 이벤트: 40+ 건 · 실 lead time 분포 · gate pass_rate 추적 가능.

## [0.3.12] — 2026-04-23

**F-022 — gate_runner auto-detect layout heuristics. v0.3.11 에서 발견한 bug 를 측정-수정-검증 루프로 처리.**

### Added
- **`detect_gate_0_command` 의 namespace-package 지원** — `tests/unit/test_*.py` 같은 서브디렉터리 레이아웃에서 pytest 부재 시 `python3 -m unittest discover tests.unit` module-path form 사용. 이전엔 `-s tests` fallback 이 "NO TESTS RAN" (exit 5) 반환.
- 우선순위: pytest → `tests/unit/` (선호) → `tests/<기타 sub>/` (알파벳 순 첫 매치) → `-s tests` (평면 레이아웃 fallback).
- 4 신규 테스트:
  - `test_tests_unit_subpackage_prefers_module_path` — tests/unit 인식
  - `test_tests_other_subpackage_module_path` — tests/integration 같은 임의 sub 도 동작
  - `test_tests_unit_prefers_over_other_subpackages` — tests/unit 가 알파벳 순 우선
  - `test_tests_flat_layout_falls_back_to_dash_s` — 회귀 방지 (tests/test_*.py 평면 레이아웃은 기존 동작 유지)

### Phase 2 dogfood 루프 2 번째 사이클
- F-020 (v0.3.11) 에서 발견한 gate_0 auto-detect bug 를 F-022 로 공식 등록
- `scripts/work.py F-022 --run-gate gate_0` 이 **override 없이** PASS — AC-2 충족
- `/harness:metrics` 로 측정 기회: v0.3.12 이후 gate_0 pass_rate 상승 관찰 가능

### Changed
- `docs/samples/harness-boot-self/spec.yaml` — F-022 신규 추가 (21 → 22 features).
- `.harness/spec.yaml` — sample 재복사.
- `.harness/state.yaml` — F-022 cycle 기록.
- `.claude-plugin/plugin.json` · `marketplace.json` — 0.3.11 → 0.3.12.

### Testing
- 376 → **380 tests** (+ 4 DetectCommandTests).
- self_check 5 단계 green 유지.
- harness-boot 자체 gate_0 이 dev workflow 에서 override 없이 동작.

### 의미
Phase 2 는 **자기 자신의 개선 루프를 측정** 할 수 있음을 실증. v0.3.11 의 metric 에서 `gate_0 pass_rate 50%` 로 bug 가 정량화됐고, v0.3.12 에서 fix 후 다음 metric 에 개선이 수치로 나타남. 이것이 dogfood 의 재귀적 가치.

## [0.3.11] — 2026-04-23

**F-020 — YAML Language Server 지원 · Phase 2 첫 실 피처 착수.**

### Added
- **starter 템플릿 $schema 지시자** — `docs/templates/starter/spec.yaml.template` 최상단에 `# yaml-language-server: $schema=https://raw.githubusercontent.com/qwerfunch/harness-boot/main/docs/schemas/spec.schema.json` 추가. 사용자가 `/harness:init` 후 생성된 `.harness/spec.yaml` 편집 시 VSCode (redhat.vscode-yaml) · IntelliJ 에서 **자동완성 · 검증 · 에러 하이라이팅** 동작. 템플릿 주석에 IDE 확장 설치 안내 포함.
- **회귀 방지 테스트** — `tests/unit/test_starter_schema.py` — 템플릿과 sample spec 양쪽 첫 줄이 정확한 $schema 지시자인지 grep. 2 신규 tests.
- **Canonical self-spec 은 이미 $schema 지시자 보유** 확인 — sample 과 template 간 일관성 유지.

### Phase 2 Active dogfood 첫 실증
**이번 릴리즈가 Phase 2 의 첫 실제 feature 사이클 기록**:
- `scripts/work.py F-020` → `.harness/state.yaml` 에 in_progress 전이 + `events.log` 에 `feature_activated` 이벤트
- `scripts/work.py F-020 --run-gate gate_0 --override-command ...` → 376 tests PASS · auto evidence
- 수동 evidence 1 건 추가 · gate_5 는 test_starter_schema 로 대체 기록
- `--complete` 시 BR-004 검증 통과
- **events.log 에 진짜 feature lifecycle 이벤트가 최초로 쌓임** (기존엔 sync_completed 만)

### Discovered (향후 개선 후보)
- gate_0 auto-detect 가 `tests/` 디렉터리에 `__init__.py` 없으면 `python3 -m unittest discover -s tests` 로 fallback 해서 **NO TESTS RAN (exit 5)** 반환. 우리 레이아웃 (`tests/unit/`) 에선 `python3 -m unittest discover tests.unit` 이 필요. 현재는 `--override-command` 로 우회. v0.3.12 에서 `detect_gate_0_command` 가 `tests/unit/__init__.py` 존재 확인 후 module path 로 discover 하도록 개선.

### Changed
- `.claude-plugin/plugin.json` · `marketplace.json` — 0.3.10 → 0.3.11.
- `.harness/state.yaml` — F-020 planned → done (evidence 2, gate_0 pass, gate_5 pass).

### Testing
- 374 → **376 tests** (+ 2 StarterSchemaTests).
- self_check 5 단계 green 유지.

## [0.3.10] — 2026-04-23

**Phase 1 Passive dogfood — 자기 자신에게 자기 스크립트 돌리기.**

### Added
- **`.harness/` 레포 루트 신규** (3 tracked, 4 derived-gitignored):
  - `.harness/spec.yaml` — `docs/samples/harness-boot-self/spec.yaml` 의 **복사본** (symlink 아님 — 크로스 플랫폼 안전).
  - `.harness/state.yaml` — 21 피처 status 를 v0.3.9 기준으로 seed. 갱신 정책: **릴리즈 태그 시점에만** (`/plugin upgrade` 노이즈 최소화).
  - `.harness/README.md` — 사용자 혼란 방지 안내 (이것은 **dev 도그푸드** · 사용자 스펙 아님).
  - gitignored: `events.log`, `harness.yaml`, `domain.md`, `architecture.yaml`, `chapters/`.
- **`scripts/self_check.sh`** — 5 단계 무결성 검증:
  1. `.harness/spec.yaml == docs/samples/harness-boot-self/spec.yaml` (SSoT 동기성 · `diff -q`).
  2. `validate_spec .harness/spec.yaml` (JSONSchema).
  3. `sync --harness-dir .harness` (derived 재생성 · round-trip 재현).
  4. `check --harness-dir .harness --project-root .` (8/8 drift · error severity 0 요구).
  5. `commands/*.md` 규약 grep (Preamble · Anti-rationalization 2 행 · `scripts/` 참조).
  → 하나라도 fail 시 non-zero exit, 마지막 실패 지점 stderr.
- **`tests/unit/test_self_dogfood.py`** — `self_check.sh` 를 subprocess 로 호출해 exit 0 assert. 파일 부재 시 skip (사용자 환경 안전 방어).

### Changed
- `.gitignore` — `.harness/` derived 파일 5 종 미추적.
- `CLAUDE.md` §7 — 자체 도그푸드 규약 4 줄 추가 (Passive 관측 / SSoT / Phase 2 예고 / 사용자 충돌 없음 보장).
- `README.md` — **Self-hostable** 기둥 설명에 v0.3.10 self_check 반영.
- `.claude-plugin/plugin.json` · `marketplace.json` — 0.3.9 → 0.3.10.

### 사용자 영향 (검증 완료)
- 사용자가 `/harness:*` 를 자기 프로젝트에서 실행 시 여전히 `$(pwd)/.harness` 만 참조. 플러그인 내부 `.harness/` 는 invisible. **충돌 없음.**
- 플러그인 install 후 git clone 에 `.harness/spec.yaml` · `state.yaml` · `README.md` 가 함께 배포되지만 실행 경로에 영향 없음 · 바이트 증가 최소 (~100KB).

### Testing
- 373 → **374 tests** (+1 self_dogfood, OK, 16 skipped).
- self_check 5 단계 green 확인: SSoT diff · validate · sync · check (0 errors) · commands 규약 (8 files × 3 checks = 24 passes).

### Dogfood 이점
- scripts/sync.py 등 수정 시 self 스펙 파생이 깨지면 **unittest 가 즉시 감지** → release gate.
- commands/*.md 에서 Anti-rationalization · Preamble 누락 자동 탐지 (v0.3.2 감사 P1 항목의 자동화).
- Phase 2 에서는 `scripts/work.py` 실사용으로 **실 lead time · gate pass rate** 가 `/harness:metrics` 에 축적 예정.

## [0.3.9] — 2026-04-23

**F-008 `/harness:metrics` 신규 구현.** 0.3.x 코어 명령 8 개 전부 shipped 상태.

### Added
- **`/harness:metrics`** (F-008) — `.harness/events.log` 집계 read-only 명령. 윈도우 내 집계: total events + type 별 분포 · features activated/done/blocked · lead time 분포 (마지막 activated → 첫 done, 초 단위 min/median/mean/max) · gate 별 pass/fail/skipped + pass_rate · drift 빈도 (sync_failed 카운트).
- **CLI**: `--period 7d|24h|30m|30s|2w` (소 → 대 단위 자동 추정) · `--since ISO8601` (우선) · `--format human|json|csv` · `--harness-dir`.
- **JSON 포맷** (CI 친화) · **CSV 포맷** (`metric,key,value` long-format, spreadsheet 붙여넣기용).
- 33 신규 테스트 (period parser 8 · aggregate 9 · compute 7 · format 6 · CLI 3).

### CQS 강제
- `events.log` mtime 불변 테스트 포함.
- `state.yaml` · `harness.yaml` · `spec.yaml` 미접근.

### Testing
- 340 → **373 tests** (+33 metrics).
- Dogfood: 합성 이벤트 7 건으로 human 포맷 출력 검증 — lead time 1.25h / gate_0 pass rate 100% 정확.

### Scope
- 0.3.x 코어 8 명령: `init` · `spec` · `sync` · `work` · `status` · `check` · `events` · `metrics` 전부 shipped.
- 다음: 안정화 · 공식 마켓플레이스 PR · 템플릿 보강 (v0.3.10+) · v0.4 마일스톤.

## [0.3.8] — 2026-04-23

**F-006 drift 탐지 8/8 완결.**

### Added
- **Code drift** (`check_code`) — `features[].modules[]` 가 dict 이면서 `source` 필드가 있으면 그 경로가 `project_root` 기준 실존하는지 검증. 단순 문자열 모듈은 논리 식별자로 보고 skip (false positive 방지).
- **Doc drift** (`check_doc`) — `project_root/CLAUDE.md` 의 `@<path>` import 타겟이 실존하는지 + 파생 `domain.md` · `architecture.yaml` 이 0 byte 가 아닌지. `@http(s)://` 은 외부 링크로 보고 skip.
- **Anchor drift** (`check_anchor`) — `features[].id` 가 `^F-\d+$` 패턴인지 · 유일성 · `depends_on: [...]` 참조가 실제 feature ID 집합 내에 존재하는지.
- `--project-root` CLI 옵션 — 기본값은 `--harness-dir` 의 부모.

### Changed
- `commands/check.md` — 8/8 drift 목록 갱신 + preamble Anti-rationalization 2 행 "8 종" 표기.
- `scripts/check.py` 모듈 docstring — v0.4+ deferred 표기 제거, 전부 shipped 로 갱신.

### Testing
- 322 → **340 tests** (+18: Code 4 · Doc 6 · Anchor 8).
- Dogfood: `docs/samples/harness-boot-self/spec.yaml` 에 대해 Code · Anchor 각각 0 findings (21 features · F-001..F-021 모두 유효 · depends_on 참조 모두 해결).

### Coverage
| Drift | Before | After |
|---|---|---|
| Generated | ✅ | ✅ |
| Derived   | ✅ | ✅ |
| Spec      | ✅ | ✅ |
| Include   | ✅ | ✅ |
| Evidence  | ✅ | ✅ |
| Code      | ⏳ v0.4+ | ✅ |
| Doc       | ⏳ v0.4+ | ✅ |
| Anchor    | ⏳ v0.4+ | ✅ |

## [0.3.7] — 2026-04-23

**Gate 자동화 완결 — BR-004 Iron Law fully automated.**

### Added
- **Gate 5 (runtime smoke) 자동 실행** — `/harness:work --run-gate gate_5` 가 convention 기반 자동 감지: `scripts/smoke.sh` → `tests/smoke/` + pytest → `tests/smoke/` + unittest → Makefile `smoke:` → package.json `scripts.smoke`. 감지 실패 시 `skipped` 반환 (reason 에 `harness.yaml.gate_commands.gate_5` override 안내 포함). 기본 timeout 600s. 13 신규 테스트 (detect 7 + run 5 + dispatcher 1).

### Changed
- `commands/work.md` — gate_5 감지 우선순위 + override 권장 · 범위 표기 업데이트 (gate_0~5 전부 자동화).
- 디스패처 `not yet supported` 메시지가 v0.3.7 기준으로 갱신 (gate_6+ 에 한해 skipped).

### Meaning
BR-004 Iron Law — "gate_5=pass + evidence≥1 없이 `done` 거부" — 가 이제 **완전 자동 실행**. 수동 `--gate gate_5 pass` 없이 `--run-gate gate_5` 로 검증 가능. runtime smoke 가 프로젝트별 특성이 강하므로 harness.yaml override 가 실제 주요 경로.

### Testing
- 309 → **322 tests** (+ 13 Gate 5 + 1 dispatcher 갱신).
- Dogfood: harness-boot 자체 `scripts/smoke.sh` 부재 → `skipped` 정확히 반환 (expected behavior).

## [0.3.6] — 2026-04-23

### Added
- **Gate 4 (commit check) 자동 실행** — `/harness:work --run-gate gate_4` 가 `git diff --quiet && git diff --cached --quiet` 로 working tree + staging area 의 clean 여부 검증. git repo 아니거나 `git` 바이너리 부재 시 `skipped` 반환. 기본 timeout 30s. 8 신규 테스트 (detect 3 + run 5).

### Changed
- `commands/work.md` — gate_4 감지 로직 + skip 조건 명시. gate 자동화 범위 표기 (0~4) 갱신.

### Testing
- 300 → **309 tests** (+ 8 Gate 4 + 1 dispatcher 갱신).
- Dogfood: harness-boot 자체 레포에서 F-104 `--run-gate gate_4` 동작 확인 (미커밋 파일 존재 시 FAIL 정확히 감지).

## [0.3.5] — 2026-04-23

### Added
- **Gate 3 (coverage) 자동 실행** — `/harness:work --run-gate gate_3` 가 Python (pytest-cov / coverage+pytest), TypeScript/JavaScript (package.json scripts.coverage / npx nyc), Rust (cargo-tarpaulin / cargo-llvm-cov), Go (go test -cover) 에 대해 커버리지 도구 자동 감지 + 실행. threshold 는 도구 자체 설정 (`[tool.coverage]` · package.json · etc.) 을 따름 — harness 는 tool 선택 · exit code 로 pass/fail. 기본 timeout 600s (테스트 + 커버리지 수집은 더 오래 걸림). 12 신규 테스트.

### Changed
- `commands/work.md` — gate_3 감지 우선순위 + threshold 정책 명시.

### Testing
- 288 → **300 tests** (+ 12 Gate 3 관련).
- Dogfood: harness-boot-selfhost 에서 F-103 --run-gate gate_3 PASS.

## [0.3.4] — 2026-04-23

### Added
- **Gate 2 (lint) 자동 실행** — `/harness:work --run-gate gate_2` 가 Python (ruff · flake8), TypeScript/JavaScript (eslint · npx eslint), Rust (cargo clippy), Go (golangci-lint) 에 대해 린터 자동 감지 + 실행. 감지 순서: pyproject+ruff → pyproject+flake8 → package.json+eslint → .eslintrc*+npx → Cargo+clippy → go.mod+golangci-lint. pass 시 evidence 자동 기록. 11 신규 테스트.

### Changed
- `commands/work.md` — gate_2 감지 우선순위 명시.

### Testing
- 277 → **288 tests** (+ 11 Gate 2 관련).
- Dogfood: harness-boot-selfhost 에서 F-102 --run-gate gate_2 PASS.

## [0.3.3] — 2026-04-23

### Added
- **Gate 1 (type check) 자동 실행** — `/harness:work --run-gate gate_1` 가 Python · TypeScript · Rust · Go 에 대해 타입 체커 자동 감지 + 실행. 감지 우선순위: pyproject+mypy → pyproject+pyright → tsconfig+tsc → Cargo+cargo check → go.mod+go vet. pass 시 evidence 자동 기록 + `gate_auto_run` 이벤트. 10 신규 테스트 (detect · run · dispatcher).

### Changed
- **`gate_runner.py` 내부 리팩터** — `_execute()` 공통 subprocess 헬퍼 + `_resolve_command()` 우선순위 해석 헬퍼 추출. 향후 Gate 2~5 추가 시 함수당 ~10 줄로 축소 가능.
- `commands/work.md` — gate_0/gate_1 감지 우선순위 명시.

### Testing
- 267 → **277 tests** (+ 10 Gate 1 관련).
- Dogfood: harness-boot-selfhost 에서 `/harness:work F-101 --run-gate gate_1` 성공.

## [0.3.2] — 2026-04-23

v0.3.1 까지 발표된 8 철학 기둥과 실제 구현 · README 주장 간 정합을 감사하고 2 개 선언-only 항목을 강제 enforcement 로 승격 + README over-claim 4 건 톤 조정 + preamble 규약 통일.

### Fixed
- **Walking Skeleton 스키마 강제** — `docs/schemas/spec.schema.json` 의 `features` 에 `prefixItems[0].type = "skeleton"` + `minItems: 1`. `/harness:sync` Gate 0~1 이 첫 피처 타입 위반을 자동 차단. 이전에는 템플릿 주석으로만 안내되던 규약이 이제 JSONSchema 로 검증됨. 6 신규 테스트 (`WalkingSkeletonEnforcementTests`).
- **Anti-rationalization 2 행 규약 commands 전체 적용** (BR-014) — `commands/init.md · spec.md · sync.md · work.md · status.md · check.md · events.md` 전부 Preamble 섹션에 "NO skip: ..." / "NO shortcut: ..." 2 행을 command-specific 제약으로 명시. 이전엔 암묵적이었음.

### Changed
- **README over-claim 톤 조정** — 감사 결과 4 항목 정직화:
  - Canonical Hashing — cross-language 테스트 벡터는 v0.4+ 로 명시.
  - Hook fail-open — "⏳ (v0.4+)". `hooks/` 디렉터리 자체가 shipped 안 됨.
  - Event log rotation — "v0.4+". 코드 없음.
  - integrator 에이전트 — "⏳ (v0.4+)". `agents/` 디렉터리 부재.
  - 각 기둥에 ✅ / 🛠 / ⏳ 상태 마커 부착.
- **Preamble 세부 규약 8 commands 통일** — 이모지 · 명령 · mode/scope · 5~10 단어 근거. 이전엔 init/sync/spec 만 구체, work/status/check/events 는 축약형이었음. + 2-3 줄 anti-rationalization 규약 고정.

### Testing
- 261 → **267 tests** (+ 6 WalkingSkeletonEnforcement).
- `harness-boot-self` canonical spec 통과 확인 (features[0] = "skeleton").

### 감사 보고 (세션 내 기록)
4-way 정합 (design doc · 구현 · README · 테스트). 핵심 결론: 철학 정합 7 → 9/10, 문서-코드 일치 6 → 8/10.

## [0.3.1] — 2026-04-23

### Added
- **`scripts/gate_runner.py`** — Gate 0 (tests) 자동 실행. pytest → unittest → npm test → make test 자동 감지 + `harness.yaml.gate_commands.<gate>` override + timeout 지원. stdout/stderr 마지막 30 줄 tail 로 요약.
- **`/harness:work --run-gate <NAME>`** — gate_runner 실행 → state 자동 기록 + pass 시 evidence 자동 추가 + `gate_auto_run` 이벤트 로그. gate_1~5 는 현재 `skipped` 반환 (v0.3.2+).
- 지원 플래그: `--override-command`, `--project-root`, `--timeout`.

### Testing
- **261 unit tests** (v0.3.0 의 237 + gate_runner 19 + work run-gate 5).
- Dogfood: harness-boot 자체 테스트 (261/261) 을 plugin 의 `/harness:work --run-gate gate_0` 로 실행해서 PASS + evidence 자동 기록.

### Versioning policy
- 이 버전부터 **patch bump 우선** 정책 적용. 새 명령 · 헬퍼 추가는 patch (0.3.X+1). minor/major 는 사용자 확인 후 큰 마일스톤에 예약.

## [0.3.0] — 2026-04-23

### Added — Development loop closed

4 신규 슬래시 명령 + 1 공통 유틸:

- **`/harness:work`** (F-004) — 피처 단위 개발 사이클 상태 관리. 활성화 · Gate 기록 · 증거 수집 · `done` 전이. BR-004 (Iron Law) 준수 — gate_5=pass + evidence≥1 없으면 done 거부. `scripts/work.py` + 17 tests.
- **`/harness:status`** (F-005) — 세션 · 피처 카운트 · drift · 마지막 sync · active 피처 요약 (CQS read-only). `scripts/status.py` + 11 tests (mtime 불변 검증).
- **`/harness:check`** (F-006, partial) — 5/8 drift 탐지 (Generated · Spec · Derived · Include · Evidence). Code/Doc/Anchor 는 v0.4+. `scripts/check.py` + 23 tests.
- **`/harness:events`** (F-007) — events.log 조회 with kind/feature/since 필터 (CQS). `scripts/events.py` + 12 tests.
- **공통 유틸** `scripts/state.py` (17 tests) — state.yaml 의 read/save/lifecycle helper. 모든 v0.3 명령이 공유.

### Testing
- 총 **237 unit tests** (v0.2.1 의 157 + 80 신규).
- F-004 end-to-end full-cycle 테스트: activate → 6 gate pass → evidence → complete. 9 events 정확한 순서 검증.

### Closed issues from Phase α dogfood
- (이미 v0.2.1 에서) NEW-50 — plugin_version resolution fallback.

### Known remaining
- Phase 1 Gate 자동 실행 (test runner · runtime smoke) 은 v0.4.
- Code · Doc · Anchor drift 는 v0.4.
- Modes A/R/B-1/B-2 실제 interactive 흐름은 여전히 LLM 드리븐 (classifier + diff 도구는 있음).

## [0.2.1] — 2026-04-23

### Fixed
- **NEW-50**: `_plugin_version` 이 scratch 워크스페이스에서 `"unknown"` 으로 기록되던 문제 해결 — `_script_repo_version()` (strategy 0, `__file__` 기반) + `plugin_root.resolve()` (strategy 2, 4-전략 체인) fallback 추가. events.log 의 `plugin_version` 이 실제 실행 중인 sync.py 의 repo 버전을 정확히 반영.

### Added (test)
- 3 신규 단위 테스트 (`PluginVersionResolutionTests`) — strategy 0 bypass + parent search hit + plugin_root.resolve fallback + 전체 실패 시 'unknown'.

### Discovered (Phase α dogfood, 2026-04-23)
- `docs/samples/harness-boot-self/spec.yaml` 을 scratch 워크스페이스에서 `/harness:sync` 돌려 self-describe round trip 검증. `plugin_root_resolver` 모듈이 architecture.yaml 에 정상 노출 (v0.1.1 NEW-37/44 회귀 보호 확인). 발견 갭 NEW-50~55 는 local 노트 (`design/phase-v0.3-dogfood-findings.md`).

### Testing
- 157 unit tests (0.2.0 의 154 + 3 신규).

## [0.2.0] — 2026-04-23

### Added — Self-describe round trip
- **`/harness:sync`** (F-003) — Phase 0 완성. `spec.yaml` 에서 `domain.md` · `architecture.yaml` · `harness.yaml` 해시트리 · `events.log` 파생. edit-wins 보호 + `--dry-run` / `--force`. 구현: `scripts/sync.py` + `commands/sync.md`.
- **`/harness:spec`** (F-002, partial) — Mode A/B/R/E 자동 분기. Mode E (read-only explain) + classifier + diff 렌더러는 Python 구현. Modes A/R/B-1/B-2 는 Claude LLM 대화 드리븐 (spec-conversion skill v0.5 와 연계).
- **$include 전개 엔진** (F-009) — `scripts/include_expander.py`. Depth=1 강제 · 🔒 필드 차단 · chapters 디렉터리 escape 방지.
- **Canonical Hashing — Merkle 3층** (F-010) — `scripts/canonical_hash.py`. Canonical JSON → SHA-256. subtree 해시 + merkle_root 결합.
- **JSONSchema 검증** (Gate 0~1) — `scripts/validate_spec.py`. sync 가 파생 전 스키마 검증. 실패 시 `sync_failed` 이벤트.
- **플러그인 루트 해석 유틸** — `scripts/plugin_root.py`. NEW-37/44 4-전략 체인을 재사용 가능 모듈로.
- **Self-referential canonical spec** — `docs/samples/harness-boot-self/spec.yaml` · `README.md`. harness-boot 자체를 한 제품으로 보고 변환한 21 features 스펙. v0.2 의 round-trip 실증 입력.

### Changed
- `.claude-plugin/plugin.json.version` → `"0.2.0"`.
- `.claude-plugin/marketplace.json` plugin entry version → `"0.2.0"`.
- `commands/sync.md` 가 `scripts/sync.py` 에 위임.
- `commands/spec.md` 가 신규 Python 스크립트 (`spec_mode_classifier.py` · `explain_spec.py` · `spec_diff.py`) 를 CLI 로 호출.

### Testing
- 총 **154 unit tests** (v0.1.1 의 0 → v0.2.0 의 154). 모든 파생 빌딩블록 커버.
- **Self-describe smoke** — `harness-boot-self/spec.yaml` → `domain.md` (~11 KB) · `architecture.yaml` (~10.7 KB) · 6 subtree 해시 · merkle_root. `spec_hash = 6971d901...`.

### Dependencies
- Python 3.10+ · `pyyaml` 필수 · `jsonschema` 선택 (설치 시 structural validation 활성).

## [0.1.1] — 2026-04-23

### Added
- **`.claude-plugin/marketplace.json`** — single-plugin marketplace. `/plugin marketplace add github:qwerfunch/harness-boot` 경로로 직접 설치 가능 (NEW-45 해소).

### Changed
- **`/harness:init` 강건성 개선**:
  - 프로젝트 루트 신호 체크가 **정보성** 으로 동작 — 4 개 신호가 없어도 중단하지 않고, 최종 보고에 `팁: 'git init' 권장` 한 줄만 추가 (NEW-39, re-smoke 피드백으로 y/N 프롬프트를 info-only 로 완화).
  - 프로젝트 이름 추출 체인에 empty/whitespace/null 감지 + kebab-case 정규화 추가 (NEW-40).
  - `date -u` 실패 시 Python/Node fallback + 마지막 수단으로 사용자 프롬프트 (NEW-42, Windows Git Bash 대응).
  - §2 플러그인 루트 경로 해석을 4-전략 체인 (PATH/registry/marketplace-source/prompt) 으로 확장 (NEW-44).

### Closed (retrospective)
- **NEW-37** — `$CLAUDE_PLUGIN_ROOT` 은 CC 2.1.x 에서 미설정. 실제 해석은 `$PATH` 주입 `<root>/bin` 역산. v0.1.0 (`37bd0a4`) 에서 이미 문서 패치됨, v0.1.1 RFC 는 closure 만.

### Remaining (v0.1.2+)
- NEW-39/40/42/44 가 실제 사용자 시나리오에서 정말 해소되는지 재검증 필요 (두 번째 first-run 스모크 대상).
- 공식 마켓플레이스 PR — 안정화 후.

## [0.1.0] — 2026-04-23

### BREAKING
- 아키텍처 **피벗**: TypeScript CLI (bin/harness-boot + src/**) 를 전면 폐기하고, Claude Code 네이티브 플러그인으로 재설계. 구 CLI 경로 · 구 commands (`/analyze`, `/spec` 구버전) · `src/**` 코어는 제거됨. 이전 사용자가 있다면 레포 재설치 필요.

### Added
- **플러그인 매니페스트** `.claude-plugin/plugin.json` — `commands/` · `skills/` · `agents/` · `hooks/` 디렉터리 선언.
- **슬래시 명령** `/harness:init` (commands/init.md) — `.harness/` 스캐폴딩 + CLAUDE.md 편성 + `.gitignore` 병합 + 초기 events.log. `--team` / `--solo` 모드 분기 지원.
- **스킬** `skills/spec-conversion/SKILL.md` v0.5 — plan.md → spec.yaml 변환. 24 원칙 · 5 도메인 어댑터 (saas · game · worker · library · meta) · 4-stage 파이프라인 (정찰 → 저작 → gap → backlink).
- **spec.yaml 스키마** v2.3.8 (`docs/schemas/spec.schema.json`) — JSONSchema draft 2020-12. 9 블록 네이티브 배치 (`metadata.*`). 11/11 샘플 validation 통과.
- **Starter 템플릿** 4종 (`docs/templates/starter/`) — spec.yaml · harness.yaml · state.yaml · CLAUDE.md. `{{PROJECT_NAME}}` 치환.
- **Mode B 통계 추출** (`scripts/mode_b_*.py`) — BM25 (k1=1.5, b=0.75) + Porter-lite 스테밍 + 한국어 조사 제거 + 12 축 질의 어휘. 6 샘플 회귀 recall 0.991 / precision 0.861 (가설 F-9 HIT).
- **Golden 샘플** 8개 (`tests/regression/conversion-goldens/`) — url-shortener · retro-jumper · price-crawler · vapt-apk-sast · tzcalc · vite-bundle-budget · vscode-commit-craft · harness-boot-self. MANIFEST.yaml 인덱스.
- **문서**: `README.md` (30초 파악), `docs/setup/local-install.md` (스모크 시나리오 6 검증).

### Deferred to v0.2+
- `/harness:sync` — spec 변경 후 domain.md · architecture.yaml 파생.
- `/harness:work` — Walking Skeleton → 기능 구현 사이클.
- `/harness:status` · `/harness:check` — 진행·드리프트 조회.
- `scripts/hash-fixtures.mjs` — Merkle 해시 트리 계산.
- `.claude/agents/**` · `.claude/skills/**` 자동 생성.
- 6 핵심 훅: security-gate · doc-sync-check · coverage-gate · format · test-runner · session-start-bootstrap.

### First-run smoke (2026-04-23, Claude Code 2.1.118)

- §1~§7 전부 통과. NEW-37 메커니즘 확정 — `$CLAUDE_PLUGIN_ROOT` 는 미설정, `$PATH` 주입된 `<plugin-root>/bin` 역산이 실제 경로 해석 방법.
- `.claude/` 빈 디렉터리 · `@import` 누락은 silently ignore 확인.
- 관찰 결과에 따라 4 개 fix 커밋 (`db2562b`·`2978fa6`·`057f931`·`37bd0a4`) 을 릴리즈 전 머지.

### Known Limitations (v0.1.1 에서 해소 예정)

- Windows PowerShell 환경의 `date -u` fallback (NEW-42).
- 루트 판단 실패 시 fallback (NEW-39).
- 프로젝트 이름 추출 엣지케이스 (NEW-40).
- `directory`-type marketplace 의 `installPath` 캐시 미생성 (NEW-44, 2026-04-23 관찰).
- repo 자체의 `.claude-plugin/marketplace.json` 미존재로 직접 `github:` 설치 불가 (NEW-45, 2026-04-23 관찰).

### Design 근거 (로컬 전용)
주 설계 문서 (`design/harness-boot-design-2.3.7.md`) 와 RFC·샘플·메모리 파일은 `.gitignore` 로 공개 레포에서 제외. 기여자는 별도 요청. 자동 생성되는 공개 산출물 (스키마 · 스킬 · 템플릿 · 골든) 만 트래킹.

---

[Unreleased]: https://github.com/qwerfunch/harness-boot/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.4.1
[0.4.0]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.4.0
[0.3.13]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.13
[0.3.12]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.12
[0.3.11]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.11
[0.3.10]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.10
[0.3.9]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.9
[0.3.8]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.8
[0.3.7]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.7
[0.3.6]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.3.6
[0.1.0]: https://github.com/qwerfunch/harness-boot/releases/tag/v0.1.0
