# Walkthrough — `sensitive` shape

**Trigger prompt**: `로그인 기능 구현해줘`

**Why this shape**: Korean natural-phrasing pattern (`X 기능
구현해줘`) plus signal word `로그인` → `sensitive` adapter (auth /
session). Sensitive outranks ui-surface even though a login form has
a UI.

## Expected skill output

```
Detected shape: sensitive
Adapter: skills/feature-author/adapters/sensitive.md
Project mode: prototype (3-4 ACs)
Routing: security-engineer ∥ reviewer (parallel audit; security BLOCK vetoes)
         + ux-architect / visual-designer / frontend-engineer
         (parallel for the form UI)
         → qa-engineer → integrator → tech-writer → reviewer (final)
```

```yaml
  - id: F-1
    type: feature
    title: "Login flow — email/password authentication"
    priority: P0
    test_strategy: lean-tdd
    description: |
      Authenticated session for end users via email + password.
      Issues a signed session token on success, persists for the
      configured duration, and verifies on every authenticated
      request. Failure modes — bad password, locked account,
      expired token — return user-visible errors without leaking
      credential state.

    acceptance_criteria:
      - "AC-1: POST /auth/login validates email + password against the user store; success returns a signed session token (RS256, 24h expiry) in an httpOnly cookie."
      - "AC-2: STRIDE threat model documented at docs/security/login-threat-model.md (spoofing / tampering / repudiation / information-disclosure / DoS / elevation). Mitigations cited inline."
      - "AC-3: Failed login attempts are rate-limited per IP (5/minute) and per account (10/hour). Lockout returns HTTP 429; no field-level error echo."
      - "AC-4: Logs that record login attempts redact the password field (replace with `***`); audit log captures actor, action, ip, timestamp without payload bodies."

    entities:
      - name: "user-credential"
        sensitive: true
```

After the entry above, the skill prints:

```
The entry above must be appended to BOTH:
  1. docs/samples/harness-boot-self/spec.yaml
  2. .harness/spec.yaml
self_check.sh enforces lockstep via `diff -q`. Adding to only one
will fail at gate_5.

After paste:
  node bin/harness validate docs/samples/harness-boot-self/spec.yaml \
       --schema docs/schemas/spec.schema.json
  node bin/harness work F-1 --harness-dir .harness
```

## Pass criteria

- ✓ Shape: `sensitive` (NOT `ui-surface` — precedence rule)
- ✓ AC count: 3-4 (prototype mode)
- ✓ AC mix: at least one each of authn/z, threat-model, secret-mgmt
- ✓ `entities` block with `sensitive: true`
- ✓ Routing line mentions `security-engineer ∥ reviewer`
- ✓ Lockstep paste instructions present at the end
