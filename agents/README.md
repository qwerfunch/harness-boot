# agents/ — harness sub-agents (v0.4+)

The sub-agents the harness-boot plugin ships to Claude Code. Each
agent declares its permission matrix in `frontmatter.tools`; Claude
Code **enforces those permissions at runtime**.

## Path convention

Claude Code 2.1.x convention: `agents/<name>.md` at the plugin root
(not `.claude-plugin/agents/`). Auto-discovered.

## How to invoke (user side)

- **@-mention**: `@harness:orchestrator` ·
  `@harness:software-engineer` · `@harness:reviewer`
- **CLI session-wide**: `claude --agent harness:software-engineer`
- **Auto-delegation**: Claude routes based on each agent's
  `description`.

## Permission matrix (F-012 AC)

| Agent | tools (allow-list) | When to use | Don't |
|---|---|---|---|
| **orchestrator** | all (unrestricted) | coordinate multi-step work · delegate to other agents | — |
| **software-engineer** | Read · Write · Edit · Bash · Grep · Glob · NotebookEdit | spec → code → tests · BR-004 cycle (stack-neutral generalist) | git push · shared-system edits · marketplace PR |
| **reviewer** | Read · Grep · Glob · Bash (read-only) | PR / code review · drift diagnosis · evidence checks | Edit · Write · any mutation |
| **researcher** *(v0.5)* | Read · Write · Grep · Glob · Bash · WebFetch · WebSearch | discovery — one-line idea → brief.md | decision-making · summoning other agents · Edit |
| **product-planner** *(v0.5)* | Read · Write · Grep · Glob · Bash | discovery — brief.md → plan.md (Mode B-2 feed) | exploration (researcher's job) · WebFetch · Edit |
| **ux-architect** *(v0.5)* | Read · Write · Grep · Glob · Bash | Stage X — flows.md · IA · state diagrams | color/typography (visual-designer) · code generation |
| **visual-designer** *(v0.5)* | Read · Write · Grep · Glob · Bash | Stage X — tokens.yaml + components.yaml | flow changes · code generation · editing design outputs |
| **audio-designer** *(v0.5)* | Read · Write · Grep · Glob · Bash | Stage X — audio.yaml (only when has_audio) | BGM production · authoring `.wav` binaries |
| **a11y-auditor** *(v0.5)* | Read · Write · Grep · Glob · Bash (read-only) | Stage X — a11y/report.md (read-only audit) | any file edits · unilateral BLOCK |
| **frontend-engineer** *(v0.5)* | Read · Write · Edit · Grep · Glob · Bash | Stage E — UI implementation (consumes design outputs) | editing design outputs · hard-coding values outside the tokens |
| **backend-engineer** *(v0.5)* | Read · Write · Edit · Grep · Glob · Bash | Stage E — API · DB · service · domain logic | UI edits · unilateral destructive migrations |
| **security-engineer** *(v0.5)* | Read · Write · Edit · Grep · Glob · Bash | Stage E — threat model · authn/z · secrets (required for sensitive features) | production-secret access · authoring UI · unilateral BLOCK |
| **performance-engineer** *(v0.5)* | Read · Write · Edit · Grep · Glob · Bash | Stage E — profiling · budget enforcement (features with `performance_budget`) | large refactors · cherry-picked benchmark environments |
| **qa-engineer** *(v0.5)* | Read · Write · Grep · Glob · Bash | Stage Q — test strategy · risk matrix | authoring test code · spec edits |
| **integrator** *(v0.5)* | Read · Write · Edit · Grep · Glob · Bash | Stage I — DI · config · entry points · CI wire-up | rewriting module internals · editing design outputs |
| **tech-writer** *(v0.5)* | Read · Write · Edit · Grep · Glob · Bash | Stage I — docs · CHANGELOG · README (Diátaxis) | code/spec edits · manually-edited screenshots |

Claude Code **auto-blocks** any tool call outside this allow-list.
That's runtime enforcement.

## Design principles

1. **Least privilege** — each agent only holds the tools its scope
   needs.
2. **BR-004 Iron Law** — software-engineer cannot reach `done`
   without gate_5 + evidence.
3. **Preamble + anti-rationalization (BR-014)** — every agent's
   first three output lines follow the convention. Spec:
   [`docs/preamble-spec.md`](../docs/preamble-spec.md).
4. **CQS (BR-012)** — reviewer is read-only; diagnosis only.

## Adding a new agent

1. Create `agents/<new-name>.md` (frontmatter required: `name`,
   `description`, `tools`).
2. Add a row to the permission-matrix table above.
3. Tests: extend `tests/unit/test_agents.py` to validate the new
   frontmatter.
4. Commit.

## References

- Claude Code official spec: `https://code.claude.com/docs/en/sub-agents.md`
- F-012 AC (spec.yaml): per-agent `tools` declaration aligns with
  this matrix; out-of-scope calls blocked.
- F-023 AC (infra): `agents/` tracked · `@harness:<agent>` exposed.
