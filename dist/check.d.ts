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
export type DriftKind = 'Generated' | 'Derived' | 'Spec' | 'Include' | 'Evidence' | 'Code' | 'Doc' | 'Anchor' | 'Protocol' | 'Adr' | 'Stale' | 'AnchorIntegration' | 'Coverage';
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
/** Full 13-detector run. */
export declare function runCheck(harnessDir: string, projectRoot?: string | null): CheckReport;
/**
 * Drift fast path used by complete()'s F-048 wire-integrity gate —
 * inspects only Code · Stale · AnchorIntegration · Coverage.
 */
export declare function runBlockingCheck(harnessDir: string, projectRoot?: string | null): CheckReport;
/** Renders a CheckReport for the `/harness:check` CLI. */
export declare function formatHuman(report: CheckReport): string;
//# sourceMappingURL=check.d.ts.map