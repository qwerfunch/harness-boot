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
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative as relativePath, resolve as resolvePath, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import { spawnSync } from 'node:child_process';
import { canonicalHash, merkleRoot, subtreeHashes } from './core/canonicalHash.js';
import { PluginRootError, resolve as resolvePluginRoot, } from './core/pluginRoot.js';
import { autoArchiveOpenQuestions, bulkMigrate } from './spec/archive.js';
import { expand as expandIncludes, findIncludes, } from './spec/includeExpander.js';
import { SpecValidationError, validate as validateSpec, } from './spec/validate.js';
import { render as renderArchitecture } from './render/architecture.js';
import { render as renderDomain } from './render/domain.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function nowIso() {
    const d = new Date();
    const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
    const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const dd = d.getUTCDate().toString().padStart(2, '0');
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mi = d.getUTCMinutes().toString().padStart(2, '0');
    const ss = d.getUTCSeconds().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}
function isFile(path) {
    try {
        return statSync(path).isFile();
    }
    catch {
        return false;
    }
}
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** SHA-256 of file bytes, hex digest — used for edit-wins detection. */
function fileSha256(path) {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
}
/** SHA-256 of a UTF-8 string. */
function stringSha256(text) {
    return createHash('sha256').update(text, 'utf-8').digest('hex');
}
function loadYamlFile(path) {
    if (!isFile(path)) {
        return {};
    }
    const parsed = yamlParse(readFileSync(path, 'utf-8'));
    return isPlainObject(parsed) ? parsed : {};
}
function dumpYamlFile(path, data) {
    mkdirSync(dirname(path), { recursive: true });
    const out = yamlStringify(data, {
        sortMapEntries: false,
        indentSeq: false,
        lineWidth: 0,
    });
    writeFileSync(path, out, 'utf-8');
}
function appendEvent(eventsLog, event) {
    mkdirSync(dirname(eventsLog), { recursive: true });
    appendFileSync(eventsLog, `${pythonStyleJsonStringify(event)}\n`, 'utf-8');
}
/**
 * Mirrors Python's `json.dumps(obj, ensure_ascii=False)` output —
 * `(', ', ': ')` separators with no compact form. Required for
 * cross-runtime byte-for-byte parity on event log lines.
 */
function pythonStyleJsonStringify(value) {
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new TypeError(`sync: non-finite number cannot be serialized (${String(value)}).`);
        }
        return JSON.stringify(value);
    }
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => pythonStyleJsonStringify(v)).join(', ')}]`;
    }
    if (typeof value === 'object') {
        const pairs = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${pythonStyleJsonStringify(v)}`);
        return `{${pairs.join(', ')}}`;
    }
    throw new TypeError(`sync: unsupported value type ${typeof value}.`);
}
/**
 * Returns `true` when `outputPath` exists and its bytes hash differs
 * from the previously-recorded `previousOutputHash`. The classic
 * "user edited the rendered file → don't overwrite" guard.
 *
 * False on missing file or missing prior hash (first sync).
 */
export function editWins(outputPath, previousOutputHash) {
    if (!isFile(outputPath)) {
        return false;
    }
    if (!previousOutputHash) {
        return false;
    }
    return fileSha256(outputPath) !== previousOutputHash;
}
/**
 * Reads the version from the script-repo's plugin.json (Strategy 0).
 * Walks four directories up from the compiled file location to land
 * on the package root.
 */
function scriptRepoVersion() {
    const repo = resolvePath(__dirname, '..');
    const manifest = join(repo, '.claude-plugin', 'plugin.json');
    if (!isFile(manifest)) {
        return null;
    }
    try {
        const parsed = JSON.parse(readFileSync(manifest, 'utf-8'));
        if (isPlainObject(parsed) && typeof parsed['version'] === 'string') {
            return parsed['version'];
        }
    }
    catch {
        return null;
    }
    return null;
}
/**
 * Multi-strategy plugin version resolver — script-repo → parent-search →
 * plugin_root fallback → 'unknown'.
 */
export function pluginVersion(harnessDir) {
    const v = scriptRepoVersion();
    if (v) {
        return v;
    }
    // Parent-walk search.
    const candidates = [resolvePath(harnessDir, '..'), process.cwd()];
    let cur = process.cwd();
    while (true) {
        const next = resolvePath(cur, '..');
        if (next === cur) {
            break;
        }
        candidates.push(next);
        cur = next;
    }
    for (const parent of candidates) {
        const manifest = join(parent, '.claude-plugin', 'plugin.json');
        if (!isFile(manifest)) {
            continue;
        }
        try {
            const parsed = JSON.parse(readFileSync(manifest, 'utf-8'));
            if (isPlainObject(parsed) && typeof parsed['version'] === 'string') {
                return parsed['version'];
            }
        }
        catch {
            continue;
        }
    }
    // plugin_root fallback (4-strategy chain).
    try {
        const root = resolvePluginRoot().root;
        const manifest = join(root, '.claude-plugin', 'plugin.json');
        if (isFile(manifest)) {
            const parsed = JSON.parse(readFileSync(manifest, 'utf-8'));
            if (isPlainObject(parsed) && typeof parsed['version'] === 'string') {
                return parsed['version'];
            }
        }
    }
    catch (err) {
        if (!(err instanceof PluginRootError) && !err.code) {
            throw err;
        }
    }
    return 'unknown';
}
function defaultHarnessYaml() {
    return {
        version: '2.3',
        hash_protocol_version: '1',
        generation: {
            generated_from: { spec_hash: '', subtrees: {} },
            derived_from: {
                domain_md: { source_hash: '', output_hash: '', user_edit_detected: false },
                architecture_yaml: {
                    source_hash: '',
                    output_hash: '',
                    user_edit_detected: false,
                },
            },
            include_sources: [],
            drift_status: 'clean',
        },
        policies: { prose_polish: false },
    };
}
/**
 * Phase 0 sync orchestrator. Returns a JSON-serialisable summary on
 * success; throws on schema violation, missing spec, or include
 * expansion failure.
 */
export function run(harnessDir, options = {}) {
    const ts = options.timestamp ?? nowIso();
    const dryRun = options.dryRun ?? false;
    const force = options.force ?? false;
    const skipValidation = options.skipValidation ?? false;
    const specPath = join(harnessDir, 'spec.yaml');
    const harnessYamlPath = join(harnessDir, 'harness.yaml');
    const domainPath = join(harnessDir, 'domain.md');
    const archPath = join(harnessDir, 'architecture.yaml');
    const eventsLog = join(harnessDir, 'events.log');
    const chaptersDir = join(harnessDir, 'chapters');
    if (!isFile(specPath)) {
        throw new Error(`${specPath} 가 없음 — 먼저 /harness:init 또는 수동 생성 필요`);
    }
    let harnessYaml;
    if (isFile(harnessYamlPath)) {
        harnessYaml = loadYamlFile(harnessYamlPath);
        if (!isPlainObject(harnessYaml.generation)) {
            harnessYaml.generation = defaultHarnessYaml().generation;
        }
    }
    else {
        harnessYaml = defaultHarnessYaml();
    }
    // 1. Load + validate.
    const rawSpec = loadYamlFile(specPath);
    if (!skipValidation) {
        try {
            validateSpec(rawSpec, options.schemaPath ?? null);
        }
        catch (err) {
            if (err instanceof SpecValidationError && !dryRun) {
                appendEvent(eventsLog, {
                    ts,
                    type: 'sync_failed',
                    reason: 'schema_validation',
                    path: err.path.length > 0 ? err.path.map(String).join('.') : '(root)',
                    message: err.message,
                    validator: err.reason,
                });
            }
            throw err;
        }
    }
    // 2. Expand $include.
    const includesFound = findIncludes(rawSpec);
    const expandedSpec = includesFound.length > 0 ? expandIncludes(rawSpec, chaptersDir) : rawSpec;
    // 3. Hashes — raw + expanded + subtrees + Merkle.
    const hashRaw = canonicalHash(rawSpec);
    const hashExpanded = includesFound.length > 0 ? canonicalHash(expandedSpec) : hashRaw;
    const subtrees = subtreeHashes(expandedSpec);
    const merkle = merkleRoot(subtrees);
    // 4. Render with edit-wins guard.
    const generation = harnessYaml.generation ?? defaultHarnessYaml().generation;
    harnessYaml.generation = generation;
    const derived = generation.derived_from;
    const dEntry = derived.domain_md;
    const aEntry = derived.architecture_yaml;
    let domainSkipped = false;
    let archSkipped = false;
    // domain.md
    if (editWins(domainPath, dEntry.output_hash) && !force) {
        domainSkipped = true;
        dEntry.user_edit_detected = true;
    }
    else {
        const rendered = renderDomain(expandedSpec, { timestamp: ts });
        if (!dryRun) {
            mkdirSync(dirname(domainPath), { recursive: true });
            writeFileSync(domainPath, rendered, 'utf-8');
        }
        dEntry.source_hash = hashExpanded;
        dEntry.output_hash = stringSha256(rendered);
        dEntry.user_edit_detected = false;
    }
    // architecture.yaml
    if (editWins(archPath, aEntry.output_hash) && !force) {
        archSkipped = true;
        aEntry.user_edit_detected = true;
    }
    else {
        const rendered = renderArchitecture(expandedSpec, {
            timestamp: ts,
            sourceRef: 'spec.yaml',
        });
        if (!dryRun) {
            writeFileSync(archPath, rendered, 'utf-8');
        }
        aEntry.source_hash = hashExpanded;
        aEntry.output_hash = stringSha256(rendered);
        aEntry.user_edit_detected = false;
    }
    // 5. harness.yaml mutation.
    generation.generated_from = {
        spec_hash: hashRaw,
        spec_hash_expanded: includesFound.length > 0 ? hashExpanded : null,
        merkle_root: merkle,
        subtrees,
    };
    generation.include_sources = includesFound.map((item) => item.target);
    const drift = [];
    if (domainSkipped) {
        drift.push('domain.md');
    }
    if (archSkipped) {
        drift.push('architecture.yaml');
    }
    generation.drift_status = drift.length > 0 ? 'derived_edited' : 'clean';
    if (!dryRun) {
        dumpYamlFile(harnessYamlPath, harnessYaml);
    }
    // 6. events.log
    const event = {
        ts,
        type: 'sync_completed',
        plugin_version: pluginVersion(harnessDir),
        phase: '0',
        spec_hash: hashRaw,
        merkle_root: merkle,
        derived: [
            ...(!domainSkipped ? ['domain.md'] : []),
            ...(!archSkipped ? ['architecture.yaml'] : []),
        ],
        skipped: drift,
        dry_run: dryRun,
    };
    if (!dryRun) {
        appendEvent(eventsLog, event);
    }
    // 7. F-137 — bulk archive migration. Relocates existing done feature
    // bodies from spec.yaml to spec.archive.yaml. Skipped on dry-run, on
    // explicit opt-out (CLI flag or harness.yaml config), or on a dirty
    // working tree (avoids interleaving with the user's in-flight edits).
    let archiveMigrated = 0;
    let archiveSkipReason = null;
    if (dryRun) {
        archiveSkipReason = null; // dry-run leaves the field absent in the result.
    }
    else if (options.noArchiveMigrate || harnessYaml.archive?.auto_migrate === false) {
        archiveSkipReason = 'opt_out';
    }
    else {
        const projectRoot = resolvePath(harnessDir, '..');
        // F-164 — exclude the derived outputs sync just wrote this invocation
        // from the dirty-tree check. Without the whitelist, render's
        // timestamp updates to domain.md / harness.yaml mark them dirty and
        // step 7 refuses to archive against files step 4 just produced.
        // Real user edits anywhere else still block archive.
        const renderedPaths = renderedPathsForDirtyCheck(harnessDir, {
            domainSkipped,
            archSkipped,
        });
        if (workingTreeDirty(projectRoot, renderedPaths)) {
            archiveSkipReason = 'dirty_tree';
            process.stderr.write('[warn] sync: skipping bulk archive migration — working tree is dirty. ' +
                'Commit or stash, then re-run sync.\n');
        }
        else {
            try {
                archiveMigrated = bulkMigrate(harnessDir);
                if (archiveMigrated > 0) {
                    appendEvent(eventsLog, {
                        ts,
                        type: 'bulk_archive_migrated',
                        count: archiveMigrated,
                    });
                    process.stderr.write(`[info] sync: auto-archived ${archiveMigrated} done feature bod${archiveMigrated === 1 ? 'y' : 'ies'} → .harness/spec.archive.yaml — review with git diff\n`);
                }
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                process.stderr.write(`[warn] sync: bulk archive migration failed — ${msg}\n`);
            }
        }
    }
    // 8. F-147 — auto-archive of resolved open_questions. Same skip
    // conditions as the bulk archive migration: dry-run, opt-out, dirty
    // tree. Idempotent and silent when nothing is eligible (no event,
    // no stderr line). The dirty-tree warning was already emitted by the
    // bulk-archive step; do not echo it.
    let openQuestionsArchived = 0;
    let openQuestionsSkipReason = null;
    if (dryRun) {
        openQuestionsSkipReason = null;
    }
    else if (options.noOpenQuestionsArchive ||
        harnessYaml.archive?.open_questions === false) {
        openQuestionsSkipReason = 'opt_out';
    }
    else if (archiveSkipReason === 'dirty_tree') {
        // Dirty-tree warning already shown by the bulk-archive step.
        openQuestionsSkipReason = 'dirty_tree';
    }
    else {
        try {
            openQuestionsArchived = autoArchiveOpenQuestions(harnessDir);
            if (openQuestionsArchived > 0) {
                appendEvent(eventsLog, {
                    ts,
                    type: 'auto_archived_open_questions',
                    count: openQuestionsArchived,
                });
                process.stderr.write(`[info] sync: auto-archived ${openQuestionsArchived} resolved open_question${openQuestionsArchived === 1 ? '' : 's'} (30+ days) → .harness/spec.archive.yaml\n`);
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[warn] sync: open_questions auto-archive failed — ${msg}\n`);
        }
    }
    return {
        ok: true,
        spec_hash: hashRaw,
        merkle_root: merkle,
        include_count: includesFound.length,
        domain_skipped: domainSkipped,
        arch_skipped: archSkipped,
        dry_run: dryRun,
        drift_status: generation.drift_status,
        archive_migrated: archiveMigrated,
        archive_migrate_skip_reason: archiveSkipReason,
        open_questions_archived: openQuestionsArchived,
        open_questions_archive_skip_reason: openQuestionsSkipReason,
    };
}
/**
 * Returns true when `git status --porcelain` reports any untracked or
 * modified files, after excluding paths in `ignorePaths`.
 *
 * The `ignorePaths` set carries repo-relative paths that the caller
 * just wrote during this invocation — so render's timestamp updates to
 * derived outputs do not falsely block the bulk archive step (F-164).
 * An empty/omitted set preserves the original behavior. Paths use
 * forward slashes (git's porcelain format) on all platforms.
 */
function workingTreeDirty(projectRoot, ignorePaths = new Set()) {
    try {
        const result = spawnSync('git', ['status', '--porcelain'], {
            cwd: projectRoot,
            stdio: ['ignore', 'pipe', 'ignore'],
            encoding: 'utf-8',
        });
        if (result.status !== 0) {
            return false; // not a git repo, or git missing — treat as clean (safe default).
        }
        const lines = result.stdout.split('\n').filter((l) => l.length > 0);
        for (const line of lines) {
            const path = parsePorcelainPath(line);
            if (path !== null && ignorePaths.has(path)) {
                continue;
            }
            return true;
        }
        return false;
    }
    catch {
        return false;
    }
}
/**
 * Extracts the path portion from a `git status --porcelain=v1` line.
 * Format: `XY path` where `XY` is a two-character status code and the
 * path begins at column 3. Renames (`R `) carry an ` -> ` arrow; we
 * return the post-arrow destination so the whitelist matches against
 * the file's current name.
 */
function parsePorcelainPath(line) {
    if (line.length < 4) {
        return null;
    }
    const rest = line.slice(3);
    const arrow = rest.indexOf(' -> ');
    if (arrow >= 0) {
        return rest.slice(arrow + 4);
    }
    return rest;
}
/**
 * Builds the F-164 whitelist of repo-relative paths that sync just
 * rendered. `harness.yaml` and `events.log` are always written when
 * not dry-run; the two derived outputs are only included when render
 * actually wrote them this invocation (the edit-wins guard may have
 * skipped one or both).
 */
function renderedPathsForDirtyCheck(harnessDir, flags) {
    const projectRoot = resolvePath(harnessDir, '..');
    const out = new Set();
    const add = (abs) => {
        const rel = relativePath(projectRoot, abs).split(sep).join('/');
        if (rel.length > 0 && !rel.startsWith('..')) {
            out.add(rel);
        }
    };
    add(join(harnessDir, 'harness.yaml'));
    add(join(harnessDir, 'events.log'));
    if (!flags.domainSkipped) {
        add(join(harnessDir, 'domain.md'));
    }
    if (!flags.archSkipped) {
        add(join(harnessDir, 'architecture.yaml'));
    }
    return out;
}
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
export function tryInitialSync(harnessDir) {
    const specPath = join(harnessDir, 'spec.yaml');
    if (!isFile(specPath)) {
        return { ok: false, reason: 'spec.yaml missing', skipped: true };
    }
    try {
        const harnessYamlPath = join(harnessDir, 'harness.yaml');
        if (isFile(harnessYamlPath)) {
            const cfg = loadYamlFile(harnessYamlPath);
            const gen = isPlainObject(cfg['generation']) ? cfg['generation'] : {};
            const generated = isPlainObject(gen['generated_from']) ? gen['generated_from'] : {};
            const specHash = generated['spec_hash'];
            if (typeof specHash === 'string' && specHash.length > 0) {
                return { ok: true, reason: 'already synced', skipped: true };
            }
        }
        run(harnessDir);
        return { ok: true, reason: 'synced' };
    }
    catch (err) {
        const cls = err.constructor?.name ?? 'Error';
        const msg = err.message ?? String(err);
        return { ok: false, reason: `${cls}: ${msg}` };
    }
}
//# sourceMappingURL=sync.js.map