/**
 * Tech-stack + project-name extraction across language manifests
 * (F-101 port of `scripts/scan/manifest.py`, F-036).
 *
 * Detection priority — first match wins:
 *
 *   package.json → pyproject.toml → Cargo.toml → go.mod
 *
 * Pure: only reads the four listed manifest files. TOML parsing uses
 * smol-toml (already a runtime dep) so pyproject / Cargo manifests
 * are first-class.
 *
 * @module scan/manifest
 */
/** Output shape of {@link extractTechStack}; keys are optional per Python parity. */
export interface TechStack {
    runtime?: string;
    language?: string;
    test?: string;
    build?: string;
    min_version?: string;
}
/** Returns the tech_stack dict for the most prominent manifest. */
export declare function extractTechStack(root: string): TechStack;
/** Returns the declared project name, falling back to the directory basename. */
export declare function extractProjectName(root: string): string | null;
//# sourceMappingURL=manifest.d.ts.map