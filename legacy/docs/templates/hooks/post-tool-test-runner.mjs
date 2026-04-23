#!/usr/bin/env node
/* ┌─────────────────────────────────────────────────────────────┐
 * │  PostToolUse(Write|Edit) — Scoped Test Runner               │
 * │                                                             │
 * │  Runs the test suite scoped to the edited file's module so  │
 * │  the agent sees a fast pass/fail signal right after each    │
 * │  Write/Edit — not at commit time. Non-blocking: test        │
 * │  results propagate back through inherited stdio but never   │
 * │  block the tool call itself.                                │
 * │                                                             │
 * │  Extension-dispatched (JS/TS, Python, Go, Rust, Java).      │
 * │  For source files, pairs are probed (`foo.ts` →             │
 * │  `foo.test.ts` / `foo.spec.ts`) so the runner targets only  │
 * │  the affected test file.                                    │
 * │  Related: docs/setup/runtime-guardrails.md                  │
 * └─────────────────────────────────────────────────────────────┘ */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, extname, join } from 'node:path';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const file = input?.tool_input?.file_path || '';
if (!file) process.exit(0);

/* ── Project bootstrap ───────────────────────────────────────── */

function gitRoot() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : process.cwd();
}
const PROJECT_ROOT = gitRoot();
process.chdir(PROJECT_ROOT);

function has(bin) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { stdio: 'ignore' });
  return r.status === 0;
}
function run(cmd, args) {
  // stdin is closed because the parent already drained it (JSON event
  // parse above); inheriting an exhausted pipe tricks TTY-sensing
  // runners like `pytest --capture=no` into waiting for keystrokes.
  // stdout/stderr stay inherited so agent sees pass/fail output.
  try { spawnSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] }); } catch { /* swallow */ }
}

/**
 * Check both `dependencies` and `devDependencies` for a package.
 * NOTE: Only the top-level package.json at PROJECT_ROOT is consulted.
 * Monorepo sub-package deps are invisible here — explicit trade-off.
 */
function hasDep(name) {
  if (!existsSync('package.json')) return false;
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    return !!(pkg.devDependencies?.[name] || pkg.dependencies?.[name]);
  } catch {
    return false;
  }
}

const base = basename(file);
const ext = extname(file);

function isJsTestFile(b) {
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(b);
}

function runJsTest(target) {
  if (hasDep('vitest')) run('npx', ['vitest', 'run', target, '--reporter=verbose']);
  else if (hasDep('jest')) run('npx', ['jest', target]);
}

/* ── JS / TS ─────────────────────────────────────────────────── */

if (isJsTestFile(base)) {
  runJsTest(file);
} else if (/\.(ts|tsx|js|jsx)$/.test(base)) {
  const noExt = file.slice(0, -ext.length);
  const plainExt = ext.slice(1);
  for (const candidate of [`${noExt}.test.${plainExt}`, `${noExt}.spec.${plainExt}`]) {
    if (existsSync(candidate)) { runJsTest(candidate); break; }
  }

/* ── Python ──────────────────────────────────────────────────── */

} else if (/^test_.*\.py$/.test(base) || /_test\.py$/.test(base)) {
  if (has('pytest')) run('pytest', ['-v', file]);
} else if (ext === '.py') {
  const baseName = basename(file, '.py');
  const dir = dirname(file);
  for (const candidate of [
    join(dir, `test_${baseName}.py`),
    join(dir, `${baseName}_test.py`),
    join('tests', `test_${baseName}.py`),
  ]) {
    if (existsSync(candidate)) { if (has('pytest')) run('pytest', ['-v', candidate]); break; }
  }

/* ── Go ──────────────────────────────────────────────────────── */

} else if (/_test\.go$/.test(base)) {
  if (has('go')) run('go', ['test', '-v', dirname(file)]);
} else if (ext === '.go') {
  // ⚠️ Single-directory scan — does NOT recurse. A typical `cmd/`-based
  // Go monorepo layout won't pick up sibling packages. Acceptable for
  // the common case; projects that want recursive runs should replace
  // this branch with `go test ./...` in a customized hook.
  const dir = dirname(file);
  if (existsSync(dir) && readdirSync(dir).some(f => f.endsWith('_test.go'))) {
    if (has('go')) run('go', ['test', '-v', dir]);
  }

/* ── Rust ────────────────────────────────────────────────────── */

} else if (ext === '.rs') {
  if (existsSync('Cargo.toml') && has('cargo')) run('cargo', ['test', '--quiet']);

/* ── Java ────────────────────────────────────────────────────── */

} else if (ext === '.java') {
  if (existsSync('build.gradle') || existsSync('build.gradle.kts')) {
    if (existsSync('./gradlew')) run('./gradlew', ['test', '--quiet']);
  } else if (existsSync('pom.xml')) {
    if (has('mvn')) run('mvn', ['-q', 'test']);
  }
}

process.exit(0);
