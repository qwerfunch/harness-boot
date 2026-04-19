## `_workspace/` naming convention <!-- anchor: workspace-naming -->

```
_workspace/{phase}_{agent}_{artifact}.{ext}
```

Examples:
- `_workspace/red_tdd-test-writer_feat-042-tests.ts`
- `_workspace/gate2_reviewer_feat-042-report.md`
- `_workspace/qa_qa-agent_module-auth-order-boundary.md`
- `_workspace/escalate_implementer-auth_feat-042-trail.md`

Rules:
- Slugs are lowercase, hyphenated
- One artifact per file — do not concatenate
- Overwrite is permitted for same-phase same-agent retries; the last-write is authoritative
- The orchestrator does not clean `_workspace/` between sessions — artifacts are debugging evidence

