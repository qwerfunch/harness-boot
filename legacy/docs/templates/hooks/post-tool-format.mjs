#!/usr/bin/env node
/* ┌─────────────────────────────────────────────────────────────┐
 * │  PostToolUse(Write|Edit) — Auto-Formatter                   │
 * │                                                             │
 * │  Dispatches to a language-appropriate formatter based on    │
 * │  file extension. Non-blocking: missing formatter, missing   │
 * │  binary, non-zero exit — all intentionally swallowed so     │
 * │  a formatter hiccup never interrupts the agent's flow.      │
 * │                                                             │
 * │  Extension-dispatched rather than stack-detected — lets     │
 * │  polyglot projects (TS + Python + Go) format correctly      │
 * │  without per-stack hook config.                             │
 * │  Related: docs/setup/runtime-guardrails.md                  │
 * └─────────────────────────────────────────────────────────────┘ */

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extname } from 'node:path';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const file = input?.tool_input?.file_path || '';
if (!file || !existsSync(file)) process.exit(0);

/* ── Binary-presence probe ────────────────────────────────────── */

/**
 * Return true if `bin` resolves on PATH. Uses `where` on Windows,
 * `which` elsewhere — both exit non-zero when the binary is missing,
 * which is the only signal we need.
 */
function has(bin) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { stdio: 'ignore' });
  return r.status === 0;
}

/**
 * Fire-and-forget formatter invocation.
 *
 * NOTE: Errors (missing binary, non-zero exit, permission denied) are
 * intentionally swallowed. The contract of this hook is "best-effort
 * formatting"; surfacing formatter failures would violate the non-
 * blocking promise and break the developer's edit flow.
 */
function run(cmd, args) {
  try { spawnSync(cmd, args, { stdio: 'ignore' }); } catch { /* swallow */ }
}

/* ── Extension dispatch ───────────────────────────────────────── */

const ext = extname(file).toLowerCase();
const prettierExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.scss', '.html', '.md', '.yaml', '.yml']);

if (prettierExts.has(ext)) {
  if (has('npx')) run('npx', ['--no-install', 'prettier', '--write', file]);
} else if (ext === '.py') {
  if (has('black')) run('black', ['--quiet', file]);
  if (has('isort')) run('isort', ['--quiet', file]);
} else if (ext === '.go') {
  if (has('gofmt')) run('gofmt', ['-w', file]);
} else if (ext === '.rs') {
  if (has('rustfmt')) run('rustfmt', ['--quiet', file]);
} else if (ext === '.java') {
  if (has('google-java-format')) run('google-java-format', ['-i', file]);
} else if (ext === '.rb') {
  if (has('rubocop')) run('rubocop', ['-a', file]);
}

process.exit(0);
