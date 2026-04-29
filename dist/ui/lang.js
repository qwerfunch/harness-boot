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
const SUPPORTED = new Set(['en', 'ko']);
const KOREAN_HINTS = ['ko', 'kor', 'KR'];
function asObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value;
}
/**
 * Returns the active locale for user-facing output.
 *
 * @param spec - Optional parsed `spec.yaml`; if its
 *   `project.language` is `'en'` or `'ko'`, that pin wins.
 */
export function resolveLang(spec = null) {
    const envValue = process.env['HARNESS_LANG'];
    if (envValue && SUPPORTED.has(envValue)) {
        return envValue;
    }
    const specObj = asObject(spec);
    if (specObj !== null) {
        const project = asObject(specObj['project']);
        if (project !== null) {
            const specLang = project['language'];
            if (typeof specLang === 'string' && SUPPORTED.has(specLang)) {
                return specLang;
            }
            // 'auto' or anything unrecognised falls through to the system locale.
        }
    }
    for (const key of ['LC_ALL', 'LANG']) {
        const locale = process.env[key] ?? '';
        if (KOREAN_HINTS.some((hint) => locale.includes(hint))) {
            return 'ko';
        }
        if (locale.length > 0 && locale.toLowerCase().includes('en')) {
            return 'en';
        }
    }
    return 'en';
}
//# sourceMappingURL=lang.js.map