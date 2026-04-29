/**
 * Locale resolver for user-facing output (F-092 port of
 * `scripts/ui/lang.py`, originally F-040).
 *
 * Resolution order — first match wins:
 *
 *   1. `HARNESS_LANG` env var (explicit user override).
 *   2. `spec.project.language` (per-project pin) — `'en'` / `'ko'`
 *      taken as-is; `'auto'` falls through to step 3.
 *   3. `LC_ALL` then `LANG` env var — Korean variants (`ko`, `KR`,
 *      `kor`) map to `'ko'`; everything else maps to `'en'`.
 *   4. `'en'` fallback (default — protects English-speaking adopters).
 *
 * @module ui/lang
 */
/** Supported locale tags. */
export type Lang = 'en' | 'ko';
/**
 * Returns the active locale for user-facing output.
 *
 * @param spec - Optional parsed `spec.yaml`; if its
 *   `project.language` is `'en'` or `'ko'`, that pin wins.
 */
export declare function resolveLang(spec?: unknown): Lang;
//# sourceMappingURL=lang.d.ts.map