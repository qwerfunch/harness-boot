/**
 * Agent chain renderer — sequence + parallel groups (F-092 port of
 * `scripts/ui/render.py`, originally F-043).
 *
 * Used by both the work activate output and the dashboard's `agent
 * chain:` line. Pure: takes the resolved agent list and the parallel
 * groups, returns the formatted string. No I/O.
 *
 * @module ui/render
 */
/** Default token between parallel-group members. */
export declare const PARALLEL_TOKEN = " \u2225 ";
/** Default token between sequential steps. */
export declare const SEQUENCE_TOKEN = " \u2192 ";
/** Fallback joiner used when no parallel groups are declared. */
export declare const COMMA_JOIN = ", ";
/** Optional input for {@link renderAgentChain}. */
export interface RenderAgentChainOptions {
    parallelToken?: string;
    sequenceToken?: string;
    commaJoin?: string;
}
/**
 * Renders an agent chain.
 *
 * @param agents - Ordered, deduped agent list (kickoff routing
 *   result).
 * @param groups - Parallel-capable groups; each group is a list of
 *   agent names.
 * @returns Either the comma-joined `agents` (legacy zero-diff when
 *   `groups` is empty) or a chain like `a → (b ∥ c) → d` collapsing
 *   contiguous runs that match a group into a parenthesized parallel
 *   block.
 */
export declare function renderAgentChain(agents: ReadonlyArray<string>, groups: ReadonlyArray<ReadonlyArray<string>>, options?: RenderAgentChainOptions): string;
//# sourceMappingURL=render.d.ts.map