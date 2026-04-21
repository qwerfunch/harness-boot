#!/usr/bin/env node
/* ┌─────────────────────────────────────────────────────────────┐
 * │  Feature-Order Validator                                    │
 * │                                                             │
 * │  Verify feature-list.json is topologically ordered: for     │
 * │  every feature at array index i, every id in its            │
 * │  depends_on must appear at an index j < i. Single source    │
 * │  of truth for the check referenced from commands/setup.md   │
 * │  Phase 6 Step 7 and Step 8 item 16.                         │
 * │                                                             │
 * │  Usage:                                                     │
 * │    node scripts/validate-feature-order.mjs <path.json>      │
 * │    node scripts/validate-feature-order.mjs --self-test      │
 * │                                                             │
 * │  Exit 0 = valid (silent). Exit 2 = violation(s) printed to  │
 * │  stdout. Exit 1 = usage error or malformed JSON.            │
 * └─────────────────────────────────────────────────────────────┘ */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* ── Validator ───────────────────────────────────────────────── */

/**
 * Walk the features array and report any depends_on that resolves to
 * a later index. Returns the exit code to bubble up to the shell.
 *
 * NOTE: Emits one line per violation on stdout — stable output format
 * that Phase 6 and Step 8 parse; do not reformat without updating both.
 */
function validate(file) {
  let features;
  try {
    features = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`ERROR: ${file} is not valid JSON: ${e.message}`);
    return 1;
  }
  const lines = [];
  for (let i = 0; i < features.length; i++) {
    const id = features[i]?.id;
    if (!id) {
      lines.push(`index ${i} is missing the required \`id\` field`);
      continue;
    }
    // Normalize depends_on: ES default values only fire on `undefined`,
    // so explicit `"depends_on": null` would pass through and crash
    // `.filter`. Treat any non-array value as an empty list.
    const deps = Array.isArray(features[i].depends_on) ? features[i].depends_on : [];
    const earlier = new Set(features.slice(0, i).map(f => f?.id).filter(Boolean));
    const late = deps.filter(d => !earlier.has(d));
    if (late.length > 0) {
      lines.push(`${id} at index ${i} depends on ${late.join(',')} which appear later`);
    }
  }
  if (lines.length > 0) {
    console.log(lines.join('\n'));
    return 2;
  }
  return 0;
}

/* ── Self-test ───────────────────────────────────────────────── */

function selfTest() {
  const tmp = mkdtempSync(join(tmpdir(), 'vfo-'));
  let fails = 0;

  try {
    writeFileSync(join(tmp, 'valid.json'), JSON.stringify([
      { id: 'A', depends_on: [] },
      { id: 'B', depends_on: ['A'] },
      { id: 'C', depends_on: ['A', 'B'] },
    ]));
    writeFileSync(join(tmp, 'invalid.json'), JSON.stringify([
      { id: 'A', depends_on: ['B'] },
      { id: 'B', depends_on: [] },
    ]));
    writeFileSync(join(tmp, 'no-deps.json'), JSON.stringify([
      { id: 'A', depends_on: [] },
      { id: 'B', depends_on: [] },
    ]));

    const check = (label, expectedRc, expectedOut, file) => {
      // Capture stdout in-process so asserts run without forking.
      const origLog = console.log;
      let captured = '';
      console.log = (msg) => { captured += (captured ? '\n' : '') + msg; };
      let actualRc;
      try {
        actualRc = validate(file);
      } finally {
        console.log = origLog;
      }
      if (actualRc === expectedRc && captured === expectedOut) {
        console.log(`  PASS  ${label.padEnd(24)} rc=${actualRc} out=${JSON.stringify(captured)}`);
      } else {
        console.log(`  FAIL  ${label.padEnd(24)} expected rc=${expectedRc} out=${JSON.stringify(expectedOut)}; got rc=${actualRc} out=${JSON.stringify(captured)}`);
        fails++;
      }
    };

    console.log('== validate-feature-order self-test ==');
    check('valid order',   0, '',                                              join(tmp, 'valid.json'));
    check('invalid order', 2, 'A at index 0 depends on B which appear later',  join(tmp, 'invalid.json'));
    check('no deps',       0, '',                                              join(tmp, 'no-deps.json'));

    if (fails === 0) {
      console.log('== self-test: OK ==');
      return 0;
    }
    console.log(`== self-test: ${fails} FAILURE(S) ==`);
    return 1;
  } finally {
    // finally-block cleanup: temp dir is removed even when an assertion
    // above throws, so repeated runs don't accumulate /tmp/vfo-* debris.
    rmSync(tmp, { recursive: true, force: true });
  }
}

/* ── Main ────────────────────────────────────────────────────── */

const arg = process.argv[2];
if (arg === '--self-test') {
  process.exit(selfTest());
}
if (process.argv.length !== 3) {
  console.error(`Usage: ${process.argv[1]} <feature-list.json>`);
  console.error(`       ${process.argv[1]} --self-test`);
  process.exit(1);
}
process.exit(validate(arg));
