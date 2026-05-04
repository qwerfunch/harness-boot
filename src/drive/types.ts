/**
 * Drive (autonomous loop) shared types — v0.14.0 / F-118 (Stage 1).
 *
 * The runtime mirror lives in `state.yaml.goals[]` and is typed by
 * {@link GoalRuntimeState} in `src/core/state.ts`. The forward
 * definitions in `spec.yaml.goals[]` are typed here.
 *
 * Schema source of truth: `docs/schemas/spec.schema.json` (v2.3.9).
 *
 * @module drive/types
 */

/**
 * One Goal definition as it appears in `spec.yaml.goals[]`.
 *
 * A Goal groups N features under one user-supplied natural-language
 * objective. `feature_ids` is the forward index; the inverse is the
 * optional `features[].goal_id` back-reference. Both are written
 * together by drive's Phase A so they stay consistent.
 */
export interface GoalSpec {
  /** Goal identifier — `G-NNN`, monotonically allocated. */
  id: string;
  /** URL-safe lowercase slug derived from `title`. */
  slug: string;
  /** User-supplied natural-language objective (verbatim — Korean OK). */
  title: string;
  /** 1-paragraph summary refined by researcher / product-planner. */
  description?: string;
  /** Forward index — features that compose this goal. */
  feature_ids: string[];
  /** ISO8601 UTC timestamp of creation. */
  created_at?: string;
  /** Set when archived; `null` (or unset) on active goals. */
  archived_at?: string | null;
  /** 1-2 line archive reason. `null` on active goals. */
  archive_reason?: string | null;
  /** Pass-through for extensions. */
  [key: string]: unknown;
}

/**
 * Input shape for {@link createGoal}.
 *
 * `id` and `slug` are derived (allocate next G-NNN, normalize slug
 * from title). `created_at` defaults to "now". `feature_ids` is
 * empty by default; drive's Phase A appends to it after each
 * feature-author scaffold.
 */
export interface CreateGoalInput {
  title: string;
  description?: string;
  feature_ids?: readonly string[];
  /** Override clock for tests. */
  now?: Date;
}

/**
 * Drive halt taxonomy — exhaustive enumeration of why drive yields
 * back to the user (BR-015 (e)).
 *
 * Stage 1 only emits `manual` (the dashboard / status surface is
 * read-only); the rest are wired in stage 2 (F-119).
 */
export type HaltReason =
  | 'plan_phase_approval'
  | 'commit_boundary'
  | 'retry_threshold'
  | 'drift_severity_error'
  | 'feature_blocked'
  | 'wall_clock'
  | 'iteration_cap'
  | 'network_failure'
  | 'stop_file'
  | 'manual';
