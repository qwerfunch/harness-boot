/**
 * `$include` expansion engine — depth-1 with locked-field guard
 * (F-090 port of `scripts/spec/include_expander.py`, F-009 in spec).
 *
 * Spec extract:
 *
 *     project:
 *       description:
 *         $include: "chapters/project-description.md"
 *
 *     ↓ expand
 *
 *     project:
 *       description: "<chapters/project-description.md text>"
 *
 * Rules:
 *
 *   1. `$include` is detected only on a single-key mapping
 *      (`{$include: "..."}`). Any other key in the same map disables
 *      detection.
 *   2. Value must be a relative path inside the chapters directory.
 *      Absolute paths and `..` escapes are rejected.
 *   3. Depth-1 enforcement — included content is treated as a literal
 *      string. Nested `$include` strings inside a chapter file remain
 *      verbatim text.
 *   4. Locked fields ({@link LOCKED_FIELD_NAMES}) reject `$include`
 *      so identifier-bearing nodes cannot be hot-swapped.
 *   5. Missing files / read errors fail fast.
 *
 * @module spec/includeExpander
 */

import {readFileSync, statSync} from 'node:fs';
import {isAbsolute, join, relative, resolve as resolvePath} from 'node:path';

/**
 * Field names whose immediate value MUST not be a `$include` node.
 *
 * Identifiers must be inline in the spec — substituting them via an
 * include opens manipulation of the canonical hash and the audit
 * trail without leaving a textual trace in the file the user
 * reviews.
 */
export const LOCKED_FIELD_NAMES: ReadonlySet<string> = new Set<string>([
  'id',
  'version',
  'name',
  'type',
  'status',
  'priority',
  'schema_version',
]);

/** Thrown when $include expansion runs into a violation. */
export class IncludeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IncludeError';
  }
}

/** One discovered `$include` node — its tree path, target, and parent key. */
export interface IncludeFinding {
  path: ReadonlyArray<string | number>;
  target: string;
  parentKey: string | null;
}

/** Returns true when a value is the `{$include: "..."}` single-key shape. */
function isIncludeNode(value: unknown): value is {$include: string} {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  return keys.length === 1 && keys[0] === '$include' && typeof obj['$include'] === 'string';
}

/**
 * Walks a tree and collects every `$include` node it sees.
 *
 * Once the function descends into an include node it stops — the
 * value is a path string, not further traversable.
 */
export function findIncludes(obj: unknown): IncludeFinding[] {
  const out: IncludeFinding[] = [];
  walk(obj, [], null, out);
  return out;
}

function walk(
  obj: unknown,
  path: ReadonlyArray<string | number>,
  parentKey: string | null,
  out: IncludeFinding[],
): void {
  if (isIncludeNode(obj)) {
    out.push({path, target: obj.$include, parentKey});
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((child, i) => walk(child, [...path, i], parentKey, out));
    return;
  }
  if (obj !== null && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      walk(v, [...path, k], k, out);
    }
  }
}

/**
 * Reads a chapter file by relative path, with traversal-escape and
 * existence guards.
 *
 * @param chaptersDir - Base directory; the resolved target must be
 *   inside this path.
 * @param rel - Relative path provided by the spec author.
 * @throws {@link IncludeError} on absolute paths, escapes, missing
 *   files, or read failures.
 */
function readChapter(chaptersDir: string, rel: string): string {
  if (isAbsolute(rel)) {
    throw new IncludeError(`$include 값은 절대 경로일 수 없음: ${rel}`);
  }
  let chaptersAbs: string;
  try {
    chaptersAbs = resolvePath(chaptersDir);
  } catch {
    chaptersAbs = chaptersDir;
  }
  const target = resolvePath(chaptersAbs, rel);
  const relativeFromBase = relative(chaptersAbs, target);
  if (
    relativeFromBase === '' ||
    relativeFromBase.startsWith('..') ||
    isAbsolute(relativeFromBase)
  ) {
    throw new IncludeError(
      `$include 경로가 chapters 디렉터리를 벗어남: ${rel} → ${target}`,
    );
  }
  let isFile: boolean;
  try {
    isFile = statSync(target).isFile();
  } catch {
    throw new IncludeError(`$include 대상 파일 없음: ${target}`);
  }
  if (!isFile) {
    throw new IncludeError(`$include 대상 파일 없음: ${target}`);
  }
  try {
    return readFileSync(target, 'utf-8');
  } catch (err) {
    throw new IncludeError(`$include 파일 읽기 실패 (${target}): ${(err as Error).message}`);
  }
}

/**
 * Returns a deep copy of `obj` with the value at each `path` replaced
 * by the matching `replacement` string. Original tree is not mutated.
 */
function applyReplacements(
  obj: unknown,
  replacements: ReadonlyMap<string, string>,
): unknown {
  function inner(sub: unknown, currentPath: ReadonlyArray<string | number>): unknown {
    const key = pathKey(currentPath);
    if (replacements.has(key)) {
      return replacements.get(key);
    }
    if (Array.isArray(sub)) {
      return sub.map((child, i) => inner(child, [...currentPath, i]));
    }
    if (sub !== null && typeof sub === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(sub as Record<string, unknown>)) {
        out[k] = inner(v, [...currentPath, k]);
      }
      return out;
    }
    return sub;
  }
  return inner(obj, []);
}

function pathKey(path: ReadonlyArray<string | number>): string {
  return path.map((p) => (typeof p === 'number' ? `#${p}` : `.${p}`)).join('');
}

/** Optional input for {@link expand}. */
export interface ExpandOptions {
  strictLockedFields?: boolean;
}

/**
 * Expands every `$include` in a parsed spec object (depth-1).
 *
 * @param spec - Parsed `spec.yaml` mapping.
 * @param chaptersDir - Base directory used for `$include` lookups.
 * @returns A new spec object with includes inlined; the original is
 *   not mutated. When the spec contains no includes, the same object
 *   is returned unchanged.
 * @throws {@link IncludeError} on locked-field violation, traversal
 *   escape, missing target, or read failure.
 */
export function expand(
  spec: Record<string, unknown>,
  chaptersDir: string,
  options: ExpandOptions = {},
): Record<string, unknown> {
  const strictLockedFields = options.strictLockedFields ?? true;
  const includes = findIncludes(spec);
  if (includes.length === 0) {
    return spec;
  }
  const replacements = new Map<string, string>();
  for (const item of includes) {
    if (
      strictLockedFields &&
      item.parentKey !== null &&
      LOCKED_FIELD_NAMES.has(item.parentKey)
    ) {
      throw new IncludeError(
        `🔒 필드 \`${item.parentKey}\` 에는 $include 를 사용할 수 없음 ` +
          `(경로: ${item.path.join('.')}, target: ${item.target})`,
      );
    }
    const content = readChapter(chaptersDir, item.target);
    replacements.set(pathKey(item.path), content);
  }
  return applyReplacements(spec, replacements) as Record<string, unknown>;
}

/**
 * Picks the chapters directory for a given spec file path.
 *
 * Priority:
 *   1. Explicit override.
 *   2. `<spec-parent>/.harness/chapters/` if it exists.
 *   3. `<spec-parent>/chapters/` if it exists.
 *   4. The first candidate as a default — even when missing — so the
 *      error surfaces as "$include 대상 파일 없음" rather than a
 *      generic ENOENT on the directory itself.
 */
export function resolveChaptersDir(specPath: string, explicit: string | null = null): string {
  if (explicit !== null) {
    return explicit;
  }
  const base = resolvePath(specPath, '..');
  const candidate1 = join(base, '.harness', 'chapters');
  try {
    if (statSync(candidate1).isDirectory()) {
      return candidate1;
    }
  } catch {
    // fall through
  }
  const candidate2 = join(base, 'chapters');
  try {
    if (statSync(candidate2).isDirectory()) {
      return candidate2;
    }
  } catch {
    // fall through
  }
  return candidate1;
}
