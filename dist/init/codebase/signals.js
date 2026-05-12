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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { parse as tomlParse } from 'smol-toml';
import { extractTechStack } from '../../scan/manifest.js';
const IGNORED_DIRS = new Set([
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
const STYLE_CONFIG_FILES = [
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
const BUILD_DEPLOY_FILES = [
    'Dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
    'serverless.yml',
    'netlify.toml',
    'vercel.json',
    'fly.toml',
    'railway.json',
];
const AI_TOOL_FILES = [
    '.cursorrules',
    'CLAUDE.md',
    'AGENTS.md',
    '.continuerules',
    '.aider.conf.yml',
];
const QUALITY_ENFORCE_FILES = [
    '.pre-commit-config.yaml',
    'lint-staged.config.js',
    'lint-staged.config.cjs',
    'lint-staged.config.mjs',
];
const QUALITY_ENFORCE_DIRS = ['.husky', '.lefthook'];
const I18N_DIRS = ['i18n', 'locales', '__locales__'];
const DEP_DICTIONARY = [
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
function isDir(path) {
    try {
        return statSync(path).isDirectory();
    }
    catch {
        return false;
    }
}
function isFile(path) {
    try {
        return statSync(path).isFile();
    }
    catch {
        return false;
    }
}
function safeReaddir(path) {
    try {
        return readdirSync(path);
    }
    catch {
        return [];
    }
}
function relPath(root, abs) {
    const rel = relative(root, abs);
    return rel.length === 0 ? '.' : rel;
}
function listManifests(root) {
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
function listMatchingFiles(root, basenames) {
    return basenames.filter((name) => isFile(join(root, name)));
}
function listGithubWorkflows(root) {
    const dir = join(root, '.github', 'workflows');
    if (!isDir(dir))
        return [];
    return safeReaddir(dir)
        .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
        .map((f) => join('.github', 'workflows', f));
}
function listGitlabAndCircle(root) {
    const hits = [];
    if (isFile(join(root, '.gitlab-ci.yml')))
        hits.push('.gitlab-ci.yml');
    if (isFile(join(root, '.circleci', 'config.yml')))
        hits.push('.circleci/config.yml');
    return hits;
}
function collectStyleConfigs(root) {
    const hits = [...listMatchingFiles(root, STYLE_CONFIG_FILES)];
    // pyproject.toml carries [tool.ruff/black/mypy] but only when present.
    const pyproject = join(root, 'pyproject.toml');
    if (isFile(pyproject) && pyprojectHasStyleTable(pyproject)) {
        hits.push('pyproject.toml [tool.*]');
    }
    return hits;
}
function pyprojectHasStyleTable(path) {
    try {
        const parsed = tomlParse(readFileSync(path, 'utf8'));
        const tool = parsed['tool'];
        if (!tool)
            return false;
        return Boolean(tool['ruff'] ?? tool['black'] ?? tool['mypy'] ?? tool['isort']);
    }
    catch {
        return false;
    }
}
function collectAiToolTraces(root) {
    return listMatchingFiles(root, AI_TOOL_FILES);
}
function collectQualityEnforce(root) {
    const hits = [];
    for (const dir of QUALITY_ENFORCE_DIRS) {
        if (isDir(join(root, dir)))
            hits.push(dir + '/');
    }
    hits.push(...listMatchingFiles(root, QUALITY_ENFORCE_FILES));
    return hits;
}
function detectI18n(root) {
    for (const dir of I18N_DIRS) {
        if (isDir(join(root, dir)))
            return true;
    }
    return false;
}
function detectChangelog(root) {
    return isFile(join(root, 'CHANGELOG.md')) || isFile(join(root, 'CHANGELOG.rst'));
}
function detectLicense(root) {
    for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license']) {
        if (isFile(join(root, name)))
            return name;
    }
    return null;
}
function readReadmePreview(root) {
    const candidates = ['README.md', 'README.rst', 'README.txt', 'readme.md'];
    for (const name of candidates) {
        const path = join(root, name);
        if (!isFile(path))
            continue;
        try {
            const body = readFileSync(path, 'utf8');
            return body.slice(0, 500);
        }
        catch {
            return null;
        }
    }
    return null;
}
function detectDirectoryPattern(root) {
    const hasSrc = isDir(join(root, 'src'));
    const hasTests = isDir(join(root, 'tests')) || isDir(join(root, 'test'));
    const hasAppRouter = isDir(join(root, 'app'));
    const hasPagesRouter = isDir(join(root, 'pages'));
    const hasPackages = isDir(join(root, 'packages'));
    const hasApps = isDir(join(root, 'apps'));
    if ((hasPackages && hasApps) || hasPackages)
        return 'monorepo';
    if (hasAppRouter && isFile(join(root, 'next.config.js')))
        return 'next-app';
    if (hasPagesRouter && isFile(join(root, 'next.config.js')))
        return 'next-pages';
    if (hasSrc && hasTests)
        return 'src+tests';
    if (hasSrc)
        return 'colocated';
    if (!hasSrc && !hasTests)
        return 'flat';
    return 'unknown';
}
function categorizeDependencies(root) {
    const seen = new Set();
    const pkg = join(root, 'package.json');
    if (isFile(pkg)) {
        try {
            const parsed = JSON.parse(readFileSync(pkg, 'utf8'));
            Object.keys(parsed.dependencies ?? {}).forEach((d) => seen.add(d));
            Object.keys(parsed.devDependencies ?? {}).forEach((d) => seen.add(d));
        }
        catch {
            // ignore — package.json is malformed; skip silently
        }
    }
    const pyproject = join(root, 'pyproject.toml');
    if (isFile(pyproject)) {
        try {
            const parsed = tomlParse(readFileSync(pyproject, 'utf8'));
            const project = parsed['project'];
            const deps = project?.['dependencies'];
            if (Array.isArray(deps)) {
                for (const entry of deps) {
                    if (typeof entry === 'string') {
                        const name = entry.split(/[<>=!~ ]/)[0];
                        if (name)
                            seen.add(name);
                    }
                }
            }
        }
        catch {
            // ignore — malformed pyproject
        }
    }
    const categories = {
        framework: [],
        orm: [],
        api: [],
        styling: [],
        test: [],
        state: [],
    };
    for (const [bucket, names] of DEP_DICTIONARY) {
        for (const dep of names) {
            if (seen.has(dep))
                categories[bucket].push(dep);
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
export function collectSignals(projectRoot) {
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
//# sourceMappingURL=signals.js.map