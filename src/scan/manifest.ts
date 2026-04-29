/**
 * Tech-stack + project-name extraction across language manifests
 * (F-101 port of `scripts/scan/manifest.py`, F-036).
 *
 * Detection priority — first match wins:
 *
 *   package.json → pyproject.toml → Cargo.toml → go.mod
 *
 * Pure: only reads the four listed manifest files. TOML parsing uses
 * smol-toml (already a runtime dep) so pyproject / Cargo manifests
 * are first-class.
 *
 * @module scan/manifest
 */

import {readFileSync, statSync} from 'node:fs';
import {basename, join} from 'node:path';
import {parse as tomlParse} from 'smol-toml';

const NODE_TEST_PRIORITY: ReadonlyArray<string> = ['vitest', 'jest', 'mocha', 'ava', 'node:test'];

/** Output shape of {@link extractTechStack}; keys are optional per Python parity. */
export interface TechStack {
  runtime?: string;
  language?: string;
  test?: string;
  build?: string;
  min_version?: string;
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

/** Returns the tech_stack dict for the most prominent manifest. */
export function extractTechStack(root: string): TechStack {
  if (isFile(join(root, 'package.json'))) {
    return detectNode(root);
  }
  if (isFile(join(root, 'pyproject.toml'))) {
    return detectPython(root);
  }
  if (isFile(join(root, 'Cargo.toml'))) {
    return detectRust(root);
  }
  if (isFile(join(root, 'go.mod'))) {
    return detectGo(root);
  }
  return {};
}

/** Returns the declared project name, falling back to the directory basename. */
export function extractProjectName(root: string): string | null {
  try {
    statSync(root);
  } catch {
    return null;
  }

  const pkgPath = join(root, 'package.json');
  if (isFile(pkgPath)) {
    try {
      const data: unknown = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (isPlainObject(data) && typeof data['name'] === 'string' && data['name']) {
        return data['name'];
      }
    } catch {
      // ignore
    }
  }

  const pyproj = join(root, 'pyproject.toml');
  if (isFile(pyproj)) {
    try {
      const data = tomlParse(readFileSync(pyproj, 'utf-8'));
      const project = isPlainObject(data['project']) ? (data['project'] as Record<string, unknown>) : {};
      if (typeof project['name'] === 'string' && project['name']) {
        return project['name'];
      }
    } catch {
      // ignore
    }
  }

  const cargo = join(root, 'Cargo.toml');
  if (isFile(cargo)) {
    try {
      const data = tomlParse(readFileSync(cargo, 'utf-8'));
      const pkg = isPlainObject(data['package']) ? (data['package'] as Record<string, unknown>) : {};
      if (typeof pkg['name'] === 'string' && pkg['name']) {
        return pkg['name'];
      }
    } catch {
      // ignore
    }
  }

  const gomod = join(root, 'go.mod');
  if (isFile(gomod)) {
    try {
      const text = readFileSync(gomod, 'utf-8');
      const match = /^module\s+(\S+)/m.exec(text);
      if (match !== null) {
        return match[1]!.split('/').pop() ?? basename(root);
      }
    } catch {
      // ignore
    }
  }

  return basename(root);
}

function detectNode(root: string): TechStack {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
  } catch {
    return {};
  }
  if (!isPlainObject(data)) {
    return {};
  }

  const dependencies = isPlainObject(data['dependencies']) ? (data['dependencies'] as Record<string, unknown>) : {};
  const devDependencies = isPlainObject(data['devDependencies']) ? (data['devDependencies'] as Record<string, unknown>) : {};
  const deps: Record<string, unknown> = {...dependencies, ...devDependencies};

  const hasTypescript = 'typescript' in deps || isFile(join(root, 'tsconfig.json'));
  const language = hasTypescript ? 'typescript' : 'javascript';

  const testRunner = NODE_TEST_PRIORITY.find((name) => name in deps) ?? '';

  let build = '';
  if (
    'vite' in deps ||
    isFile(join(root, 'vite.config.ts')) ||
    isFile(join(root, 'vite.config.js'))
  ) {
    build = 'vite';
  } else if (
    'webpack' in deps ||
    isFile(join(root, 'webpack.config.ts')) ||
    isFile(join(root, 'webpack.config.js'))
  ) {
    build = 'webpack';
  } else if ('esbuild' in deps) {
    build = 'esbuild';
  }

  const engines = isPlainObject(data['engines']) ? (data['engines'] as Record<string, unknown>) : {};
  const enginesNode = typeof engines['node'] === 'string' ? engines['node'] : '';
  const minVersion = enginesNode.replace(/^[\s>=^~]+/, '');

  const stack: TechStack = {runtime: 'node', language};
  if (testRunner) {
    stack.test = testRunner;
  }
  if (build) {
    stack.build = build;
  }
  if (minVersion) {
    stack.min_version = minVersion;
  }
  return stack;
}

function detectPython(root: string): TechStack {
  let data: unknown;
  try {
    data = tomlParse(readFileSync(join(root, 'pyproject.toml'), 'utf-8'));
  } catch {
    return {};
  }
  if (!isPlainObject(data)) {
    return {};
  }
  const project = isPlainObject(data['project']) ? (data['project'] as Record<string, unknown>) : {};
  const depsBlob: string[] = [];
  if (Array.isArray(project['dependencies'])) {
    for (const d of project['dependencies'] as unknown[]) {
      if (typeof d === 'string') {
        depsBlob.push(d);
      }
    }
  }
  const optional = project['optional-dependencies'];
  if (isPlainObject(optional)) {
    for (const group of Object.values(optional)) {
      if (Array.isArray(group)) {
        for (const d of group) {
          if (typeof d === 'string') {
            depsBlob.push(d);
          }
        }
      }
    }
  }
  const extras = data['dependency-groups'];
  if (isPlainObject(extras)) {
    for (const group of Object.values(extras)) {
      if (Array.isArray(group)) {
        for (const d of group) {
          if (typeof d === 'string') {
            depsBlob.push(d);
          }
        }
      }
    }
  }
  const tool = isPlainObject(data['tool']) ? (data['tool'] as Record<string, unknown>) : {};
  const hasPytest = depsBlob.some((dep) => dep.includes('pytest')) || 'pytest' in tool;
  const testRunner = hasPytest ? 'pytest' : '';

  const buildSystem = isPlainObject(data['build-system']) ? (data['build-system'] as Record<string, unknown>) : {};
  const buildBackend = typeof buildSystem['build-backend'] === 'string' ? buildSystem['build-backend'] : '';
  let build = '';
  if (buildBackend.includes('setuptools')) {
    build = 'setuptools';
  } else if (buildBackend.includes('poetry')) {
    build = 'poetry';
  } else if (buildBackend.includes('hatchling')) {
    build = 'hatch';
  } else if (buildBackend.includes('flit')) {
    build = 'flit';
  }

  const requiresPython = typeof project['requires-python'] === 'string' ? project['requires-python'] : '';
  const minVersion = requiresPython.replace(/^[\s>=^~]+/, '');

  const stack: TechStack = {runtime: 'python', language: 'python'};
  if (testRunner) {
    stack.test = testRunner;
  }
  if (build) {
    stack.build = build;
  }
  if (minVersion) {
    stack.min_version = minVersion;
  }
  return stack;
}

function detectRust(root: string): TechStack {
  let data: unknown;
  try {
    data = tomlParse(readFileSync(join(root, 'Cargo.toml'), 'utf-8'));
  } catch {
    return {};
  }
  if (!isPlainObject(data)) {
    return {};
  }
  const pkg = isPlainObject(data['package']) ? (data['package'] as Record<string, unknown>) : {};
  const rustVersion = typeof pkg['rust-version'] === 'string' ? pkg['rust-version'] : '';
  const stack: TechStack = {runtime: 'rust', language: 'rust', test: 'cargo', build: 'cargo'};
  if (rustVersion.length > 0) {
    stack.min_version = rustVersion;
  }
  return stack;
}

function detectGo(root: string): TechStack {
  let text: string;
  try {
    text = readFileSync(join(root, 'go.mod'), 'utf-8');
  } catch {
    return {};
  }
  const match = /^go\s+(\S+)/m.exec(text);
  const minVersion = match !== null ? match[1]! : '';
  const stack: TechStack = {runtime: 'go', language: 'go', test: 'go', build: 'go'};
  if (minVersion) {
    stack.min_version = minVersion;
  }
  return stack;
}
