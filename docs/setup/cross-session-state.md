# Cross-Session State Management

## Initializer Mode (First Session)
Auto-detected when PROGRESS.md doesn't exist or is empty:

### Checkpoint / Resume
If `/setup` is interrupted mid-phase, PROGRESS.md records `last_completed_phase: N`. On re-running `/setup`, the system **auto-resumes from Phase N+1** without prompting (when `N ∈ {1..5}`). A prompt is shown only when the existing state is ambiguous — `setup_complete` (ask Exit vs Overwrite) or a missing/corrupt `last_completed_phase` value.

1. Load detailed plan MD → **confirm tech stack** (see rules below) → **assess architecture pattern** (see rules below)
2. Generate feature-list.json (all features `passes: false`)
3. Create initial PROGRESS.md
4. Environment validation + dependency installation run inline as part of Phase 1 infrastructure generation (no separate bootstrap script)
5. First commit → switch to Coding Mode

## Tech Stack Decision Rules

| Priority | Condition | Action |
|----------|-----------|--------|
| **1st** | Language/framework specified in the plan | Adopt as-is. Reflect in CLAUDE.md + environment.md. |
| **2nd** | Not specified in the plan | Analyze project requirements → **present 2-3 recommendations**. Proceed after developer selects. |

Recommendation criteria for 2nd priority:
- Ecosystem fit for project type (web/mobile/CLI/data, etc.)
- Team size, maintainability, community maturity
- Fit with the plan's feature requirements (real-time → WebSocket support, high-volume → streaming, etc.)
- Include pros/cons and rationale for each recommendation

```
## Tech Stack Recommendations (when not specified in the plan)

Project requirements analysis:
- {key requirements summary}

### Option A: {e.g., Next.js + TypeScript + Prisma}
- Pros: {reasons}
- Cons: {reasons}
- Fit: {why it suits this project}

### Option B: {e.g., FastAPI + Python + SQLAlchemy}
- Pros: {reasons}
- Cons: {reasons}
- Fit: {why it suits this project}

→ Wait for developer selection, then reflect in CLAUDE.md + environment.md and proceed.
```

> **Never auto-select without developer confirmation.** Tech stack decisions affect the entire project and must be made by the developer.

## Language Settings <!-- anchor: language-settings -->

Four language scopes, each with an explicit rule:

- **Machine-facing file language: always English.** Files parsed programmatically, loaded into LLM context at session start, or executable code — `CLAUDE.md`, `PROGRESS.md`, `feature-list.json`, `.claude/**/*.md` (agents, skills, protocols, domain-persona, context-map, environment, security, quality-gates, error-recovery, observability), `hooks/*.sh`, `scripts/*.sh` — are written in English regardless of the user's locale. This is non-negotiable: locale variance here breaks hook parsing (e.g., `session-start-bootstrap.sh` awk/grep over PROGRESS.md) and introduces LLM comprehension friction on every session load. No locale detection, no `conversation_language` lookup for these files.
- **User-facing doc language: `conversation_language`**. `README.md` and `CHANGELOG.md` follow the user's locale. These files are humans-only — no hook parses them, no agent loads them for logic. During `/start`, when the orchestrator appends a feature-completion entry to `CHANGELOG.md` under `## [Unreleased]`, the human description text is written in `conversation_language`. Keep a Changelog structural headings (`## [Unreleased]`, `## [0.1.0]`, `### Added`, `### Changed`, `### Fixed`, `### Removed`) remain English as standard format markers per the Keep a Changelog spec.
- **Conversation language**: Auto-detected from the system locale (`$LANG` or equivalent). Controls the human-facing text that `/setup` and `/start` print to the user (spinner messages, question prompts, summaries, status updates) and the content of `README.md` / `CHANGELOG.md` description text. No question asked — recorded automatically in `environment.md` as `conversation_language`. Never affects machine-facing files.
- **Code comment language**: Explicitly chosen by the user during Step 1.2. Stored in `environment.md` as `comment_language`. Referenced by tdd-implementer, tdd-refactorer, and reviewer agents when enforcing Comment Rules (see `code-style.md#comment-rules`). All file headers, JSDoc, section dividers, and inline why-comments inside source files must be written in this language. Applies to *comments inside source code* only — never to any `.md` file.

## Tech Stack Storage

Once selected, the tech stack is recorded in exactly two places:
- `CLAUDE.md`: one-line summary (e.g., "Stack: Next.js 14 + TypeScript + Prisma + PostgreSQL")
- `.claude/environment.md`: full detail (versions, package manager, runtime requirements, dev dependencies, conversation_language, comment_language)

## .gitignore Generation (Phase 1)

Generate `.gitignore` based on the selected tech stack. Always include common patterns, then add language/framework-specific patterns.

**Common (all projects)**:
```gitignore
# Security
.env
.env.*
*.pem
*.key

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/settings.json
.vscode/launch.json
*.swp
*.swo
*~

# Harness intermediates
_workspace/*.md
_workspace/*.json
```

**Language/framework-specific patterns**:

| Stack | Additional patterns |
|-------|-------------------|
| Node/TypeScript | `node_modules/`, `dist/`, `build/`, `coverage/`, `*.tsbuildinfo`, `.turbo/` |
| Python | `__pycache__/`, `*.pyc`, `*.pyo`, `.venv/`, `venv/`, `.pytest_cache/`, `htmlcov/`, `*.egg-info/` |
| Go | `bin/`, `*.exe`, `vendor/` (if not vendoring) |
| Rust | `target/`, `Cargo.lock` (libraries only) |
| Java/Kotlin | `*.class`, `target/`, `.gradle/`, `build/`, `*.jar` (non-release) |
| Ruby | `.bundle/`, `vendor/bundle/`, `*.gem` |
| C/C++ | `*.o`, `*.so`, `*.dylib`, `build/`, `cmake-build-*/` |

Select patterns matching the tech stack chosen in Step 1.3. If the stack spans multiple categories (e.g., Node + Python), combine both.

## README.md Generation (Phase 2)

Generate `README.md` in `conversation_language` (per the "User-facing doc language" rule above — `README.md` is a Tier 2 user-facing file and follows the user's locale). Structure:

1. **Project title** — from plan MD title
2. **Description** — 2-3 sentences summarizing the project purpose (from plan)
3. **Tech Stack** — badges or list of technologies selected in Step 1.3
4. **Getting Started** — prerequisites, installation commands, run commands (derived from tech stack)
5. **Project Structure** — directory tree overview (condensed, key directories only)
6. **Development** — brief TDD workflow explanation, how to use `/start`
7. **License** — placeholder (`TODO: Add license`)

The README should be professional and specific to the project — not generic boilerplate. Extract real project details from the plan MD.

## Architecture Pattern Decision Rules

Architecture patterns (DDD, Clean Architecture, Hexagonal, etc.) provide structural guardrails for maintainability. They are recommended only when the project's scale and domain complexity justify the overhead.

### Skip Condition

If the plan explicitly states prototype, PoC, MVP, spike, or experimental purpose, **skip architecture selection entirely**. Use a Simple Flat structure and inform the developer:

> "Project identified as {prototype/PoC/MVP}. Proceeding without architecture pattern (Simple Flat structure)."

No further confirmation needed for skip — proceed directly.

### Scale Assessment

When the skip condition does not apply, evaluate three factors from the plan:

| Factor | Threshold | How to Measure |
|--------|-----------|----------------|
| Feature count | >= 8 features | Count items in feature-list.json draft |
| Domain categories | >= 3 distinct categories | Count unique `category` values in feature-list.json draft |
| Cross-cutting concerns | Present | Auth, payments, notifications, external integrations, event-driven flows |

- **2 or 3 factors met** → Recommend architecture pattern
- **0 or 1 factors met** → Default to Simple Layered structure, but ask developer if they want to adopt a pattern anyway

### Decision Rules

| Priority | Condition | Action |
|----------|-----------|--------|
| **0th** | Plan states prototype/PoC/MVP/spike | Skip architecture (Simple Flat). Inform developer. |
| **1st** | Architecture pattern specified in the plan | Adopt as-is. Reflect in CLAUDE.md + environment.md. |
| **2nd** | Scale assessment triggers recommendation | Analyze tech stack fit → **present 2-3 recommendations** with explanations. Proceed after developer selects. |
| **3rd** | Scale assessment does NOT trigger | Note "Simple Layered structure recommended." Ask developer to confirm or override. |

### Architecture Pattern Reference

Each recommendation must include a plain-language explanation so that non-developers can also make informed decisions.

| Pattern | What It Is (Plain Language) | Best For | Trade-offs |
|---------|---------------------------|----------|------------|
| **DDD (Domain-Driven Design)** | Organizes code around business concepts (e.g., "Order", "User", "Payment") rather than technical layers. Like organizing a company by business units rather than by job function. | Complex business logic with many rules, enterprise systems | Higher upfront design cost; requires deep domain understanding; overkill for simple CRUD |
| **Clean Architecture** | Separates code into concentric rings: core business logic in the center, external tools (DB, APIs) on the outside. Inner rings never depend on outer rings. Like building a house where the floor plan doesn't change even if you swap the plumbing. | Projects needing long-term maintainability, easy testing, and framework independence | More files and indirection; slower initial development; can feel over-engineered for small projects |
| **Hexagonal (Ports & Adapters)** | Core logic communicates with the outside world only through defined "ports" (interfaces). External systems plug in via "adapters". Like a universal power strip that works with any plug type. | Systems with many external integrations (APIs, databases, message queues) | Similar overhead to Clean Architecture; port/adapter boilerplate; best value with 3+ external systems |
| **Vertical Slice** | Each feature is a self-contained vertical slice through all layers (UI → logic → DB). Features are independent folders rather than shared layers. Like organizing a restaurant by dish (each chef handles their dish end-to-end) rather than by station. | Feature-rich applications where features rarely share logic; microservice-like structure in a monolith | Code duplication across slices; harder to share cross-cutting logic; less suitable for deep shared domains |
| **Simple Layered** | Traditional Controller → Service → Repository layers. Straightforward and widely understood. Like a factory assembly line — each station does one type of work. | Small-to-medium projects, CRUD-heavy apps, teams new to architecture patterns | Tends to create "God services" as project grows; tight coupling between layers; harder to test in isolation |

### Language/Framework Compatibility

| Pattern | Best Fit | Acceptable Fit | Poor Fit |
|---------|----------|----------------|----------|
| **DDD** | Java/Spring, C#/.NET, Kotlin | TypeScript/NestJS, Python/FastAPI | Go (lacks OOP), simple CRUD apps |
| **Clean Architecture** | Go, Java/Spring, TypeScript/NestJS | Python/FastAPI, C#/.NET | Rapid prototypes, small scripts |
| **Hexagonal** | Java/Spring, TypeScript/NestJS, Rust | Go, Python | Frontend-heavy apps |
| **Vertical Slice** | C#/.NET, TypeScript/NestJS | Java/Spring, Go | Projects with deep shared domain logic |
| **Simple Layered** | Any | Any | Large-scale domain-heavy projects |

### Recommendation Template

```
## Architecture Pattern Recommendations

Scale assessment:
- Feature count: {N} (threshold: 8)
- Domain categories: {N} (threshold: 3)
- Cross-cutting concerns: {list or "none detected"}
- Result: {recommend / simple layered default}

### Option A: {e.g., Clean Architecture}
- **What it is**: {plain-language explanation — 1-2 sentences}
- **Why it fits this project**: {specific reasons tied to the plan's features}
- **Pros**: {reasons}
- **Cons**: {reasons}
- **Fit with {tech stack}**: {compatibility assessment}
- **Directory structure impact**: {outline}

### Option B: {e.g., DDD with Hexagonal}
- **What it is**: {plain-language explanation — 1-2 sentences}
- **Why it fits this project**: {specific reasons tied to the plan's features}
- **Pros**: {reasons}
- **Cons**: {reasons}
- **Fit with {tech stack}**: {compatibility assessment}
- **Directory structure impact**: {outline}

→ Wait for developer selection, then reflect in CLAUDE.md + environment.md and proceed.
```

> **Never auto-select without developer confirmation.** Architecture pattern decisions affect the entire project structure and must be made by the developer.

### Architecture Pattern Storage

Once selected (or confirmed as "Simple Layered"), the architecture pattern is recorded alongside the tech stack:
- `CLAUDE.md`: appended to the stack summary line (e.g., "Stack: Next.js 14 + TypeScript + Prisma + PostgreSQL | Architecture: Clean Architecture")
- `.claude/environment.md`: dedicated section with pattern name, layer definitions, dependency rules, and directory-to-layer mapping

### environment.md Architecture Section Template

```markdown
## Architecture Pattern

**Pattern**: {Clean Architecture | DDD | Hexagonal | Vertical Slice | Simple Layered | Simple Flat (prototype)}

### Layer Definitions
| Layer | Responsibility | Allowed Dependencies |
|-------|---------------|---------------------|
| {e.g., Domain/Entities} | {description} | {none / only domain} |
| {e.g., Use Cases} | {description} | {Domain only} |
| {e.g., Interface Adapters} | {description} | {Use Cases, Domain} |
| {e.g., Infrastructure} | {description} | {all layers} |

### Dependency Rules
- {e.g., Dependencies flow inward only: Infrastructure → Adapters → Use Cases → Domain}
- {e.g., Domain layer has zero external imports}
- {e.g., Use Cases define port interfaces; Infrastructure implements them}

### Directory-to-Layer Mapping
| Directory | Layer | Notes |
|-----------|-------|-------|
| src/domain/ | Domain | Entities, value objects, domain events |
| src/usecases/ | Use Cases | Application services, port interfaces |
| src/adapters/ | Interface Adapters | Controllers, presenters, gateways |
| src/infrastructure/ | Infrastructure | DB, external APIs, frameworks |
```

## Coding Mode (Subsequent Sessions)
The SessionStart hook automatically provides a PROGRESS.md summary + incomplete feature count + git log.
The agent selects the next feature from feature-list.json → **works on only one at a time**.

## feature-list.json

```jsonc
[{
  "id": "FEAT-001",
  "category": "auth",
  "description": "User can sign up with email and password",
  "depends_on": [],
  "test_strategy": "tdd",
  "acceptance_test": ["Signup form input", "Account creation confirmation", "Duplicate email error"],
  "tdd_focus": ["validateSignupInput", "createUser", "hashPassword"],
  "doc_sync": ["docs/api.md", "src/api/CLAUDE.md"],
  "passes": false
}]
```

### Field Reference

| Field | Type | Required | Default | Mutable during `/start` |
|-------|------|----------|---------|------------------------|
| `id` | string | Yes | — | No |
| `category` | string | Yes | — | No |
| `description` | string | Yes | — | No |
| `depends_on` | string[] | No | `[]` | No |
| `test_strategy` | `"tdd"` \| `"bundled-tdd"` \| `"state-verification"` \| `"integration"` | No | `"tdd"` | No |
| `acceptance_test` | string[] | Yes | — | No |
| `tdd_focus` | string[] | Yes | — | No |
| `doc_sync` | string[] | Yes | — | No |
| `passes` | boolean | Yes | `false` | **Yes** (only field mutable during `/start`) |

### `depends_on` — Feature Dependency Tracking

Array of feature IDs that must have `passes: true` before this feature can be started. Empty array or omitted means no dependencies.

```jsonc
// Example: merging depends on physics engine and fruit creation
{ "id": "F-04", "depends_on": ["F-01", "F-02"], ... }
```

### `test_strategy` — Per-Feature Test Strategy

Determines the test workflow and quality gate criteria for each feature:

| Value | When to Use | Workflow | Gate 0 | Gate 3 (Coverage) |
|-------|-------------|----------|--------|-------------------|
| `"tdd"` (default) | Pure logic functions (validators, calculators, state machines) with high context-leak risk or tight invariants | Red → Green → Refactor (3 isolated sub-agents) | Full TDD evidence | tdd_focus >= 70% line coverage |
| `"bundled-tdd"` | Pure logic with clear spec and low leak risk; speed over strict isolation | Bundled Red→Green (single `tdd-bundler`, test committed before impl) → optional Refactor | 2-commit red→green sequence: `[bundled-tdd:red]` commit shows failing test output, `[bundled-tdd:green]` commit shows pass | tdd_focus >= 70% line coverage |
| `"state-verification"` | Rendering, canvas, DOM manipulation, UI components | Implement → Write state verification tests → Review | Test files exist + pass | Test files exist for module |
| `"integration"` | Wiring/entry points, game loops, multi-module features | Implement → Write integration tests → Review | Integration test exists + passes | Overall file coverage >= 60% |

Classification guidance for `/setup`:
- Features with pure logic functions → `"tdd"` (strict) or `"bundled-tdd"` (fast). Prefer `"tdd"` when the spec is ambiguous or the feature touches security-sensitive invariants; prefer `"bundled-tdd"` when the spec is unambiguous and speed outweighs the risk of test-implementation co-drift.
- Features with rendering, canvas, DOM, or visual output → `"state-verification"`
- Features that primarily wire together other features → `"integration"`
- When ambiguous, default to `"tdd"`. Present classification to user for confirmation.

**Priority**: Array order determines priority. The first `passes: false` item is the next feature to work on. `/setup` must order features with foundational dependencies first (e.g., auth before profile, profile before order).

**Dependency Validation**: During `/setup` Step 1, after drafting feature-list.json, validate:
- All `depends_on` IDs must reference existing features within the list.
- No circular dependencies (topological sort). If cycle detected, report to user and ask for resolution.
- Array ordering must respect dependencies: if B depends on A, A must appear before B. If violated, reorder and inform user.
- **Auto-approve when clean**: if both checks pass, log a one-line summary (`Dependency graph: {N} features, acyclic, order-valid`) and continue without prompting. Only prompt the user when a violation is detected; when prompting, show the dependency graph and the specific violation:
  ```
  F-01 (physics) [no deps]
  F-02 (fruit) → F-01
  F-04 (merging) → F-01, F-02
  F-03 (score) [no deps]
  ```
- The user can still override an auto-approval via Step 1.7 "Change a decision".

Only the `passes` field may be changed during `/start`. Never add/delete/reorder/modify items. `depends_on` and `test_strategy` are set during `/setup` and are immutable during development.

## PROGRESS.md Structure

### Field Schema

All fields below are **required**. The Phase 6 generator MUST emit every field with the initial value shown; orchestrator and hooks rely on their presence.

| Section | Field | Type | Initial value (Phase 6) | Updated by | Valid values |
|---------|-------|------|-------------------------|------------|--------------|
| `## Status` | `last_completed_phase` | int or string | `setup_complete` | `/setup` Phase 1-6 checkpoints, then frozen | `1`..`6`, `setup_complete` |
| `## Status` | `current_feature` | string | `""` (empty) | orchestrator on feature start/complete | `FEAT-XXX` or `""` |
| `## Status` | `mode` | enum | `initializer` | orchestrator (→ `coding` after first feature) | `initializer`, `coding` |
| `## Current TDD State` | `phase` | enum or empty | `""` | implementer sub-agent per cycle | `Red`, `Green`, `Refactor`, `Verify`, `""` |
| `## Current TDD State` | `iteration` | int | `0` | implementer — increment before cycle, reset to `0` on feature complete | `0`..`5` (>5 escalates) |
| `## Current TDD State` | `tdd_focus_progress` | string | `0/0 complete` | implementer on each tdd_focus pass | `{done}/{total} complete` |
| `## Current TDD State` | `auto_pilot` | bool | `false` | `/start` Step 3 option (4) toggles on; "stop" command toggles off | `true`, `false` |
| `## Completed Features` | table | table | empty (header row only) | orchestrator on feature commit | rows: Feature ID, Completed Date (YYYY-MM-DD), Commit Hash (7-char short sha) |
| `## Session Metrics` | `session_start` | ISO-8601 | Phase 6 write time | orchestrator on session start (`/start` or `/setup`) | UTC ISO-8601 |
| `## Session Metrics` | `cumulative_tokens` | int | `0` | orchestrator after each feature or phase | ≥ 0 |
| `## Metrics` | `total_iterations` | int | `0` | implementer on feature complete | ≥ 0 |
| `## Metrics` | `avg_iterations_per_feature` | float | `0.0` | orchestrator on feature complete | ≥ 0.0 |
| `## Metrics` | `gate_failures` | int | `0` | reviewer/implementer on gate failure | ≥ 0 |
| `## Metrics` | `coverage_trend` | list<string> | `[]` | orchestrator on feature complete, append latest % | percentages (last 10) |
| `## Incidents` | table | table | empty (header row only) | orchestrator on escalation | rows: Date, Feature, Type, Resolution |

### Initial Template (emitted by Phase 6)

```markdown
# PROGRESS.md

## Status
- last_completed_phase: setup_complete
- current_feature: ""
- mode: initializer

## Current TDD State
- phase: ""
- iteration: 0
- tdd_focus_progress: 0/0 complete
- auto_pilot: false

## Completed Features
| Feature ID | Completed Date | Commit Hash |
|------------|----------------|-------------|

## Session Metrics
- session_start: {ISO-8601 UTC timestamp at Phase 6 write}
- cumulative_tokens: 0

## Metrics
- total_iterations: 0
- avg_iterations_per_feature: 0.0
- gate_failures: 0
- coverage_trend: []

## Incidents
<!-- Logged when escalation occurs (5 iteration limit, crashes, repeated hook blocks) -->
| Date | Feature | Type | Resolution |
|------|---------|------|------------|
```

### Example (mid-development)

```markdown
# PROGRESS.md

## Status
- last_completed_phase: setup_complete
- current_feature: FEAT-003
- mode: coding

## Current TDD State
- phase: Green
- iteration: 2
- tdd_focus_progress: 3/5 complete
- auto_pilot: false

## Completed Features
| Feature ID | Completed Date | Commit Hash |
|------------|----------------|-------------|
| FEAT-001   | 2026-04-15     | a1b2c3d     |
| FEAT-002   | 2026-04-16     | e4f5g6h     |

## Session Metrics
- session_start: 2026-04-16T09:30:00Z
- cumulative_tokens: 48200

## Metrics
- total_iterations: 12
- avg_iterations_per_feature: 2.4
- gate_failures: 1
- coverage_trend: [85%, 87%, 89%]

## Incidents
| Date       | Feature  | Type              | Resolution           |
|------------|----------|-------------------|----------------------|
| 2026-04-15 | FEAT-002 | Gate 2 failure x2 | Reduced scope, retry |
```

> The bootstrap hook reads `## Status`, `## Session Metrics`, and `## Metrics` sections at session start to provide context. `## Incidents` is appended by the orchestrator when escalation occurs. `## Session Metrics` is updated by the orchestrator after each feature completion or phase completion. Field types are contract: hooks parse by exact field name and section heading.
