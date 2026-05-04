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

import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {parse as yamlParse, stringify as yamlStringify} from 'yaml';
import type {CreateGoalInput, GoalSpec} from './types.js';

/** Maximum slug length before truncation. */
const MAX_SLUG_LENGTH = 60;

/** Returns the current UTC timestamp formatted as `YYYY-MM-DDTHH:MM:SSZ`. */
function nowIso(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear().toString().padStart(4, '0');
  const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = now.getUTCDate().toString().padStart(2, '0');
  const hh = now.getUTCHours().toString().padStart(2, '0');
  const mi = now.getUTCMinutes().toString().padStart(2, '0');
  const ss = now.getUTCSeconds().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}

/** Type guard — narrows an unknown value to a plain object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

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
export function nextGoalId(existing: readonly string[]): string {
  let max = 0;
  for (const id of existing) {
    const m = /^G-(\d+)$/.exec(id);
    if (m === null) {
      continue;
    }
    const n = Number.parseInt(m[1] ?? '0', 10);
    if (Number.isFinite(n) && n > max) {
      max = n;
    }
  }
  const next = max + 1;
  return `G-${next.toString().padStart(3, '0')}`;
}

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
export function normalizeSlug(title: string): string {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (ascii.length > 0 && /^[a-z0-9]/.test(ascii)) {
    return ascii.length > MAX_SLUG_LENGTH ? ascii.slice(0, MAX_SLUG_LENGTH) : ascii;
  }

  const hash = createHash('sha256').update(title, 'utf8').digest('hex').slice(0, 8);
  return `goal-${hash}`;
}

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
export function readGoals(specPath: string): GoalSpec[] {
  const raw = readFileSync(specPath, 'utf-8');
  const doc: unknown = yamlParse(raw);
  if (!isPlainObject(doc)) {
    return [];
  }
  const goals = doc.goals;
  if (!Array.isArray(goals)) {
    return [];
  }
  const out: GoalSpec[] = [];
  for (const g of goals) {
    if (!isPlainObject(g)) {
      continue;
    }
    if (typeof g.id !== 'string' || typeof g.title !== 'string') {
      continue;
    }
    const slug = typeof g.slug === 'string' ? g.slug : normalizeSlug(g.title);
    const featureIds = Array.isArray(g.feature_ids)
      ? g.feature_ids.filter((x): x is string => typeof x === 'string')
      : [];
    out.push({
      ...(g as Record<string, unknown>),
      id: g.id,
      slug,
      title: g.title,
      feature_ids: featureIds,
    } as GoalSpec);
  }
  return out;
}

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
export function createGoal(input: CreateGoalInput, existingIds: readonly string[]): GoalSpec {
  const id = nextGoalId(existingIds);
  const slug = normalizeSlug(input.title);
  const goal: GoalSpec = {
    id,
    slug,
    title: input.title,
    feature_ids: [...(input.feature_ids ?? [])],
    created_at: nowIso(input.now),
    archived_at: null,
    archive_reason: null,
  };
  if (typeof input.description === 'string' && input.description.length > 0) {
    goal.description = input.description;
  }
  return goal;
}

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
export function appendGoal(specPath: string, goal: GoalSpec): void {
  const raw = readFileSync(specPath, 'utf-8');
  const doc: unknown = yamlParse(raw);
  if (!isPlainObject(doc)) {
    throw new Error(`spec.yaml is not a mapping: ${specPath}`);
  }
  const existing = Array.isArray(doc.goals) ? [...doc.goals] : [];
  for (const g of existing) {
    if (isPlainObject(g) && g.id === goal.id) {
      throw new Error(`goal id collision: ${goal.id} already exists in ${specPath}`);
    }
  }
  existing.push(goal);
  doc.goals = existing;
  const out = yamlStringify(doc, {
    sortMapEntries: false,
    indentSeq: false,
    lineWidth: 0,
  });
  writeFileSync(specPath, out, 'utf-8');
}

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
export function archiveGoal(
  specPath: string,
  gid: string,
  reason: string,
  now: Date = new Date(),
): void {
  if (!reason || reason.trim().length === 0) {
    throw new Error('archive_reason required — empty strings defeat the audit trail');
  }
  const raw = readFileSync(specPath, 'utf-8');
  const doc: unknown = yamlParse(raw);
  if (!isPlainObject(doc)) {
    throw new Error(`spec.yaml is not a mapping: ${specPath}`);
  }
  const existing = Array.isArray(doc.goals) ? [...doc.goals] : [];
  let touched = false;
  for (const g of existing) {
    if (isPlainObject(g) && g.id === gid) {
      g.archived_at = nowIso(now);
      g.archive_reason = reason;
      touched = true;
      break;
    }
  }
  if (!touched) {
    throw new Error(`goal ${gid} not found in ${specPath}`);
  }
  doc.goals = existing;
  const out = yamlStringify(doc, {
    sortMapEntries: false,
    indentSeq: false,
    lineWidth: 0,
  });
  writeFileSync(specPath, out, 'utf-8');
}
