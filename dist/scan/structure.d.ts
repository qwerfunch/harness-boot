/**
 * Top-level directory shape + entity-candidate file detection (F-101
 * port of `scripts/scan/structure.py`, F-036).
 *
 * Pure read-only walk capped at depth 3 from `root`. Skips a fixed
 * list of build / VCS / vendored dirs to keep the LLM input budget
 * bounded.
 *
 * @module scan/structure
 */
/** Outcome of a structure scan. */
export interface StructureSummary {
    top_dirs: string[];
    adr_dir: string | null;
    entity_candidate_files: string[];
    readme_path: string | null;
}
/** Returns the directory shape summary for `root`. */
export declare function scanStructure(root: string): StructureSummary;
//# sourceMappingURL=structure.d.ts.map