/**
 * feature.modules → AreaRecord cluster mapping (F-101 port of
 * `scripts/scan/area_resolver.py`, F-037).
 *
 * Pure deterministic mapping. Reuses a {@link StructureSummary}
 * passed in by the caller to avoid a second walk of the project
 * tree.
 *
 * @module scan/areaResolver
 */
import type { StructureSummary } from './structure.js';
/** One detected area cluster. */
export interface AreaRecord {
    slug: string;
    label: string;
    paths: ReadonlyArray<string>;
    modules: ReadonlyArray<string>;
    feature_id: string;
}
/** Returns one AreaRecord per cluster of resolvable modules. */
export declare function resolveAreas(feature: Record<string, unknown>, projectRoot: string, structure: StructureSummary): AreaRecord[];
//# sourceMappingURL=areaResolver.d.ts.map