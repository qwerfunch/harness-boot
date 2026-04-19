#!/usr/bin/env node
/* ┌─────────────────────────────────────────────────────────────┐
 * │  PreToolUse(Bash) — Security Gate                           │
 * │                                                             │
 * │  Pattern-based block list for the four classes of bash      │
 * │  invocation we never want to see in a harness session:      │
 * │  root wipes, force-pushes to protected branches, pipe-to-   │
 * │  shell installers, and reads of secret files / shell        │
 * │  dotfiles. Language-independent — operates on the raw       │
 * │  command string before any interpreter sees it.             │
 * │                                                             │
 * │  Exit codes: 0 allow, 2 block (reason printed to stderr).   │
 * │  Contract: heuristic, NOT a sandbox. A determined caller    │
 * │  can always construct a variant the regexes don't match —   │
 * │  these catch the common shapes, that's the whole promise.   │
 * │  Related: docs/setup/runtime-guardrails.md                  │
 * └─────────────────────────────────────────────────────────────┘ */

import { readFileSync } from 'node:fs';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const tool = input?.tool_name || '';
const command = input?.tool_input?.command || '';

if (tool !== 'Bash' || !command) process.exit(0);

function block(reason) {
  console.error(`BLOCKED by security-gate: ${reason}`);
  console.error(`Command: ${command}`);
  process.exit(2);
}

/* ── Destructive filesystem operations ────────────────────────── */

if (/(^|\s)rm\s+(-[A-Za-z]*[rRf][A-Za-z]*\s+)+\/($|\s)/.test(command)) {
  block('rm -rf / (or equivalent root wipe)');
}

// ⚠️ Matches only when `--force` AND a protected-branch keyword appear in
// the same command string. Crafted multi-line or variable-expanded
// invocations (e.g., `git push $REMOTE --force`) will slip past — accept
// the false-negative; a full shell AST parser is out of scope here.
if (/git\s+push\s+.*(--force|-f(\s|$))/.test(command) && /(main|master|release|prod)/.test(command)) {
  block('git push --force to protected branch');
}

/* ── Pipe-to-shell (remote code execution) ────────────────────── */

if (/(curl|wget)\s.*\|\s*(sh|bash|zsh)/.test(command)) {
  block('curl|sh or wget|sh (remote code execution)');
}

/* ── Secret / credential file access ──────────────────────────── */

if (/(cat|less|more|head|tail|vim|nano|emacs)\s+.*\.env($|\s|\.)/.test(command)) {
  block('.env file access');
}

if (/(cat|less|more|head|tail|vim|nano|emacs)\s+.*(credentials\.json|id_rsa|\.pem|\.key($|\s))/.test(command)) {
  block('secret/credentials file access');
}

/* ── Shell history / rc-file tampering ────────────────────────── */

if (/(rm|mv|>|>>)\s+.*\.(bash_history|zsh_history|bashrc|zshrc|profile)/.test(command)) {
  block('shell history/config tampering');
}

process.exit(0);
