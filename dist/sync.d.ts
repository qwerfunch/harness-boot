/**
 * `/harness:sync` orchestrator (F-096 port of `scripts/sync.py`).
 *
 * Phase 0 wiring — composes the already-ported core/spec/render
 * modules into the four-step sync flow:
 *
 *   1. Load `spec.yaml` and run schema validation (when ajv is
 *      available).
 *   2. Expand `$include` (depth-1).
 *   3. Compute canonical hashes — raw + expanded + subtrees + Merkle.
 *   4. Render derived outputs (`domain.md`, `architecture.yaml`)
 *      under edit-wins guard, mutate `harness.yaml.generation`, and
 *      append a `sync_completed` event.
 *
 * Side effects:
 *
 *   - Writes `domain.md` and `architecture.yaml` (skipped per file
 *     when the user has hand-edited them — drift_status flips to
 *     `derived_edited`).
 *   - Mutates `harness.yaml.generation` with the latest hashes,
 *     include sources, and drift status.
 *   - Appends one `sync_completed` event to `events.log`.
 *
 * @module sync
 */
/** Optional input for {@link run}. */
export interface SyncOptions {
    force?: boolean;
    dryRun?: boolean;
    timestamp?: string;
    skipValidation?: boolean;
    schemaPath?: string | null;
    /**
     * F-137 — disable the bulk archive migration step (relocates
     * existing done feature bodies to spec.archive.yaml). Default
     * `false` means migration runs. CLI: `--no-archive-migrate`.
     * harness.yaml: `archive.auto_migrate: false`.
     */
    noArchiveMigrate?: boolean;
    /**
     * F-147 — disable the auto-archive of resolved `open_questions[]`
     * (entries with a `*_at` timestamp older than 30 days). Default
     * `false` means the cleanup runs. CLI: `--no-open-questions-archive`.
     * harness.yaml: `archive.open_questions: false`.
     */
    noOpenQuestionsArchive?: boolean;
}
/** Summary returned by {@link run}; identical shape to Python's dict. */
export interface SyncResult {
    ok: true;
    spec_hash: string;
    merkle_root: string;
    include_count: number;
    domain_skipped: boolean;
    arch_skipped: boolean;
    dry_run: boolean;
    drift_status: 'clean' | 'derived_edited';
    /** F-137 — count of features whose body was relocated (0 when skip). */
    archive_migrated?: number;
    /** F-137 — when migration was skipped, why (dirty-tree, opt-out, none-needed). */
    archive_migrate_skip_reason?: 'dirty_tree' | 'opt_out' | null;
    /** F-147 — count of resolved open_questions relocated to spec.archive.yaml. */
    open_questions_archived?: number;
    /** F-147 — when the open-questions cleanup was skipped, why. */
    open_questions_archive_skip_reason?: 'dirty_tree' | 'opt_out' | null;
}
/** Outcome of {@link tryInitialSync}; matches Python's status dict. */
export interface InitialSyncResult {
    ok: boolean;
    reason: string;
    skipped?: boolean;
}
/**
 * Returns `true` when `outputPath` exists and its bytes hash differs
 * from the previously-recorded `previousOutputHash`. The classic
 * "user edited the rendered file → don't overwrite" guard.
 *
 * False on missing file or missing prior hash (first sync).
 */
export declare function editWins(outputPath: string, previousOutputHash: string | null | undefined): boolean;
/**
 * Multi-strategy plugin version resolver — script-repo → parent-search →
 * plugin_root fallback → 'unknown'.
 */
export declare function pluginVersion(harnessDir: string): string;
/**
 * Phase 0 sync orchestrator. Returns a JSON-serialisable summary on
 * success; throws on schema violation, missing spec, or include
 * expansion failure.
 */
export declare function run(harnessDir: string, options?: SyncOptions): SyncResult;
/**
 * F-076 fail-open wrapper. Never throws — instead returns a status
 * object describing why the sync was skipped or failed.
 *
 * Decision tree (matches Python):
 *   1. spec.yaml missing → `{ok: false, reason: 'spec.yaml missing', skipped: true}`.
 *   2. harness.yaml.generation.generated_from.spec_hash already populated →
 *      `{ok: true, reason: 'already synced', skipped: true}`.
 *   3. Otherwise call run(); on success `{ok: true, reason: 'synced'}`,
 *      on any exception `{ok: false, reason: '<ClassName>: <msg>'}`.
 */
export declare function tryInitialSync(harnessDir: string): InitialSyncResult;
//# sourceMappingURL=sync.d.ts.map