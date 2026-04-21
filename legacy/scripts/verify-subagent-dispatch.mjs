#!/usr/bin/env node
/* ┌─────────────────────────────────────────────────────────────┐
 * │  Subagent Dispatch Migration Verifier                       │
 * │                                                             │
 * │  Scan a target project's .claude/ for residue from the      │
 * │  pre-Subagent-Dispatch harness (Agent Team primitives, the  │
 * │  old ## Team Communication Protocol section header). Used   │
 * │  by docs/migration-subagent-dispatch.md as the post-        │
 * │  regeneration / post-patch check.                           │
 * │                                                             │
 * │  Usage:                                                     │
 * │    node scripts/verify-subagent-dispatch.mjs [project-root] │
 * │                                                             │
 * │  Default project-root is cwd. Exit 0 = clean. Exit 2 =      │
 * │  findings printed to stdout (one per line). Exit 1 = usage  │
 * │  error (missing .claude/).                                  │
 * └─────────────────────────────────────────────────────────────┘ */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const OPERATIVE_PRIMITIVES = /\b(TeamCreate|SendMessage|TaskCreate|TaskUpdate)\s*\(/;
const MENTIONED_PRIMITIVES = /\b(TeamCreate|SendMessage|TaskCreate|TaskUpdate)\b/;
const OLD_SECTION_HEADER = /^##\s+Team Communication Protocol\s*$/m;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (st.isFile() && name.endsWith('.md')) out.push(p);
  }
  return out;
}

function classifyLine(line) {
  if (!MENTIONED_PRIMITIVES.test(line)) return null;
  if (OPERATIVE_PRIMITIVES.test(line)) return 'operative';
  if (/\b(legacy|previously|formerly|replaces|replaced|no longer|divergence|not used)\b/i.test(line)) return null;
  return 'mention';
}

function scanFile(path) {
  const body = readFileSync(path, 'utf8');
  const findings = [];
  if (OLD_SECTION_HEADER.test(body)) {
    findings.push({ path, kind: 'old-section-header', detail: '## Team Communication Protocol' });
  }
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const cls = classifyLine(lines[i]);
    if (cls === 'operative') {
      findings.push({ path, kind: 'operative-primitive', detail: lines[i].trim(), line: i + 1 });
    } else if (cls === 'mention') {
      findings.push({ path, kind: 'bare-mention', detail: lines[i].trim(), line: i + 1 });
    }
  }
  return findings;
}

function main() {
  const root = resolve(process.argv[2] ?? process.cwd());
  const claudeDir = join(root, '.claude');
  if (!existsSync(claudeDir)) {
    console.error(`No .claude/ directory at ${root}`);
    process.exit(1);
  }
  const findings = walk(claudeDir).flatMap(scanFile);
  if (findings.length === 0) {
    process.exit(0);
  }
  for (const f of findings) {
    const loc = f.line ? `${f.path}:${f.line}` : f.path;
    console.log(`[${f.kind}] ${loc} — ${f.detail}`);
  }
  const blocking = findings.filter(f => f.kind !== 'bare-mention').length;
  if (blocking === 0) {
    console.error(`\n${findings.length} bare mention(s) — review manually; exit 0.`);
    process.exit(0);
  }
  console.error(`\n${blocking} blocking finding(s) — regenerate or patch per docs/migration-subagent-dispatch.md.`);
  process.exit(2);
}

main();
