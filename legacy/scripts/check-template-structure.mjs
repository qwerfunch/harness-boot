#!/usr/bin/env node
/* ┌─────────────────────────────────────────────────────────────┐
 * │  Agent Template Structural Check                            │
 * │                                                             │
 * │  Static checks that catch the classes of drift that byte-   │
 * │  equality (verify-agent-bodies.mjs) can't see — it compares │
 * │  templates to generated agents, which only exist inside a   │
 * │  target harness. This script runs in the plugin repo and    │
 * │  asserts self-consistency:                                  │
 * │                                                             │
 * │  A. Every Tier-1 body template has YAML frontmatter with    │
 * │     name/description/tools/model, plus both body markers.   │
 * │  B. verify-agent-bodies.mjs's TIER1_AGENTS list matches the │
 * │     .tmpl files on disk (no orphans, no missing entries).   │
 * │  C. Every rule fragment referenced by commands/setup.md's   │
 * │     Phase 3 matrix exists under docs/templates/agents/rules.│
 * │  D. build-rule-fragments.mjs output is in sync with the     │
 * │     rules/ directory on disk (invoked via git-diff in CI;   │
 * │     not checked here to avoid shell dependence).            │
 * │                                                             │
 * │  Usage: node scripts/check-template-structure.mjs           │
 * │  Exit 0 silent / Exit 2 with findings to stdout.            │
 * └─────────────────────────────────────────────────────────────┘ */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const BODIES_DIR = join(REPO_ROOT, 'docs/templates/agents/bodies');
const RULES_DIR = join(REPO_ROOT, 'docs/templates/agents/rules');
const VERIFY_SCRIPT = join(REPO_ROOT, 'scripts/verify-agent-bodies.mjs');
const SETUP_MD = join(REPO_ROOT, 'commands/setup.md');

const REQUIRED_FRONTMATTER_KEYS = ['name', 'description', 'tools', 'model'];
const BODY_START = '<!-- AGENT_BODY_START -->';
const BODY_END = '<!-- AGENT_BODY_END -->';

const findings = [];
const record = (msg) => findings.push(msg);

/* ── A. Body-template self-consistency ────────────────────────── */

function parseFrontmatterKeys(text) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end < 0) return null;
  const fm = text.slice(4, end);
  const keys = new Set();
  for (const line of fm.split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

const tmplFiles = readdirSync(BODIES_DIR).filter((f) => f.endsWith('.md.tmpl'));
const tmplSlugs = new Set(tmplFiles.map((f) => basename(f, '.md.tmpl')));

for (const file of tmplFiles) {
  const path = join(BODIES_DIR, file);
  const text = readFileSync(path, 'utf8');
  const keys = parseFrontmatterKeys(text);
  if (keys === null) {
    record(`bodies/${file}: missing YAML frontmatter (must open with '---' delimiter)`);
    continue;
  }
  for (const key of REQUIRED_FRONTMATTER_KEYS) {
    if (!keys.has(key)) record(`bodies/${file}: frontmatter missing required key '${key}'`);
  }
  if (text.indexOf(BODY_START) < 0) record(`bodies/${file}: missing '${BODY_START}' marker`);
  if (text.indexOf(BODY_END) < 0) record(`bodies/${file}: missing '${BODY_END}' marker`);
  if (text.indexOf(BODY_START) > text.indexOf(BODY_END)) {
    record(`bodies/${file}: body markers present but in the wrong order (END before START)`);
  }
}

/* ── B. TIER1_AGENTS ↔ .tmpl consistency ──────────────────────── */

const verifySrc = readFileSync(VERIFY_SCRIPT, 'utf8');
const tier1Match = verifySrc.match(/const\s+TIER1_AGENTS\s*=\s*\[([^\]]+)\]/);
if (!tier1Match) {
  record(`verify-agent-bodies.mjs: cannot locate TIER1_AGENTS array (regex didn't match)`);
} else {
  const tier1List = [...tier1Match[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
  const tier1Set = new Set(tier1List);
  for (const slug of tier1Set) {
    if (!tmplSlugs.has(slug)) {
      record(`verify-agent-bodies.mjs TIER1_AGENTS includes '${slug}' but bodies/${slug}.md.tmpl does not exist`);
    }
  }
  for (const slug of tmplSlugs) {
    if (!tier1Set.has(slug)) {
      record(`bodies/${slug}.md.tmpl exists but verify-agent-bodies.mjs TIER1_AGENTS does not list '${slug}'`);
    }
  }
}

/* ── C. Rule fragments referenced by matrix all exist ─────────── */

const setupText = readFileSync(SETUP_MD, 'utf8');
// Match the Phase 3 Step 4 matrix header row.  We look for the "Agent |" line
// that contains "12 Input Sanitization" — its presence itself is an
// assertion that the matrix has been expanded to Rule 12.
const matrixHeader = setupText.match(/\|\s*Agent\s*\|[^\n]*12 Input Sanitization[^\n]*\|/);
if (!matrixHeader) {
  record(`commands/setup.md: Phase 3 matrix header does not include '12 Input Sanitization' column — either the matrix was not updated or Rule 12 rollout is incomplete`);
}

// Expected rule fragment files — NN corresponds to matrix columns 02..12
// (Rule 01 Language Settings is per-project, injected inline, no fragment).
const EXPECTED_RULE_FILES = [
  '02-comment-rules.md',
  '03-tdd-cycles.md',
  '04-file-classification.md',
  '05-feature-selection.md',
  '06-message-format.md',
  '07-coordinate-round-trip.md',
  '08-workspace-naming.md',
  '09-iteration-tracking.md',
  '10-cross-module-review.md',
  '11-qa-invocation-timing.md',
  '12-subagent-input-sanitization.md',
];
for (const f of EXPECTED_RULE_FILES) {
  if (!existsSync(join(RULES_DIR, f))) {
    record(`rules/${f}: missing — run 'node scripts/build-rule-fragments.mjs' to regenerate`);
  }
}

// Also flag unexpected files so accidental hand-edits surface.
const rulesDirFiles = readdirSync(RULES_DIR);
const EXPECTED_DIR_SET = new Set([...EXPECTED_RULE_FILES, 'README.md']);
for (const f of rulesDirFiles) {
  if (!EXPECTED_DIR_SET.has(f)) {
    record(`rules/${f}: unexpected file in rules directory (not in the expected set). If this is a new rule, add it to EXPECTED_RULE_FILES in scripts/check-template-structure.mjs`);
  }
}

/* ── Report ───────────────────────────────────────────────────── */

if (findings.length > 0) {
  for (const line of findings) console.log(line);
  process.exit(2);
}
process.exit(0);
