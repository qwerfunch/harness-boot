---
description: Install the harness-boot plugin into the current project — scaffold .harness/ + wire CLAUDE.md. Run once per project. Enter via natural language or a 3-option menu.
allowed-tools: [Read, Write, Edit, Bash, Glob]
argument-hint: "[free-text intent or empty (menu)]  # e.g. build something like Twitter · quick prototype · I have a plan.md"
---

# /harness-boot:init — install the harness (v0.9)

This command **scaffolds harness-boot into the current working directory**.
Run it **once in a project's lifetime**.

For unfamiliar terms (Walking Skeleton, Iron Law, drift, gate, kickoff, …),
see [`docs/glossary/BRAND_TERMS.md`](../docs/glossary/BRAND_TERMS.md).

## Two ways to start

**A · Free text (preferred)**

```
/harness-boot:init pomodoro timer for solo musicians practicing
/harness-boot:init build something like Twitter
/harness-boot:init quick prototype, throwaway
/harness-boot:init start from this plan.md
/harness-boot:init apply to my existing codebase
```

Claude reads the prompt, **routes it to one of three options**, and injects
the right hints. Routing is shown to you as a plan → confirm Y/n → proceed.

### Free-text routing rules

| What you said | Route |
|---|---|
| Plain idea | Option 1 (idea-first) |
| "like X" / "similar to Y" / reference product | Option 1 + reference context |
| "quick" / "rough" / "prototype" / "experiment" | Option 1 + `project.mode: prototype` hint |
| "real" / "long-term" / "production" | Option 1 + `project.mode: product` (default) noted |
| "plan.md" / "spec doc" / "requirements" | Option 2 |
| "existing code" / "already have" / "brownfield" | Option 3 |
| Ambiguous / unclear | Fall back to the 3-option menu |

**Plan disclosure example**:

```
You: /harness-boot:init build something like Twitter

Claude reads:
  • idea present + reference product (Twitter)
  • → Option 1 (idea-first) + reference context injected

Plan:
  1. scaffold .harness/
  2. brief researcher with "Twitter as reference · MVP-scoped"
  3. background research → roadmap → first feature

Does this match what you want?
  Y = proceed as-is
  n = let me clarify
  any other text = re-interpret
```

**B · Empty call → 3-option menu (fallback)**

When `/harness-boot:init` is invoked with no arguments, or the routing is
ambiguous:

```
🚀 Starting harness-boot in this project for the first time.

Where are you?

  1) I just have an idea
     → plan with me, conversational

  2) I already have a planning document
     → fast-path the design from the doc

  3) I have an existing codebase
     → reconcile current state, then plan forward

  0) Not sure which fits
     → short summary of each option
```

## Preamble (top 3 lines of every output)

> Spec: see [`docs/preamble-spec.md`](../docs/preamble-spec.md) — the
> single source of truth for the convention. The block below is this
> command's instance.

```
🧰 /harness-boot:init · <mode=solo|team> · <5–10 word reason>
NO skip: §0-2 checks for an existing .harness/spec.yaml — never overwrite on re-run
NO shortcut: §5 must append a harness_initialized event to events.log
```

**Line 1**: emoji · command · mode · short reason.
**Lines 2-3 (Anti-rationalization, BR-014)**: declare the two constraints
this command cannot bypass. Blocks the LLM from quietly skipping with an
"already done" excuse.

Example: `🧰 /harness-boot:init · solo · first-time scaffold into empty dir`

## Steps

### 0. Pre-flight — detect existing install

1. Run `Bash: pwd` to confirm the working directory.
2. Run `Bash: ls package.json pyproject.toml Cargo.toml .git 2>/dev/null` to
   collect any of the four root signals — **informational only**. Don't
   abort based on the result; the user invoked `/harness-boot:init`
   explicitly, so install intent is assumed.
   - At least one signal: prepend `project signals: <files>` to the "mode"
     line of the final report.
   - None: append a one-line tip to the final report — `Tip: 'git init' is
     recommended to initialize the repo.` Don't block; continue.
3. Run `Glob: .harness/**` to detect a prior install.
   - If `.harness/spec.yaml` already exists, **print a warning and stop**:
     "harness is already installed. Edit `.harness/spec.yaml` directly. Use
     `/harness-boot:work` for the lifecycle (v0.2+)."
4. Parse the argument string: `--team` flips `mode=team` (adds `state.yaml`
   to `.gitignore`); `--solo` or no flag means `mode=solo` (state.yaml
   stays committed). Unknown flags get ignored, with a `unknown argument: X`
   note in the final report.

### 0.5. Runtime prerequisite — Node.js 20+ (F-107)

The plugin ships a single-file CLI bundle under `dist/cli/` and a
shim at `bin/harness`. Both rely on Node.js 20 or newer. v0.13 made
the TS layer the only operational surface — no Python fallback. The
`bin/` directory is auto-added to PATH by Claude Code, so calls
look like `harness work F-N` without absolute paths.

**Detection** — run this `Bash` block once:

```bash
node --version 2>/dev/null | awk -F. '{ split($1, v, "v"); if (v[2] >= 20) print "node: ok"; else print "node: too_old" }' \
  || echo "node: missing"
```

Branch on the output:

- **`node: ok`** — continue to §1.
- **`node: missing`** — print:

  > harness-boot needs Node.js 20 or newer. Install via your package
  > manager or [nodejs.org](https://nodejs.org/) and re-run
  > `/harness-boot:init`.

  Then **stop** — there is no degraded mode. Append a single
  `prereq_check` event later in §5 with `status: "node_missing"`.
- **`node: too_old`** — print the upgrade hint with the same shape
  and stop. Append `prereq_check` with `status: "node_too_old"`.

**Event format** — once `.harness/events.log` exists (after §1 + §5):

```json
{"ts":"<ISO8601>","type":"prereq_check","status":"<ok|node_missing|node_too_old>"}
```

### 1. Create directories

Via `Bash`:

```
mkdir -p .harness .harness/hooks .harness/protocols .harness/_workspace/handoff
mkdir -p .claude/agents .claude/skills
```

### 2. Copy starter templates or seed from brownfield (3 files; CLAUDE.md is §3)

> **Options 1 · 2** → straight starter-template copy (default flow below).
> **Option 3** → run §2.A (brownfield seed) first. Only `spec.yaml` differs;
> `harness.yaml` and `state.yaml` still copy as in §2.

Read from the plugin repo's `docs/templates/starter/` and **write into the
user project**.

**Plugin-root path resolution** (Claude Code 2.1.x — see NEW-37 / NEW-44):

Claude tries the strategies below in order and uses the **first that
returns a real path**:

**Strategy A — `$PATH` reverse lookup** (most reliable):
```bash
echo "$PATH" | tr ':' '\n' | grep -E '/plugins/.*/bin$' | while IFS= read -r bin_dir; do
  root="${bin_dir%/bin}"
  manifest="$root/.claude-plugin/plugin.json"
  [ -r "$manifest" ] || continue
  name=$(jq -r '.name // empty' "$manifest" 2>/dev/null)
  if [ "$name" = "harness" ]; then
    printf '%s\n' "$root"; exit 0
  fi
done
```

**Strategy B — registry `installPath`**:
```bash
jq -r '.plugins | to_entries[] | select(.key | startswith("harness@")) | .value[0].installPath // empty' \
  ~/.claude/plugins/installed_plugins.json
```
→ Only use the result when the path actually exists (`[ -d "$path" ]`).

**Strategy C — marketplace `source.path` fallback** (NEW-44, directory-type
only):
- Read `extraKnownMarketplaces[<marketplace>].source.path` from `~/.claude/settings.json`.
- Read `.claude-plugin/marketplace.json` at that path; resolve
  `plugins[] | select(.name == "harness") | .source` against the marketplace
  root.
- Expand `~` to `$HOME`; resolve symlinks with `realpath`.

**Strategy D — prompt the user** (last resort):
"Enter the plugin root path (e.g. `~/Developer/harness-boot`):"

**Heads-up on env vars**: `$CLAUDE_PLUGIN_ROOT` is **not set** in CC 2.1.x
(confirmed by the first-run smoke on 2026-04-23). Don't depend on it.

Template mapping (the 3 files §2 handles):

| Source (in plugin) | Destination (in user project) |
|---|---|
| `docs/templates/starter/spec.yaml.template` | `.harness/spec.yaml` |
| `docs/templates/starter/harness.yaml.template` | `.harness/harness.yaml` |
| `docs/templates/starter/state.yaml.template` | `.harness/state.yaml` |

For each file:
1. `Read` the template from the plugin.
2. `Write` it to the destination (no content modifications).

`CLAUDE.md` has merge logic and is owned by §3.

### 2.5. Optional files — `.gitignore` + `conftest.py` (v0.8.9)

**`.gitignore`** — project root. Ignores derivatives inside `.harness/`
(events.log · state.yaml · harness.yaml · domain.md · architecture.yaml ·
_workspace/) and rotated `events.log.YYYYMM*`. Without these entries,
`/harness-boot:work --run-gate gate_4` fails every time on a dirty working
tree — the gap caught by the v0.8.6 e2e smoke.

- Target: project root `.gitignore`
- Source: `docs/templates/starter/.gitignore.template`
- If `.gitignore` already exists, **append-merge** (skip duplicate lines;
  delimit with the section header `# harness-boot —`). On a fresh repo,
  copy the whole template.

**`conftest.py`** — Python projects only. Handles pytest collection in
`src/<pkg>/` layouts and PYTHONPATH propagation for subprocess smokes.
Skip on Node/other runtimes.

- Target: project root `conftest.py`
- Source: `docs/templates/starter/conftest.py.template`
- If `conftest.py` already exists, **prompt the user and let them merge
  manually** (no automatic merge — pytest config is project-sensitive).
- Skip projects without a `src/` directory (flat layouts don't need it).

**`tsconfig.json`** — TypeScript projects, recommended values for
reference (no auto-copy). cosmic-suika I-003 return (v0.10.7): the first
external npm/TS dogfood hit typecheck friction (`@types/node` missing +
`*.ts` import collision); this template captures the resolution.

- Target: **not auto-copied**. The final report just points to it.
- Source: `docs/templates/starter/tsconfig.json.template` (recommended
  values + comments)
- If a TS project is detected (via `package.json scripts.typecheck` or an
  existing `tsconfig.json`), append a one-line tip to the final report:
  `Tip: TS project detected — see docs/templates/starter/tsconfig.json.template
  for recommended values (allowImportingTsExtensions · noEmit · types).`

Skipping this section is fine; copy manually later. Light modes like
`/harness-boot:init --solo` skip it by default.

### 2.A. (Option 3 only) Brownfield repo recon + seed (F-036)

Run this section **only when routing landed on Option 3**. It **replaces
the spec.yaml step in §2**; `harness.yaml` and `state.yaml` still copy as
in §2.

**Pre-check — manifest signals**:
- If §0 collected **zero** project signals (`package.json` ·
  `pyproject.toml` · `Cargo.toml` · `go.mod`), brownfield recon doesn't
  apply. Auto-fall-back to Option 1 (straight starter copy) and tell the
  user: `No manifest detected — skipping brownfield recon, using the
  empty skeleton.`

**Status (F-107):** the deterministic seed runner has not been
ported to the TS CLI yet. Until `harness scan-seed` ships, **fall
back to Option 1** (straight starter-template copy) and surface a
note to the user:

> Brownfield auto-seed is queued for a follow-up release. Using the
> empty skeleton for now — fill `project` / `constraints.tech_stack`
> / `domain.entities[]` from the manifest manually, or run
> `/harness-boot:work F-0` to start the Walking Skeleton cycle and
> let the orchestrator drive the recon as a feature.

The Walking Skeleton cycle (`/harness-boot:work F-0`) plus the
researcher → product-planner agents reach the same end state — a
populated spec.yaml — without any Python dependency.

**6. Extra event in §5 events.log** (one line):
```json
{"ts":"<ISO8601>","type":"brownfield_seeded","layer":"A","mode":"<Y|D|S|E>","entities_seeded":<N>,"draft":true}
```

**Anti-rationalization (BR-014)**: Option 3 doesn't bypass §0's existing
`.harness/spec.yaml` guard — already-installed projects stop in §0.
Option 3 only fires on first init.

### 3. Generate or merge CLAUDE.md

**New-file case** (no CLAUDE.md at the project root):
1. `Read` `docs/templates/starter/CLAUDE.md.template` from the plugin.
2. Replace `{{PROJECT_NAME}}` with the real project name. Use the **first
   valid value** below (valid = non-empty, non-whitespace string):
   - `package.json` `name` (when present + valid)
   - `pyproject.toml` `[project].name` (when present + valid)
   - `pyproject.toml` `[tool.poetry].name` (when present + valid)
   - Current directory basename (`basename "$PWD"`) — skip if it's `.`,
     contains whitespace, or is empty
   - All else fails → prompt: "Enter a project name (kebab-case
     recommended):"

   Then **normalize to kebab-case**:
   - whitespace · `_` · `.` → `-`
   - collapse repeated `-` to a single `-`
   - strip leading/trailing `-`
   - lowercase
   - if the normalized result is empty, fall back to a user prompt
3. `Write` the result to `CLAUDE.md`.

**Existing-file case**: append the following line to the end (skip if
already present):

```
@.harness/spec.yaml
```

Then append a section:

```
## harness-boot

This project is managed by the harness-boot plugin. Use
`/harness-boot:work` to edit the product description.
```

### 4. .gitignore wiring

1. If `.gitignore` doesn't exist, `Write` it.
2. Append the entries below if missing (separated by a blank line):

```
# harness-boot
.harness/_workspace/
.harness/events.log
.harness.tmp/
.harness.backup/
```

3. With the `--team` flag, also append:

```
.harness/state.yaml
```

### 5. Initial event log

Write `.harness/events.log` **fresh** (JSON Lines, one line):

```json
{"ts":"<ISO8601 UTC>","type":"harness_initialized","plugin_version":"0.1.0","mode":"<team|solo>"}
```

Get the timestamp (UTC ISO8601) by trying these in order — **first one
that works** wins:

1. `Bash: date -u +%Y-%m-%dT%H:%M:%SZ` (POSIX `date` — macOS · Linux ·
   Git Bash on Windows).
2. On failure: `Bash: node -e 'console.log(new Date().toISOString().replace(/\.\d{3}Z$/, "Z"))'`
   (when Python 3 is installed).
3. On failure: `Bash: node -e 'console.log(new Date().toISOString().replace(/\.\d{3}Z$/, "Z"))'`
   (when Node is installed).
4. All failed → prompt the user for the current UTC timestamp in
   `YYYY-MM-DDTHH:MM:SSZ` form.

Read `plugin_version` dynamically from `.claude-plugin/plugin.json`'s
`version` field; fall back to the hardcoded `"0.1.0"` on failure.

### 5.5. Initial sync (best-effort, F-076)

Right after the `harness_initialized` event lands in events.log, fire one
best-effort sync against the freshly written `.harness/` so the derived
views (`domain.md`, `architecture.yaml`) are materialized when the spec
is ready, and so `harness.yaml.generation.generated_from.spec_hash` is
populated. This eliminates the post-install stutter where the very first
`/harness-boot:work` cycle had to fire sync before kickoff bullets could
reference `domain.md`.

```bash
harness sync --harness-dir "$(pwd)/.harness" --soft
```

The `--soft` flag delegates to `sync.try_initial_sync(harness_dir)`,
which is fail-open by design: stub specs from menu options 1 / 2 fail
schema validation and `--soft` prints `sync (initial): fail — <reason>`
and **still exits 0**. Option 3 (brownfield) and `spec-conversion`
output rich specs that succeed and print `sync (initial): ok — synced`.
Either way, init never aborts because of an unsynced spec — the F-075
autowire inside `scripts/work.py:activate()` retries on the first work
cycle as the inner safety net.

### 6. Final report (user-facing)

Print the summary below **once**:

```
✅ harness-boot installed (v0.1.0)

Files created:
  .harness/spec.yaml          ← the only file you'll edit
  .harness/harness.yaml       ← tool config
  .harness/state.yaml         ← progress state
  .harness/events.log         ← event stream
  CLAUDE.md                   ← Claude session context (imports spec.yaml)
  .gitignore                  ← merged

What's next (v0.1.0 — /harness-boot:work etc. land in v0.2+):
  1. Edit `.harness/spec.yaml` directly. See `docs/samples/` for examples.
     If you already have a `plan.md`, activate skills/spec-conversion and
     ask: "convert this plan.md into spec.yaml".
  2. Restart the session after editing — CLAUDE.md's @ import will load
     the new spec.

Docs: https://github.com/qwerfunch/harness-boot
v0.2 roadmap: /harness-boot:work (derive · build · drift)
```

## Failure conditions (fail-fast)

- No write permission → ask the user to fix permissions, then stop.
- `.harness/spec.yaml` already exists → §0-2 warning + stop.
- Starter-template `Read` fails (plugin path not resolvable) → ask the
  user to confirm install, then prompt for the path manually.

## v0.1.0 scope limit

This minimal release **only creates files**. Below are **not yet
implemented — v0.2+**:

- Calling `scripts/hash-fixtures.mjs` to compute the initial spec hash
- Auto-generating `.claude/settings.json` + `.claude/agents/*.md` +
  `.claude/skills/*.md`
- Auto-copying `.harness/hooks/*.mjs`
- Six core hooks (security-gate, doc-sync-check, coverage-gate, format,
  test-runner, session-start-bootstrap)

In v0.1.0 you fill in `spec.yaml` by hand, then drive forward with
`/harness-boot:work`. An empty `.claude/` won't make Claude Code complain.

## Issue logging — harness-boot improvement feedback loop (F-027)

While running this command, if you spot **friction in the harness-boot
plugin itself** (awkward UX · broken command · confusing guidance ·
stale docs · dead reference · missing automation · sudden block),
append **one entry per friction** to
`.harness/_workspace/issues-log.md`. When you share the file with the
maintainer it triggers the next plugin release (cosmic-suika
I-001/I-008/I-010 → v0.10.x return is the precedent).

If `.harness/_workspace/issues-log.md` doesn't exist, create it with a
short header (`# harness-boot ISSUES-LOG — <project name>`) once.

**Entry template (markdown, append-only)**:

```markdown
## YYYY-MM-DDTHH:MM:SSZ — <one-line title>
- **Source**: /harness-boot:init
- **Category**: ergonomics | bug | missing-feature | dead-reference | docs-stale
- **Severity**: blocker | annoying | trivial
- **What happened**: <1–3 lines — what Claude saw>
- **Suggested fix**: <optional — one line if it's obvious>
```

**When not to log**: actual user-code or user-spec problems (the user
fixes those) · plain typos · general Claude Code questions unrelated to
harness-boot. When in doubt, write a one-liner with `Severity=trivial`.

**NO skip**: this section is fail-open (a logging error doesn't block
the command), but **if Claude saw friction and didn't write it down**,
the next user hits the same friction — discipline.

---

## User language (F-040)

Plugin output auto-matches the user's language by this priority order:

1. `HARNESS_LANG` env (`ko` or `en`) — explicit override
2. `.harness/spec.yaml` `project.language` (`ko` / `en` / `auto`)
3. System locale (`LC_ALL` or `LANG` matching `ko_KR` → Korean)
4. English fallback (protects English-speaking adopters)

Right after install the default is English. Add `project.language: ko`
to the starter `spec.yaml` and the project speaks Korean from then on.
Friendly explanations for jargon (Walking Skeleton / Iron Law / drift /
kickoff / …) live in
[`docs/glossary/BRAND_TERMS.md`](../docs/glossary/BRAND_TERMS.md).
