# Generation Rules

## Generation Order

```
Phase 1: Infrastructure ── settings.json, hooks/ (6 scripts), environment.md, security.md, domain-persona.md, scripts/update-feature-status.mjs, .gitignore, plan-source.md (verbatim copy of $ARGUMENTS)
Phase 2: Protocols ── protocols/ (5 protocols), CLAUDE.md, README.md, quality-gates.md
Phase 3: Agents ── agents/ (10+ agents incl. intent-verifier, with model: field; Handoff Protocol section on communicating agents; optional qa-agent)
Phase 4: Skills ── skills/ (8 skills, Anthropic Agent Skills format, 7-section anatomy), examples/
Phase 5: Context Map ── .claude/context-map.md (module → layer mapping, architecture rules)
Phase 6: State ── feature-list.json, PROGRESS.md, CHANGELOG.md, error-recovery.md, observability.md
```

---

## Plan-to-Harness Conversion Rules

| Plan Content | Conversion Target |
|-------------|-------------------|
| Project purpose | CLAUDE.md one-line summary |
| Tech stack (specified) | CLAUDE.md + environment.md → **1st priority: adopt as-is** |
| Tech stack (unspecified) | Analyze requirements → present 2-3 recommendations → **reflect after developer selection** |
| Feature specs | **feature-list.json** (JSON, passes: false) |
| Core business logic | Each feature's tdd_focus field |
| API design | skills/api-endpoint + context-map.md (api module row) |
| DB schema | skills/db-migration + schema docs |
| Security requirements | security.md + hooks/pre-tool-security-gate.mjs |
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
| Module structure (independence, parallelism) | Team architecture pattern in environment.md + orchestrator workflow |
| Schedule | PROGRESS.md Backlog |

---

## Token Budget

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
> the plan MD and the Harness Engineering Guide into context (~8,000 tokens). Total context consumption during setup
> is approximately **32,000-42,000 tokens** depending on plan size.
>
> Per-task estimate of ~3,600-3,800 tokens assumes the orchestrator inlines only the relevant
> context-map.md row into the sub-agent prompt, plus feature-scoped domain context (~100-200 tokens).
> With full feature context (acceptance_test, tdd_focus, doc_sync targets), expect **~4,300-4,900 tokens**.
