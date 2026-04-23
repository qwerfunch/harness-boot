# Domain Persona

## Purpose

Agents need persistent, project-level domain context — not just what to implement, but why it matters, what business rules are non-negotiable, and what terms mean in this specific domain. Without this, agents make locally correct but globally wrong decisions (e.g., implementing password hashing without awareness of compliance requirements).

## Extraction

Domain persona is extracted from the plan MD during `/setup` Step 1 (Analyze Plan and Report) and generated as `.claude/domain-persona.md` in Phase 1 (Infrastructure). This ensures all subsequent phases (Protocols, Agents, Skills) can reference domain context during generation.

**Extraction rules**:
1. Read the plan MD for explicit business context: purpose statements, user stories, regulatory mentions, business rules, entity definitions, non-functional requirements.
2. Infer implicit domain knowledge from feature descriptions (e.g., features mentioning "HIPAA", "PCI", "GDPR" → compliance stakeholder concerns; entity relationships → key entities).
3. Present the draft to the user for confirmation — domain knowledge is too critical to get wrong silently.
4. Mark uncertain extractions with `{TODO: confirm}`.

## Format Template

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

## Validation Criteria

- File exists at `.claude/domain-persona.md`
- All 6 sections present (Purpose, Key Entities, Domain Rules, Vocabulary, Stakeholder Concerns, Success Criteria)
- Key Entities table has >= 2 rows
- Domain Rules has >= 2 items
- No `{TODO: confirm}` markers remain after user confirmation

## Agent Domain Views

The orchestrator acts as the **domain context broker**. When selecting a feature and calling sub-agents, it extracts the relevant subset from domain-persona.md based on the feature's `category` and `tdd_focus` fields.

| Agent | Domain View | Mechanism |
|-------|------------|-----------|
| orchestrator, architect, debugger | Full persona | Agent MD: "Read `.claude/domain-persona.md`" |
| reviewer | Entities + Rules + Vocabulary | Inlined in Agent MD `## Domain Context` section |
| implementer | Feature-scoped entities + rules | Orchestrator includes in task prompt |
| tdd-test-writer (conditional) | Feature-scoped entities + invariants | Implementer includes in sub-agent prompt |
| tdd-implementer | Feature-scoped entities + rules | Implementer includes in sub-agent prompt |
| tdd-refactorer | Vocabulary only (naming consistency) | Implementer includes in sub-agent prompt |
| bdd-writer | Feature-scoped acceptance_test + vocabulary | Implementer includes in sub-agent prompt |
| tester | Success criteria + rules | Agent MD section |

## Code-Doc Sync Integration

Add `domain-persona.md` to the code-doc sync mapping so changes to domain-critical code (entities, business rules) trigger a doc-sync check:

```
# Domain context sync
src/domain/**      → .claude/domain-persona.md (Key Entities, Domain Rules)
src/models/**      → .claude/domain-persona.md (Key Entities)
```

## Context Map Integration

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

## Module Extraction <!-- anchor: module-extraction -->

Step 1.5 (Module Extraction) and Phase 3 (Module-specific implementer generation) both need a concrete list of modules. This algorithm produces it from `domain-persona.md` and is the single source of truth — do not infer modules ad-hoc elsewhere.

**Algorithm**:

1. **Seed from Key Entities.** Every row of the Key Entities table is a module candidate. The module slug is the lowercase-hyphenated entity name (e.g., `User` → `user`, `OrderFulfillment` → `order-fulfillment`).
2. **Merge by Bounded Context.** If Bounded Contexts are defined, all entities owned by the same context collapse into one module. The merged slug is the context's lowercase-hyphenated name (e.g., Bounded Context `Authentication` owning `User` + `Credential` → module slug `authentication`, not two separate modules).
3. **Merge by tdd_focus overlap.** If two candidate modules share any `tdd_focus` symbol across features in the draft `feature-list.json`, collapse them into one module (named after whichever has more features; on tie, pick the slug that sorts alphabetically first so the output is deterministic across runs).
4. **Output**: `module_count` = number of distinct slugs surviving steps 2–3. `modules` = the slug list.

**Execution direction**: Always Subagent Dispatch. `module_count == 1` produces one implementer + reviewer, dispatched sequentially; `module_count ≥ 2` produces one implementer per module + reviewer, with parallel waves dispatched via multiple `Agent` tool_use blocks in a single orchestrator response. The dispatch surface (`Agent(subagent_type=...)` + `_workspace/` files) is uniform across project sizes.

**QA agent decision** (derived from the same output, evaluated in Step 1.6):

| Condition | QA agent |
|-----------|----------|
| `module_count` ≥ 3 AND integration-point pair count ≥ 2 | Auto-include |
| Otherwise | Auto-skip |

**Slug stability**: The slug set is frozen at Step 1.5 approval and reused unchanged for Phase 3 `implementer-<slug>.md` files, Phase 5 `context-map.md` rows, and any `domain-persona.md` → feature mapping. Renaming a module after freeze requires `/setup` re-run (error-recovery rebootstrap).
