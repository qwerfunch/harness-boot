/**
 * Parity test for `src/scan/{structure,manifest,areaResolver}.ts` (F-101).
 *
 * Coverage:
 *
 *   - scanStructure recognises top dirs, ADR dir, README, entity files.
 *   - extractTechStack picks runtime from each manifest.
 *   - extractProjectName falls back through the manifest priority.
 *   - resolveAreas clusters resolvable modules + emits unmapped-* for
 *     misses.
 *
 * Run via `npm run test:parity`.
 */

import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {resolveAreas} from '../../src/scan/areaResolver.js';
import {extractProjectName, extractTechStack} from '../../src/scan/manifest.js';
import {scanStructure} from '../../src/scan/structure.js';

interface Project {
  root: string;
}

function makeProject(): Project {
  return {root: mkdtempSync(join(tmpdir(), 'scan-'))};
}

describe('scan.scanStructure', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  it('returns empty shape on missing root', () => {
    const out = scanStructure('/nonexistent/path');
    expect(out.top_dirs).toEqual([]);
    expect(out.adr_dir).toBeNull();
    expect(out.entity_candidate_files).toEqual([]);
    expect(out.readme_path).toBeNull();
  });

  it('lists top-level dirs sorted, ignoring noise', () => {
    mkdirSync(join(p.root, 'src'));
    mkdirSync(join(p.root, 'tests'));
    mkdirSync(join(p.root, 'node_modules'));
    mkdirSync(join(p.root, '.git'));
    mkdirSync(join(p.root, '.hidden'));
    const out = scanStructure(p.root);
    expect(out.top_dirs).toEqual(['src', 'tests']);
  });

  it('detects ADR dir', () => {
    mkdirSync(join(p.root, 'docs', 'adr'), {recursive: true});
    expect(scanStructure(p.root).adr_dir).toBe('docs/adr');
  });

  it('detects README', () => {
    writeFileSync(join(p.root, 'README.md'), '# title\n', 'utf-8');
    expect(scanStructure(p.root).readme_path).toBe('README.md');
  });

  it('finds entity candidate files', () => {
    mkdirSync(join(p.root, 'src'));
    writeFileSync(join(p.root, 'src', 'models.py'), '# entities\n', 'utf-8');
    const out = scanStructure(p.root);
    expect(out.entity_candidate_files).toContain('src/models.py');
  });
});

describe('scan.extractTechStack', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  it('node project with vitest + vite', () => {
    writeFileSync(
      join(p.root, 'package.json'),
      JSON.stringify({
        name: 'test',
        dependencies: {typescript: '^5'},
        devDependencies: {vitest: '^2', vite: '^5'},
        engines: {node: '>=20'},
      }),
      'utf-8',
    );
    const stack = extractTechStack(p.root);
    expect(stack.runtime).toBe('node');
    expect(stack.language).toBe('typescript');
    expect(stack.test).toBe('vitest');
    expect(stack.build).toBe('vite');
    expect(stack.min_version).toBe('20');
  });

  it('python project with pytest + setuptools', () => {
    writeFileSync(
      join(p.root, 'pyproject.toml'),
      `[project]
name = "demo"
requires-python = ">=3.10"
dependencies = ["pytest>=7"]

[build-system]
build-backend = "setuptools.build_meta"
`,
      'utf-8',
    );
    const stack = extractTechStack(p.root);
    expect(stack.runtime).toBe('python');
    expect(stack.test).toBe('pytest');
    expect(stack.build).toBe('setuptools');
    expect(stack.min_version).toBe('3.10');
  });

  it('rust project picks runtime + cargo + rust-version', () => {
    writeFileSync(
      join(p.root, 'Cargo.toml'),
      '[package]\nname = "demo"\nrust-version = "1.75"\n',
      'utf-8',
    );
    const stack = extractTechStack(p.root);
    expect(stack.runtime).toBe('rust');
    expect(stack.min_version).toBe('1.75');
  });

  it('go project picks go version', () => {
    writeFileSync(join(p.root, 'go.mod'), 'module example.com/demo\n\ngo 1.22\n', 'utf-8');
    const stack = extractTechStack(p.root);
    expect(stack.runtime).toBe('go');
    expect(stack.min_version).toBe('1.22');
  });

  it('empty project returns empty stack', () => {
    expect(extractTechStack(p.root)).toEqual({});
  });
});

describe('scan.extractProjectName', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  it('reads package.json name first', () => {
    writeFileSync(join(p.root, 'package.json'), JSON.stringify({name: 'pkg-name'}), 'utf-8');
    expect(extractProjectName(p.root)).toBe('pkg-name');
  });

  it('falls back to pyproject when package.json missing', () => {
    writeFileSync(join(p.root, 'pyproject.toml'), '[project]\nname = "py-name"\n', 'utf-8');
    expect(extractProjectName(p.root)).toBe('py-name');
  });

  it('falls back to go.mod module tail', () => {
    writeFileSync(join(p.root, 'go.mod'), 'module example.com/path/to/pkg\n', 'utf-8');
    expect(extractProjectName(p.root)).toBe('pkg');
  });

  it('falls back to directory basename when no manifest', () => {
    expect(extractProjectName(p.root)).toBe(p.root.split(/[/\\]/).pop());
  });
});

describe('scan.resolveAreas', () => {
  let p: Project;
  beforeEach(() => {
    p = makeProject();
  });
  afterEach(() => {
    rmSync(p.root, {recursive: true, force: true});
  });

  it('clusters modules sharing the first 2 path segments', () => {
    mkdirSync(join(p.root, 'src', 'login'), {recursive: true});
    writeFileSync(join(p.root, 'src', 'login', 'a.ts'), '', 'utf-8');
    writeFileSync(join(p.root, 'src', 'login', 'b.ts'), '', 'utf-8');
    const feature = {id: 'F-001', modules: ['src/login/a.ts', 'src/login/b.ts']};
    const structure = {top_dirs: ['src'], adr_dir: null, entity_candidate_files: [], readme_path: null};
    const areas = resolveAreas(feature, p.root, structure);
    expect(areas).toHaveLength(1);
    expect(areas[0]!.label).toBe('src/login');
    expect(areas[0]!.modules).toEqual(['src/login/a.ts', 'src/login/b.ts']);
    expect(areas[0]!.feature_id).toBe('F-001');
  });

  it('emits unmapped-* for unresolvable modules', () => {
    const feature = {id: 'F-001', modules: ['bare_unresolved_name']};
    const structure = {top_dirs: ['src'], adr_dir: null, entity_candidate_files: [], readme_path: null};
    const areas = resolveAreas(feature, p.root, structure);
    expect(areas[0]!.slug).toMatch(/^unmapped-/);
    expect(areas[0]!.modules).toEqual(['bare_unresolved_name']);
  });

  it('resolves bare top-dir modules', () => {
    mkdirSync(join(p.root, 'src'));
    const structure = {top_dirs: ['src'], adr_dir: null, entity_candidate_files: [], readme_path: null};
    const areas = resolveAreas({id: 'F-1', modules: ['src']}, p.root, structure);
    expect(areas[0]!.label).toBe('src');
  });

  it('returns empty when feature has no modules', () => {
    const structure = {top_dirs: [], adr_dir: null, entity_candidate_files: [], readme_path: null};
    expect(resolveAreas({id: 'F-1'}, p.root, structure)).toEqual([]);
  });
});
