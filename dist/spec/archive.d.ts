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
//# sourceMappingURL=archive.d.ts.map