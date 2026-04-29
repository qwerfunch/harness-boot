# Walkthrough — `performance-budget` shape

**Trigger prompt**: `API 응답 p95 200ms 안에 들어와야 함`

**Why this shape**: explicit numeric ceiling (`p95 200ms`) →
`performance-budget` adapter. No UI surface, no sensitive entity.

## Expected skill output

```
Detected shape: performance-budget
Adapter: skills/feature-author/adapters/performance-budget.md
Project mode: prototype (3-4 ACs)
Routing: performance-engineer (primary author)
         + the relevant implementation-engineer per surface
         → qa-engineer → integrator → tech-writer → reviewer

Reminder: gate_perf has NO auto-detect — the skill recommends
adding a harness.yaml.gate_commands.gate_perf override before
activate.
```

```yaml
  - id: F-1
    type: feature
    title: "API response budget — p95 < 200ms"
    priority: P0
    test_strategy: contract
    description: |
      Server-side responses for the public API stay under p95 200ms
      under sustained load. Any single endpoint regressing past
      this threshold fails CI. Budget is enforced via a load test
      against the staging environment and a regression baseline
      committed to the repo.

    acceptance_criteria:
      - "AC-1: P95 latency across all public API endpoints ≤ 200ms over a 10-minute sustained-load run at 100 rps; p99 ≤ 500ms slack."
      - "AC-2: Latency is measured by k6; raw run committed to .harness/_workspace/perf/F-1.json. Run profile: 30s warmup, 10min sustained, 100 concurrent virtual users."
      - "AC-3: Bundle for the API service container is ≤ 50MB; CI fails on regression > 10%."
      - "AC-4: harness.yaml.gate_commands.gate_perf points at scripts/perf/k6.sh so every cycle re-runs the same measurement."

    performance_budget:
      lcp_ms: null
      inp_ms: null
      bundle_kb: 51200
      custom:
        - name: "api_p95_ms"
          target: 200
          unit: "ms"
        - name: "api_p99_ms"
          target: 500
          unit: "ms"
```

Lockstep paste instructions follow.

## Pass criteria

- ✓ Shape: `performance-budget`
- ✓ AC count: 3-4 (prototype mode)
- ✓ AC mix: budget assertion + measurement tool + regression net
- ✓ `performance_budget` block — Web Vitals nullified, `custom[]` carries the real budgets
- ✓ Routing line starts with `performance-engineer`
- ✓ gate_perf override reminder visible in the routing preamble
- ✓ Lockstep paste instructions present
