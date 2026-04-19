#!/usr/bin/env node
/* ┌─────────────────────────────────────────────────────────────┐
 * │  Conversation Language Detection                            │
 * │                                                             │
 * │  Emits the ISO 639-1 primary subtag (e.g. "ko", "en", "ja") │
 * │  on stdout for /harness-boot:setup Step 1.1.5. Empty stdout │
 * │  triggers /setup's numbered-choice fallback prompt.         │
 * │                                                             │
 * │  OS-aware fallback chain — stop at first stage yielding a   │
 * │  valid 2-letter subtag after normalization:                 │
 * │    1. $LC_ALL / $LANG / $LC_CTYPE                (all)      │
 * │    2. `locale` stdout, first LANG= line          (POSIX)    │
 * │    3a. defaults read -g AppleLocale              (Darwin)   │
 * │    3b. /etc/locale.conf → locale → localectl    (Linux)    │
 * │    3c. powershell (Get-Culture).Name              (Win/WSL) │
 * │                                                             │
 * │  SINGLE SOURCE OF TRUTH — the spec at                       │
 * │  docs/setup/cross-session-state.md#conversation-language-   │
 * │  detection references this file; don't duplicate the logic. │
 * │                                                             │
 * │  Self-test: node scripts/detect-conversation-language.mjs   │
 * │             --self-test                                     │
 * └─────────────────────────────────────────────────────────────┘ */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

/* ── Normalization ───────────────────────────────────────────── */

/**
 * Normalize a raw locale string to its primary subtag.
 *
 * NOTE: Three-step pipeline — strip codeset (after `.`), take first
 * field (before `_` or `-`), lowercase, and reject anything that
 * isn't exactly two letters. This rejects the POSIX pseudo-locales
 * "C" and "POSIX" by design — they convey "no preference" and should
 * fall through to the next stage of the detection chain.
 */
function pick(raw) {
  if (!raw) return '';
  const beforeDot = String(raw).split('.')[0];
  const firstField = beforeDot.split(/[_-]/)[0];
  const lowered = firstField.toLowerCase();
  return /^[a-z]{2}$/.test(lowered) ? lowered : '';
}

/**
 * Silent command runner used by every fallback stage.
 *
 * NOTE: Errors (command missing, non-zero exit with no stdout) return
 * '' — a caller that wanted to surface the failure would have to run
 * the command themselves. The whole fallback chain depends on this
 * silence: a noisy `locale: command not found` printed to stderr on
 * every Windows-WSL run would pollute /setup's transcript.
 */
function runCapture(cmd, args) {
  try {
    const r = spawnSync(cmd, args, { encoding: 'utf8' });
    if (r.status !== 0 && !r.stdout) return '';
    return (r.stdout || '').replace(/\r/g, '').trim();
  } catch {
    return '';
  }
}

function parseLocaleLangLine(text) {
  const m = text.match(/^LANG=(.*)$/m);
  if (!m) return '';
  return m[1].replace(/^"|"$/g, '').trim();
}

function readFileOrEmpty(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function isWSL() {
  const osrelease = readFileOrEmpty('/proc/sys/kernel/osrelease');
  return /microsoft|wsl/i.test(osrelease);
}

/* ── Fallback Chain ──────────────────────────────────────────── */

function detect() {
  let lang = pick(process.env.LC_ALL);
  if (!lang) lang = pick(process.env.LANG);
  if (!lang) lang = pick(process.env.LC_CTYPE);

  if (!lang) {
    const localeOut = runCapture('locale', []);
    if (localeOut) lang = pick(parseLocaleLangLine(localeOut));
  }

  const platform = process.platform;

  if (platform === 'darwin') {
    if (!lang) lang = pick(runCapture('defaults', ['read', '-g', 'AppleLocale']));
  } else if (platform === 'linux') {
    if (!lang) {
      for (const f of ['/etc/locale.conf', '/etc/default/locale']) {
        const raw = readFileOrEmpty(f);
        const val = parseLocaleLangLine(raw);
        if (val) { lang = pick(val); if (lang) break; }
      }
    }
    if (!lang) {
      const localectlOut = runCapture('localectl', ['status']);
      const m = localectlOut.match(/LANG=([^\s]+)/);
      if (m) lang = pick(m[1]);
    }
    if (!lang && isWSL()) {
      lang = pick(runCapture('powershell.exe', ['-NoProfile', '-Command', '(Get-Culture).Name']));
    }
  } else if (platform === 'win32') {
    if (!lang) lang = pick(runCapture('powershell.exe', ['-NoProfile', '-Command', '(Get-Culture).Name']));
  }

  return lang;
}

/* ── Self-Test ───────────────────────────────────────────────── */

function selfTest() {
  let fails = 0;
  const check = (label, expected, actual) => {
    if (expected === actual) {
      console.log(`  PASS  ${label.padEnd(32)} → ${actual}`);
    } else {
      console.log(`  FAIL  ${label.padEnd(32)} expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
      fails++;
    }
  };

  console.log('== pick() normalization ==');
  check('ko_KR.UTF-8',   'ko', pick('ko_KR.UTF-8'));
  check('ko-KR',         'ko', pick('ko-KR'));
  check('en_US',         'en', pick('en_US'));
  check('ko',            'ko', pick('ko'));
  check('zh_Hans_CN',    'zh', pick('zh_Hans_CN'));
  check('C (reject)',    '',   pick('C'));
  check('POSIX (reject)', '',  pick('POSIX'));
  check('empty',         '',   pick(''));
  check('uppercase KO',  'ko', pick('KO_kr'));

  console.log('== detect() in live env ==');
  const live = detect();
  if (/^[a-z]{2}$/.test(live)) {
    console.log(`  PASS  live detect                     → ${live}`);
  } else {
    console.log('  INFO  live detect returned empty (expected on fully-stripped env)');
  }

  if (fails === 0) {
    console.log('== self-test: OK ==');
    return 0;
  }
  console.log(`== self-test: ${fails} FAILURE(S) ==`);
  return 1;
}

const arg = process.argv[2];
if (arg === '--self-test') {
  process.exit(selfTest());
}

process.stdout.write(detect() + '\n');
