---
name: feature-author
description: Convert a feature idea into a complete `features[]` entry for `.harness/spec.yaml` — auto-detects shape (UI / sensitive / performance / pure-domain), sizes acceptance criteria to project mode, and emits a paste-ready block for both spec.yaml mirrors. Use only on harness-boot projects (presence of `.harness/spec.yaml`).
when_to_use: |
  Trigger when the user describes a feature idea and wants it scaffolded into the spec, in any of these shapes:

  Korean (most common — natural dev phrasing):
    - "X 기능 구현해줘", "X 기능 만들어줘", "X 추가해줘", "X 개발해줘"
    - "로그인 기능 만들자", "결제 붙이자", "회원가입 구현"
    - "새 피처 추가", "피처 추가하자", "X 작업할게"
    - "F-N 정의", "이거 spec 으로 등록", "spec.yaml 에 추가"

  English:
    - "implement X feature", "build X", "add a X feature"
    - "draft a feature", "spec out X", "scaffold X"
    - "register this as F-N", "let's spec X"

  Also trigger when the user pastes a 1-2 sentence feature description and asks for scaffolding, or types `/harness-boot:work` with feature-creation prose (not lifecycle ops).

  Do NOT trigger for: lifecycle ops on existing features (gate run, evidence, complete), projects without `.harness/`, or `plan.md` whole-document conversion (that is the `spec-conversion` skill).
---

# feature-author skill

This skill teaches Claude how to convert a user's idea ("we need a
login flow") into a complete `features[]` entry in
`.harness/spec.yaml`. It removes the templating friction that 121
self-dogfood feature additions revealed: every entry needs the same
shape (id · name · type · description · acceptance_criteria), and
the user shouldn't have to remember the shape every time.

## When to invoke

Trigger when the user:

- says any of the trigger phrases listed in the frontmatter, OR
- pastes a feature idea / 1-2 sentence description and asks for
  spec scaffolding, OR
- explicitly types `/harness-boot:work` and the prompt content is
  about creating (not lifecycle-managing) a feature.

**Do NOT invoke** when:

- the user is operating an EXISTING feature (gate run, evidence,
  complete) — that's the lifecycle path, handled by
  `/harness-boot:work` directly.
- the project has no `.harness/` directory — there's no spec to
  scaffold against.
- the user is converting a `plan.md` document — that's the
  `spec-conversion` skill's territory.

## Step 1 — Detect the feature shape

Read the user's idea and pick **exactly one** primary shape. The
shape determines which adapter to consult and which agents the
orchestrator will summon.

| Shape | Signal in user prose |
|---|---|
| `ui-surface` | mentions a screen, page, button, form, dialog, render, layout, component, accessibility, theme, motion, audio cue |
| `sensitive` | mentions auth, login, session, token, password, payment, PII, GDPR, encryption, secrets, OAuth |
| `performance-budget` | mentions latency, throughput, p95, LCP, INP, bundle size, frame rate, memory limit, cold start |
| `pure-domain` | none of the above — pure backend logic, batch, calculation, transform, report, CLI |

If two shapes apply (e.g., a sensitive UI form), pick the **stricter**
shape: `sensitive` > `performance-budget` > `ui-surface` >
`pure-domain`. The orchestrator will fan out to multiple agents
regardless; the shape we record drives which adapter we use to
*write* the entry.

Then load the matching adapter at
`skills/feature-author/adapters/<shape>.md`. Each adapter provides:
1. AC templates calibrated to the shape's failure modes.
2. Modules-list patterns (which `src/...` paths to expect).
3. Flags to set on the entry (`ui_surface.present`, `sensitive`,
   `performance_budget`, etc.).

## Step 2 — Read `project.mode` for AC count

Open `.harness/spec.yaml` and find `project.mode`. Two values:

- `prototype` (default for solo / early projects): emit **3-4 ACs**.
  Tightness over completeness — early features change shape; AC
  inflation creates churn.
- `product` (mature / external dogfood): emit **6-8 ACs**. Iron Law
  D requires 3 declared evidences for complete; AC count reflects
  the same stricter contract.

If `project.mode` is missing → treat as `product` (default).

The adapter file in step 1 lists **template ACs** — pick from those,
add 1-2 feature-specific ACs to land in range.

## Step 3 — Compose the F-N entry

Use `skills/feature-author/templates/feature-entry.yaml` as the
skeleton. Fill placeholders:

- `<F_ID>` — next free `F-NNN` number. Read the spec; the highest
  existing `F-N` plus 1.
- `<NAME>` — concise human-readable title, ≤ 60 chars, no trailing
  period.
- `<TYPE>` — almost always `"feature"`. Other values (`"chore"`,
  `"docs"`, `"refactor"`) are valid but less common; ask if unsure.
- `<DESCRIPTION>` — 4-12 line markdown block. First sentence is the
  cycle context (e.g., "Thirty-second cycle. Follow-up to F-114 …").
  Body explains user need + scope + non-goals.
- `<AC-LIST>` — the AC count from step 2, drawn from the adapter
  template plus 1-2 feature-specific ones. Each line `- "AC-N: ..."`.

Shape-specific extras:
- `ui-surface`: include `ui_surface: { present: true, platforms: [...], has_audio: <bool> }` block.
- `sensitive`: include `entities: [{ name: "...", sensitive: true }]` block when an entity is involved.
- `performance-budget`: include `performance_budget: { lcp_ms: <int>, inp_ms: <int>, bundle_kb: <int> }` block.
- `pure-domain`: no extra blocks; description carries the contract.

## Step 4 — Print lockstep paste instructions

Always end the response with:

```
The entry above must be appended to BOTH:
  1. docs/samples/harness-boot-self/spec.yaml
  2. .harness/spec.yaml
self_check.sh enforces lockstep via `diff -q`. Adding to only one
will fail at gate_5.

After paste:
  node bin/harness validate docs/samples/harness-boot-self/spec.yaml \
       --schema docs/schemas/spec.schema.json
  node bin/harness work F-N --harness-dir .harness
```

(Substitute `F-N` with the actual id.)

## Step 5 — Print the routing preview

Show the orchestrator routing the user can expect at activate time.
Use the `agents/orchestrator.md` routing table:

```
Routing on activate:
  shape detected: <shape>
  agent chain: <chain from routing table>
```

This sets expectations so the user knows whether to expect a
ux-architect → visual-designer → frontend-engineer cascade or a
single backend-engineer pass.

## Honest limits

This skill does NOT:

- Write to spec.yaml on the user's behalf — emits the entry as a
  fenced code block; the user decides where to paste.
- Run `harness validate` or activate — those are deterministic CLI
  surfaces, not skill territory.
- Decide AC content beyond the adapter template + 1-2 specifics —
  ACs that need real domain reasoning belong to the
  product-planner agent post-activate.

If the user wants any of the above, tell them:

- "Want me to apply the entry directly? I can paste it into both
  files." (only after explicit user OK)
- "Want me to activate F-N right after? `harness work F-N
  --harness-dir .harness`."

## Bundled resources (load on demand)

Per Anthropic's skill authoring guidance, sub-files are loaded only
when referenced. Load these from inside this skill as you need them:

- **Shape adapters** — read the adapter that matches Step 1's
  detected shape:
  - [adapters/ui-surface.md](adapters/ui-surface.md) — render /
    interaction / a11y / state ACs · ui_surface block
  - [adapters/sensitive.md](adapters/sensitive.md) — STRIDE / authn-z
    / secret-mgmt / audit ACs · entities block
  - [adapters/performance-budget.md](adapters/performance-budget.md)
    — budget assertion / measurement / regression net ACs ·
    performance_budget block
  - [adapters/pure-domain.md](adapters/pure-domain.md) — contract /
    edge cases / determinism ACs · no extra block

- **Paste-ready skeleton** —
  [templates/feature-entry.yaml](templates/feature-entry.yaml) — the
  YAML scaffold with placeholder markers (`<F_ID>`, `<NAME>`,
  `<DESCRIPTION>`, `<AC_N>`) and three commented-out shape blocks.
  Uncomment the one that matches Step 1's shape.

## External references

- `agents/orchestrator.md` — routing table and conflict-resolution
  rules.
- `agents/product-planner.md` — for the actual AC reasoning that
  comes after activate.
- `docs/schemas/spec.schema.json` — authoritative spec v2.3.8
  schema.
- `docs/samples/harness-boot-self/spec.yaml` — 121 worked examples
  to draw shape-specific phrasing from.
- `commands/work.md` — lifecycle reference for what happens after
  the entry is in place.

## Skill version

Internal version: `0.1` (not part of Anthropic's frontmatter
contract; tracked here for harness-boot's own change log).
