/**
 * Orchestration routing data — single source of truth (F-088 port of
 * `scripts/core/routing.py`, originally introduced in F-043).
 *
 * Holds the routing tables the kickoff ceremony and orchestrator
 * dispatcher rely on:
 *
 *   - {@link ROUTING_SHAPES} — feature shape → ordered agent list.
 *   - {@link PARALLEL_GROUPS} — feature shape → tuples of agents the
 *     orchestrator may dispatch in one Claude Code message.
 *
 * A future `.harness/routing.yaml` override hook will plug in here.
 *
 * @module routing
 */
/**
 * Feature shape → ordered agent list.
 *
 * Identical to the Python source in key insertion order, list
 * ordering, and member names so cross-runtime tooling sees the same
 * sequence.
 */
export declare const ROUTING_SHAPES: Record<string, readonly string[]>;
/**
 * Feature shape → tuples of agents the orchestrator may dispatch
 * concurrently.
 *
 * F-039 — single-message multi-tool-use can run these concurrently:
 *
 *   - `sensitive_or_auth`: security-engineer and reviewer are both
 *     read-only audits; security holds BLOCK veto.
 *   - `ui_surface.present`: visual-designer and audio-designer both
 *     depend on ux-architect's flows.md and write to separate output
 *     files (tokens.yaml / audio.yaml). When `has_audio=false`, the
 *     audio-designer entry is dropped at the helper layer (see the
 *     ceremony parallel-groups helper).
 */
export declare const PARALLEL_GROUPS: Record<string, ReadonlyArray<readonly string[]>>;
//# sourceMappingURL=routing.d.ts.map