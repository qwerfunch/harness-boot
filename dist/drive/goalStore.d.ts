/**
 * GoalStore — read / write helpers for `spec.yaml.goals[]` plus
 * pure ID and slug helpers (v0.14.0 / F-118 — Stage 1).
 *
 * Stage 1 ships read access and pure helpers (allocate, normalize)
 * that stage 2's drive loop will use to author new goals. Mutation
 * (`appendGoal`, `archiveGoal`) is implemented but intentionally
 * unused at this stage — the slash-command surface for goal creation
 * lives in F-119.
 *
 * Spec mirror policy: every mutation writes the file at the path
 * passed to the constructor. When called with `.harness/spec.yaml`
 * the dogfood workspace's canonical mirror under `docs/samples/...`
 * is the caller's responsibility (per `self_check.sh`'s `diff -q`
 * lockstep). User-installed projects only have one spec.yaml so the
 * single-path contract works there too.
 *
 * @module drive/goalStore
 */
import type { CreateGoalInput, GoalSpec } from './types.js';
/**
 * Allocates the next free `G-NNN` id given the existing ids.
 *
 * Pure — no side effects. Walks the input list, parses each entry's
 * numeric suffix, returns `G-${max + 1}`. Empty list yields `G-001`.
 * Non-`G-NNN` entries are ignored (drive can sit alongside any
 * future identifier scheme without crashing).
 *
 * Allocation is monotonic — gaps in the existing ids are never
 * reused. This matches `F-NNN` allocation in the canonical spec
 * (where F-073 was deliberately left blank).
 *
 * @param existing - Goal ids currently allocated.
 * @returns The next free id formatted `G-NNN` (zero-padded to 3 digits).
 */
export declare function nextGoalId(existing: readonly string[]): string;
/**
 * Normalizes a Goal title into a URL-safe lowercase slug.
 *
 * ASCII path: lowercases, strips non-alphanumeric / non-hyphen
 * characters, collapses whitespace runs to a single hyphen, and
 * truncates to {@link MAX_SLUG_LENGTH}.
 *
 * Non-ASCII path (Korean / CJK / emoji / RTL): when the ASCII
 * cleanup yields an empty or non-leading-alnum slug, falls back to
 * `goal-<sha256-prefix>` so the slug is always a valid path
 * component.
 *
 * Pure — same input always yields the same slug.
 *
 * @param title - The raw user-supplied title.
 * @returns A slug matching `^[a-z0-9][a-z0-9-]*$`.
 */
export declare function normalizeSlug(title: string): string;
/**
 * Reads `spec.yaml` and returns its `goals[]` array.
 *
 * Returns an empty array when the file omits the section
 * (legacy / pre-v2.3.9 spec.yaml — backward compatible).
 *
 * Malformed entries (non-object, missing `id`, etc.) are silently
 * dropped rather than throwing — drive must tolerate user edits to
 * spec.yaml without crashing on every render.
 *
 * @param specPath - Absolute path to a spec.yaml file.
 * @returns The list of goal definitions.
 */
export declare function readGoals(specPath: string): GoalSpec[];
/**
 * Composes a brand-new Goal definition.
 *
 * Pure — does not write to disk. Used by stage 2's drive loop
 * after the user-approved plan phase, then handed to
 * {@link appendGoal} for persistence.
 *
 * The `id` is allocated via {@link nextGoalId} against the existing
 * goal ids; the `slug` via {@link normalizeSlug} against the title.
 * Slug collisions across goals are rare in practice (user goals are
 * typed in human language) but caller can pass an explicit slug via
 * direct {@link GoalSpec} construction if disambiguation is needed.
 *
 * @param input - Title + optional description + optional feature_ids.
 * @param existingIds - Goal ids currently allocated (for collision-free id).
 * @returns The new goal record.
 */
export declare function createGoal(input: CreateGoalInput, existingIds: readonly string[]): GoalSpec;
/**
 * Persists a new Goal entry to `spec.yaml.goals[]`.
 *
 * Append-only — the existing array is preserved and the new goal
 * is pushed at the end. The file is rewritten as a whole;
 * formatting follows `yaml`'s defaults plus the same
 * `sortMapEntries: false` / `lineWidth: 0` overrides used by
 * {@link State.save} so quoting stays semantically equivalent.
 *
 * Lockstep mirrors are the caller's responsibility — when the
 * dogfood workspace is being driven, both `.harness/spec.yaml` and
 * `docs/samples/harness-boot-self/spec.yaml` must be written, in
 * that order, and the lockstep is checked by `self_check.sh`.
 *
 * @param specPath - Absolute path to the spec.yaml to mutate.
 * @param goal - The goal to append.
 * @throws when `goal.id` already exists in the file.
 */
export declare function appendGoal(specPath: string, goal: GoalSpec): void;
/**
 * Marks a Goal archived in `spec.yaml.goals[]`.
 *
 * Sets `archived_at` to "now" and `archive_reason` to the supplied
 * string. The Goal stays in the array — archive is declarative,
 * not a delete. Drive's status surface treats archived goals as
 * read-only.
 *
 * @param specPath - Absolute path to the spec.yaml.
 * @param gid - The goal id to archive.
 * @param reason - 1-2 line archive reason (required — empty strings
 *   defeat the audit trail).
 * @param now - Override clock for tests; defaults to current time.
 * @throws when the goal is not found or `reason` is empty.
 */
export declare function archiveGoal(specPath: string, gid: string, reason: string, now?: Date): void;
//# sourceMappingURL=goalStore.d.ts.map