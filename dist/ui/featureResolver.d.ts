/**
 * User input → feature dict resolver (F-092 port of
 * `scripts/ui/feature_resolver.py`, v0.9.1).
 *
 * Resolution order — highest priority first:
 *
 *   1. `@F-N` prefix (after whitespace strip) — explicit id reference.
 *      Power-user escape hatch. Never falls through to title matching.
 *   2. Plain `F-N` (case-insensitive) matching `^F-\d+$` — treated as
 *      id reference for backward compat with existing CLI callers.
 *   3. Title substring fuzzy — case-insensitive, whitespace-normalised.
 *      Matches any feature whose `title` contains the query as a
 *      substring.
 *
 * Three possible outcomes wrapped in {@link ResolveResult}:
 *
 *   - `'single'` — exactly one feature resolved.
 *   - `'multiple'` — title fuzzy matched 2+ features (caller presents
 *     a menu).
 *   - `'none'` — no match.
 *
 * Pure: no I/O, no state mutation.
 *
 * @module ui/featureResolver
 */
/** Discrete outcome of one resolve call. */
export type ResultKind = 'single' | 'multiple' | 'none';
/** Outcome of resolving a user query. */
export interface ResolveResult {
    kind: ResultKind;
    feature?: Record<string, unknown> | null;
    candidates?: ReadonlyArray<Record<string, unknown>>;
}
/**
 * Resolves a user query against `spec.features[]`.
 *
 * @param query - Raw user input. Whitespace-trimmed.
 * @param spec - Parsed `spec.yaml` object.
 */
export declare function resolve(query: unknown, spec: unknown): ResolveResult;
//# sourceMappingURL=featureResolver.d.ts.map