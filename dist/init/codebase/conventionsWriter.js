/**
 * Render `.harness/conventions.md` from a Layer-0 {@link Signals}
 * record (F-160).
 *
 * Seven fixed sections — Stack · Style · Rules · Comments · Tests
 * · Imports · Directory — each line stamped with a
 * `<!-- harness:fact key=K value=V source=PATH -->` sigil so the
 * future Content-drift detector can spot stale values. The
 * `Comments` and `Tests` sections are LLM-fed and ship as
 * placeholders here (PR 3b fills them in).
 *
 * @module init/codebase/conventionsWriter
 */
import { writeFileSync } from 'node:fs';
function fact(key, value, source, label) {
    const visible = label ?? value;
    return `<!-- harness:fact key=${key} value=${value} source=${source} -->${visible}<!-- /harness:fact -->`;
}
function joinList(items, empty) {
    return items.length === 0 ? empty : items.join(' · ');
}
function depBullets(deps) {
    return [
        ['framework', deps.framework],
        ['orm', deps.orm],
        ['api', deps.api],
        ['styling', deps.styling],
        ['test', deps.test],
        ['state', deps.state],
    ];
}
function describeDirectoryPattern(pattern) {
    switch (pattern) {
        case 'src+tests':
            return 'src/ + tests/ (separated)';
        case 'colocated':
            return 'co-located *.test files alongside source';
        case 'next-app':
            return 'Next.js app-router layout';
        case 'next-pages':
            return 'Next.js pages-router layout';
        case 'monorepo':
            return 'monorepo (packages/ · apps/)';
        case 'flat':
            return 'flat layout (no src/ split)';
        default:
            return 'unrecognized layout';
    }
}
function renderStack(s, lines, counter) {
    lines.push('## Stack', '');
    if (s.tech.runtime) {
        lines.push(`- Runtime: ${fact('runtime', s.tech.runtime, s.manifests[0] ?? 'manifest')}`);
        counter.n += 1;
    }
    if (s.tech.language) {
        lines.push(`- Language: ${fact('language', s.tech.language, s.manifests[0] ?? 'manifest')}`);
        counter.n += 1;
    }
    if (s.tech.min_version) {
        lines.push(`- Min version: ${fact('min_version', s.tech.min_version, s.manifests[0] ?? 'manifest')}`);
        counter.n += 1;
    }
    if (s.tech.build) {
        lines.push(`- Build: ${fact('build', s.tech.build, s.manifests[0] ?? 'manifest')}`);
        counter.n += 1;
    }
    if (s.tech.test) {
        lines.push(`- Test runner: ${fact('test_runner', s.tech.test, s.manifests[0] ?? 'manifest')}`);
        counter.n += 1;
    }
    if (s.manifests.length > 0) {
        lines.push(`- Manifests: ${joinList(s.manifests, '—')}`);
    }
    for (const [bucket, members] of depBullets(s.dependencies)) {
        if (members.length === 0)
            continue;
        lines.push(`- ${capitalize(bucket)}: ${fact(`deps.${bucket}`, members.join(','), 'package.json/pyproject')}`);
        counter.n += 1;
    }
    lines.push('');
}
function renderStyle(s, lines, counter) {
    lines.push('## Style', '');
    if (s.styleConfigs.length === 0) {
        lines.push('- _no style config detected_');
    }
    else {
        for (const cfg of s.styleConfigs) {
            lines.push(`- ${fact('style_config', cfg, cfg)}`);
            counter.n += 1;
        }
    }
    lines.push('');
}
function renderRules(s, lines, counter) {
    lines.push('## Rules', '');
    if (s.styleConfigs.some((f) => f.startsWith('.eslintrc') || f === 'eslint.config.js')) {
        lines.push(`- Lint: ${fact('lint', 'eslint', '.eslintrc*')}`);
        counter.n += 1;
    }
    if (s.styleConfigs.includes('tsconfig.json')) {
        lines.push(`- Type-check: ${fact('typecheck', 'tsc', 'tsconfig.json')}`);
        counter.n += 1;
    }
    if (s.styleConfigs.includes('pyproject.toml [tool.*]')) {
        lines.push(`- Python tooling: ${fact('python_tooling', 'ruff/black/mypy', 'pyproject.toml')}`);
        counter.n += 1;
    }
    if (s.qualityEnforce.length > 0) {
        lines.push(`- Pre-commit enforcement: ${joinList(s.qualityEnforce, '—')}`);
        counter.n += 1;
    }
    lines.push('');
}
function renderCommentsAndTests(lines) {
    lines.push('## Comments', '', '> _[pending: LLM hook stub — PR 3b fills sample-driven comment-style detection]_', '', '## Tests', '', '> _[pending: LLM hook stub — PR 3b fills sample-driven test-pattern detection]_', '');
}
function renderImports(s, lines, counter) {
    lines.push('## Imports', '');
    if (s.styleConfigs.includes('tsconfig.json')) {
        lines.push(`- ${fact('imports', 'tsconfig-driven', 'tsconfig.json')}`);
        counter.n += 1;
    }
    else {
        lines.push('- _no path-alias config detected_');
    }
    lines.push('');
}
function renderDirectory(s, lines, counter) {
    lines.push('## Directory', '');
    lines.push(`- Pattern: ${fact('directory_pattern', s.directoryPattern, '.', describeDirectoryPattern(s.directoryPattern))}`);
    counter.n += 1;
    if (s.i18n) {
        lines.push(`- i18n: ${fact('i18n', 'true', 'i18n/|locales/')}`);
        counter.n += 1;
    }
    if (s.license) {
        lines.push(`- License: ${fact('license', s.license, s.license)}`);
        counter.n += 1;
    }
    if (s.changelog) {
        lines.push(`- Changelog: ${fact('changelog', 'true', 'CHANGELOG.md')}`);
        counter.n += 1;
    }
    if (s.aiToolTraces.length > 0) {
        lines.push(`- AI-tool traces: ${joinList(s.aiToolTraces, '—')}`);
        counter.n += 1;
    }
    if (s.buildDeploy.length > 0) {
        lines.push(`- Build/deploy: ${joinList(s.buildDeploy.slice(0, 5), '—')}`);
        counter.n += 1;
    }
    lines.push('');
}
function capitalize(value) {
    return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}
/**
 * Render the conventions body and write it to `targetPath`. The
 * body is also returned in the result for golden-file testing.
 */
export function writeConventions(signals, targetPath) {
    const lines = [];
    const counter = { n: 0 };
    lines.push('# Conventions — auto-extracted (Layer-0 deterministic)', '');
    lines.push('Generated by `harness init --scenario existing_code` (F-160).', 'The Comments and Tests sections are filled by the slash command in PR 3b.', '');
    renderStack(signals, lines, counter);
    renderStyle(signals, lines, counter);
    renderRules(signals, lines, counter);
    renderCommentsAndTests(lines);
    renderImports(signals, lines, counter);
    renderDirectory(signals, lines, counter);
    lines.push('<!-- harness:user-edit-begin -->', '## 사용자 보강 (자유 편집, reseed 시 보존)', '', '_reseed 가 이 영역을 건드리지 않습니다._', '<!-- harness:user-edit-end -->', '');
    const body = lines.join('\n');
    writeFileSync(targetPath, body, 'utf8');
    return { path: targetPath, factCount: counter.n, body };
}
//# sourceMappingURL=conventionsWriter.js.map