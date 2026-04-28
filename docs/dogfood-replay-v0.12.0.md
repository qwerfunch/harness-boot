# v0.12.0 dogfood replay — operational evidence

**Date**: 2026-04-29
**Plugin version**: v0.12.0 (F-077 + F-078 + F-079 shipped)
**Validation feature**: F-080

## Why this report exists

v0.12.0 ships a structural fix for the Iron Law procedural-vs-substantive
gap surfaced by an external dogfood project: Iron Law (BR-004) used to
verify only `gate_5 = pass` plus declared evidence count, never looking
inside the evidence to confirm the numbers actually matched the spec's
quantitative targets. The new gates address each layer of the response
chain:

* **F-077** — activate-time stderr `[hint]` for description vs AC numeric
  mismatches plus a fingerprint persisted under
  `_workspace/coverage/F-N.yaml`.
* **F-078** — 13th drift kind `Coverage` blocks `complete()` when the
  fingerprint shows a ratio below threshold (default 0.80).
* **F-079** — dashboard renders coverage % + a `Coverage debt` aggregate
  section so the gauge is visible without invoking `check.py`.

The original external project that surfaced the failure is no longer a
clean test bed (its carry-forward has been acknowledged in retros via
prompt-time human steering). To verify the new gates fire on realistic
prose, this report walks an isolated synthetic replay that reproduces
the exact mismatch pattern.

The synthetic spec lives at `/tmp/dogfood-replay-v0.12.0/.harness/spec.yaml`
during the replay run. It mirrors the original symptom: `description`
claims `13 ChainTemplate · 74 propagation rule · 35 Heuristic tools`,
AC accepts `5 ChainTemplate / 10 propagation rule / 1 Heuristic tool`.

## Step 1 — activate (F-077 stderr hint expected)

```bash
python3 scripts/work.py F-1 --harness-dir /tmp/dogfood-replay-v0.12.0/.harness
```

Captured output:

```
[hint] description claims 13 chaintemplate but AC accepts 5 — explicit carry-forward to retro recommended
[hint] description claims 74 rule but AC accepts 10 — explicit carry-forward to retro recommended
[hint] description claims 35 tool but AC accepts 1 — explicit carry-forward to retro recommended
🛠  /harness:work · activated · F-1

status: in_progress
evidence: 0 entries
routed agents: backend-engineer, software-engineer, qa-engineer, integrator, tech-writer, reviewer
```

✅ Three `[hint]` lines, one per metric. F-077 fired exactly as designed.

## Step 2 — fingerprint inspection (F-077 persistence)

```bash
cat /tmp/dogfood-replay-v0.12.0/.harness/_workspace/coverage/F-1.yaml
```

Captured output:

```yaml
feature_id: F-1
description_claims:
- metric: chaintemplate
  value: 13
- metric: rule
  value: 74
- metric: tool
  value: 35
ac_claims:
- metric: chaintemplate
  value: 5
- metric: rule
  value: 10
- metric: tool
  value: 1
mismatches:
- metric: chaintemplate
  description_value: 13
  ac_value: 5
- metric: rule
  description_value: 74
  ac_value: 10
- metric: tool
  description_value: 35
  ac_value: 1
```

✅ Fingerprint shape matches the F-078 contract: `description_claims`,
`ac_claims`, and a `mismatches` list of `{metric, description_value,
ac_value}` triples. Three rows, ratios 5/13 ≈ 0.38, 10/74 ≈ 0.14,
1/35 ≈ 0.03 — all far below the 0.80 default threshold.

## Step 3 — gate_5 + evidence (Iron Law procedural prereqs)

```bash
python3 scripts/work.py F-1 --harness-dir … --gate gate_5 pass --note "synthetic smoke ok"
python3 scripts/work.py F-1 --harness-dir … --evidence "5 ChainTemplate matched in fixture run" --kind manual_check
```

Captured output:

```
🛠  /harness:work · gate_recorded · F-1
status: in_progress
passed: gate_5
evidence: 0 entries

🛠  /harness:work · evidence_added · F-1
status: in_progress
passed: gate_5
evidence: 1 entries
```

✅ Iron Law's procedural side now satisfies (`gate_5 = pass` + 1
declared evidence; `mode='prototype'` so threshold is 1).

## Step 4 — complete (F-078 Coverage drift expected to block)

```bash
python3 scripts/work.py F-1 --harness-dir … --complete
```

Captured output:

```
🛠  /harness:work · queried · F-1

status: in_progress
passed: gate_5
evidence: 1 entries

cannot complete — 3 blocking drift(s) (Coverage). Run `python3 scripts/check.py --harness-dir /tmp/dogfood-replay-v0.12.0/.harness` for details, fix, or use `--hotfix-reason` for emergency.
```

✅ `complete()` returned `action='queried'` (not `completed`). Message
mentions `Coverage` (3 blocking drifts) and points to the
`--hotfix-reason` escape hatch. F-078 fired exactly as designed —
Iron Law's procedural side passed, but the substantive Coverage gate
caught the under-coverage and refused the transition.

## Step 5 — complete --hotfix-reason (F-048 bypass preserved)

```bash
python3 scripts/work.py F-1 --harness-dir … --complete \
    --hotfix-reason "intentional carry-forward — original sast pattern reproduction"
```

Captured output:

```
🛠  /harness:work · completed · F-1

status: done
passed: gate_5
evidence: 2 entries
```

✅ Hotfix reason bypass works. The feature transitions to `done` and
the reason is recorded as a `kind=hotfix` evidence entry for audit
trail. This preserves the F-048 contract — operators can still ship
on intentional carry-forward, but the bypass is explicit and
attributable.

## Step 6 — dashboard with `--harness-dir` (F-079 surface)

```bash
python3 scripts/work.py --harness-dir /tmp/dogfood-replay-v0.12.0/.harness
```

Captured output:

```
📊 harness-boot

Coverage debt: 1 features with mismatches (1 below threshold 0.80)

all features complete — 1 done.

next actions:
  (1) 새 피처 등록 (spec.yaml 편집) (recommended)

Enter = 1 (recommended)
```

✅ The `Coverage debt` aggregate section appears even though the
feature has been bypassed-and-completed. Future activations will
also see this line so the cumulative debt stays visible. The single
under-coverage feature is below the 5-feature alert threshold so the
red `⚠` line is correctly suppressed.

## Cross-reference to the integration test

The same scenario runs as `tests/integration/test_iron_law_substantive.py`
(F-080 deliverable). Four cases lock the contract:

| Case | Asserts |
|---|---|
| `test_activate_emits_quant_hint_for_each_mismatch` | F-077 stderr hint pattern + numeric values |
| `test_activate_persists_fingerprint_file` | F-077 fingerprint file exists with ≥3 mismatches |
| `test_complete_rejects_with_coverage_drift` | F-078 `complete()` queried + 'Coverage' in message |
| `test_hotfix_reason_bypasses_coverage_drift` | F-048 escape hatch preserved by F-078 |

Run via `python3 -m pytest tests/integration/test_iron_law_substantive.py`.

## Conclusion

All three v0.12.0 layers (diagnose · block · surface) fire on realistic
prose without unit-mock harness. The integration test in
`tests/integration/` locks the behavior so future regressions surface
in CI.

**Iron Law shape is now**: `gate_5 = pass` + declared evidence threshold
+ Coverage drift (`description_value / ac_value` ratio ≥ project
threshold) — procedural and substantive together, with `--hotfix-reason`
as the documented bypass for intentional carry-forward.
