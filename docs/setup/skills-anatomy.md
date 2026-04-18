# Skills — Anthropic Agent Skills Format

> **Reference**: Skills follow the [Anthropic Agent Skills Specification](https://github.com/anthropics/skills).
> All generated skills must comply with this spec while embedding harness-specific sections (TDD Focus, Rationalizations, Red Flags).

## Skill Directory Structure

Each skill is a self-contained directory. The directory name **must match** the `name` field in SKILL.md.

```
skill-name/
├── SKILL.md                  # Required: YAML frontmatter + Markdown instructions
├── references/               # Optional: create ONLY if SKILL.md exceeds ~500 lines
│   └── <name>.md            #   Name freely (e.g., examples.md, edge-cases.md)
├── scripts/                  # Optional: executable code (Python, Bash, JavaScript)
│   └── validate.sh          #   Helper scripts referenced from SKILL.md
└── assets/                   # Optional: static resources (templates, data files)
```

> Only create a subdirectory when it holds actual content. An empty `references/` that SKILL.md links to (e.g., `[details](references/foo.md)`) becomes a broken link — omit the link instead.

## YAML Frontmatter Schema

```yaml
---
# ── Required Fields ──────────────────────────────────────────────
name: skill-name
  # 1-64 chars. Lowercase a-z, numbers, hyphens only.
  # No leading/trailing hyphens, no consecutive hyphens.
  # MUST match the parent directory name.
  # Valid:   new-feature, bug-fix, api-endpoint
  # Invalid: New-Feature, -bug-fix, api--endpoint

description: >
  {WHAT the skill does}. {WHEN to use it — specific trigger keywords}.
  TRIGGER when: {activation conditions}.
  DO NOT TRIGGER when: {exclusion conditions}.
  # Max 1024 chars. Must include both WHAT + WHEN.
  # The description is the primary activation mechanism — agents decide
  # whether to load the skill based on this field alone.

# ── Optional per Anthropic spec ──────────────────────────────────
license: "Proprietary"
  # License name or reference to bundled LICENSE file.

compatibility: "Requires {tech stack from environment.md}"
  # Max 500 chars. Environment requirements, system packages,
  # language versions, network access needs.

# ── Optional per Anthropic spec, REQUIRED for harness skills ─────
metadata:
  author: "harness-boot"
  version: "1.0"
  category: "{skill category}"
  harness-section: "tdd|workflow|infrastructure"
  # Arbitrary key-value pairs (string → string).
  # Use for organization, filtering, and versioning.
  # Harness requires at minimum: author, version, category.

allowed-tools: "Read Glob Grep Write Edit Bash"
  # Space-separated string of pre-approved tools.
  # Restricts which tools the skill may use.
  # Pattern: ToolName or ToolName(glob:pattern)
  # Example: "Bash(npm:*) Bash(git:*) Read Write Edit"
  # Harness requires this field to align with security gate.
---
```

## SKILL.md Body — 7-Section Anatomy

The Markdown body merges Anthropic's recommended structure with harness-specific requirements.
All 7 sections are mandatory for harness skills.

```markdown
---
name: {skill-name}                    # Must match directory name
description: >                        # See Description Writing Guide below
  {WHAT the skill does}.
  TRIGGER when: {conditions}.
  DO NOT TRIGGER when: {exclusions}.
metadata:                             # Required for harness skills
  author: harness-boot
  version: "1.0"
  category: "{category}"
allowed-tools: "{tool list}"          # Required for harness skills
---
# {Skill Display Name}

## Overview
{1-2 sentences: what this skill accomplishes and its role in the harness workflow.}

## When to Use
- **Trigger**: {specific activation conditions — keywords, file patterns, task types}
- **Not when**: {explicit exclusion conditions to prevent false activation}
- **Related skills**: {skills that complement or conflict with this one}

## TDD Focus
- **Must test**: {what functions/behaviors require tests under this skill}
- **Test exempt**: {what is explicitly excluded from testing requirements}
- **Coverage target**: {specific coverage criteria for tdd_focus functions}

## Process
### Step 1: {Verb phrase — e.g., "Analyze the change request"}
{Specific instructions at "run npm test" level of detail.}

### Step 2: {Verb phrase}
{Instructions. If — and only if — this skill ships a `references/<file>.md`, link it here:}
{e.g., "See [detailed examples](references/examples.md) for edge cases."}
{Otherwise delete this line rather than emit a broken link.}

### Step N: {Verb phrase}
{Final step — typically verification and commit.}

## Common Rationalizations
| Excuse | Rebuttal |
|--------|----------|
| "{tempting shortcut 1}" | {specific, compelling counter-argument} |
| "{tempting shortcut 2}" | {specific, compelling counter-argument} |

> Minimum 2 rows required (add more only when genuine excuses exist; do not pad with generic filler). Each rebuttal must be specific to THIS skill's domain.
> Use the "I know you'll say X. But you're wrong because Y" framing.
> When generating rebuttals, reference specific domain rules and invariants from
> `.claude/domain-persona.md` to make rebuttals concrete and project-specific.

## Red Flags
- {Observable sign that this skill's process is being violated — minimum 2 items}
- {Another sign — agents and reviewers check for these}

## Verification
- [ ] {Verify with evidence — specify evidence type: logs/diff/reports/coverage}
- [ ] feature-list.json `passes: true` for this feature
- [ ] PROGRESS.md updated with iteration metrics
- [ ] Code-doc sync mapping targets updated
```

## Progressive Disclosure (3-Tier Token Budget)

Skills follow a progressive disclosure model to minimize context consumption:

| Tier | Content | Token Budget | When Loaded |
|------|---------|-------------|-------------|
| **Metadata** | `name` + `description` fields | ~100 tokens | Always (skill discovery) |
| **Instructions** | Full SKILL.md body | < 5,000 tokens (~500 lines max) | When skill activates (trigger match) |
| **Resources** | `references/`, `scripts/`, `assets/` | On-demand | Only when explicitly referenced in instructions |

**Rules**:
- SKILL.md body must stay under 500 lines. Move detailed content to `references/` subdirectory.
- Inline code blocks within SKILL.md: 50 lines max. Move longer code to `scripts/`.
- Reference supplementary files with relative paths **only when the file actually exists**: `See [details](references/<file>.md)`. Do not emit the link for a non-existent file.
- Delete any section that doesn't change agent behavior — no padding.

## Description Writing Guide

The `description` field is the **single most important field** — it determines whether the skill activates.

**Good description** (specific triggers, clear boundaries):
```yaml
description: >
  Guides bug reproduction and fix workflow with mandatory reproduction test
  before any code changes. Ensures root cause analysis and regression prevention.
  TRIGGER when: user says "bug", "fix", "broken", "regression", or debugger
  agent identifies a failing test requiring a targeted fix.
  DO NOT TRIGGER when: user says "new feature", "refactor", or when adding
  new behavior rather than correcting existing behavior.
```

**Bad description** (vague, no boundaries):
```yaml
description: "Helps with bugs."
```

## Skill List

| Skill | Directory | Triggers | TDD Focus | Key Rationalization Defense |
|-------|-----------|----------|-----------|---------------------------|
| `new-feature` | `new-feature/SKILL.md` | "new feature", "implement", "add" | Business logic, input validation | "I'll build it all at once" → incrementally |
| `bug-fix` | `bug-fix/SKILL.md` | "bug", "fix", "broken" | Reproduction test required | "I know the cause, just fix it" → reproduction test first |
| `refactor` | `refactor/SKILL.md` | "refactor", "restructure", "clean up" | 100% existing test preservation | "Behavior unchanged, tests unnecessary" → tests are the proof |
| `tdd-workflow` | `tdd-workflow/SKILL.md` | "TDD", "test first", "red green" | Full TDD cycle | "Too simple for tests" → tests serve as specs |
| `api-endpoint` | `api-endpoint/SKILL.md` | "API", "endpoint", "route" | Request/response validation | "Internal API, docs unnecessary" → next agent needs them |
| `db-migration` | `db-migration/SKILL.md` | "migration", "schema change" | Data integrity, down-migration | "Rollback won't be needed" → always needed |
| `deployment` | `deployment/SKILL.md` | "deploy", "release", "ship" | Full test suite pass | "Worked in staging" → environment differences |
| `context-engineering` | `context-engineering/SKILL.md` | Session start, task switch, context overload | N/A | "I'll read all files" → read only what's needed |

### Project-Type Skill Adaptation

The 8 skill directory names are **canonical identifiers** and must not be renamed (tooling compatibility). During `/setup` Phase 4, adapt each skill's **description, triggers, and internal content** based on the project type:

| Canonical Skill | Web API Project | Game / Canvas Project | CLI Project |
|----------------|-----------------|----------------------|-------------|
| `api-endpoint` | REST/GraphQL endpoint patterns | Canvas/Physics API wrappers, module interface patterns | Command handler, CLI flag patterns |
| `db-migration` | Database schema migration | localStorage/IndexedDB schema migration | Config file migration |
| `deployment` | Cloud deployment (AWS/GCP/Vercel) | Static hosting, CDN, GitHub Pages | Package publishing (npm/PyPI/crates.io) |

Skills not in this table (`new-feature`, `bug-fix`, `refactor`, `tdd-workflow`, `context-engineering`) are domain-agnostic and need no adaptation.

**Adaptation rules for `/setup` Phase 4**:
1. Determine project type from tech stack and plan content (web API, game, CLI, library, etc.)
2. Rewrite the skill's `description` field TRIGGER/DO NOT TRIGGER patterns to match the project domain
3. Update the skill's internal examples and workflow steps for the project context
4. Keep the `name` field (directory name) unchanged

## Complete Skill Example

```markdown
---
name: new-feature
description: >
  Guides implementation of new features using TDD workflow with incremental
  delivery. Handles feature decomposition, acceptance criteria mapping, and
  tdd_focus function identification.
  TRIGGER when: user says "new feature", "implement", "add functionality",
  or orchestrator assigns a new feature from feature-list.json.
  DO NOT TRIGGER when: user says "fix", "bug", "refactor", or when modifying
  existing behavior without new acceptance criteria.
metadata:
  author: harness-boot
  version: "1.0"
  category: development
allowed-tools: "Read Glob Grep Write Edit Bash"
---
# New Feature

## Overview
Orchestrates new feature implementation through the TDD cycle (Red → Green →
Refactor) with incremental delivery and mandatory code-doc synchronization.

## When to Use
- **Trigger**: Orchestrator selects a `passes: false` feature from feature-list.json,
  or user explicitly requests implementing a new feature
- **Not when**: Fixing bugs (use `bug-fix`), restructuring existing code (use `refactor`),
  or modifying existing behavior without new acceptance criteria
- **Related skills**: `tdd-workflow` (subprocess), `api-endpoint` (if feature includes API)

## TDD Focus
- **Must test**: All functions listed in the feature's `tdd_focus` array —
  happy path, boundary conditions, error cases
- **Test exempt**: Config files, static assets, type definitions (unless they
  contain validation logic)
- **Coverage target**: >= 70% line coverage for `tdd_focus` functions; no regression
  on overall project coverage

## Process
### Step 1: Load feature context
Read the feature entry from feature-list.json. Extract `acceptance_test`,
`tdd_focus`, and `doc_sync` targets.

### Step 2: Decompose into increments
Split the feature into testable increments. Each increment maps to 1-3
`tdd_focus` functions. Order by dependency (foundational logic first).

### Step 3: Run TDD cycle per increment
For each increment, invoke the TDD sub-agents in sequence:
1. **Red** (tdd-test-writer): Write failing tests from interfaces only
2. **Green** (tdd-implementer): Write minimal code to pass tests
3. **Refactor** (tdd-refactorer): Improve without behavior changes
Max 5 iterations per increment. Escalate if exceeded.

### Step 4: Verify acceptance criteria
Run all acceptance tests. Each `acceptance_test` item must have a
corresponding passing test.

### Step 5: Code-doc sync
Update all files listed in the feature's `doc_sync` array.
Reviewer agent verifies doc-sync at Gate 2; the pre-commit doc-sync hook
blocks the commit when exports changed without the mapped docs staged.

### Step 6: Single commit
Stage code + tests + docs together. Commit message references feature ID.
Verify rollback capability: `git revert <sha>` must cleanly undo.

## Common Rationalizations
| Excuse | Rebuttal |
|--------|----------|
| "I'll build the entire feature at once, then add tests" | Incremental TDD catches integration issues early. Batch implementation hides bugs in complexity. |
| "This helper function is too simple to test" | If it's in `tdd_focus`, it gets tests. Simple functions have edge cases (null, empty, overflow). |
| "I'll update the docs after I finish coding" | The pre-tool hook blocks commits with missing doc updates. Do it now or you can't commit. |
| "The acceptance criteria are obvious, I don't need to check them" | Obvious criteria are the easiest to verify. Skip verification and the reviewer will reject at Gate 2. |

## Red Flags
- Implementation code written before any test files exist (TDD violation)
- Feature commit contains only code changes without corresponding doc updates
- Multiple `tdd_focus` functions implemented in a single Green phase (over-implementation)

## Verification
- [ ] All `tdd_focus` functions have tests with happy/boundary/error cases (evidence: test file list)
- [ ] All `acceptance_test` items pass (evidence: test runner output)
- [ ] `doc_sync` targets updated (evidence: git diff showing doc changes)
- [ ] Coverage: >= 70% line on `tdd_focus`, no regression overall (evidence: coverage report)
- [ ] feature-list.json `passes: true`
- [ ] PROGRESS.md updated with `iteration_count` and `duration`
```

## Skill Generation Validation Checklist <!-- anchor: validation-checklist -->

During `/setup` Phase 4, validate each generated skill against:

| # | Check | Criterion |
|---|-------|-----------|
| 1 | **Directory name** | Matches `name` field, lowercase a-z/numbers/hyphens only |
| 2 | **File name** | `SKILL.md` (uppercase) |
| 3 | **name field** | 1-64 chars, valid characters, no leading/trailing/consecutive hyphens |
| 4 | **description field** | 1-1024 chars, includes WHAT + WHEN + TRIGGER + DO NOT TRIGGER |
| 5 | **Body sections** | All 7 sections present: Overview, When to Use, TDD Focus, Process, Common Rationalizations, Red Flags, Verification |
| 6 | **Rationalizations** | >= 2 rows, each rebuttal is specific to the skill's domain. No upper limit — add more when genuine excuses exist. |
| 7 | **Red Flags** | >= 2 items |
| 8 | **Verification** | Includes evidence types (logs/diff/reports/coverage) |
| 9 | **Line count** | SKILL.md <= 500 lines |
| 10 | **File references** | Relative paths from skill root, referenced files exist |
