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
import { existsSync } from 'node:fs';
/**
 * Thrown by {@link resolve} when every strategy has missed.
 *
 * The `message` matches the Python implementation byte-for-byte
 * (Korean phrasing preserved) so log scrapers can match either
 * runtime's output with a single regex.
 */
export declare class PluginRootError extends Error {
    constructor(message: string);
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
declare function loadPluginJson(root: string): Record<string, unknown> | null;
/** Returns true iff `p` exists and is a directory. */
declare function isDirectory(p: string): boolean;
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
export declare function _strategyPathBin(pluginName: string): string | null;
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
export declare function _strategyRegistry(pluginName: string): string | null;
/**
 * Strategy C — directory-type marketplace fallback.
 *
 * When the registry's `installPath` does not exist (NEW-44) we walk
 * the user's `extraKnownMarketplaces`, pick the directory-type ones,
 * read each marketplace's `marketplace.json`, and combine the
 * marketplace path with the plugin's relative `source` field.
 */
export declare function _strategyMarketplaceSource(pluginName: string): string | null;
/**
 * Expands a leading `~` or `~/` to the current user's home directory.
 *
 * Mirrors Python's `os.path.expanduser` for the common cases — only
 * leading `~` is expanded, embedded `~` characters remain literal.
 */
declare function expandHome(p: string): string;
/**
 * Runs the 4-strategy chain and returns the first hit.
 *
 * @param pluginName - Plugin manifest name to match (default
 *   `'harness'`, matching the Python source).
 * @returns Successful {@link Resolution}.
 * @throws {@link PluginRootError} when every strategy has missed.
 */
export declare function resolve(pluginName?: string): Resolution;
/** Predicate convenience — returns true when {@link resolve} would succeed. */
export declare function isResolvable(pluginName?: string): boolean;
/**
 * Re-exported for tests that need to verify the existsSync semantics
 * Python's `Path.is_dir()` uses without re-importing node:fs.
 */
export declare const _internals: {
    loadPluginJson: typeof loadPluginJson;
    expandHome: typeof expandHome;
    isDirectory: typeof isDirectory;
    existsSync: typeof existsSync;
};
export {};
//# sourceMappingURL=pluginRoot.d.ts.map