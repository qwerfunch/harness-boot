#!/usr/bin/env node
/* ┌─────────────────────────────────────────────────────────────┐
 * │  Agent Rule Fragment Pre-Bake                               │
 * │                                                             │
 * │  Extracts verbatim rule sections from the canonical source  │
 * │  files (docs/setup/*, docs/protocols/*, commands/start.md,  │
 * │  docs/templates/protocols/*) into                           │
 * │  docs/templates/agents/rules/NN-*.md. /setup Phase 3 then   │
 * │  concats those fragments into generated agents instead of   │
 * │  asking the model to regenerate the same rule text for      │
 * │  every harness — saves latency and eliminates paraphrase    │
 * │  drift between harnesses.                                   │
 * │                                                             │
 * │  Fragments are DERIVED. Never hand-edit the output files —  │
 * │  edit the source and re-run this script. CI fails if the    │
 * │  rules/ tree drifts from the generator's output.            │
 * │  Related: commands/setup.md Phase 3, docs/templates/README  │
 * └─────────────────────────────────────────────────────────────┘ */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');
const DEST = join(REPO_ROOT, 'docs/templates/agents/rules');
mkdirSync(DEST, { recursive: true });

/* ── Extractor ───────────────────────────────────────────────── */

/**
 * Rewrite plugin-internal references into target-harness-valid ones.
 * Rule fragments are concatenated verbatim into `.claude/agents/*.md`
 * in the target project, which has no access to `docs/setup/*`,
 * `docs/protocols/*`, `docs/templates/*`, or `commands/*`. Without this
 * step, baked references would dangle on the target side.
 */
function rewriteTargetReferences(text) {
  return text
    // Comment Rules are embedded into each agent body at Phase 3 — point there, not the plugin spec.
    .replace(/`docs\/setup\/code-style\.md#comment-rules`/g, "this agent's `## Comment Rules` section")
    // Target harness copies protocols into `.claude/protocols/`.
    .replace(/`docs\/templates\/protocols\/([a-z0-9-]+)\.md/g, "`.claude/protocols/$1.md")
    // tdd-cycles body is embedded in each implementer's own `## TDD Cycles` section at Phase 3.
    .replace(/`docs\/protocols\/tdd-cycles\.md`/g, "this agent's `## TDD Cycles` section")
    // Gate 5 Runtime Smoke lives in the generated orchestrator's body in the target harness.
    .replace(/`docs\/setup\/agents-and-gates\.md` anchor `runtime-smoke-gate`/g, "the orchestrator's `## Gate 5: Runtime Smoke` section")
    .replace(/`docs\/setup\/agents-and-gates\.md`/g, "the orchestrator's embedded gate sections");
}

/**
 * Slice lines from startRe (inclusive) up to stopRe (exclusive) and
 * write the result to destPath. stopRe === null means "to EOF".
 *
 * NOTE: `readFileSync` on a file ending with `\n` splits into a list
 * whose last element is the empty string after the final newline. We
 * drop it before re-emitting so the output doesn't gain a phantom
 * blank line vs. the awk `{ print }` loop we're replacing. An empty
 * or whitespace-only extraction aborts the build — a silent empty
 * fragment would be embedded in every generated agent.
 */
function extract(srcPath, startRe, stopRe, destPath) {
  const raw = readFileSync(srcPath, 'utf8');
  const lines = raw.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '' && raw.endsWith('\n')) {
    lines.pop();
  }
  const out = [];
  let found = false;
  let stopMatched = false;
  for (const line of lines) {
    if (!found) {
      if (startRe.test(line)) { found = true; out.push(line); }
      continue;
    }
    if (stopRe && stopRe.test(line)) { stopMatched = true; break; }
    out.push(line);
  }
  if (out.length === 0 || out.every(l => l.trim() === '')) {
    console.error(`ERROR: empty extraction — ${destPath} (start=${startRe} stop=${stopRe} src=${srcPath})`);
    process.exit(1);
  }
  // A non-null stopRe that never matches means the source was renamed;
  // silently extending to EOF would bleed unrelated sections into the fragment.
  if (stopRe !== null && !stopMatched) {
    console.error(`ERROR: stopRe never matched — ${destPath} (stop=${stopRe} src=${srcPath}). Likely a source heading rename; update the generator.`);
    process.exit(1);
  }
  // Per-line trailing `\n` matches the awk reference implementation.
  const text = rewriteTargetReferences(out.map(l => l + '\n').join(''));
  writeFileSync(destPath, text);
  return text;
}

/* ── Rule 02 — Comment Rules ──────────────────────────────────── */
extract(
  join(REPO_ROOT, 'docs/setup/code-style.md'),
  /^## Comment Rules <!-- anchor: comment-rules -->/,
  /^## Logging Design Rules/,
  join(DEST, '02-comment-rules.md'),
);

/* ── Rule 03 — TDD Cycles + Gate 0 Evidence ──────────────────── */
// Rule 03 is unique: it composes two disjoint sections from the same
// source file into one fragment, so we need the extracted text in
// memory rather than on disk before concat.
const tddSrc = join(REPO_ROOT, 'docs/protocols/tdd-cycles.md');

/**
 * Same contract as extract(), but returns the sliced text instead of
 * writing it — enables in-memory composition for the Rule 03 concat.
 */
function extractToString(srcPath, startRe, stopRe) {
  const raw = readFileSync(srcPath, 'utf8');
  const lines = raw.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '' && raw.endsWith('\n')) {
    lines.pop();
  }
  const out = [];
  let found = false;
  let stopMatched = false;
  for (const line of lines) {
    if (!found) {
      if (startRe.test(line)) { found = true; out.push(line); }
      continue;
    }
    if (stopRe && stopRe.test(line)) { stopMatched = true; break; }
    out.push(line);
  }
  if (out.length === 0) {
    console.error(`ERROR: empty extraction (start=${startRe} stop=${stopRe} src=${srcPath})`);
    process.exit(1);
  }
  if (stopRe !== null && !stopMatched) {
    console.error(`ERROR: stopRe never matched (stop=${stopRe} src=${srcPath}). Likely a source heading rename; update the generator.`);
    process.exit(1);
  }
  return rewriteTargetReferences(out.map(l => l + '\n').join(''));
}

const cyclesBody = extractToString(tddSrc, /^## Cycle: lean-tdd <!-- anchor: cycle-lean-tdd -->/, /^---$/);
const gateBody = extractToString(tddSrc, /^The orchestrator runs this check BEFORE Gate 1/, null);

const tddCombined = `## TDD Cycles\n\n${cyclesBody}\n## Gate 0 Evidence\n\n${gateBody}`;
writeFileSync(join(DEST, '03-tdd-cycles.md'), tddCombined.endsWith('\n') ? tddCombined : tddCombined + '\n');

/* ── Rule 04 — File Classification ───────────────────────────── */
extract(
  join(REPO_ROOT, 'docs/setup/tdd-isolation.md'),
  /^## File Classification for tdd-test-writer <!-- anchor: file-classification-for-tdd-test-writer -->/,
  /^## Implementer's TDD Orchestration Flow/,
  join(DEST, '04-file-classification.md'),
);

/* ── Rule 05 — Feature Selection Algorithm ────────────────────── */
extract(
  join(REPO_ROOT, 'commands/start.md'),
  /^#### Feature selection <!-- anchor: feature-selection-algorithm -->/,
  /^### Step 4: Execute Development Cycle/,
  join(DEST, '05-feature-selection.md'),
);

/* ── Rule 06 — Message Format Contract ────────────────────────── */
extract(
  join(REPO_ROOT, 'docs/templates/protocols/message-format.md'),
  /^## Core fields <!-- anchor: core-fields -->/,
  /^## `_workspace\/` naming convention/,
  join(DEST, '06-message-format.md'),
);

/* ── Rule 07 — Coordinate Round-Trip ──────────────────────────── */
extract(
  join(REPO_ROOT, 'docs/templates/protocols/message-format.md'),
  /^## Coordination across modules <!-- anchor: coordinate-round-trip -->/,
  /^## Out of scope/,
  join(DEST, '07-coordinate-round-trip.md'),
);

/* ── Rule 08 — Workspace Artifact Path Convention ─────────────── */
extract(
  join(REPO_ROOT, 'docs/templates/protocols/message-format.md'),
  /^## `_workspace\/` naming convention <!-- anchor: workspace-naming -->/,
  /^## Example — parallel dispatch and collect/,
  join(DEST, '08-workspace-naming.md'),
);

/* ── Rule 09 — Iteration Tracking ─────────────────────────────── */
extract(
  join(REPO_ROOT, 'commands/start.md'),
  /^\*\*Iteration tracking\*\*.*<!-- anchor: iteration-tracking -->/,
  /^#### TDD \/ BDD sub-agent input sanitization/,
  join(DEST, '09-iteration-tracking.md'),
);

/* ── Rule 10 — Cross-Module Review Stage ──────────────────────── */
extract(
  join(REPO_ROOT, 'docs/setup/agents-and-gates.md'),
  /^### Gate 2: Cross-Module Review Stage <!-- anchor: cross-module-review -->/,
  /^### Gate 2\.5: Intent Verification/,
  join(DEST, '10-cross-module-review.md'),
);

/* ── Rule 11 — QA Invocation Timing ───────────────────────────── */
extract(
  join(REPO_ROOT, 'commands/start.md'),
  /^\*\*QA agent invocation points\*\*.*<!-- anchor: qa-invocation-timing -->/,
  /^### Step 5: Confirm Quality Gate Passage/,
  join(DEST, '11-qa-invocation-timing.md'),
);

/* ── Readme guard ─────────────────────────────────────────────── */
writeFileSync(join(DEST, 'README.md'), `# Agent Rule Fragments — DO NOT HAND-EDIT

These fragments are generated by \`scripts/build-rule-fragments.mjs\` from:
- \`docs/setup/code-style.md\` (Rule 02)
- \`docs/protocols/tdd-cycles.md\` (Rule 03)
- \`docs/setup/tdd-isolation.md\` (Rule 04)
- \`commands/start.md\` (Rules 05, 09, 11)
- \`docs/templates/protocols/message-format.md\` (Rules 06, 07, 08)
- \`docs/setup/agents-and-gates.md\` (Rule 10)

\`/setup\` Phase 3 concatenates these into generated agent bodies — skipping
the model "rewrite from scratch" step that dominates setup time.

**To modify a rule**: edit the source file above, then re-run
\`scripts/build-rule-fragments.mjs\`. CI fails if this directory drifts from the
generator's output.
`);

console.log('Generated:');
for (const entry of readdirSync(DEST).sort()) {
  console.log(`  ${entry}`);
}
