/**
 * Project mode resolver — prototype vs product (F-088 port of
 * `scripts/core/project_mode.py`, originally introduced in v0.9.6).
 *
 * The `spec.project.mode` field is a single switch that tightens or
 * relaxes several ceremony / quality behaviours at once:
 *
 *   - **Iron Law** — `product` requires 3 declared evidences in the
 *     trailing window, `prototype` requires 1.
 *   - **Kickoff template** — product writes a 3-bullet section per
 *     matched agent. Prototype writes a 1-line section per agent.
 *   - **Retrospective template** — product carries five LLM-driven
 *     sections (Risks Materialized, Decisions Revised, Kickoff
 *     Predictions, Reviewer Reflection, Copy Polish). Prototype keeps
 *     only "What Shipped" plus "First Gate to Fail" plus a Ceremonies
 *     summary.
 *   - **Design review autowire** — product autowires when the three
 *     triggers align (UI feature · flows.md saved · review.md
 *     missing). Prototype skips the autowire path entirely.
 *
 * This module is pure: spec object in, mode string out, no I/O.
 * Behaviour is byte-equal with Python — every non-`"prototype"` input
 * collapses to `"product"` (strict default).
 *
 * @module projectMode
 */
/** All valid modes — used for runtime guards. */
export const VALID_MODES = new Set(['prototype', 'product']);
/**
 * Strict default. Unknown / missing values fall back to `product` so
 * misconfiguration never silently relaxes the quality bar.
 */
export const DEFAULT_MODE = 'product';
/**
 * Returns the canonical {@link Mode} for a parsed spec.yaml object.
 *
 * @param spec - Parsed `spec.yaml` object, or null/undefined when the
 *   file is absent.
 * @returns `'prototype'` only when `spec.project.mode === 'prototype'`.
 *   Everything else — null spec, missing project block, missing
 *   field, unknown value — returns {@link DEFAULT_MODE}.
 */
export function resolveMode(spec) {
    if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
        return DEFAULT_MODE;
    }
    const project = spec['project'];
    if (project === null || typeof project !== 'object' || Array.isArray(project)) {
        return DEFAULT_MODE;
    }
    const mode = project['mode'];
    if (typeof mode === 'string' && VALID_MODES.has(mode)) {
        return mode;
    }
    return DEFAULT_MODE;
}
//# sourceMappingURL=projectMode.js.map