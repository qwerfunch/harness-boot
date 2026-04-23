## `_workspace/` naming convention <!-- anchor: workspace-naming -->

Envelopes live under `_workspace/handoff/`. Main deliverables (the artifact a subagent produced) live at:

```
_workspace/{phase}_{agent}_{artifact}.{ext}
```

Examples:
- `_workspace/01_architect_dependencies.md`
- `_workspace/02_impl_auth_feat-042-bundle.md`
- `_workspace/03_reviewer_feat-042.md`
- `_workspace/qa_qa-agent_module-auth-order-boundary.md`

Rules:
- Slugs are lowercase, hyphenated
- One artifact per file — do not concatenate
- Overwrite is permitted for same-phase same-agent retries; the last-write is authoritative
- The orchestrator does not clean `_workspace/` between sessions — artifacts are debugging evidence

