#!/usr/bin/env node
/* ┌─────────────────────────────────────────────────────────────┐
 * │  Docs Size Policy (non-blocking)                            │
 * │                                                             │
 * │  Reports any `.md` under `docs/` exceeding 500 lines with   │
 * │  no `<!-- size-exception: ... -->` opt-out. Rationale:      │
 * │  Claude Code slash commands load referenced files whole,    │
 * │  so oversized docs balloon context.                         │
 * │                                                             │
 * │  Non-blocking by design — always exits 0. Silent exit is    │
 * │  expected on fresh repos where `docs/` does not exist yet.  │
 * │  Related: docs/templates/README.md "Docs Size Policy"       │
 * └─────────────────────────────────────────────────────────────┘ */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');
const LIMIT = 500;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

const docsDir = join(REPO_ROOT, 'docs');
let violations = 0;

// ⚠️ Silent exit when docs/ is missing — expected during initial
// bootstrap before /setup has generated the tree. Printing "docs/ not
// found" would create false-alarm noise in every pre-setup CI run.
try {
  statSync(docsDir);
} catch {
  process.exit(0);
}

for (const file of walk(docsDir)) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
  if (lines > LIMIT && !content.includes('size-exception:')) {
    console.log(`${relative(REPO_ROOT, file)}: ${lines} lines (limit ${LIMIT}, no size-exception)`);
    violations++;
  }
}

if (violations === 0) {
  console.log(`OK: all docs/**.md within ${LIMIT}-line limit (or carry a size-exception comment).`);
}

// Non-blocking: always exit 0 so the hook does not stop commits/CI.
process.exit(0);
