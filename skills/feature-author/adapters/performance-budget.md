# performance-budget adapter (feature-author skill)

## When to use

The user's idea names a measurable performance ceiling — latency,
throughput, p95/p99, frame rate, bundle size, memory footprint,
cold start, time-to-first-byte. Concrete signal words: "fast",
"latency", "p95", "p99", "ms", "throughput", "rps", "qps",
"bundle", "kb gzipped", "LCP", "INP", "FID", "CLS", "TTFB",
"frame rate", "fps", "60fps", "memory", "heap", "cold start".

Vague aspirational phrasing ("should be snappy") does NOT trigger
this shape. The user must name a number or a benchmarkable target.
If it's just "fast" without a target, fall back to `ui-surface` or
`pure-domain` and add a follow-up cycle later.

## AC templates

Pick 3-4 (prototype) or 6-8 (product). The performance-engineer
agent runs gate_perf, which is **not** part of the BR-004 Iron Law
hot path but does produce evidence on pass.

### Budget assertion
- "AC-N: <metric> p75 ≤ <target> on <reference-device> (<device-spec>) over <traffic-profile>."
- "AC-N: <metric> p95 ≤ <target> · p99 ≤ <slack-target>."
- "AC-N: Bundle for <route> is ≤ <kb> KB gzipped; CI fails on regression > <pct>%."

### Measurement
- "AC-N: <metric> is measured by <tool> (lighthouse / k6 / wrk / web-vitals); raw run in `.harness/_workspace/perf/F-N.json`."
- "AC-N: Measurements use <traffic-profile>: warmup <duration>, sustained load <duration>, <concurrency> workers."

### Regression net
- "AC-N: gate_perf override-command in `harness.yaml.gate_commands.gate_perf` runs the same measurement on every cycle; failing budget blocks complete()."
- "AC-N: 7-day rolling baseline kept in `tests/perf/baseline-F-N.json`; > <pct>% drift surfaces a `performance` drift finding (not yet wired in v0.13)."

### Source-of-truth
- "AC-N: Budget values appear in `features[F-N].performance_budget` in spec.yaml; gate_perf evidence summary auto-injects them."

## Modules pattern

```
modules:
  - "src/<feature>/<core>.ts"
  - "src/<feature>/<core>.bench.ts"        # microbenchmark / vitest bench
  - "tests/perf/<feature>.spec.ts"          # macrobenchmark / lighthouse / k6
  - "tests/perf/baseline-F-N.json"          # regression baseline
  - ".harness/_workspace/perf/F-N.json"     # gate_perf evidence (gitignored)
```

## Required block

```yaml
performance_budget:
  lcp_ms: 2500            # Largest Contentful Paint p75 ceiling
  inp_ms: 200             # Interaction to Next Paint p75 ceiling
  bundle_kb: 200          # main bundle gzipped ceiling
  custom:
    - name: "<custom-metric>"
      target: <number>
      unit: "<ms|kb|rps|...>"
```

Web Vitals (`lcp_ms`, `inp_ms`, `bundle_kb`) are conventional but
optional. For backend / batch features, drop them and use `custom[]`
exclusively (`api_p95_ms`, `throughput_rps`, etc.).

## Routing the orchestrator will pick

```
performance-engineer (primary author)
  + the relevant implementation-engineer per surface
  → qa-engineer → integrator → tech-writer → reviewer
```

Note: gate_perf has **no auto-detect** — the harness.yaml override
or `--override-command` is required. The skill should remind the
user of this in the activate output.
