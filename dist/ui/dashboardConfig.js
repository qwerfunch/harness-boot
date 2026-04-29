/**
 * Dashboard truncation limits with env overrides (F-092 port of
 * `scripts/ui/dashboard_config.py`, originally F-043).
 *
 * The dashboard truncates "in progress (others)", "pending", and
 * "unregistered" feature lists at five entries by default. This
 * module lifts those magic numbers out of the renderer so a project
 * with hundreds of features can dial them up via env without
 * touching code.
 *
 * Overrides (each independent):
 *
 *   - `HARNESS_DASHBOARD_MAX_OTHER`
 *   - `HARNESS_DASHBOARD_MAX_PENDING`
 *   - `HARNESS_DASHBOARD_MAX_UNREGISTERED`
 *
 * Invalid values (non-int, ≤ 0) silently fall back to the default.
 *
 * @module ui/dashboardConfig
 */
const DEFAULT_MAX_OTHER = 5;
const DEFAULT_MAX_PENDING = 5;
const DEFAULT_MAX_UNREGISTERED = 5;
/** Reads an env var as a positive integer; returns `defaultValue` on any failure. */
function envInt(name, defaultValue) {
    const raw = process.env[name];
    if (raw === undefined) {
        return defaultValue;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
        return defaultValue;
    }
    return value;
}
/** Cap on the "in progress (others)" list. */
export function maxOtherList() {
    return envInt('HARNESS_DASHBOARD_MAX_OTHER', DEFAULT_MAX_OTHER);
}
/** Cap on the "pending" list. */
export function maxPendingList() {
    return envInt('HARNESS_DASHBOARD_MAX_PENDING', DEFAULT_MAX_PENDING);
}
/** Cap on the "unregistered candidates" list. */
export function maxUnregisteredList() {
    return envInt('HARNESS_DASHBOARD_MAX_UNREGISTERED', DEFAULT_MAX_UNREGISTERED);
}
//# sourceMappingURL=dashboardConfig.js.map