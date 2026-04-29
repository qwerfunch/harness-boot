/**
 * Kickoff ceremony template generator (F-097 port of
 * `scripts/ceremonies/kickoff.py`).
 *
 * Generates `.harness/_workspace/kickoff/F-N.md` with per-role
 * headings for the agents matched by the feature shape. Python-side
 * template only — orchestrator fills each heading via prose-contract
 * invocations.
 *
 * Idempotency contract (v0.8.2): existing kickoff files are not
 * overwritten unless `force=true`.
 *
 * @module ceremonies/kickoff
 */
/** Optional input for {@link generateKickoff}. */
export interface GenerateKickoffOptions {
    hasAudio?: boolean;
    timestamp?: string;
    force?: boolean;
    mode?: 'product' | 'prototype';
    styleBlock?: string;
}
/** Returns true when a feature declares ui_surface.has_audio = true. */
export declare function hasAudioFlag(feature: unknown): boolean;
/**
 * Maps a feature dict to its routing shape list.
 *
 * Heuristic order:
 *
 *   1. Empty title + AC + modules → `['baseline-empty-vague']`.
 *   2. Otherwise accumulate `ui_surface.present`, `performance_budget`,
 *      `sensitive_or_auth`.
 *   3. No specialist shape → `pure_domain_logic`.
 *   4. Always append `feature_completion`.
 */
export declare function detectShapes(feature: unknown, spec?: unknown): string[];
/**
 * Resolves a shape list to a deduped, order-preserved agent list.
 * When `hasAudio` is true, audio-designer slots in immediately
 * before a11y-auditor (matches the design-review reviewer ordering).
 */
export declare function agentsForShapes(shapes: ReadonlyArray<string>, hasAudio?: boolean): string[];
/**
 * F-039 — collects parallel-capable agent groups for the given shape
 * list. Filters audio-designer when has_audio is false and drops
 * groups with fewer than two members.
 */
export declare function parallelGroupsForShapes(shapes: ReadonlyArray<string>, hasAudio?: boolean): string[][];
/**
 * F-037 — builds the "기존 스타일 컨텍스트" section from the area
 * index. Returns an empty string when there is no overlap or when
 * `area_index.yaml` is absent.
 */
export declare function renderStyleBlock(harnessDir: string, feature: unknown): string;
/**
 * Generates the kickoff template + event for a feature.
 *
 * Idempotency: when the kickoff file already exists, the function
 * returns the existing path without writing or emitting an event
 * (unless `force=true`).
 */
export declare function generateKickoff(harnessDir: string, featureId: string, shapes: ReadonlyArray<string>, options?: GenerateKickoffOptions): string;
//# sourceMappingURL=kickoff.d.ts.map