/**
 * Renders `spec.yaml` to `.harness/domain.md` (F-091 port of
 * `scripts/render/domain.py`, F-003 §0.4).
 *
 * The output is **byte-equal** with the Python implementation for
 * identical inputs — `/harness:check`'s Derived drift detector
 * depends on this property, and the migration would silently break
 * that detector if the rendered text drifted.
 *
 * Section order (do not reorder without bumping the spec version):
 *
 *   1. Header + generation timestamp
 *   2. `## Project` — summary · description · vision
 *   3. `## Platform` — `constraints.tech_stack` (v0.7.4 additive)
 *   4. `## Stakeholders`
 *   5. `## Entities`
 *   6. `## Business Rules`
 *   7. `## Decisions` — decisions[] ADR catalog (v0.6 additive)
 *   8. `## Risks` — risks[] catalog (v0.6 additive)
 *
 * Input contract: the spec passed in must already have `$include`
 * expansion applied — see {@link import('../spec/includeExpander.ts').expand}.
 *
 * @module render/domain
 */
/** Optional input for {@link render}. */
export interface RenderDomainOptions {
    /** Override generation timestamp (used by parity tests for byte-equal output). */
    timestamp?: string;
}
/**
 * Renders the parsed spec into a `domain.md` document.
 *
 * @param spec - Parsed `spec.yaml` (already $include-expanded).
 * @param options - Optional timestamp override for deterministic
 *   parity tests.
 * @returns The complete domain.md text including a trailing
 *   newline.
 */
export declare function render(spec: Record<string, unknown>, options?: RenderDomainOptions): string;
/** Reads + parses a YAML spec file, mirroring Python's `load_spec`. */
export declare function loadSpec(path: string): Record<string, unknown>;
//# sourceMappingURL=domain.d.ts.map