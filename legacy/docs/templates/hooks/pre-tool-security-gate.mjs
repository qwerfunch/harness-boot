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
import { spawnSync } from 'node:child_process';

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

// Compact: `rm -rf /`, `rm -r -f /`, `rm -fr /`, or long-form equivalents.
if (/(^|\s)rm\s+(-[A-Za-z]*[rRfF][A-Za-z]*(\s+-[A-Za-z]*[rRfF][A-Za-z]*)*|--recursive(\s+--force)?|--force\s+--recursive)\s+\/($|\s)/.test(command)) {
  block('rm -rf / (or equivalent root wipe)');
}

// Branch-name-in-command heuristic: cheap, catches the common copy-paste.
if (/git\s+push\s+.*(--force|-f(\s|$))/.test(command) && /(main|master|release|prod)/.test(command)) {
  block('git push --force to protected branch');
}

// Current-branch heuristic: catches `git push -f origin "$BRANCH"` when
// HEAD itself sits on a protected branch. Costs one git invocation per
// push; acceptable because force-push is rare.
if (/git\s+push\s+.*(--force|-f(\s|$))/.test(command)) {
  const head = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' });
  const branch = head.status === 0 ? head.stdout.trim() : '';
  if (/^(main|master|release|prod)$/.test(branch)) {
    block(`git push --force on protected branch "${branch}"`);
  }
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
