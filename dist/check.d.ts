/**
 * `/harness:check` drift detection (F-100 port of `scripts/check.py`).
 *
 * Read-only / CQS — never modifies any harness file or project file.
 *
 * 13 drift kinds:
 *
 *   1. Generated         — harness.yaml structural integrity.
 *   2. Derived           — domain.md / architecture.yaml output_hash
 *      vs current file hash (edit-wins detection).
 *   3. Spec              — spec.yaml canonical hash vs harness.yaml
 *      generated_from.spec_hash.
 *   4. Include           — harness.yaml include_sources vs current
 *      spec.yaml $include nodes.
 *   5. Evidence          — done features must declare ≥1 evidence.
 *   6. Code              — features[].modules[].source must exist.
 *   7. Doc               — CLAUDE.md @import targets exist; derived
 *      files non-empty.
 *   8. Anchor            — feature id format/uniqueness, depends_on
 *      validity, supersedes/superseded_by consistency.
 *   9. Protocol          — protocols/*.md frontmatter.protocol_id
 *      matches file stem.
 *  10. Adr               — decisions[].supersedes target status must
 *      be `superseded`.
 *  11. Stale             — done features whose modules are unreferenced.
 *  12. AnchorIntegration — done features must be wired into their
 *      integration_anchor.
 *  13. Coverage          — quant fingerprint mismatches below threshold.
 *
 * @module check
 */
/** Drift category. */
export type DriftKind = 'Generated' | 'Derived' | 'Spec' | 'Include' | 'Evidence' | 'Code' | 'Doc' | 'Anchor' | 'Protocol' | 'Adr' | 'Stale' | 'AnchorIntegration' | 'Coverage' | 'AcceptanceTrace' | 'ContentDrift';
/** Severity tags. `'error'` blocks complete(); `'warn'` notifies only. */
export type Severity = 'warn' | 'error';
/** One drift finding. */
export interface DriftFinding {
    kind: DriftKind;
    path: string;
    message: string;
    severity: Severity;
}
/** Aggregate report from {@link runCheck}. */
export interface CheckReport {
    findings: DriftFinding[];
    checked: string[];
}
/** True when no findings were emitted. */
export declare function isClean(report: CheckReport): boolean;
/** Default coverage ratio threshold (matches Python `_DEFAULT_COVERAGE_THRESHOLD`). */
export declare const DEFAULT_COVERAGE_THRESHOLD = 0.8;
/** harness.yaml structural integrity check. */
export declare function checkGenerated(_harnessDir: string, harnessYaml: Record<string, unknown> | null): DriftFinding[];
/** Compares output_hash against actual file hash for derived outputs. */
export declare function checkDerived(harnessDir: string, harnessYaml: Record<string, unknown>): DriftFinding[];
/** Compares spec.yaml canonical hash against harness.yaml's recorded hash. */
export declare function checkSpec(harnessDir: string, harnessYaml: Record<string, unknown>): DriftFinding[];
/** Verifies recorded includes still match spec.yaml + chapter files exist. */
export declare function checkIncludes(harnessDir: string, harnessYaml: Record<string, unknown>): DriftFinding[];
/** Done features must carry ≥1 evidence entry. */
export declare function checkEvidence(harnessDir: string): DriftFinding[];
/** features[].modules[].source must point to an existing file. */
export declare function checkCode(harnessDir: string, spec: Record<string, unknown>, projectRoot?: string | null): DriftFinding[];
/** CLAUDE.md @imports must resolve; derived files non-empty. */
export declare function checkDoc(harnessDir: string, projectRoot?: string | null): DriftFinding[];
/** Feature id format / uniqueness / depends_on / supersedes consistency. */
export declare function checkAnchor(spec: Record<string, unknown>): DriftFinding[];
/** decisions[].supersedes target ADR status must be `superseded`. */
export declare function checkAdrSupersedes(spec: Record<string, unknown>): DriftFinding[];
/** protocols/*.md frontmatter.protocol_id must match the file stem. */
export declare function checkProtocol(harnessDir: string): DriftFinding[];
/** Done feature modules unreferenced by anything in src/. */
export declare function checkStale(harnessDir: string, spec: Record<string, unknown>, projectRoot?: string | null): DriftFinding[];
/** Done features must be wired into their integration_anchor files. */
export declare function checkAnchorIntegration(harnessDir: string, spec: Record<string, unknown>, projectRoot?: string | null): DriftFinding[];
/**
 * F-078 — Reads `_workspace/coverage/F-*.yaml` fingerprints and emits
 * one error finding per recorded mismatch whose `ac_value /
 * description_value` ratio falls below the threshold.
 *
 * Threshold defaults to 0.80; override via
 * `harness.yaml.coverage.threshold`.
 */
export declare function checkSpecCoverage(harnessDir: string, _specYaml: Record<string, unknown> | null): DriftFinding[];
/**
 * F-168 — AC ↔ Test traceability detector.
 *
 * Distinct from {@link checkSpecCoverage} (description-vs-fingerprint
 * substantive coverage): AcceptanceTrace asks the stronger question —
 * does a specific test reference this exact AC-N for this exact
 * feature?
 *
 * Two mapping mechanisms (either is enough):
 *
 *   1. **Explicit** — when the AC entry is an object with
 *      `test_refs: ["name", ...]`, each ref must appear somewhere in
 *      the project's test files.
 *   2. **Implicit** — at least one test file must contain both the
 *      feature id (`F-NNN`) and `AC-N` literal somewhere in its
 *      content. Sufficient signal that the test references the AC,
 *      without paying for an AST parse.
 *
 * **Opt-in by default.** Set
 * `harness.yaml.detectors.acceptance_trace.enabled: true` to activate.
 * Reason: the existing 150+ harness-boot self spec features all carry
 * string ACs without test_refs; turning the detector on globally
 * would emit too much noise on first run. External adopters opt in
 * after their tests pass the implicit pattern.
 *
 * Severity stays `warn` until `strict: true` is also set (planned for
 * a follow-up cycle once real-world noise levels are known).
 */
export declare function checkAcceptanceTrace(harnessDir: string, spec: Record<string, unknown> | null, projectRoot?: string | null): DriftFinding[];
/**
 * F-169 — Content drift detector.
 *
 * Parses every `<!-- harness:fact key=X value=V source=path:symbol -->`
 * sigil region across the configured doc files (default: `CLAUDE.md`)
 * and validates the declared `value` against the code SSoT cited in
 * `source`. Mismatches emit `ContentDrift` findings at `severity:
 * error` — these block complete() and self_check.
 *
 * v1 supports three `source` kinds, distinguished by the file
 * extension and the symbol shape:
 *
 *   1. `path:enumName` — for TypeScript union types, const arrays,
 *      and `new Set([...])` declarations. Returns the member count.
 *      Example: `src/check.ts:DriftKind` → 15.
 *   2. `path:CONST_NAME` — for `const X = <scalar>;` declarations.
 *      Returns the literal value as a string (numbers and strings
 *      stringify uniformly).
 *   3. `path:fieldName` — for JSON files. Returns the top-level
 *      field's value. Example:
 *      `.claude-plugin/plugin.json:version` → "0.15.4".
 *
 * Sigils that can't be resolved (missing file, unknown symbol,
 * unparseable source) emit a single warn entry — the surface lets
 * the author fix or remove the broken sigil.
 */
export declare function checkContentDrift(harnessDir: string, projectRoot?: string | null): DriftFinding[];
/** Full 15-detector run. */
export declare function runCheck(harnessDir: string, projectRoot?: string | null): CheckReport;
/**
 * Drift fast path used by complete()'s F-048 + F-169 wire-integrity
 * gate — inspects only Code · Stale · AnchorIntegration · Coverage ·
 * ContentDrift.
 */
export declare function runBlockingCheck(harnessDir: string, projectRoot?: string | null): CheckReport;
/** Renders a CheckReport for the `/harness:check` CLI. */
export declare function formatHuman(report: CheckReport): string;
//# sourceMappingURL=check.d.ts.map