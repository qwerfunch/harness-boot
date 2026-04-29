/**
 * User-facing string catalog with EN / KO translations (F-092 port
 * of `scripts/ui/messages.py`, originally F-040).
 *
 * Backend stays English (deterministic core, code, schema, commit
 * messages). This catalog covers only the surface a user reads — the
 * "frontend" of the plugin. Adding a key:
 *
 *   1. Append the key to {@link REQUIRED_KEYS}.
 *   2. Add the entry to both `EN` and `KO` dicts.
 *   3. Bump the parity test so a missing translation fails loudly.
 *
 * @module ui/messages
 */
import type { Lang } from './lang.js';
/** Every required catalog key — translation parity is asserted on this list. */
export declare const REQUIRED_KEYS: ReadonlyArray<string>;
/**
 * Resolves a catalog entry for a given locale, with EN fallback.
 *
 * @param key - Catalog key. Throws when unknown — missing
 *   translations should fail loud rather than ship blank text.
 * @param lang - Locale tag; unknown values fall back to `'en'`.
 * @param fmt - Positional formatter values for `{name}`-style
 *   placeholders.
 */
export declare function t(key: string, lang?: Lang | string, fmt?: Record<string, unknown>): string;
//# sourceMappingURL=messages.d.ts.map