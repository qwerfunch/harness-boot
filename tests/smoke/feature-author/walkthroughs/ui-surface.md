# Walkthrough — `ui-surface` shape

**Trigger prompt**: `사용자 대시보드 페이지 만들어줘`

**Why this shape**: Korean natural-phrasing (`X 만들어줘`) plus
`페이지` (page) → `ui-surface` adapter. No sensitive entity, no
performance budget, so ui-surface wins.

## Expected skill output

```
Detected shape: ui-surface
Adapter: skills/feature-author/adapters/ui-surface.md
Project mode: prototype (3-4 ACs)
Routing: ux-architect → visual-designer → a11y-auditor
         → frontend-engineer (+ software-engineer for logic)
         → qa-engineer → integrator → tech-writer → reviewer
```

```yaml
  - id: F-1
    type: feature
    title: "User dashboard — recent-activity overview"
    priority: P0
    test_strategy: lean-tdd
    description: |
      Logged-in users land on a dashboard that summarizes their
      recent activity — the last N events grouped by day, with
      drill-down to the underlying record. Empty / error / loading
      states are explicit. The page is the entry point after login.

    acceptance_criteria:
      - "AC-1: Navigating to /dashboard renders the named regions in order: header, summary cards, activity timeline, footer. All regions use design tokens from tokens.yaml (no inline pixel values)."
      - "AC-2: Empty state (zero activity rows) shows the copy 'Nothing yet — your activity will appear here as you use the product.' with a primary CTA linking to the onboarding tour."
      - "AC-3: Keyboard navigation reaches every interactive element via Tab in document order; Enter activates the focused element. No focus traps."
      - "AC-4: Color contrast meets WCAG 2.2 AA for body text (≥ 4.5:1) and large/bold text (≥ 3:1). Verified by a11y-auditor on the rendered page."

    ui_surface:
      present: true
      platforms: ["web"]
      has_audio: false
```

Lockstep paste instructions follow (same as sensitive walkthrough).

## Pass criteria

- ✓ Shape: `ui-surface`
- ✓ AC count: 3-4 (prototype mode)
- ✓ AC mix: at least one each of render, interaction, a11y, state
- ✓ `ui_surface` block with `present: true`
- ✓ Routing line starts with `ux-architect → visual-designer`
- ✓ Lockstep paste instructions present
