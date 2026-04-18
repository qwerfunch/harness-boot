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
├── README.md                              # Project documentation (in conversation_language)
├── PROGRESS.md                            # State tracking
├── feature-list.json                      # Feature list + pass status (JSON)
├── CHANGELOG.md                           # Change history (Keep a Changelog format)
├── .gitignore                             # Tech stack-specific ignore patterns
│
├── .claude/
│   ├── settings.json                      # Hook configuration (runtime guardrails)
│   ├── agents/                            # 9+ agents (+ optional qa-agent, module-specific agents)
│   │   ├── orchestrator.md                #   Orchestrator (model: opus)
│   │   ├── implementer.md                 #   TDD orchestration (model: sonnet)
│   │   ├── tdd-test-writer.md             #   Red phase only (model: sonnet)
│   │   ├── tdd-implementer.md             #   Green phase only (model: sonnet)
│   │   ├── tdd-refactorer.md              #   Refactor phase only (model: sonnet)
│   │   ├── reviewer.md                    #   Code review (model: opus)
│   │   ├── tester.md                      #   Integration/E2E testing (model: sonnet)
│   │   ├── architect.md                   #   Design decisions (model: opus)
│   │   ├── debugger.md                    #   Debugging specialist (model: opus)
│   │   └── qa-agent.md                    #   Integration coherence (model: opus, optional)
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
│   ├── domain-persona.md                  # Domain context for agents (~500 tokens)
│   ├── context-map.md                     # Bounded context mapping (references domain-persona.md)
│   ├── environment.md
│   ├── security.md
│   ├── quality-gates.md
│   ├── error-recovery.md
│   └── observability.md
│
├── hooks/                                 # 6 executable hook scripts
│   ├── session-start-bootstrap.sh
│   ├── pre-tool-security-gate.sh
│   ├── pre-tool-doc-sync-check.sh
│   ├── pre-tool-coverage-gate.sh
│   ├── post-tool-format.sh
│   └── post-tool-test-runner.sh
│
├── scripts/
│   └── update-feature-status.sh
│
├── _workspace/                            # Intermediate outputs (Agent Team file-based transfer)
│   └── {phase}_{agent}_{artifact}.{ext}   #   Convention: 01_architect_dependencies.md
│
└── src/
    └── ...                                # No sub CLAUDE.md — layer rules injected from .claude/context-map.md
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
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "bash hooks/pre-tool-doc-sync-check.sh", "timeout": 10000 }] },
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "bash hooks/pre-tool-coverage-gate.sh", "timeout": 30000 }] }
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
| `pre-tool-doc-sync-check.sh` | PreToolUse(Bash) | Block git commit when source module's public API (exports) changed but feature's doc_sync targets not updated | exit 2 ([skip-doc-sync] exception) |
| `post-tool-format.sh` | PostToolUse(Write\|Edit) | Auto-run formatter by file extension (prettier/black) | None |
| `post-tool-test-runner.sh` | PostToolUse(Write\|Edit) | Auto-run corresponding tests for changed source files | None (passes result) |
| `pre-tool-coverage-gate.sh` | PreToolUse(Bash) | Block git commit when tdd_focus functions lack 100% test coverage | exit 2 ([skip-coverage] exception) |

> **Timeout customization**: The default timeouts above are baselines. For projects with large test suites, increase `post-tool-test-runner.sh` timeout (e.g., 60000-120000ms). Adjust in the generated `.claude/settings.json` after `/setup` completes.

### Timeout Behavior

When a hook exceeds its timeout, Claude Code kills the process:
- **PreToolUse hook timeout**: The action proceeds (not blocked). The agent receives a timeout warning.
- **PostToolUse hook timeout**: Results are discarded. The agent receives a timeout warning.
- **SessionStart hook timeout**: Session starts without hook context.

To mitigate: keep hook logic fast (grep-based, not AST-based).

### Hook Generation — Template-Based (Phase 1)

Hook scripts are **copied from `${CLAUDE_PLUGIN_ROOT}/docs/templates/hooks/`**, not generated by LLM. This keeps Phase 1 deterministic and fast.

- 5 of 6 hooks are **stack-agnostic** (extension-dispatched or language-independent): `session-start-bootstrap.sh`, `pre-tool-security-gate.sh`, `pre-tool-doc-sync-check.sh`, `post-tool-format.sh`, `post-tool-test-runner.sh`. Copy verbatim.
- 1 hook (`pre-tool-coverage-gate.sh`) has two placeholders — `{COVERAGE_COMMAND}` and `{COVERAGE_FILE}` — substituted per the selected tech stack. See `${CLAUDE_PLUGIN_ROOT}/docs/templates/stacks.md` for the substitution table.

After copying, run `chmod +x hooks/*.sh`.

The tables below (Formatter / Test Runner / Coverage / Security / Package Manager) are kept as a **human reference** for reviewers and for stacks not present in `stacks.md`; the generated hooks already embed this logic internally via extension dispatch.

### Reference: Tools per Language / Tech Stack

#### Formatter Hook (post-tool-format.sh)

| Language | Formatter | Install | Command |
|----------|-----------|---------|---------|
| **Node.js (TS/JS)** | Prettier | `npm install -D prettier` | `npx prettier --write {file}` |
| **Python** | Black + isort | `pip install black isort` | `black {file} && isort {file}` |
| **Go** | gofmt (built-in) | — | `gofmt -w {file}` |
| **Rust** | rustfmt (built-in) | `rustup component add rustfmt` | `rustfmt {file}` |
| **Java** | google-java-format | Download JAR | `java -jar google-java-format.jar -i {file}` |

#### Test Runner Hook (post-tool-test-runner.sh)

| Language | Runner | Command | Test File Pattern |
|----------|--------|---------|-------------------|
| **Node.js** | Vitest / Jest | `npx vitest run --reporter=verbose` | `*.test.ts`, `*.spec.ts` |
| **Python** | pytest | `pytest -v` | `test_*.py`, `*_test.py` |
| **Go** | go test | `go test ./... -v` | `*_test.go` |
| **Rust** | cargo test | `cargo test -- --nocapture` | `#[cfg(test)]` modules |
| **Java** | JUnit + Gradle/Maven | `./gradlew test` or `mvn test` | `*Test.java`, `*Spec.java` |

#### Coverage Gate Hook (pre-tool-coverage-gate.sh)

| Language | Tool | Command | Output Format |
|----------|------|---------|---------------|
| **Node.js** | istanbul (via Vitest) | `npx vitest run --coverage --reporter=json` | `coverage/coverage-final.json` |
| **Python** | coverage.py + pytest | `pytest --cov --cov-report=json` | `coverage.json` |
| **Go** | go cover | `go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out` | Text (parse with grep) |
| **Rust** | cargo-tarpaulin | `cargo tarpaulin --out json` | `tarpaulin-report.json` |
| **Java (Gradle)** | JaCoCo | `./gradlew jacocoTestReport` | `build/reports/jacoco/test/jacocoTestReport.xml` |

#### Security Gate Hook (pre-tool-security-gate.sh)

Language-independent. The same patterns apply across all stacks:
- Block `rm -rf /`, `git push --force`, `curl|sh`
- Block access to `.env`, credentials, secrets files
- The only adaptation: add language-specific secret file patterns (e.g., `.pypirc` for Python, `credentials.json` for GCP)

#### Package Manager Detection

| Language | Lock File | Manager | Install Command |
|----------|-----------|---------|-----------------|
| Node.js | `package-lock.json` | npm | `npm ci` |
| Node.js | `pnpm-lock.yaml` | pnpm | `pnpm install --frozen-lockfile` |
| Node.js | `yarn.lock` | yarn | `yarn install --frozen-lockfile` |
| Python | `requirements.txt` | pip | `pip install -r requirements.txt` |
| Python | `pyproject.toml` + `poetry.lock` | Poetry | `poetry install` |
| Go | `go.sum` | go mod | `go mod download` |
| Rust | `Cargo.lock` | cargo | `cargo fetch` |
| Java | `build.gradle` | Gradle | `./gradlew build` |
| Java | `pom.xml` | Maven | `mvn install` |

#### Generation Rules

1. During `/setup` Step 1, detect the tech stack and determine the language
2. In Phase 1, use the tables above to fill in the correct commands for each hook
3. If multiple languages are used (e.g., TypeScript frontend + Go backend), generate hooks that detect the file extension and dispatch to the appropriate tool
4. If the language is not in these tables, ask the developer: "What formatter/test runner/coverage tool do you use?"

### State Consistency Check (bootstrap hook)

`session-start-bootstrap.sh` must verify consistency between PROGRESS.md and feature-list.json on every session start:
- If PROGRESS.md marks a feature as "Complete" but feature-list.json has `passes: false` (or vice versa), output a warning with the conflicting feature IDs.
- The agent must resolve the inconsistency before proceeding with new work.

### Coverage Gate Hook (pre-tool-coverage-gate.sh)

Blocks `git commit` when test coverage for the current feature's `tdd_focus` functions is insufficient. This **enforces TDD completion at the system level**, preventing commits that skip the TDD cycle.

**Logic**:
1. Parse stdin JSON to detect `git commit` commands (same pattern as doc-sync-check)
2. If commit message contains `[skip-coverage]`, allow (emergency bypass)
3. If commit message subject starts with `[bundled-tdd:red]`, allow (test-only commit for `bundled-tdd` strategy — impl does not exist yet by design; the subsequent `[bundled-tdd:green]` commit is where coverage is enforced)
4. Read `feature-list.json` to identify the current feature's `tdd_focus` functions and `test_strategy`
5. **Branch by `test_strategy`**:
   - `"tdd"` (default): Run coverage, check each `tdd_focus` function has >= 100% line coverage
   - `"bundled-tdd"`: Same coverage enforcement as `"tdd"` (100% line on tdd_focus). Applies to `[bundled-tdd:green]` commits and the final folded feature commit.
   - `"state-verification"`: Skip per-function coverage check; only verify test files exist for the feature's module
   - `"integration"`: Skip per-function check; only verify overall file coverage >= 60%
6. Parse structured coverage JSON (not plain text grep) to check function coverage
7. **Two-tier result for `tdd` / `bundled-tdd` strategy**:
   - Function found in fnMap with 0 calls → **UNCOVERED** (exit 2, block commit)
   - Function NOT found in fnMap → **WARNING** (print warning, exit 0, allow commit). Try `statementMap` line-range fallback before warning.
8. If all covered, no tdd_focus defined, or `test_strategy` is `"state-verification"` / `"integration"`: **exit 0** (allow)

**Template** (generated by `/setup` Phase 1, adapted per tech stack):

```bash
#!/usr/bin/env bash
set -euo pipefail

# Read tool input from stdin
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only check git commit commands
[[ "$TOOL" != "Bash" ]] && exit 0
echo "$COMMAND" | grep -qE '^git\s+commit' || exit 0

# Emergency bypass
echo "$COMMAND" | grep -q '\[skip-coverage\]' && exit 0

# bundled-tdd red commit: test-only commit; impl does not exist yet by design.
# Coverage is enforced on the subsequent [bundled-tdd:green] commit instead.
echo "$COMMAND" | grep -q '\[bundled-tdd:red\]' && exit 0

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FEATURE_LIST="$PROJECT_ROOT/feature-list.json"
[[ ! -f "$FEATURE_LIST" ]] && exit 0

# Find current feature (first passes: false)
CURRENT=$(jq -r '[.[] | select(.passes == false)][0] // empty' "$FEATURE_LIST")
[[ -z "$CURRENT" ]] && exit 0

# Read test_strategy (default: "tdd")
TEST_STRATEGY=$(echo "$CURRENT" | jq -r '.test_strategy // "tdd"')

TDD_FOCUS=$(echo "$CURRENT" | jq -r '.tdd_focus // [] | .[]')
[[ -z "$TDD_FOCUS" ]] && exit 0

# For state-verification: only check test files exist
if [[ "$TEST_STRATEGY" == "state-verification" ]]; then
  # Verify at least one test file exists for the feature's module
  CATEGORY=$(echo "$CURRENT" | jq -r '.category // empty')
  if find "$PROJECT_ROOT/src" -path "*$CATEGORY*" -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | grep -q .; then
    exit 0
  fi
  echo "WARNING: No test files found for $CATEGORY module (test_strategy: state-verification)." >&2
  exit 0  # Warn but do not block
fi

# For integration: check overall file coverage threshold
if [[ "$TEST_STRATEGY" == "integration" ]]; then
  {COVERAGE_COMMAND} 2>/dev/null || true
  COVERAGE_FILE="$PROJECT_ROOT/coverage/coverage-final.json"
  if [[ -f "$COVERAGE_FILE" ]]; then
    # Check overall coverage meets 60% threshold
    OVERALL=$(jq '[.[] | .s | to_entries | .[] | .value] | if length == 0 then 100 else (([.[] | select(. > 0)] | length) / length * 100) end' "$COVERAGE_FILE" 2>/dev/null || echo "100")
    if (( $(echo "$OVERALL < 60" | bc -l 2>/dev/null || echo 0) )); then
      echo "BLOCKED: Overall coverage ${OVERALL}% is below 60% threshold (test_strategy: integration)." >&2
      exit 2
    fi
  fi
  exit 0
fi

# tdd strategy: structured coverage check with two-tier results
# {COVERAGE_COMMAND} is replaced during generation
{COVERAGE_COMMAND} 2>/dev/null || true

COVERAGE_FILE="$PROJECT_ROOT/coverage/coverage-final.json"
[[ ! -f "$COVERAGE_FILE" ]] && { echo "WARNING: Coverage report not generated, skipping gate." >&2; exit 0; }

UNCOVERED=()
WARNINGS=()

for FUNC in $TDD_FOCUS; do
  # Search for function in fnMap (structured JSON lookup)
  FOUND_KEY=$(jq -r --arg fn "$FUNC" '
    [to_entries[] | .value.fnMap as $m | .value.f as $f |
     $m | to_entries[] | select(.value.name == $fn) |
     {file_key: .key, count: $f[.key]}] | .[0] // empty
  ' "$COVERAGE_FILE" 2>/dev/null || true)

  if [[ -n "$FOUND_KEY" && "$FOUND_KEY" != "null" ]]; then
    COUNT=$(echo "$FOUND_KEY" | jq -r '.count // 0')
    if [[ "$COUNT" == "0" ]]; then
      UNCOVERED+=("$FUNC (0 calls)")
    fi
  else
    # Function not in fnMap — try statementMap line-range fallback
    # (arrow functions, re-exports may appear in statements but not fnMap)
    STMT_HIT=$(jq -r --arg fn "$FUNC" '
      [to_entries[] | .key as $file |
       .value.statementMap as $sm | .value.s as $s |
       $sm | to_entries[] |
       select(.value.start.line != null) |
       {key: .key, file: $file}] |
      length
    ' "$COVERAGE_FILE" 2>/dev/null || echo "0")

    WARNINGS+=("$FUNC (not found in fnMap — verify manually)")
  fi
done

# Print warnings (non-blocking)
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo "COVERAGE WARNING for tdd_focus functions:" >&2
  for w in "${WARNINGS[@]}"; do
    echo "  ⚠ $w" >&2
  done
  echo "These functions were not found in the coverage report (arrow function, re-export, or inlined)." >&2
  echo "Verify coverage manually. This does NOT block the commit." >&2
fi

# Block only on confirmed uncovered functions
if [[ ${#UNCOVERED[@]} -gt 0 ]]; then
  echo "BLOCKED: tdd_focus functions missing test coverage:" >&2
  for u in "${UNCOVERED[@]}"; do
    echo "  ✗ $u" >&2
  done
  echo "Write tests first (TDD Red phase), then commit." >&2
  echo "Bypass: include [skip-coverage] in commit message." >&2
  exit 2
fi

exit 0
```

> **Tech stack adaptation**: During `/setup` Phase 1, replace `{COVERAGE_COMMAND}` with the appropriate coverage command for the project's tech stack (see table below). When generating the hook, also adapt the coverage JSON parsing to match the tool's output format.
>
> **Two-tier result philosophy**: "Function not found in fnMap" and "function has 0 calls" are fundamentally different. The former often happens with arrow functions, anonymous exports, or bundler-inlined code — false positives that should warn, not block. The latter is a genuine TDD gap that must block the commit.

#### Language-Specific Coverage Parsing Guide

| Pattern | Istanbul/V8 (JS/TS) | coverage.py (Python) | go cover |
|---------|---------------------|----------------------|----------|
| Named function | `fnMap[].name` match | `functions[].name` match | Function name in text output |
| Arrow / lambda | Not in fnMap; check `statementMap` line ranges | In `functions` if assigned to named variable | N/A (Go has no lambdas) |
| Re-export / barrel | Not in fnMap of re-exporting file; check origin file | N/A | N/A |
| Class method | `fnMap[].name` = `ClassName.methodName` | `functions[].name` | `(*Type).Method` in text output |
| Default export | May appear as `default` in fnMap; match by line range | Named in `functions` | N/A |

> During `/setup`, use this table to generate the appropriate fnMap parsing logic per tech stack. For languages not listed, fall back to line-range matching in statementMap/equivalent.

### Feature Status Auto-Update (scripts/update-feature-status.sh)

Automatically sets `passes: true` in `feature-list.json` after a successful commit that includes the feature's `tdd_focus` test files. This prevents the "all features implemented but none marked as passing" tracking drift.

**Called by**: The orchestrator or `/start` flow after Step 7 (Single Commit) succeeds.

**Logic**:
1. Accept feature ID as argument (e.g., `FEAT-001`)
2. Read `feature-list.json`, find the matching feature
3. Verify the feature's `tdd_focus` functions have passing tests (run test suite)
4. If all tests pass: update `passes: false` → `passes: true` using `jq`
5. Update `PROGRESS.md` current_feature field
6. Stage and include in the commit (or create a follow-up micro-commit)

**Template**:

```bash
#!/usr/bin/env bash
set -euo pipefail

FEAT_ID="${1:?Usage: update-feature-status.sh FEAT-XXX}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FEATURE_LIST="$PROJECT_ROOT/feature-list.json"

# Verify feature exists and is currently passes: false
CURRENT=$(jq -r ".[] | select(.id == \"$FEAT_ID\") | .passes" "$FEATURE_LIST")
if [[ "$CURRENT" != "false" ]]; then
  echo "[skip] $FEAT_ID is already passes: $CURRENT"
  exit 0
fi

# Run tests to verify feature is actually complete
# {TEST_COMMAND} is replaced during generation
if ! {TEST_COMMAND} >/dev/null 2>&1; then
  echo "[FAIL] Tests did not pass. Cannot mark $FEAT_ID as complete."
  exit 1
fi

# Update feature-list.json
jq "map(if .id == \"$FEAT_ID\" then .passes = true else . end)" "$FEATURE_LIST" > "$FEATURE_LIST.tmp"
mv "$FEATURE_LIST.tmp" "$FEATURE_LIST"

echo "[OK] $FEAT_ID marked as passes: true"
```

---

## 3. Domain Persona

### Purpose

Agents need persistent, project-level domain context — not just what to implement, but why it matters, what business rules are non-negotiable, and what terms mean in this specific domain. Without this, agents make locally correct but globally wrong decisions (e.g., implementing password hashing without awareness of compliance requirements).

### Extraction

Domain persona is extracted from the plan MD during `/setup` Step 1 (Analyze Plan and Report) and generated as `.claude/domain-persona.md` in Phase 1 (Infrastructure). This ensures all subsequent phases (Protocols, Agents, Skills) can reference domain context during generation.

**Extraction rules**:
1. Read the plan MD for explicit business context: purpose statements, user stories, regulatory mentions, business rules, entity definitions, non-functional requirements.
2. Infer implicit domain knowledge from feature descriptions (e.g., features mentioning "HIPAA", "PCI", "GDPR" → compliance stakeholder concerns; entity relationships → key entities).
3. Present the draft to the user for confirmation — domain knowledge is too critical to get wrong silently.
4. Mark uncertain extractions with `{TODO: confirm}`.

### Format Template

```markdown
# Domain Persona

## Purpose
{1-2 sentences: what this system does and why it exists. Not what it's built with — why it matters.}

## Key Entities
| Entity | Definition | Invariants |
|--------|-----------|------------|
| {e.g., Order} | {what it represents in this domain} | {rules that must never be violated} |

## Domain Rules
- {rule 1: e.g., "Discount is applied before tax — legal requirement in KR jurisdiction"}
- {rule 2: e.g., "Passwords must be hashed with bcrypt (min cost 12) per SOC2 compliance"}

## Vocabulary
| Term | Means | Not |
|------|-------|-----|
| {e.g., "active user"} | {logged in within 30 days} | {ever registered} |

## Stakeholder Concerns
- {e.g., "Regulatory: GDPR data residency for EU users"}
- {e.g., "Performance: checkout flow must complete in < 2s P99"}

## Success Criteria
- {criterion 1: measurable outcome the system must achieve}
```

**Constraints**: ~400-600 tokens. Each section answers a specific question:
- **Purpose**: "Why does this system exist?" (guards against scope creep)
- **Key Entities**: "What are the core nouns and their constraints?" (prevents naming drift)
- **Domain Rules**: "What business logic is non-negotiable?" (prevents implementation shortcuts)
- **Vocabulary**: "What do terms actually mean?" (prevents ambiguity)
- **Stakeholder Concerns**: "What non-functional requirements matter?" (guides tradeoff decisions)
- **Success Criteria**: "How do we know we're done?" (anchors acceptance testing)

### Validation Criteria

- File exists at `.claude/domain-persona.md`
- All 6 sections present (Purpose, Key Entities, Domain Rules, Vocabulary, Stakeholder Concerns, Success Criteria)
- Key Entities table has >= 2 rows
- Domain Rules has >= 2 items
- No `{TODO: confirm}` markers remain after user confirmation

### Agent Domain Views

The orchestrator acts as the **domain context broker**. When selecting a feature and calling sub-agents, it extracts the relevant subset from domain-persona.md based on the feature's `category` and `tdd_focus` fields.

| Agent | Domain View | Mechanism |
|-------|------------|-----------|
| orchestrator, architect, debugger | Full persona | Agent MD: "Read `.claude/domain-persona.md`" |
| reviewer | Entities + Rules + Vocabulary | Inlined in Agent MD `## Domain Context` section |
| implementer | Feature-scoped entities + rules | Orchestrator includes in task prompt |
| tdd-test-writer | Feature-scoped entities + invariants | Implementer includes in sub-agent prompt |
| tdd-implementer | Feature-scoped entities + rules | Implementer includes in sub-agent prompt |
| tdd-refactorer | Vocabulary only (naming consistency) | Implementer includes in sub-agent prompt |
| tdd-bundler (conditional) | Feature-scoped entities + rules | Implementer includes in sub-agent prompt |
| tester | Success criteria + rules | Agent MD section |

### Code-Doc Sync Integration

Add `domain-persona.md` to the code-doc sync mapping so changes to domain-critical code (entities, business rules) trigger a doc-sync check:

```
# Domain context sync
src/domain/**      → .claude/domain-persona.md (Key Entities, Domain Rules)
src/models/**      → .claude/domain-persona.md (Key Entities)
```

### Context Map Integration

With domain-persona.md handling *semantic* context (why), context-map.md handles *structural* context (what). Context-map.md should include:

```markdown
# Context Map

## Bounded Contexts
| Context | Owner Module | Key Entities (from domain-persona.md) |
|---------|-------------|---------------------------------------|
| {e.g., Authentication} | src/auth/ | User, Credential |

## Context Relationships
| Upstream | Downstream | Integration Pattern |
|----------|-----------|-------------------|
| Auth | Orders | Shared Kernel (User ID) |

## Module-to-Domain Mapping
| Module | Domain Rules (from domain-persona.md) | Notes |
|--------|---------------------------------------|-------|
| src/auth/ | Rules #1, #2 | Password and session rules |
```

---

## 4. Cross-Session State Management

### Initializer Mode (First Session)
Auto-detected when PROGRESS.md doesn't exist or is empty:

#### Checkpoint / Resume
If `/setup` is interrupted mid-phase, PROGRESS.md records `last_completed_phase: N`. On re-running `/setup`, the system **auto-resumes from Phase N+1** without prompting (when `N ∈ {1..5}`). A prompt is shown only when the existing state is ambiguous — `setup_complete` (ask Exit vs Overwrite) or a missing/corrupt `last_completed_phase` value.

1. Load detailed plan MD → **confirm tech stack** (see rules below) → **assess architecture pattern** (see rules below)
2. Generate feature-list.json (all features `passes: false`)
3. Create initial PROGRESS.md
4. Environment validation + dependency installation run inline as part of Phase 1 infrastructure generation (no separate bootstrap script)
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

### Language Settings

Four language scopes, each with an explicit rule:

- **Machine-facing file language: always English.** Files parsed programmatically, loaded into LLM context at session start, or executable code — `CLAUDE.md`, `PROGRESS.md`, `feature-list.json`, `.claude/**/*.md` (agents, skills, protocols, domain-persona, context-map, environment, security, quality-gates, error-recovery, observability), `hooks/*.sh`, `scripts/*.sh` — are written in English regardless of the user's locale. This is non-negotiable: locale variance here breaks hook parsing (e.g., `session-start-bootstrap.sh` awk/grep over PROGRESS.md) and introduces LLM comprehension friction on every session load. No locale detection, no `conversation_language` lookup for these files.
- **User-facing doc language: `conversation_language`**. `README.md` and `CHANGELOG.md` follow the user's locale. These files are humans-only — no hook parses them, no agent loads them for logic. During `/start`, when the orchestrator appends a feature-completion entry to `CHANGELOG.md` under `## [Unreleased]`, the human description text is written in `conversation_language`. Keep a Changelog structural headings (`## [Unreleased]`, `## [0.1.0]`, `### Added`, `### Changed`, `### Fixed`, `### Removed`) remain English as standard format markers per the Keep a Changelog spec.
- **Conversation language**: Auto-detected from the system locale (`$LANG` or equivalent). Controls the human-facing text that `/setup` and `/start` print to the user (spinner messages, question prompts, summaries, status updates) and the content of `README.md` / `CHANGELOG.md` description text. No question asked — recorded automatically in `environment.md` as `conversation_language`. Never affects machine-facing files.
- **Code comment language**: Explicitly chosen by the user during Step 1.2. Stored in `environment.md` as `comment_language`. Referenced by tdd-implementer, tdd-refactorer, and reviewer agents when enforcing Comment Rules (Section 7.2). All file headers, JSDoc, section dividers, and inline why-comments inside source files must be written in this language. Applies to *comments inside source code* only — never to any `.md` file.

### Tech Stack Storage

Once selected, the tech stack is recorded in exactly two places:
- `CLAUDE.md`: one-line summary (e.g., "Stack: Next.js 14 + TypeScript + Prisma + PostgreSQL")
- `.claude/environment.md`: full detail (versions, package manager, runtime requirements, dev dependencies, conversation_language, comment_language)

### .gitignore Generation (Phase 1)

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

### README.md Generation (Phase 2)

Generate `README.md` in `conversation_language` (per the "User-facing doc language" rule above — `README.md` is a Tier 2 user-facing file and follows the user's locale). Structure:

1. **Project title** — from plan MD title
2. **Description** — 2-3 sentences summarizing the project purpose (from plan)
3. **Tech Stack** — badges or list of technologies selected in Step 1.3
4. **Getting Started** — prerequisites, installation commands, run commands (derived from tech stack)
5. **Project Structure** — directory tree overview (condensed, key directories only)
6. **Development** — brief TDD workflow explanation, how to use `/start`
7. **License** — placeholder (`TODO: Add license`)

The README should be professional and specific to the project — not generic boilerplate. Extract real project details from the plan MD.

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
  "depends_on": [],
  "test_strategy": "tdd",
  "acceptance_test": ["Signup form input", "Account creation confirmation", "Duplicate email error"],
  "tdd_focus": ["validateSignupInput", "createUser", "hashPassword"],
  "doc_sync": ["docs/api.md", "src/api/CLAUDE.md"],
  "passes": false
}]
```

#### Field Reference

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

#### `depends_on` — Feature Dependency Tracking

Array of feature IDs that must have `passes: true` before this feature can be started. Empty array or omitted means no dependencies.

```jsonc
// Example: merging depends on physics engine and fruit creation
{ "id": "F-04", "depends_on": ["F-01", "F-02"], ... }
```

#### `test_strategy` — Per-Feature Test Strategy

Determines the test workflow and quality gate criteria for each feature:

| Value | When to Use | Workflow | Gate 0 | Gate 3 (Coverage) |
|-------|-------------|----------|--------|-------------------|
| `"tdd"` (default) | Pure logic functions (validators, calculators, state machines) with high context-leak risk or tight invariants | Red → Green → Refactor (3 isolated sub-agents) | Full TDD evidence | tdd_focus 100% line coverage |
| `"bundled-tdd"` | Pure logic with clear spec and low leak risk; speed over strict isolation | Bundled Red→Green (single `tdd-bundler`, test committed before impl) → optional Refactor | 2-commit red→green sequence: `[bundled-tdd:red]` commit shows failing test output, `[bundled-tdd:green]` commit shows pass | tdd_focus 100% line coverage |
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

### PROGRESS.md Structure

#### Field Schema

All fields below are **required**. The Phase 6 generator MUST emit every field with the initial value shown; orchestrator and hooks rely on their presence.

| Section | Field | Type | Initial value (Phase 6) | Updated by | Valid values |
|---------|-------|------|-------------------------|------------|--------------|
| `## Status` | `last_completed_phase` | int or string | `setup_complete` | `/setup` Phase 1-6 checkpoints, then frozen | `1`..`6`, `setup_complete` |
| `## Status` | `current_feature` | string | `""` (empty) | orchestrator on feature start/complete | `FEAT-XXX` or `""` |
| `## Status` | `mode` | enum | `initializer` | orchestrator (→ `coding` after first feature) | `initializer`, `coding` |
| `## Status` | `execution_mode` | enum | value chosen in `/setup` Step 1.5 | frozen (re-`/setup` to change) | `sub-agent`, `agent-team`, `hybrid` |
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

#### Initial Template (emitted by Phase 6)

```markdown
# PROGRESS.md

## Status
- last_completed_phase: setup_complete
- current_feature: ""
- mode: initializer
- execution_mode: agent-team      # default. Override to "sub-agent" / "hybrid" per /setup Step 1.5

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

#### Example (mid-development)

```markdown
# PROGRESS.md

## Status
- last_completed_phase: setup_complete
- current_feature: FEAT-003
- mode: coding
- execution_mode: agent-team

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

---

## 5. TDD Sub-Agent Context Isolation

When TDD is performed in a single context, the test writer's analysis leaks to the implementer.
Separating Red/Green/Refactor into distinct sub-agents prevents this.

| Sub-Agent | Phase | Rules | Model |
|-----------|-------|-------|-------|
| `tdd-test-writer` | Red / State-Test (for `tdd` / `state-verification`) | Write tests from interfaces only, without reading implementation code | sonnet |
| `tdd-implementer` | Green / Implement (for `tdd` / `state-verification`) | Write only the minimal code needed to pass tests. Apply Comment Rules (Section 7.2) | sonnet |
| `tdd-refactorer` | Refactor (all TDD strategies) | No behavior changes allowed. Verify and supplement Comment Rules compliance | sonnet |
| `tdd-bundler` | Bundled Red→Green (for `bundled-tdd` only) | Write failing test first, commit it, run and capture red output, then write minimal implementation and commit. MUST NOT edit test content once green phase starts | sonnet |

> `tdd-bundler` is a speed-oriented alternative to the three-agent isolation. It trades strict context separation (test-writer never sees impl) for a lighter 1-2 sub-agent cycle. To counter the co-drift risk, it enforces a 2-commit sequence (`[bundled-tdd:red]` → `[bundled-tdd:green]`) that the reviewer and Gate 0 verify via git log — the red commit's test file must remain byte-identical in the green commit.

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
- **Apply Comment Rules (Section 7.2)**: file header for new files, JSDoc for public functions, why-comments for non-obvious logic
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
- **Verify Comment Rules compliance (Section 7.2)**: check file headers, JSDoc, key constant/type descriptions. Supplement missing comments during refactoring
- Return: changed file list + test results
```

```markdown
---
name: tdd-bundler
description: Bundled TDD (Red→Green) for features with test_strategy "bundled-tdd". Writes failing test, commits it, then writes minimal implementation. Produces a 2-commit red→green sequence.
tools: Read, Glob, Grep, Write, Edit, Bash
model: sonnet
effort: medium
---
# TDD Bundler (Bundled Red→Green Phase)

## Rules
- **Test-first output ordering is mandatory**: write the complete test file first; run the test suite to capture failing output; commit tests only with a message starting `[bundled-tdd:red]`. Only then write the implementation.
- **Test file is frozen once committed**: during the green step, do NOT edit the test file. If the test turns out to be wrong, abort the cycle and restart (counts toward the 5-iteration limit).
- Write **minimal** implementation to pass the tests. Apply Comment Rules (Section 7.2).
- Commit the implementation with a message starting `[bundled-tdd:green]`. Both commits share the same feature ID in their body.
- Return: two commit SHAs (red, green) + test results + list of files changed in each commit.

## Forbidden
- Starting implementation work before the red commit is recorded
- Editing the test file in the green commit (reviewer and Gate 0 verify byte-identity via `git diff <red-sha> <green-sha> -- <test-file>`)
- Squashing the two commits into one (breaks the red→green evidence chain)
```

### File Classification for tdd-test-writer

The "do not read implementation code" rule applies to:
- **Forbidden**: `src/**/*.{ts,js,py,go,...}` (domain logic files — excluding type/interface definitions)
- **Allowed**: type definition files (`*.d.ts`, `*.types.ts`, `*.interface.ts`), test files (`*.test.*`, `*.spec.*`), config files, documentation

The implementer agent must pass the allowed file list to tdd-test-writer's prompt.

### Implementer's TDD Orchestration Flow

```
# test_strategy = "tdd" (strict 3-agent isolation)
Plan → Red(tdd-test-writer) → Green(tdd-implementer) → Refactor(tdd-refactorer)
  → Verify(full test suite + feature verification) → on failure, return to Green/Red (max 5 iterations)
  → Doc Sync → single feature commit (code + tests + docs)

# test_strategy = "bundled-tdd" (speed-oriented, 1-2 sub-agents)
Plan → BundledRedGreen(tdd-bundler)
        ├─ write test → commit [bundled-tdd:red] with failing output captured
        └─ write impl  → commit [bundled-tdd:green] with passing output captured
  → Refactor(tdd-refactorer) — optional, skip if impl is already clean
  → Verify(full test suite + feature verification) → on failure, restart cycle (max 5 iterations)
  → Doc Sync → final feature commit squashes/amends as needed so Gate 4 sees one logical feature commit containing both red and green internal commits (see Gate 4 Rollback note)
```

> **Gate 4 rollback compatibility for `bundled-tdd`**: the two internal commits (`[bundled-tdd:red]` and `[bundled-tdd:green]`) together form one logical feature unit. Per the per-feature commit discipline, the implementer performs `git rebase --interactive` or `git reset --soft + git commit` before Gate 4 to fold them into a single `feat(FEAT-XXX): ...` commit — but keeps the red→green evidence as commit trailers (`red-sha: <sha>`, `green-sha: <sha>`) so Gate 0 reviewers can still verify. No other strategy needs this step.

### Context Window Limits

Sub-agents have independent context windows. If a sub-agent's context fills (large test suites, many files):
- The implementer should split the feature's tdd_focus into smaller batches
- Each batch runs a full Red-Green-Refactor cycle independently
- This is an escalation condition: report to user if a single tdd_focus function cannot fit in one sub-agent context

---

## 6. Model Routing

Agents where reasoning is critical use Opus; agents where code generation is critical use Sonnet.
Specified via the frontmatter `model:` field.

```
Opus (judgment) ── orchestrator, architect, reviewer, debugger
Sonnet (execution) ── implementer, tdd-×3 (test-writer / implementer / refactorer), tdd-bundler, tester
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

## 7. Code Style, Linting, and Comment Rules

### 7.1 Code Style

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

### 7.2 Comment Rules

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

### 7.3 Logging Design Rules

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

## 8. Skills — Anthropic Agent Skills Format

> **Reference**: Skills follow the [Anthropic Agent Skills Specification](https://github.com/anthropics/skills).
> All generated skills must comply with this spec while embedding harness-specific sections (TDD Focus, Rationalizations, Red Flags).

### 8.1 Skill Directory Structure

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

### 8.2 YAML Frontmatter Schema

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

### 8.3 SKILL.md Body — 7-Section Anatomy

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
| "{tempting shortcut 3}" | {specific, compelling counter-argument} |

> Minimum 3 rows required. Each rebuttal must be specific to THIS skill's domain.
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

### 8.4 Progressive Disclosure (3-Tier Token Budget)

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

### 8.5 Description Writing Guide

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

### 8.6 Skill List

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

#### Project-Type Skill Adaptation

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

### 8.7 Complete Skill Example

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
- [ ] Coverage: 100% line on `tdd_focus`, no regression overall (evidence: coverage report)
- [ ] feature-list.json `passes: true`
- [ ] PROGRESS.md updated with `iteration_count` and `duration`
```

### 8.8 Skill Generation Validation Checklist

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

---

## 9. Agent Definitions

### 9.0 Execution Mode & Team Architecture

> Patterns adapted from [revfactory/harness](https://github.com/revfactory/harness) (Apache-2.0). Full reference: `docs/references/agent-design-patterns.md`.

#### Execution Mode Selection

During `/setup` Step 1, analyze the plan to determine the best execution mode for the generated harness:

| Mode | When to Use | Tools |
|------|-------------|-------|
| **Agent Team** (baseline default) | 2+ independent modules, parallel development, real-time coordination needed | `TeamCreate`, `SendMessage`, `TaskCreate` |
| **Sub-agent** (sequential fallback) | 1 module or tightly-coupled feature set where team communication overhead exceeds parallelism benefit | `Agent` tool |
| **Hybrid** | Phase-by-phase mode switching (e.g., parallel implementation -> sequential integration) | Both tool sets per phase |

> **Why Agent Team is the default**: harness-boot is a multi-agent harness by design. Making Agent Team the default aligns the surfaced behavior with the project's stated intent and reduces the friction of users selecting "Sub-agent" without understanding the trade-off. Sub-agent remains available — and is the right choice — for single-module or tightly-coupled plans, but it is now an explicit downgrade rather than a silent default.

**Decision criteria from the plan:**

| Factor | Agent Team (default direction) | Sub-agent (downgrade direction) |
|--------|-------------------------------|--------------------------------|
| Module count | 2+ independent modules | 1 module, or modules that share so much state that parallel work would cause constant merge conflicts |
| Feature parallelism | Features can be worked on simultaneously | Features must be sequential |
| Integration complexity | Multiple cross-module boundaries | Few or no integration points |
| Domain categories | 2+ distinct categories | Single category, homogeneous work |

**Decision rules:**
1. **Default = Agent Team.** If the plan has 2+ independent modules (or distinct domain categories), recommend Agent Team with no further analysis.
2. If the plan is a single module, a single tightly-coupled file set, or a prototype/spike with 1-2 features -> **downgrade to Sub-agent** and mark Agent Team as the fallback-to-fallback.
3. If some phases are parallel and others strictly sequential (see Hybrid decision criteria in `docs/references/agent-design-patterns.md`) -> **recommend Hybrid**.
4. Always present the recommendation to the developer for confirmation (never auto-select). The selection UI must label choices as:
   - `Agent Team (parallel, ★ default)`
   - `Sub-agent (sequential fallback)`
   - `Hybrid (phase-switching)`

#### Team Architecture Patterns

When Agent Team or Hybrid mode is selected, choose an architecture pattern:

| Pattern | Use When | Example |
|---------|----------|---------|
| **Fan-out/Fan-in** | Independent modules, parallel work | Frontend + Backend + Infra teams |
| **Pipeline** | Sequential dependencies | Analysis -> Design -> Implement -> Test |
| **Supervisor** | Dynamic work assignment needed | Feature supervisor distributes to workers |
| **Producer-Reviewer** | Quality assurance critical | Implementer -> Reviewer feedback loops |

> Full pattern descriptions with composite patterns: `docs/references/agent-design-patterns.md`

#### Data Transfer Protocols

Specify in the orchestrator how agents share work products:

| Strategy | Method | Mode | Best When |
|----------|--------|------|-----------|
| **Message** | `SendMessage` | Team | Real-time coordination, lightweight state |
| **Task** | `TaskCreate`/`TaskUpdate` | Team | Progress tracking, dependency management |
| **File** | Write/Read to `_workspace/` | Both | Large data, structured outputs, audit trail |
| **Return** | `Agent` tool return | Sub | Results collected by main agent |

File-based transfer rules:
- `_workspace/` folder for intermediate outputs
- Convention: `{phase}_{agent}_{artifact}.{ext}`
- Final outputs only to user-specified paths; preserve `_workspace/` for audit trail

#### QA Agent Integration

> Full guide: `docs/references/qa-agent-guide.md`

When the plan has 3+ modules with integration points, generate a QA agent:
- **Model**: opus (boundary verification requires judgment)
- **Type**: `general-purpose` (needs to run verification scripts, not read-only)
- **Core method**: "Read Both Sides Simultaneously" — cross-compare producer output with consumer input at every boundary
- **Timing**: Incremental after each module completion, not just at the end
- **Team mode**: QA agent as permanent team member receiving completion notifications

Add to the generated harness:
- `.claude/agents/qa-agent.md`
- QA step in orchestrator workflow (after module TDD completes, before Gate 2 review)
- Boundary mismatches classified as Critical severity in Gate 2

#### Team Communication Protocol for Agents

When Agent Team mode is selected, **only agents that actually exchange team messages** add a `## Team Communication Protocol` section: `orchestrator`, module-specific implementers, `reviewer`, and `qa-agent` (when included). `architect`, `debugger`, `tester`, and the `tdd-*` sub-agents (test-writer / implementer / refactorer / bundler) **omit the section** — they are invoked via the `Agent` tool inside an implementer cycle or on escalation, not through team messaging, so a placeholder section would be empty ceremony.

For agents that include the section, it must specify:
- **Receive from**: Who sends what messages
- **Send to**: Who receives what messages
- **Task requests**: What task types from shared task list

> Orchestrator templates per mode: `docs/references/orchestrator-template.md`

#### Execution Mode Storage

Once selected, the execution mode is recorded:
- `CLAUDE.md`: appended to stack summary (e.g., "Execution: Agent Team (Fan-out/Fan-in)")
- `.claude/environment.md`: dedicated section with mode, team architecture pattern, data transfer protocol, team size
- Orchestrator agent: `metadata.execution-mode` field in `.claude/agents/orchestrator.md` YAML frontmatter

#### Orchestrator Agent Frontmatter

```yaml
---
name: orchestrator
description: >
  Orchestrates the development workflow. Mode switching, task decomposition,
  TDD enforcement, quality gate coordination.
tools: Read, Glob, Grep, Write, Edit, Bash, Agent, TeamCreate, SendMessage, TaskCreate, TaskUpdate
model: opus
metadata:
  execution-mode: agent-team  # default. Override to sub-agent / hybrid per /setup Step 1.5
---
```

When Sub-agent mode: drop `TeamCreate, SendMessage, TaskCreate, TaskUpdate` from tools (leave only `Agent`); set `execution-mode: sub-agent` and record rationale in `metadata.execution-mode-rationale` (e.g., "single module", "tightly-coupled feature set").

### 9.1 Common Input/Output

```jsonc
// Input
{ "task_id": "", "type": "feature|bugfix|refactor|test", "description": "",
  "target_files": [], "acceptance_test": [],
  "tdd_focus": [], "doc_sync_targets": [], "feature_id": "FEAT-XXX",
  "domain_context": { "entities": [], "rules": [], "vocabulary": {} } }

// Output
{ "task_id": "", "status": "success|failure|partial|blocked", "iteration_count": 0,
  "changes": { "code": [], "tests": [], "docs": [] },
  "test_results": { "total": 0, "passed": 0, "failed": 0, "coverage": "" },
  "feature_passes": false, "blockers": [], "notes": "" }
```

### 9.2 Agent Roles

| Agent | Model | Core Role | Domain View |
|-------|-------|-----------|-------------|
| **orchestrator** | opus | Initializer/Coding mode switching, task decomposition, tdd_focus/doc_sync assignment, one-at-a-time | Full persona (reads domain-persona.md) |
| **implementer** | sonnet | Sequential TDD sub-agent calls, convergence loop management (max 5), single commit | Feature-scoped entities + rules (from orchestrator prompt) |
| **reviewer** | opus | 3-stage review: (1) TDD compliance (2) Code quality (3) Doc sync. REJECT if docs missing | Entities + Rules + Vocabulary (inlined in agent MD) |
| **tester** | sonnet | Core function selection, feedback with expected vs actual values | Success criteria + rules (agent MD section) |
| **architect** | opus | ADR writing, impact doc listing, schema changes require migration + docs together | Full persona (reads domain-persona.md) |
| **debugger** | opus | Root cause analysis, minimal fix, mandatory regression test | Full persona (reads domain-persona.md) |
| **tdd-test-writer** | sonnet | Red phase only (for `tdd` / `state-verification`). Does not read implementation code | Feature-scoped entities + invariants (from implementer prompt) |
| **tdd-implementer** | sonnet | Green phase only (for `tdd` / `state-verification`). Minimal implementation | Feature-scoped entities + rules (from implementer prompt) |
| **tdd-refactorer** | sonnet | Refactor phase (all TDD strategies). No behavior changes | Vocabulary only (from implementer prompt) |
| **tdd-bundler** (conditional) | sonnet | Bundled Red→Green for `bundled-tdd` features. Single-agent, 2-commit sequence (`[bundled-tdd:red]` → `[bundled-tdd:green]`). Included only when feature-list.json contains at least one `"test_strategy": "bundled-tdd"` entry | Feature-scoped entities + rules (from implementer prompt) |

### 9.3 Agent Rationalization Defense

Each generated agent MD must include a "Common Rationalizations" section (minimum 2 rows, matching the Skill requirement in Section 8). Domain-specific rebuttals only — do not pad with generic filler. Examples:

| Agent | Excuse | Rebuttal |
|-------|--------|----------|
| **orchestrator** | "This feature is simple, skip TDD" | All features with tdd_focus use TDD, no exceptions |
| **reviewer** | "Minor change, quick approval" | All changes get full 3-stage review regardless of size |
| **implementer** | "Tests are passing, skip refactor phase" | Refactor is mandatory even if no changes result |
| **debugger** | "I know the fix, skip root cause analysis" | Root cause must be documented; symptom fixes recur |
| **tdd-bundler** | "I'll tweak the test to match the impl — it's easier" | Editing the test after the red commit destroys the red→green evidence; Gate 0 blocks on test-file byte divergence between red and green commits. Abort and restart the cycle instead. |
| **tdd-bundler** | "Skip the red commit, just commit everything at once" | Red commit IS the evidence; without it Gate 0 cannot verify the test was ever failing. The two-commit sequence is non-negotiable for `bundled-tdd`. |

---

## 10. Quality Gates

> "Looks good" is not a passing criterion. Every gate requires **evidence**.

| Gate | Check | Evidence | Rationalization Defense |
|------|-------|----------|------------------------|
| **0: TDD** (prerequisite) | Tests exist for tdd_focus. Behavior varies by `test_strategy` (see below) | Test files, call order logs | "Too simple to need tests" → if tdd_focus specified, no exceptions |
| **1: Implementation** | 0 compile errors, 0 lint errors, all tests pass, docs changes included | tsc/eslint/test output, git diff | "Docs later" → hook blocks commit |
| **2: Review** | 0 Critical/Major issues + **Comment Rules compliance** (Section 7.2) | Reviewer feedback (file/line/severity) | "Trivial change, skip review" → all changes are reviewed |
| **3: Testing** | Coverage per `test_strategy` (see below); overall project coverage: no regression | Coverage report, execution logs | — |
| **4: Deploy** | Gates 0-3 pass, feature passes: true, rollback procedure ready | sync-docs pass log | "Worked in staging" → check environment differences |

> Gate 0 not met → Gates 1-4 cannot proceed.

### Gate Behavior by `test_strategy`

| Gate | `tdd` (default) | `bundled-tdd` | `state-verification` | `integration` |
|------|-----------------|---------------|---------------------|---------------|
| **Gate 0** | Full: test files exist, Red → Green order evidence from 3-agent cycle, happy/boundary/error cases | Full tdd_focus coverage + 2-commit red→green sequence (`[bundled-tdd:red]` fails, `[bundled-tdd:green]` passes, test file byte-identical between the two) | Relaxed: test files exist, tests pass, state assertions present | Relaxed: integration test file exists, tests pass |
| **Gate 3** | tdd_focus functions: 100% line coverage | tdd_focus functions: 100% line coverage (same as `tdd`) | Test files exist for module (no per-function coverage) | Overall file coverage >= 60% |

### Gate 0 Enforcement

The **implementer agent** checks Gate 0 before proceeding to Gate 1:
1. Verify test files exist for each `tdd_focus` item
2. **If `test_strategy` = `"tdd"`**: Verify Red phase produced failing tests (evidence: test runner output with failures), then Green phase made them pass
3. **If `test_strategy` = `"bundled-tdd"`**: Verify the two-commit sequence via git log:
   - A commit whose subject starts with `[bundled-tdd:red]` exists on the current feature branch and its body captures failing test output for the feature's `tdd_focus`.
   - A later commit whose subject starts with `[bundled-tdd:green]` exists and captures passing test output.
   - `git diff <red-sha> <green-sha> -- <test-files>` is empty (test files unchanged between red and green).
   - If any of these fail, Gate 0 fails.
4. **If `test_strategy` = `"state-verification"`**: Verify test files exist and include state assertions (not pixel-level rendering checks)
5. **If `test_strategy` = `"integration"`**: Verify integration test file exists and passes

If Gate 0 fails: return to Red/Implement phase (or restart the bundled cycle). This counts toward the 5-iteration convergence limit.
The **reviewer agent** independently re-checks Gate 0 compliance during Gate 2.

### Gate 2: Comment Rules Compliance

The **reviewer agent** checks Comment Rules (Section 7.2) as part of Gate 2:
- **File headers**: Every new source file must have a file header block (purpose, dependencies, related docs)
- **Public function JSDoc**: All exported functions must have JSDoc with parameter descriptions and business logic notes
- **Key constants/types**: Non-obvious constants and type definitions must have explanatory comments
- **Why-comments**: Complex logic, gotchas, and workarounds must have inline "why" comments

Missing comments → Severity: **Major** (does not block commit, but reviewer flags for correction before Gate 2 passes).

### Rollback Procedure (Gate 4 Requirement)

Before marking a feature as `passes: true`, verify:
1. All changes are in a single commit (enables `git revert <sha>`)
2. If a DB migration exists: a corresponding down-migration file must exist
3. If config changes exist: previous values are documented in the commit message

The rollback procedure is: `git revert <feature-commit-sha>` + run down-migrations if applicable.

---

## 11. Code-Doc Sync

### Triple Defense

| Layer | Mechanism | Timing |
|-------|-----------|--------|
| Prompt | code-doc-sync.md protocol | During work |
| Hook | pre-tool-doc-sync-check.sh | Just before git commit (blocking) |
| Review | Reviewer 3-stage review | During code review |

### Hook Logic (pre-tool-doc-sync-check.sh)

The doc-sync hook uses a **granular check** rather than blanket "any src → any md" enforcement:

1. Parse staged files as before (detect `git commit` command)
2. For each staged `src/` file, check if the diff contains **export changes**:
   ```bash
   git diff --cached -U0 -- "$SRC_FILE" | grep -qE '^\+.*export|^\-.*export'
   ```
3. **If no export lines changed** → internal refactoring (constants, implementation details). Skip doc requirement. Allow commit.
4. **If export changes detected** → read current feature's `doc_sync` targets from `feature-list.json`. Only require that those specific `.md` files are in the staged set.
5. **If feature has no `doc_sync` targets** (empty array) → fall back to blanket behavior: any `.md` file must be staged if `src/` changed.
6. `[skip-doc-sync]` in commit message → bypass all checks (emergency escape hatch)

> **Why granular?** Blanket "src changed → md required" causes friction on internal refactors, constant tweaks, and implementation optimizations that don't change module interfaces. This leads to `[skip-doc-sync]` overuse, defeating the purpose of the hook. The export-change heuristic catches genuine API changes while allowing internal work to flow freely.

### Mapping Table

The following is an **example** mapping. `/setup` generates a project-specific mapping table based on the plan's directory structure and tech stack. The hook enforces `doc_sync` targets per-feature from `feature-list.json`. The mapping table below is for human reference and reviewer use.

```
# Example (customize per project during /setup)
src/api/**          → docs/api.md, src/api/CLAUDE.md
src/components/**   → docs/components.md, src/components/CLAUDE.md
prisma/**           → docs/schema.md, .claude/environment.md
package.json        → .claude/environment.md

# These rules are always applied regardless of project
new directory       → add row to .claude/context-map.md (module → layer)
.claude/**          → CHANGELOG.md
feature complete    → feature-list.json (passes: true)
all changes         → PROGRESS.md
```

---

## 12. Learning / Evolution

> Harness evolution patterns adapted from [revfactory/harness](https://github.com/revfactory/harness) (Apache-2.0).

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

### Harness Evolution

The harness is not a static artifact — it evolves with user feedback.

#### Post-Execution Feedback

After each harness execution, offer the user a feedback opportunity (do not force):
- "Any improvements needed in the results?"
- "Want to change the agent team structure or workflow?"

#### Feedback Routing

| Feedback Type | Modify | Example |
|--------------|--------|---------|
| Output quality | Agent's skill | "Analysis too shallow" → add depth criteria to skill |
| Agent role | Agent definition `.md` | "Need security review too" → add agent |
| Workflow order | Orchestrator agent | "Verification should come first" → reorder phases |
| Team composition | Orchestrator + agents | "Merge these two agents" → consolidate |
| Trigger miss | Skill description | "Doesn't activate on this phrase" → expand description |

#### Change History

All project changes are tracked in CHANGELOG.md using [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Initial project setup via harness-boot
- {N} features defined in feature-list.json

## [0.1.0] - YYYY-MM-DD

### Added
- FEAT-001: {description}
- FEAT-002: {description}

### Changed
- FEAT-003: {description}

### Fixed
- FEAT-004: {description}
```

During `/start`, each feature completion appends an entry under `## [Unreleased]` with the appropriate category (Added/Changed/Fixed/Removed). Category is determined from the feature's description and the nature of the work performed.

**Language**: CHANGELOG.md is a Tier 2 user-facing file (see §4 Language Settings). The initial entry generated during `/setup` Phase 6 and every per-feature entry appended during `/start` are written in `conversation_language`. The Keep a Changelog structural markers (`## [Unreleased]`, `## [x.y.z]`, `### Added`, `### Changed`, `### Fixed`, `### Removed`) stay English as standard format per the Keep a Changelog spec — only the human description text following each `- ` bullet follows the user's locale.

#### Evolution Triggers

Proactively suggest harness evolution when:
- Same feedback type repeats 2+ times
- An agent fails repeatedly with the same pattern
- User manually bypasses the orchestrator to work directly

---

## 13. Error Recovery Playbook

### Purpose

`.claude/error-recovery.md` must contain **actionable recovery procedures**, not generic advice. The 5 scenarios below cover the most common failure modes in harness-driven development. During `/setup` Phase 6, generate error-recovery.md using these templates, adapted to the project's tech stack.

### Scenario Templates

#### Scenario 1: Gate 2 Consecutive Failure (> 5 iterations)

```markdown
## Gate 2: Consecutive Review Failure

**Trigger**: Reviewer rejects 5+ times on the same feature.

**Symptoms**:
- Same Critical/Major issues reappearing after fixes
- Iteration count reaching max (5) without convergence
- Implementer applying surface-level fixes that don't address root cause

**Recovery**:
1. STOP the TDD cycle. Do not attempt iteration 6+.
2. Save current state: `git stash` or commit with `[wip]` prefix
3. Run debugger agent for root cause analysis:
   - `Agent(debugger)` with prompt: "Analyze Gate 2 rejection history for FEAT-XXX. Identify the recurring pattern."
4. If architectural issue detected:
   - Call architect agent to propose structural fix
   - May require feature decomposition (split into smaller features)
5. If unclear: escalate to user with:
   - Rejection history summary (issue + attempted fix per iteration)
   - Debugger analysis
   - Proposed options (A: restructure, B: simplify scope, C: user decision)

**Prevention (mandatory)**: The orchestrator MUST check PROGRESS.md `iteration` count before dispatching each TDD cycle iteration to sub-agents:
- `iteration >= 3` → WARN: log warning in PROGRESS.md, continue
- `iteration >= 5` → BLOCK: do NOT dispatch. Log to `## Incidents` table (date, feature ID, type="convergence-failure"). Escalate to user immediately.
- On feature completion → reset `iteration: 0` in PROGRESS.md
```

#### Scenario 2: Sub-agent Crash / Context Overflow

```markdown
## Sub-agent Crash or Context Overflow

**Trigger**: TDD sub-agent (test-writer, implementer, refactorer) fails mid-execution.

**Symptoms**:
- Agent returns error or empty response
- Partial file writes (incomplete test/implementation)
- "Context window exceeded" error

**Recovery**:
1. Check for partial writes:
   - `git diff` to identify uncommitted changes
   - If partial: `git checkout -- {partial-files}` to revert incomplete changes
2. Split the tdd_focus batch:
   - Current batch has too many functions → split into 2-3 smaller batches
   - Each batch runs a full Red-Green-Refactor cycle independently
3. Retry with reduced scope:
   - Pass fewer acceptance_test items to the sub-agent
   - Reduce context by referencing only directly relevant type files
4. If crash persists after 2 retries:
   - Log the failure in PROGRESS.md under `## Incidents`
   - Escalate to user: "Sub-agent {name} failing on FEAT-XXX. Possible cause: {context size / complexity}."

**Prevention**: Monitor sub-agent context usage. If tdd_focus has > 5 functions, pre-split before calling sub-agents.
```

#### Scenario 3: Doc-Sync Hook Blocks 3+ Consecutive Commits

```markdown
## Doc-Sync Hook Repeated Block

**Trigger**: pre-tool-doc-sync-check.sh blocks commit 3+ consecutive times.

**Symptoms**:
- Commit attempt returns exit 2 with "source changed but no .md changes"
- Developer has updated docs but hook still blocks (mapping mismatch)
- Generated mapping targets don't match actual project structure

**Recovery**:
1. List the exact blocking condition:
   - Run `bash hooks/pre-tool-doc-sync-check.sh` manually with the stdin JSON to see which files trigger
2. Check mapping table accuracy:
   - Compare `code-doc-sync.md` mapping paths against actual directory structure
   - Fix any stale paths (renamed/moved directories)
3. If mapping is correct but docs genuinely don't need updating:
   - Use escape hatch: include `[skip-doc-sync]` in commit message
   - Document the reason in the commit body
4. If mapping is wrong:
   - Update `code-doc-sync.md` mapping table
   - Update `.claude/protocols/code-doc-sync.md` if patterns changed
   - Include mapping fix in the same commit
5. Present to user if unclear:
   - "These source files triggered doc-sync: {list}"
   - "Mapped doc targets: {list}"
   - "Options: (A) update docs, (B) fix mapping, (C) commit with [skip-doc-sync]"

**Prevention**: Review mapping table during `/setup` Phase 2. Validate paths exist.
```

#### Scenario 4: Database Migration Failure

```markdown
## Database Migration Failure

**Trigger**: Prisma migrate / Alembic / Flyway fails during feature implementation.

**Symptoms**:
- Migration command exits with error (schema conflict, syntax error, data violation)
- Database in inconsistent state (partial migration applied)
- Tests fail due to schema mismatch

**Recovery**:
1. Check migration status:
   - {STATUS_COMMAND}  # e.g., npx prisma migrate status, alembic current
2. If partial migration applied:
   - Run down-migration: {DOWN_COMMAND}  # e.g., npx prisma migrate reset --force (dev only)
   - Verify clean state: {STATUS_COMMAND}
3. Fix the migration file:
   - Check for syntax errors, type mismatches, constraint violations
   - Verify against domain-persona.md entity invariants
4. Re-run migration:
   - {MIGRATE_COMMAND}  # e.g., npx prisma migrate dev
5. If migration cannot be fixed:
   - Delete the failed migration file
   - Regenerate from schema: {GENERATE_COMMAND}
   - Review generated SQL before applying
6. Update docs:
   - Ensure migration is documented in the commit message
   - Verify down-migration exists (Gate 4 requirement)

**Prevention**: Always create down-migration alongside up-migration. Test migrations against a fresh database before committing.
```

#### Scenario 5: Agent Context Window Limit Reached

```markdown
## Agent Context Window Limit

**Trigger**: Main orchestrator or implementer context fills during a complex feature.

**Symptoms**:
- Agent responses become truncated or lose earlier context
- Agent "forgets" earlier TDD phases or acceptance criteria
- Quality of responses degrades noticeably

**Recovery**:
1. Save progress immediately:
   - Commit current passing state with `[wip] FEAT-XXX: partial implementation`
   - Record current TDD phase in PROGRESS.md: `phase: Green (3/5 tdd_focus complete)`
2. Start a new session:
   - The SessionStart bootstrap hook loads PROGRESS.md context
   - Agent reads the `In Progress` feature and resumes from recorded phase
3. If the feature is too large for a single session:
   - Decompose into sub-features (FEAT-XXX-a, FEAT-XXX-b)
   - Each sub-feature gets its own TDD cycle
   - Note: feature-list.json items cannot be added, so track sub-features in PROGRESS.md only
4. For Agent Team mode:
   - Distribute different tdd_focus functions across team members
   - Each member handles a smaller context load

**Prevention**: Monitor feature complexity. If tdd_focus has > 8 functions or acceptance_test has > 10 items, decompose before starting TDD.
```

### Generation Rules

1. Generate `error-recovery.md` during Phase 6 with all 5 scenarios
2. Replace `{STATUS_COMMAND}`, `{DOWN_COMMAND}`, `{MIGRATE_COMMAND}`, `{GENERATE_COMMAND}` placeholders based on tech stack (Prisma/Alembic/Flyway/Diesel)
3. Adapt file paths and tool names per project context
4. Add project-specific scenarios if the plan mentions external APIs, message queues, or other failure-prone integrations

---

## 14. Generation Order

```
Phase 1: Infrastructure ── settings.json, hooks/ (6 scripts), environment.md, security.md, domain-persona.md, scripts/update-feature-status.sh, .gitignore
Phase 2: Protocols ── protocols/ (5 protocols), CLAUDE.md, README.md, quality-gates.md
Phase 3: Agents ── agents/ (9+ agents, with model: field; execution mode selection; team communication protocols if Agent Team mode; optional qa-agent)
Phase 4: Skills ── skills/ (8 skills, Anthropic Agent Skills format, 7-section anatomy), examples/
Phase 5: Context Map ── .claude/context-map.md (module → layer mapping, architecture rules)
Phase 6: State ── feature-list.json, PROGRESS.md, CHANGELOG.md, error-recovery.md, observability.md
```

---

## 15. Plan-to-Harness Conversion Rules

| Plan Content | Conversion Target |
|-------------|-------------------|
| Project purpose | CLAUDE.md one-line summary |
| Tech stack (specified) | CLAUDE.md + environment.md → **1st priority: adopt as-is** |
| Tech stack (unspecified) | Analyze requirements → present 2-3 recommendations → **reflect after developer selection** |
| Feature specs | **feature-list.json** (JSON, passes: false) |
| Core business logic | Each feature's tdd_focus field |
| API design | skills/api-endpoint + context-map.md (api module row) |
| DB schema | skills/db-migration + schema docs |
| Security requirements | security.md + hooks/security-gate.sh |
| Test strategy | quality-gates.md + tdd-loop.md |
| Coding conventions | CLAUDE.md + context-map.md (layer-scoped rules) |
| Documentation targets | code-doc-sync.md mapping table |
| Architecture (specified) | CLAUDE.md + environment.md → **1st priority: adopt as-is** |
| Architecture (unspecified, scale warrants) | Scale assessment → present 2-3 recommendations → **reflect after developer selection** |
| Architecture (unspecified, small scale) | Default to Simple Layered → **confirm with developer** |
| Architecture (prototype/PoC/MVP) | Skip → Simple Flat structure, inform developer |
| Business rules / regulations | domain-persona.md Domain Rules |
| Entity definitions / data model | domain-persona.md Key Entities |
| Non-functional requirements | domain-persona.md Stakeholder Concerns |
| Success metrics / KPIs | domain-persona.md Success Criteria |
| Module structure (independence, parallelism) | Orchestrator `metadata.execution-mode` + team architecture pattern in environment.md |
| Schedule | PROGRESS.md Backlog |

---

## 16. Token Budget

| Deliverable | File Count | Tokens per File | Subtotal |
|-------------|-----------|-----------------|----------|
| Main CLAUDE.md | 1 | ~1,200 | 1,200 |
| context-map.md | 1 | ~600 | 600 |
| Agent MD | 9-10 | ~800 | 7,200-8,000 |
| Skills (7-section, Anthropic format) | 8 | ~800 | 6,400 |
| Protocols | 5 | ~500 | 2,500 |
| Hook scripts (copied from templates) | 6 | ~150 | 900 |
| Other (incl. domain-persona.md, error-recovery.md, observability.md) | 10 | ~400 | 4,000 |
| **Total** | **~50** | | **~22,800** |

**Per-task actual consumption**: CLAUDE.md + relevant context-map.md row (inlined by orchestrator) + agent + skill + tdd-loop + domain context = **~3,600-3,800 tokens**.
TDD sub-agents run in independent context windows → no additional token consumption in the main context.

> **Note**: The ~22,800 token estimate covers generated output only. The `/setup` command also loads
> the plan MD and this guide into context (~8,000 tokens). Total context consumption during setup
> is approximately **32,000-42,000 tokens** depending on plan size.
>
> Per-task estimate of ~3,600-3,800 tokens assumes the orchestrator inlines only the relevant
> context-map.md row into the sub-agent prompt, plus feature-scoped domain context (~100-200 tokens).
> With full feature context (acceptance_test, tdd_focus, doc_sync targets), expect **~4,300-4,900 tokens**.
