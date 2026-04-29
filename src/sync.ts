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

import {createHash} from 'node:crypto';
import {appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve as resolvePath} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse as yamlParse, stringify as yamlStringify} from 'yaml';

import {canonicalHash, merkleRoot, subtreeHashes} from './core/canonicalHash.js';
import {
  PluginRootError,
  resolve as resolvePluginRoot,
} from './core/pluginRoot.js';
import {
  expand as expandIncludes,
  findIncludes,
  type IncludeFinding,
} from './spec/includeExpander.js';
import {
  SpecValidationError,
  validate as validateSpec,
} from './spec/validate.js';
import {render as renderArchitecture} from './render/architecture.js';
import {render as renderDomain} from './render/domain.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Optional input for {@link run}. */
export interface SyncOptions {
  force?: boolean;
  dryRun?: boolean;
  timestamp?: string;
  skipValidation?: boolean;
  schemaPath?: string | null;
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
}

/** Outcome of {@link tryInitialSync}; matches Python's status dict. */
export interface InitialSyncResult {
  ok: boolean;
  reason: string;
  skipped?: boolean;
}

function nowIso(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mi = d.getUTCMinutes().toString().padStart(2, '0');
  const ss = d.getUTCSeconds().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** SHA-256 of file bytes, hex digest — used for edit-wins detection. */
function fileSha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** SHA-256 of a UTF-8 string. */
function stringSha256(text: string): string {
  return createHash('sha256').update(text, 'utf-8').digest('hex');
}

function loadYamlFile(path: string): Record<string, unknown> {
  if (!isFile(path)) {
    return {};
  }
  const parsed: unknown = yamlParse(readFileSync(path, 'utf-8'));
  return isPlainObject(parsed) ? parsed : {};
}

function dumpYamlFile(path: string, data: Record<string, unknown>): void {
  mkdirSync(dirname(path), {recursive: true});
  const out = yamlStringify(data, {
    sortMapEntries: false,
    indentSeq: false,
    lineWidth: 0,
  });
  writeFileSync(path, out, 'utf-8');
}

function appendEvent(eventsLog: string, event: Record<string, unknown>): void {
  mkdirSync(dirname(eventsLog), {recursive: true});
  appendFileSync(eventsLog, `${pythonStyleJsonStringify(event)}\n`, 'utf-8');
}

/**
 * Mirrors Python's `json.dumps(obj, ensure_ascii=False)` output —
 * `(', ', ': ')` separators with no compact form. Required for
 * cross-runtime byte-for-byte parity on event log lines.
 */
function pythonStyleJsonStringify(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(
        `sync: non-finite number cannot be serialized (${String(value)}).`,
      );
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
    const pairs = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => `${JSON.stringify(k)}: ${pythonStyleJsonStringify(v)}`,
    );
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
export function editWins(outputPath: string, previousOutputHash: string | null | undefined): boolean {
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
function scriptRepoVersion(): string | null {
  const repo = resolvePath(__dirname, '..');
  const manifest = join(repo, '.claude-plugin', 'plugin.json');
  if (!isFile(manifest)) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf-8'));
    if (isPlainObject(parsed) && typeof parsed['version'] === 'string') {
      return parsed['version'];
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Multi-strategy plugin version resolver — script-repo → parent-search →
 * plugin_root fallback → 'unknown'.
 */
export function pluginVersion(harnessDir: string): string {
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
      const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf-8'));
      if (isPlainObject(parsed) && typeof parsed['version'] === 'string') {
        return parsed['version'];
      }
    } catch {
      continue;
    }
  }

  // plugin_root fallback (4-strategy chain).
  try {
    const root = resolvePluginRoot().root;
    const manifest = join(root, '.claude-plugin', 'plugin.json');
    if (isFile(manifest)) {
      const parsed: unknown = JSON.parse(readFileSync(manifest, 'utf-8'));
      if (isPlainObject(parsed) && typeof parsed['version'] === 'string') {
        return parsed['version'];
      }
    }
  } catch (err) {
    if (!(err instanceof PluginRootError) && !(err as NodeJS.ErrnoException).code) {
      throw err;
    }
  }

  return 'unknown';
}

interface DerivedEntry {
  source_hash: string;
  output_hash: string;
  user_edit_detected: boolean;
}

interface HarnessYamlGeneration {
  generated_from: {
    spec_hash: string;
    spec_hash_expanded?: string | null;
    merkle_root?: string;
    subtrees: Record<string, string>;
  };
  derived_from: {
    domain_md: DerivedEntry;
    architecture_yaml: DerivedEntry;
  };
  include_sources: string[];
  drift_status: 'clean' | 'derived_edited';
}

interface HarnessYaml {
  version?: string;
  hash_protocol_version?: string;
  generation?: HarnessYamlGeneration;
  policies?: Record<string, unknown>;
  [key: string]: unknown;
}

function defaultHarnessYaml(): HarnessYaml {
  return {
    version: '2.3',
    hash_protocol_version: '1',
    generation: {
      generated_from: {spec_hash: '', subtrees: {}},
      derived_from: {
        domain_md: {source_hash: '', output_hash: '', user_edit_detected: false},
        architecture_yaml: {
          source_hash: '',
          output_hash: '',
          user_edit_detected: false,
        },
      },
      include_sources: [],
      drift_status: 'clean',
    },
    policies: {prose_polish: false},
  };
}

/**
 * Phase 0 sync orchestrator. Returns a JSON-serialisable summary on
 * success; throws on schema violation, missing spec, or include
 * expansion failure.
 */
export function run(harnessDir: string, options: SyncOptions = {}): SyncResult {
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

  let harnessYaml: HarnessYaml;
  if (isFile(harnessYamlPath)) {
    harnessYaml = loadYamlFile(harnessYamlPath) as HarnessYaml;
    if (!isPlainObject(harnessYaml.generation as unknown)) {
      harnessYaml.generation = defaultHarnessYaml().generation;
    }
  } else {
    harnessYaml = defaultHarnessYaml();
  }

  // 1. Load + validate.
  const rawSpec = loadYamlFile(specPath);
  if (!skipValidation) {
    try {
      validateSpec(rawSpec, options.schemaPath ?? null);
    } catch (err) {
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
  const includesFound: IncludeFinding[] = findIncludes(rawSpec);
  const expandedSpec =
    includesFound.length > 0 ? expandIncludes(rawSpec, chaptersDir) : rawSpec;

  // 3. Hashes — raw + expanded + subtrees + Merkle.
  const hashRaw = canonicalHash(rawSpec);
  const hashExpanded =
    includesFound.length > 0 ? canonicalHash(expandedSpec) : hashRaw;
  const subtrees = subtreeHashes(expandedSpec);
  const merkle = merkleRoot(subtrees);

  // 4. Render with edit-wins guard.
  const generation =
    harnessYaml.generation ?? defaultHarnessYaml().generation!;
  harnessYaml.generation = generation;
  const derived = generation.derived_from;
  const dEntry: DerivedEntry = derived.domain_md;
  const aEntry: DerivedEntry = derived.architecture_yaml;

  let domainSkipped = false;
  let archSkipped = false;

  // domain.md
  if (editWins(domainPath, dEntry.output_hash) && !force) {
    domainSkipped = true;
    dEntry.user_edit_detected = true;
  } else {
    const rendered = renderDomain(expandedSpec, {timestamp: ts});
    if (!dryRun) {
      mkdirSync(dirname(domainPath), {recursive: true});
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
  } else {
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
  const drift: string[] = [];
  if (domainSkipped) {
    drift.push('domain.md');
  }
  if (archSkipped) {
    drift.push('architecture.yaml');
  }
  generation.drift_status = drift.length > 0 ? 'derived_edited' : 'clean';

  if (!dryRun) {
    dumpYamlFile(harnessYamlPath, harnessYaml as Record<string, unknown>);
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

  return {
    ok: true,
    spec_hash: hashRaw,
    merkle_root: merkle,
    include_count: includesFound.length,
    domain_skipped: domainSkipped,
    arch_skipped: archSkipped,
    dry_run: dryRun,
    drift_status: generation.drift_status,
  };
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
export function tryInitialSync(harnessDir: string): InitialSyncResult {
  const specPath = join(harnessDir, 'spec.yaml');
  if (!isFile(specPath)) {
    return {ok: false, reason: 'spec.yaml missing', skipped: true};
  }
  try {
    const harnessYamlPath = join(harnessDir, 'harness.yaml');
    if (isFile(harnessYamlPath)) {
      const cfg = loadYamlFile(harnessYamlPath);
      const gen = isPlainObject(cfg['generation']) ? (cfg['generation'] as Record<string, unknown>) : {};
      const generated =
        isPlainObject(gen['generated_from']) ? (gen['generated_from'] as Record<string, unknown>) : {};
      const specHash = generated['spec_hash'];
      if (typeof specHash === 'string' && specHash.length > 0) {
        return {ok: true, reason: 'already synced', skipped: true};
      }
    }
    run(harnessDir);
    return {ok: true, reason: 'synced'};
  } catch (err) {
    const cls = (err as Error).constructor?.name ?? 'Error';
    const msg = (err as Error).message ?? String(err);
    return {ok: false, reason: `${cls}: ${msg}`};
  }
}
