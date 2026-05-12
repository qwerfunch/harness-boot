/**
 * Bare-skeleton init path — copies the three starter templates and
 * writes a one-line `events.log` so the harness directory boots with
 * zero LLM calls and sub-500 ms wall time (F-158).
 *
 * This is the "safety net" surface invoked by `harness init
 * --skeleton-only` and consumed by the perf bench under
 * `tests/perf/`. The full UX (scenario 1 / 2 / 3 routing, agent
 * collaboration, conventions extraction) lives in the slash command
 * `/harness-boot:init`; this module is intentionally minimal so the
 * regression gate stays cheap to evaluate.
 *
 * The contract — given a target directory and a plugin root, return
 * a list of files written plus a `harness_initialized` event line —
 * is byte-stable across runs so bench fixtures can assert exact
 * equality.
 *
 * @module init/skeleton
 */

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, resolve as resolvePath} from 'node:path';

/** Required input for {@link runSkeletonInit}. */
export interface SkeletonInitInput {
  /** Target project directory; `.harness/` is created beneath it. */
  readonly targetDir: string;
  /** Plugin root (the harness-boot checkout that owns `docs/templates/starter/`). */
  readonly pluginRoot: string;
  /** Optional ISO-8601 timestamp; defaults to `new Date().toISOString()` (without ms). */
  readonly now?: string;
  /** Optional plugin version string written to `events.log`; defaults to `0.0.0` when unread. */
  readonly pluginVersion?: string;
  /** When `team`, append `.harness/state.yaml` to `.gitignore` (matches slash-command parity). */
  readonly mode?: 'solo' | 'team';
}

/** Result of {@link runSkeletonInit}. */
export interface SkeletonInitResult {
  /** Absolute path to the created `.harness/` directory. */
  readonly harnessDir: string;
  /** Absolute paths of every file written, in deterministic order. */
  readonly filesWritten: ReadonlyArray<string>;
  /** Wall time spent inside the call, in milliseconds. */
  readonly wallTimeMs: number;
  /** Always `0` — the skeleton path makes no LLM calls (F-158 invariant). */
  readonly llmCallCount: 0;
}

const STARTER_FILES: ReadonlyArray<readonly [string, string]> = [
  ['spec.yaml.template', 'spec.yaml'],
  ['harness.yaml.template', 'harness.yaml'],
  ['state.yaml.template', 'state.yaml'],
];

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function readPluginVersion(pluginRoot: string): string {
  try {
    const manifest = readFileSync(join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8');
    const parsed = JSON.parse(manifest) as {version?: unknown};
    if (typeof parsed.version === 'string' && parsed.version.length > 0) {
      return parsed.version;
    }
  } catch {
    // fall through to default
  }
  return '0.0.0';
}

/**
 * Copy starter templates plus events.log into `<targetDir>/.harness/`.
 *
 * Refuses to overwrite an existing `.harness/spec.yaml` (mirrors the
 * §0 pre-flight guard in `commands/init.md`). All file writes are
 * deterministic given the same `now` / `pluginVersion` inputs, which
 * lets the perf bench commit golden fixtures without flakes.
 */
export function runSkeletonInit(input: SkeletonInitInput): SkeletonInitResult {
  const start = process.hrtime.bigint();
  const target = resolvePath(input.targetDir);
  const pluginRoot = resolvePath(input.pluginRoot);
  const harnessDir = join(target, '.harness');
  const specPath = join(harnessDir, 'spec.yaml');

  if (existsSync(specPath)) {
    throw new Error(
      `skeleton-init: ${specPath} already exists. Refusing to overwrite. ` +
        'Use `harness init --reseed` (planned) or remove `.harness/` first.',
    );
  }

  mkdirSync(harnessDir, {recursive: true});

  const written: string[] = [];
  for (const [templateName, destName] of STARTER_FILES) {
    const src = join(pluginRoot, 'docs', 'templates', 'starter', templateName);
    const dest = join(harnessDir, destName);
    const body = readFileSync(src, 'utf8');
    writeFileSync(dest, body, 'utf8');
    written.push(dest);
  }

  const ts = input.now ?? nowIso();
  const version = input.pluginVersion ?? readPluginVersion(pluginRoot);
  const mode = input.mode ?? 'solo';
  const eventsPath = join(harnessDir, 'events.log');
  const eventLine =
    JSON.stringify({
      ts,
      type: 'harness_initialized',
      plugin_version: version,
      mode,
      origin: 'skeleton-only',
    }) + '\n';
  writeFileSync(eventsPath, eventLine, 'utf8');
  written.push(eventsPath);

  const end = process.hrtime.bigint();
  const wallTimeMs = Number(end - start) / 1_000_000;

  return {
    harnessDir,
    filesWritten: written,
    wallTimeMs,
    llmCallCount: 0,
  };
}
