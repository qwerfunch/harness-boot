#!/usr/bin/env node
/* ┌─────────────────────────────────────────────────────────────┐
 * │  SessionStart — Bootstrap                                   │
 * │                                                             │
 * │  Prints a session-start briefing to stdout (shown to        │
 * │  Claude): PROGRESS.md status, current TDD state,            │
 * │  feature-list.json counts, state drift between the two,     │
 * │  topological sanity of depends_on, and recent commits.      │
 * │                                                             │
 * │  Non-blocking: exit 0 always. Failures surface as text in   │
 * │  the briefing rather than breaking the session.             │
 * │  Related: PROGRESS.md, feature-list.json, /start Step 1     │
 * └─────────────────────────────────────────────────────────────┘ */

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

function gitRoot() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : process.cwd();
}

const PROJECT_ROOT = gitRoot();
const PROGRESS_FILE = join(PROJECT_ROOT, 'PROGRESS.md');
const FEATURE_LIST = join(PROJECT_ROOT, 'feature-list.json');

/**
 * Return the body of the markdown section whose heading line matches
 * headerRe, stopping at the next `## ` heading.
 *
 * NOTE: Heading is treated as a delimiter only (not included). Returns
 * an empty string when the section is missing — callers branch on that.
 */
function readProgressSection(text, headerRe) {
  const lines = text.split('\n');
  const out = [];
  let inSection = false;
  for (const line of lines) {
    if (headerRe.test(line)) { inSection = true; continue; }
    if (inSection && /^## /.test(line)) break;
    if (inSection) out.push(line);
  }
  return out.join('\n').trim();
}

/* ── PROGRESS.md rendering ────────────────────────────────────── */

if (existsSync(PROGRESS_FILE)) {
  const progress = readFileSync(PROGRESS_FILE, 'utf8');
  console.log('## Session Bootstrap');
  console.log('');
  console.log('### PROGRESS.md Status');
  const status = readProgressSection(progress, /^## Status/);
  console.log(status.split('\n').slice(0, 20).join('\n'));
  console.log('');

  const tddState = readProgressSection(progress, /^## Current TDD State/);
  console.log('### Current TDD State');
  if (tddState) {
    console.log(tddState.split('\n').slice(0, 10).join('\n'));
  } else {
    console.log('(no active TDD cycle)');
  }
  console.log('');
}

/* ── feature-list.json counts ────────────────────────────────── */

let features = null;
if (existsSync(FEATURE_LIST)) {
  try {
    features = JSON.parse(readFileSync(FEATURE_LIST, 'utf8'));
  } catch {
    features = null;
  }
  const total = features ? features.length : '?';
  const passing = features ? features.filter(f => f.passes === true).length : '?';
  console.log('### feature-list.json');
  console.log(`- Features: ${passing} / ${total} passing`);
  console.log('');
}

/* ── State drift: PROGRESS.md checkbox ↔ feature.passes ───────── */

if (existsSync(PROGRESS_FILE) && features) {
  const progress = readFileSync(PROGRESS_FILE, 'utf8');
  const drift = [];
  const malformed = [];
  for (const { id, passes } of features) {
    if (!id) { malformed.push('(missing id)'); continue; }
    // Escape regex metacharacters in id so feature IDs like "FEAT-1.2"
    // don't accidentally match as patterns.
    const m = progress.match(new RegExp(`^\\s*[-*]\\s+\\[([ x])\\]\\s+${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'));
    if (!m) continue;
    const checked = m[1] === 'x';
    if (checked && passes === false) {
      drift.push(`  - ${id}: PROGRESS.md=Complete, feature-list.json=passes:false`);
    } else if (!checked && passes === true) {
      drift.push(`  - ${id}: PROGRESS.md=Incomplete, feature-list.json=passes:true`);
    }
  }
  if (malformed.length > 0) {
    console.log('### ⚠ Malformed feature-list.json entries');
    console.log(`  - ${malformed.length} feature(s) missing required \`id\` field.`);
    console.log('');
  }
  if (drift.length > 0) {
    console.log('### ⚠ State Drift Detected');
    for (const line of drift) console.log(line);
    console.log('Resolve before starting new work.');
    console.log('');
  }
}

/* ── Topological sanity of depends_on ─────────────────────────── */

// ⚠️ Intentional duplication of validate-feature-order.mjs logic —
// this hook is copied standalone into generated harnesses, which have
// no access to the plugin's scripts/ directory. Any fix to the check
// must be applied in both places.

if (features) {
  const violations = [];
  for (let i = 0; i < features.length; i++) {
    const id = features[i]?.id;
    if (!id) continue;
    // Normalize depends_on: JSON null and missing both become []. ES default
    // values only fire on `undefined`, so explicit null would crash `.filter`.
    const deps = Array.isArray(features[i].depends_on) ? features[i].depends_on : [];
    const earlier = new Set(features.slice(0, i).map(f => f?.id).filter(Boolean));
    const late = deps.filter(d => !earlier.has(d));
    if (late.length > 0) {
      violations.push(`  - ${id} at index ${i} depends on ${late.join(',')} which appear later`);
    }
  }
  if (violations.length > 0) {
    console.log('### ⚠ Dependency Order Drift');
    for (const line of violations) console.log(line);
    console.log("feature-list.json array order violates depends_on. Reorder (Kahn's algorithm) before /start.");
    console.log('');
  }
}

/* ── Recent commits ──────────────────────────────────────────── */

console.log('### Recent Commits');
const log = spawnSync('git', ['-C', PROJECT_ROOT, 'log', '--oneline', '-5'], { encoding: 'utf8' });
if (log.status === 0 && log.stdout) {
  process.stdout.write(log.stdout);
} else {
  console.log('(no git history)');
}

process.exit(0);
