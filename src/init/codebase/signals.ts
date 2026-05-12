/**
 * Layer-0 codebase signal collection for scenario-3 (F-160).
 *
 * Walks the project root once and returns a structured record of
 * everything the `codebase-archaeologist` agent can use without
 * calling an LLM. Deeper analysis (AST · entity relations · per-
 * feature fog-clear) happens at Layer-1 inside the work cycle and
 * is explicitly out of scope here.
 *
 * Mini-map principle (StarCraft fog-of-war): zoom out for the
 * outline, leave the per-feature interior dark until the work
 * cycle reveals it.
 *
 * @module init/codebase/signals
 */

import {readFileSync, readdirSync, statSync} from 'node:fs';
import {basename, join, relative} from 'node:path';
import {parse as tomlParse} from 'smol-toml';

import {extractTechStack, type TechStack} from '../../scan/manifest.js';

/** Aggregate Layer-0 signal record. */
export interface Signals {
  readonly projectRoot: string;
  readonly tech: TechStack;
  readonly manifests: ReadonlyArray<string>;
  readonly buildDeploy: ReadonlyArray<string>;
  readonly styleConfigs: ReadonlyArray<string>;
  readonly dependencies: DependencyCategories;
  readonly directoryPattern: DirectoryPattern;
  readonly aiToolTraces: ReadonlyArray<string>;
  readonly ciStages: ReadonlyArray<string>;
  readonly license: string | null;
  readonly changelog: boolean;
  readonly i18n: boolean;
  readonly qualityEnforce: ReadonlyArray<string>;
  readonly readmePreview: string | null;
}

/** Categorized dependency snapshot. Keys map to common roles. */
export interface DependencyCategories {
  readonly framework: ReadonlyArray<string>;
  readonly orm: ReadonlyArray<string>;
  readonly api: ReadonlyArray<string>;
  readonly styling: ReadonlyArray<string>;
  readonly test: ReadonlyArray<string>;
  readonly state: ReadonlyArray<string>;
}

/** Detected high-level directory layout. */
export type DirectoryPattern =
  | 'src+tests'
  | 'colocated'
  | 'next-app'
  | 'next-pages'
  | 'monorepo'
  | 'flat'
  | 'unknown';

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

const STYLE_CONFIG_FILES: ReadonlyArray<string> = [
  '.editorconfig',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.yaml',
  '.prettierrc.js',
  'biome.json',
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.js',
  '.eslintrc.cjs',
  'eslint.config.js',
  'tsconfig.json',
  '.rustfmt.toml',
  'rustfmt.toml',
];

const BUILD_DEPLOY_FILES: ReadonlyArray<string> = [
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'serverless.yml',
  'netlify.toml',
  'vercel.json',
  'fly.toml',
  'railway.json',
];

const AI_TOOL_FILES: ReadonlyArray<string> = [
  '.cursorrules',
  'CLAUDE.md',
  'AGENTS.md',
  '.continuerules',
  '.aider.conf.yml',
];

const QUALITY_ENFORCE_FILES: ReadonlyArray<string> = [
  '.pre-commit-config.yaml',
  'lint-staged.config.js',
  'lint-staged.config.cjs',
  'lint-staged.config.mjs',
];

const QUALITY_ENFORCE_DIRS: ReadonlyArray<string> = ['.husky', '.lefthook'];

const I18N_DIRS: ReadonlyArray<string> = ['i18n', 'locales', '__locales__'];

const DEP_DICTIONARY: ReadonlyArray<readonly [keyof DependencyCategories, ReadonlyArray<string>]> = [
  [
    'framework',
    [
      'react',
      'react-dom',
      'next',
      'vue',
      'nuxt',
      'svelte',
      'sveltekit',
      'solid-js',
      'astro',
      '@remix-run/node',
      'express',
      'fastify',
      'koa',
      '@nestjs/core',
      'django',
      'flask',
      'fastapi',
      'rails',
      'phoenix',
      'spring-boot',
      'aspnetcore',
    ],
  ],
  [
    'orm',
    [
      'prisma',
      '@prisma/client',
      'typeorm',
      'drizzle-orm',
      'sequelize',
      'mongoose',
      'sqlalchemy',
      'django-orm',
      'diesel',
      'gorm',
      'activerecord',
    ],
  ],
  [
    'api',
    ['@trpc/server', 'graphql', 'apollo-server', '@apollo/client', 'fastify-grpc', 'grpc'],
  ],
  [
    'styling',
    [
      'tailwindcss',
      'styled-components',
      '@emotion/react',
      '@emotion/styled',
      'sass',
      'less',
      'stylus',
      'vanilla-extract',
    ],
  ],
  [
    'test',
    [
      'vitest',
      'jest',
      'mocha',
      'ava',
      'pytest',
      '@playwright/test',
      'cypress',
      'rspec',
    ],
  ],
  [
    'state',
    [
      'redux',
      '@reduxjs/toolkit',
      'zustand',
      'jotai',
      'mobx',
      'pinia',
      'recoil',
      'xstate',
    ],
  ],
];

function isDir(path: string): boolean {
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

function safeReaddir(path: string): ReadonlyArray<string> {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

function relPath(root: string, abs: string): string {
  const rel = relative(root, abs);
  return rel.length === 0 ? '.' : rel;
}

function listManifests(root: string): ReadonlyArray<string> {
  const candidates = [
    'package.json',
    'pyproject.toml',
    'Cargo.toml',
    'go.mod',
    'Gemfile',
    'composer.json',
    'mix.exs',
    'pubspec.yaml',
    'Package.swift',
  ];
  return candidates.filter((name) => isFile(join(root, name)));
}

function listMatchingFiles(
  root: string,
  basenames: ReadonlyArray<string>,
): ReadonlyArray<string> {
  return basenames.filter((name) => isFile(join(root, name)));
}

function listGithubWorkflows(root: string): ReadonlyArray<string> {
  const dir = join(root, '.github', 'workflows');
  if (!isDir(dir)) return [];
  return safeReaddir(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => join('.github', 'workflows', f));
}

function listGitlabAndCircle(root: string): ReadonlyArray<string> {
  const hits: string[] = [];
  if (isFile(join(root, '.gitlab-ci.yml'))) hits.push('.gitlab-ci.yml');
  if (isFile(join(root, '.circleci', 'config.yml'))) hits.push('.circleci/config.yml');
  return hits;
}

function collectStyleConfigs(root: string): ReadonlyArray<string> {
  const hits: string[] = [...listMatchingFiles(root, STYLE_CONFIG_FILES)];
  // pyproject.toml carries [tool.ruff/black/mypy] but only when present.
  const pyproject = join(root, 'pyproject.toml');
  if (isFile(pyproject) && pyprojectHasStyleTable(pyproject)) {
    hits.push('pyproject.toml [tool.*]');
  }
  return hits;
}

function pyprojectHasStyleTable(path: string): boolean {
  try {
    const parsed = tomlParse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    const tool = parsed['tool'] as Record<string, unknown> | undefined;
    if (!tool) return false;
    return Boolean(tool['ruff'] ?? tool['black'] ?? tool['mypy'] ?? tool['isort']);
  } catch {
    return false;
  }
}

function collectAiToolTraces(root: string): ReadonlyArray<string> {
  return listMatchingFiles(root, AI_TOOL_FILES);
}

function collectQualityEnforce(root: string): ReadonlyArray<string> {
  const hits: string[] = [];
  for (const dir of QUALITY_ENFORCE_DIRS) {
    if (isDir(join(root, dir))) hits.push(dir + '/');
  }
  hits.push(...listMatchingFiles(root, QUALITY_ENFORCE_FILES));
  return hits;
}

function detectI18n(root: string): boolean {
  for (const dir of I18N_DIRS) {
    if (isDir(join(root, dir))) return true;
  }
  return false;
}

function detectChangelog(root: string): boolean {
  return isFile(join(root, 'CHANGELOG.md')) || isFile(join(root, 'CHANGELOG.rst'));
}

function detectLicense(root: string): string | null {
  for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license']) {
    if (isFile(join(root, name))) return name;
  }
  return null;
}

function readReadmePreview(root: string): string | null {
  const candidates = ['README.md', 'README.rst', 'README.txt', 'readme.md'];
  for (const name of candidates) {
    const path = join(root, name);
    if (!isFile(path)) continue;
    try {
      const body = readFileSync(path, 'utf8');
      return body.slice(0, 500);
    } catch {
      return null;
    }
  }
  return null;
}

function detectDirectoryPattern(root: string): DirectoryPattern {
  const hasSrc = isDir(join(root, 'src'));
  const hasTests = isDir(join(root, 'tests')) || isDir(join(root, 'test'));
  const hasAppRouter = isDir(join(root, 'app'));
  const hasPagesRouter = isDir(join(root, 'pages'));
  const hasPackages = isDir(join(root, 'packages'));
  const hasApps = isDir(join(root, 'apps'));

  if ((hasPackages && hasApps) || hasPackages) return 'monorepo';
  if (hasAppRouter && isFile(join(root, 'next.config.js'))) return 'next-app';
  if (hasPagesRouter && isFile(join(root, 'next.config.js'))) return 'next-pages';
  if (hasSrc && hasTests) return 'src+tests';
  if (hasSrc) return 'colocated';
  if (!hasSrc && !hasTests) return 'flat';
  return 'unknown';
}

function categorizeDependencies(root: string): DependencyCategories {
  const seen = new Set<string>();
  const pkg = join(root, 'package.json');
  if (isFile(pkg)) {
    try {
      const parsed = JSON.parse(readFileSync(pkg, 'utf8')) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      Object.keys(parsed.dependencies ?? {}).forEach((d) => seen.add(d));
      Object.keys(parsed.devDependencies ?? {}).forEach((d) => seen.add(d));
    } catch {
      // ignore — package.json is malformed; skip silently
    }
  }
  const pyproject = join(root, 'pyproject.toml');
  if (isFile(pyproject)) {
    try {
      const parsed = tomlParse(readFileSync(pyproject, 'utf8')) as Record<string, unknown>;
      const project = parsed['project'] as Record<string, unknown> | undefined;
      const deps = project?.['dependencies'];
      if (Array.isArray(deps)) {
        for (const entry of deps) {
          if (typeof entry === 'string') {
            const name = entry.split(/[<>=!~ ]/)[0]!;
            if (name) seen.add(name);
          }
        }
      }
    } catch {
      // ignore — malformed pyproject
    }
  }

  const categories: Record<keyof DependencyCategories, string[]> = {
    framework: [],
    orm: [],
    api: [],
    styling: [],
    test: [],
    state: [],
  };
  for (const [bucket, names] of DEP_DICTIONARY) {
    for (const dep of names) {
      if (seen.has(dep)) categories[bucket].push(dep);
    }
  }
  return {
    framework: categories.framework,
    orm: categories.orm,
    api: categories.api,
    styling: categories.styling,
    test: categories.test,
    state: categories.state,
  };
}

/**
 * Walk the project root and return the consolidated Layer-0 signal
 * record. Pure read-only — no filesystem mutations.
 */
export function collectSignals(projectRoot: string): Signals {
  void IGNORED_DIRS; // reserved for future deep-walk extensions
  void basename; // kept for future relative-path helpers
  void relPath;

  return {
    projectRoot,
    tech: extractTechStack(projectRoot),
    manifests: listManifests(projectRoot),
    buildDeploy: [
      ...listMatchingFiles(projectRoot, BUILD_DEPLOY_FILES),
      ...listGithubWorkflows(projectRoot),
      ...listGitlabAndCircle(projectRoot),
    ],
    styleConfigs: collectStyleConfigs(projectRoot),
    dependencies: categorizeDependencies(projectRoot),
    directoryPattern: detectDirectoryPattern(projectRoot),
    aiToolTraces: collectAiToolTraces(projectRoot),
    ciStages: listGithubWorkflows(projectRoot),
    license: detectLicense(projectRoot),
    changelog: detectChangelog(projectRoot),
    i18n: detectI18n(projectRoot),
    qualityEnforce: collectQualityEnforce(projectRoot),
    readmePreview: readReadmePreview(projectRoot),
  };
}
