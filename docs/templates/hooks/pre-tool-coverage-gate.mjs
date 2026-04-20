#!/usr/bin/env node
/* ┌─────────────────────────────────────────────────────────────┐
 * │  PreToolUse(Bash) — Coverage Gate                           │
 * │                                                             │
 * │  Blocks `git commit` when per-feature coverage evidence is  │
 * │  missing. One of four strategies runs, selected by the      │
 * │  current feature's `test_strategy`:                         │
 * │    lean-tdd  — BDD file with N Given/When/Then blocks       │
 * │                (N = acceptance_test.length)                 │
 * │    tdd       — every tdd_focus function >= 70% line cov     │
 * │    state-vfy — test file exists under the module path       │
 * │    integration — overall file coverage >= 60%               │
 * │                                                             │
 * │  Exit codes: 0 allow, 2 block. Bypass: [skip-coverage]      │
 * │  Related: docs/setup/runtime-guardrails.md, stacks.md       │
 * └─────────────────────────────────────────────────────────────┘ */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

/* ── Placeholders (substituted by /setup Phase 1) ─────────────── */

const COVERAGE_COMMAND = '{COVERAGE_COMMAND}';
const COVERAGE_FILE = '{COVERAGE_FILE}';
const COVERAGE_THRESHOLD = 70;

// ⚠️ If these braces survive into the deployed hook it means Phase 1
// skipped the per-stack substitution. Fail fast with a human message —
// otherwise `sh -c '{COVERAGE_COMMAND}'` would spit a cryptic syntax error.
if (COVERAGE_COMMAND.startsWith('{') || COVERAGE_FILE.startsWith('{')) {
  console.error('ERROR: pre-tool-coverage-gate placeholders not substituted.');
  console.error('Re-run /harness-boot:setup Phase 1 so stacks.md values are applied.');
  process.exit(1);
}

/* ── Stdin parse + short-circuit non-commit commands ──────────── */

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const tool = input?.tool_name || '';
const command = input?.tool_input?.command || '';

if (tool !== 'Bash' || !/^git\s+commit/.test(command)) process.exit(0);
if (command.includes('[skip-coverage]')) process.exit(0);

/* ── Project bootstrap ───────────────────────────────────────── */

function gitRoot() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : process.cwd();
}
const PROJECT_ROOT = gitRoot();
const FEATURE_LIST = join(PROJECT_ROOT, 'feature-list.json');
if (!existsSync(FEATURE_LIST)) process.exit(0);

let features;
try {
  features = JSON.parse(readFileSync(FEATURE_LIST, 'utf8'));
} catch {
  process.exit(0);
}
const current = resolveCurrentFeature(features);
if (!current) process.exit(0);

const testStrategy = current.test_strategy || 'lean-tdd';
const featureId = current.id || '';
const tddFocus = Array.isArray(current.tdd_focus) ? current.tdd_focus : [];

/* ── Helpers ─────────────────────────────────────────────────── */

/**
 * Recursive file walk, excluding the two directories that will dwarf
 * the result set on every Node project.
 *
 * NOTE: Symlink cycles are not guarded. All four strategies below
 * operate on project sources, where cycles are pathological — accept
 * the crash over adding a visited-set on every call.
 */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/**
 * Cross-platform shell wrapper.
 *
 * NOTE: spawnSync('sh', ['-c', cmd]) is POSIX-only and defeats the
 * whole point of the Node.js port. On Windows we dispatch through
 * cmd.exe /d/s/c (skip AUTORUN, strip quotes, run-then-exit).
 */
function runShell(cmd, opts = {}) {
  const isWin = process.platform === 'win32';
  return spawnSync(isWin ? 'cmd.exe' : 'sh', [isWin ? '/d/s/c' : '-c', cmd], opts);
}

/**
 * Find the feature this commit is finalizing by diffing the staged
 * feature-list.json against HEAD and picking the id whose `passes`
 * flipped false → true. `/start` Step 7 runs update-feature-status
 * BEFORE `git commit`, so at hook time the just-completed feature is
 * already `passes: true` — a naive `find(passes === false)` would
 * return the NEXT feature and apply the wrong contract to this commit.
 *
 * Fallback order: flip of length 1 (normal), flip of length >1 with a
 * stderr warning (single-commit-per-feature discipline violation), then
 * the legacy passes:false fallback for initial/doc-only commits where
 * no flip is present.
 */
function resolveCurrentFeature(features) {
  const stagedRes = spawnSync('git', ['-C', PROJECT_ROOT, 'show', ':feature-list.json'], { encoding: 'utf8' });
  const headRes = spawnSync('git', ['-C', PROJECT_ROOT, 'show', 'HEAD:feature-list.json'], { encoding: 'utf8' });
  // Initial commit (no HEAD yet): the harness scaffold commit does not
  // target any feature, so there is no contract to verify. Short-circuit
  // with null rather than walking into the passes:false fallback, which
  // would wrongly pin the gate to FEAT-1.
  if (headRes.status !== 0) return null;
  if (stagedRes.status !== 0) {
    return features.find(f => f.passes === false);
  }
  let staged, head;
  try {
    staged = JSON.parse(stagedRes.stdout);
    head = JSON.parse(headRes.stdout);
  } catch {
    return features.find(f => f.passes === false);
  }
  if (!Array.isArray(staged) || !Array.isArray(head)) {
    return features.find(f => f.passes === false);
  }
  const flipped = staged.filter(s => {
    const h = head.find(x => x.id === s.id);
    return s.passes === true && h && h.passes === false;
  });
  if (flipped.length === 1) {
    return features.find(f => f.id === flipped[0].id);
  }
  if (flipped.length > 1) {
    console.error(`WARNING: multiple features flipped in single commit: ${flipped.map(f => f.id).join(', ')}`);
    console.error('Single-commit-per-feature is required. Checking first flipped feature only.');
    return features.find(f => f.id === flipped[0].id);
  }
  return features.find(f => f.passes === false);
}

/* ── Strategy: lean-tdd ──────────────────────────────────────── */
// Gate 0 for the default strategy: a BDD file must exist and carry
// at least one Given/When/Then line per declared acceptance_test item.

if (testStrategy === 'lean-tdd') {
  const expected = Array.isArray(current.acceptance_test) ? current.acceptance_test.length : 0;
  if (!featureId) process.exit(0);
  // `git ls-files` scales to large repos where `walk(PROJECT_ROOT)` would
  // stat thousands of files on every commit.
  const lsRes = spawnSync('git', ['-C', PROJECT_ROOT, 'ls-files', `*${featureId}.bdd*`], { encoding: 'utf8' });
  const bddFile = lsRes.status === 0
    ? (lsRes.stdout.split('\n').find(p => p.trim()) || '').trim()
    : '';
  if (!bddFile) {
    console.error(`BLOCKED: No BDD file found for ${featureId} (test_strategy: lean-tdd).`);
    console.error(`Expected: <test-dir>/${featureId}.bdd.<ext> with ${expected} Given/When/Then block(s).`);
    console.error('Bypass: include [skip-coverage] in commit message.');
    process.exit(2);
  }
  const body = readFileSync(join(PROJECT_ROOT, bddFile), 'utf8');
  // Count each scenario by its leading `Given`. Works for multi-line
  // Gherkin (`Given …\n  When …\n  Then …`) and single-line compact form
  // alike; bdd-writer may emit either.
  const scenarios = body.split('\n').filter(l => /^\s*Given\b/i.test(l)).length;
  if (scenarios < expected) {
    console.error(`BLOCKED: BDD file ${bddFile} has ${scenarios} Given block(s); acceptance_test requires ${expected}.`);
    console.error('Add the missing scenarios (bdd-writer) before committing.');
    console.error('Bypass: include [skip-coverage] in commit message.');
    process.exit(2);
  }
  process.exit(0);
}

if (tddFocus.length === 0) process.exit(0);

/* ── Strategy: state-verification ────────────────────────────── */
// UI / rendering modules: the lighter contract is "at least one test
// file lives next to the implementation." Print a WARNING (not block)
// because false negatives on directory layout are common.

if (testStrategy === 'state-verification') {
  const category = current.category || '';
  const srcDir = join(PROJECT_ROOT, 'src');
  const hasTest = walk(srcDir).some(f =>
    f.includes(category) && (/\.test\./.test(f) || /\.spec\./.test(f))
  );
  if (!hasTest) {
    console.error(`WARNING: No test files found for ${category} module (test_strategy: state-verification).`);
  }
  process.exit(0);
}

/* ── Strategy: integration ───────────────────────────────────── */
// Wiring / entry points: coarse file-level coverage (>= 60%). Runs
// the stack-specific coverage command and parses the Istanbul JSON
// artifact.

if (testStrategy === 'integration') {
  const covCmd = runShell(COVERAGE_COMMAND, { stdio: ['ignore', 'ignore', 'ignore'] });
  if (covCmd.status !== 0) {
    console.error('BLOCKED: coverage command failed (test_strategy: integration) — gate cannot verify.');
    console.error('Fix the failing tests and retry, or include [skip-coverage] in the commit message.');
    process.exit(2);
  }
  const coverageFile = join(PROJECT_ROOT, COVERAGE_FILE);
  if (existsSync(coverageFile)) {
    let cov;
    try { cov = JSON.parse(readFileSync(coverageFile, 'utf8')); } catch { process.exit(0); }
    const allStmts = [];
    for (const fileEntry of Object.values(cov)) {
      if (fileEntry && typeof fileEntry.s === 'object') {
        for (const v of Object.values(fileEntry.s)) allStmts.push(v);
      }
    }
    const overall = allStmts.length === 0 ? 100 : (allStmts.filter(v => v > 0).length / allStmts.length) * 100;
    if (overall < 60) {
      console.error(`BLOCKED: Overall coverage ${overall}% is below 60% (test_strategy: integration).`);
      process.exit(2);
    }
  }
  process.exit(0);
}

/* ── Strategy: tdd (per-function line coverage) ──────────────── */
// Safety-critical opt-in: each tdd_focus function must be >= 70% line
// covered. fnMap ∩ statementMap intersection matches functions by
// source-line range (not by name), so anonymous arrows and re-exports
// still count provided the coverage tool emits them.

const covCmd = runShell(COVERAGE_COMMAND, { stdio: ['ignore', 'ignore', 'ignore'] });
if (covCmd.status !== 0) {
  console.error('BLOCKED: coverage command failed (test_strategy: tdd) — gate cannot verify tdd_focus.');
  console.error('Fix the failing tests and retry, or include [skip-coverage] in the commit message.');
  process.exit(2);
}
const coverageFile = join(PROJECT_ROOT, COVERAGE_FILE);
if (!existsSync(coverageFile)) {
  console.error('BLOCKED: Coverage report not generated at expected path.');
  console.error(`Expected: ${coverageFile}. Verify the COVERAGE_COMMAND writes this artifact.`);
  console.error('Bypass: include [skip-coverage] in commit message.');
  process.exit(2);
}

let cov;
try { cov = JSON.parse(readFileSync(coverageFile, 'utf8')); } catch { process.exit(0); }

const under = [];
const warnings = [];

for (const func of tddFocus) {
  let found = null;
  for (const fileEntry of Object.values(cov)) {
    if (!fileEntry || !fileEntry.fnMap || !fileEntry.statementMap || !fileEntry.s) continue;
    for (const fn of Object.values(fileEntry.fnMap)) {
      if (fn.name !== func) continue;
      const floc = fn.loc;
      // NOTE: Keys from statementMap whose start line falls within the
      // function's line range count as "this function's statements."
      // Tracks arrow/lambda bodies correctly without name matching.
      const keys = [];
      for (const [sKey, sLoc] of Object.entries(fileEntry.statementMap)) {
        if (sLoc.start.line >= floc.start.line && sLoc.start.line <= floc.end.line) {
          keys.push(sKey);
        }
      }
      const total = keys.length;
      const covered = keys.filter(k => fileEntry.s[k] > 0).length;
      const pct = total === 0 ? 100 : (covered / total) * 100;
      found = { total, covered, pct };
      break;
    }
    if (found) break;
  }
  if (found) {
    if (found.pct < COVERAGE_THRESHOLD) {
      under.push(`${func} (${Math.round(found.pct)}% line — ${found.covered}/${found.total}, below ${COVERAGE_THRESHOLD}%)`);
    }
  } else {
    // Two-tier result: "not found in fnMap" is a WARNING, not a block.
    // Bundler-inlined code, arrow aliases, and re-exports routinely
    // miss fnMap entries — block-on-miss would false-positive daily.
    warnings.push(`${func} (not found in fnMap — arrow/re-export/inlined; verify manually)`);
  }
}

if (warnings.length > 0) {
  console.error('COVERAGE WARNING:');
  for (const w of warnings) console.error(`  ⚠ ${w}`);
}

if (under.length > 0) {
  console.error(`BLOCKED: tdd_focus functions below ${COVERAGE_THRESHOLD}% line coverage:`);
  for (const u of under) console.error(`  ✗ ${u}`);
  console.error('Add tests to cover the missing lines, or refine tdd_focus.');
  console.error('Bypass: include [skip-coverage] in commit message.');
  process.exit(2);
}

process.exit(0);
