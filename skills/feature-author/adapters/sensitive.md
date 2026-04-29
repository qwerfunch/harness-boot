# sensitive adapter (feature-author skill)

## When to use

The user's idea touches authentication, authorization, identity,
session, password, token, payment, billing, PII, GDPR, encryption,
secret material, or any flow where compromise has user-visible
blast radius. Concrete signal words: "login", "logout", "sign in",
"sign up", "OAuth", "SSO", "MFA", "JWT", "refresh token",
"password", "encrypt", "secret", "API key", "PII", "personal data",
"GDPR", "consent", "checkout", "payment", "card", "billing",
"invoice", "subscription", "permission", "RBAC", "ACL".

This shape **takes precedence** over ui-surface and
performance-budget — even if a feature is also a UI form, if it
handles credentials or PII, use `sensitive`. The orchestrator will
still summon ux-architect / visual-designer in parallel because
those concerns are orthogonal.

## AC templates

Sensitive features carry more AC weight by default — never less
than 6, even in `prototype` mode (because "prototype security" is
not a real category). Pick from the following groups, mandatory
coverage in **threat-model**, **authn/z**, **secret-mgmt**,
**audit**.

### Threat model (security-engineer enforces)
- "AC-N: STRIDE model documented for the <surface> entry: spoofing / tampering / repudiation / information-disclosure / DoS / elevation. Mitigations cited inline."
- "AC-N: Untrusted input fields (<list>) are validated against <schema>; invalid input rejected with HTTP 400 and no field echo."

### authn / z
- "AC-N: <action> requires <auth-state>; unauthenticated requests receive HTTP 401 with no resource leakage in body."
- "AC-N: <action> verifies <permission> via <middleware>; missing permission returns HTTP 403."
- "AC-N: Tokens are <signed-with>, expire after <duration>, and rotate on <event>."

### Secret management
- "AC-N: Secrets are sourced from <env-var or KMS>; never committed or logged. CI checks `git diff --staged` for `(SECRET|KEY|TOKEN)=` patterns."
- "AC-N: Logs that include <field> redact the value as `***` (or hash with `sha256`)."

### Audit
- "AC-N: <event> appends an audit-log entry containing actor, action, target, ip, timestamp; no payload bodies."
- "AC-N: Audit logs are append-only; integrity verified via <mechanism> (signed chain, write-once store)."

### a11y (when there's a UI)
Inherit the relevant ACs from `ui-surface.md` if the feature
includes a screen — sensitive features usually do.

## Modules pattern

```
modules:
  - "src/auth/<feature>.ts"               # authn / z core
  - "src/auth/<feature>.test.ts"
  - "src/middleware/<gate>.ts"
  - "src/storage/<encrypted>.ts"          # if at-rest encryption applies
  - "tests/security/<feature>.spec.ts"
  - "docs/security/<feature>-threat-model.md"   # STRIDE writeup
```

## Required block

```yaml
entities:
  - name: "<entity-name>"      # e.g., "user-credential", "payment-token"
    sensitive: true
```

(If the feature is auth/payment **without** a single named entity,
omit `entities` and rely on the title + description for shape
detection. The orchestrator's `sensitive_or_auth` shape detector
will still match.)

## Routing the orchestrator will pick

```
security-engineer ∥ reviewer            # parallel audit
  (security BLOCK vetoes; ux-architect / visual-designer / frontend
   engineer run in parallel for any UI portion)
  → qa-engineer → integrator → tech-writer → reviewer (final)
```

**Veto rule**: if `security-engineer` returns BLOCK, the cycle
cannot complete regardless of other agents' findings.
