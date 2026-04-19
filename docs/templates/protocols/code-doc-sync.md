# Code-Doc Sync Protocol

One of the five core principles. Enforces that **every export change ships with the documentation that references it**, through three independent defenses.

## Three-layer defense

| Layer | Mechanism | When | Failure mode |
|-------|-----------|------|--------------|
| 1. Prompt protocol | This file + feature-list.json `doc_sync` array | During implementation | Developer/agent forgets — caught by (2) or (3) |
| 2. PreToolUse hook | `hooks/pre-tool-doc-sync-check.mjs` | At `git commit` | Commit blocked (exit 2) until doc_sync targets staged |
| 3. Reviewer check | Reviewer agent Gate 2 3-stage review | Before gate approval | Critical rejection; PR/commit cannot proceed |

Each layer is independent. Bypassing one (`[skip-doc-sync]` on the hook, or a rushed reviewer) still leaves the other layers intact.

## The `doc_sync` array

Every feature in `feature-list.json` carries a `doc_sync` array listing the documentation paths whose content is coupled to the feature's exports. Example:

```json
{
  "id": "FEAT-042",
  "tdd_focus": ["src/auth/login.ts::loginUser", "src/auth/login.ts::refreshToken"],
  "doc_sync": ["docs/api/auth.md", "docs/security.md#session-lifetime"],
  ...
}
```

Rules:
- Targets are repo-relative paths. Anchor fragments (`#section`) permitted — the layer-2 hook only checks path existence, the reviewer checks anchor relevance.
- Empty array is valid (feature has no public exports or no coupled docs) — but the reviewer still verifies the claim.
- An export that reaches more than one doc must list all of them.

## Layer 1 — Prompt protocol

The `implementer`, `architect`, and `reviewer` agents each receive a fragment of this protocol in their generated prompts. Canonical wording:

> When you modify any symbol listed in the current feature's `tdd_focus`, you MUST also update every path in `doc_sync`. Both code and doc changes must be in the same commit.

The `architect` agent additionally enforces this during ADR writing: an ADR that introduces a new public export MUST extend the next feature's `doc_sync` array, not land a bare code change.

## Layer 2 — PreToolUse hook

`hooks/pre-tool-doc-sync-check.mjs` inspects every `git commit` command:

- Language-aware export detection. Default regex covers `export`, `pub fn`, `pub struct`, `pub enum`, `public <identifier>`. Extended patterns:
  - Python (`*.py`): `^[+-](def|class)\s+[A-Za-z]` (top-level definitions; underscore-prefixed helpers still match — over-block is preferred to under-block)
  - Go (`*.go`): `^[+-](func|type|var|const)\s+[A-Z]` (exported identifiers by convention)
- Reads the current feature's `doc_sync` array from `feature-list.json`
- If export changes are detected but any `doc_sync` target is not among the staged files → exit 2 (block) with a human-readable reason on stderr

Bypass: include `[skip-doc-sync]` in the commit message. Use sparingly — Layer 3 still runs.

## Layer 3 — Reviewer Gate 2

Reviewer's 3-stage review for every commit:

1. **TDD compliance** — tests exist, cover tdd_focus, pass
2. **Code quality** — comment rules, naming, complexity
3. **Doc-sync mapping** — **mandatory**: for every export changed in the diff, check that:
   - The corresponding `doc_sync` target is present in the staged diff, AND
   - The updated doc content reflects the actual behavior (not just a timestamp bump)
   - Missing target or stale content → **Critical rejection** (block gate; do not pass to Gate 3)

## Bypass policy (`[skip-doc-sync]`)

- Permitted only when: (a) refactor with zero exported-symbol behavior change, AND (b) the commit body explains why doc update is not required.
- Layer 3 reviewer still audits bypass commits — if the rationale is invalid, the commit is reverted and resubmitted without the bypass flag.
- Bypass counts accumulate in PROGRESS.md `## Metrics.gate_failures` — 3+ in a feature triggers orchestrator escalation.

## Mapping maintenance

When the project structure changes (module renames, file moves), `feature-list.json` `doc_sync` entries can go stale.

- Architect agent re-validates mappings on every architecture ADR
- Reviewer, when it detects a stale path (target doesn't exist), blocks the gate and cites this protocol
- Correcting a mapping is its own commit (not bundled with feature work) — keep the trail clean
