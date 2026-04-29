/**
 * `/harness-boot:work` no-args dashboard renderer (F-103 port of
 * `scripts/ui/dashboard.py`, v0.9.2).
 *
 * Pure renderer — takes parsed `state.yaml` + optional `spec.yaml` +
 * pre-computed suggestions, returns a multi-line Korean (default)
 * dashboard string. Performs no disk writes; reads coverage
 * fingerprints from `_workspace/coverage/F-N.yaml` only when a
 * `harnessDir` override is supplied.
 *
 * @module ui/dashboard
 */
import type { Lang } from './lang.js';
import type { Suggestion } from './intentPlanner.js';
/** Optional input for {@link render}. */
export interface RenderDashboardOptions {
    lang?: Lang | null;
    harnessDir?: string | null;
}
interface CoverageDetail {
    metric: string;
    ac: number;
    desc: number;
}
/**
 * Reads F-077 fingerprint and computes coverage ratio.
 *
 * Returns `[coverage, mismatches]` where coverage is the arithmetic
 * mean of `ac_value / description_value` across mismatches (`1.0`
 * when the mismatches list is empty), or `null` when the fingerprint
 * file is missing / unparseable.
 */
export declare function loadCoverage(harnessDir: string | null, fid: string): [number | null, CoverageDetail[]];
/**
 * Renders the dashboard as a single string ending with a newline.
 *
 * F-040 — labels and headers honor the resolved language. Pass
 * `options.lang` explicitly for tests; production callers omit it
 * so the resolver picks up `HARNESS_LANG` / spec / system locale.
 */
export declare function render(stateData: unknown, spec: unknown, suggestions: ReadonlyArray<Suggestion>, options?: RenderDashboardOptions): string;
export {};
//# sourceMappingURL=dashboard.d.ts.map