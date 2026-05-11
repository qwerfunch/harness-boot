/**
 * Spec archive — separates *living* feature definitions from *historical*
 * bodies (F-132).
 *
 * The harness-boot self-plan (logcat-on ISSUES-LOG return, root-cause
 * cycle 1) reframed the long-standing context bloat problem: spec.yaml
 * is forced to carry both the currently living definition and the full
 * history because BR-002 says spec is SSoT. The compaction tool from
 * F-131 was a band-aid that rebloats over time. The real fix is to move
 * the **body** of done feature entries (`description` and
 * `acceptance_criteria`) out of the live spec.yaml and into a sibling
 * `spec.archive.yaml` where it stays accessible but does not dominate
 * the LLM-import surface.
 *
 * Boundaries:
 *
 *   - **Body only** — `description` and `acceptance_criteria` move; every
 *     other key (id, name, type, ui_surface, performance_budget, area,
 *     digest, supersedes, ...) stays on the live entry. Dashboards,
 *     drift detectors, gate runners, and the validator schema all keep
 *     working.
 *   - **Idempotent** — a second `moveToArchive` on the same id is a
 *     no-op for the live file (the body is already gone) and an
 *     overwrite-with-same-bytes for the archive (re-yaml-stringify).
 *     A test pins both invariants.
 *   - **Lifecycle-driven, not user-facing** — there is no new CLI
 *     subcommand. `complete()` in `src/work.ts` calls this module after
 *     a successful transition; `--hotfix-reason` overrides do not bypass
 *     the move (the feature still went to `done`).
 *   - **Best effort** — the caller (`complete()`) wraps the call in
 *     try/catch and silently warns on stderr if the archive write
 *     fails. The transition itself is already committed; the archive
 *     is a downstream effect that a later sync run can repair.
 *
 * @module spec/archive
 */

import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

import {parse as yamlParse, stringify as yamlStringify} from 'yaml';

/** The two body keys the archive separates out. */
const BODY_KEYS: readonly string[] = ['description', 'acceptance_criteria'] as const;

/** Default top-level shape for a freshly created archive file. */
function blankArchive(): Record<string, unknown> {
  return {
    version: '2.3',
    schema_version: '2.3',
    features: [] as Array<Record<string, unknown>>,
  };
}

/**
 * Moves the body fields of `<harnessDir>/spec.yaml`'s feature `fid`
 * into `<harnessDir>/spec.archive.yaml`.
 *
 * Behaviour:
 *
 *   - When the live entry has neither `description` nor
 *     `acceptance_criteria`, the call is a silent no-op (no archive
 *     file is created).
 *   - When the archive already has an entry with the same id, the
 *     entry is replaced (overwrite) so the archive always reflects the
 *     last seen body.
 *   - Append order in the archive follows insertion: a brand-new id
 *     goes at the end of the array.
 *   - When `fid` is not present in the live spec, the call is a silent
 *     no-op (mirrors the lifecycle reality — `complete()` only invokes
 *     this for ids it just transitioned).
 *
 * @param harnessDir absolute or relative path to the `.harness/` dir
 * @param fid        feature id to extract (e.g. `'F-132'`)
 * @throws when `spec.yaml` cannot be parsed; the caller in `complete()`
 *         catches and emits a stderr warning so the lifecycle does not
 *         regress.
 */
export function moveToArchive(harnessDir: string, fid: string): void {
  const specPath = join(harnessDir, 'spec.yaml');
  const archivePath = join(harnessDir, 'spec.archive.yaml');

  const spec = yamlParse(readFileSync(specPath, 'utf-8')) as Record<string, unknown> | null;
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    return;
  }
  const features = spec['features'];
  if (!Array.isArray(features)) {
    return;
  }
  const liveEntry = features.find((f) => isFeatureRecord(f) && f['id'] === fid) as
    | Record<string, unknown>
    | undefined;
  if (liveEntry === undefined) {
    return;
  }

  const body = extractBody(liveEntry);
  if (body === null) {
    return;
  }

  // Strip the body keys from the live entry, in place on the loaded tree.
  for (const key of BODY_KEYS) {
    delete liveEntry[key];
  }
  writeFileSync(specPath, yamlStringify(spec), 'utf-8');

  const archive = loadArchive(archivePath);
  upsertArchiveEntry(archive, fid, body);
  writeFileSync(archivePath, yamlStringify(archive), 'utf-8');
}

/**
 * Returns the body payload for an entry, or `null` when neither body
 * key is present. The returned object always carries the `id` first
 * so the archive yaml reads naturally top-to-bottom.
 */
function extractBody(entry: Record<string, unknown>): Record<string, unknown> | null {
  const description = entry['description'];
  const ac = entry['acceptance_criteria'];
  const hasDescription = typeof description === 'string' && description.length > 0;
  const hasAc = Array.isArray(ac) && ac.length > 0;
  if (!hasDescription && !hasAc) {
    return null;
  }
  const out: Record<string, unknown> = {id: entry['id']};
  if (hasDescription) {
    out['description'] = description;
  }
  if (hasAc) {
    out['acceptance_criteria'] = ac;
  }
  return out;
}

/** Reads the archive file or returns a fresh blank shape. */
function loadArchive(archivePath: string): Record<string, unknown> {
  if (!existsSync(archivePath)) {
    return blankArchive();
  }
  const parsed = yamlParse(readFileSync(archivePath, 'utf-8')) as Record<string, unknown> | null;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return blankArchive();
  }
  if (!Array.isArray(parsed['features'])) {
    parsed['features'] = [];
  }
  return parsed;
}

/**
 * Inserts or replaces the body entry for `fid` inside `archive`.
 * Insertion order is "append at end" for new ids; existing ids are
 * mutated in place so the file stays diff-friendly across runs.
 */
function upsertArchiveEntry(
  archive: Record<string, unknown>,
  fid: string,
  body: Record<string, unknown>,
): void {
  const features = archive['features'] as Array<Record<string, unknown>>;
  const existingIndex = features.findIndex((f) => isFeatureRecord(f) && f['id'] === fid);
  if (existingIndex === -1) {
    features.push(body);
    return;
  }
  features[existingIndex] = body;
}

function isFeatureRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Statuses considered shipped — bulk migration only touches these. */
const SHIPPED_STATUSES: ReadonlySet<string> = new Set(['done', 'archived']);

/**
 * F-137 — relocates **all existing** done/archived feature bodies from
 * `spec.yaml` to `spec.archive.yaml` in a single pass. Closes the
 * recursive gap left by F-132~F-134, where archive auto-move only
 * triggers on the next `complete()` and never reaches features that
 * shipped before the auto-move existed.
 *
 * Behaviour:
 *
 *   - Reads `state.yaml` for ids whose status is in
 *     {@link SHIPPED_STATUSES}.
 *   - For each id, calls {@link moveToArchive} (no-op when the body
 *     is already gone — preserving idempotency at the per-id level).
 *   - Returns the count of features whose body was actually moved
 *     (not the count attempted). Callers use this to decide whether
 *     to emit an event / warn line.
 *
 * Boundaries:
 *
 *   - **Read-side guard** — call site (in `sync.ts`) is expected to
 *     check working-tree cleanliness and the opt-out config before
 *     invoking. This function itself does not consult those signals;
 *     it does the work or stays silent.
 *   - **Stable order** — features are iterated in their state.yaml
 *     order so the resulting `spec.archive.yaml` reads naturally
 *     (oldest done id first).
 *
 * @param harnessDir absolute or relative path to the `.harness/` dir
 * @returns number of features whose body was actually relocated
 * @throws when `state.yaml` or `spec.yaml` cannot be parsed; the
 *         caller is expected to catch.
 */
export function bulkMigrate(harnessDir: string): number {
  const statePath = join(harnessDir, 'state.yaml');
  const specPath = join(harnessDir, 'spec.yaml');

  if (!existsSync(statePath) || !existsSync(specPath)) {
    return 0;
  }

  const state = yamlParse(readFileSync(statePath, 'utf-8')) as Record<string, unknown> | null;
  if (state === null || typeof state !== 'object' || Array.isArray(state)) {
    return 0;
  }
  const stateFeatures = state['features'];
  if (!Array.isArray(stateFeatures)) {
    return 0;
  }

  const spec = yamlParse(readFileSync(specPath, 'utf-8')) as Record<string, unknown> | null;
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    return 0;
  }
  const specFeatures = spec['features'];
  if (!Array.isArray(specFeatures)) {
    return 0;
  }

  let moved = 0;
  for (const sf of stateFeatures) {
    if (!isFeatureRecord(sf)) {
      continue;
    }
    const id = sf['id'];
    const status = sf['status'];
    if (typeof id !== 'string' || typeof status !== 'string') {
      continue;
    }
    if (!SHIPPED_STATUSES.has(status)) {
      continue;
    }
    // Cheap pre-check: only call moveToArchive when the live entry
    // still has a body. moveToArchive itself short-circuits in the
    // no-body case, but skipping the file read/write keeps the bulk
    // path fast on already-migrated specs (idempotent + cheap).
    const liveEntry = specFeatures.find(
      (f) => isFeatureRecord(f) && f['id'] === id,
    ) as Record<string, unknown> | undefined;
    if (liveEntry === undefined) {
      continue;
    }
    const hasBody =
      (typeof liveEntry['description'] === 'string' && liveEntry['description'].length > 0) ||
      (Array.isArray(liveEntry['acceptance_criteria']) &&
        liveEntry['acceptance_criteria'].length > 0);
    if (!hasBody) {
      continue;
    }
    moveToArchive(harnessDir, id);
    moved += 1;
  }
  return moved;
}
