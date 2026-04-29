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
/** Cap on the "in progress (others)" list. */
export declare function maxOtherList(): number;
/** Cap on the "pending" list. */
export declare function maxPendingList(): number;
/** Cap on the "unregistered candidates" list. */
export declare function maxUnregisteredList(): number;
//# sourceMappingURL=dashboardConfig.d.ts.map