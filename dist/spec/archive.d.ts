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
export declare function moveToArchive(harnessDir: string, fid: string): void;
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
export declare function bulkMigrate(harnessDir: string): number;
/** Optional input for {@link autoArchiveOpenQuestions}. */
export interface OpenQuestionArchiveOptions {
    /** Override the {@link DEFAULT_OPEN_QUESTION_ARCHIVE_AGE_DAYS} cap. */
    ageDays?: number;
    /** Override the wall clock — primarily for tests. */
    now?: Date;
}
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
export declare function autoArchiveOpenQuestions(harnessDir: string, options?: OpenQuestionArchiveOptions): number;
//# sourceMappingURL=archive.d.ts.map