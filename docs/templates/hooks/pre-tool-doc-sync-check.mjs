#!/usr/bin/env node
/* ┌─────────────────────────────────────────────────────────────┐
 * │  PreToolUse(Bash) — Doc-Sync Gate                           │
 * │                                                             │
 * │  Blocks `git commit` when a staged source change modifies   │
 * │  *exports* (public surface) without also staging the        │
 * │  feature's declared `doc_sync` targets. Internal refactors  │
 * │  that touch no exports pass through unconditionally — the   │
 * │  gate is permissive by design.                              │
 * │                                                             │
 * │  Exit codes: 0 allow, 2 block. Bypass: [skip-doc-sync] in   │
 * │  the commit message. Related: runtime-guardrails.md         │
 * └─────────────────────────────────────────────────────────────┘ */

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const tool = input?.tool_name || '';
const command = input?.tool_input?.command || '';

if (tool !== 'Bash' || !/^git\s+commit/.test(command)) process.exit(0);
if (command.includes('[skip-doc-sync]')) process.exit(0);

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
const current = features.find(f => f.passes === false);
if (!current) process.exit(0);

/* ── Staged-diff scan ─────────────────────────────────────────── */

const stagedRes = spawnSync('git', ['-C', PROJECT_ROOT, 'diff', '--cached', '--name-only'], { encoding: 'utf8' });
const stagedFiles = (stagedRes.stdout || '').split('\n').filter(Boolean);
if (stagedFiles.length === 0) process.exit(0);

const SRC_PREFIXES = ['src/', 'lib/', 'app/', 'packages/', 'internal/', 'pkg/', 'cmd/'];

/**
 * Return the export-detection regex for a given file's language.
 *
 * NOTE: These patterns are deliberately loose — over-block (false
 * positive on internal helpers that happen to look exported) is
 * preferred to under-block (missed API change). The agent can bypass
 * with [skip-doc-sync] when a false positive fires; a missed export
 * change would ship undocumented and is much harder to catch later.
 */
function patternFor(file) {
  if (file.endsWith('.py'))
    return /^[+-](export|pub fn|pub struct|pub enum|public [a-zA-Z]|(def|class)\s+[A-Za-z])/m;
  if (file.endsWith('.go'))
    return /^[+-](export|pub fn|pub struct|pub enum|public [a-zA-Z]|(func|type|var|const)\s+[A-Z])/m;
  // ⚠️ Fallback regex is the most permissive of the three. It's the
  // last line of defense for unknown/unlisted extensions; language-
  // specific branches above handle the 99% case.
  return /^[+-].*(export|pub fn|pub struct|pub enum|public [a-zA-Z])/m;
}

let exportChanged = false;
for (const file of stagedFiles) {
  if (!SRC_PREFIXES.some(p => file.startsWith(p))) continue;
  const diff = spawnSync('git', ['-C', PROJECT_ROOT, 'diff', '--cached', '-U0', '--', file], { encoding: 'utf8' });
  if (diff.status !== 0) continue;
  if (patternFor(file).test(diff.stdout || '')) {
    exportChanged = true;
    break;
  }
}

// Internal-only change — no public surface moved, so doc-sync is moot.
if (!exportChanged) process.exit(0);

/* ── Doc-sync target verification ─────────────────────────────── */

const docTargets = Array.isArray(current.doc_sync) ? current.doc_sync : [];

if (docTargets.length === 0) {
  if (stagedFiles.some(f => f.endsWith('.md'))) process.exit(0);
  console.error('BLOCKED: Export change detected but no .md doc update staged.');
  console.error('Bypass: include [skip-doc-sync] in commit message.');
  process.exit(2);
}

const stagedSet = new Set(stagedFiles);
const missing = docTargets.filter(t => !stagedSet.has(t));

if (missing.length > 0) {
  console.error('BLOCKED: Export change detected but doc_sync targets not staged:');
  for (const m of missing) console.error(`  ✗ ${m}`);
  console.error('Update docs or bypass with [skip-doc-sync] in commit message.');
  process.exit(2);
}

process.exit(0);
