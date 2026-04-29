/**
 * Top-level directory shape + entity-candidate file detection (F-101
 * port of `scripts/scan/structure.py`, F-036).
 *
 * Pure read-only walk capped at depth 3 from `root`. Skips a fixed
 * list of build / VCS / vendored dirs to keep the LLM input budget
 * bounded.
 *
 * @module scan/structure
 */

import {readdirSync, statSync} from 'node:fs';
import {join, posix as pathPosix, relative} from 'node:path';

const IGNORED_DIRS: ReadonlySet<string> = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  '__pycache__',
  '.venv',
  'venv',
  'env',
  'dist',
  'build',
  'target',
  '.harness',
  '.claude',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.idea',
  '.vscode',
]);

const ADR_CANDIDATES: ReadonlyArray<string> = [
  'docs/adr',
  'docs/decisions',
  'adr',
  'decisions',
];
const README_CANDIDATES: ReadonlyArray<string> = [
  'README.md',
  'README.rst',
  'README.txt',
  'readme.md',
];
const ENTITY_FILE_NAMES: ReadonlySet<string> = new Set(['models.py', 'schemas.py', 'entities.py']);
const ENTITY_DIR_NAMES: ReadonlySet<string> = new Set(['models', 'schemas', 'entities', 'domain']);
const MAX_ENTITY_FILES = 24;

/** Outcome of a structure scan. */
export interface StructureSummary {
  top_dirs: string[];
  adr_dir: string | null;
  entity_candidate_files: string[];
  readme_path: string | null;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isSymlink(path: string): boolean {
  try {
    return statSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

function toPosix(p: string): string {
  return p.split(/[\\/]/).filter((s) => s.length > 0).join('/');
}

/** Returns the directory shape summary for `root`. */
export function scanStructure(root: string): StructureSummary {
  if (!isDirectory(root)) {
    return {top_dirs: [], adr_dir: null, entity_candidate_files: [], readme_path: null};
  }

  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    entries = [];
  }
  const topDirs: string[] = [];
  for (const name of entries) {
    if (IGNORED_DIRS.has(name) || name.startsWith('.')) {
      continue;
    }
    if (isDirectory(join(root, name))) {
      topDirs.push(name);
    }
  }
  topDirs.sort();

  return {
    top_dirs: topDirs,
    adr_dir: findAdrDir(root),
    entity_candidate_files: findEntityCandidates(root),
    readme_path: findReadme(root),
  };
}

function findAdrDir(root: string): string | null {
  for (const candidate of ADR_CANDIDATES) {
    if (isDirectory(join(root, candidate))) {
      return candidate;
    }
  }
  return null;
}

function findReadme(root: string): string | null {
  for (const candidate of README_CANDIDATES) {
    if (isFile(join(root, candidate))) {
      return candidate;
    }
  }
  return null;
}

function findEntityCandidates(root: string): string[] {
  const found: string[] = [];
  for (const path of walk(root, 3)) {
    if (found.length >= MAX_ENTITY_FILES) {
      break;
    }
    const rel = toPosix(relative(root, path));
    if (isFile(path)) {
      const name = path.split(/[\\/]/).pop()!;
      if (ENTITY_FILE_NAMES.has(name)) {
        found.push(rel);
      } else if (name.endsWith('.ts') && name.includes('.entity.')) {
        found.push(rel);
      }
    } else if (isDirectory(path)) {
      const name = path.split(/[\\/]/).pop()!;
      if (ENTITY_DIR_NAMES.has(name)) {
        for (const child of walkAll(path)) {
          if (found.length >= MAX_ENTITY_FILES) {
            break;
          }
          if (isFile(child)) {
            const childName = child.split(/[\\/]/).pop()!;
            if (
              childName.endsWith('.py') ||
              childName.endsWith('.ts') ||
              childName.endsWith('.js')
            ) {
              found.push(toPosix(relative(root, child)));
            }
          }
        }
      }
    }
  }
  return found.slice(0, MAX_ENTITY_FILES);
}

function* walk(root: string, maxDepth: number): IterableIterator<string> {
  const stack: Array<[string, number]> = [[root, 0]];
  while (stack.length > 0) {
    const [current, depth] = stack.pop()!;
    if (depth > maxDepth) {
      continue;
    }
    let children: string[];
    try {
      children = readdirSync(current).sort();
    } catch {
      continue;
    }
    for (const name of children) {
      if (IGNORED_DIRS.has(name)) {
        continue;
      }
      const child = join(current, name);
      if (isSymlink(child)) {
        continue;
      }
      yield child;
      if (isDirectory(child)) {
        stack.push([child, depth + 1]);
      }
    }
  }
}

function* walkAll(root: string): IterableIterator<string> {
  const stack: string[] = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let children: string[];
    try {
      children = readdirSync(current).sort();
    } catch {
      continue;
    }
    for (const name of children) {
      const child = join(current, name);
      yield child;
      if (isDirectory(child)) {
        stack.push(child);
      }
    }
  }
}

// posix path utility — unused export silences linters when the test
// suite doesn't import the helper directly.
void pathPosix;
