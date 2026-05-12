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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
/** The two body keys the archive separates out. */
const BODY_KEYS = ['description', 'acceptance_criteria'];
/**
 * F-145 — when archiving a feature whose `digest` is unset, auto-extract
 * the first {@link DIGEST_AUTO_LIMIT} characters of `description` so the
 * dashboard / kickoff template / external `@import` reader still has a
 * meaningful one-line label after the body moves to spec.archive.yaml.
 *
 * The cap matches the `name` schema cap (100 chars) plus a small
 * margin so a digest that *expands* on the name still fits in a
 * single dashboard row. Lower than 80 reads as truncated; higher than
 * ~140 starts wrapping in narrow terminals.
 */
const DIGEST_AUTO_LIMIT = 120;
/** Compresses internal whitespace runs so a multi-line description fits in one line. */
function condenseWhitespace(value) {
    return value.trim().replace(/\s+/g, ' ');
}
/**
 * Returns a digest derived from `description`, capped at
 * {@link DIGEST_AUTO_LIMIT}. When the description does not exceed the
 * limit the original (whitespace-condensed) text is returned without an
 * ellipsis; longer descriptions are truncated and suffixed with `...`.
 */
function deriveDigestFromDescription(description) {
    const condensed = condenseWhitespace(description);
    if (condensed.length <= DIGEST_AUTO_LIMIT) {
        return condensed;
    }
    // Reserve 3 chars for the ellipsis so the total stays at the limit.
    return `${condensed.slice(0, DIGEST_AUTO_LIMIT - 3).trimEnd()}...`;
}
/** Default top-level shape for a freshly created archive file. */
function blankArchive() {
    return {
        version: '2.3',
        schema_version: '2.3',
        features: [],
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
export function moveToArchive(harnessDir, fid) {
    const specPath = join(harnessDir, 'spec.yaml');
    const archivePath = join(harnessDir, 'spec.archive.yaml');
    const spec = yamlParse(readFileSync(specPath, 'utf-8'));
    if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
        return;
    }
    const features = spec['features'];
    if (!Array.isArray(features)) {
        return;
    }
    const liveEntry = features.find((f) => isFeatureRecord(f) && f['id'] === fid);
    if (liveEntry === undefined) {
        return;
    }
    const body = extractBody(liveEntry);
    if (body === null) {
        return;
    }
    // F-145 — backfill the live entry's `digest` from the description before
    // the body moves out, so dashboards / kickoff / external @import readers
    // still see a meaningful one-line label. Existing digest is respected
    // (user-authored or already-auto-filled values are not overwritten).
    if (typeof liveEntry['digest'] !== 'string' &&
        typeof liveEntry['description'] === 'string' &&
        liveEntry['description'].length > 0) {
        liveEntry['digest'] = deriveDigestFromDescription(liveEntry['description']);
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
function extractBody(entry) {
    const description = entry['description'];
    const ac = entry['acceptance_criteria'];
    const hasDescription = typeof description === 'string' && description.length > 0;
    const hasAc = Array.isArray(ac) && ac.length > 0;
    if (!hasDescription && !hasAc) {
        return null;
    }
    const out = { id: entry['id'] };
    if (hasDescription) {
        out['description'] = description;
    }
    if (hasAc) {
        out['acceptance_criteria'] = ac;
    }
    return out;
}
/** Reads the archive file or returns a fresh blank shape. */
function loadArchive(archivePath) {
    if (!existsSync(archivePath)) {
        return blankArchive();
    }
    const parsed = yamlParse(readFileSync(archivePath, 'utf-8'));
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
function upsertArchiveEntry(archive, fid, body) {
    const features = archive['features'];
    const existingIndex = features.findIndex((f) => isFeatureRecord(f) && f['id'] === fid);
    if (existingIndex === -1) {
        features.push(body);
        return;
    }
    features[existingIndex] = body;
}
function isFeatureRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Statuses considered shipped — bulk migration only touches these. */
const SHIPPED_STATUSES = new Set(['done', 'archived']);
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
export function bulkMigrate(harnessDir) {
    const statePath = join(harnessDir, 'state.yaml');
    const specPath = join(harnessDir, 'spec.yaml');
    if (!existsSync(statePath) || !existsSync(specPath)) {
        return 0;
    }
    const state = yamlParse(readFileSync(statePath, 'utf-8'));
    if (state === null || typeof state !== 'object' || Array.isArray(state)) {
        return 0;
    }
    const stateFeatures = state['features'];
    if (!Array.isArray(stateFeatures)) {
        return 0;
    }
    const spec = yamlParse(readFileSync(specPath, 'utf-8'));
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
        const liveEntry = specFeatures.find((f) => isFeatureRecord(f) && f['id'] === id);
        if (liveEntry === undefined) {
            continue;
        }
        const hasBody = (typeof liveEntry['description'] === 'string' && liveEntry['description'].length > 0) ||
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
/**
 * Default minimum age (in days) before a resolved open question becomes
 * eligible for relocation to `spec.archive.yaml`. The cap protects users
 * who answer a question and then re-open it within a few days from
 * losing the live entry. 30 days mirrors the typical sprint cadence.
 */
const DEFAULT_OPEN_QUESTION_ARCHIVE_AGE_DAYS = 30;
/**
 * F-147 — relocates resolved `open_questions[]` entries from `spec.yaml`
 * into `spec.archive.yaml` when the resolution is older than
 * `ageDays` (default 30). Two reasons for the delay window:
 *
 *   1. Allows a small reopen / second-thoughts window.
 *   2. Lets adjacent CI / review traffic reference the live entry
 *      before it disappears.
 *
 * Eligibility:
 *   - `status === 'answered'`, **or** the entry carries any of
 *     `answered_at` · `resolved_at` · `closed_at` (free-form fields the
 *     schema does not enforce; the timestamp wins when status is absent).
 *   - The chosen timestamp is older than `ageDays` from `now`.
 *
 * Behaviour:
 *   - Idempotent: archive entries are upserted by `id`.
 *   - Stable order in spec.archive.yaml — append at the end for new ids,
 *     in-place replace for existing ones (mirrors {@link moveToArchive}).
 *   - Returns the count actually moved (0 on no-op).
 *
 * Boundaries:
 *   - This function never reads `state.yaml` (open_questions live in
 *     spec.yaml only); the caller in `sync.ts` is responsible for the
 *     dirty-tree guard and the opt-out check.
 *   - On a malformed spec or archive shape the function returns 0
 *     without throwing — caller wraps in try/catch as a defence in depth.
 *
 * @returns the count of `open_questions[]` entries actually relocated.
 */
export function autoArchiveOpenQuestions(harnessDir, options = {}) {
    const specPath = join(harnessDir, 'spec.yaml');
    const archivePath = join(harnessDir, 'spec.archive.yaml');
    if (!existsSync(specPath)) {
        return 0;
    }
    const spec = yamlParse(readFileSync(specPath, 'utf-8'));
    if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
        return 0;
    }
    const liveQuestions = spec['open_questions'];
    if (!Array.isArray(liveQuestions) || liveQuestions.length === 0) {
        return 0;
    }
    const ageDays = options.ageDays ?? DEFAULT_OPEN_QUESTION_ARCHIVE_AGE_DAYS;
    const now = options.now ?? new Date();
    const ageMillis = ageDays * 24 * 60 * 60 * 1000;
    const ageThreshold = now.getTime() - ageMillis;
    const eligible = [];
    const remaining = [];
    for (const entry of liveQuestions) {
        if (!isPlainRecord(entry)) {
            remaining.push(entry);
            continue;
        }
        const resolvedAt = pickResolvedTimestamp(entry);
        if (resolvedAt === null) {
            remaining.push(entry);
            continue;
        }
        if (resolvedAt.getTime() > ageThreshold) {
            remaining.push(entry);
            continue;
        }
        eligible.push(entry);
    }
    if (eligible.length === 0) {
        return 0;
    }
    // Move eligible entries into the archive. Mutation strategy mirrors
    // {@link moveToArchive}: load → upsert → write.
    const archive = loadArchive(archivePath);
    if (!Array.isArray(archive['open_questions'])) {
        archive['open_questions'] = [];
    }
    const archiveQuestions = archive['open_questions'];
    for (const entry of eligible) {
        const id = typeof entry['id'] === 'string' ? entry['id'] : null;
        if (id === null) {
            continue;
        }
        const existingIndex = archiveQuestions.findIndex((q) => isPlainRecord(q) && q['id'] === id);
        if (existingIndex === -1) {
            archiveQuestions.push(entry);
        }
        else {
            archiveQuestions[existingIndex] = entry;
        }
    }
    spec['open_questions'] = remaining;
    writeFileSync(specPath, yamlStringify(spec), 'utf-8');
    writeFileSync(archivePath, yamlStringify(archive), 'utf-8');
    return eligible.length;
}
/** Local guard reused inside {@link autoArchiveOpenQuestions}. */
function isPlainRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/**
 * Picks the resolution timestamp for an open question. Order:
 *
 *   1. `answered_at` — explicit field favoured by F-147 docs.
 *   2. `resolved_at` — common synonym in adjacent OSS schemas.
 *   3. `closed_at`   — fallback for ticket-system imports.
 *
 * When `status === 'answered'` is present *without* a timestamp, the
 * function falls back to the file's mtime — but that requires a path,
 * which the per-entry call does not have, so the path-less code path
 * returns `null` and the entry stays live until a timestamp is added.
 */
function pickResolvedTimestamp(entry) {
    for (const key of ['answered_at', 'resolved_at', 'closed_at']) {
        const raw = entry[key];
        if (typeof raw !== 'string' || raw.length === 0) {
            continue;
        }
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return null;
}
//# sourceMappingURL=archive.js.map