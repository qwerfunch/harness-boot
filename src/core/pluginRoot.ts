/**
 * Plugin root resolver — 4-strategy chain that locates the
 * harness-boot plugin source at runtime (F-087 port of
 * `scripts/core/plugin_root.py`).
 *
 * Strategy order — first hit wins:
 *
 *   A. `$PATH` scan for a `/plugins/<dir>/bin` segment whose parent
 *      directory contains a `plugin.json` with a matching `name`.
 *   B. `~/.claude/plugins/installed_plugins.json` `installPath` for
 *      the requested plugin (the path must exist on disk).
 *   C. `~/.claude/settings.json` `extraKnownMarketplaces.<mp>.source.path`
 *      combined with the matching `marketplace.json` plugin source.
 *   D. (Failure) — throw {@link PluginRootError} with the attempt
 *      trace.
 *
 * The implementation is a direct port of the Python module — every
 * decision (PATH parsing, name matching, fallback ordering, error
 * message string) is preserved verbatim so cross-runtime tooling can
 * compare logs without translation tables.
 *
 * @module pluginRoot
 */

import {existsSync, readFileSync, realpathSync, statSync} from 'node:fs';
import {homedir} from 'node:os';
import {delimiter as pathDelimiter, join, resolve as resolvePath} from 'node:path';

/**
 * Thrown by {@link resolve} when every strategy has missed.
 *
 * The `message` matches the Python implementation byte-for-byte
 * (Korean phrasing preserved) so log scrapers can match either
 * runtime's output with a single regex.
 */
export class PluginRootError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginRootError';
  }
}

/**
 * Successful resolution result plus the trace of which strategies
 * were tried in what order.
 *
 * `root` is the absolute, symlink-resolved plugin directory.
 * `strategy` is one of `'A:path-bin'`, `'B:registry'`,
 * `'C:marketplace-source'`. `attempts` is the human-readable trace —
 * each entry is one of `'A path-bin: hit'`, `'A path-bin: miss'`, …
 */
export interface Resolution {
  root: string;
  strategy: 'A:path-bin' | 'B:registry' | 'C:marketplace-source';
  attempts: string[];
}

/** Reads + parses `plugin.json` for a candidate root, or returns null. */
function loadPluginJson(root: string): Record<string, unknown> | null {
  const manifest = join(root, '.claude-plugin', 'plugin.json');
  try {
    if (!statSync(manifest).isFile()) {
      return null;
    }
    const raw = readFileSync(manifest, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Mirrors `Path.resolve()` from Python — symlinks, `..` collapsed. */
function tryRealpath(p: string): string | null {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

/** Returns true iff `p` exists and is a directory. */
function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Strategy A — `$PATH` scan.
 *
 * Looks for entries that contain `/plugins/` and end in `/bin`. The
 * parent directory of such an entry is the candidate plugin root; we
 * accept it only when its `plugin.json.name` matches the requested
 * plugin name.
 *
 * Exported under the underscore-prefixed alias for the parity test —
 * the Python module exposes the same internals.
 */
export function _strategyPathBin(pluginName: string): string | null {
  const pathEnv = process.env.PATH ?? '';
  for (const entry of pathEnv.split(pathDelimiter)) {
    if (!entry) {
      continue;
    }
    if (!entry.includes('/plugins/')) {
      continue;
    }
    const trimmed = entry.replace(/\/+$/, '');
    if (!trimmed.endsWith('/bin')) {
      continue;
    }
    // The plugin root is the parent of the bin directory.
    const candidate = resolvePath(entry, '..');
    const real = tryRealpath(candidate);
    if (real === null) {
      continue;
    }
    const manifest = loadPluginJson(real);
    if (manifest && manifest['name'] === pluginName) {
      return real;
    }
  }
  return null;
}

/**
 * Strategy B — `installed_plugins.json` lookup.
 *
 * Inspects the `~/.claude/plugins/installed_plugins.json` registry.
 * For each `<plugin>@<marketplace>` key prefixed with the requested
 * plugin name we read the first entry's `installPath` and return it
 * if it exists on disk.
 *
 * NEW-44 — the registry can record an `installPath` that no longer
 * exists for directory-type marketplaces; the existence check guards
 * against returning a phantom path.
 */
export function _strategyRegistry(pluginName: string): string | null {
  const registry = join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
  let parsed: unknown;
  try {
    if (!statSync(registry).isFile()) {
      return null;
    }
    parsed = JSON.parse(readFileSync(registry, 'utf-8'));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const plugins = (parsed as Record<string, unknown>)['plugins'];
  if (plugins === null || typeof plugins !== 'object' || Array.isArray(plugins)) {
    return null;
  }
  const prefix = `${pluginName}@`;
  for (const [key, entries] of Object.entries(plugins as Record<string, unknown>)) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      continue;
    }
    const head = entries[0];
    if (head === null || typeof head !== 'object' || Array.isArray(head)) {
      continue;
    }
    const installPath = (head as Record<string, unknown>)['installPath'];
    if (typeof installPath !== 'string' || installPath.length === 0) {
      continue;
    }
    const expanded = expandHome(installPath);
    if (isDirectory(expanded)) {
      return tryRealpath(expanded) ?? expanded;
    }
  }
  return null;
}

/**
 * Strategy C — directory-type marketplace fallback.
 *
 * When the registry's `installPath` does not exist (NEW-44) we walk
 * the user's `extraKnownMarketplaces`, pick the directory-type ones,
 * read each marketplace's `marketplace.json`, and combine the
 * marketplace path with the plugin's relative `source` field.
 */
export function _strategyMarketplaceSource(pluginName: string): string | null {
  const settings = join(homedir(), '.claude', 'settings.json');
  let parsed: unknown;
  try {
    if (!statSync(settings).isFile()) {
      return null;
    }
    parsed = JSON.parse(readFileSync(settings, 'utf-8'));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const marketplaces = (parsed as Record<string, unknown>)['extraKnownMarketplaces'];
  if (
    marketplaces === null ||
    typeof marketplaces !== 'object' ||
    Array.isArray(marketplaces)
  ) {
    return null;
  }
  for (const mpDef of Object.values(marketplaces as Record<string, unknown>)) {
    if (mpDef === null || typeof mpDef !== 'object' || Array.isArray(mpDef)) {
      continue;
    }
    const src = (mpDef as Record<string, unknown>)['source'];
    if (src === null || typeof src !== 'object' || Array.isArray(src)) {
      continue;
    }
    if ((src as Record<string, unknown>)['source'] !== 'directory') {
      continue;
    }
    const pathStr = (src as Record<string, unknown>)['path'];
    if (typeof pathStr !== 'string' || pathStr.length === 0) {
      continue;
    }
    const mpRoot = expandHome(pathStr);
    if (!isDirectory(mpRoot)) {
      continue;
    }
    const mpManifestPath = join(mpRoot, '.claude-plugin', 'marketplace.json');
    let mpData: unknown;
    try {
      if (!statSync(mpManifestPath).isFile()) {
        continue;
      }
      mpData = JSON.parse(readFileSync(mpManifestPath, 'utf-8'));
    } catch {
      continue;
    }
    if (mpData === null || typeof mpData !== 'object' || Array.isArray(mpData)) {
      continue;
    }
    const pluginEntries = (mpData as Record<string, unknown>)['plugins'];
    if (!Array.isArray(pluginEntries)) {
      continue;
    }
    for (const entry of pluginEntries) {
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
        continue;
      }
      if ((entry as Record<string, unknown>)['name'] !== pluginName) {
        continue;
      }
      const pluginSrc = (entry as Record<string, unknown>)['source'] ?? './';
      if (typeof pluginSrc !== 'string') {
        // Remote sources (objects) — out of scope for directory-type fallback.
        continue;
      }
      const candidate = resolvePath(mpRoot, pluginSrc);
      if (isDirectory(candidate)) {
        return tryRealpath(candidate) ?? candidate;
      }
    }
  }
  return null;
}

/**
 * Expands a leading `~` or `~/` to the current user's home directory.
 *
 * Mirrors Python's `os.path.expanduser` for the common cases — only
 * leading `~` is expanded, embedded `~` characters remain literal.
 */
function expandHome(p: string): string {
  if (p === '~') {
    return homedir();
  }
  if (p.startsWith('~/')) {
    return join(homedir(), p.slice(2));
  }
  return p;
}

/**
 * Runs the 4-strategy chain and returns the first hit.
 *
 * @param pluginName - Plugin manifest name to match (default
 *   `'harness'`, matching the Python source).
 * @returns Successful {@link Resolution}.
 * @throws {@link PluginRootError} when every strategy has missed.
 */
export function resolve(pluginName: string = 'harness'): Resolution {
  const attempts: string[] = [];

  let root = _strategyPathBin(pluginName);
  attempts.push(`A path-bin: ${root ? 'hit' : 'miss'}`);
  if (root) {
    return {root, strategy: 'A:path-bin', attempts};
  }

  root = _strategyRegistry(pluginName);
  attempts.push(`B registry: ${root ? 'hit' : 'miss'}`);
  if (root) {
    return {root, strategy: 'B:registry', attempts};
  }

  root = _strategyMarketplaceSource(pluginName);
  attempts.push(`C mp-source: ${root ? 'hit' : 'miss'}`);
  if (root) {
    return {root, strategy: 'C:marketplace-source', attempts};
  }

  throw new PluginRootError(
    `플러그인 '${pluginName}' 루트 해석 실패 — attempts: ${attempts.join(', ')}`,
  );
}

/** Predicate convenience — returns true when {@link resolve} would succeed. */
export function isResolvable(pluginName: string = 'harness'): boolean {
  try {
    resolve(pluginName);
    return true;
  } catch (err) {
    if (err instanceof PluginRootError) {
      return false;
    }
    throw err;
  }
}

/**
 * Re-exported for tests that need to verify the existsSync semantics
 * Python's `Path.is_dir()` uses without re-importing node:fs.
 */
export const _internals = {
  loadPluginJson,
  expandHome,
  isDirectory,
  existsSync,
};
