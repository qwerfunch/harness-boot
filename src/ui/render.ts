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
export const PARALLEL_TOKEN = ' ∥ ';

/** Default token between sequential steps. */
export const SEQUENCE_TOKEN = ' → ';

/** Fallback joiner used when no parallel groups are declared. */
export const COMMA_JOIN = ', ';

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
export function renderAgentChain(
  agents: ReadonlyArray<string>,
  groups: ReadonlyArray<ReadonlyArray<string>>,
  options: RenderAgentChainOptions = {},
): string {
  const parallelToken = options.parallelToken ?? PARALLEL_TOKEN;
  const sequenceToken = options.sequenceToken ?? SEQUENCE_TOKEN;
  const commaJoin = options.commaJoin ?? COMMA_JOIN;

  if (groups.length === 0) {
    return agents.join(commaJoin);
  }

  const groupSets = groups.map((g) => new Set(g));
  const parts: string[] = [];
  let i = 0;
  while (i < agents.length) {
    const member = agents[i]!;
    const matched = groupSets.find((gs) => gs.has(member)) ?? null;
    if (matched === null) {
      parts.push(member);
      i++;
      continue;
    }
    const block: string[] = [];
    while (i < agents.length && matched.has(agents[i]!)) {
      block.push(agents[i]!);
      i++;
    }
    if (block.length >= 2) {
      parts.push(`(${block.join(parallelToken).trim()})`);
    } else {
      parts.push(block[0]!);
    }
  }
  return parts.join(sequenceToken).trim();
}
