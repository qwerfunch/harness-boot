# ui-surface adapter (feature-author skill)

## When to use

The user's idea involves *something the user looks at or interacts
with* — a screen, page, dialog, button, form, list, layout, theme,
animation, audio cue. Concrete signal words: "render", "display",
"show", "page", "screen", "view", "form", "button", "modal",
"theme", "dark mode", "transition", "tap", "click", "drag",
"swipe", "hover", "focus", "keyboard navigation", "screen reader",
"aria-*", "wcag", "color", "spacing", "typography".

If the surface is *also* sensitive (login form, payment dialog) —
use the `sensitive` adapter instead. `sensitive` > `ui-surface`.

## AC templates

Pick 3-4 (prototype) or 6-8 (product) from below and adjust to the
specific feature. Most features need at least one AC from each
group: **render**, **interaction**, **a11y**, **state**.

### Render
- "AC-N: When the user navigates to <route>, the page renders <named-region>s in the order: <list>."
- "AC-N: <component> uses design tokens from `tokens.yaml` (e.g., `space/<token>`, `color/<token>`); no inline pixel values."
- "AC-N: Empty state surfaces when <data-source> returns zero rows; copy: \"<empty-string>\"."
- "AC-N: Error state surfaces when <data-source> throws; the user sees <visible-affordance> and can retry."

### Interaction
- "AC-N: Clicking <element> triggers <action> within <budget> ms; visual feedback (e.g., button press, spinner) within 16 ms of input."
- "AC-N: <input> is debounced at <ms> ms; final value reaches <handler> exactly once per stable input."
- "AC-N: Keyboard navigation reaches every interactive element via Tab in document order; Enter activates the focused element."

### Accessibility (a11y-auditor will check these)
- "AC-N: Color contrast meets WCAG 2.2 AA (≥ 4.5:1 for body text, ≥ 3:1 for ≥ 18pt or bold)."
- "AC-N: All interactive elements have accessible names (label, aria-label, or visible text)."
- "AC-N: Focus order matches visual order; no focus traps."

### State
- "AC-N: Page state survives refresh via <persistence-mechanism> (URL, localStorage, server)."
- "AC-N: Loading skeleton appears within 100 ms when <data> is unresolved."

## Modules pattern

Typical files for a UI feature:
```
modules:
  - "src/components/<feature>/<component>.tsx"
  - "src/components/<feature>/<component>.test.tsx"
  - "src/styles/<feature>.css"           # if not using tokens-only
  - "src/routes/<route>.ts"              # if route-bound
  - "tests/e2e/<feature>.spec.ts"        # smoke / playwright
```

## Required block

```yaml
ui_surface:
  present: true
  platforms: ["web"]      # ["web"] | ["ios"] | ["android"] | combinations
  has_audio: false        # true → audio-designer joins routing
```

## Routing the orchestrator will pick

```
ux-architect → visual-designer (+ audio-designer if has_audio)
  → a11y-auditor → frontend-engineer (+ software-engineer for logic)
  → qa-engineer → integrator → tech-writer → reviewer
```
