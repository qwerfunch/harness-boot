/**
 * Layer-0 codebase signal collection for scenario-3 (F-160).
 *
 * Walks the project root once and returns a structured record of
 * everything the `codebase-archaeologist` agent can use without
 * calling an LLM. Deeper analysis (AST · entity relations · per-
 * feature fog-clear) happens at Layer-1 inside the work cycle and
 * is explicitly out of scope here.
 *
 * Mini-map principle (StarCraft fog-of-war): zoom out for the
 * outline, leave the per-feature interior dark until the work
 * cycle reveals it.
 *
 * @module init/codebase/signals
 */
import { type TechStack } from '../../scan/manifest.js';
/** Aggregate Layer-0 signal record. */
export interface Signals {
    readonly projectRoot: string;
    readonly tech: TechStack;
    readonly manifests: ReadonlyArray<string>;
    readonly buildDeploy: ReadonlyArray<string>;
    readonly styleConfigs: ReadonlyArray<string>;
    readonly dependencies: DependencyCategories;
    readonly directoryPattern: DirectoryPattern;
    readonly aiToolTraces: ReadonlyArray<string>;
    readonly ciStages: ReadonlyArray<string>;
    readonly license: string | null;
    readonly changelog: boolean;
    readonly i18n: boolean;
    readonly qualityEnforce: ReadonlyArray<string>;
    readonly readmePreview: string | null;
}
/** Categorized dependency snapshot. Keys map to common roles. */
export interface DependencyCategories {
    readonly framework: ReadonlyArray<string>;
    readonly orm: ReadonlyArray<string>;
    readonly api: ReadonlyArray<string>;
    readonly styling: ReadonlyArray<string>;
    readonly test: ReadonlyArray<string>;
    readonly state: ReadonlyArray<string>;
}
/** Detected high-level directory layout. */
export type DirectoryPattern = 'src+tests' | 'colocated' | 'next-app' | 'next-pages' | 'monorepo' | 'flat' | 'unknown';
/**
 * Walk the project root and return the consolidated Layer-0 signal
 * record. Pure read-only — no filesystem mutations.
 */
export declare function collectSignals(projectRoot: string): Signals;
//# sourceMappingURL=signals.d.ts.map