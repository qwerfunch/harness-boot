# Model Routing

> Canonical routing spec. All other references (Phase 3 agent list in `commands/setup.md`, Phase 8 verification item, Agent Roles table in `agents-and-gates.md`, directory tree comments) should point back here instead of duplicating the rule.

Agents where reasoning is critical use Opus; agents where code generation is critical use Sonnet.
Specified via the frontmatter `model:` field.

```
Opus (judgment, 4 core + 1 optional)
  ── orchestrator, architect, reviewer, debugger
  ── qa-agent          (only if QA agent is included per Step 1.6 criteria)

Sonnet (execution, 5 core + 1 conditional + N conditional)
  ── implementer, tdd-test-writer, tdd-implementer, tdd-refactorer, tester
  ── tdd-bundler       (only if feature-list.json has any "test_strategy": "bundled-tdd")
  ── implementer-<slug> (one per module, slug from domain-persona.md)
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
