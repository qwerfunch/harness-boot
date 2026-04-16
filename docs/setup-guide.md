# Harness Engineering Guide

> **Premise**: A detailed plan MD already exists.
> This guide is the design specification for converting a detailed plan into a Claude Code native multi-agent execution system.

---

## 0. Core Philosophy

| Principle | Description | Enforcement Mechanism |
|-----------|-------------|----------------------|
| **TDD-First** | Test first → minimal implementation → refactor. Focus on core logic only. | Gate 0 + sub-agent context isolation |
| **Iteration Convergence** | Implement → test → verify → feedback → fix loop. Repeat until convergence. | Max 5 iterations then escalation |
| **Code-Doc Sync** | When code changes, update related docs in the same commit. | **Runtime blocking** via PreToolUse hook |
| **Anti-Rationalization** | Pre-empt agent excuses for skipping steps. | Excuse-rebuttal tables in every skill |

> LLMs are adept at corner-cutting reasoning like "this small change doesn't need tests."
> **"I know you'll say X. But you're wrong because Y"** is more effective than "don't do X."

---

## 1. Directory Structure

```
project-root/
├── CLAUDE.md                              # Main summary (<1,500 tokens)
├── PROGRESS.md                            # State tracking
├── feature-list.json                      # Feature list + pass status (JSON)
├── CHANGELOG.md                           # Harness change history
│
├── .claude/
│   ├── settings.json                      # Hook configuration (runtime guardrails)
│   ├── agents/                            # 9 sub-agents
│   │   ├── orchestrator.md                #   Orchestrator (model: opus)
│   │   ├── implementer.md                 #   TDD orchestration (model: sonnet)
│   │   ├── tdd-test-writer.md             #   Red phase only (model: sonnet)
│   │   ├── tdd-implementer.md             #   Green phase only (model: sonnet)
│   │   ├── tdd-refactorer.md              #   Refactor phase only (model: sonnet)
│   │   ├── reviewer.md                    #   Code review (model: opus)
│   │   ├── tester.md                      #   Integration/E2E testing (model: sonnet)
│   │   ├── architect.md                   #   Design decisions (model: opus)
│   │   └── debugger.md                    #   Debugging specialist (model: opus)
│   ├── skills/                            # 8 skills (Anthropic Agent Skills format)
│   │   ├── new-feature/                   #   Each skill directory contains:
│   │   │   ├── SKILL.md                   #     YAML frontmatter + 7-section body
│   │   │   └── references/               #     Overflow content (optional)
│   │   ├── bug-fix/
│   │   ├── refactor/
│   │   ├── tdd-workflow/
│   │   ├── api-endpoint/
│   │   ├── db-migration/
│   │   ├── context-engineering/
│   │   └── deployment/                    #   (same structure as new-feature/)
│   ├── protocols/                         # 5 protocols
│   │   ├── tdd-loop.md
│   │   ├── iteration-cycle.md
│   │   ├── code-doc-sync.md
│   │   ├── session-management.md
│   │   └── message-format.md
│   ├── examples/                          # Golden samples + anti-patterns
│   ├── context-map.md
│   ├── environment.md
│   ├── security.md
│   ├── quality-gates.md
│   ├── error-recovery.md
│   └── observability.md
│
├── hooks/                                 # 5 executable hook scripts
│   ├── session-start-bootstrap.sh
│   ├── pre-tool-security-gate.sh
│   ├── pre-tool-doc-sync-check.sh
│   ├── post-tool-format.sh
│   └── post-tool-test-runner.sh
│
├── scripts/
│   ├── init-harness.sh
│   ├── doc-impact-check.sh
│   └── task-decompose.sh
│
└── src/
    ├── CLAUDE.md                          # Sub CLAUDE.md (per directory)
    └── ...
```

---

## 2. Runtime Guardrails

Hooks are registered via `.claude/settings.json`, and `hooks/` scripts enforce rules at the system level.

### Hook Exit Codes

| Exit Code | Meaning | Effect |
|-----------|---------|--------|
| 0 | Success | Action proceeds; stdout is shown to the agent as context |
| 1 | Hook error | Action proceeds; hook failure is logged but does not block |
| 2 | Block | Action is blocked (even under bypassPermissions); stderr shown to agent |

### settings.json

```jsonc
{
  "permissions": {
    "deny": ["Read(./.env)", "Read(./.env.*)", "Write(./.env)", "Write(./.env.*)", "Write(./production.config.*)"]
  },
  "hooks": {
    "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash hooks/session-start-bootstrap.sh", "timeout": 30000 }] }],
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "bash hooks/pre-tool-security-gate.sh", "timeout": 5000 }] },
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "bash hooks/pre-tool-doc-sync-check.sh", "timeout": 10000 }] }
    ],
    "PostToolUse": [
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "bash hooks/post-tool-format.sh", "timeout": 10000 }] },
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "bash hooks/post-tool-test-runner.sh", "timeout": 30000 }] }
    ]
  }
}
```

### Hook Script Specifications

| Hook | Event | Behavior | Blocking Condition |
|------|-------|----------|--------------------|
| `session-start-bootstrap.sh` | SessionStart | Check PROGRESS.md/feature-list.json, verify state consistency, output last 5 git log entries | None (context provider) |
| `pre-tool-security-gate.sh` | PreToolUse(Bash) | Block rm -rf, git push --force, curl\|sh, .env access | exit 2 |
| `pre-tool-doc-sync-check.sh` | PreToolUse(Bash) | Block git commit when source changed but no .md changes | exit 2 ([skip-doc-sync] exception) |
| `post-tool-format.sh` | PostToolUse(Write\|Edit) | Auto-run formatter by file extension (prettier/black) | None |
| `post-tool-test-runner.sh` | PostToolUse(Write\|Edit) | Auto-run corresponding tests for changed source files | None (passes result) |

> **Timeout customization**: The default timeouts above are baselines. For projects with large test suites, increase `post-tool-test-runner.sh` timeout (e.g., 60000-120000ms). Adjust in the generated `.claude/settings.json` after `/setup` completes.

### Timeout Behavior

When a hook exceeds its timeout, Claude Code kills the process:
- **PreToolUse hook timeout**: The action proceeds (not blocked). The agent receives a timeout warning.
- **PostToolUse hook timeout**: Results are discarded. The agent receives a timeout warning.
- **SessionStart hook timeout**: Session starts without hook context.

To mitigate: keep hook logic fast (grep-based, not AST-based).

### State Consistency Check (bootstrap hook)

`session-start-bootstrap.sh` must verify consistency between PROGRESS.md and feature-list.json on every session start:
- If PROGRESS.md marks a feature as "Complete" but feature-list.json has `passes: false` (or vice versa), output a warning with the conflicting feature IDs.
- The agent must resolve the inconsistency before proceeding with new work.

---

## 3. Cross-Session State Management

### Initializer Mode (First Session)
Auto-detected when PROGRESS.md doesn't exist or is empty:

#### Checkpoint / Resume
If `/setup` is interrupted mid-phase, PROGRESS.md records `last_completed_phase: N`. On re-running `/setup`, the system detects this and offers to resume from Phase N+1 instead of starting over.

1. Load detailed plan MD → **confirm tech stack** (see rules below) → **assess architecture pattern** (see rules below)
2. Generate feature-list.json (all features `passes: false`)
3. Create initial PROGRESS.md
4. Run init-harness.sh (environment validation, dependency installation)
5. First commit → switch to Coding Mode

### Tech Stack Decision Rules

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

### Tech Stack Storage

Once selected, the tech stack is recorded in exactly two places:
- `CLAUDE.md`: one-line summary (e.g., "Stack: Next.js 14 + TypeScript + Prisma + PostgreSQL")
- `.claude/environment.md`: full detail (versions, package manager, runtime requirements, dev dependencies)

### Architecture Pattern Decision Rules

Architecture patterns (DDD, Clean Architecture, Hexagonal, etc.) provide structural guardrails for maintainability. They are recommended only when the project's scale and domain complexity justify the overhead.

#### Skip Condition

If the plan explicitly states prototype, PoC, MVP, spike, or experimental purpose, **skip architecture selection entirely**. Use a Simple Flat structure and inform the developer:

> "Project identified as {prototype/PoC/MVP}. Proceeding without architecture pattern (Simple Flat structure)."

No further confirmation needed for skip — proceed directly.

#### Scale Assessment

When the skip condition does not apply, evaluate three factors from the plan:

| Factor | Threshold | How to Measure |
|--------|-----------|----------------|
| Feature count | >= 8 features | Count items in feature-list.json draft |
| Domain categories | >= 3 distinct categories | Count unique `category` values in feature-list.json draft |
| Cross-cutting concerns | Present | Auth, payments, notifications, external integrations, event-driven flows |

- **2 or 3 factors met** → Recommend architecture pattern
- **0 or 1 factors met** → Default to Simple Layered structure, but ask developer if they want to adopt a pattern anyway

#### Decision Rules

| Priority | Condition | Action |
|----------|-----------|--------|
| **0th** | Plan states prototype/PoC/MVP/spike | Skip architecture (Simple Flat). Inform developer. |
| **1st** | Architecture pattern specified in the plan | Adopt as-is. Reflect in CLAUDE.md + environment.md. |
| **2nd** | Scale assessment triggers recommendation | Analyze tech stack fit → **present 2-3 recommendations** with explanations. Proceed after developer selects. |
| **3rd** | Scale assessment does NOT trigger | Note "Simple Layered structure recommended." Ask developer to confirm or override. |

#### Architecture Pattern Reference

Each recommendation must include a plain-language explanation so that non-developers can also make informed decisions.

| Pattern | What It Is (Plain Language) | Best For | Trade-offs |
|---------|---------------------------|----------|------------|
| **DDD (Domain-Driven Design)** | Organizes code around business concepts (e.g., "Order", "User", "Payment") rather than technical layers. Like organizing a company by business units rather than by job function. | Complex business logic with many rules, enterprise systems | Higher upfront design cost; requires deep domain understanding; overkill for simple CRUD |
| **Clean Architecture** | Separates code into concentric rings: core business logic in the center, external tools (DB, APIs) on the outside. Inner rings never depend on outer rings. Like building a house where the floor plan doesn't change even if you swap the plumbing. | Projects needing long-term maintainability, easy testing, and framework independence | More files and indirection; slower initial development; can feel over-engineered for small projects |
| **Hexagonal (Ports & Adapters)** | Core logic communicates with the outside world only through defined "ports" (interfaces). External systems plug in via "adapters". Like a universal power strip that works with any plug type. | Systems with many external integrations (APIs, databases, message queues) | Similar overhead to Clean Architecture; port/adapter boilerplate; best value with 3+ external systems |
| **Vertical Slice** | Each feature is a self-contained vertical slice through all layers (UI → logic → DB). Features are independent folders rather than shared layers. Like organizing a restaurant by dish (each chef handles their dish end-to-end) rather than by station. | Feature-rich applications where features rarely share logic; microservice-like structure in a monolith | Code duplication across slices; harder to share cross-cutting logic; less suitable for deep shared domains |
| **Simple Layered** | Traditional Controller → Service → Repository layers. Straightforward and widely understood. Like a factory assembly line — each station does one type of work. | Small-to-medium projects, CRUD-heavy apps, teams new to architecture patterns | Tends to create "God services" as project grows; tight coupling between layers; harder to test in isolation |

#### Language/Framework Compatibility

| Pattern | Best Fit | Acceptable Fit | Poor Fit |
|---------|----------|----------------|----------|
| **DDD** | Java/Spring, C#/.NET, Kotlin | TypeScript/NestJS, Python/FastAPI | Go (lacks OOP), simple CRUD apps |
| **Clean Architecture** | Go, Java/Spring, TypeScript/NestJS | Python/FastAPI, C#/.NET | Rapid prototypes, small scripts |
| **Hexagonal** | Java/Spring, TypeScript/NestJS, Rust | Go, Python | Frontend-heavy apps |
| **Vertical Slice** | C#/.NET, TypeScript/NestJS | Java/Spring, Go | Projects with deep shared domain logic |
| **Simple Layered** | Any | Any | Large-scale domain-heavy projects |

#### Recommendation Template

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

#### Architecture Pattern Storage

Once selected (or confirmed as "Simple Layered"), the architecture pattern is recorded alongside the tech stack:
- `CLAUDE.md`: appended to the stack summary line (e.g., "Stack: Next.js 14 + TypeScript + Prisma + PostgreSQL | Architecture: Clean Architecture")
- `.claude/environment.md`: dedicated section with pattern name, layer definitions, dependency rules, and directory-to-layer mapping

#### environment.md Architecture Section Template

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

### Coding Mode (Subsequent Sessions)
The SessionStart hook automatically provides a PROGRESS.md summary + incomplete feature count + git log.
The agent selects the next feature from feature-list.json → **works on only one at a time**.

### feature-list.json

```jsonc
[{
  "id": "FEAT-001",
  "category": "auth",
  "description": "User can sign up with email and password",
  "acceptance_test": ["Signup form input", "Account creation confirmation", "Duplicate email error"],
  "tdd_focus": ["validateSignupInput", "createUser", "hashPassword"],
  "doc_sync": ["docs/api.md", "src/api/CLAUDE.md"],
  "passes": false
}]
```

**Priority**: Array order determines priority. The first `passes: false` item is the next feature to work on. `/setup` must order features with foundational dependencies first (e.g., auth before profile, profile before order).

**Dependency Validation**: During `/setup` Step 1, after drafting feature-list.json, validate:
- No circular dependencies (A depends on B depends on A). If detected, report to user and ask for resolution.
- Dependencies must reference only features within the list.

Only the `passes` field may be changed. Never add/delete/reorder/modify items.

---

## 4. TDD Sub-Agent Context Isolation

When TDD is performed in a single context, the test writer's analysis leaks to the implementer.
Separating Red/Green/Refactor into distinct sub-agents prevents this.

| Sub-Agent | Phase | Rules | Model |
|-----------|-------|-------|-------|
| `tdd-test-writer` | Red | Write tests from interfaces only, without reading implementation code | sonnet |
| `tdd-implementer` | Green | Write only the minimal code needed to pass tests | sonnet |
| `tdd-refactorer` | Refactor | No behavior changes allowed. Tests must continue to pass | sonnet |

### Sub-Agent Frontmatter Examples

```markdown
---
name: tdd-test-writer
description: TDD Red phase only. Writes failing tests. Does not read implementation code.
tools: Read, Glob, Grep, Write, Bash
model: sonnet
---
# TDD Test Writer (Red Phase)

## Rules
- **Do not read** existing implementation code (prevents context contamination)
- Write tests referencing only interfaces/type definitions
- Required cases: happy path, boundary, error
- Return: test file paths + expected failure count
```

```markdown
---
name: tdd-implementer
description: TDD Green phase only. Writes minimal code to pass failing tests.
tools: Read, Glob, Grep, Write, Edit, Bash
model: sonnet
effort: medium
---
# TDD Implementer (Green Phase)

## Rules
- Read tests first to understand expected behavior
- Write only the **minimal** code to pass tests
- No over-abstraction
- Return: implementation file paths + test results
```

```markdown
---
name: tdd-refactorer
description: TDD Refactor phase only. Improves code quality while tests remain passing.
tools: Read, Glob, Grep, Write, Edit, Bash
model: sonnet
effort: low
---
# TDD Refactorer (Refactor Phase)

## Rules
- Run tests before refactoring → confirm all pass before starting
- No behavior changes (tests must continue to pass)
- Return: changed file list + test results
```

### File Classification for tdd-test-writer

The "do not read implementation code" rule applies to:
- **Forbidden**: `src/**/*.{ts,js,py,go,...}` (domain logic files — excluding type/interface definitions)
- **Allowed**: type definition files (`*.d.ts`, `*.types.ts`, `*.interface.ts`), test files (`*.test.*`, `*.spec.*`), config files, documentation

The implementer agent must pass the allowed file list to tdd-test-writer's prompt.

### Implementer's TDD Orchestration Flow

```
Plan → Red(tdd-test-writer) → Green(tdd-implementer) → Refactor(tdd-refactorer)
  → Verify(full test suite + feature verification) → on failure, return to Green/Red (max 5 iterations)
  → Doc Sync → single commit (code + tests + docs)
```

### Context Window Limits

Sub-agents have independent context windows. If a sub-agent's context fills (large test suites, many files):
- The implementer should split the feature's tdd_focus into smaller batches
- Each batch runs a full Red-Green-Refactor cycle independently
- This is an escalation condition: report to user if a single tdd_focus function cannot fit in one sub-agent context

---

## 5. Model Routing

Agents where reasoning is critical use Opus; agents where code generation is critical use Sonnet.
Specified via the frontmatter `model:` field.

```
Opus (judgment) ── orchestrator, architect, reviewer, debugger
Sonnet (execution) ── implementer, tdd-×3, tester
```

```markdown
---
name: tdd-implementer
description: TDD Green phase only.
tools: Read, Glob, Grep, Write, Edit, Bash
model: sonnet
effort: medium
---
```

Default can be set via environment variable:
```bash
export CLAUDE_CODE_SUBAGENT_MODEL=sonnet  # Default Sonnet, override with frontmatter for Opus agents only
```

Expected cost savings: execution agents (~70% of tokens) drop to Sonnet, yielding **~30-40% total savings**.

---

## 6. Code Style, Linting, and Comment Rules

### 6.1 Code Style

**Follow Google Style Guide** — Use the corresponding Google Style Guide for each language as the baseline.

**Secure coding** — Always validate user input, parameterize SQL, escape for XSS, prohibit eval/innerHTML.

**Readability first** — Prefer clear multi-line code over complex one-liners. Max nesting depth: 3 levels. No nested ternaries.

**Refactoring triggers**:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Function length | > 40 lines | Consider splitting |
| File length | > 300 lines | Consider module separation |
| Nesting depth | > 3 levels | Early return / extract function |
| Parameter count | > 4 | Convert to object parameter |
| Cyclomatic complexity | > 10 | Must split |

> **Enforcement**: Formatting rules (whitespace, semicolons, indentation) are auto-enforced by the `post-tool-format.sh` hook (prettier/black). Structural style rules (naming, nesting depth, function length) are enforced by the **reviewer agent** during Gate 2 code review.

### 6.2 Comment Rules

**Philosophy**: Let the code say "what," and comments say only **"why."**
Function/class-level JSDoc is required. Inline comments are for gotchas only.

**File header** (required for all source files):
```typescript
/* ┌─────────────────────────────────────────────────────────────┐
 * │  Order Calculation Service                                  │
 * │                                                             │
 * │  All monetary calculations for the order pipeline.          │
 * │  Tax: KR regulation (discount applied before tax).          │
 * │                                                             │
 * │  Dependencies: LineItem, PaymentGateway                     │
 * │  Related: docs/api.md, src/api/CLAUDE.md                   │
 * └─────────────────────────────────────────────────────────────┘ */
```

**Section dividers**:
```typescript
/* ── Public API ─────────────────────────────────────────────── */

/* ── Internal Helpers ───────────────────────────────────────── */

/* ── Types & Constants ──────────────────────────────────────── */
```

**Function comments** (required):
```typescript
/**
 * Calculate total order amount with tax.
 *
 * NOTE: Discount is applied before tax — KR legal requirement.
 *       Do not reorder without legal review.
 */
function calculateTotal(items: LineItem[], taxRate: number, discount = 0): number {
  const subtotal = sumLineItems(items);
  const discounted = Math.max(subtotal - discount, 0); // negative totals break payment gateway
  return roundCurrency(discounted * (1 + taxRate));
}
```

**Inline comments — good vs bad examples**:
```typescript
// Good: "why" — gotcha warning
await db.query(sql); // ⚠️ Runs outside transaction — cannot rollback

// Bad: "what" — the code already says this
const total = price * quantity; // Multiply price by quantity
```

### 6.3 Logging Design Rules

**Philosophy**: Logs are production's black box recorder.
No `console.log` / `print`. Use a structured logger appropriate for the project's tech stack.
Adjust detailed strategy based on application type (server/desktop/mobile/CLI), but the following principles are universal.

#### Where to Log (Log Points)

Don't log in every function. Log only at **system boundaries and state transitions**.

**Common points** (all applications):

| Point | Level | Required Information |
|-------|-------|---------------------|
| Application start/stop | INFO | Version, environment, key settings |
| External boundary calls (API, DB, file I/O, OS calls) | DEBUG | Target, duration_ms, result summary |
| Business events (state transitions) | INFO | Entity ID, state change, user ID |
| Errors/exceptions | ERROR | Error message, stack trace, related IDs |
| Retries/fallbacks | WARN | Attempt count, cause, next action |
| Scheduler/batch/worker jobs | INFO | Job name, start/end, processed count, duration |

**Additional points by application type**:

| Type | Additional Points | Notes |
|------|-------------------|-------|
| **Web/API server** | HTTP request entry/completion (method, path, status, duration) | requestId required |
| **Desktop (PC app)** | User actions (menu clicks, shortcuts), window lifecycle, auto-updates | Exclude sensitive user input |
| **Mobile app** | Screen transitions, app lifecycle (foreground/background), push notifications | Consider battery/network impact, use batch sending |
| **CLI tool** | Command execution start/end, exit code, key flags | stdout for results, logs to stderr or file |
| **Background worker** | Job receipt, queue status, retries, dead letters | Track by job ID |

#### What to Include (Required Context)

Auto-include in all logs (via child logger / context binding):
- `timestamp` — ISO 8601
- `level` — info/debug/warn/error/fatal
- `service` or `module` — component name
- **Trace ID** — varies by application type:
  - Server: `requestId` (required for distributed systems)
  - Desktop/Mobile: `sessionId` (per app launch)
  - CLI: `runId` (per command execution)
  - Worker: `jobId`

Additional for business logs: related entity IDs (`orderId`, `userId`, etc.), state transitions.

#### Absolute Prohibitions

- `console.log` / `print` / `NSLog` (in production code)
- Logging secrets: passwords, API keys, tokens, auth cookies
- Logging PII in plaintext (email, phone number, SSN, etc. — must be masked)
- Inserting user input directly into log messages (prevents log injection)
- Logging every iteration inside loops (performance degradation)
- Mobile: sending user identifiers to server without consent (potential privacy law violation)

#### Level Guidelines

```
FATAL — Application cannot function. Immediate alert. (DB connection failure, missing critical resource)
ERROR — Request/job failed. Action required. (Payment failure, external API 5xx, file save failure)
WARN  — Auto-recovered but needs attention. (Retry succeeded, cache miss fallback, network instability)
INFO  — Core business flow. In production, this alone should tell whether the system is healthy.
DEBUG — Detailed parameters, queries, intermediate results. Off by default in production.
```

**INFO level design test**: "If only INFO logs were enabled in production for a period, could you determine whether the system is healthy or not?" — If YES, the balance is right.

#### Log Format (Environment-Dependent)

```
Production: JSON (structured, collector-compatible)
  {"level":"info","time":"2026-04-16T09:00:05Z","service":"order","event":"order.created","orderId":"ORD-001","runId":"run-7f4e"}

Local development: Pretty-print (readable)
  [09:00:05] INFO  order  order.created  orderId=ORD-001  runId=run-7f4e
```

Same code, switched via environment variable (`LOG_FORMAT` or `NODE_ENV`). No branching in code.

#### Log Transport & Storage Strategy (by Type)

| Type | Default Target | Remote Collection | Notes |
|------|---------------|-------------------|-------|
| **Web/API server** | stdout | Immediate streaming (Loki/ELK/Datadog/CloudWatch) | High throughput, async logger required |
| **Desktop app** | Local file (OS-standard path) | Crash reports required, general logs opt-in | User consent required, manage disk usage |
| **Mobile app** | Local file (app sandbox) | Batch send (on Wi-Fi or threshold reached) | Consider battery/data costs, offline queuing |
| **CLI tool** | stderr or user-specified file | None by default (local only) | Adjust level via `--verbose` flag |
| **Background worker** | stdout | Immediate streaming | Maintain request correlation via job ID |

**Desktop log file standard paths**:
- macOS: `~/Library/Logs/{AppName}/`
- Windows: `%LOCALAPPDATA%\{AppName}\logs\`
- Linux: `~/.local/state/{AppName}/logs/` (XDG)

**Mobile log file paths**:
- iOS: App sandbox `Documents/Logs/` or `Library/Caches/Logs/`
- Android: Internal storage `context.getFilesDir()/logs/`

#### Log Rotation & Retention

| Type | Rotation | Retention Period |
|------|----------|-----------------|
| **Server (remote collection)** | Daily + 100MB | ERROR 90 days / INFO 30 days / DEBUG 7 days |
| **Server (local file fallback)** | Daily | 7 days |
| **Desktop app** | Size-based (10MB) | Keep last 5 files (~50MB cap) |
| **Mobile app** | Size-based (2MB) | Keep last 3 files (~6MB cap) |
| **CLI tool** | Per-run or daily | 30 days or manual |
| **Local development** | None | Manual |

Scheduler/batch/worker logs follow their execution environment's rotation. No separate splitting; filter by `service` or `job` field.

#### Rationalization Defense

| Excuse | Rebuttal |
|--------|----------|
| "I'll add logs later" | Code without logs is blind in production. Write logs with the feature. |
| "Just log everything at DEBUG" | DEBUG is off in production. INFO alone must convey system state. |
| "Logging errors only is sufficient" | Without context (INFO/WARN) before the error, root cause analysis is impossible. |
| "I'm worried about performance impact" | Structured loggers (Pino, structlog, etc.) process asynchronously. Negligible with the right logger. |
| "Mobile needs minimal logging due to battery" | Solve with level adjustment and batch sending. Removing logs entirely makes crash investigation impossible. |
| "Desktop apps are offline, can't do remote collection" | Local logs are essential. Even crash reports alone (with user consent) are sufficient. |

---

## 7. Skills — Anthropic Agent Skills Format

> **Reference**: Skills follow the [Anthropic Agent Skills Specification](https://github.com/anthropics/skills).
> All generated skills must comply with this spec while embedding harness-specific sections (TDD Focus, Rationalizations, Red Flags).

### 7.1 Skill Directory Structure

Each skill is a self-contained directory. The directory name **must match** the `name` field in SKILL.md.

```
skill-name/
├── SKILL.md                  # Required: YAML frontmatter + Markdown instructions
├── references/               # Optional: supplementary documentation (overflow content)
│   └── REFERENCE.md         #   Detailed technical reference, examples, edge cases
├── scripts/                  # Optional: executable code (Python, Bash, JavaScript)
│   └── validate.sh          #   Helper scripts referenced from SKILL.md
└── assets/                   # Optional: static resources (templates, data files)
```

### 7.2 YAML Frontmatter Schema

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

### 7.3 SKILL.md Body — 7-Section Anatomy

The Markdown body merges Anthropic's recommended structure with harness-specific requirements.
All 7 sections are mandatory for harness skills.

```markdown
---
name: {skill-name}                    # Must match directory name
description: >                        # See 7.5 for writing guide
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
{Instructions. Reference supplementary files:}
See [detailed examples](references/REFERENCE.md) for edge cases.

### Step N: {Verb phrase}
{Final step — typically verification and commit.}

## Common Rationalizations
| Excuse | Rebuttal |
|--------|----------|
| "{tempting shortcut 1}" | {specific, compelling counter-argument} |
| "{tempting shortcut 2}" | {specific, compelling counter-argument} |
| "{tempting shortcut 3}" | {specific, compelling counter-argument} |

> Minimum 3 rows required. Each rebuttal must be specific to THIS skill's domain.
> Use the "I know you'll say X. But you're wrong because Y" framing.

## Red Flags
- {Observable sign that this skill's process is being violated — minimum 2 items}
- {Another sign — agents and reviewers check for these}

## Verification
- [ ] {Verify with evidence — specify evidence type: logs/diff/reports/coverage}
- [ ] feature-list.json `passes: true` for this feature
- [ ] PROGRESS.md updated with iteration metrics
- [ ] Code-doc sync mapping targets updated
```

### 7.4 Progressive Disclosure (3-Tier Token Budget)

Skills follow a progressive disclosure model to minimize context consumption:

| Tier | Content | Token Budget | When Loaded |
|------|---------|-------------|-------------|
| **Metadata** | `name` + `description` fields | ~100 tokens | Always (skill discovery) |
| **Instructions** | Full SKILL.md body | < 5,000 tokens (~500 lines max) | When skill activates (trigger match) |
| **Resources** | `references/`, `scripts/`, `assets/` | On-demand | Only when explicitly referenced in instructions |

**Rules**:
- SKILL.md body must stay under 500 lines. Move detailed content to `references/` subdirectory.
- Inline code blocks within SKILL.md: 50 lines max. Move longer code to `scripts/`.
- Reference supplementary files with relative paths: `See [details](references/REFERENCE.md)`
- Delete any section that doesn't change agent behavior — no padding.

### 7.5 Description Writing Guide

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

### 7.6 Skill List

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

### 7.7 Complete Skill Example

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
- **Coverage target**: 100% line coverage for `tdd_focus` functions; no regression
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
Verify via doc-impact-check.sh before commit.

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
- [ ] Coverage: 100% line on `tdd_focus`, no regression overall (evidence: coverage report)
- [ ] feature-list.json `passes: true`
- [ ] PROGRESS.md updated with `iteration_count` and `duration`
```

### 7.8 Skill Generation Validation Checklist

During `/setup` Phase 4, validate each generated skill against:

| # | Check | Criterion |
|---|-------|-----------|
| 1 | **Directory name** | Matches `name` field, lowercase a-z/numbers/hyphens only |
| 2 | **File name** | `SKILL.md` (uppercase) |
| 3 | **name field** | 1-64 chars, valid characters, no leading/trailing/consecutive hyphens |
| 4 | **description field** | 1-1024 chars, includes WHAT + WHEN + TRIGGER + DO NOT TRIGGER |
| 5 | **Body sections** | All 7 sections present: Overview, When to Use, TDD Focus, Process, Common Rationalizations, Red Flags, Verification |
| 6 | **Rationalizations** | >= 3 rows, each rebuttal is specific to the skill's domain |
| 7 | **Red Flags** | >= 2 items |
| 8 | **Verification** | Includes evidence types (logs/diff/reports/coverage) |
| 9 | **Line count** | SKILL.md <= 500 lines |
| 10 | **File references** | Relative paths from skill root, referenced files exist |

---

## 8. Agent Definitions

### 8.1 Common Input/Output

```jsonc
// Input
{ "task_id": "", "type": "feature|bugfix|refactor|test", "description": "",
  "target_files": [], "acceptance_criteria": [],
  "tdd_focus": [], "doc_sync_targets": [], "feature_id": "FEAT-XXX" }

// Output
{ "task_id": "", "status": "success|failure|partial|blocked", "iteration_count": 0,
  "changes": { "code": [], "tests": [], "docs": [] },
  "test_results": { "total": 0, "passed": 0, "failed": 0, "coverage": "" },
  "feature_passes": false, "blockers": [], "notes": "" }
```

### 8.2 Agent Roles

| Agent | Model | Core Role |
|-------|-------|-----------|
| **orchestrator** | opus | Initializer/Coding mode switching, task decomposition, tdd_focus/doc_sync assignment, one-at-a-time |
| **implementer** | sonnet | Sequential TDD sub-agent calls, convergence loop management (max 5), single commit |
| **reviewer** | opus | 3-stage review: (1) TDD compliance (2) Code quality (3) Doc sync. REJECT if docs missing |
| **tester** | sonnet | Core function selection, feedback with expected vs actual values |
| **architect** | opus | ADR writing, impact doc listing, schema changes require migration + docs together |
| **debugger** | opus | Root cause analysis, minimal fix, mandatory regression test |
| **tdd-test-writer** | sonnet | Red phase only. Does not read implementation code |
| **tdd-implementer** | sonnet | Green phase only. Minimal implementation |
| **tdd-refactorer** | sonnet | Refactor phase only. No behavior changes |

### 8.3 Agent Rationalization Defense

Each generated agent MD must include a "Common Rationalizations" section (minimum 2 rows). Examples:

| Agent | Excuse | Rebuttal |
|-------|--------|----------|
| **orchestrator** | "This feature is simple, skip TDD" | All features with tdd_focus use TDD, no exceptions |
| **reviewer** | "Minor change, quick approval" | All changes get full 3-stage review regardless of size |
| **implementer** | "Tests are passing, skip refactor phase" | Refactor is mandatory even if no changes result |
| **debugger** | "I know the fix, skip root cause analysis" | Root cause must be documented; symptom fixes recur |

---

## 9. Quality Gates

> "Looks good" is not a passing criterion. Every gate requires **evidence**.

| Gate | Check | Evidence | Rationalization Defense |
|------|-------|----------|------------------------|
| **0: TDD** (prerequisite) | Tests exist for tdd_focus, Red → Green order, happy/boundary/error | Test files, call order logs | "Too simple to need tests" → if tdd_focus specified, no exceptions |
| **1: Implementation** | 0 compile errors, 0 lint errors, all tests pass, docs changes included | tsc/eslint/test output, git diff | "Docs later" → hook blocks commit |
| **2: Review** | 0 Critical/Major issues | Reviewer feedback (file/line/severity) | "Trivial change, skip review" → all changes are reviewed |
| **3: Testing** | tdd_focus functions: 100% line coverage; overall project coverage: no regression from baseline | Coverage report, execution logs | — |
| **4: Deploy** | Gates 0-3 pass, feature passes: true, rollback procedure ready | sync-docs pass log | "Worked in staging" → check environment differences |

> Gate 0 not met → Gates 1-4 cannot proceed.

### Gate 0 Enforcement

The **implementer agent** checks Gate 0 before proceeding to Gate 1:
1. Verify test files exist for each `tdd_focus` item
2. Verify Red phase produced failing tests (evidence: test runner output with failures)
3. Verify Green phase made them pass (evidence: test runner output with all passes)

If Gate 0 fails: return to Red phase. This counts toward the 5-iteration convergence limit.
The **reviewer agent** independently re-checks Gate 0 compliance during Gate 2.

### Rollback Procedure (Gate 4 Requirement)

Before marking a feature as `passes: true`, verify:
1. All changes are in a single commit (enables `git revert <sha>`)
2. If a DB migration exists: a corresponding down-migration file must exist
3. If config changes exist: previous values are documented in the commit message

The rollback procedure is: `git revert <feature-commit-sha>` + run down-migrations if applicable.

---

## 10. Code-Doc Sync

### Triple Defense

| Layer | Mechanism | Timing |
|-------|-----------|--------|
| Prompt | code-doc-sync.md protocol | During work |
| Hook | pre-tool-doc-sync-check.sh | Just before git commit (blocking) |
| Review | Reviewer 3-stage review | During code review |

### Mapping Table

The following is an **example** mapping. `/setup` generates a project-specific mapping table based on the plan's directory structure and tech stack.

```
# Example (customize per project during /setup)
src/api/**          → docs/api.md, src/api/CLAUDE.md
src/components/**   → docs/components.md, src/components/CLAUDE.md
prisma/**           → docs/schema.md, .claude/environment.md
package.json        → .claude/environment.md

# These rules are always applied regardless of project
new directory       → create corresponding sub CLAUDE.md
.claude/**          → CHANGELOG.md
feature complete    → feature-list.json (passes: true)
all changes         → PROGRESS.md
```

---

## 11. Learning / Evolution

### Collected Metrics
Per-task iteration_count, per-sub-agent duration, top 10 test failure frequency, doc-missing frequency, escalation frequency.

### Storage

Metrics are appended to `PROGRESS.md` under a `## Metrics` section:
- Per-feature: `FEAT-XXX: iterations={N}, duration={M}s, escalated={bool}`
- Per-session summary at session end
- The bootstrap hook reads this section to provide trend data at session start

### Improvement Triggers
- Average iteration_count > 3 → review test strategy
- Same file missing docs 3+ times → add to mapping table
- Specific sub-agent failing frequently → improve prompt
- Frequent escalations → make skill procedures more specific

---

## 12. Generation Order

```
Phase 1: Infrastructure ── settings.json, hooks/ (5 scripts), environment.md, security.md, scripts/ (init-harness.sh, doc-impact-check.sh, task-decompose.sh)
Phase 2: Protocols ── protocols/ (5 protocols), CLAUDE.md, quality-gates.md
Phase 3: Agents ── agents/ (9 agents, with model: field)
Phase 4: Skills ── skills/ (8 skills, Anthropic Agent Skills format, 7-section anatomy), examples/, context-map.md
Phase 5: Sub CLAUDE.md ── per directory
Phase 6: State ── feature-list.json, PROGRESS.md, CHANGELOG.md, error-recovery.md, observability.md
```

---

## 13. Plan-to-Harness Conversion Rules

| Plan Content | Conversion Target |
|-------------|-------------------|
| Project purpose | CLAUDE.md one-line summary |
| Tech stack (specified) | CLAUDE.md + environment.md → **1st priority: adopt as-is** |
| Tech stack (unspecified) | Analyze requirements → present 2-3 recommendations → **reflect after developer selection** |
| Feature specs | **feature-list.json** (JSON, passes: false) |
| Core business logic | Each feature's tdd_focus field |
| API design | skills/api-endpoint + src/api/CLAUDE.md |
| DB schema | skills/db-migration + schema docs |
| Security requirements | security.md + hooks/security-gate.sh |
| Test strategy | quality-gates.md + tdd-loop.md |
| Coding conventions | CLAUDE.md + sub CLAUDE.md |
| Documentation targets | code-doc-sync.md mapping table |
| Architecture (specified) | CLAUDE.md + environment.md → **1st priority: adopt as-is** |
| Architecture (unspecified, scale warrants) | Scale assessment → present 2-3 recommendations → **reflect after developer selection** |
| Architecture (unspecified, small scale) | Default to Simple Layered → **confirm with developer** |
| Architecture (prototype/PoC/MVP) | Skip → Simple Flat structure, inform developer |
| Schedule | PROGRESS.md Backlog |

---

## 14. Token Budget

| Deliverable | File Count | Tokens per File | Subtotal |
|-------------|-----------|-----------------|----------|
| Main CLAUDE.md | 1 | ~1,200 | 1,200 |
| Sub CLAUDE.md | 5-8 | ~550 | 3,300 |
| Agent MD | 9 | ~800 | 7,200 |
| Skills (7-section, Anthropic format) | 8 | ~800 | 6,400 |
| Protocols | 5 | ~500 | 2,500 |
| Hook scripts | 5 | ~150 | 750 |
| Other | 8 | ~400 | 3,200 |
| **Total** | **~52** | | **~24,550** |

**Per-task actual consumption**: CLAUDE.md + sub CLAUDE.md + agent + skill + tdd-loop = **~3,800 tokens**
TDD sub-agents run in independent context windows → no additional token consumption in the main context.

> **Note**: The ~24,550 token estimate covers generated output only. The `/setup` command also loads
> the plan MD and this guide into context (~8,000 tokens). Total context consumption during setup
> is approximately **35,000-45,000 tokens** depending on plan size.
>
> Per-task estimate of ~3,800 tokens assumes the agent loads only the relevant sub CLAUDE.md.
> With full feature context (acceptance_criteria, tdd_focus, doc_sync targets), expect **~4,500-5,000 tokens**.
