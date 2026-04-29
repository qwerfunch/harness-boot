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

const AT_FORM_RE = /^@(F-\d+)$/;
const PLAIN_FN_RE = /^(F-\d+)$/i;

/** Discrete outcome of one resolve call. */
export type ResultKind = 'single' | 'multiple' | 'none';

/** Outcome of resolving a user query. */
export interface ResolveResult {
  kind: ResultKind;
  feature?: Record<string, unknown> | null;
  candidates?: ReadonlyArray<Record<string, unknown>>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function lookupById(
  fid: string,
  features: ReadonlyArray<unknown>,
): Record<string, unknown> | null {
  for (const f of features) {
    if (isPlainObject(f) && f['id'] === fid) {
      return f;
    }
  }
  return null;
}

function titleMatches(
  query: string,
  features: ReadonlyArray<unknown>,
): Record<string, unknown>[] {
  const q = query.toLowerCase();
  const out: Record<string, unknown>[] = [];
  for (const f of features) {
    if (!isPlainObject(f)) {
      continue;
    }
    const title = f['title'];
    if (typeof title !== 'string') {
      continue;
    }
    if (title.toLowerCase().includes(q)) {
      out.push(f);
    }
  }
  return out;
}

/**
 * Resolves a user query against `spec.features[]`.
 *
 * @param query - Raw user input. Whitespace-trimmed.
 * @param spec - Parsed `spec.yaml` object.
 */
export function resolve(query: unknown, spec: unknown): ResolveResult {
  if (typeof query !== 'string') {
    return {kind: 'none'};
  }
  const q = query.trim();
  if (q.length === 0) {
    return {kind: 'none'};
  }

  const features =
    isPlainObject(spec) && Array.isArray(spec['features']) ? spec['features'] : null;
  if (features === null || features.length === 0) {
    return {kind: 'none'};
  }

  // 1. @F-N explicit form
  const atMatch = AT_FORM_RE.exec(q);
  if (atMatch !== null) {
    const f = lookupById(atMatch[1]!, features);
    return f !== null ? {kind: 'single', feature: f} : {kind: 'none'};
  }

  // 2. Plain F-N form (case-insensitive)
  const plainMatch = PLAIN_FN_RE.exec(q);
  if (plainMatch !== null) {
    const fid = plainMatch[1]!.toUpperCase();
    const f = lookupById(fid, features);
    return f !== null ? {kind: 'single', feature: f} : {kind: 'none'};
  }

  // 3. Title substring fuzzy
  const matches = titleMatches(q, features);
  if (matches.length === 0) {
    return {kind: 'none'};
  }
  if (matches.length === 1) {
    return {kind: 'single', feature: matches[0]};
  }
  return {kind: 'multiple', candidates: matches};
}
