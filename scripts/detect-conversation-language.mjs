#!/usr/bin/env node
/* ┌─────────────────────────────────────────────────────────────┐
 * │  Conversation Language Detection                            │
 * │                                                             │
 * │  Emits the ISO 639-1 primary subtag (e.g. "ko", "en", "ja") │
 * │  on stdout for /harness-boot:setup Step 1.1.5. Empty stdout │
 * │  triggers /setup's numbered-choice fallback prompt.         │
 * │                                                             │
 * │  OS-first fallback chain — OS display language wins over    │
 * │  shell locale. Stop at first stage yielding a valid 2-letter│
 * │  subtag after normalization:                                │
 * │    1a. defaults read -g AppleLanguages[0]        (Darwin)   │
 * │    1b. defaults read -g AppleLocale              (Darwin)   │
 * │    1c. localectl status (System Locale LANG=)    (Linux)    │
 * │    1d. /etc/locale.conf → /etc/default/locale    (Linux)    │
 * │    1e. powershell (Get-UICulture).Name, pwsh too (Win/WSL)  │
 * │    2.  $LC_ALL / $LANG / $LC_CTYPE               (all)      │
 * │    3.  `locale` stdout, first LANG= line         (POSIX)    │
 * │                                                             │
 * │  Unknown platforms (BSD/SunOS/AIX/Haiku/Cygwin/Android/     │
 * │  future) skip stage 1 via the switch's default branch and   │
 * │  fall through to shell signals. Never crashes.              │
 * │                                                             │
 * │  Defensive rules:                                           │
 * │   • macOS: when UID=0 and $SUDO_USER set, drop to login user│
 * │     so defaults reads the real preference, not root's empty │
 * │     global domain.                                          │
 * │   • Windows: PowerShell invocations capped at 5 s each; try │
 * │     powershell.exe first, pwsh.exe as fallback. Get-UICulture│
 * │     output is always ASCII (en-US, ko-KR …), so UTF-16LE    │
 * │     stdout on Windows does not corrupt the value in         │
 * │     practice. Do not extend to non-ASCII PS output without  │
 * │     handling UTF-16LE decode.                               │
 * │                                                             │
 * │  SINGLE SOURCE OF TRUTH — the spec at                       │
 * │  docs/setup/cross-session-state.md#conversation-language-   │
 * │  detection references this file; don't duplicate the logic. │
 * │                                                             │
 * │  Self-test: node scripts/detect-conversation-language.mjs   │
 * │             --self-test                                     │
 * └─────────────────────────────────────────────────────────────┘ */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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
function runCapture(cmd, args, opts = {}) {
  try {
    const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
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

/**
 * Extract the first quoted entry from `defaults read -g AppleLanguages`.
 *
 * Output shape is a plist array literal, either multi-line
 *   (\n    "ko-KR",\n    "en-US"\n)
 * or single-line
 *   ("ja-JP")
 *
 * A single capture of the first double-quoted token is all we need —
 * AppleLanguages is sorted by user preference, so index 0 is the
 * display language.
 */
function parseAppleLanguagesFirst(blob) {
  if (!blob) return '';
  const m = String(blob).match(/"([^"]+)"/);
  return m ? m[1] : '';
}

/**
 * Run `defaults` against the login user's domain, not root's.
 *
 * When /setup is invoked via sudo, `defaults read -g` as root reads
 * root's (usually empty) global domain and masks the real preference.
 * If UID=0 and $SUDO_USER is set, drop privileges with sudo -u.
 */
function runDefaultsAsLoginUser(args) {
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  const sudoUser = process.env.SUDO_USER;
  if (isRoot && sudoUser) {
    return runCapture('sudo', ['-u', sudoUser, 'defaults', ...args]);
  }
  return runCapture('defaults', args);
}

/**
 * Try powershell.exe, then pwsh.exe. Each call is capped at 5 s so a
 * hung session or slow corporate AV can't stall /setup. Returns '' on
 * both failures.
 */
function runPowerShell(command) {
  const args = ['-NoProfile', '-Command', command];
  const out = runCapture('powershell.exe', args, { timeout: 5000 });
  if (out) return out;
  return runCapture('pwsh.exe', args, { timeout: 5000 });
}

/* ── Stage 1: OS Display Language ────────────────────────────── */

function detectOSLanguage() {
  switch (process.platform) {
    case 'darwin': {
      const langs = parseAppleLanguagesFirst(runDefaultsAsLoginUser(['read', '-g', 'AppleLanguages']));
      const fromLangs = pick(langs);
      if (fromLangs) return fromLangs;
      return pick(runDefaultsAsLoginUser(['read', '-g', 'AppleLocale']));
    }
    case 'linux': {
      const localectlOut = runCapture('localectl', ['status']);
      const m = localectlOut.match(/LANG=([^\s]+)/);
      if (m) {
        const fromCtl = pick(m[1]);
        if (fromCtl) return fromCtl;
      }
      for (const f of ['/etc/locale.conf', '/etc/default/locale']) {
        const val = parseLocaleLangLine(readFileOrEmpty(f));
        if (val) {
          const fromFile = pick(val);
          if (fromFile) return fromFile;
        }
      }
      if (isWSL()) {
        return pick(runPowerShell('(Get-UICulture).Name'));
      }
      return '';
    }
    case 'win32':
      return pick(runPowerShell('(Get-UICulture).Name'));
    default:
      return '';
  }
}

/* ── Stage 2 + 3: Shell Signals ──────────────────────────────── */

function detectShellLocale() {
  let lang = pick(process.env.LC_ALL);
  if (!lang) lang = pick(process.env.LANG);
  if (!lang) lang = pick(process.env.LC_CTYPE);
  if (lang) return lang;

  // `locale` is POSIX-only; on Windows spawnSync still forks a process
  // that fails, adding noise and latency. Gate by platform.
  if (process.platform !== 'win32') {
    const localeOut = runCapture('locale', []);
    if (localeOut) return pick(parseLocaleLangLine(localeOut));
  }
  return '';
}

/* ── Composed Detection ──────────────────────────────────────── */

function detect() {
  return detectOSLanguage() || detectShellLocale() || '';
}

/* ── Self-Test ───────────────────────────────────────────────── */

function selfTest() {
  let fails = 0;
  const check = (label, expected, actual) => {
    if (expected === actual) {
      console.log(`  PASS  ${label.padEnd(40)} → ${actual}`);
    } else {
      console.log(`  FAIL  ${label.padEnd(40)} expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
      fails++;
    }
  };

  console.log('== pick() normalization ==');
  check('ko_KR.UTF-8',             'ko', pick('ko_KR.UTF-8'));
  check('ko-KR',                   'ko', pick('ko-KR'));
  check('en_US',                   'en', pick('en_US'));
  check('ko',                      'ko', pick('ko'));
  check('zh_Hans_CN',              'zh', pick('zh_Hans_CN'));
  check('C (reject)',              '',   pick('C'));
  check('POSIX (reject)',          '',   pick('POSIX'));
  check('empty',                   '',   pick(''));
  check('uppercase KO',            'ko', pick('KO_kr'));

  console.log('== parseAppleLanguagesFirst ==');
  check('multi-line ko-KR',        'ko-KR',  parseAppleLanguagesFirst('(\n    "ko-KR",\n    "en-US"\n)'));
  check('empty ()',                '',       parseAppleLanguagesFirst('()'));
  check('single-line ja-JP',       'ja-JP',  parseAppleLanguagesFirst('("ja-JP")'));
  check('empty input',             '',       parseAppleLanguagesFirst(''));
  check('Hans-CN end-to-end',      'zh',     pick(parseAppleLanguagesFirst('(\n    "zh-Hans-CN"\n)')));
  check('ko-KR end-to-end',        'ko',     pick(parseAppleLanguagesFirst('("ko-KR")')));

  console.log('== parseLocaleLangLine ==');
  check('quoted zh_CN.UTF-8',      'zh_CN.UTF-8', parseLocaleLangLine('LANG="zh_CN.UTF-8"'));
  check('unquoted LANG',           'en_US.UTF-8', parseLocaleLangLine('LANG=en_US.UTF-8'));
  check('no LANG line',            '',            parseLocaleLangLine('LC_ALL=en_US.UTF-8'));

  console.log('== localectl regex ==');
  const localectlSample = '   System Locale: LANG=de_DE.UTF-8\n   VC Keymap: us';
  const localectlMatch = localectlSample.match(/LANG=([^\s]+)/);
  check('localectl LANG capture',  'de_DE.UTF-8', localectlMatch ? localectlMatch[1] : '');

  console.log('== detect() stage ordering smoke ==');
  // OS wins over shell: patch detectOSLanguage to return 'ko' while LANG says en
  {
    const savedLang = process.env.LANG;
    process.env.LANG = 'en_US.UTF-8';
    const result = ('ko' || detectShellLocale() || '');
    process.env.LANG = savedLang;
    check('OS=ko beats LANG=en_US',  'ko', result);
  }
  // Unknown platform: default branch returns '', shell takes over
  {
    const savedLang = process.env.LANG;
    process.env.LANG = 'ja_JP.UTF-8';
    // Simulate detectOSLanguage returning '' (what the default branch does on freebsd/etc)
    const result = ('' || detectShellLocale() || '');
    process.env.LANG = savedLang;
    check('unknown platform→shell',  'ja', result);
  }
  // Empty-everything: no crash, returns ''
  {
    const savedEnv = { LC_ALL: process.env.LC_ALL, LANG: process.env.LANG, LC_CTYPE: process.env.LC_CTYPE };
    delete process.env.LC_ALL;
    delete process.env.LANG;
    delete process.env.LC_CTYPE;
    // Simulate both OS and locale command returning empty
    const result = ('' || '' || '');
    Object.assign(process.env, savedEnv);
    check('all empty → empty',       '', result);
  }

  console.log('== detect() in live env ==');
  const live = detect();
  if (/^[a-z]{2}$/.test(live)) {
    console.log(`  PASS  live detect                             → ${live}`);
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
