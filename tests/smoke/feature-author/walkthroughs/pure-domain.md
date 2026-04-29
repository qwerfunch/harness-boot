# Walkthrough — `pure-domain` shape

**Trigger prompt**: `semver 문자열 파서 추가해줘`

**Why this shape**: Korean natural-phrasing (`X 추가해줘`) plus
no UI / sensitive / performance signal → `pure-domain` adapter is
the default fallback.

## Expected skill output

```
Detected shape: pure-domain
Adapter: skills/feature-author/adapters/pure-domain.md
Project mode: prototype (3-4 ACs)
Routing: software-engineer (utility / pure-function)
         → qa-engineer → integrator → tech-writer → reviewer
```

```yaml
  - id: F-1
    type: feature
    title: "semver parser — string → structured tuple"
    priority: P0
    test_strategy: lean-tdd
    description: |
      Parses a semver version string ("1.2.3", "1.2.3-rc.1+build")
      into a structured tuple (major, minor, patch, prerelease,
      build). Round-trips with a serializer in the same module so
      parse(serialize(tuple)) is byte-equal to the input.

    acceptance_criteria:
      - "AC-1: parseSemver(input: string) → SemverTuple | null. Type signature documented in src/semver/parse.ts; runtime validated by schema check on the return value."
      - "AC-2: Invalid input (empty string, non-numeric major, missing patch) returns null without throwing. Logs a warn-level message at most once per process for malformed input."
      - "AC-3: parseSemver is deterministic — same input over 1000 consecutive calls yields byte-equal tuples."
      - "AC-4: Round-trip property: for any valid semver string s, serialize(parseSemver(s)) === s. Property test runs over 100 generated inputs."
```

(No extra spec block — pure-domain shape carries the contract in
the description and ACs alone.)

Lockstep paste instructions follow.

## Pass criteria

- ✓ Shape: `pure-domain`
- ✓ AC count: 3-4 (prototype mode)
- ✓ AC mix: contract + edge cases + determinism + (optional) property test
- ✓ NO `ui_surface`, `entities`, or `performance_budget` block
- ✓ Routing line: `software-engineer` (or `backend-engineer` if the prompt mentions HTTP / DB / queue)
- ✓ Lockstep paste instructions present
